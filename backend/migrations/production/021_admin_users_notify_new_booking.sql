-- ============================================================================
-- 021_admin_users_notify_new_booking.sql
-- Adds per-admin opt-in flag for new-booking email notifications.
--
-- Design:
--   NOT NULL with DEFAULT TRUE so existing rows are automatically opted in
--   without any data backfill step. Admins can opt out from the Settings
--   panel (Account section). Applies to both auto-path and manual-path
--   booking confirmations.
-- ============================================================================

alter table public.admin_users
  add column if not exists notify_new_booking boolean not null default true;

comment on column public.admin_users.notify_new_booking is
  'When true, this admin receives an email each time a booking is confirmed (auto or manual path).';
