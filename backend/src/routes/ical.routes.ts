import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { BookingStatus } from '../types';

const router = Router();

/**
 * Rate limit for iCal feed requests.
 * Airbnb polls every 15-30 minutes per listing, so 10 req/min per IP is generous
 * while still protecting against abuse.
 */
const icalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests to iCal feed'
});

/**
 * Formats a Date object to iCal DTSTART/DTEND date-only format: YYYYMMDD
 */
function toIcalDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD from Supabase
  return dateStr.replace(/-/g, '');
}

/**
 * Escapes special characters in iCal text fields per RFC 5545 §3.3.11.
 */
function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * GET /ical/unit/:unitId
 *
 * Public iCal feed endpoint for a unit. Returns all bookings with status
 * 'pending' or 'approved' as VEVENT entries in a VCALENDAR feed.
 *
 * No authentication required — Airbnb needs unauthenticated access to poll this URL.
 *
 * Import URL format for Airbnb calendar sync:
 *   https://<your-domain>/ical/unit/<unitId>
 */
router.get('/unit/:unitId', icalRateLimit, async (req, res) => {
  const { unitId } = req.params;

  // Basic UUID format check to avoid hitting the DB with garbage
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(unitId)) {
    return res.status(400).send('Invalid unit ID');
  }

  try {
    const { data: bookings, error } = await supabaseAdmin
      .from('booking_requests')
      .select('id, check_in_date, check_out_date, status')
      .eq('unit_id', unitId)
      .in('status', [BookingStatus.Pending, BookingStatus.Approved]);

    if (error) {
      logger.error('iCal feed: failed to fetch bookings', { error: error.message, unitId });
      return res.status(500).send('Failed to generate calendar feed');
    }

    const lines: string[] = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PL Rent Manager//Booking Engine//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Park Lofts Availability',
      'X-WR-TIMEZONE:UTC'
    ];

    for (const booking of bookings ?? []) {
      const uid = escapeIcalText(`${booking.id}@pl-rent-manager`);
      const dtStart = toIcalDate(booking.check_in_date as string);
      const dtEnd = toIcalDate(booking.check_out_date as string);
      const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        'SUMMARY:Reserved',
        `STATUS:${booking.status === BookingStatus.Approved ? 'CONFIRMED' : 'TENTATIVE'}`,
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="unit-${unitId}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(icsContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('iCal feed: unexpected error', { error: message, unitId });
    return res.status(500).send('Internal server error');
  }
});

export default router;
