import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { manualSyncRateLimit, adminWriteLimiter } from '../middleware/rate-limit.middleware';
import { adminUserService } from '../services/admin-user.service';
import { supabaseAdmin } from '../config/supabase';
import { BookingStatus, PaymentStatus, UnitStatus } from '../types';
import { capturePaymentForBooking, rollbackPayment } from '../services/payment.service';
import {
  fetchAndStoreFxRate,
  getCurrentFxRate,
  setManualOverride,
  setMarkupPct
} from '../services/fx-rate.service';
import { createPaymentLink, listPaymentLinks } from '../services/payment-link.service';
import { recheckAvailabilityOrFail } from '../services/approval-routing.service';
import { sendEmail } from '../services/email.service';
import {
  bookingApprovedEmail,
  bookingConflictRejectionEmail,
  bookingRejectedEmail,
  paymentConfirmedEmail
} from '../templates/emails';
import { syncAllUnits, syncUnit } from '../services/ical-sync.service';
import { unblockWidgetDates } from '../services/booking.service';
import { notifyAdminsNewBooking } from '../services/admin-notification.service';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { nightsBetween, todayInAsuncion, addDaysStr as addDaysStrUtil, asuncionYearMonth } from '../utils/date.utils';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.use(requireAuth);

router.get('/units', async (_req, res) => {
  const { data, error } = await supabaseAdmin.from('units').select('*').order('created_at', { ascending: false });
  if (error) {
    logger.error('Failed to fetch units', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch units' });
  }
  return res.json(data ?? []);
});

router.get('/units/:id', async (req, res) => {
  const unitId = req.params.id;

  const { data, error } = await supabaseAdmin
    .from('units')
    .select('*')
    .eq('id', unitId)
    .single();

  if (error || !data) {
    logger.error('Failed to fetch unit', { error: error?.message, unitId });
    return res.status(404).json({ error: 'Unit not found' });
  }

  return res.json(data);
});

/**
 * POST /api/admin/units/:id/regenerate-ical-token
 *
 * Rotates the public iCal feed token for a unit. The previous token stops
 * working the moment the new one is persisted, so Airbnb will receive a 404
 * on the next poll until the operator updates the Import URL in Airbnb with
 * the new token. That is intentional and the whole point of rotation: when a
 * token leaks, the only way to cut off access is to invalidate it.
 */
router.post('/units/:id/regenerate-ical-token', async (req, res) => {
  const unitId = req.params.id;

  const { data, error } = await supabaseAdmin
    .from('units')
    .update({ ical_feed_token: uuidv4() })
    .eq('id', unitId)
    .select('ical_feed_token')
    .single();

  if (error || !data) {
    logger.error('Failed to regenerate iCal token', { error: error?.message, unitId });
    return res.status(500).json({ error: 'Failed to regenerate iCal token' });
  }

  return res.json({ ical_feed_token: data.ical_feed_token });
});

router.get('/booking-requests', async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Number(req.query.limit ?? 200);
  const offset = Number(req.query.offset ?? 0);

  let query = supabaseAdmin
    .from('booking_requests')
    .select('*, units(name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error, count } = await query;
  if (error) {
    logger.error('Failed to fetch bookings', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }

  return res.json({ data: data ?? [], count: count ?? 0 });
});

// GET /admin/calendar
//
// Unified calendar source for the admin booking view. Merges two independent
// data sources so the admin sees the full occupancy picture in one render:
//
//   1. booking_requests   -> guest reservations (pending/approved/paid/rejected)
//   2. availability       -> per-night blocks from Airbnb iCal sync, widget
//                            holds, or manual admin entries
//
// Widget blocks are filtered out at the source level because they already have
// a booking_requests row that the calendar renders separately and we do not
// want to double-paint those nights. Airbnb and manual blocks render in their
// own color track.
//
// Query params:
//   from, to  optional ISO dates (YYYY-MM-DD). Defaults to a 12 month window
//             anchored 30 days behind today. Large upper bounds are capped at
//             18 months to protect the endpoint from pathological ranges.
router.get('/calendar', async (req, res) => {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const defaultTo = new Date(today);
  defaultTo.setMonth(defaultTo.getMonth() + 12);

  const fromParam = (req.query.from as string | undefined)?.trim();
  const toParam = (req.query.to as string | undefined)?.trim();

  const isIsoDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value);

  const from = fromParam && isIsoDate(fromParam) ? fromParam : defaultFrom.toISOString().slice(0, 10);
  const to = toParam && isIsoDate(toParam) ? toParam : defaultTo.toISOString().slice(0, 10);

  // Hard upper bound on range width so a bad client cannot pull the whole table.
  const maxSpanMs = 1000 * 60 * 60 * 24 * 550;
  if (new Date(to).getTime() - new Date(from).getTime() > maxSpanMs) {
    return res.status(400).json({ error: 'Date range too wide, max 550 days' });
  }

  const [bookingsResult, blocksResult] = await Promise.all([
    supabaseAdmin
      .from('booking_requests')
      .select(
        'id, unit_id, guest_name, guest_email, check_in_date, check_out_date, status, approval_path, total_price_usd, units(name)'
      )
      .neq('status', 'rejected')
      .lte('check_in_date', to)
      .gte('check_out_date', from)
      .order('check_in_date', { ascending: true }),
    supabaseAdmin
      .from('availability')
      .select('id, unit_id, blocked_date, source, external_kind, external_ref, guest_last4, guest_alias, units(name)')
      .in('source', ['airbnb', 'manual'])
      .gte('blocked_date', from)
      .lte('blocked_date', to)
      .order('blocked_date', { ascending: true })
  ]);

  if (bookingsResult.error) {
    logger.error('calendar: failed to fetch bookings', { error: bookingsResult.error.message });
    return res.status(500).json({ error: 'Failed to fetch calendar bookings' });
  }

  if (blocksResult.error) {
    logger.error('calendar: failed to fetch availability', { error: blocksResult.error.message });
    return res.status(500).json({ error: 'Failed to fetch calendar blocks' });
  }

  return res.json({
    range: { from, to },
    bookings: bookingsResult.data ?? [],
    blocks: blocksResult.data ?? []
  });
});

const approveSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

// POST /admin/booking-requests/:id/approve
//
// Manual-path approval. Re-runs the same availability checks as the widget so
// a booking that has been sitting in the queue cannot slip past a conflict
// that appeared during that window. Flow:
//
//   1. Load the booking and its unit.
//   2. Run recheckAvailabilityOrFail(): inline iCal sync + DB availability
//      query. If the dates are no longer free, we rollback the preauth, mark
//      the booking rejected, email the guest with explicit refund language,
//      and return 409.
//   3. Otherwise capture the preauth (or no-op for already-paid auto-path),
//      mark the booking Paid/Approved, and send the final payment confirmed
//      email with trip details.

router.post('/booking-requests/:id/approve', validate(approveSchema), async (req, res) => {
  const bookingId = req.params.id;
  const userId = res.locals.user?.id as string;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select(
      'id, guest_email, guest_name, status, locale, unit_id, check_in_date, check_out_date, total_price_usd, approval_path'
    )
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.status !== BookingStatus.Pending) {
    return res.status(400).json({ error: 'Booking is not pending' });
  }

  const { data: unit, error: unitError } = await supabaseAdmin
    .from('units')
    .select('id, name, airbnb_ical_url')
    .eq('id', booking.unit_id)
    .single();

  if (unitError || !unit) {
    logger.error('Approve: unit lookup failed', { booking_id: bookingId, error: unitError?.message });
    return res.status(500).json({ error: 'Unit lookup failed' });
  }

  const recheck = await recheckAvailabilityOrFail(
    unit.id,
    unit.airbnb_ical_url ?? null,
    booking.check_in_date,
    booking.check_out_date,
    bookingId
  );

  if (!recheck.available) {
    logger.warn('Approve: availability recheck failed, rolling back', {
      booking_id: bookingId,
      reason: recheck.reason
    });

    // Read the pre-rollback payment status so the conflict email can pick the
    // right refund language (captured charge vs released preauth). After
    // rollbackPayment runs, the row moves to 'refunded' and the original type
    // is no longer directly readable.
    const { data: preRollbackPayment } = await supabaseAdmin
      .from('payments')
      .select('payment_status')
      .eq('booking_id', bookingId)
      .in('payment_status', [
        PaymentStatus.Pending,
        PaymentStatus.Preauthorized,
        PaymentStatus.Completed
      ])
      .maybeSingle();
    const conflictPaymentType: 'preauthorized' | 'completed' | null =
      preRollbackPayment?.payment_status === PaymentStatus.Completed
        ? 'completed'
        : preRollbackPayment?.payment_status === PaymentStatus.Preauthorized
          ? 'preauthorized'
          : null;

    try {
      await rollbackPayment(bookingId);
    } catch (rollbackErr: unknown) {
      const msg = rollbackErr instanceof Error ? rollbackErr.message : 'Rollback failed';
      logger.error('Approve: rollback after conflict failed', { booking_id: bookingId, error: msg });
    }

    const { error: rejectError } = await supabaseAdmin
      .from('booking_requests')
      .update({
        status: BookingStatus.Rejected,
        rejected_at: new Date().toISOString(),
        rejection_reason:
          recheck.reason === 'dates_conflict'
            ? 'Conflict detected during admin approval recheck'
            : 'Availability check failed during admin approval',
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    if (rejectError) {
      logger.error('Approve: failed to mark booking rejected after conflict', {
        booking_id: bookingId,
        error: rejectError.message
      });
    }

    // Release the widget-sourced availability rows so the guest-facing calendar
    // re-opens those nights on the next fetch. Without this, rejected bookings
    // leave stale blocks behind that desync the widget from the admin view.
    await unblockWidgetDates(bookingId);

    const conflictEmail = bookingConflictRejectionEmail({
      guestName: booking.guest_name,
      bookingId,
      locale: booking.locale,
      paymentType: conflictPaymentType
    });
    await sendEmail(booking.guest_email, conflictEmail.subject, conflictEmail.html);

    return res.status(409).json({
      error: 'Availability conflict detected during approval recheck',
      reason: recheck.reason
    });
  }

  const { error: approvedError } = await supabaseAdmin
    .from('booking_requests')
    .update({
      status: BookingStatus.Approved,
      approved_by: userId,
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  if (approvedError) {
    logger.error('Approve: failed to flip booking to approved', {
      booking_id: bookingId,
      error: approvedError.message
    });
    return res.status(500).json({ error: 'Failed to approve booking' });
  }

  try {
    await capturePaymentForBooking(bookingId);
  } catch (captureErr: unknown) {
    const msg = captureErr instanceof Error ? captureErr.message : 'Capture failed';
    logger.error('Approve: capture failed after approval flip', {
      booking_id: bookingId,
      error: msg
    });

    // Revert booking state so the row does not sit in an inconsistent state
    // while the admin retries.
    await supabaseAdmin
      .from('booking_requests')
      .update({
        status: BookingStatus.Pending,
        approved_at: null,
        approved_by: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', bookingId);

    return res.status(502).json({ error: `Payment capture failed: ${msg}` });
  }

  // Prefer the rich payment-confirmed email when we have the data to render
  // it; fall back to the generic approved email for legacy bookings that did
  // not record an approval path.
  const { data: payment } = await supabaseAdmin
    .from('payments')
    .select('payment_status')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (payment?.payment_status === PaymentStatus.Completed) {
    const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
    const confirmed = paymentConfirmedEmail({
      guestName: booking.guest_name,
      unitName: unit.name ?? 'Park Lofts',
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      totalUsd: Number(booking.total_price_usd),
      nights,
      bookingId,
      locale: booking.locale
    });
    await sendEmail(booking.guest_email, confirmed.subject, confirmed.html);

    // Manual-path booking just confirmed: alert opted-in admins.
    notifyAdminsNewBooking({
      bookingId,
      guestName: booking.guest_name,
      guestEmail: booking.guest_email,
      unitName: unit.name ?? 'Park Lofts',
      checkIn: booking.check_in_date,
      checkOut: booking.check_out_date,
      nights,
      totalUsd: Number(booking.total_price_usd),
      approvalPath: 'manual',
      dashboardUrl: env.ADMIN_DASHBOARD_URL,
    }).catch((err: unknown) => {
      logger.error('Manual-path approve: admin notification fanout failed', {
        error: err instanceof Error ? err.message : 'unknown',
        booking_id: bookingId,
      });
    });
  } else {
    const approvedEmail = bookingApprovedEmail({ guestName: booking.guest_name, bookingId, locale: booking.locale });
    await sendEmail(booking.guest_email, approvedEmail.subject, approvedEmail.html);
  }

  return res.json({ success: true, approval_path: booking.approval_path ?? null });
});

const rejectSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ rejection_reason: z.string().min(2).max(1000) })
});

router.post('/booking-requests/:id/reject', validate(rejectSchema), async (req, res) => {
  const bookingId = req.params.id;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, guest_email, guest_name, status, locale, unit_id, check_in_date, check_out_date')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if (booking.status !== BookingStatus.Pending) {
    return res.status(400).json({ error: 'Booking is not pending' });
  }

  const { error: updateError } = await supabaseAdmin
    .from('booking_requests')
    .update({
      status: BookingStatus.Rejected,
      rejected_at: new Date().toISOString(),
      rejection_reason: req.body.rejection_reason,
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId);

  if (updateError) {
    logger.error('Failed to reject booking', { error: updateError.message });
    return res.status(500).json({ error: 'Failed to reject booking' });
  }

  // Release the widget-sourced availability rows so the guest-facing calendar
  // re-opens those nights on the next fetch. Without this, rejected bookings
  // leave stale blocks behind that desync the widget from the admin view.
  await unblockWidgetDates(bookingId);

  // Capture the pre-rollback payment status so the guest email can explain
  // exactly what to expect on their statement (captured refund vs released
  // hold). Read before rollback because the row flips to 'refunded' after.
  const { data: preRollbackPayment } = await supabaseAdmin
    .from('payments')
    .select('payment_status')
    .eq('booking_id', bookingId)
    .in('payment_status', [
      PaymentStatus.Pending,
      PaymentStatus.Preauthorized,
      PaymentStatus.Completed
    ])
    .maybeSingle();
  const rejectPaymentType: 'preauthorized' | 'completed' | null =
    preRollbackPayment?.payment_status === PaymentStatus.Completed
      ? 'completed'
      : preRollbackPayment?.payment_status === PaymentStatus.Preauthorized
        ? 'preauthorized'
        : null;

  try {
    await rollbackPayment(bookingId);
  } catch (rollbackErr: unknown) {
    const msg = rollbackErr instanceof Error ? rollbackErr.message : 'Rollback failed';
    logger.warn('Payment rollback on reject failed (non-blocking)', { error: msg, bookingId });
  }

  const rejectedEmail = bookingRejectedEmail({
    guestName: booking.guest_name,
    reason: req.body.rejection_reason,
    bookingId,
    locale: booking.locale,
    paymentType: rejectPaymentType
  });
  await sendEmail(booking.guest_email, rejectedEmail.subject, rejectedEmail.html);

  return res.json({ success: true });
});

router.post('/booking-requests/:id/cancel', async (req, res) => {
  const bookingId = req.params.id;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, status, unit_id, check_in_date, check_out_date')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const cancellable = [BookingStatus.Pending, BookingStatus.Approved, BookingStatus.Paid];
  if (!cancellable.includes(booking.status as BookingStatus)) {
    return res.status(400).json({ error: `Cannot cancel a booking with status '${booking.status}'` });
  }

  const { error: updateError } = await supabaseAdmin
    .from('booking_requests')
    .update({ status: BookingStatus.Cancelled, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (updateError) {
    logger.error('Failed to cancel booking', { error: updateError.message });
    return res.status(500).json({ error: 'Failed to cancel booking' });
  }

  await unblockWidgetDates(bookingId);

  if ([BookingStatus.Pending, BookingStatus.Approved].includes(booking.status as BookingStatus)) {
    try {
      await rollbackPayment(bookingId);
    } catch (rollbackErr: unknown) {
      const msg = rollbackErr instanceof Error ? rollbackErr.message : 'Rollback failed';
      logger.warn('Payment rollback on cancel failed (non-blocking)', { error: msg, bookingId });
    }
  }

  return res.json({ success: true });
});

router.post('/booking-requests/:id/check-in', async (req, res) => {
  const bookingId = req.params.id;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const checkinable = [BookingStatus.Approved, BookingStatus.Paid];
  if (!checkinable.includes(booking.status as BookingStatus)) {
    return res.status(400).json({ error: `Cannot check in a booking with status '${booking.status}'` });
  }

  const { error: updateError } = await supabaseAdmin
    .from('booking_requests')
    .update({ status: BookingStatus.CheckedIn, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (updateError) {
    logger.error('Failed to check in booking', { error: updateError.message });
    return res.status(500).json({ error: 'Failed to check in booking' });
  }

  return res.json({ success: true });
});

router.post('/booking-requests/:id/check-out', async (req, res) => {
  const bookingId = req.params.id;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, status')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  if ((booking.status as BookingStatus) !== BookingStatus.CheckedIn) {
    return res.status(400).json({ error: `Cannot check out a booking with status '${booking.status}'` });
  }

  const { error: updateError } = await supabaseAdmin
    .from('booking_requests')
    .update({ status: BookingStatus.CheckedOut, updated_at: new Date().toISOString() })
    .eq('id', bookingId);

  if (updateError) {
    logger.error('Failed to check out booking', { error: updateError.message });
    return res.status(500).json({ error: 'Failed to check out booking' });
  }

  return res.json({ success: true });
});

router.post('/units/photos/upload', upload.array('photos', 10), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const uploaded = [] as { publicId: string; secureUrl: string }[];
    for (const file of files) {
      const extension = file.originalname.split('.').pop() || 'jpg';
      const path = `units/${uuidv4()}.${extension}`;
      const { error } = await supabaseAdmin.storage
        .from(env.SUPABASE_STORAGE_BUCKET)
        .upload(path, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) {
        logger.error('Failed to upload unit photo', { error: error.message });
        return res.status(500).json({ error: error.message });
      }

      const { data } = supabaseAdmin.storage
        .from(env.SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(path);

      uploaded.push({ publicId: path, secureUrl: data.publicUrl });
    }

    return res.json({ data: uploaded });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    logger.error('Failed to upload unit photos', { error: message });
    return res.status(500).json({ error: message });
  }
});
const unitSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    description: z.string().max(5000).optional(),
    nightly_rate_usd: z.number().positive(),
    max_guests: z.number().int().positive().default(2),
    bedrooms: z.number().int().positive().optional(),
    beds: z.number().int().positive().optional(),
    bathrooms: z.number().int().min(0).optional().nullable(),
    airbnb_listing_url: z.string().url().optional(),
    airbnb_ical_url: z.string().url(),
    image_urls: z.array(z.string().url()).min(5, 'At least 5 images are required').optional(),
    status: z.enum(['active', 'inactive']).optional(),
    neighborhood: z.string().max(200).optional().nullable(),
    street_address: z.string().max(300).optional().nullable(),
    city: z.string().max(200).optional().nullable(),
    state: z.string().max(200).optional().nullable(),
    country: z.string().max(200).optional().nullable(),
    postal_code: z.string().max(50).optional().nullable(),
    latitude: z.number().min(-90).max(90).optional().nullable(),
    longitude: z.number().min(-180).max(180).optional().nullable(),
    google_maps_url: z.string().url().optional().nullable()
  }),
  params: z.object({ id: z.string().uuid().optional() })
});

