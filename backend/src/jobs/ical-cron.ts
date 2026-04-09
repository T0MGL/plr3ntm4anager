import cron from 'node-cron';
import { env } from '../config/env';
import { syncAllUnits } from '../services/ical-sync.service';
import { logger } from '../config/logger';

export function startIcalCron(): void {
  const interval = env.SYNC_INTERVAL_MINUTES;
  const cronExpr = `*/${interval} * * * *`;

  cron.schedule(cronExpr, async () => {
    logger.info('Starting iCal sync job');
    try {
      await syncAllUnits();
      logger.info('Completed iCal sync job');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('iCal sync job failed', { error: message });
    }
  });
}
