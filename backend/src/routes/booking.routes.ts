import { Router } from 'express';
import { z } from 'zod';
import { bookingRateLimit } from '../middleware/rate-limit.middleware';
import { validate } from '../middleware/validate.middleware';
import { dateSchema, emailSchema, phoneSchema } from '../utils/validation.utils';
import { createBookingRequest, getPublicBookingDetails, cancelBookingRequest } from '../services/booking.service';
import { supabaseAdmin } from '../config/supabase';
import { BookingStatus, PaymentStatus } from '../types';

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

    // Do NOT send a "request received" email here. The guest has not entered
    // their card yet and the language "pending review" contradicts the real
    // flow. The single authoritative email is sent after the payment step,
    // based on the actual path: paymentConfirmedEmail (auto), underReview
    // (manual preauth), paymentFailed, or conflictRejection.
    res.json({ booking_id: result.bookingId, status: 'pending' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create booking request';
    return res.status(400).json({ error: message });
  }
});

// GET /booking-request/:id/resumable
//
// Returns a minimal status object for a booking the client already holds
// a session token for. The frontend calls this on the payment step to
// determine whether to resume (re-run /payments/preauth) or create fresh.
//
// Returns:
//   { resumable: true, status: 'pending' } — booking is still open, no active payment
//   { resumable: false, reason: string }  — booking is in a terminal/active state
//
// Access is intentionally open (UUID is a secret by construction). We only
// return a boolean + enum, never guest PII.

const resumableParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

router.get('/booking-request/:id/resumable', validate(resumableParamsSchema), async (req, res) => {
  const { data: booking, error } = await supabaseAdmin
    .from('booking_requests')
    .select('id, status')
    .eq('id', req.params.id)
    .maybeSingle();

  if (error || !booking) {
    return res.status(404).json({ resumable: false, reason: 'not_found' });
  }

  if (booking.status !== BookingStatus.Pending) {
    return res.json({ resumable: false, reason: booking.status });
  }

  // Check for a payment that is already active (pending or preauthorized).
  // If one exists, the Bancard iframe is already open elsewhere; don't resume.
  const { data: activePayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('booking_id', req.params.id)
    .in('payment_status', [PaymentStatus.Pending, PaymentStatus.Preauthorized])
    .maybeSingle();

  if (activePayment) {
    return res.json({ resumable: false, reason: 'payment_in_progress' });
  }

  return res.json({ resumable: true, status: booking.status });
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

// POST /booking-request/:id/cancel
//
// Guest-initiated cancellation fired when the Bancard modal is dismissed
// without a completed payment (X button, network error, script load failure).
// Immediately releases the widget availability blocks so the dates reopen
// without waiting for the 1h abandoned-booking cron.
//
// Access is intentionally unauthenticated: the UUID is unguessable and we
// only allow cancellation of `pending` bookings with no active payment, so
// a replayed request against a paid booking is a safe no-op.

const cancelParamsSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

router.post('/booking-request/:id/cancel', validate(cancelParamsSchema), async (req, res) => {
  const result = await cancelBookingRequest(req.params.id);

  if (result.reason === 'not_found') {
    return res.status(404).json({ error: 'Booking not found' });
  }

  return res.json(result);
});

export default router;
