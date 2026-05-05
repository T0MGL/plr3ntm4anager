-- Add per-booking cleaning fee column.
-- Default 0 preserves existing booking totals without recalculation.
ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS cleaning_fee_usd NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Seed the default cleaning fee setting.
-- Operator configures this from the Settings UI; 0 means no cleaning fee applied.
INSERT INTO settings (key, value, updated_at)
VALUES ('cleaning_fee_usd', '0', now())
ON CONFLICT (key) DO NOTHING;
