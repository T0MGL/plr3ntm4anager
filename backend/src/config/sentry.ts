import * as Sentry from '@sentry/node';
import { env } from './env';

/**
 * Sentry is optional. Without a DSN we skip init entirely so local and staging
 * builds do not ship error reports to a shared project. In production, failing
 * silently here is fine because the missing DSN is a config problem that shows
 * up in the first deploy check, not a runtime hazard.
 */
export function initSentry(): void {
  if (!env.SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false
  });
}

export { Sentry };
