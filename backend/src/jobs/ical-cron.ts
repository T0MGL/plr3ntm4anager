import cron from 'node-cron';
import { env } from '../config/env';
import { syncDueUnits } from '../services/ical-sync.service';
import { logger } from '../config/logger';

/**
 * The cron fires every SYNC_INTERVAL_MINUTES (default 5). Each tick picks the
 * subset of units whose staggering slot falls inside the tick and that are
 * older than UNIT_SYNC_CADENCE_MINUTES (default 120). At 50 units this yields
 * roughly 50 / (120 / 5) ≈ 2 syncs per tick on average, spread evenly.
 */
export function startIcalCron(): void {
  const interval = env.SYNC_INTERVAL_MINUTES;
  const cronExpr = `*/${interval} * * * *`;

  cron.schedule(cronExpr, async () => {
    try {
      const { picked } = await syncDueUnits();
      if (picked > 0) {
        logger.info('iCal cron tick picked units', { picked });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('iCal cron tick failed', { error: message });
    }
  });

  logger.info('iCal cron scheduled', {
    tickMinutes: interval,
    unitCadenceMinutes: env.UNIT_SYNC_CADENCE_MINUTES
  });
}
