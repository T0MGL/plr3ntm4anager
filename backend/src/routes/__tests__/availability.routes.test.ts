// PATCH /api/admin/availability/:id tests
//
// Run with: npm test
//
// Three required cases from the Phase B spec:
//   200 valid      a staff user edits an Airbnb row, server stamps alias
//                  across every night in the range
//   401 no auth    no Bearer token, rejected before reaching the handler
//   403 wrong role request reaches requireStaffOrAdmin but user has no
//                  admin_users row, rejected
//
// Plus two additional guards worth locking in:
//   404            availability id does not exist
//   422            target row is source='widget' (alias only for airbnb)
//   range stamp    multi-night reservation gets the alias on every night
//
// We build an isolated Express app that mounts only the availability router,
// and we stub the supabase client so no network calls are made. Auth is
// stubbed by swapping supabaseAdmin.auth.getUser and admin_users lookup.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';

import { supabaseAdmin } from '../../config/supabase';
import availabilityRoutes from '../availability.routes';

// ---------------------------------------------------------------------------
// In-memory availability + admin_users stubs. We monkey-patch supabaseAdmin
// in place because the module exports a singleton and the auth middleware
// calls .auth.getUser on it. Restore original methods in finally blocks.
// ---------------------------------------------------------------------------

type Row = {
  id: string;
  unit_id: string;
  blocked_date: string;
  source: 'airbnb' | 'widget' | 'manual';
  external_kind: string | null;
  external_ref: string | null;
  guest_last4: string | null;
  guest_alias: string | null;
};

type AdminUserRow = {
  auth_id: string;
  id: string;
  role: 'admin' | 'staff';
  status: 'active' | 'inactive';
};

interface Fixture {
  rows: Row[];
  adminUsers: AdminUserRow[];
  validTokens: Map<string, { id: string; email: string }>;
}

function makeFixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    rows: [],
    adminUsers: [],
    validTokens: new Map(),
    ...overrides
  };
}

function installSupabaseStub(fixture: Fixture): () => void {
  const originalFrom = supabaseAdmin.from.bind(supabaseAdmin);
  const originalGetUser = supabaseAdmin.auth.getUser.bind(supabaseAdmin.auth);

  (supabaseAdmin as unknown as { from: typeof supabaseAdmin.from }).from = ((table: string) => {
    type Filter = { op: 'eq' | 'not_null'; column: string; value?: unknown };
    const filters: Filter[] = [];
    let selectCols: string | null = null;
    let mode: 'read' | 'update' = 'read';
    let updatePayload: Record<string, unknown> | null = null;
    let maybeSingle = false;

    const getTableRows = (): Array<Record<string, unknown>> => {
      if (table === 'availability') return fixture.rows as unknown as Array<Record<string, unknown>>;
      if (table === 'admin_users') return fixture.adminUsers as unknown as Array<Record<string, unknown>>;
      throw new Error(`unexpected table in test: ${table}`);
    };

    const matches = (row: Record<string, unknown>, f: Filter): boolean => {
      const v = row[f.column];
      if (f.op === 'eq') return v === f.value;
      if (f.op === 'not_null') return v !== null && v !== undefined;
      return false;
    };

    const executor = (): unknown => {
      const rows = getTableRows();
      const hit = rows.filter((r) => filters.every((f) => matches(r, f)));
      if (mode === 'read') {
        const cols = (selectCols ?? '').split(',').map((c) => c.trim()).filter(Boolean);
        const data = hit.map((r) => {
          if (cols.length === 0) return { ...r };
          const out: Record<string, unknown> = {};
          for (const c of cols) out[c] = r[c] ?? null;
          return out;
        });
        if (maybeSingle) {
          return { data: data[0] ?? null, error: null };
        }
        return { data, error: null };
      }
      for (const row of hit) Object.assign(row, updatePayload);
      return { data: null, error: null, count: hit.length };
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select(cols: string) {
        selectCols = cols;
        mode = 'read';
        return chain;
      },
      update(payload: Record<string, unknown>) {
        updatePayload = payload;
        mode = 'update';
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push({ op: 'eq', column, value });
        return chain;
      },
      not(column: string, op: string, _value: unknown) {
        if (op === 'is') filters.push({ op: 'not_null', column });
        return chain;
      },
      maybeSingle() {
        maybeSingle = true;
        return Promise.resolve(executor());
      },
      single() {
        maybeSingle = true;
        return Promise.resolve(executor());
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        try {
          return Promise.resolve(executor()).then(resolve, reject);
        } catch (err) {
          return Promise.reject(err);
        }
      }
    };
    return chain;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

  (supabaseAdmin.auth as unknown as { getUser: (token: string) => Promise<unknown> }).getUser = async (
    token: string
  ) => {
    const user = fixture.validTokens.get(token);
    if (!user) return { data: { user: null }, error: { message: 'invalid token' } };
    return { data: { user }, error: null };
  };

  return () => {
    (supabaseAdmin as unknown as { from: typeof originalFrom }).from = originalFrom;
    (supabaseAdmin.auth as unknown as { getUser: typeof originalGetUser }).getUser = originalGetUser;
  };
}

// ---------------------------------------------------------------------------
// Test server lifecycle. Each test builds its own app so state is isolated.
// ---------------------------------------------------------------------------

interface TestServer {
  url: string;
  close: () => Promise<void>;
}

async function startServer(fixture: Fixture): Promise<TestServer> {
  const restore = installSupabaseStub(fixture);
  const app = express();
  app.use(express.json());
  app.use('/api/admin', availabilityRoutes);

  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      restore();
    }
  };
}

