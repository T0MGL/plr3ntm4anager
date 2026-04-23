import cron from 'node-cron';
import { logger } from '../config/logger';
import { fetchAndStoreFxRate } from '../services/fx-rate.service';

// Daily USD/PYG rate fetch.
//
// Schedule: 06:00 America/Asuncion. Park Lofts checkouts cluster between
// 09:00 and 22:00 PYT, so a 06:00 refresh guarantees the rate is fresh
// before the first booking of the day. node-cron treats the timezone field
// natively so DST shifts (Paraguay observes UTC-3 year-round, no DST since
// 2010, but keeping it explicit is cheap insurance).
//
// On boot we also fire one fetch immediately so a freshly deployed instance
// never operates on a stale rate. Failures are logged; if all retries inside
// the service exhaust, we let the error bubble so Sentry catches it.

const CRON_EXPR = '0 6 * * *';
const TIMEZONE = 'America/Asuncion';

export function startFxRateFetchCron(): void {
  cron.schedule(
    CRON_EXPR,
    async () => {
      try {
        const result = await fetchAndStoreFxRate();
        logger.info('fx cron: daily fetch ok', result);
      } catch (err) {
        logger.error('fx cron: daily fetch failed after retries', {
          error: err instanceof Error ? err.message : 'unknown'
        });
      }
    },
    { timezone: TIMEZONE }
  );

  logger.info('fx rate fetch cron scheduled', {
    expression: CRON_EXPR,
    timezone: TIMEZONE
  });

  // Boot-time fetch. Detached from the cron schedule so the server still
  // starts even if the FX upstream is down. Failures are non-fatal.
  void (async () => {
    try {
      const result = await fetchAndStoreFxRate();
      logger.info('fx cron: boot fetch ok', result);
    } catch (err) {
      logger.warn('fx cron: boot fetch failed, will retry on schedule', {
        error: err instanceof Error ? err.message : 'unknown'
      });
    }
  })();
}
