import { eachDayOfInterval, format, parseISO } from 'date-fns';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { BookingStatus, PaymentStatus } from '../types';
import { nightsBetween, validateDateRange } from '../utils/date.utils';

export interface PublicBookingDetails {
  id: string;
  status: BookingStatus;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  total_price_usd: number;
  guest_first_name: string;
  unit_name: string;
  unit_image: string | null;
  payment_status: PaymentStatus | null;
  payment_completed_at: string | null;
}

/**
 * Public booking lookup used by the payment result page. Returns only the
 * fields that are safe to expose to anyone who has the booking UUID. No
 * guest email, no phone, no full name beyond the first token.
 */
export async function getPublicBookingDetails(bookingId: string): Promise<PublicBookingDetails | null> {
  const { data: booking, error } = await supabaseAdmin
    .from('booking_requests')
    .select('id, status, check_in_date, check_out_date, total_price_usd, guest_name, unit_id')
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    return null;
  }

  const [unitResult, paymentResult] = await Promise.all([
    supabaseAdmin
      .from('units')
      .select('name, image_urls')
      .eq('id', booking.unit_id)
      .maybeSingle(),
    supabaseAdmin
      .from('payments')
      .select('payment_status, completed_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const unit = unitResult.data;
  const payment = paymentResult.data;

  const firstName = (booking.guest_name ?? '').split(' ')[0] || 'guest';
  const nights = nightsBetween(booking.check_in_date, booking.check_out_date);

  return {
    id: booking.id,
    status: booking.status as BookingStatus,
    check_in_date: booking.check_in_date,
    check_out_date: booking.check_out_date,
    nights,
    total_price_usd: Number(booking.total_price_usd),
    guest_first_name: firstName,
    unit_name: unit?.name ?? 'Park Lofts',
    unit_image: unit?.image_urls?.[0] ?? null,
    payment_status: (payment?.payment_status as PaymentStatus) ?? null,
    payment_completed_at: payment?.completed_at ?? null
  };
}

export async function getLastSyncAt(unitId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('sync_logs')
    .select('sync_completed_at')
    .eq('unit_id', unitId)
    .eq('sync_status', 'success')
    .order('sync_completed_at', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error('Failed to fetch last sync timestamp');
  }

  return data?.[0]?.sync_completed_at ?? null;
}

export async function isAvailable(unitId: string, checkIn: string, checkOut: string): Promise<boolean> {
  validateDateRange(checkIn, checkOut);
  const { data, error } = await supabaseAdmin
    .from('availability')
    .select('blocked_date')
    .eq('unit_id', unitId)
    .gte('blocked_date', checkIn)
    .lt('blocked_date', checkOut);

  if (error) {
    throw new Error('Failed to check availability');
  }

  return (data ?? []).length === 0;
}

export async function createBookingRequest(params: {
  unitId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  specialRequests?: string | null;
  locale?: string | null;
}): Promise<{ bookingId: string; totalPrice: number; lastSyncAt: string | null }> {
  const { data: unit, error: unitError } = await supabaseAdmin
    .from('units')
    .select('id, nightly_rate_usd')
    .eq('id', params.unitId)
    .eq('status', 'active')
    .single();

  if (unitError || !unit) {
    throw new Error('Unit not found');
  }

  const available = await isAvailable(params.unitId, params.checkIn, params.checkOut);
  if (!available) {
    throw new Error('Selected dates are not available');
  }

  const nights = nightsBetween(params.checkIn, params.checkOut);
  const totalPrice = Number(unit.nightly_rate_usd) * nights;
  const lastSyncAt = await getLastSyncAt(params.unitId);

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .insert({
      unit_id: params.unitId,
      guest_name: params.guestName,
      guest_email: params.guestEmail,
      guest_phone: params.guestPhone,
      check_in_date: params.checkIn,
      check_out_date: params.checkOut,
      total_price_usd: totalPrice,
      special_requests: params.specialRequests ?? null,
      locale: params.locale ?? 'es',
      status: BookingStatus.Pending,
      last_sync_at_submission: lastSyncAt ?? new Date().toISOString()
    })
    .select('id')
    .single();

  if (bookingError || !booking) {
    throw new Error('Failed to create booking request');
  }

  // Immediately block dates in availability so Airbnb sees them on next iCal poll.
  // source = 'widget' ensures these survive Airbnb re-syncs (see migration 002).
  // booking_id links the rows to the owning booking so the approval decider can
  // exclude them when checking its own range (see migration 006). Uses
  // ON CONFLICT DO NOTHING, if Airbnb already blocked a date we skip it silently.
  await blockWidgetDates(booking.id, params.unitId, params.checkIn, params.checkOut);

  return { bookingId: booking.id, totalPrice, lastSyncAt };
}

/**
 * Inserts every night of a booking range into `availability` with source='widget'
 * and booking_id set to the owning booking. Dates are check-in inclusive,
 * check-out exclusive (standard hotel convention). Failures are logged but
 * non-fatal, the booking was already created.
 */
async function blockWidgetDates(
  bookingId: string,
  unitId: string,
  checkIn: string,
  checkOut: string
): Promise<void> {
  const checkInDate = parseISO(checkIn);
  const checkOutDate = parseISO(checkOut);

  // checkOut is the departure day, guests are not occupying that night
  const lastNight = new Date(checkOutDate.getTime() - 24 * 60 * 60 * 1000);

  if (lastNight < checkInDate) {
    return;
  }

  const days = eachDayOfInterval({ start: checkInDate, end: lastNight });
  const rows = days.map((day) => ({
    unit_id: unitId,
    blocked_date: format(day, 'yyyy-MM-dd'),
    source: 'widget',
    booking_id: bookingId
  }));

  const { error } = await supabaseAdmin
    .from('availability')
    .upsert(rows, { onConflict: 'unit_id,blocked_date', ignoreDuplicates: true });

  if (error) {
    // Non-fatal: booking exists, dates will be picked up on next Airbnb iCal sync
    logger.error('blockWidgetDates: failed to insert availability rows', {
      error: error.message,
      unitId,
      checkIn,
      checkOut
    });
  }
}

/**
 * Guest-initiated cancellation. Called when the guest closes the Bancard modal
 * without completing payment (dismiss, network error, etc.). Marks the booking
 * as `cancelled` and releases its widget availability blocks immediately, so
 * the dates open back up without waiting for the cron.
 *
 * Only acts on `pending` bookings with no active payment (pending or
 * preauthorized). Returns the outcome so the route can respond accordingly.
 */
export async function cancelBookingRequest(
  bookingId: string
): Promise<{ cancelled: boolean; reason: string }> {
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (bookingError || !booking) {
    return { cancelled: false, reason: 'not_found' };
  }

  if (booking.status !== BookingStatus.Pending) {
    return { cancelled: false, reason: booking.status };
  }

  // Refuse to cancel if there is an active payment: the Bancard confirmation
  // webhook may still be in flight, and cancelling now would orphan it.
  const { data: activePayment } = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('booking_id', bookingId)
    .in('payment_status', [PaymentStatus.Pending, PaymentStatus.Preauthorized])
    .maybeSingle();

  if (activePayment) {
    return { cancelled: false, reason: 'payment_in_progress' };
  }

  const { error: updateError } = await supabaseAdmin
    .from('booking_requests')
    .update({
      status: BookingStatus.Cancelled,
      rejection_reason: 'Guest dismissed payment without completing',
      updated_at: new Date().toISOString()
    })
    .eq('id', bookingId)
    .eq('status', BookingStatus.Pending);

  if (updateError) {
    logger.error('cancelBookingRequest: failed to mark booking cancelled', {
      booking_id: bookingId,
      error: updateError.message
    });
    return { cancelled: false, reason: 'db_error' };
  }

  await unblockWidgetDates(bookingId);

  logger.info('cancelBookingRequest: booking cancelled by guest', { booking_id: bookingId });

  return { cancelled: true, reason: 'guest_dismiss' };
}

/**
 * Releases widget-sourced blocks owned by a booking. Must be called whenever a
 * booking_request transitions to `rejected` (manual reject, conflict-on-approve,
 * or abandoned-pending cleanup). Without this, stale widget blocks accumulate
 * and leak into the guest-facing DatePicker, desyncing from the admin calendar
 * (which filters source IN ('airbnb','manual')).
 *
 * Scope is narrow by booking_id: only rows owned by the booking are deleted,
 * so two overlapping pending bookings never trample each other's rows.
 * Airbnb- and manual-sourced rows are never touched.
 */
export async function unblockWidgetDates(bookingId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('availability')
    .delete()
    .eq('booking_id', bookingId)
    .eq('source', 'widget');

  if (error) {
    logger.error('unblockWidgetDates: failed to delete availability rows', {
      error: error.message,
      bookingId
    });
  }
}
