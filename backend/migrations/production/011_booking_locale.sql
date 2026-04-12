-- Add locale column to booking_requests for i18n email templates.
-- Defaults to 'es' (Paraguay market). Frontend sends the detected browser
-- locale at booking creation time.

ALTER TABLE booking_requests
  ADD COLUMN IF NOT EXISTS locale text DEFAULT 'es';
