-- Migration 004: token-based iCal feeds
--
-- Unit IDs are exposed in the admin dashboard and could leak through logs, so
-- using them as the public iCal URL identifier means any guessed or leaked ID
-- reveals the booking calendar of a property. We move the public feed behind
-- an opaque token that is rotated on demand.
--
-- Every existing row gets a unique token backfilled via gen_random_uuid(). New
-- rows receive one automatically through the DEFAULT. The column is NOT NULL
-- UNIQUE so the backend can safely look up a unit by token with a single
-- indexed query.
--
-- Requires pgcrypto for gen_random_uuid(). Supabase enables it by default, but
-- we guard for paranoia in case this migration runs in a fresh project.
--
-- Idempotent: safe to run multiple times.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE units
  ADD COLUMN IF NOT EXISTS ical_feed_token TEXT;

UPDATE units
SET ical_feed_token = gen_random_uuid()::text
WHERE ical_feed_token IS NULL;

ALTER TABLE units
  ALTER COLUMN ical_feed_token SET NOT NULL,
  ALTER COLUMN ical_feed_token SET DEFAULT gen_random_uuid()::text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'units_ical_feed_token_key'
  ) THEN
    ALTER TABLE units
      ADD CONSTRAINT units_ical_feed_token_key UNIQUE (ical_feed_token);
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_units_ical_feed_token
  ON units (ical_feed_token);
