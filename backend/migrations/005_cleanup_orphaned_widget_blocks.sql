-- Migration: wipe every widget-sourced availability row.
--
-- Context: during testing we created booking_requests that inserted rows into
-- `availability` with source='widget' (see booking.service.ts blockWidgetDates).
-- Until now there was no code path that deleted those rows when a booking was
-- rejected or abandoned, so they accumulated. The guest-facing widget does not
-- filter by source on /units/:id/availability, so those orphaned rows leaked
-- into the DatePicker and showed blocked dates that did not match Airbnb's
-- real calendar. The admin dashboard never saw the desync because
-- /admin/calendar filters source IN ('airbnb','manual').
--
-- Since we have no real bookings yet, the safe move is a full wipe of widget
-- rows. Going forward, admin reject and approve-with-conflict paths call
-- unblockWidgetDates() to keep the table clean per booking. Airbnb- and
-- manual-sourced rows are never touched.
--
-- Idempotent: safe to run multiple times.

DELETE FROM availability WHERE source = 'widget';
