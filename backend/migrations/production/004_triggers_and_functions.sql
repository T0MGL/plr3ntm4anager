-- ============================================================================
-- 004_triggers_and_functions.sql
-- updated_at trigger, sync_availability RPC.
--
-- sync_availability is called by the backend ical-sync service with the list
-- of dates Airbnb reports as blocked. It replaces only rows with
-- source = 'airbnb' so widget and manual blocks survive.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Generic updated_at trigger function.
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attach to every table with updated_at.
drop trigger if exists trg_units_updated_at on public.units;
create trigger trg_units_updated_at
  before update on public.units
  for each row execute function public.set_updated_at();

drop trigger if exists trg_booking_requests_updated_at on public.booking_requests;
create trigger trg_booking_requests_updated_at
  before update on public.booking_requests
  for each row execute function public.set_updated_at();

drop trigger if exists trg_payments_updated_at on public.payments;
create trigger trg_payments_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- sync_availability RPC.
-- Called by backend with a list of date strings (yyyy-mm-dd). Atomically
-- deletes existing Airbnb rows for the unit then re-inserts the new set.
-- Widget/manual rows are untouched.
-- ----------------------------------------------------------------------------
create or replace function public.sync_availability(
  p_unit_id       uuid,
  p_blocked_dates date[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.availability
  where unit_id = p_unit_id
    and source  = 'airbnb';

  if p_blocked_dates is not null and array_length(p_blocked_dates, 1) > 0 then
    insert into public.availability (unit_id, blocked_date, source)
    select p_unit_id, unnest(p_blocked_dates), 'airbnb'::availability_source
    on conflict (unit_id, blocked_date) do nothing;
  end if;
end;
$$;

comment on function public.sync_availability(uuid, date[]) is
  'Atomic airbnb sync. Deletes existing airbnb-sourced rows for the unit and reinserts new ones. Widget/manual rows are preserved.';

-- Service role only. Backend uses service key via /rest/v1/rpc.
revoke all on function public.sync_availability(uuid, date[]) from public;
grant execute on function public.sync_availability(uuid, date[]) to service_role;

-- ----------------------------------------------------------------------------
-- Convenience: helper to return whether a unit is available for a range.
-- Matches booking.service.isAvailable logic for server-side validation.
-- ----------------------------------------------------------------------------
create or replace function public.is_unit_available(
  p_unit_id  uuid,
  p_check_in  date,
  p_check_out date
)
returns boolean
language sql
stable
as $$
  select not exists (
    select 1
    from public.availability
    where unit_id       = p_unit_id
      and blocked_date >= p_check_in
      and blocked_date  < p_check_out
  );
$$;

comment on function public.is_unit_available(uuid, date, date) is
  'True when no blocked dates overlap [check_in, check_out).';

revoke all on function public.is_unit_available(uuid, date, date) from public;
grant execute on function public.is_unit_available(uuid, date, date) to service_role, authenticated;
