-- ============================================================================
-- 003_indexes.sql
-- Indexes on every foreign key and every field that the backend filters,
-- orders, or joins by. Keeps admin list queries under 50ms at scale.
-- ============================================================================

-- units ----------------------------------------------------------------------
create index if not exists idx_units_status        on public.units (status);
create index if not exists idx_units_created_at    on public.units (created_at desc);

-- availability ---------------------------------------------------------------
-- Primary lookup: blocked dates for a unit in a date range.
create index if not exists idx_availability_unit_date
  on public.availability (unit_id, blocked_date);

-- Used by sync_availability RPC to wipe only Airbnb-sourced rows.
create index if not exists idx_availability_unit_source
  on public.availability (unit_id, source);

-- booking_requests -----------------------------------------------------------
create index if not exists idx_bookings_unit_id         on public.booking_requests (unit_id);
create index if not exists idx_bookings_status          on public.booking_requests (status);
create index if not exists idx_bookings_created_at      on public.booking_requests (created_at desc);
create index if not exists idx_bookings_approved_by     on public.booking_requests (approved_by);
create index if not exists idx_bookings_guest_email     on public.booking_requests (guest_email);

-- iCal feed filter: unit + status. Covering for the 'pending'/'approved' query.
create index if not exists idx_bookings_unit_status_dates
  on public.booking_requests (unit_id, status, check_in_date, check_out_date);

-- payments -------------------------------------------------------------------
create index if not exists idx_payments_booking_id     on public.payments (booking_id);
create index if not exists idx_payments_status         on public.payments (payment_status);
create index if not exists idx_payments_created_at     on public.payments (created_at desc);
create index if not exists idx_payments_shop_process_id on public.payments (shop_process_id);

-- Partial index: active (non-final) payments by booking. Used by createSingleBuy.
create index if not exists idx_payments_active_per_booking
  on public.payments (booking_id)
  where payment_status in ('pending', 'preauthorized');

-- sync_logs ------------------------------------------------------------------
create index if not exists idx_sync_logs_unit_id        on public.sync_logs (unit_id);
create index if not exists idx_sync_logs_started_at     on public.sync_logs (sync_started_at desc);

-- Used by getLastSyncAt: latest successful sync per unit.
create index if not exists idx_sync_logs_unit_success_completed
  on public.sync_logs (unit_id, sync_completed_at desc)
  where sync_status = 'success';
