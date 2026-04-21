// Approval routing tests
//
// Run with: node --import tsx --test src/services/__tests__/approval-routing.test.ts
//
// Scenarios covering the dual-path decision matrix:
//
//   1. Auto happy:         fresh sync + free dates + inline sync success
//   2. Manual happy:       stale sync routes to manual even if dates free
//   3. Conflict pre-sync:  dates overlap at time of decision
//   4. Conflict post-sync: inline sync fails, so we route manual for safety
//   5. No sync recorded:   no successful sync exists, route to manual

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  decideApprovalPath,
  __setApprovalRoutingDepsForTests,
  __resetApprovalRoutingDeps
} from '../approval-routing.service';

const FIVE_MINUTES_AGO = () => new Date(Date.now() - 5 * 60 * 1000).toISOString();
const TWO_HOURS_AGO = () => new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

interface Harness {
  lastSync: string | null;
  availability: 'free' | 'conflict' | 'error';
  inlineOutcome: 'success' | 'fail';
  inlineCalls: number;
}

function makeHarness(overrides: Partial<Harness> = {}): Harness {
  return {
    lastSync: null,
    availability: 'free',
    inlineOutcome: 'success',
    inlineCalls: 0,
    ...overrides
  };
}

function installHarness(h: Harness): void {
  __setApprovalRoutingDepsForTests({
    syncUnit: async () => {
      h.inlineCalls += 1;
      if (h.inlineOutcome === 'fail') {
        throw new Error('simulated iCal failure');
      }
    },
    getLastSyncAt: async () => h.lastSync,
    checkAvailabilityRange: async () => h.availability
  });
}

const BASE_INPUT = {
  unitId: '00000000-0000-0000-0000-000000000001',
  unitIcalUrl: 'https://airbnb.com/calendar.ics',
  checkIn: '2026-06-01',
  checkOut: '2026-06-05'
};

test('auto happy path: fresh sync, dates free, sync succeeds', async () => {
  const h = makeHarness({ lastSync: FIVE_MINUTES_AGO(), availability: 'free', inlineOutcome: 'success' });
  installHarness(h);
  try {
    const decision = await decideApprovalPath(BASE_INPUT);
    assert.equal(decision.path, 'auto');
    assert.equal(decision.reason, 'fresh_sync_dates_free');
    assert.equal(decision.inlineSyncStatus, 'success');
    assert.ok(decision.syncAgeMinutes !== null && decision.syncAgeMinutes <= 30);
    assert.equal(h.inlineCalls, 1);
  } finally {
    __resetApprovalRoutingDeps();
  }
});

test('manual path when sync is older than threshold', async () => {
  const h = makeHarness({ lastSync: TWO_HOURS_AGO(), availability: 'free', inlineOutcome: 'fail' });
  installHarness(h);
  try {
    const decision = await decideApprovalPath(BASE_INPUT);
    assert.equal(decision.path, 'manual');
    assert.equal(decision.reason, 'stale_sync');
    assert.ok(decision.syncAgeMinutes !== null && decision.syncAgeMinutes > 30);
  } finally {
    __resetApprovalRoutingDeps();
  }
});

test('manual path when dates conflict pre-sync', async () => {
  const h = makeHarness({
    lastSync: FIVE_MINUTES_AGO(),
    availability: 'conflict',
    inlineOutcome: 'success'
  });
  installHarness(h);
  try {
    const decision = await decideApprovalPath(BASE_INPUT);
    assert.equal(decision.path, 'manual');
    assert.equal(decision.reason, 'dates_conflict');
  } finally {
    __resetApprovalRoutingDeps();
  }
});

test('manual path when inline sync fails even if dates still appear free', async () => {
  const h = makeHarness({ lastSync: FIVE_MINUTES_AGO(), availability: 'free', inlineOutcome: 'fail' });
  installHarness(h);
  try {
    const decision = await decideApprovalPath(BASE_INPUT);
    assert.equal(decision.path, 'manual');
    assert.equal(decision.reason, 'inline_sync_failed');
    assert.equal(decision.inlineSyncStatus, 'failed');
  } finally {
    __resetApprovalRoutingDeps();
  }
});

test('manual path when there is no sync recorded at all', async () => {
  const h = makeHarness({ lastSync: null, availability: 'free', inlineOutcome: 'success' });
  installHarness(h);
  try {
    const decision = await decideApprovalPath(BASE_INPUT);
    assert.equal(decision.path, 'manual');
    assert.equal(decision.reason, 'no_sync_recorded');
  } finally {
    __resetApprovalRoutingDeps();
  }
});

test('manual path when availability check errors', async () => {
  const h = makeHarness({
    lastSync: FIVE_MINUTES_AGO(),
    availability: 'error',
    inlineOutcome: 'success'
  });
  installHarness(h);
  try {
    const decision = await decideApprovalPath(BASE_INPUT);
    assert.equal(decision.path, 'manual');
    assert.equal(decision.reason, 'availability_check_failed');
  } finally {
    __resetApprovalRoutingDeps();
  }
});
