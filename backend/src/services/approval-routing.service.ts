import { differenceInMinutes } from 'date-fns';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { isAvailable, getLastSyncAt } from './booking.service';
import { syncUnit } from './ical-sync.service';

// Dual-path approval routing
//
// The booking widget never captures a card on the customer's word alone.
// Every request goes through this decider which classifies the attempt as
// either:
//
//   auto:   most recent Airbnb sync is fresh and dates are free. We capture
//           on the spot and send the guest the payment-confirmed email.
//   manual: sync is older than the freshness threshold, or dates overlap, or
//           Airbnb was unreachable. We place a preauthorization, email the
//           guest that we are still verifying, and wait for the admin to
//           approve with an explicit re-check.
//
// decideApprovalPath is the single source of truth. It runs an inline sync
// attempt first (best-effort, non-throwing) so a booking that arrives 20
// minutes after the last cron tick still benefits from up-to-the-second
// Airbnb data. The sync age recorded is the "effective" age: the inline sync
// timestamp if it succeeded, otherwise the cron's last good timestamp.

export type ApprovalPath = 'auto' | 'manual';

export interface ApprovalDecision {
  path: ApprovalPath;
  reason: ApprovalDecisionReason;
  syncAgeMinutes: number | null;
  syncedAt: string | null;
  inlineSyncStatus: 'success' | 'failed' | 'skipped';
}

export type ApprovalDecisionReason =
  | 'fresh_sync_dates_free'
  | 'stale_sync'
  | 'no_sync_recorded'
  | 'inline_sync_failed'
  | 'dates_conflict'
  | 'availability_check_failed';

export interface DecideApprovalPathInput {
  unitId: string;
  unitIcalUrl: string | null;
  checkIn: string;
  checkOut: string;
}

// Dependency injection seam for tests. The routing decider reaches into iCal
// sync, the last-sync lookup, and the availability table; each is swappable
// via this registry so test doubles avoid patching frozen ES module exports.
interface ApprovalRoutingDeps {
  syncUnit: (unitId: string, icalUrl: string) => Promise<void>;
  getLastSyncAt: (unitId: string) => Promise<string | null>;
  checkAvailabilityRange: (
    unitId: string,
    checkIn: string,
    checkOut: string
  ) => Promise<'free' | 'conflict' | 'error'>;
}

const defaultDeps: ApprovalRoutingDeps = {
  syncUnit: (unitId, icalUrl) => syncUnit(unitId, icalUrl),
  getLastSyncAt: (unitId) => getLastSyncAt(unitId),
  checkAvailabilityRange: defaultCheckAvailabilityRange
};

let activeDeps: ApprovalRoutingDeps = defaultDeps;

export function __setApprovalRoutingDepsForTests(overrides: Partial<ApprovalRoutingDeps>): void {
  activeDeps = { ...defaultDeps, ...overrides };
}

export function __resetApprovalRoutingDeps(): void {
  activeDeps = defaultDeps;
}

const MAX_INLINE_SYNC_MS = 8000;

