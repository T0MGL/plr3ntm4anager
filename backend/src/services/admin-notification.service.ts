import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { sendEmail } from './email.service';
import { adminNewBookingAlertEmail } from '../templates/emails';

export interface NewBookingAlertParams {
  bookingId: string;
  guestName: string;
  guestEmail: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalUsd: number;
  approvalPath: 'auto' | 'manual';
  dashboardUrl: string;
}

/**
 * Fans out a new-booking alert email to every active admin user who has
 * opted in to new-booking notifications. Runs fire-and-forget: caller does
 * not await, and failures are logged but never bubble up.
 */
export async function notifyAdminsNewBooking(params: NewBookingAlertParams): Promise<void> {
  try {
    const { data: recipients, error } = await supabaseAdmin
      .from('admin_users')
      .select('email, name')
      .eq('status', 'active')
      .eq('notify_new_booking', true);

    if (error) {
      logger.error('admin-notification: failed to fetch opted-in admins', { error: error.message });
      return;
    }

    if (!recipients || recipients.length === 0) {
      return;
    }

    const { subject, html } = adminNewBookingAlertEmail(params);

    await Promise.all(
      recipients.map((r) =>
        sendEmail(r.email, subject, html).catch((err: unknown) => {
          logger.error('admin-notification: failed to send to admin', {
            email: r.email,
            error: err instanceof Error ? err.message : 'unknown',
          });
        }),
      ),
    );
  } catch (err: unknown) {
    logger.error('admin-notification: unexpected error', {
      error: err instanceof Error ? err.message : 'unknown',
      bookingId: params.bookingId,
    });
  }
}
