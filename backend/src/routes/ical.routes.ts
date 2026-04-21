import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { BookingStatus } from '../types';

const router = Router();

/**
 * Rate limit for iCal feed requests. Airbnb polls every 15 to 30 minutes per
 * listing, so 10 req/min per IP is generous while still protecting against
 * abuse. Window is per IP, not per token, so a leaked token cannot be used to
 * DoS the origin from a single attacker.
 */
const icalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests to iCal feed'
});

function toIcalDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * GET /ical/:token
 *
 * Public iCal feed for a unit, keyed on the opaque token stored in
 * units.ical_feed_token. Unit IDs leak through admin UIs, logs, and booking
 * payloads, so exposing them as the public identifier would let anyone guess
 * or scrape the availability calendar of a property. The token is a UUID
 * generated at unit creation and rotatable by an admin, so a compromised URL
 * can be invalidated without touching the unit itself.
 *
 * No authentication required, Airbnb needs unauthenticated access to poll.
 *
 * Import URL format for Airbnb calendar sync:
 *   https://<your-domain>/ical/<token>
 */
router.get('/:token', icalRateLimit, async (req, res) => {
  const { token } = req.params;

  // Constrain token shape to UUID v4 format to avoid DB lookups on garbage and
  // to surface obvious tampering as a 404 rather than a 500.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(token)) {
    return res.status(404).send('Feed not found');
  }

  try {
    const { data: unit, error: unitError } = await supabaseAdmin
      .from('units')
      .select('id, name')
      .eq('ical_feed_token', token)
      .maybeSingle();

    if (unitError) {
      logger.error('iCal feed: failed to resolve token', { error: unitError.message });
      return res.status(500).send('Failed to generate calendar feed');
    }

    if (!unit) {
      return res.status(404).send('Feed not found');
    }

    const { data: bookings, error } = await supabaseAdmin
      .from('booking_requests')
      .select('id, check_in_date, check_out_date, status')
      .eq('unit_id', unit.id)
      .in('status', [BookingStatus.Pending, BookingStatus.Approved]);

    if (error) {
      logger.error('iCal feed: failed to fetch bookings', {
        error: error.message,
        unitId: unit.id
      });
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
    res.setHeader('Content-Disposition', `attachment; filename="unit-${unit.id}.ics"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    return res.send(icsContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('iCal feed: unexpected error', { error: message });
    return res.status(500).send('Internal server error');
  }
});

export default router;