export async function decideApprovalPath(input: DecideApprovalPathInput): Promise<ApprovalDecision> {
  const inlineSyncStatus = await runInlineSyncWithTimeout(input.unitId, input.unitIcalUrl);

  const freshSyncAt = await safeGetLastSyncAt(input.unitId);
  const ageMinutes = freshSyncAt ? differenceInMinutes(new Date(), new Date(freshSyncAt)) : null;

  if (!freshSyncAt) {
    return {
      path: 'manual',
      reason: inlineSyncStatus === 'failed' ? 'inline_sync_failed' : 'no_sync_recorded',
      syncAgeMinutes: null,
      syncedAt: null,
      inlineSyncStatus
    };
  }

  if (ageMinutes !== null && ageMinutes > env.AUTO_APPROVE_SYNC_FRESHNESS_MIN) {
    return {
      path: 'manual',
      reason: 'stale_sync',
      syncAgeMinutes: ageMinutes,
      syncedAt: freshSyncAt,
      inlineSyncStatus
    };
  }

  const availability = await activeDeps.checkAvailabilityRange(
    input.unitId,
    input.checkIn,
    input.checkOut
  );

  if (availability === 'error') {
    return {
      path: 'manual',
      reason: 'availability_check_failed',
      syncAgeMinutes: ageMinutes,
      syncedAt: freshSyncAt,
      inlineSyncStatus
    };
  }

  if (availability === 'conflict') {
    return {
      path: 'manual',
      reason: 'dates_conflict',
      syncAgeMinutes: ageMinutes,
      syncedAt: freshSyncAt,
      inlineSyncStatus
    };
  }

  if (inlineSyncStatus === 'failed') {
    return {
      path: 'manual',
      reason: 'inline_sync_failed',
      syncAgeMinutes: ageMinutes,
      syncedAt: freshSyncAt,
      inlineSyncStatus
    };
  }

  return {
    path: 'auto',
    reason: 'fresh_sync_dates_free',
    syncAgeMinutes: ageMinutes,
    syncedAt: freshSyncAt,
    inlineSyncStatus
  };
}

// Re-check right before we capture or confirm a preauth. The admin dashboard
// calls this when approving a manual-path booking so we catch last-second
// overlaps that appeared while the booking sat in the queue.

export async function recheckAvailabilityOrFail(
  unitId: string,
  unitIcalUrl: string | null,
  checkIn: string,
  checkOut: string
): Promise<{ synced: boolean; available: true } | { synced: boolean; available: false; reason: 'dates_conflict' | 'availability_check_failed' }> {
  const inlineSyncStatus = await runInlineSyncWithTimeout(unitId, unitIcalUrl);
  const availability = await activeDeps.checkAvailabilityRange(unitId, checkIn, checkOut);

  if (availability === 'error') {
    return { synced: inlineSyncStatus === 'success', available: false, reason: 'availability_check_failed' };
  }

  if (availability === 'conflict') {
    return { synced: inlineSyncStatus === 'success', available: false, reason: 'dates_conflict' };
  }

  return { synced: inlineSyncStatus === 'success', available: true };
}

async function runInlineSyncWithTimeout(
  unitId: string,
  icalUrl: string | null
): Promise<'success' | 'failed' | 'skipped'> {
  if (!icalUrl) {
    return 'skipped';
  }

  try {
    await Promise.race([
      activeDeps.syncUnit(unitId, icalUrl),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('inline sync timeout')), MAX_INLINE_SYNC_MS)
      )
    ]);
    return 'success';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    logger.warn('Inline sync failed, routing to manual path', { unit_id: unitId, error: message });
    return 'failed';
  }
}

async function safeGetLastSyncAt(unitId: string): Promise<string | null> {
  try {
    return await activeDeps.getLastSyncAt(unitId);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    logger.error('Failed to read last sync timestamp', { unit_id: unitId, error: message });
    return null;
  }
}

async function defaultCheckAvailabilityRange(
  unitId: string,
  checkIn: string,
  checkOut: string
): Promise<'free' | 'conflict' | 'error'> {
  try {
    const { data, error } = await supabaseAdmin
      .from('availability')
      .select('blocked_date, source')
      .eq('unit_id', unitId)
      .gte('blocked_date', checkIn)
      .lt('blocked_date', checkOut);

    if (error) {
      logger.error('Availability check errored', { unit_id: unitId, error: error.message });
      return 'error';
    }

    return (data ?? []).length === 0 ? 'free' : 'conflict';
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'unknown';
    logger.error('Availability check threw', { unit_id: unitId, error: message });
    return 'error';
  }
}

// Silence unused-import warning on a pure-typed re-export during tsc --noEmit.
// isAvailable is exported from booking.service for legacy callers; we keep
// importing it so the dependency graph is explicit, but we use our own
// columns-aware version inside this file.
void isAvailable;
