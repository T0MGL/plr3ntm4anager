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
import { logger } from '../config/logger';
import { env } from '../config/env';
import { nightsBetween } from '../utils/date.utils';

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
      .select('unit_id, blocked_date, source, units(name)')
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
    booking.check_out_date
  );

  if (!recheck.available) {
    logger.warn('Approve: availability recheck failed, rolling back', {
      booking_id: bookingId,
      reason: recheck.reason
    });

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
    await unblockWidgetDates(booking.unit_id, booking.check_in_date, booking.check_out_date);

    const conflictEmail = bookingConflictRejectionEmail({
      guestName: booking.guest_name,
      bookingId,
      locale: booking.locale
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
  await unblockWidgetDates(booking.unit_id, booking.check_in_date, booking.check_out_date);

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
    locale: booking.locale
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

  await unblockWidgetDates(booking.unit_id, booking.check_in_date, booking.check_out_date);

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

router.get('/dashboard-stats', async (_req, res) => {
  // Timezone note: the app operates in Paraguay (UTC-3). All date math here is
  // string-based (YYYY-MM-DD) to avoid the `new Date('YYYY-MM-DD')`-parses-as-UTC
  // pitfall. Month/day buckets are derived by slicing the string, never from
  // local Date accessors applied to a UTC-parsed string.
  // Row cap is set explicitly because PostgREST's default max-rows may silently
  // truncate large windows; 20k covers ~13 units x 365 days x 4 margin.
  const MAX_ROWS = 20000;

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Helpers: operate on YYYY-MM-DD strings only.
  const addDaysStr = (ymd: string, days: number): string => {
    const [y, m, d] = ymd.split('-').map(Number);
    // Date.UTC avoids any local-TZ drift; we only use it to compute another YYYY-MM-DD.
    const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
    return new Date(t).toISOString().split('T')[0];
  };
  const monthKeyFromStr = (ymd: string): string => {
    // key is `YYYY-MIndex` where MIndex is 0..11
    const [y, m] = ymd.split('-').map(Number);
    return `${y}-${m - 1}`;
  };
  const dowFromStr = (ymd: string): number => {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  };

  // --- monthly revenue (last 12 months) ---
  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

  const [paymentsResult, airbnbMonthlyResult] = await Promise.all([
    supabaseAdmin
      .from('payments')
      .select('amount_usd, created_at')
      .eq('payment_status', PaymentStatus.Completed)
      .gte('created_at', twelveMonthsAgo.toISOString())
      .limit(MAX_ROWS),
    supabaseAdmin
      .from('availability')
      .select('blocked_date, unit_id, units(nightly_rate_usd)')
      .eq('source', 'airbnb')
      .gte('blocked_date', twelveMonthsAgoStr)
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
  const monthlyMap: Record<string, number> = {};
  const monthlyAirbnbMap: Record<string, number> = {};
  const orderedMonthKeys: string[] = [];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 11 + i);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthlyMap[key] = 0;
    monthlyAirbnbMap[key] = 0;
    orderedMonthKeys.push(key);
  }

  for (const p of paymentsResult.data ?? []) {
    // payments.created_at is a full ISO timestamp; parsing as Date is correct here
    // (we want wall-clock month the payment landed, not date-only).
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key in monthlyMap) {
      monthlyMap[key] += Number(p.amount_usd ?? 0);
    }
  }

  for (const block of airbnbMonthlyResult.data ?? []) {
    const key = monthKeyFromStr(block.blocked_date);
    if (key in monthlyAirbnbMap) {
      // NOTE: Supabase returns a single object for many-to-one joins (availability → units).
      // Rate used is the CURRENT nightly_rate_usd, not historical. Retroactive estimates
      // will drift if rates have been changed. Surfaced as "est." in the UI.
      const rate = Number((block.units as { nightly_rate_usd?: number } | null)?.nightly_rate_usd ?? 0);
      monthlyAirbnbMap[key] += rate;
    }
  }

  const monthlyRevenue = orderedMonthKeys.map((key) => {
    const monthIdx = Number(key.split('-')[1]);
    return {
      name: MONTH_NAMES[monthIdx],
      revenue: Math.round(monthlyMap[key] ?? 0),
      airbnbEstimate: Math.round(monthlyAirbnbMap[key] ?? 0)
    };
  });

  // Current and previous month scalar values, consistent with the chart buckets.
  // Computing server-side avoids a redundant /admin/payments fetch on the client
  // and removes the 500-row truncation risk for high-volume months.
  const currentMonthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const prevMonthDate = new Date(now);
  prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
  const prevMonthKey = `${prevMonthDate.getFullYear()}-${prevMonthDate.getMonth()}`;

  const thisMonthRevenue = Math.round(monthlyMap[currentMonthKey] ?? 0);
  const prevMonthRevenue = Math.round(monthlyMap[prevMonthKey] ?? 0);
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
    monthlyRevenue,
    weeklyOccupancy,
    avgOccupancy,
    airbnbUpcomingCheckins,
    thisMonthRevenue,
    prevMonthRevenue,
    thisMonthAirbnbEstimate,
    prevMonthAirbnbEstimate
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
  }),
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

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const addDaysStr = (ymd: string, days: number): string => {
    const [y, m, d] = ymd.split('-').map(Number);
    const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
    return new Date(t).toISOString().split('T')[0];
  };
  const monthKeyFromStr = (ymd: string): string => {
    const [y, m] = ymd.split('-').map(Number);
    return `${y}-${m - 1}`;
  };

  const twelveMonthsAgo = new Date(now);
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);
  const twelveMonthsAgoStr = twelveMonthsAgo.toISOString().split('T')[0];

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
      .gte('created_at', twelveMonthsAgo.toISOString())
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

  for (let i = 0; i < 12; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 11 + i);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    directByMonth[key] = 0;
    airbnbByMonth[key] = 0;
    occupancyByMonth[key] = 0;
    orderedMonthKeys.push(key);

    // Days in this calendar month, capped to today for the current month so
    // occupancy is computed against elapsed days, not future ones.
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const cap = monthEnd > now ? now : monthEnd;
    monthDayCount[key] = cap < monthStart ? 0 : Math.floor((cap.getTime() - monthStart.getTime()) / 86_400_000) + 1;
  }

  for (const p of paymentsResult.data ?? []) {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
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
  return new Date().toISOString().split('T')[0];
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

export default router;
