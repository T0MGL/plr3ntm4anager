// ical-sync alias preservation tests
//
// Run with: npm test   (or  node --import tsx --test src/services/__tests__/ical-sync-alias.test.ts )
//
// These tests lock in the contract around guest_alias survival across
// iCal re-sync. The sync_availability RPC does DELETE + INSERT per unit,
// so any alias the admin types in the UI is wiped every run unless
// snapshot+restore runs around the RPC.
//
// We stub the DB client via the __setAliasDbClientForTests seam so production
// service code runs end-to-end without Supabase or Postgres.
//
// Scenarios:
//   1. Snapshot collects one alias per external_ref (dedup across nights)
//   2. Snapshot ignores rows with null alias or null external_ref
//   3. Snapshot scoped to unit
//   4. Restore writes alias back on every row in the matching range
//   5. Restore is a no-op when snapshot is empty
//   6. Concurrent-cancel: reservation removed from feed, alias not resurrected
//   7. Restore only touches airbnb source rows
//   8. Restore dedups duplicate external_refs across ranges

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  snapshotGuestAliases,
  restoreGuestAliases,
  __setAliasDbClientForTests,
  __resetAliasDbClient
} from '../ical-sync.service';

// ---------------------------------------------------------------------------
// In-memory client stub. Only the methods actually used by the two functions
// under test are implemented. Chain shape mirrors supabase-js v2 exactly.
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  unit_id: string;
  blocked_date: string;
  source: 'airbnb' | 'manual' | 'widget';
  external_kind: string | null;
  external_ref: string | null;
  guest_last4: string | null;
  guest_alias: string | null;
};

interface StubState {
  rows: Row[];
  updateCalls: number;
}

function createState(initial: Row[]): StubState {
  return {
    rows: initial.map((r) => ({ ...r })),
    updateCalls: 0
  };
}

function createStubClient(state: StubState) {
  type Filter = { op: 'eq' | 'not_null'; column: keyof Row; value?: unknown };

  const matches = (row: Row, filter: Filter): boolean => {
    const val = row[filter.column];
    if (filter.op === 'eq') return val === filter.value;
    if (filter.op === 'not_null') return val !== null && val !== undefined;
    return false;
  };

  return {
    from(table: string) {
      if (table !== 'availability') throw new Error(`unexpected table ${table}`);

      const filters: Filter[] = [];
      let mode: 'read' | 'update' = 'read';
      let selectCols: string | null = null;
      let updatePayload: Record<string, unknown> | null = null;
      let wantCount = false;

      const execute = () => {
        const hit = state.rows.filter((r) => filters.every((f) => matches(r, f)));
        if (mode === 'read') {
          const cols = (selectCols ?? '').split(',').map((c) => c.trim()).filter(Boolean);
          const data = hit.map((r) => {
            if (cols.length === 0) return { ...r };
            const out: Record<string, unknown> = {};
            for (const c of cols) out[c] = r[c as keyof Row] ?? null;
            return out;
          });
          return { data, error: null };
        }
        state.updateCalls += 1;
        for (const row of hit) Object.assign(row, updatePayload);
        return { data: null, error: null, count: wantCount ? hit.length : null };
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chain: any = {
        select(cols: string) {
          selectCols = cols;
          mode = 'read';
          return chain;
        },
        update(payload: Record<string, unknown>, options?: { count?: string }) {
          updatePayload = payload;
          mode = 'update';
          if (options?.count === 'exact') wantCount = true;
          return chain;
        },
        eq(column: keyof Row, value: unknown) {
          filters.push({ op: 'eq', column, value });
          return chain;
        },
        not(column: keyof Row, op: string, _value: unknown) {
          // The production code uses .not('col', 'is', null) to mean NOT NULL.
          if (op === 'is') filters.push({ op: 'not_null', column });
          return chain;
        },
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          try {
            return Promise.resolve(execute()).then(resolve, reject);
          } catch (err) {
            return Promise.reject(err);
          }
        }
      };
      return chain;
    }
  };
}