router.post('/units', validate(unitSchema), async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('units')
    .insert(req.body)
    .select('id')
    .single();

  if (error || !data) {
    if (error?.code === '23505' && error?.message?.includes('units_airbnb_ical_url_key')) {
      return res.status(409).json({
        error: 'This Airbnb iCal URL is already linked to another unit. Please use a unique iCal URL.'
      });
    }

    logger.error('Failed to create unit', { error: error?.message, details: error?.details });
    return res.status(500).json({ error: error?.message ?? 'Failed to create unit' });
  }

  return res.json({ unit_id: data.id });
});

router.put('/units/:id', validate(unitSchema), async (req, res) => {
  const unitId = req.params.id;
  const { error } = await supabaseAdmin.from('units').update(req.body).eq('id', unitId);

  if (error) {
    if (error.code === '23505' && error.message?.includes('units_airbnb_ical_url_key')) {
      return res.status(409).json({
        error: 'This Airbnb iCal URL is already linked to another unit. Please use a unique iCal URL.'
      });
    }

    logger.error('Failed to update unit', { error: error.message });
    return res.status(500).json({ error: 'Failed to update unit' });
  }

  return res.json({ success: true });
});

const extractStoragePathFromImageUrl = (imageUrl: string): string | null => {
  if (!imageUrl) return null;

  if (imageUrl.startsWith('units/')) {
    return imageUrl;
  }

  try {
    const decodedUrl = decodeURIComponent(imageUrl);
    const markers = [
      '/object/public/' + env.SUPABASE_STORAGE_BUCKET + '/',
      '/object/sign/' + env.SUPABASE_STORAGE_BUCKET + '/',
      '/object/authenticated/' + env.SUPABASE_STORAGE_BUCKET + '/'
    ];

    for (const marker of markers) {
      const markerIndex = decodedUrl.indexOf(marker);
      if (markerIndex !== -1) {
        return decodedUrl.slice(markerIndex + marker.length);
      }
    }
  } catch {
    logger.warn('Failed to parse image URL for storage deletion', { imageUrl });
  }

  return null;
};
router.delete('/units/:id', async (req, res) => {
  const unitId = req.params.id;

  const { data: unit, error: unitLookupError } = await supabaseAdmin
    .from('units')
    .select('image_urls')
    .eq('id', unitId)
    .single();

  if (unitLookupError || !unit) {
    logger.error('Failed to lookup unit before delete', { error: unitLookupError?.message, unitId });
    return res.status(404).json({ error: 'Unit not found' });
  }

  const { data: bookings, error: bookingLookupError } = await supabaseAdmin
    .from('booking_requests')
    .select('id')
    .eq('unit_id', unitId);

  if (bookingLookupError) {
    logger.error('Failed to lookup unit bookings before delete', { error: bookingLookupError.message, unitId });
    return res.status(500).json({ error: 'Failed to delete unit' });
  }

  const bookingIds = (bookings ?? []).map((booking) => booking.id);
  if (bookingIds.length > 0) {
    const { error: paymentsDeleteError } = await supabaseAdmin
      .from('payments')
      .delete()
      .in('booking_id', bookingIds);

    if (paymentsDeleteError) {
      logger.error('Failed to delete unit payment records', { error: paymentsDeleteError.message, unitId });
      return res.status(500).json({ error: 'Failed to delete unit' });
    }
  }

  const { error: bookingDeleteError } = await supabaseAdmin
    .from('booking_requests')
    .delete()
    .eq('unit_id', unitId);

  if (bookingDeleteError) {
    logger.error('Failed to delete unit booking requests', { error: bookingDeleteError.message, unitId });
    return res.status(500).json({ error: 'Failed to delete unit' });
  }

  const { error: syncLogsDeleteError } = await supabaseAdmin
    .from('sync_logs')
    .delete()
    .eq('unit_id', unitId);

  if (syncLogsDeleteError) {
    logger.error('Failed to delete unit sync logs', { error: syncLogsDeleteError.message, unitId });
    return res.status(500).json({ error: 'Failed to delete unit' });
  }

  const imageUrls = Array.isArray(unit.image_urls)
    ? unit.image_urls.filter((value): value is string => typeof value === 'string')
    : [];
  const storagePaths: string[] = Array.from(
    new Set(
      imageUrls
        .map((imageUrl: string) => extractStoragePathFromImageUrl(imageUrl))
        .filter((path: string | null): path is string => Boolean(path))
    )
  );

  if (storagePaths.length > 0) {
    const { error: storageDeleteError } = await supabaseAdmin.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .remove(storagePaths);

    if (storageDeleteError) {
      logger.error('Failed to delete unit images from storage', {
        error: storageDeleteError.message,
        unitId,
        storagePaths
      });
      return res.status(500).json({ error: 'Failed to delete unit images' });
    }
  }

  const { error } = await supabaseAdmin.from('units').delete().eq('id', unitId);
  if (error) {
    logger.error('Failed to delete unit', { error: error.message, unitId });
    return res.status(500).json({ error: 'Failed to delete unit' });
  }

  return res.json({ success: true });
});

