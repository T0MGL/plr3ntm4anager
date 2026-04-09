-- Migration: Add columns required for Bancard VPOS 2.0 integration
-- Run this in your Supabase SQL editor before switching PAYMENT_MODE to 'live'

-- shop_process_id: Our numeric transaction ID sent to Bancard (Entero 15)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS shop_process_id TEXT;

-- bancard_process_id: The process_id returned by Bancard's single_buy
ALTER TABLE payments ADD COLUMN IF NOT EXISTS bancard_process_id TEXT;

-- amount_pyg: Amount in Guaranies (Bancard only accepts PYG)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount_pyg NUMERIC(15,2);

-- is_preauthorization: Whether this payment uses the preauth flow
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_preauthorization BOOLEAN DEFAULT false;

-- authorization_number: Bancard's authorization code for approved transactions
ALTER TABLE payments ADD COLUMN IF NOT EXISTS authorization_number TEXT;

-- response_code: Bancard response code (00 = approved, etc.)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS response_code TEXT;

-- Add index on shop_process_id for fast lookups from Bancard confirmations
CREATE INDEX IF NOT EXISTS idx_payments_shop_process_id ON payments(shop_process_id);

-- Update payment_status enum to include 'preauthorized' if using check constraint
-- (If you use a text column, no change needed)
-- If you have a CHECK constraint on payment_status, you may need to update it:
-- ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_status_check;
-- ALTER TABLE payments ADD CONSTRAINT payments_payment_status_check
--   CHECK (payment_status IN ('pending', 'preauthorized', 'completed', 'failed', 'refunded'));
