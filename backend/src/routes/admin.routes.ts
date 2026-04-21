import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { manualSyncRateLimit } from '../middleware/rate-limit.middleware';
import { supabaseAdmin } from '../config/supabase';
import { BookingStatus, PaymentStatus } from '../types';
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
router.get('/booking-requests', async (req, res) => {
  const status = req.query.status as string | undefined;
  const limit = Number(req.query.limit ?? 20);
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
    const approvedEmail = bookingApprovedEmail({ guestName: booking.guest_name, locale: booking.locale });
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
    .select('id, guest_email, guest_name, status, locale')
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

  try {
    await rollbackPayment(bookingId);
  } catch (rollbackErr: unknown) {
    const msg = rollbackErr instanceof Error ? rollbackErr.message : 'Rollback failed';
    logger.warn('Payment rollback on reject failed (non-blocking)', { error: msg, bookingId });
  }

  const rejectedEmail = bookingRejectedEmail({
    guestName: booking.guest_name,
    reason: req.body.rejection_reason,
    locale: booking.locale
  });
  await sendEmail(booking.guest_email, rejectedEmail.subject, rejectedEmail.html);

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
    airbnb_listing_url: z.string().url().optional(),
    airbnb_ical_url: z.string().url(),
    image_urls: z.array(z.string().url()).min(5, 'At least 5 images are required').optional(),
    status: z.enum(['active', 'inactive']).optional()
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

export default router;








