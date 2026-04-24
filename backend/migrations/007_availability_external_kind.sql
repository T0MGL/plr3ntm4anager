-- Migration: classify Airbnb iCal events beyond a flat "blocked" bucket.
--
-- Problem: parseBlockedDates in ical-sync.service.ts treats every VEVENT as a
-- generic block. Airbnb actually emits at least three flavors:
--   * SUMMARY "Reserved"              -> real guest stay with phone last4 and
--                                        a reservation code in DESCRIPTION.
--   * SUMMARY "Airbnb (Not available)" -> windowing / pause hold, no guest.
--   * SUMMARY "Blocked"                -> host-created hold, no guest.
-- The admin dashboard renders all three as "reservations", so a 9-month
-- Airbnb window hold shows up as a 9-month stay. Misleading.
--
-- Fix: record the classification and, when available, the last 10 chars of
-- the Reservation URL (the human-readable code HMXTN9AJJM) plus the last 4
-- digits of the guest phone. The admin UI reads these to split reservation
-- cards from administrative blocks and to deep-link to Airbnb's host
-- dashboard.
--
-- Scope: strictly additive. All new columns are nullable. Widget and manual
-- rows keep external_kind = NULL. Existing Airbnb rows keep NULL until the
-- next sync pass repopulates them. The sync_availability RPC signature is
-- unchanged; the ical-sync service does a follow-up UPDATE to stamp the
-- classification per date range.
--
-- Run in the Supabase SQL editor before deploying the backend that writes
-- to these columns. Rollback is safe: DROP the three columns (nullable, no
-- dependent code paths outside of the admin UI).

ALTER TABLE public.availability
  ADD COLUMN IF NOT EXISTS external_kind TEXT,
  ADD COLUMN IF NOT EXISTS external_ref  TEXT,
  ADD COLUMN IF NOT EXISTS guest_last4   TEXT;

-- Bound external_kind to the known values so malformed inserts are rejected
-- at the DB boundary. NULL stays valid for widget / manual rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_external_kind_valid'
  ) THEN
    ALTER TABLE public.availability
      ADD CONSTRAINT availability_external_kind_valid
      CHECK (external_kind IS NULL OR external_kind IN ('reserved', 'not_available', 'blocked', 'unknown'));
  END IF;
END
$$;

-- Partial index keeps airbnb-only lookups cheap. Widget and manual stay out
-- since external_kind is NULL for them.
CREATE INDEX IF NOT EXISTS idx_availability_external_kind
  ON public.availability (unit_id, external_kind)
  WHERE external_kind IS NOT NULL;

COMMENT ON COLUMN public.availability.external_kind IS
  'Airbnb VEVENT classification: reserved | not_available | blocked | unknown. NULL for widget and manual rows.';
COMMENT ON COLUMN public.availability.external_ref IS
  'Last 10 chars of the Airbnb Reservation URL (e.g. HMXTN9AJJM), populated only for reserved rows. Deep-links to airbnb.com/hosting/reservations/details/{ref}.';
COMMENT ON COLUMN public.availability.guest_last4 IS
  'Last 4 digits of the guest phone number as exported by Airbnb. Populated only for reserved rows.';
