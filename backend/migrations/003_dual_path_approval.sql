-- Migration: Dual-path approval for bookings
-- Introduces explicit routing between auto-approved bookings (fresh sync, no
-- conflict) and manual-review bookings (stale sync, doubt, or conflict). Every
-- booking created from the widget now records which path it took so the admin
-- dashboard can filter, the audit trail is complete, and a preauthorization
-- that stalls for more than five days can be detected by the alert cron.
--
-- Run in Supabase SQL editor before deploying the new payment handlers.

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS approval_path TEXT;

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS approval_decision_reason TEXT;

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS sync_age_minutes_at_decision INTEGER;

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS auto_approved_at TIMESTAMPTZ;

-- Constrain approval_path to the two valid values. Keep nullable so legacy rows
-- created before this migration stay valid and show up as "unknown" in the UI.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'booking_requests_approval_path_check'
  ) THEN
    ALTER TABLE booking_requests
      ADD CONSTRAINT booking_requests_approval_path_check
      CHECK (approval_path IS NULL OR approval_path IN ('auto', 'manual'));
  END IF;
END;
$$;

-- Index powers the "Necesitan revision" admin tab: manual bookings still
-- pending review. Partial to keep it tight.
CREATE INDEX IF NOT EXISTS idx_booking_requests_manual_pending
  ON booking_requests (created_at DESC)
  WHERE approval_path = 'manual' AND status = 'pending';

-- Index supports the stuck-preauth alert cron: manual bookings older than N
-- days that never resolved. Partial, also tight.
CREATE INDEX IF NOT EXISTS idx_booking_requests_manual_stale
  ON booking_requests (created_at)
  WHERE approval_path = 'manual' AND status = 'pending';

-- Broad index on approval_path for ad-hoc reporting and the auto/manual split.
CREATE INDEX IF NOT EXISTS idx_booking_requests_approval_path
  ON booking_requests (approval_path);
