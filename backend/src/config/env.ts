import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),
  SUPABASE_STORAGE_BUCKET: z.string().min(1),
  BANCARD_API_URL: z.string().url().default('https://vpos.infonet.com.py:8888'),
  BANCARD_PUBLIC_KEY: z.string().min(1),
  BANCARD_PRIVATE_KEY: z.string().min(1),
  USD_TO_PYG_RATE: z.coerce.number().positive().default(7800),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().email(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().url(),
  ADMIN_DASHBOARD_URL: z.string().url(),
  // Optional comma separated list of additional origins allowed by CORS.
  // Used to whitelist short lived preview deploys or migration domains
  // without redeploying code. Example:
  // CORS_EXTRA_ORIGINS=https://admin.parkloftsparaguay.com,https://staging-admin.parkloftsparaguay.com
  CORS_EXTRA_ORIGINS: z.string().optional(),
  // Cron tick cadence. A tick does NOT sync every unit. It evaluates which
  // units are due, based on UNIT_SYNC_CADENCE_MINUTES and each unit's stable
  // sync_offset_minutes, and syncs only those. Keep this small (5 min is the
  // granularity of the staggering window).
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(1).max(60).default(5),
  // Per-unit sync cadence. Airbnb's iCal CDN typically caches for ~2h, so
  // polling faster than this is waste. The cron spreads units across a
  // [0, UNIT_SYNC_CADENCE_MINUTES) window via unit.sync_offset_minutes.
  UNIT_SYNC_CADENCE_MINUTES: z.coerce.number().int().min(15).max(360).default(120),
  // Demand-driven sync TTL. When a guest hits the availability endpoint and the
  // unit's last successful sync is older than this threshold, a background sync
  // fires asynchronously before the response returns. This keeps calendar data
  // fresh for browsing users without polling units that nobody is looking at.
  // Works alongside UNIT_SYNC_CADENCE_MINUTES (the background safety net).
  AVAILABILITY_SYNC_TTL_MIN: z.coerce.number().int().min(5).max(240).default(30),
  // Dual-path approval threshold. A booking whose most recent successful Airbnb
  // sync is younger than this (measured at decision time) is eligible for the
  // auto path, which captures the card immediately. Older syncs route to the
  // manual path (preauthorization + admin review). 30 minutes is the default
  // agreed with Park Lofts because that is roughly one full iCal poll window
  // plus a small buffer, so most legitimate requests still auto-approve.
  AUTO_APPROVE_SYNC_FRESHNESS_MIN: z.coerce.number().int().min(5).max(240).default(30),
  // Alert cron threshold. A preauthorized booking sitting on the manual path
  // for longer than this without an admin decision is flagged so we can unwind
  // the auth hold before it expires on the issuer side (Bancard typically
  // honors a preauth for 7 days, we alert earlier to leave a margin).
  PREAUTH_STUCK_ALERT_DAYS: z.coerce.number().int().min(1).max(14).default(5),
  // Abandoned-checkout expiry. Pending booking_requests with no completed or
  // preauthorized payment older than this are auto-rejected and their widget
  // blocks released. Set to 1h: guests who do not complete payment within an
  // hour will not return. The frontend fires an explicit cancel on modal dismiss
  // for the common case, so the cron is the safety net, not the primary path.
  PENDING_EXPIRY_HOURS: z.coerce.number().int().min(1).max(48).default(1),
  // Operational mailbox that receives stuck-preauth alerts.
  ALERT_EMAIL_TO: z.string().email().optional(),
  JWT_SECRET: z.string().min(32),
  // stub    -> local dev, no Bancard calls
  // staging -> Bancard staging env (https://vpos.infonet.com.py:8888)
  // live    -> Bancard production env (https://vpos.infonet.com.py)
  PAYMENT_MODE: z.enum(['stub', 'staging', 'live']).default('stub'),
  SENTRY_DSN: z.string().url().optional(),
  APIFY_API_KEY: z.string().min(1).optional()
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console -- boot time, logger is not initialised yet
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export type Env = z.infer<typeof envSchema>;