async function httpPatch(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

// ---------------------------------------------------------------------------

const UNIT_A = '00000000-0000-0000-0000-0000000000aa';
const STAFF_AUTH_ID = 'auth-staff-1';
const STAFF_TOKEN = 'token-staff';

function uuidFromSeed(seed: string): string {
  // Deterministic pseudo-UUID so tests can log meaningful ids. Not a real
  // UUID generator, just produces a string that matches the zod uuid regex.
  const hex = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0).toString(16), '').padEnd(32, '0').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function seedAirbnbStay(ref: string, start: string, nights: number): Row[] {
  const rows: Row[] = [];
  const d = new Date(start);
  for (let i = 0; i < nights; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    rows.push({
      id: uuidFromSeed(`${ref}${i}`),
      unit_id: UNIT_A,
      blocked_date: day.toISOString().slice(0, 10),
      source: 'airbnb',
      external_kind: 'reserved',
      external_ref: ref,
      guest_last4: '4188',
      guest_alias: null
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------

test('200: staff user writes alias on Airbnb reservation, stamps every night', async () => {
  const fixture = makeFixture({
    rows: seedAirbnbStay('RES1', '2026-05-10', 4),
    adminUsers: [
      { auth_id: STAFF_AUTH_ID, id: 'staff-1', role: 'staff', status: 'active' }
    ],
    validTokens: new Map([[STAFF_TOKEN, { id: STAFF_AUTH_ID, email: 'staff@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const target = fixture.rows[1]; // middle night
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${target.id}`,
      { guest_alias: '  Familia Rodriguez  ' },
      { Authorization: `Bearer ${STAFF_TOKEN}` }
    );

    assert.equal(res.status, 200);
    const body = res.body as { id: string; guest_alias: string | null };
    assert.equal(body.id, target.id);
    assert.equal(body.guest_alias, 'Familia Rodriguez'); // trimmed

    // Every night of the stay should have the alias now.
    for (const row of fixture.rows) {
      assert.equal(row.guest_alias, 'Familia Rodriguez');
    }
  } finally {
    await server.close();
  }
});

test('200: clearing alias with empty string coerces to null across the range', async () => {
  const fixture = makeFixture({
    rows: seedAirbnbStay('RES1', '2026-05-10', 2).map((r) => ({ ...r, guest_alias: 'Martin' })),
    adminUsers: [
      { auth_id: STAFF_AUTH_ID, id: 'staff-1', role: 'staff', status: 'active' }
    ],
    validTokens: new Map([[STAFF_TOKEN, { id: STAFF_AUTH_ID, email: 'staff@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const target = fixture.rows[0];
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${target.id}`,
      { guest_alias: '' },
      { Authorization: `Bearer ${STAFF_TOKEN}` }
    );
    assert.equal(res.status, 200);
    for (const row of fixture.rows) assert.equal(row.guest_alias, null);
  } finally {
    await server.close();
  }
});

test('401: missing Bearer token is rejected before the handler', async () => {
  const fixture = makeFixture({
    rows: seedAirbnbStay('RES1', '2026-05-10', 1)
  });
  const server = await startServer(fixture);
  try {
    const target = fixture.rows[0];
    const res = await httpPatch(`${server.url}/api/admin/availability/${target.id}`, {
      guest_alias: 'Martin'
    });
    assert.equal(res.status, 401);
    assert.equal(target.guest_alias, null); // untouched
  } finally {
    await server.close();
  }
});

test('401: invalid Bearer token is rejected', async () => {
  const fixture = makeFixture({
    rows: seedAirbnbStay('RES1', '2026-05-10', 1),
    validTokens: new Map([[STAFF_TOKEN, { id: STAFF_AUTH_ID, email: 'staff@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const target = fixture.rows[0];
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${target.id}`,
      { guest_alias: 'Martin' },
      { Authorization: 'Bearer not-a-real-token' }
    );
    assert.equal(res.status, 401);
  } finally {
    await server.close();
  }
});

test('403: authenticated user with no admin_users row is rejected', async () => {
  // Token resolves to a Supabase user, but no matching admin_users row exists.
  const fixture = makeFixture({
    rows: seedAirbnbStay('RES1', '2026-05-10', 1),
    adminUsers: [], // no match
    validTokens: new Map([[STAFF_TOKEN, { id: 'random-auth-id', email: 'outsider@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const target = fixture.rows[0];
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${target.id}`,
      { guest_alias: 'Martin' },
      { Authorization: `Bearer ${STAFF_TOKEN}` }
    );
    assert.equal(res.status, 403);
    assert.equal(target.guest_alias, null);
  } finally {
    await server.close();
  }
});

test('403: inactive admin_users row is rejected even with valid role', async () => {
  const fixture = makeFixture({
    rows: seedAirbnbStay('RES1', '2026-05-10', 1),
    adminUsers: [
      { auth_id: STAFF_AUTH_ID, id: 'staff-1', role: 'admin', status: 'inactive' }
    ],
    validTokens: new Map([[STAFF_TOKEN, { id: STAFF_AUTH_ID, email: 'staff@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const target = fixture.rows[0];
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${target.id}`,
      { guest_alias: 'Martin' },
      { Authorization: `Bearer ${STAFF_TOKEN}` }
    );
    assert.equal(res.status, 403);
  } finally {
    await server.close();
  }
});

test('404: availability id that does not exist', async () => {
  const fixture = makeFixture({
    rows: [],
    adminUsers: [
      { auth_id: STAFF_AUTH_ID, id: 'staff-1', role: 'staff', status: 'active' }
    ],
    validTokens: new Map([[STAFF_TOKEN, { id: STAFF_AUTH_ID, email: 'staff@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const fakeId = '11111111-1111-1111-1111-111111111111';
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${fakeId}`,
      { guest_alias: 'Martin' },
      { Authorization: `Bearer ${STAFF_TOKEN}` }
    );
    assert.equal(res.status, 404);
  } finally {
    await server.close();
  }
});

test('422: widget-source row rejects alias edit with a distinguishable code', async () => {
  // Widget rows have guest_name in booking_requests already; alias is an
  // Airbnb-only affordance. 422 signals "valid shape, wrong state" so the
  // UI can show a clear message.
  const widgetRow: Row = {
    id: uuidFromSeed('widget1'),
    unit_id: UNIT_A,
    blocked_date: '2026-05-10',
    source: 'widget',
    external_kind: null,
    external_ref: null,
    guest_last4: null,
    guest_alias: null
  };
  const fixture = makeFixture({
    rows: [widgetRow],
    adminUsers: [
      { auth_id: STAFF_AUTH_ID, id: 'staff-1', role: 'staff', status: 'active' }
    ],
    validTokens: new Map([[STAFF_TOKEN, { id: STAFF_AUTH_ID, email: 'staff@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${widgetRow.id}`,
      { guest_alias: 'Martin' },
      { Authorization: `Bearer ${STAFF_TOKEN}` }
    );
    assert.equal(res.status, 422);
    assert.equal(widgetRow.guest_alias, null);
  } finally {
    await server.close();
  }
});

test('400: alias exceeding 120 chars is rejected by validation', async () => {
  const fixture = makeFixture({
    rows: seedAirbnbStay('RES1', '2026-05-10', 1),
    adminUsers: [
      { auth_id: STAFF_AUTH_ID, id: 'staff-1', role: 'staff', status: 'active' }
    ],
    validTokens: new Map([[STAFF_TOKEN, { id: STAFF_AUTH_ID, email: 'staff@pl.com' }]])
  });
  const server = await startServer(fixture);
  try {
    const target = fixture.rows[0];
    const res = await httpPatch(
      `${server.url}/api/admin/availability/${target.id}`,
      { guest_alias: 'x'.repeat(121) },
      { Authorization: `Bearer ${STAFF_TOKEN}` }
    );
    assert.equal(res.status, 400);
    assert.equal(target.guest_alias, null);
  } finally {
    await server.close();
  }
});
