-- ============================================================================
-- 016_booking_status_checkin_checkout.sql
-- Adds checked_in and checked_out values to the booking_status enum so the
-- admin can track the operational lifecycle of a stay beyond the payment flow.
-- ============================================================================

alter type booking_status add value if not exists 'checked_in';
alter type booking_status add value if not exists 'checked_out';
