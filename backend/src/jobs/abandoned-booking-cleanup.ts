import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { unblockWidgetDates } from '../services/booking.service';
import { BookingStatus, PaymentStatus } from '../types';

// Abandoned-checkout cleanup
//
// Runs every 30 minutes. Finds pending booking_requests that were created more
// than PENDING_EXPIRY_HOURS ago and have no active payment (preauthorized or
// completed). These are guests who created a booking but never finished the
// Bancard checkout — they left stale widget-source rows in the availability
// table that would otherwise block those dates indefinitely.
//
// Safe guards:
//   - Only touches bookings with status='pending' and no live payment.
//   - Bookings on the manual path with a preauthorized hold are explicitly
//     excluded so we never auto-reject a booking awaiting admin review.
//   - unblockWidgetDates is idempotent: a date already removed is a no-op.

interface AbandonedBookingRow {
  id: string;
  unit_id: string;
  check_in_date: string;
  check_out_date: string;
  created_at: string;
}

const CRON_EXPR = '*/30 * * * *';

export function startAbandonedBookingCleanupCron(): void {
  cron.schedule(CRON_EXPR, async () => {
    try {
      const { expired, released } = await runAbandonedBookingCleanup();
      if (expired > 0) {
        logger.info('Abandoned booking cleanup completed', { expired, released });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Abandoned booking cleanup cron failed', { error: message });
    }
  });

  logger.info('Abandoned booking cleanup cron scheduled', {
    expression: CRON_EXPR,
    expiry_hours: env.PENDING_EXPIRY_HOURS
  });
}

export async function runAbandonedBookingCleanup(): Promise<{ expired: number; released: number }> {
  const cutoff = new Date(Date.now() - env.PENDING_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, unit_id, check_in_date, check_out_date, created_at')
    .eq('status', BookingStatus.Pending)
    .lte('created_at', cutoff)
    .returns<AbandonedBookingRow[]>();

  if (bookingError) {
    logger.error('Abandoned cleanup: booking query failed', { error: bookingError.message });
    return { expired: 0, released: 0 };
  }

  if (!candidates || candidates.length === 0) {
    return { expired: 0, released: 0 };
  }

  const candidateIds = candidates.map((b) => b.id);

  // Find bookings that DO have an active payment — exclude these from cleanup.
  // A preauthorized booking is awaiting admin review; a completed one is paid.
  const { data: livePayments, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('booking_id')
    .in('booking_id', candidateIds)
    .in('payment_status', [PaymentStatus.Preauthorized, PaymentStatus.Completed]);

  if (paymentError) {
    logger.error('Abandoned cleanup: payment query failed', { error: paymentError.message });
    return { expired: 0, released: 0 };
  }

  const liveBookingIds = new Set((livePayments ?? []).map((p) => p.booking_id));
  const abandoned = candidates.filter((b) => !liveBookingIds.has(b.id));

  if (abandoned.length === 0) {
    return { expired: 0, released: 0 };
  }

  let released = 0;

  for (const booking of abandoned) {
    const { error: updateError } = await supabaseAdmin
      .from('booking_requests')
      .update({
        status: BookingStatus.Rejected,
        rejected_at: new Date().toISOString(),
        rejection_reason: 'Payment not completed within the allowed window',
        updated_at: new Date().toISOString()
      })
      .eq('id', booking.id)
      .eq('status', BookingStatus.Pending);

    if (updateError) {
      logger.error('Abandoned cleanup: failed to reject booking', {
        booking_id: booking.id,
        error: updateError.message
      });
      continue;
    }

    await unblockWidgetDates(booking.unit_id, booking.check_in_date, booking.check_out_date);
    released++;

    logger.info('Abandoned cleanup: expired booking released', {
      booking_id: booking.id,
      unit_id: booking.unit_id,
      check_in: booking.check_in_date,
      check_out: booking.check_out_date,
      age_hours: ((Date.now() - new Date(booking.created_at).getTime()) / 3_600_000).toFixed(1)
    });
  }

  return { expired: abandoned.length, released };
}
