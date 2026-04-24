-- Migration: link widget-sourced availability rows to their owning booking.
--
-- Problem: blockWidgetDates inserts rows into `availability` at the moment the
-- guest submits the booking request, BEFORE decideApprovalPath runs its
-- availability check. The check then reads those rows and classifies the
-- booking as `dates_conflict`, routing every auto-path booking to manual
-- review. Self-conflict.
--
-- Fix: own the widget rows with `booking_id`. The decider passes the current
-- booking_id into checkAvailabilityRange and excludes rows that belong to it.
-- Collisions with other pending bookings and Airbnb/manual rows are still
-- caught as conflicts.
--
-- Scope: additive, nullable column. Airbnb and manual rows stay NULL. Existing
-- widget rows (none at the time of this migration per 005) will be NULL and
-- will be cleaned up by the next sync cycle or manual admin action.
--
-- Run in Supabase SQL editor before deploying the backend that writes to it.

ALTER TABLE availability
  ADD COLUMN IF NOT EXISTS booking_id UUID REFERENCES booking_requests(id) ON DELETE CASCADE;

-- Partial index: only widget rows carry a booking_id, so narrow the index to
-- them. Speeds up the two hot paths: exclude-by-booking on availability check
-- and delete-by-booking on unblockWidgetDates / cascade.
CREATE INDEX IF NOT EXISTS idx_availability_booking_id
  ON availability (booking_id)
  WHERE booking_id IS NOT NULL;
