import axios from 'axios';
import ical from 'node-ical';
import { eachDayOfInterval, format } from 'date-fns';
import pLimit from 'p-limit';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { SyncStatus } from '../types';

interface BlockedDateRange {
  start: Date;
  end: Date;
  summary: string;
}

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

async function updateSyncLog(id: string, payload: Record<string, unknown>) {
  const { error } = await supabaseAdmin.from('sync_logs').update(payload).eq('id', id);
  if (error) {
    logger.error('Failed to update sync log', { error: error.message, id });
  }
}

export async function syncUnit(unitId: string, icalUrl: string): Promise<void> {
  const syncLog = await createSyncLog(unitId, icalUrl, SyncStatus.InProgress);

  try {
    const response = await axios.get(icalUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'CustomBookingEngine/1.0',
        Accept: 'text/calendar'
      }
    });

    const icalData = ical.parseICS(response.data);
    const blockedRanges: BlockedDateRange[] = [];

    for (const event of Object.values(icalData)) {
      if (event.type === 'VEVENT') {
        const summary = (event.summary ?? '').toString();
        if (summary === 'Reserved' || summary === 'Blocked') {
          blockedRanges.push({
            start: event.start as Date,
            end: event.end as Date,
            summary
          });
        }
      }
    }

    const blockedDates: string[] = [];
    for (const range of blockedRanges) {
      const days = eachDayOfInterval({
        start: range.start,
        end: new Date(range.end.getTime() - 24 * 60 * 60 * 1000)
      });

      for (const date of days) {
        blockedDates.push(format(date, 'yyyy-MM-dd'));
      }
    }

    const uniqueBlockedDates = [...new Set(blockedDates)];

    const { error: rpcError } = await supabaseAdmin.rpc('sync_availability', {
      p_unit_id: unitId,
      p_blocked_dates: uniqueBlockedDates
    });

    if (rpcError) {
      throw new Error(rpcError.message);
    }

    await updateSyncLog(syncLog.id, {
      sync_status: SyncStatus.Success,
      sync_completed_at: new Date().toISOString(),
      blocked_dates_found: uniqueBlockedDates.length
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncLog(syncLog.id, {
      sync_status: SyncStatus.Failed,
      sync_completed_at: new Date().toISOString(),
      error_message: message
    });
  }
}

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