const manualSyncSchema = z.object({
  body: z.object({
    unit_id: z.string().uuid().optional()
  })
});

router.post('/sync/manual', manualSyncRateLimit, validate(manualSyncSchema), async (req, res) => {
  try {
    if (req.body.unit_id) {
      const { data: unit, error } = await supabaseAdmin
        .from('units')
        .select('id, airbnb_ical_url')
        .eq('id', req.body.unit_id)
        .single();

      if (error || !unit) {
        return res.status(404).json({ error: 'Unit not found' });
      }

      await syncUnit(unit.id, unit.airbnb_ical_url);
    } else {
      await syncAllUnits();
    }

    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Manual sync failed';
    return res.status(500).json({ error: message });
  }
});

// ============================================================================
// GET /admin/sync/unit-status
// Per-unit snapshot used by the Sync Center: last_synced_at, stagger slot,
// whether a body hash has been cached, and a hit-rate summary of the last
// N sync_log entries per unit. Designed so the UI does not need to join
// units + sync_logs on the client.
// ============================================================================
router.get('/sync/unit-status', async (_req, res) => {
  const { data: units, error: unitsError } = await supabaseAdmin
    .from('units')
    .select('id, name, airbnb_ical_url, status, sync_offset_minutes, last_synced_at, ical_body_hash, ical_last_etag')
    .order('name', { ascending: true });

  if (unitsError) {
    logger.error('GET /admin/sync/unit-status: units fetch failed', { error: unitsError.message });
    return res.status(500).json({ error: 'Failed to fetch unit sync status' });
  }

  // Pull the last 50 log rows per unit in one query, fan-out-then-filter style.
  // 50 rows x 50 units is 2.5k rows max, trivial.
  const WINDOW = 50;
  const { data: recentLogs, error: logsError } = await supabaseAdmin
    .from('sync_logs')
    .select('unit_id, sync_status, sync_completed_at, etag_hit, body_hash_hit, rows_inserted, rows_deleted')
    .order('sync_started_at', { ascending: false })
    .limit(WINDOW * Math.max(1, units?.length ?? 1));

  if (logsError) {
    logger.error('GET /admin/sync/unit-status: logs fetch failed', { error: logsError.message });
    return res.status(500).json({ error: 'Failed to fetch unit sync status' });
  }

  const statsByUnit = new Map<string, {
    total: number;
    success: number;
    failed: number;
    noChange: number;
    etagHits: number;
    hashHits: number;
    lastStatus: string | null;
    lastCompletedAt: string | null;
    lastInserted: number;
    lastDeleted: number;
  }>();

  for (const log of recentLogs ?? []) {
    if (!log.unit_id) continue;
    const acc = statsByUnit.get(log.unit_id) ?? {
      total: 0,
      success: 0,
      failed: 0,
      noChange: 0,
      etagHits: 0,
      hashHits: 0,
      lastStatus: null as string | null,
      lastCompletedAt: null as string | null,
      lastInserted: 0,
      lastDeleted: 0
    };

    acc.total += 1;
    if (log.sync_status === 'success') acc.success += 1;
    else if (log.sync_status === 'failed') acc.failed += 1;
    else if (log.sync_status === 'no_change') acc.noChange += 1;
    if (log.etag_hit === true) acc.etagHits += 1;
    if (log.body_hash_hit === true) acc.hashHits += 1;

    // Logs are ordered desc; the first seen per unit is the most recent.
    if (acc.lastStatus === null) {
      acc.lastStatus = String(log.sync_status ?? '');
      acc.lastCompletedAt = log.sync_completed_at ?? null;
      acc.lastInserted = Number(log.rows_inserted ?? 0);
      acc.lastDeleted = Number(log.rows_deleted ?? 0);
    }

    statsByUnit.set(log.unit_id, acc);
  }

  const rows = (units ?? []).map((u) => {
    const s = statsByUnit.get(u.id) ?? null;
    const samples = s?.total ?? 0;
    return {
      unit_id: u.id,
      name: u.name,
      ical_url: u.airbnb_ical_url,
      status: u.status,
      sync_offset_minutes: u.sync_offset_minutes,
      last_synced_at: u.last_synced_at,
      has_body_hash: Boolean(u.ical_body_hash),
      has_etag: Boolean(u.ical_last_etag),
      last_status: s?.lastStatus ?? null,
      last_completed_at: s?.lastCompletedAt ?? null,
      last_rows_inserted: s?.lastInserted ?? 0,
      last_rows_deleted: s?.lastDeleted ?? 0,
      recent: {
        samples,
        success: s?.success ?? 0,
        failed: s?.failed ?? 0,
        no_change: s?.noChange ?? 0,
        etag_hit_rate: samples > 0 ? (s?.etagHits ?? 0) / samples : 0,
        hash_hit_rate: samples > 0 ? (s?.hashHits ?? 0) / samples : 0
      }
    };
  });

  return res.json(rows);
});

router.get('/sync-logs', async (req, res) => {
  const unitId = req.query.unit_id as string | undefined;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  let query = supabaseAdmin
    .from('sync_logs')
    .select('*')
    .order('sync_started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (unitId) {
    query = query.eq('unit_id', unitId);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to fetch sync logs', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch sync logs' });
  }

  return res.json(data ?? []);
});

