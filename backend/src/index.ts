import { initSentry, Sentry } from './config/sentry';

// Sentry must be initialized before any other module is imported so it can
// wrap Node's async hooks and capture errors thrown at import time or inside
// the first tick of the event loop.
initSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';
import { env } from './config/env';
import { logger } from './config/logger';
import { supabaseAdmin } from './config/supabase';
import unitsRoutes from './routes/units.routes';
import bookingRoutes from './routes/booking.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';
import icalRoutes from './routes/ical.routes';
import { startIcalCron } from './jobs/ical-cron';
import { startStuckPreauthAlertCron } from './jobs/stuck-preauth-alert';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}

const app = express();

// Railway puts the service behind a reverse proxy. Trust the first hop so
// req.ip resolves to the client and express-rate-limit stops throwing
// ERR_ERL_UNEXPECTED_X_FORWARDED_FOR. Real abuse protection lives in the
// per-booking attempt cap inside payment.service.ts, because IP-based limits
// drift across Railway replicas without a shared store.
app.set('trust proxy', 1);

app.use(helmet());

// Allowlist the two frontends we ship (widget + admin dashboard). Anything else
// is rejected at the CORS layer so a stolen JWT cannot be replayed from an
// attacker origin with credentials. Origin null covers curl, healthchecks, and
// same-origin server-to-server calls, none of which carry cookies.
const corsAllowlist = new Set([env.FRONTEND_URL, env.ADMIN_DASHBOARD_URL]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsAllowlist.has(origin)) {
        return callback(null, true);
      }
      logger.warn('CORS blocked origin', { origin });
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

app.use(
  express.json({
    verify: (req: express.Request, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/health/deep', async (_req, res) => {
  const started = Date.now();

  const [dbCheck, storageCheck, bancardCheck] = await Promise.allSettled([
    supabaseAdmin.from('units').select('id', { count: 'exact', head: true }),
    supabaseAdmin.storage.getBucket(env.SUPABASE_STORAGE_BUCKET),
    axios.head(env.BANCARD_API_URL, {
      timeout: 3000,
      validateStatus: () => true
    })
  ]);

  const dbOk = dbCheck.status === 'fulfilled' && !dbCheck.value.error;
  const storageOk =
    storageCheck.status === 'fulfilled' &&
    !storageCheck.value.error &&
    storageCheck.value.data?.name === env.SUPABASE_STORAGE_BUCKET;
  const bancardOk = bancardCheck.status === 'fulfilled';

  const allOk = dbOk && storageOk && bancardOk;

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    elapsed_ms: Date.now() - started,
    checks: {
      db: dbOk
        ? 'ok'
        : dbCheck.status === 'rejected'
        ? String(dbCheck.reason)
        : dbCheck.value.error?.message ?? 'unknown error',
      storage: storageOk
        ? 'ok'
        : storageCheck.status === 'rejected'
        ? String(storageCheck.reason)
        : storageCheck.value.error?.message ?? 'bucket missing',
      bancard: bancardOk
        ? `reachable (${(bancardCheck as PromiseFulfilledResult<{ status: number }>).value.status})`
        : String((bancardCheck as PromiseRejectedResult).reason)
    },
    payment_mode: env.PAYMENT_MODE,
    node_env: env.NODE_ENV
  });
});

app.use('/ical', icalRoutes);
app.use('/api/units', unitsRoutes);
app.use('/api', bookingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payments', paymentRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    logger.error('Unhandled error', { error: message });
    if (res.headersSent) {
      return;
    }
    res.status(500).json({ error: 'Internal server error' });
  }
);

app.listen(env.PORT, () => {
  logger.info('Server listening', {
    port: env.PORT,
    node_env: env.NODE_ENV,
    payment_mode: env.PAYMENT_MODE
  });
  startIcalCron();
  startStuckPreauthAlertCron();
});
