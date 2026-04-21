import cron from 'node-cron';
import { differenceInCalendarDays } from 'date-fns';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { sendEmail } from '../services/email.service';
import { stuckPreauthInternalAlertEmail } from '../templates/emails';
import { PaymentStatus } from '../types';

// Stuck preauthorization alert
//
// Runs once a day at 09:00 America/Asuncion. Finds every manual-path booking
// that is still Pending with a Preauthorized payment older than the alert
// threshold, and emails the operations mailbox with the full list and a
// dashboard deeplink. Bancard typically honors preauths for 7 days; alerting
// at 5 days leaves a margin for ops to act before the issuer auto-releases.
//
// The cron is idempotent: it does not mutate state, it only sends the email.

interface StuckBookingRow {
  id: string;
  guest_name: string;
  check_in_date: string;
  check_out_date: string;
  created_at: string;
  units: { name: string | null } | null;
}

interface StuckPaymentRow {
  booking_id: string;
  payment_status: string;
  created_at: string;
}

const CRON_EXPR = '0 9 * * *';
const CRON_TZ = 'America/Asuncion';

export function startStuckPreauthAlertCron(): void {
  cron.schedule(
    CRON_EXPR,
    async () => {
      try {
        await runStuckPreauthAlert();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Stuck preauth alert cron failed', { error: message });
      }
    },
    { timezone: CRON_TZ }
  );

  logger.info('Stuck preauth alert cron scheduled', {
    expression: CRON_EXPR,
    timezone: CRON_TZ,
    threshold_days: env.PREAUTH_STUCK_ALERT_DAYS
  });
}

export async function runStuckPreauthAlert(): Promise<{ count: number; delivered: boolean }> {
  const threshold = env.PREAUTH_STUCK_ALERT_DAYS;
  const cutoffIso = new Date(Date.now() - threshold * 24 * 60 * 60 * 1000).toISOString();

  const { data: stuckBookings, error: bookingError } = await supabaseAdmin
    .from('booking_requests')
    .select('id, guest_name, check_in_date, check_out_date, created_at, units(name)')
    .eq('approval_path', 'manual')
    .eq('status', 'pending')
    .lte('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .returns<StuckBookingRow[]>();

  if (bookingError) {
    logger.error('Stuck preauth alert: booking query failed', { error: bookingError.message });
    return { count: 0, delivered: false };
  }

  if (!stuckBookings || stuckBookings.length === 0) {
    logger.info('Stuck preauth alert: no bookings over threshold', { threshold_days: threshold });
    return { count: 0, delivered: false };
  }

  const bookingIds = stuckBookings.map((b) => b.id);

  const { data: activePreauths, error: paymentError } = await supabaseAdmin
    .from('payments')
    .select('booking_id, payment_status, created_at')
    .in('booking_id', bookingIds)
    .eq('payment_status', PaymentStatus.Preauthorized)
    .returns<StuckPaymentRow[]>();

  if (paymentError) {
    logger.error('Stuck preauth alert: payment query failed', { error: paymentError.message });
    return { count: 0, delivered: false };
  }

  const stuckBookingIds = new Set((activePreauths ?? []).map((p) => p.booking_id));
  const rowsToAlert = stuckBookings.filter((b) => stuckBookingIds.has(b.id));

  if (rowsToAlert.length === 0) {
    logger.info('Stuck preauth alert: no active preauthorizations over threshold', {
      threshold_days: threshold
    });
    return { count: 0, delivered: false };
  }

  logger.warn('Stuck preauth alert: bookings need action', {
    count: rowsToAlert.length,
    threshold_days: threshold
  });

  if (!env.ALERT_EMAIL_TO) {
    logger.warn('Stuck preauth alert: ALERT_EMAIL_TO not configured, alert only logged');
    return { count: rowsToAlert.length, delivered: false };
  }

  const now = new Date();
  const payload = rowsToAlert.map((b) => ({
    bookingId: b.id,
    guestName: b.guest_name,
    unitName: b.units?.name ?? 'Unit',
    checkIn: b.check_in_date,
    checkOut: b.check_out_date,
    createdAt: b.created_at,
    ageDays: differenceInCalendarDays(now, new Date(b.created_at))
  }));

  const email = stuckPreauthInternalAlertEmail({
    bookings: payload,
    thresholdDays: threshold,
    dashboardUrl: `${env.ADMIN_DASHBOARD_URL}/bookings?filter=manual-pending`
  });

  await sendEmail(env.ALERT_EMAIL_TO, email.subject, email.html);

  return { count: rowsToAlert.length, delivered: true };
}
