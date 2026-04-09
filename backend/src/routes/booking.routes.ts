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

    await sendEmail(
      payload.guest_email,
      'Booking request received',
      `<p>Thanks ${payload.guest_name}, your request is pending approval.</p>`
    );

    return res.json({ booking_id: result.bookingId, status: 'pending' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create booking request';
    return res.status(400).json({ error: message });
  }
});

export default router;
