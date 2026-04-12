import { Router } from 'express';
import { z } from 'zod';
import { bookingRateLimit } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import { dateSchema, emailSchema, phoneSchema } from '../utils/validation.utils';
import { createBookingRequest, getPublicBookingDetails } from '../services/booking.service';
import { sendEmail } from '../services/email.service';
import { bookingRequestEmail } from '../templates/emails';

const router = Router();

const bookingSchema = z.object({
  body: z.object({
    unit_id: z.string().uuid(),
    guest_name: z.string().min(2),
    guest_email: emailSchema,
    guest_phone: phoneSchema,
    check_in_date: dateSchema,
    check_out_date: dateSchema,
    special_requests: z.string().max(1000).optional(),
    locale: z.string().max(10).optional()
  })
});

router.post('/booking-request', bookingRateLimit, validate(bookingSchema), async (req, res) => {
  try {
    const payload = req.body as {
      unit_id: string;
      guest_name: string;
      guest_email: string;
      guest_phone: string;
      check_in_date: string;
      check_out_date: string;
      special_requests?: string;
      locale?: string;
    };

    const result = await createBookingRequest({
      unitId: payload.unit_id,
      guestName: payload.guest_name,
      guestEmail: payload.guest_email,
      guestPhone: payload.guest_phone,
      checkIn: payload.check_in_date,
      checkOut: payload.check_out_date,
      specialRequests: payload.special_requests,
      locale: payload.locale
    });

    // Respond immediately, email is non-blocking (SMTP may timeout).
    res.json({ booking_id: result.bookingId, status: 'pending' });

    const email = bookingRequestEmail({ guestName: payload.guest_name, locale: payload.locale });
    sendEmail(payload.guest_email, email.subject, email.html)
      .catch(() => { /* logged inside sendEmail */ });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create booking request';
    return res.status(400).json({ error: message });
  }
});

// GET /booking-request/:id/public
// Public lookup used by the payment result page. Returns only the fields that
// are safe to render on a URL anyone with the booking UUID can hit: unit name,
// first name, dates, total, payment status. No email, no phone, no full name.

const publicBookingParamsSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  })
});

router.get('/booking-request/:id/public', validate(publicBookingParamsSchema), async (req, res) => {
  try {
    const booking = await getPublicBookingDetails(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.json(booking);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

export default router;