// ============================================================================
// GET /admin/ops-overview
//
// Operational snapshot for the sticky block above /bookings. Returns the four
// mobile-first widgets in a single call so the UI does not fan out to three
// endpoints on mount:
//
//   1. upcoming_checkins   next 7 Asuncion days, widget + airbnb unified
//   2. upcoming_checkouts  next 7 Asuncion days, widget + airbnb unified
//   3. turnover_today      units that have a check-out AND a check-in today
//   4. vacant_now          units with no occupancy for today
//
// Every row carries the minimum needed to render: unit name, guest display
// label, date, and (for airbnb rows) an availability_id so the UI can open
// the alias editor. We deliberately do not ship guest_email or guest_phone
// here; the expanded list card is where full details live.
//
// Timezone: all date math is string-based against todayInAsuncion() to avoid
// UTC drift at 21:00 local. A check-in on 2026-05-10 is 2026-05-10 in
// Asuncion, always.
// ============================================================================
router.get('/ops-overview', async (_req, res) => {
  const todayStr = todayInAsuncion();
  const horizonStr = addDaysStrUtil(todayStr, 7);

  // Pull everything we need in parallel. Scope widget + airbnb rows to the
  // window so we do not pull months of data every request. Units are pulled
  // once because the vacant widget needs the active set.
  const [bookingsRes, blocksRes, unitsRes] = await Promise.all([
    supabaseAdmin
      .from('booking_requests')
      .select('id, unit_id, guest_name, check_in_date, check_out_date, status, units(name)')
      .in('status', ['approved', 'paid', 'checked_in'])
      .or(`and(check_in_date.gte.${todayStr},check_in_date.lte.${horizonStr}),and(check_out_date.gte.${todayStr},check_out_date.lte.${horizonStr})`)
      .order('check_in_date', { ascending: true }),
    supabaseAdmin
      .from('availability')
      .select('id, unit_id, blocked_date, source, external_kind, external_ref, guest_last4, guest_alias, units(name)')
      .eq('source', 'airbnb')
      .gte('blocked_date', addDaysStrUtil(todayStr, -1))
      .lte('blocked_date', horizonStr)
      .order('blocked_date', { ascending: true }),
    supabaseAdmin.from('units').select('id, name, status').eq('status', 'active').order('name', { ascending: true })
  ]);

  if (bookingsRes.error) {
    logger.error('ops-overview: bookings fetch failed', { error: bookingsRes.error.message });
    return res.status(500).json({ error: 'Failed to load operations overview' });
  }
  if (blocksRes.error) {
    logger.error('ops-overview: availability fetch failed', { error: blocksRes.error.message });
    return res.status(500).json({ error: 'Failed to load operations overview' });
  }
  if (unitsRes.error) {
    logger.error('ops-overview: units fetch failed', { error: unitsRes.error.message });
    return res.status(500).json({ error: 'Failed to load operations overview' });
  }

  interface UnitJoin {
    name?: string | null;
  }
  type BookingRow = {
    id: string;
    unit_id: string;
    guest_name: string;
    check_in_date: string;
    check_out_date: string;
    status: string;
    units?: UnitJoin | null;
  };
  type BlockRow = {
    id: string;
    unit_id: string;
    blocked_date: string;
    source: 'airbnb';
    external_kind: string | null;
    external_ref: string | null;
    guest_last4: string | null;
    guest_alias: string | null;
    units?: UnitJoin | null;
  };
  type UnitRow = { id: string; name: string; status: string };

  const bookings = (bookingsRes.data ?? []) as BookingRow[];
  const blocks = (blocksRes.data ?? []) as BlockRow[];
  const units = (unitsRes.data ?? []) as UnitRow[];

  // Collapse airbnb per-night rows into reservations (first night = check-in,
  // last night + 1 = check-out). Group by unit_id + external_ref + external_kind
  // to mirror the calendar's grouping.
  type AirbnbReservation = {
    unit_id: string;
    unit_name: string;
    external_ref: string | null;
    external_kind: string | null;
    check_in: string;
    check_out: string;
    guest_alias: string | null;
    guest_last4: string | null;
    first_night_id: string;
  };

  const groups = new Map<string, BlockRow[]>();
  for (const b of blocks) {
    const key = `${b.unit_id}::${b.external_ref ?? 'none'}::${b.external_kind ?? 'none'}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }

  const airbnbReservations: AirbnbReservation[] = [];
  for (const rows of groups.values()) {
    rows.sort((a, b) => a.blocked_date.localeCompare(b.blocked_date));
    // Split on gaps larger than 1 day, so a cancelled-then-rebooked range
    // (same external_ref, different window) renders as two reservations.
    let runStart = rows[0].blocked_date;
    let prev = runStart;
    let firstNight = rows[0];
    const emit = (end: string, first: BlockRow) => {
      airbnbReservations.push({
        unit_id: first.unit_id,
        unit_name: first.units?.name ?? 'Unit',
        external_ref: first.external_ref,
        external_kind: first.external_kind,
        check_in: runStart,
        check_out: addDaysStrUtil(end, 1),
        guest_alias: first.guest_alias,
        guest_last4: first.guest_last4,
        first_night_id: first.id
      });
    };
    for (let i = 1; i < rows.length; i++) {
      const curr = rows[i].blocked_date;
      const gapMs = new Date(curr).getTime() - new Date(prev).getTime();
      if (gapMs > 86_400_000) {
        emit(prev, firstNight);
        runStart = curr;
        firstNight = rows[i];
      }
      prev = curr;
    }
    emit(prev, firstNight);
  }

  // Only reservations (real guests) belong in check-in/out/turnover widgets.
  // Airbnb "not_available" / "blocked" hold ranges should not surface as
  // guest events.
  const airbnbGuestStays = airbnbReservations.filter((r) => r.external_kind === 'reserved');

  type Event = {
    date: string;
    unit_id: string;
    unit_name: string;
    guest_label: string;
    source: 'widget' | 'airbnb';
    availability_id: string | null;
    booking_id: string | null;
  };

  const labelForAirbnb = (r: AirbnbReservation): string => {
    if (r.guest_alias) return r.guest_alias;
    if (r.guest_last4) return `**** ${r.guest_last4}`;
    return 'Airbnb';
  };

  const checkins: Event[] = [];
  const checkouts: Event[] = [];

  for (const b of bookings) {
    if (b.check_in_date >= todayStr && b.check_in_date <= horizonStr) {
      checkins.push({
        date: b.check_in_date,
        unit_id: b.unit_id,
        unit_name: b.units?.name ?? 'Unit',
        guest_label: b.guest_name,
        source: 'widget',
        availability_id: null,
        booking_id: b.id
      });
    }
    if (b.check_out_date >= todayStr && b.check_out_date <= horizonStr) {
      checkouts.push({
        date: b.check_out_date,
        unit_id: b.unit_id,
        unit_name: b.units?.name ?? 'Unit',
        guest_label: b.guest_name,
        source: 'widget',
        availability_id: null,
        booking_id: b.id
      });
    }
  }
  for (const r of airbnbGuestStays) {
    if (r.check_in >= todayStr && r.check_in <= horizonStr) {
      checkins.push({
        date: r.check_in,
        unit_id: r.unit_id,
        unit_name: r.unit_name,
        guest_label: labelForAirbnb(r),
        source: 'airbnb',
        availability_id: r.first_night_id,
        booking_id: null
      });
    }
    if (r.check_out >= todayStr && r.check_out <= horizonStr) {
      checkouts.push({
        date: r.check_out,
        unit_id: r.unit_id,
        unit_name: r.unit_name,
        guest_label: labelForAirbnb(r),
        source: 'airbnb',
        availability_id: r.first_night_id,
        booking_id: null
      });
    }
  }

  checkins.sort((a, b) => a.date.localeCompare(b.date) || a.unit_name.localeCompare(b.unit_name));
  checkouts.sort((a, b) => a.date.localeCompare(b.date) || a.unit_name.localeCompare(b.unit_name));

  // Turnover: a unit has both a check-out and a check-in today.
  const checkoutsToday = new Map<string, Event>();
  for (const e of checkouts) if (e.date === todayStr) checkoutsToday.set(e.unit_id, e);
  const checkinsToday = new Map<string, Event>();
  for (const e of checkins) if (e.date === todayStr) checkinsToday.set(e.unit_id, e);
  const turnoverUnits: Array<{
    unit_id: string;
    unit_name: string;
    outgoing: Event;
    incoming: Event;
  }> = [];
  for (const [unitId, outgoing] of checkoutsToday) {
    const incoming = checkinsToday.get(unitId);
    if (incoming) {
      turnoverUnits.push({
        unit_id: unitId,
        unit_name: outgoing.unit_name,
        outgoing,
        incoming
      });
    }
  }

  // Vacant now: active unit with no occupancy covering today. Occupancy =
  // widget booking where today is in [check_in, check_out) OR airbnb row
  // with blocked_date = today.
  const occupiedToday = new Set<string>();
  for (const b of bookings) {
    if (b.check_in_date <= todayStr && todayStr < b.check_out_date) {
      occupiedToday.add(b.unit_id);
    }
  }
  for (const block of blocks) {
    if (block.blocked_date === todayStr) occupiedToday.add(block.unit_id);
  }
  const vacantNow = units
    .filter((u) => !occupiedToday.has(u.id))
    .map((u) => ({ unit_id: u.id, unit_name: u.name }));

  return res.json({
    today: todayStr,
    horizon: horizonStr,
    upcoming_checkins: checkins,
    upcoming_checkouts: checkouts,
    turnover_today: turnoverUnits,
    vacant_now: vacantNow
  });
});

router.get('/dashboard-stats', async (req, res) => {
  // Timezone note: the app operates in Paraguay (UTC-3). "Today" is Asuncion
  // today (see todayInAsuncion). All date math here is string-based
  // (YYYY-MM-DD) to avoid the `new Date('YYYY-MM-DD')`-parses-as-UTC pitfall.
  // Row cap is set explicitly because PostgREST's default max-rows may
  // silently truncate large windows; 20k covers ~50 units x 365 days x margin.
  const MAX_ROWS = 20000;

  const rangeParam = (req.query.range as string | undefined)?.toLowerCase();
  type Range = '7d' | '1m' | '6m' | '1y';
  const range: Range =
    rangeParam === '7d' || rangeParam === '1m' || rangeParam === '6m' || rangeParam === '1y'
      ? rangeParam
      : '1y';

  const todayStr = todayInAsuncion();
  const addDaysStr = addDaysStrUtil;
  const monthKeyFromStr = (ymd: string): string => {
    // key is `YYYY-MIndex` where MIndex is 0..11
    const [y, m] = ymd.split('-').map(Number);
    return `${y}-${m - 1}`;
  };
  const dowFromStr = (ymd: string): number => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  };

  // Determine window shape per range. Daily buckets for short ranges, monthly
  // for long. The cards (this month / prev month revenue) always reflect
  // calendar months regardless of the chart range.
  const bucket: 'day' | 'month' = range === '7d' || range === '1m' ? 'day' : 'month';
  const dailyPoints = range === '7d' ? 7 : 30;
  const monthlyPoints = range === '6m' ? 6 : 12;

  // Window start anchored to Asuncion. For daily buckets we look back
  // dailyPoints days INCLUDING today. For monthly buckets we look back
  // (monthlyPoints - 1) months and snap to the 1st of that month.
  const [curYearStr, curMonthStr] = todayStr.split('-');
  const curYear = Number(curYearStr);
  const curMonth = Number(curMonthStr); // 1..12

  let windowStartStr: string;
  if (bucket === 'day') {
    windowStartStr = addDaysStr(todayStr, -(dailyPoints - 1));
  } else {
    // Start of the month N months before, in Asuncion calendar terms.
    const startMonthIdx = curMonth - monthlyPoints; // 1-based minus count → zero-based before
    const startY = curYear + Math.floor((startMonthIdx) / 12);
    const startM = ((startMonthIdx % 12) + 12) % 12; // 0..11
    windowStartStr = `${startY}-${String(startM + 1).padStart(2, '0')}-01`;
  }

  // Payments are filtered by created_at (full timestamptz). We compute the
  // Asuncion-midnight of windowStartStr in UTC so the .gte does not miss
  // events that happened early on day one.
  const windowStartUtc = (() => {
    const [y, m, d] = windowStartStr.split('-').map(Number);
    // Asuncion is UTC-3 year-round (no DST). Midnight in Asuncion equals 03:00 UTC.
    return new Date(Date.UTC(y, m - 1, d, 3, 0, 0)).toISOString();
  })();

  const [paymentsResult, airbnbMonthlyResult] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('amount_usd, created_at')
      .eq('payment_status', PaymentStatus.Completed)
      .gte('created_at', windowStartUtc)
      .limit(MAX_ROWS),
    supabaseAdmin
      .from('availability')
      .select('blocked_date, unit_id, units(nightly_rate_usd)')
      .eq('source', 'airbnb')
      .gte('blocked_date', windowStartStr)
      .limit(MAX_ROWS)
  ]);

  if (paymentsResult.error) {
    logger.error('dashboard-stats: failed to fetch payments', { error: paymentsResult.error.message });
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
  if (airbnbMonthlyResult.error) {
    logger.error('dashboard-stats: failed to fetch airbnb monthly blocks', { error: airbnbMonthlyResult.error.message });
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
  if ((paymentsResult.data?.length ?? 0) >= MAX_ROWS) {
    logger.warn('dashboard-stats: payments row cap hit, figures may be truncated', { cap: MAX_ROWS });
  }
  if ((airbnbMonthlyResult.data?.length ?? 0) >= MAX_ROWS) {
    logger.warn('dashboard-stats: airbnb blocks row cap hit, estimate may be truncated', { cap: MAX_ROWS });
  }

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Precompute the ordered bucket keys for the active range.
  const orderedKeys: string[] = [];
  const keyNames: Record<string, string> = {};
  const directByKey: Record<string, number> = {};
  const airbnbByKey: Record<string, number> = {};

  if (bucket === 'day') {
    for (let i = 0; i < dailyPoints; i++) {
      const ymd = addDaysStr(windowStartStr, i);
      orderedKeys.push(ymd);
      directByKey[ymd] = 0;
      airbnbByKey[ymd] = 0;
      // Label with day-of-month for short ranges; dow + day for 7d.
      const [, m, d] = ymd.split('-').map(Number);
      keyNames[ymd] = range === '7d' ? `${MONTH_NAMES[m - 1]} ${d}` : `${d}`;
    }
  } else {
    for (let i = 0; i < monthlyPoints; i++) {
      const idx = curMonth - 1 - (monthlyPoints - 1 - i); // 0..11 shifted
      const y = curYear + Math.floor(idx / 12);
      const m = ((idx % 12) + 12) % 12; // 0..11
      const key = `${y}-${m}`;
      orderedKeys.push(key);
      directByKey[key] = 0;
      airbnbByKey[key] = 0;
      keyNames[key] = MONTH_NAMES[m];
    }
  }

  // --- Month-level maps for the current / prev month cards (independent of range) ---
  // The cards always reflect the calendar month in Asuncion, not the chart.
  const currentMonthKey = `${curYear}-${curMonth - 1}`;
  const prevMonthIdx = curMonth - 2; // zero-based previous
  const prevMonthY = curYear + Math.floor(prevMonthIdx / 12);
  const prevMonthM = ((prevMonthIdx % 12) + 12) % 12;
  const prevMonthKey = `${prevMonthY}-${prevMonthM}`;
  const monthlyDirectMap: Record<string, number> = { [currentMonthKey]: 0, [prevMonthKey]: 0 };
  const monthlyAirbnbMap: Record<string, number> = { [currentMonthKey]: 0, [prevMonthKey]: 0 };

  let thisMonthDirectBookingCount = 0;
  let thisMonthAirbnbNights = 0;
  let thisMonthAirbnbMinRate = Number.POSITIVE_INFINITY;
  let thisMonthAirbnbMaxRate = 0;

  // Payments: bucket both into the chart's active bucket and into the
  // month-level card buckets. created_at is a timestamptz, we convert to
  // Asuncion wall time before bucketing.
  for (const p of paymentsResult.data ?? []) {
    const asuncionDay = asuncionYearMonth(p.created_at) + '-01'; // just for month key
    const asuncionYmd = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Asuncion',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(p.created_at));

    const amount = Number(p.amount_usd ?? 0);

    // Chart bucket.
    const chartKey = bucket === 'day' ? asuncionYmd : (() => {
      const [y, m] = asuncionDay.split('-').map(Number);
      return `${y}-${m - 1}`;
    })();
    if (chartKey in directByKey) directByKey[chartKey] += amount;

    // Month cards.
    const [y, m] = asuncionDay.split('-').map(Number);
    const monthKey = `${y}-${m - 1}`;
    if (monthKey in monthlyDirectMap) monthlyDirectMap[monthKey] += amount;
    if (monthKey === currentMonthKey) thisMonthDirectBookingCount++;
  }

  // Airbnb blocks: rate times nights, bucketed. blocked_date is a date, not a
  // timestamp, so it is already in a TZ-free form.
  for (const block of airbnbMonthlyResult.data ?? []) {
    const rate = Number((block.units as { nightly_rate_usd?: number } | null)?.nightly_rate_usd ?? 0);
    const ymd: string = block.blocked_date;

    // Chart bucket.
    const chartKey = bucket === 'day' ? ymd : monthKeyFromStr(ymd);
    if (chartKey in airbnbByKey) airbnbByKey[chartKey] += rate;

    // Month cards.
    const monthKey = monthKeyFromStr(ymd);
    if (monthKey in monthlyAirbnbMap) monthlyAirbnbMap[monthKey] += rate;
    if (monthKey === currentMonthKey) {
      thisMonthAirbnbNights++;
      if (rate > 0) {
        if (rate < thisMonthAirbnbMinRate) thisMonthAirbnbMinRate = rate;
        if (rate > thisMonthAirbnbMaxRate) thisMonthAirbnbMaxRate = rate;
      }
    }
  }

  if (!Number.isFinite(thisMonthAirbnbMinRate)) thisMonthAirbnbMinRate = 0;

  // Serialize the active chart series. `revenue` is kept alongside `direct`
  // so the existing recharts config (dataKey="revenue") keeps working.
  const series = orderedKeys.map((key) => ({
    name: keyNames[key],
    revenue: Math.round(directByKey[key] ?? 0),
    airbnbEstimate: Math.round(airbnbByKey[key] ?? 0),
    bucket
  }));

  // Back-compat: `monthlyRevenue` remains the 12-month series regardless of
  // the active range. Older clients (PDF export, etc.) still read it.
  const backCompatKeys: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = curMonth - 1 - (11 - i);
    const y = curYear + Math.floor(idx / 12);
    const m = ((idx % 12) + 12) % 12;
    backCompatKeys.push(`${y}-${m}`);
  }
  const backCompatDirect: Record<string, number> = Object.fromEntries(backCompatKeys.map((k) => [k, 0]));
  const backCompatAirbnb: Record<string, number> = Object.fromEntries(backCompatKeys.map((k) => [k, 0]));
  for (const p of paymentsResult.data ?? []) {
    const [y, m] = asuncionYearMonth(p.created_at).split('-').map(Number);
    const key = `${y}-${m - 1}`;
    if (key in backCompatDirect) backCompatDirect[key] += Number(p.amount_usd ?? 0);
  }
  for (const block of airbnbMonthlyResult.data ?? []) {
    const key = monthKeyFromStr(block.blocked_date);
    if (key in backCompatAirbnb) {
      const rate = Number((block.units as { nightly_rate_usd?: number } | null)?.nightly_rate_usd ?? 0);
      backCompatAirbnb[key] += rate;
    }
  }
  const monthlyRevenue = backCompatKeys.map((key) => {
    const monthIdx = Number(key.split('-')[1]);
    return {
      name: MONTH_NAMES[monthIdx],
      revenue: Math.round(backCompatDirect[key] ?? 0),
      airbnbEstimate: Math.round(backCompatAirbnb[key] ?? 0)
    };
  });

  const thisMonthRevenue = Math.round(monthlyDirectMap[currentMonthKey] ?? 0);
  const prevMonthRevenue = Math.round(monthlyDirectMap[prevMonthKey] ?? 0);
  const thisMonthAirbnbEstimate = Math.round(monthlyAirbnbMap[currentMonthKey] ?? 0);
  const prevMonthAirbnbEstimate = Math.round(monthlyAirbnbMap[prevMonthKey] ?? 0);

  // --- weekly occupancy (last 28 days, includes Airbnb blocks) ---
  const fourWeeksAgoStr = addDaysStr(todayStr, -28);

  const [bookingsResult, unitsResult, airbnbOccupancyResult] = await Promise.all([
    supabaseAdmin
      .from('booking_requests')
      .select('check_in_date, check_out_date')
      .in('status', [BookingStatus.Approved, BookingStatus.Paid, BookingStatus.CheckedIn, BookingStatus.CheckedOut])
      .lte('check_in_date', todayStr)
      .gte('check_out_date', fourWeeksAgoStr)
      .limit(MAX_ROWS),
    supabaseAdmin
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('status', UnitStatus.Active),
    supabaseAdmin
      .from('availability')
      .select('unit_id, blocked_date')
      .eq('source', 'airbnb')
      .gte('blocked_date', fourWeeksAgoStr)
      .lte('blocked_date', todayStr)
      .limit(MAX_ROWS)
  ]);

  if (bookingsResult.error) {
    logger.error('dashboard-stats: failed to fetch bookings', { error: bookingsResult.error.message });
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
  if (airbnbOccupancyResult.error) {
    logger.error('dashboard-stats: failed to fetch airbnb occupancy', { error: airbnbOccupancyResult.error.message });
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }

  const totalUnits = unitsResult.count ?? 1;

  // Occupied unit-days per day-of-week index (0=Sun..6=Sat).
  // De-dup: a unit-day is at most 1, even if both a direct booking and an Airbnb
  // block cover it. Without this, weekly occupancy could exceed 100% and indicate
  // a sync inconsistency (which we log, not hide).
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  const occupiedSet = new Set<string>(); // `${unit_id}|${ymd}` when known, else `__airbnb|${ymd}|${n}`
  let doubleCountHits = 0;

  // Build totals from dates in range.
  for (let i = 0; i < 28; i++) {
    const ymd = addDaysStr(fourWeeksAgoStr, i);
    if (ymd <= todayStr) dayTotals[dowFromStr(ymd)] += totalUnits;
  }

  // Direct bookings: iterate days in range [check_in, check_out) using string math.
  for (const booking of bookingsResult.data ?? []) {
    const inStr: string = booking.check_in_date;
    const outStr: string = booking.check_out_date;
    let cursor = inStr < fourWeeksAgoStr ? fourWeeksAgoStr : inStr;
    const end = outStr > todayStr ? addDaysStr(todayStr, 1) : outStr;
    while (cursor < end) {
      // We don't have unit_id here (not selected), but direct bookings rarely collide
      // with themselves on the same day. Use a synthetic booking-scoped key.
      const key = `direct|${cursor}|${inStr}|${outStr}`;
      if (!occupiedSet.has(key)) {
        occupiedSet.add(key);
        dayCounts[dowFromStr(cursor)]++;
      }
      cursor = addDaysStr(cursor, 1);
    }
  }

  // Airbnb blocks: key by unit_id + ymd so collisions with direct bookings on the
  // same unit-day can be detected (approximate, since direct keys are booking-scoped).
  for (const block of airbnbOccupancyResult.data ?? []) {
    const ymd: string = block.blocked_date;
    if (ymd < fourWeeksAgoStr || ymd > todayStr) continue;
    const key = `airbnb|${block.unit_id}|${ymd}`;
    if (!occupiedSet.has(key)) {
      occupiedSet.add(key);
      dayCounts[dowFromStr(ymd)]++;
    }
  }

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON_SUN_ORDER = [1, 2, 3, 4, 5, 6, 0];
  const weeklyOccupancy = MON_SUN_ORDER.map((dayIdx) => {
    const raw = dayTotals[dayIdx] > 0 ? (dayCounts[dayIdx] / dayTotals[dayIdx]) * 100 : 0;
    if (raw > 100) {
      doubleCountHits++;
    }
    // Clamp to [0, 100]. Values >100 indicate inventory desync (direct + airbnb on
    // same unit-day) and are logged once below.
    const clamped = Math.min(100, Math.max(0, raw));
    return { name: DAY_NAMES[dayIdx], value: Math.round(clamped) };
  });

  if (doubleCountHits > 0) {
    logger.warn('dashboard-stats: occupancy exceeded 100% on some days (clamped); possible inventory desync', {
      days: doubleCountHits
    });
  }

  const avgOccupancy =
    weeklyOccupancy.length > 0
      ? Math.round(weeklyOccupancy.reduce((a, b) => a + b.value, 0) / weeklyOccupancy.length)
      : 0;

  // --- upcoming Airbnb check-ins (first day of each contiguous block, from today) ---
  const ninetyDaysOutStr = addDaysStr(todayStr, 90);

  const { data: airbnbFutureBlocks, error: futureBlocksError } = await supabaseAdmin
    .from('availability')
    .select('unit_id, blocked_date')
    .eq('source', 'airbnb')
    .gte('blocked_date', todayStr)
    .lte('blocked_date', ninetyDaysOutStr)
    .order('blocked_date', { ascending: true })
    .limit(MAX_ROWS);

  if (futureBlocksError) {
    logger.error('dashboard-stats: failed to fetch airbnb future blocks', { error: futureBlocksError.message });
    return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }

  const blocksByUnit: Record<string, Set<string>> = {};
  for (const block of airbnbFutureBlocks ?? []) {
    if (!blocksByUnit[block.unit_id]) blocksByUnit[block.unit_id] = new Set();
    blocksByUnit[block.unit_id].add(block.blocked_date);
  }

  // A date is a check-in iff the previous calendar day is not blocked for the
  // same unit. String math only, no Date object parsing.
  let airbnbUpcomingCheckins = 0;
  for (const dates of Object.values(blocksByUnit)) {
    for (const dateStr of dates) {
      const prevStr = addDaysStr(dateStr, -1);
      if (!dates.has(prevStr)) airbnbUpcomingCheckins++;
    }
  }

  return res.json({
    range,
    bucket,
    series,
    monthlyRevenue,
    weeklyOccupancy,
    avgOccupancy,
    airbnbUpcomingCheckins,
    thisMonthRevenue,
    prevMonthRevenue,
    thisMonthAirbnbEstimate,
    prevMonthAirbnbEstimate,
    thisMonthDirectBookingCount,
    thisMonthAirbnbNights,
    thisMonthAirbnbMinRate: Math.round(thisMonthAirbnbMinRate),
    thisMonthAirbnbMaxRate: Math.round(thisMonthAirbnbMaxRate)
  });
});

router.get('/payments', async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);

  let query = supabaseAdmin
    .from('payments')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('payment_status', status);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('Failed to fetch payments', { error: error.message });
    return res.status(500).json({ error: 'Failed to fetch payments' });
  }

  return res.json(data ?? []);
});

// ============================================================================
// Admin user management
//
// Every endpoint in this section requires role === 'admin' on top of the
// router-wide requireAuth. Staff accounts and authenticated non-admin users
// receive 403. The middleware also blocks inactive accounts so a deactivated
// admin cannot keep mutating the team after their own row was flipped.
// ============================================================================

const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200),
    email: z.string().trim().toLowerCase().email().max(320),
    role: z.enum(['admin', 'staff']),
  }),
});

const updateUserSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(200).optional(),
    role: z.enum(['admin', 'staff']).optional(),
    status: z.enum(['active', 'inactive']).optional(),
    notify_new_booking: z.boolean().optional(),
  }).refine((b) => Object.keys(b).length > 0, { message: 'No fields provided' }),
});

const userIdSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

const setPasswordSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(128, 'Password cannot exceed 128 characters')
      .refine((v) => /[A-Za-z]/.test(v) && /[0-9]/.test(v), {
        message: 'Password must include at least one letter and one number',
      }),
  }),
});

router.get('/users', requireAdmin, async (_req, res) => {
  try {
    const users = await adminUserService.list();
    return res.json(users);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch users';
    logger.error('GET /admin/users failed', { error: msg });
    return res.status(500).json({ error: msg });
  }
});

router.post('/users', requireAdmin, validate(createUserSchema), async (req, res) => {
  try {
    const user = await adminUserService.createWithInvite(req.body);
    return res.status(201).json(user);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    const msg = err instanceof Error ? err.message : 'Failed to create user';
    if (code === 'CAP_REACHED') return res.status(409).json({ error: msg });
    if (code === 'CONFLICT') return res.status(409).json({ error: msg });
    logger.error('POST /admin/users failed', { error: msg });
    return res.status(500).json({ error: msg });
  }
});

router.post('/users/:id/reinvite', requireAdmin, validate(userIdSchema), async (req, res) => {
  try {
    const user = await adminUserService.reinvite(req.params.id);
    return res.json(user);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    const msg = err instanceof Error ? err.message : 'Failed to reinvite user';
    if (code === 'NOT_FOUND') return res.status(404).json({ error: msg });
    logger.error('POST /admin/users/:id/reinvite failed', { error: msg, id: req.params.id });
    return res.status(500).json({ error: msg });
  }
});

router.put('/users/:id', requireAdmin, validate(updateUserSchema), async (req, res) => {
  try {
    const user = await adminUserService.update(req.params.id, req.body);
    return res.json(user);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    const msg = err instanceof Error ? err.message : 'Failed to update user';
    if (code === 'NOT_FOUND') return res.status(404).json({ error: msg });
    logger.error('PUT /admin/users/:id failed', { error: msg, id: req.params.id });
    return res.status(500).json({ error: msg });
  }
});

router.post(
  '/users/:id/password',
  requireAdmin,
  adminWriteLimiter,
  validate(setPasswordSchema),
  async (req, res) => {
    try {
      const user = await adminUserService.setPassword(req.params.id, req.body.password);
      return res.json(user);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      const msg = err instanceof Error ? err.message : 'Failed to set password';
      if (code === 'NOT_FOUND') return res.status(404).json({ error: msg });
      if (code === 'PRECONDITION_FAILED') return res.status(400).json({ error: msg });
      logger.error('POST /admin/users/:id/password failed', { error: msg, id: req.params.id });
      return res.status(500).json({ error: msg });
    }
  },
);

// Self-service reset for the currently signed-in user. Only requireAuth here:
// any active admin_users row should be able to reset their own password
// without an admin having to click through the team table. Sends through
// Resend (sendEmail), not Supabase's built-in mailer.
//
// MUST be registered before the /users/:id/send-password-reset variant or
// Express will match "me" as the :id param and fail UUID validation.
router.post(
  '/users/me/send-password-reset',
  adminWriteLimiter,
  async (_req, res) => {
    const sessionUser = res.locals.user as { id?: string } | undefined;
    if (!sessionUser?.id) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const result = await adminUserService.sendSelfPasswordResetEmail(sessionUser.id);
      return res.json({ ok: true, email: result.email });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      const msg = err instanceof Error ? err.message : 'Failed to send reset email';
      if (code === 'NOT_FOUND') return res.status(404).json({ error: msg });
      if (code === 'PRECONDITION_FAILED') return res.status(400).json({ error: msg });
      logger.error('POST /admin/users/me/send-password-reset failed', {
        error: msg,
        authId: sessionUser.id,
      });
      return res.status(500).json({ error: msg });
    }
  },
);

router.post(
  '/users/:id/send-password-reset',
  requireAdmin,
  adminWriteLimiter,
  validate(userIdSchema),
  async (req, res) => {
    try {
      const result = await adminUserService.sendPasswordResetEmail(req.params.id);
      return res.json({ ok: true, email: result.email });
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      const msg = err instanceof Error ? err.message : 'Failed to send reset email';
      if (code === 'NOT_FOUND') return res.status(404).json({ error: msg });
      if (code === 'PRECONDITION_FAILED') return res.status(400).json({ error: msg });
      logger.error('POST /admin/users/:id/send-password-reset failed', { error: msg, id: req.params.id });
      return res.status(500).json({ error: msg });
    }
  },
);

// PATCH /api/admin/users/me/preferences
// Lets any authenticated admin update their own per-user notification prefs.
// No requireAdmin gate: every user manages their own settings.

const mePreferencesSchema = z.object({
  body: z.object({
    notify_new_booking: z.boolean().optional(),
  }).refine((b) => Object.keys(b).length > 0, { message: 'No fields provided' }),
});

router.patch(
  '/users/me/preferences',
  adminWriteLimiter,
  validate(mePreferencesSchema),
  async (req, res) => {
    const sessionUser = res.locals.user as { id?: string } | undefined;
    if (!sessionUser?.id) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body as { notify_new_booking?: boolean };

    try {
      const updated = await adminUserService.updatePreferences(sessionUser.id, {
        notifyNewBooking: body.notify_new_booking,
      });
      return res.json(updated);
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      const msg = err instanceof Error ? err.message : 'Failed to update preferences';
      if (code === 'NOT_FOUND') return res.status(404).json({ error: msg });
      logger.error('PATCH /admin/users/me/preferences failed', { error: msg, authId: sessionUser.id });
      return res.status(500).json({ error: msg });
    }
  },
);

// GET /api/admin/users/me
// Returns the admin_users row for the current session. Used on page load to
// hydrate per-user preferences (e.g. notification settings) without a second
// round-trip to the users list.

router.get('/users/me', async (_req, res) => {
  const sessionUser = res.locals.user as { id?: string } | undefined;
  if (!sessionUser?.id) return res.status(401).json({ error: 'Unauthorized' });

  const me = await adminUserService.getByAuthId(sessionUser.id);
  if (!me) return res.status(404).json({ error: 'Admin user not found for this session' });

  return res.json(me);
});

// ============================================================================
// Per-unit revenue drilldown
// Returns 12 months of direct + Airbnb estimated revenue for one unit, plus
// occupancy, ADR, RevPAR, total bookings, and the latest 10 bookings.
// Mirrors the timezone-safe string-date math used in /dashboard-stats.
// ============================================================================

const unitIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

router.get('/units/:id/stats', validate(unitIdParamSchema), async (req, res) => {
  const unitId = req.params.id;
  const MAX_ROWS = 5000;

  const todayStr = todayInAsuncion();
  const [curYearStr, curMonthStr] = todayStr.split('-');
  const curYear = Number(curYearStr);
  const curMonth = Number(curMonthStr); // 1..12

  const addDaysStr = addDaysStrUtil;
  const monthKeyFromStr = (ymd: string): string => {
    const [y, m] = ymd.split('-').map(Number);
    return `${y}-${m - 1}`;
  };

  // Start of the month 12 months back in Asuncion calendar terms.
  const startMonthIdx = curMonth - 12; // zero-based
  const startY = curYear + Math.floor(startMonthIdx / 12);
  const startM = ((startMonthIdx % 12) + 12) % 12;
  const twelveMonthsAgoStr = `${startY}-${String(startM + 1).padStart(2, '0')}-01`;
  const twelveMonthsAgoUtc = (() => {
    // Asuncion midnight = 03:00 UTC.
    return new Date(Date.UTC(startY, startM, 1, 3, 0, 0)).toISOString();
  })();

  const { data: unit, error: unitError } = await supabaseAdmin
    .from('units')
    .select('id, name, nightly_rate_usd, status')
    .eq('id', unitId)
    .single();

  if (unitError || !unit) {
    logger.warn('unit-stats: unit not found', { unitId, error: unitError?.message });
    return res.status(404).json({ error: 'Unit not found' });
  }

  const [paymentsResult, airbnbResult, bookingsResult, recentResult] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('amount_usd, created_at, booking_requests!inner(unit_id)')
      .eq('payment_status', PaymentStatus.Completed)
      .eq('booking_requests.unit_id', unitId)
      .gte('created_at', twelveMonthsAgoUtc)
      .limit(MAX_ROWS),
    supabaseAdmin
      .from('availability')
      .select('blocked_date')
      .eq('source', 'airbnb')
      .eq('unit_id', unitId)
      .gte('blocked_date', twelveMonthsAgoStr)
      .limit(MAX_ROWS),
    supabaseAdmin
      .from('booking_requests')
      .select('check_in_date, check_out_date, total_price_usd, status')
      .eq('unit_id', unitId)
      .in('status', [
        BookingStatus.Approved,
        BookingStatus.Paid,
        BookingStatus.CheckedIn,
        BookingStatus.CheckedOut
      ])
      .gte('check_out_date', twelveMonthsAgoStr)
      .limit(MAX_ROWS),
    supabaseAdmin
      .from('booking_requests')
      .select('id, guest_name, check_in_date, check_out_date, total_price_usd, status, created_at')
      .eq('unit_id', unitId)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  if (paymentsResult.error || airbnbResult.error || bookingsResult.error || recentResult.error) {
    const errors = [
      paymentsResult.error?.message,
      airbnbResult.error?.message,
      bookingsResult.error?.message,
      recentResult.error?.message
    ].filter(Boolean);
    logger.error('unit-stats: aggregate query failed', { unitId, errors });
    return res.status(500).json({ error: 'Failed to fetch unit stats' });
  }

  const nightlyRate = Number(unit.nightly_rate_usd ?? 0);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const directByMonth: Record<string, number> = {};
  const airbnbByMonth: Record<string, number> = {};
  const occupancyByMonth: Record<string, number> = {};
  const orderedMonthKeys: string[] = [];
  const monthDayCount: Record<string, number> = {};

  // Build 12 month buckets anchored to Asuncion calendar months.
  const [, todayMStr, todayDStr] = todayStr.split('-');
  const todayM = Number(todayMStr); // 1..12
  const todayD = Number(todayDStr);

  for (let i = 0; i < 12; i++) {
    const idx = curMonth - 1 - (11 - i); // zero-based month index
    const y = curYear + Math.floor(idx / 12);
    const m = ((idx % 12) + 12) % 12; // 0..11
    const key = `${y}-${m}`;
    directByMonth[key] = 0;
    airbnbByMonth[key] = 0;
    occupancyByMonth[key] = 0;
    orderedMonthKeys.push(key);

    // Days in this calendar month, capped to today for the current month.
    // Last day of month m: day 0 of month m+1.
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const isCurrentMonth = y === curYear && m === todayM - 1;
    monthDayCount[key] = isCurrentMonth ? todayD : daysInMonth;
  }

  // Bucket payments by Asuncion calendar month, not server UTC month.
  for (const p of paymentsResult.data ?? []) {
    const [y, m] = asuncionYearMonth(p.created_at).split('-').map(Number);
    const key = `${y}-${m - 1}`;
    if (key in directByMonth) directByMonth[key] += Number(p.amount_usd ?? 0);
  }

  // Airbnb estimated revenue uses current nightly rate, surfaced as "est." in
  // the UI. Same caveat as dashboard-stats: retroactive rate changes drift.
  for (const block of airbnbResult.data ?? []) {
    const key = monthKeyFromStr(block.blocked_date);
    if (key in airbnbByMonth) airbnbByMonth[key] += nightlyRate;
  }

  // Occupancy: count Airbnb-blocked days + direct booked nights per month.
  // De-dup on a per-day basis so a rare same-day overlap does not double-count.
  const occupiedSetByMonth: Record<string, Set<string>> = {};
  for (const key of orderedMonthKeys) occupiedSetByMonth[key] = new Set();

  for (const block of airbnbResult.data ?? []) {
    const key = monthKeyFromStr(block.blocked_date);
    if (key in occupiedSetByMonth) occupiedSetByMonth[key].add(block.blocked_date);
  }

  for (const booking of bookingsResult.data ?? []) {
    const inStr: string = booking.check_in_date;
    const outStr: string = booking.check_out_date;
    let cursor = inStr < twelveMonthsAgoStr ? twelveMonthsAgoStr : inStr;
    const end = outStr > todayStr ? addDaysStr(todayStr, 1) : outStr;
    while (cursor < end) {
      const key = monthKeyFromStr(cursor);
      if (key in occupiedSetByMonth) occupiedSetByMonth[key].add(cursor);
      cursor = addDaysStr(cursor, 1);
    }
  }

  for (const key of orderedMonthKeys) {
    occupancyByMonth[key] = occupiedSetByMonth[key].size;
  }

  const monthlyRevenue = orderedMonthKeys.map((key) => {
    const monthIdx = Number(key.split('-')[1]);
    const occupiedDays = occupancyByMonth[key];
    const totalDays = monthDayCount[key];
    return {
      name: MONTH_NAMES[monthIdx],
      direct: Math.round(directByMonth[key] ?? 0),
      airbnbEstimate: Math.round(airbnbByMonth[key] ?? 0),
      occupiedDays,
      totalDays,
      occupancyRate: totalDays > 0 ? Math.round((occupiedDays / totalDays) * 100) : 0
    };
  });

  // Aggregate KPIs over the whole 12 month window.
  let totalRevenue = 0;
  let totalNights = 0;
  let totalOccupiedDays = 0;
  let totalAvailableDays = 0;

  for (const row of monthlyRevenue) {
    totalRevenue += row.direct + row.airbnbEstimate;
    totalOccupiedDays += row.occupiedDays;
    totalAvailableDays += row.totalDays;
  }

  // Total nights from confirmed direct bookings (the booking source the
  // operator can attribute revenue to). Airbnb nights are estimated separately.
  for (const booking of bookingsResult.data ?? []) {
    const nights = nightsBetween(booking.check_in_date, booking.check_out_date);
    totalNights += nights;
  }

  const adr = totalNights > 0 ? totalRevenue / (totalOccupiedDays > 0 ? totalOccupiedDays : totalNights) : 0;
  const revPar = totalAvailableDays > 0 ? totalRevenue / totalAvailableDays : 0;
  const occupancyRate = totalAvailableDays > 0 ? (totalOccupiedDays / totalAvailableDays) * 100 : 0;

  return res.json({
    unit: {
      id: unit.id,
      name: unit.name,
      nightlyRate,
      status: unit.status
    },
    monthlyRevenue,
    totals: {
      revenue: Math.round(totalRevenue),
      directRevenue: Math.round(monthlyRevenue.reduce((a, r) => a + r.direct, 0)),
      airbnbEstimate: Math.round(monthlyRevenue.reduce((a, r) => a + r.airbnbEstimate, 0)),
      bookings: bookingsResult.data?.length ?? 0,
      nights: totalNights,
      occupiedDays: totalOccupiedDays,
      availableDays: totalAvailableDays,
      occupancyRate: Math.round(occupancyRate),
      adr: Math.round(adr),
      revPar: Math.round(revPar)
    },
    recentBookings: recentResult.data ?? []
  });
});

// ============================================================================
// CSV exports
// Streamed line-by-line to avoid loading the whole result set in memory and
// to start the download before the query finishes. RFC 4180 escaping: any
// value containing comma, quote, CR, or LF is double-quoted with embedded
// quotes doubled.
// ============================================================================

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvLine(cols: unknown[]): string {
  return cols.map(csvEscape).join(',') + '\r\n';
}

const isoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

const exportFiltersSchema = z.object({
  query: z.object({
    from: z.string().refine(isoDate, 'from must be YYYY-MM-DD').optional(),
    to: z.string().refine(isoDate, 'to must be YYYY-MM-DD').optional(),
    status: z.string().min(1).max(50).optional(),
    unit_id: z.string().uuid().optional()
  })
});

router.get('/payments/export.csv', validate(exportFiltersSchema), async (req, res) => {
  const { from, to, status, unit_id } = req.query as {
    from?: string;
    to?: string;
    status?: string;
    unit_id?: string;
  };

  const filename = `payments_${todayDateString()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write(
    csvLine([
      'id',
      'booking_id',
      'guest_name',
      'guest_email',
      'unit_name',
      'amount_usd',
      'status',
      'payment_method',
      'bancard_transaction_id',
      'created_at',
      'captured_at',
      'failure_reason'
    ])
  );

  const PAGE_SIZE = 500;
  let offset = 0;

  for (;;) {
    let query = supabaseAdmin
      .from('payments')
      .select(
        'id, booking_id, amount_usd, payment_status, payment_method, bancard_transaction_id, created_at, updated_at, failure_reason, booking_requests!inner(guest_name, guest_email, unit_id, units(name))'
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (status) query = query.eq('payment_status', status);
    if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);
    if (unit_id) query = query.eq('booking_requests.unit_id', unit_id);

    const { data, error } = await query;
    if (error) {
      logger.error('payments.export: page query failed', { offset, error: error.message });
      // We have already started the body with headers; we cannot switch to a
      // 500 JSON without truncating mid-stream. Append a sentinel row so the
      // downloader knows the export is incomplete, then end.
      res.write(csvLine(['ERROR_TRUNCATED', error.message]));
      return res.end();
    }

    const rows = data ?? [];
    for (const r of rows) {
      const br = (r as { booking_requests?: { guest_name?: string; guest_email?: string; units?: { name?: string } | null } | null }).booking_requests;
      res.write(
        csvLine([
          r.id,
          r.booking_id,
          br?.guest_name ?? '',
          br?.guest_email ?? '',
          br?.units?.name ?? '',
          r.amount_usd,
          r.payment_status,
          r.payment_method ?? '',
          r.bancard_transaction_id ?? '',
          r.created_at,
          r.updated_at,
          r.failure_reason ?? ''
        ])
      );
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return res.end();
});

router.get('/bookings/export.csv', validate(exportFiltersSchema), async (req, res) => {
  const { from, to, status, unit_id } = req.query as {
    from?: string;
    to?: string;
    status?: string;
    unit_id?: string;
  };

  const filename = `bookings_${todayDateString()}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.write(
    csvLine([
      'id',
      'guest_name',
      'guest_email',
      'guest_phone',
      'unit_name',
      'check_in',
      'check_out',
      'nights',
      'status',
      'approval_path',
      'total_usd',
      'created_at'
    ])
  );

  const PAGE_SIZE = 500;
  let offset = 0;

  for (;;) {
    let query = supabaseAdmin
      .from('booking_requests')
      .select(
        'id, guest_name, guest_email, guest_phone, check_in_date, check_out_date, total_price_usd, status, approval_path, created_at, unit_id, units(name)'
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (status) query = query.eq('status', status);
    if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`);
    if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`);
    if (unit_id) query = query.eq('unit_id', unit_id);

    const { data, error } = await query;
    if (error) {
      logger.error('bookings.export: page query failed', { offset, error: error.message });
      res.write(csvLine(['ERROR_TRUNCATED', error.message]));
      return res.end();
    }

    const rows = data ?? [];
    for (const r of rows) {
      const unitName = (r as { units?: { name?: string } | null }).units?.name ?? '';
      const nights = nightsBetween(r.check_in_date, r.check_out_date);
      res.write(
        csvLine([
          r.id,
          r.guest_name,
          r.guest_email,
          r.guest_phone,
          unitName,
          r.check_in_date,
          r.check_out_date,
          nights,
          r.status,
          r.approval_path ?? '',
          r.total_price_usd,
          r.created_at
        ])
      );
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return res.end();
});

function todayDateString(): string {
  return todayInAsuncion();
}

// ============================================================================
// Booking notes (internal)
// Append-only audit trail. Author is resolved from res.locals.user (set by
// requireAuth) and matched to admin_users by auth_id. Both admin and staff
// can read and append.
// ============================================================================

const bookingIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() })
});

const createNoteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    content: z.string().trim().min(1, 'Note cannot be empty').max(5000, 'Note is too long')
  })
});

router.get('/bookings/:id/notes', validate(bookingIdParamSchema), async (req, res) => {
  const bookingId = req.params.id;

  const { data, error } = await supabaseAdmin
    .from('booking_notes')
    .select('id, booking_id, content, created_at, author:admin_users(id, name, email)')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.error('GET /admin/bookings/:id/notes failed', { bookingId, error: error.message });
    return res.status(500).json({ error: 'Failed to fetch notes' });
  }

  return res.json(data ?? []);
});

router.post('/bookings/:id/notes', validate(createNoteSchema), async (req, res) => {
  const bookingId = req.params.id;
  const authUserId = res.locals.user?.id as string | undefined;

  if (!authUserId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Resolve admin_users.id from the auth user. Staff are allowed to write
  // notes; only inactive accounts are rejected.
  const { data: author, error: authorError } = await supabaseAdmin
    .from('admin_users')
    .select('id, status')
    .eq('auth_id', authUserId)
    .maybeSingle();

  if (authorError) {
    logger.error('POST /admin/bookings/:id/notes: author lookup failed', {
      bookingId,
      authUserId,
      error: authorError.message
    });
    return res.status(500).json({ error: 'Failed to resolve author' });
  }

  if (!author) {
    logger.warn('POST /admin/bookings/:id/notes: no admin_users row for caller', {
      bookingId,
      authUserId
    });
    return res.status(403).json({ error: 'Caller is not a registered admin user' });
  }

  if (author.status !== 'active') {
    return res.status(403).json({ error: 'Account is inactive' });
  }

  // Verify the booking exists before insert so we return a clean 404 instead
  // of a FK violation surfacing as a 500.
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError) {
    logger.error('POST /admin/bookings/:id/notes: booking lookup failed', {
      bookingId,
      error: bookingError.message
    });
    return res.status(500).json({ error: 'Failed to fetch booking' });
  }

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found' });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('booking_notes')
    .insert({ booking_id: bookingId, author_id: author.id, content: req.body.content })
    .select('id, booking_id, content, created_at, author:admin_users(id, name, email)')
    .single();

  if (insertError || !inserted) {
    logger.error('POST /admin/bookings/:id/notes: insert failed', {
      bookingId,
      authorId: author.id,
      error: insertError?.message
    });
    return res.status(500).json({ error: 'Failed to create note' });
  }

  return res.status(201).json(inserted);
});

// ---------------------------------------------------------------------------
// FX rate management
//
// USD -> PYG conversion is hot path on every Bancard charge. These endpoints
// expose the live rate, an admin-only manual override (used when the upstream
// fetch is wrong or there is unusual market volatility), and a markup setting
// that buffers FX risk between booking and payout.
//
// Read endpoint is open to any authenticated admin user (role enforced via
// JWT + admin_users at requireAdmin). Write endpoints require admin too.
// ---------------------------------------------------------------------------

router.get('/fx/status', requireAdmin, async (_req, res) => {
  try {
    const status = await getCurrentFxRate();
    return res.json(status);
  } catch (err) {
    logger.error('GET /admin/fx/status failed', {
      error: err instanceof Error ? err.message : 'unknown'
    });
    return res.status(500).json({ error: 'Failed to read FX status' });
  }
});

const fxOverrideSchema = z.object({
  body: z.object({
    market_rate: z.number().positive().min(1000).max(20000)
  })
});

router.post(
  '/fx/override',
  requireAdmin,
  adminWriteLimiter,
  validate(fxOverrideSchema),
  async (req, res) => {
    try {
      const { market_rate } = req.body as { market_rate: number };
      const status = await setManualOverride(market_rate);
      logger.info('fx: manual override set', { market_rate });
      return res.json(status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to set override';
      logger.error('POST /admin/fx/override failed', { error: msg });
      return res.status(400).json({ error: msg });
    }
  }
);

const fxMarkupSchema = z.object({
  body: z.object({
    markup_pct: z.number().min(0).max(30)
  })
});

router.post(
  '/fx/markup',
  requireAdmin,
  adminWriteLimiter,
  validate(fxMarkupSchema),
  async (req, res) => {
    try {
      const { markup_pct } = req.body as { markup_pct: number };
      const status = await setMarkupPct(markup_pct);
      logger.info('fx: markup updated', { markup_pct });
      return res.json(status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update markup';
      logger.error('POST /admin/fx/markup failed', { error: msg });
      return res.status(400).json({ error: msg });
    }
  }
);

router.post('/fx/refresh', requireAdmin, adminWriteLimiter, async (_req, res) => {
  try {
    const result = await fetchAndStoreFxRate();
    const status = await getCurrentFxRate();
    logger.info('fx: manual refresh ok', result);
    return res.json(status);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Manual refresh failed';
    logger.error('POST /admin/fx/refresh failed', { error: msg });
    return res.status(502).json({ error: msg });
  }
});

// ---------------------------------------------------------------------------
// Payment links. Admin creates a fixed-amount card payment link and shares the
// public URL. requireAdmin on top of the router-wide requireAuth: minting a
// charge link is a privileged action, same posture as FX tuning.
// ---------------------------------------------------------------------------

router.get('/payment-links', requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit ?? 100), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const links = await listPaymentLinks(limit, offset);
    return res.json(links);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list payment links';
    logger.error('GET /admin/payment-links failed', { error: msg });
    return res.status(500).json({ error: msg });
  }
});

const createPaymentLinkSchema = z.object({
  body: z.object({
    amount_usd: z.number().positive().max(1_000_000),
    concept: z.string().trim().min(2).max(200),
    booking_id: z.string().uuid().optional(),
    expires_at: z.string().datetime().optional()
  })
});

router.post(
  '/payment-links',
  requireAdmin,
  adminWriteLimiter,
  validate(createPaymentLinkSchema),
  async (req, res) => {
    try {
      const body = req.body as {
        amount_usd: number;
        concept: string;
        booking_id?: string;
        expires_at?: string;
      };
      const link = await createPaymentLink({
        amountUsd: body.amount_usd,
        concept: body.concept,
        bookingId: body.booking_id ?? null,
        expiresAt: body.expires_at ?? null
      });
      logger.info('Payment link created', { link_id: link.id, amount_usd: link.amount_usd });
      return res.status(201).json(link);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create payment link';
      logger.error('POST /admin/payment-links failed', { error: msg });
      return res.status(400).json({ error: msg });
    }
  }
);

export default router;
