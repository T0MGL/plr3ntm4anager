import { Resend } from 'resend';
import { env } from '../config/env';
import { logger } from '../config/logger';

// Resend HTTP API over HTTPS/443. Switched away from SMTP (port 465) because
// Railway egress was hanging on the TLS handshake to smtp.resend.com, causing
// every transactional email to fail with "Connection timeout" after ~80s.

const resend = new Resend(env.RESEND_API_KEY);

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to,
      subject,
      html
    });

    if (error) {
      logger.error('Email send failed', { error: error.message, to, subject });
      return;
    }

    logger.info('Email sent', { to, subject });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Email send threw', { error: message, to, subject });
  }
}
