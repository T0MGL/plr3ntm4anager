-- Migration 008: human alias for Airbnb reservations.
--
-- Airbnb iCal only exports SUMMARY="Reserved" plus the last 4 of the guest
-- phone and a reservation code. The operator needs a human name to identify
-- guests during check-in. Keep alias in availability so it lives next to the
-- reservation range and the sync pipeline can preserve it on re-sync by
-- matching external_ref.
--
-- Scope: additive column only. Widget/manual rows keep alias NULL. Existing
-- Airbnb rows keep NULL until the admin writes one. Rollback is
-- ALTER TABLE public.availability DROP COLUMN guest_alias; no dependent
-- constraints, no backfill, reversible in one statement.
--
-- Run after 007_availability_external_kind.sql in Supabase SQL editor.
-- Replay-safe via IF NOT EXISTS.

ALTER TABLE public.availability
  ADD COLUMN IF NOT EXISTS guest_alias TEXT
    CHECK (guest_alias IS NULL OR char_length(guest_alias) BETWEEN 1 AND 120);

COMMENT ON COLUMN public.availability.guest_alias IS
  'Human label added by the admin for an Airbnb reservation (e.g. "Familia Rodriguez", "Martin 3pax"). Preserved across iCal re-sync by matching external_ref in ical-sync.service.ts. NULL for widget/manual rows and for Airbnb rows that have not been labelled.';

-- No new index. Alias is looked up together with an availability row already
-- filtered by (unit_id, blocked_date) via the existing unique index, so a
-- dedicated index would not be used by any query path.

-- RLS is unchanged. Writes flow through the Express backend using the service
-- role key, which the availability_service_all policy already covers. No
-- anon/authenticated write path exists and none is added.
