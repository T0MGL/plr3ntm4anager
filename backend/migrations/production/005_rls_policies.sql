-- ============================================================================
-- 005_rls_policies.sql
-- Row Level Security for every table.
--
-- Model:
--   anon          -> read-only, active units and their public availability only.
--   authenticated -> same as anon plus admin writes when also service_role.
--                    In this app, admin dashboard uses Supabase auth with a
--                    JWT but every write goes through the backend which holds
--                    the service key. Authenticated clients should NOT write
--                    directly, only read admin data when needed.
--   service_role  -> full access (bypasses RLS automatically in Supabase, but
--                    we still define explicit policies so any direct PostgREST
--                    call with anon/authenticated fails closed).
--
-- Bancard confirmation endpoint is unauthenticated but hits the backend which
-- uses the service key, so RLS never needs to permit unauthenticated writes.
-- ============================================================================

alter table public.units             enable row level security;
alter table public.availability      enable row level security;
alter table public.booking_requests  enable row level security;
alter table public.payments          enable row level security;
alter table public.sync_logs         enable row level security;

-- Force RLS even for table owners. Prevents accidental leaks if ownership
-- changes. service_role still bypasses because of its BYPASSRLS grant.
alter table public.units             force row level security;
alter table public.availability      force row level security;
alter table public.booking_requests  force row level security;
alter table public.payments          force row level security;
alter table public.sync_logs         force row level security;

-- ----------------------------------------------------------------------------
-- units
-- Public can list/read active units. Only service_role writes.
-- ----------------------------------------------------------------------------
drop policy if exists units_anon_select_active on public.units;
create policy units_anon_select_active
  on public.units for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists units_service_all on public.units;
create policy units_service_all
  on public.units for all
  to service_role
  using (true) with check (true);

-- ----------------------------------------------------------------------------
-- availability
-- Public can read availability for active units only. Writes through service.
-- ----------------------------------------------------------------------------
drop policy if exists availability_anon_select on public.availability;
create policy availability_anon_select
  on public.availability for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.units u
      where u.id = availability.unit_id and u.status = 'active'
    )
  );

drop policy if exists availability_service_all on public.availability;
create policy availability_service_all
  on public.availability for all
  to service_role
  using (true) with check (true);

-- ----------------------------------------------------------------------------
-- booking_requests
-- Never exposed to anon. The backend handles all writes using the service key.
-- Authenticated admin users can read via RPC if we add one later, but direct
-- client writes are blocked here.
-- ----------------------------------------------------------------------------
drop policy if exists bookings_service_all on public.booking_requests;
create policy bookings_service_all
  on public.booking_requests for all
  to service_role
  using (true) with check (true);

-- ----------------------------------------------------------------------------
-- payments
-- Never exposed to anon or authenticated. Writes only via service key.
-- ----------------------------------------------------------------------------
drop policy if exists payments_service_all on public.payments;
create policy payments_service_all
  on public.payments for all
  to service_role
  using (true) with check (true);

-- ----------------------------------------------------------------------------
-- sync_logs
-- Service-only. Admin dashboard reads via backend, never direct.
-- ----------------------------------------------------------------------------
drop policy if exists sync_logs_service_all on public.sync_logs;
create policy sync_logs_service_all
  on public.sync_logs for all
  to service_role
  using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Hardening: strip default PostgREST read grants on sensitive tables so that
-- even without a policy match they are fully closed to anon/authenticated.
-- ----------------------------------------------------------------------------
revoke all on public.booking_requests from anon, authenticated;
revoke all on public.payments         from anon, authenticated;
revoke all on public.sync_logs        from anon, authenticated;

-- Keep select on units and availability for anon (policies above still gate rows).
grant select on public.units        to anon, authenticated;
grant select on public.availability to anon, authenticated;

-- Service role should have everything. Supabase grants this by default but we
-- re-grant explicitly to document intent.
grant all on public.units            to service_role;
grant all on public.availability     to service_role;
grant all on public.booking_requests to service_role;
grant all on public.payments         to service_role;
grant all on public.sync_logs        to service_role;
