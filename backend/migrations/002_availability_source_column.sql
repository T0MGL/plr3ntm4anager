-- Migration: Add source column to availability table
-- This distinguishes between Airbnb-synced dates ('airbnb') and widget-blocked dates ('widget').
-- Required so that the sync_availability RPC can preserve widget-sourced rows
-- instead of wiping them on every Airbnb iCal sync.
--
-- IMPORTANT: After running this migration, update the sync_availability Postgres function
-- to filter on source = 'airbnb' before deleting, so widget rows survive Airbnb re-syncs:
--
--   DELETE FROM availability WHERE unit_id = p_unit_id AND source = 'airbnb';
--   INSERT INTO availability (unit_id, blocked_date, source)
--     SELECT p_unit_id, unnest(p_blocked_dates), 'airbnb'
--     ON CONFLICT (unit_id, blocked_date) DO NOTHING;
--
-- Run this in your Supabase SQL editor before deploying backend changes.

ALTER TABLE availability ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'airbnb';

-- Index for fast filtering by source on sync operations
CREATE INDEX IF NOT EXISTS idx_availability_unit_source ON availability(unit_id, source);