const UNIT_A = '00000000-0000-0000-0000-0000000000aa';
const UNIT_B = '00000000-0000-0000-0000-0000000000bb';

function airbnbRow(overrides: Partial<Row>): Row {
  return {
    id: `row-${Math.random().toString(16).slice(2)}`,
    unit_id: UNIT_A,
    blocked_date: '2026-05-01',
    source: 'airbnb',
    external_kind: 'reserved',
    external_ref: 'HMXTN9AJJM',
    guest_last4: '4188',
    guest_alias: null,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

test('snapshot collects one alias per external_ref across multi-night stays', async () => {
  const state = createState([
    airbnbRow({ blocked_date: '2026-05-01', external_ref: 'RES1', guest_alias: 'Martin Rodriguez' }),
    airbnbRow({ blocked_date: '2026-05-02', external_ref: 'RES1', guest_alias: 'Martin Rodriguez' }),
    airbnbRow({ blocked_date: '2026-05-03', external_ref: 'RES1', guest_alias: 'Martin Rodriguez' }),
    airbnbRow({ blocked_date: '2026-06-10', external_ref: 'RES2', guest_alias: 'Familia Lopez' })
  ]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    const snapshot = await snapshotGuestAliases(UNIT_A);
    assert.equal(snapshot.size, 2);
    assert.equal(snapshot.get('RES1'), 'Martin Rodriguez');
    assert.equal(snapshot.get('RES2'), 'Familia Lopez');
  } finally {
    __resetAliasDbClient();
  }
});

test('snapshot ignores rows with null alias or null external_ref', async () => {
  const state = createState([
    airbnbRow({ external_ref: 'RES1', guest_alias: null }),
    airbnbRow({ external_ref: null, guest_alias: 'Orphan' }),
    airbnbRow({ external_ref: 'RES2', guest_alias: 'Keep me' })
  ]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    const snapshot = await snapshotGuestAliases(UNIT_A);
    assert.equal(snapshot.size, 1);
    assert.equal(snapshot.get('RES2'), 'Keep me');
  } finally {
    __resetAliasDbClient();
  }
});

test('snapshot is scoped to the requested unit only', async () => {
  const state = createState([
    airbnbRow({ unit_id: UNIT_A, external_ref: 'RES1', guest_alias: 'Alice' }),
    airbnbRow({ unit_id: UNIT_B, external_ref: 'RES2', guest_alias: 'Bob' })
  ]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    const snapshot = await snapshotGuestAliases(UNIT_A);
    assert.equal(snapshot.size, 1);
    assert.equal(snapshot.get('RES1'), 'Alice');
    assert.equal(snapshot.get('RES2'), undefined);
  } finally {
    __resetAliasDbClient();
  }
});

test('restore writes alias back onto every night of the matching range', async () => {
  const state = createState([
    airbnbRow({ blocked_date: '2026-05-01', external_ref: 'RES1', guest_alias: null }),
    airbnbRow({ blocked_date: '2026-05-02', external_ref: 'RES1', guest_alias: null }),
    airbnbRow({ blocked_date: '2026-05-03', external_ref: 'RES1', guest_alias: null })
  ]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    const result = await restoreGuestAliases(
      UNIT_A,
      new Map([['RES1', 'Martin Rodriguez']]),
      [
        {
          kind: 'reserved',
          externalRef: 'RES1',
          guestLast4: '4188',
          startDate: '2026-05-01',
          endDate: '2026-05-03'
        }
      ]
    );
    assert.equal(result.updated, 3);
    for (const row of state.rows) {
      assert.equal(row.guest_alias, 'Martin Rodriguez');
    }
  } finally {
    __resetAliasDbClient();
  }
});

test('restore is a no-op when snapshot is empty', async () => {
  const state = createState([airbnbRow({ external_ref: 'RES1', guest_alias: null })]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    const result = await restoreGuestAliases(UNIT_A, new Map(), [
      {
        kind: 'reserved',
        externalRef: 'RES1',
        guestLast4: null,
        startDate: '2026-05-01',
        endDate: '2026-05-01'
      }
    ]);
    assert.equal(result.updated, 0);
    assert.equal(state.updateCalls, 0);
  } finally {
    __resetAliasDbClient();
  }
});

test('concurrent cancel: reservation removed from feed, alias snapshot entry is not resurrected', async () => {
  // Admin typed alias, Airbnb cancelled the reservation, next sync has no
  // range with that external_ref. Snapshot captures the alias, restore
  // receives no matching range, nothing is written. The cancelled rows were
  // already deleted by the RPC. Net effect: alias disappears with the
  // reservation, which is the documented behaviour.
  const state = createState([]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    const result = await restoreGuestAliases(
      UNIT_A,
      new Map([['CANCELLED_RES', 'Ghost guest']]),
      [
        {
          kind: 'reserved',
          externalRef: 'OTHER_RES',
          guestLast4: '1234',
          startDate: '2026-05-10',
          endDate: '2026-05-12'
        }
      ]
    );
    assert.equal(result.updated, 0);
    assert.equal(state.updateCalls, 0);
  } finally {
    __resetAliasDbClient();
  }
});

test('restore only touches airbnb source rows, never widget or manual', async () => {
  // Defensive test: the restore query filters source='airbnb'. If someone
  // dropped the filter, aliases could leak onto widget holds that happen to
  // share an external_ref (they do not today, but the filter is the guard).
  const state = createState([
    airbnbRow({ blocked_date: '2026-05-01', external_ref: 'RES1', guest_alias: null, source: 'airbnb' }),
    airbnbRow({
      blocked_date: '2026-05-01',
      external_ref: 'RES1',
      guest_alias: null,
      source: 'widget',
      id: 'widget-row'
    })
  ]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    await restoreGuestAliases(UNIT_A, new Map([['RES1', 'Martin']]), [
      {
        kind: 'reserved',
        externalRef: 'RES1',
        guestLast4: null,
        startDate: '2026-05-01',
        endDate: '2026-05-01'
      }
    ]);
    const airbnbRowAfter = state.rows.find((r) => r.source === 'airbnb');
    const widgetRowAfter = state.rows.find((r) => r.source === 'widget');
    assert.equal(airbnbRowAfter?.guest_alias, 'Martin');
    assert.equal(widgetRowAfter?.guest_alias, null);
  } finally {
    __resetAliasDbClient();
  }
});

test('restore dedups duplicate external_refs across ranges (single UPDATE per ref)', async () => {
  // Parser can emit multiple ranges with the same external_ref if Airbnb
  // splits a stay across VEVENTs. We must not issue N updates for N ranges
  // sharing a ref, both to save round-trips and to avoid touching the same
  // rows repeatedly.
  const state = createState([
    airbnbRow({ blocked_date: '2026-05-01', external_ref: 'RES1', guest_alias: null }),
    airbnbRow({ blocked_date: '2026-05-02', external_ref: 'RES1', guest_alias: null })
  ]);
  __setAliasDbClientForTests(createStubClient(state));
  try {
    await restoreGuestAliases(UNIT_A, new Map([['RES1', 'Martin']]), [
      {
        kind: 'reserved',
        externalRef: 'RES1',
        guestLast4: null,
        startDate: '2026-05-01',
        endDate: '2026-05-01'
      },
      {
        kind: 'reserved',
        externalRef: 'RES1',
        guestLast4: null,
        startDate: '2026-05-02',
        endDate: '2026-05-02'
      }
    ]);
    assert.equal(state.updateCalls, 1);
  } finally {
    __resetAliasDbClient();
  }
});
