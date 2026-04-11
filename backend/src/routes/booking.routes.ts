import { Router } from 'express';
import { z } from 'zod';
import { bookingRateLimit } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import { dateSchema, emailSchema, phoneSchema } from '../utils/validation.utils';
import { createBookingRequest } from '../services/booking.service';
import { sendEmail } from '../services/email.service';

const router = Router();

const bookingSchema = z.object({
  body: z.object({
    unit_id: z.string().uuid(),
    guest_name: z.string().min(2),
    guest_email: emailSchema,
    guest_phone: phoneSchema,
    check_in_date: dateSchema,
    check_out_date: dateSchema,
    special_requests: z.string().max(1000).optional()
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
    };

    const result = await createBookingRequest({
      unitId: payload.unit_id,
      guestName: payload.guest_name,
      guestEmail: payload.guest_email,
      guestPhone: payload.guest_phone,
      checkIn: payload.check_in_date,
      checkOut: payload.check_out_date,
      specialRequests: payload.special_requests
    });

    // Respond immediately, email is non-blocking (SMTP may timeout).
    res.json({ booking_id: result.bookingId, status: 'pending' });

    sendEmail(
      payload.guest_email,
      'Booking request received',
      [
        '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">',
        '<h2 style="margin: 0 0 24px; font-size: 22px; font-weight: 600;">Request received</h2>',
        `<p style="margin: 0 0 16px; line-height: 1.6;">Hi ${payload.guest_name},</p>`,
        '<p style="margin: 0 0 16px; line-height: 1.6;">We received your booking request and it is now pending review. You will receive an email once it has been approved.</p>',
        '<p style="margin: 0 0 8px; line-height: 1.6;">Thank you for choosing Park Lofts.</p>',
        '<p style="margin: 0; line-height: 1.6; color: #666; font-size: 13px;">Park Lofts Paraguay</p>',
        '</div>'
      ].join('')
    ).catch(() => { /* logged inside sendEmail */ });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create booking request';
    return res.status(400).json({ error: message });
  }
});

export default router;
