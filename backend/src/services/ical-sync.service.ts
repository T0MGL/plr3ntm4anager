import axios, { AxiosError, AxiosResponse } from 'axios';
import ical from 'node-ical';
import { createHash } from 'node:crypto';
import { eachDayOfInterval, format } from 'date-fns';
import pLimit from 'p-limit';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { SyncStatus } from '../types';
import { env } from '../config/env';

interface BlockedDateRange {
  start: Date;
  end: Date;
  summary: string;
}

interface UnitSyncRow {
  id: string;
  airbnb_ical_url: string;
  ical_body_hash: string | null;
  ical_last_etag: string | null;
  ical_last_modified: string | null;
}

interface SyncAvailabilityDiff {
  inserted: number;
  deleted: number;
}

type SyncLogUpdate = {
  sync_status?: SyncStatus | 'no_change';
  sync_completed_at?: string;
  blocked_dates_found?: number;
  error_message?: string | null;
  http_status?: number | null;
  rows_inserted?: number | null;
  rows_deleted?: number | null;
  etag_hit?: boolean | null;
  body_hash_hit?: boolean | null;
};

async function createSyncLog(unitId: string | null, icalUrl: string, status: SyncStatus) {
  const { data, error } = await supabaseAdmin
    .from('sync_logs')
    .insert({
      unit_id: unitId,
      ical_url: icalUrl,
      sync_started_at: new Date().toISOString(),
      sync_status: status
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error('Failed to create sync log');
  }

  return data;
}

async function updateSyncLog(id: string, payload: SyncLogUpdate) {
  const { error } = await supabaseAdmin.from('sync_logs').update(payload).eq('id', id);
  if (error) {
    logger.error('Failed to update sync log', { error: error.message, id });
  }
}

async function fetchUnitForSync(unitId: string): Promise<UnitSyncRow | null> {
  const { data, error } = await supabaseAdmin
    .from('units')
    .select('id, airbnb_ical_url, ical_body_hash, ical_last_etag, ical_last_modified')
    .eq('id', unitId)
    .single();

  if (error || !data) {
    logger.error('Failed to load unit for sync', { unitId, error: error?.message });
    return null;
  }
  return data as UnitSyncRow;
}

// node-ical's parseICS accepts a buffer via text, but axios with responseType
// 'arraybuffer' lets us hash the raw bytes deterministically before decoding.
function sha256Hex(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex');
}

function bufToUtf8(buf: Buffer): string {
  // Airbnb serves UTF-8. node-ical parseICS expects a string.
  return buf.toString('utf8');
}

function parseBlockedDates(icsText: string): string[] {
  const parsed = ical.parseICS(icsText);
  const ranges: BlockedDateRange[] = [];

  for (const event of Object.values(parsed)) {
    if (event.type === 'VEVENT' && event.start && event.end) {
      ranges.push({
        start: event.start as Date,
        end: event.end as Date,
        summary: (event.summary ?? '').toString()
      });
    }
  }

  const blocked: string[] = [];
  for (const range of ranges) {
    // iCal DTEND is exclusive for VEVENT. We enumerate [start, end-1].
    const days = eachDayOfInterval({
      start: range.start,
      end: new Date(range.end.getTime() - 24 * 60 * 60 * 1000)
    });
    for (const date of days) {
      blocked.push(format(date, 'yyyy-MM-dd'));
    }
  }

  return Array.from(new Set(blocked)).sort();
}

async function callSyncAvailability(unitId: string, blockedDates: string[]): Promise<SyncAvailabilityDiff> {
  const { data, error } = await supabaseAdmin.rpc('sync_availability', {
    p_unit_id: unitId,
    p_blocked_dates: blockedDates
  });

  if (error) {
    throw new Error(`sync_availability RPC failed: ${error.message}`);
  }

  // Postgres returns jsonb; supabase-js passes it through as a parsed object.
  const diff = (data ?? { inserted: 0, deleted: 0 }) as SyncAvailabilityDiff;
  return {
    inserted: Number(diff.inserted ?? 0),
    deleted: Number(diff.deleted ?? 0)
  };
}

async function updateUnitCacheHints(
  unitId: string,
  payload: {
    ical_body_hash?: string | null;
    ical_last_etag?: string | null;
    ical_last_modified?: string | null;
    last_synced_at: string;
  }
) {
  const { error } = await supabaseAdmin.from('units').update(payload).eq('id', unitId);
  if (error) {
    logger.error('Failed to update unit cache hints', { unitId, error: error.message });
  }
}

export async function syncUnit(unitId: string, fallbackIcalUrl?: string): Promise<void> {
  // Load the unit fresh so we have the latest hash / etag hints even if a
  // previous run is still in flight. If the unit vanished, fall back to the
  // caller-provided URL so we at least record a failure log.
  const unit = await fetchUnitForSync(unitId);
  const icalUrl = unit?.airbnb_ical_url ?? fallbackIcalUrl;

  if (!icalUrl) {
    logger.error('syncUnit: no iCal URL available', { unitId });
    return;
  }

  const syncLog = await createSyncLog(unitId, icalUrl, SyncStatus.InProgress);
  const completedAt = () => new Date().toISOString();

  try {
    const conditionalHeaders: Record<string, string> = {
      'User-Agent': 'CustomBookingEngine/1.0',
      Accept: 'text/calendar'
    };
    if (unit?.ical_last_etag) {
      conditionalHeaders['If-None-Match'] = unit.ical_last_etag;
    }
    if (unit?.ical_last_modified) {
      // Airbnb expects an HTTP-date, node's toUTCString emits the RFC 7231 form.
      conditionalHeaders['If-Modified-Since'] = new Date(unit.ical_last_modified).toUTCString();
    }

    let response: AxiosResponse<Buffer>;
    try {
      response = await axios.get<Buffer>(icalUrl, {
        timeout: 10_000,
        headers: conditionalHeaders,
        responseType: 'arraybuffer',
        // Keep 304 out of the catch path, we handle it explicitly.
        validateStatus: (status) => status === 200 || status === 304
      });
    } catch (err: unknown) {
      // Network or non-2xx/304 failure. Surface with the HTTP status if we have one.
      const axErr = err as AxiosError;
      const httpStatus = axErr.response?.status ?? null;
      const message = axErr.message ?? 'iCal fetch failed';
      await updateSyncLog(syncLog.id, {
        sync_status: SyncStatus.Failed,
        sync_completed_at: completedAt(),
        error_message: message,
        http_status: httpStatus
      });
      logger.warn('syncUnit: iCal fetch failed', { unitId, httpStatus, message });
      return;
    }

    // 304 path: Airbnb confirms nothing changed. Do not re-parse, do not call
    // the RPC. Just bump last_synced_at so the cron backs off.
    if (response.status === 304) {
      await updateUnitCacheHints(unitId, {
        last_synced_at: new Date().toISOString()
      });
      await updateSyncLog(syncLog.id, {
        sync_status: 'no_change',
        sync_completed_at: completedAt(),
        blocked_dates_found: 0,
        http_status: 304,
        rows_inserted: 0,
        rows_deleted: 0,
        etag_hit: true,
        body_hash_hit: false
      });
      return;
    }

    const bodyBuf = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
    const newHash = sha256Hex(bodyBuf);
    const etag = typeof response.headers['etag'] === 'string' ? response.headers['etag'] : null;
    const lastModifiedRaw = response.headers['last-modified'];
    const lastModifiedISO =
      typeof lastModifiedRaw === 'string' && !Number.isNaN(Date.parse(lastModifiedRaw))
        ? new Date(lastModifiedRaw).toISOString()
        : null;

    // Hash fast-path. Airbnb may or may not honor conditional GET, but bytes
    // are bytes: if the body is identical, we know nothing changed.
    if (unit?.ical_body_hash && unit.ical_body_hash === newHash) {
      await updateUnitCacheHints(unitId, {
        last_synced_at: new Date().toISOString(),
        ical_last_etag: etag,
        ical_last_modified: lastModifiedISO
      });
      await updateSyncLog(syncLog.id, {
        sync_status: 'no_change',
        sync_completed_at: completedAt(),
        blocked_dates_found: 0,
        http_status: 200,
        rows_inserted: 0,
        rows_deleted: 0,
        etag_hit: false,
        body_hash_hit: true
      });
      return;
    }

    const icsText = bufToUtf8(bodyBuf);
    const blockedDates = parseBlockedDates(icsText);
    const diff = await callSyncAvailability(unitId, blockedDates);

    await updateUnitCacheHints(unitId, {
      ical_body_hash: newHash,
      ical_last_etag: etag,
      ical_last_modified: lastModifiedISO,
      last_synced_at: new Date().toISOString()
    });

    await updateSyncLog(syncLog.id, {
      sync_status: SyncStatus.Success,
      sync_completed_at: completedAt(),
      blocked_dates_found: blockedDates.length,
      http_status: 200,
      rows_inserted: diff.inserted,
      rows_deleted: diff.deleted,
      etag_hit: false,
      body_hash_hit: false
    });

    if (diff.inserted > 0 || diff.deleted > 0) {
      logger.info('syncUnit: availability diff applied', {
        unitId,
        inserted: diff.inserted,
        deleted: diff.deleted,
        total: blockedDates.length
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncLog(syncLog.id, {
      sync_status: SyncStatus.Failed,
      sync_completed_at: completedAt(),
      error_message: message
    });
    logger.error('syncUnit: unexpected failure', { unitId, error: message });
  }
}

/**
 * Returns units that are due for a sync right now, staggered by
 * sync_offset_minutes. A unit is due when:
 *   1) it has not been synced for at least UNIT_SYNC_CADENCE_MINUTES, AND
 *   2) its sync_offset_minutes matches the current Asuncion minute-of-window.
 * The "minute-of-window" is (minutes since UTC midnight) mod cadence, so we
 * do not need a DB-side Intl dependency. Distribution is identical.
 */
async function selectDueUnits(): Promise<UnitSyncRow[]> {
  const cadence = env.UNIT_SYNC_CADENCE_MINUTES;
  const now = new Date();
  const minutesSinceEpoch = Math.floor(now.getTime() / 60_000);
  const windowMinute = minutesSinceEpoch % cadence;
  const tickMinutes = env.SYNC_INTERVAL_MINUTES;

  // Units whose offset falls inside [windowMinute, windowMinute + tickMinutes)
  // are due this tick. The window wraps modulo cadence.
  const lowerBound = windowMinute;
  const upperBound = windowMinute + tickMinutes;
  const wraps = upperBound > cadence;

  const staleBefore = new Date(now.getTime() - cadence * 60_000).toISOString();

  // PostgREST does not express (a AND b) OR (c) cleanly in one query; issue
  // two filtered queries and merge. Both are keyed on idx_units_last_synced.
  const base = supabaseAdmin
    .from('units')
    .select('id, airbnb_ical_url, ical_body_hash, ical_last_etag, ical_last_modified, sync_offset_minutes, last_synced_at')
    .eq('status', 'active')
    .or(`last_synced_at.is.null,last_synced_at.lt.${staleBefore}`);

  let rows: UnitSyncRow[] = [];

  if (!wraps) {
    const { data, error } = await base
      .gte('sync_offset_minutes', lowerBound)
      .lt('sync_offset_minutes', upperBound);
    if (error) throw new Error(`selectDueUnits failed: ${error.message}`);
    rows = (data ?? []) as UnitSyncRow[];
  } else {
    const tail = await base.gte('sync_offset_minutes', lowerBound);
    if (tail.error) throw new Error(`selectDueUnits failed: ${tail.error.message}`);
    const head = await base.lt('sync_offset_minutes', upperBound - cadence);
    if (head.error) throw new Error(`selectDueUnits failed: ${head.error.message}`);
    rows = [...((tail.data ?? []) as UnitSyncRow[]), ...((head.data ?? []) as UnitSyncRow[])];
  }

  return rows;
}

/**
 * Sync every active unit regardless of staggering. Used by the manual "sync
 * all" admin action and by approval-routing.
 */
export async function syncAllUnits(): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('units')
    .select('id, airbnb_ical_url')
    .eq('status', 'active');

  if (error || !data) {
    throw new Error('Failed to fetch units for sync');
  }

  const limit = pLimit(5);
  await Promise.allSettled(data.map((unit) => limit(() => syncUnit(unit.id, unit.airbnb_ical_url))));
}

/**
 * Cron entry point. Only syncs units whose staggering slot matches this tick
 * AND whose last_synced_at is older than UNIT_SYNC_CADENCE_MINUTES.
 */
export async function syncDueUnits(): Promise<{ picked: number }> {
  const due = await selectDueUnits();
  if (due.length === 0) {
    return { picked: 0 };
  }

  const limit = pLimit(5);
  await Promise.allSettled(due.map((unit) => limit(() => syncUnit(unit.id, unit.airbnb_ical_url))));
  return { picked: due.length };
}
