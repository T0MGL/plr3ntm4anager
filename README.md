# PL Rent Manager

Operations platform for Park Lofts Paraguay. Centralizes the booking pipeline from iCal sync to Bancard payment to admin reconciliation, replacing a stack of spreadsheets and manual reservations.

The repository ships three apps that share a single Supabase database: a public booking widget, an admin dashboard, and a Node API that owns business rules and integrations.

## Stack

- Frontend (admin dashboard): React 18, Vite, Tailwind CSS, FullCalendar, Recharts, react-i18next, Supabase JS, Sentry
- Frontend (booking widget): React 19, Vite, Tailwind CSS v4, react-day-picker, Google Maps loader, Sentry
- Backend: Node 20, Express 4, TypeScript, Zod, node-cron, Helmet, express-rate-limit, Winston, Resend, Sentry
- Database and auth: Supabase (Postgres, RLS, Auth)
- Payments: Bancard VPOS 2.0 (staging and live)
- Calendar sync: iCal (Airbnb) and Apify (Airbnb host scraping)
- Email: Resend
- Hosting: Vercel (frontends) and Railway (backend)

## Repository layout

```
backend/                       Express API, jobs, services, migrations
  src/
    routes/                    HTTP routes (admin, booking, payment, ical, units)
    services/                  Domain logic (admin-user, booking, ical-sync, payments)
    jobs/                      node-cron jobs (iCal sync, stuck preauth, abandoned cleanup)
    middleware/                requireAuth, validate, rate limits
    config/                    env, logger, supabase client, Sentry
  migrations/                  Schema migrations (production/ has the canonical set)
  .env.schema                  Required environment variables, with comments

frontend/
  admin-dashboard/             Internal dashboard at admin.parkloftsparaguay.com
  booking-widget/              Public booking flow embedded on the marketing site

branding/                      Favicons and Bancard partner logos
```

There is no top-level `package.json`. Each app installs and runs independently.

## Local setup

### Requirements

- Node 20 LTS (managed with `nvm` recommended)
- npm 10+ (workspaces are not used)
- A Supabase project with the migrations in `backend/migrations/production/` applied
- A Bancard VPOS 2.0 sandbox commerce (public + private key) for end-to-end payment testing
- A Resend account and API key for transactional email
- Optional: an Apify account if you need the one-click Airbnb sync flow

### Environment variables

The backend reads its configuration from `backend/.env`. Use `backend/.env.schema` as the canonical reference for which variables are required and what they mean. Never commit `.env`.

The frontend apps read Vite-prefixed variables from their own `.env` files:

- `frontend/admin-dashboard/.env`: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_SENTRY_DSN`
- `frontend/booking-widget/.env`: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, plus widget-specific keys (Google Maps API key, Sentry DSN)

If a frontend boots without its required variables, it shows a configuration error screen instead of crashing.

### Install and run

```
# Backend
cd backend
npm install
npm run dev                       # tsx watch on http://localhost:3000

# Admin dashboard
cd frontend/admin-dashboard
npm install
npm run dev                       # vite on http://localhost:5174

# Booking widget
cd frontend/booking-widget
npm install
npm run dev                       # vite on default port (5173)
```

### Database migrations

Migrations live in `backend/migrations/production/` and are numbered sequentially. Apply them in order against your Supabase project using the SQL editor or the Supabase CLI. The most recent migrations cover admin user accounts (`012_admin_users.sql`), the settings table (`014_create_settings_table.sql`), the bathrooms column (`015_add_bathrooms_column.sql`), and check-in / check-out booking statuses (`016_booking_status_checkin_checkout.sql`).

There is no automated migration runner in the repo. Run new migrations manually and commit them in the same PR as the code that depends on them.

## Creating the first admin user

The dashboard now ships a Team Members UI under Settings (admin-only tab) that handles invites, password resets, and deactivations. To bootstrap the first admin before the UI is reachable, do it from Supabase directly:

1. In Supabase Auth, create a user with email and password (or send a magic link), then capture the resulting `auth.users.id`.
2. In the SQL editor, insert the matching row in `public.admin_users`:

```sql
insert into public.admin_users (auth_id, name, email, role, status)
values ('<auth_users_uuid>', 'Gaston Lopez', 'gaston@thebrightidea.ai', 'admin', 'active');
```

3. Sign in to the dashboard. From there, invite the rest of the team via Settings to Team Members.

The `admin_users` table enforces a hard cap of 10 rows via a database trigger.

## Deploy

### Frontend (admin dashboard and booking widget)

Both frontends deploy to Vercel through the GitHub integration. Pushing to `main` triggers a production build.

Do not run `vercel --prod` manually. The Git integration is the single source of truth and a manual push from a developer machine has, in the past, deployed an outdated commit. To ship a frontend change:

```
git push origin main
```

Vercel picks it up, runs the build, and promotes it to production.

### Backend (API on Railway)

The backend runs on Railway, project `PL Rent Manager`, service `backend`. Production environment variables live in Railway and are managed via the Railway dashboard or CLI:

```
cd backend
railway status                    # confirm you are on the production env
railway variables                 # read current config
railway variables set KEY=VALUE   # write a single variable
```

Deploys from `main` are configured through the Railway GitHub integration. If you ever need a manual push (for example to deploy from a branch without merging):

```
cd backend
railway up
```

Use the manual path sparingly. The default flow is the same as the frontends: merge to `main`, Railway builds and rolls out.

The backend domain is `api.rent.parkloftsparaguay.com`.

## Active cron jobs

The backend boots three node-cron jobs from `src/index.ts`. All three log on every run and are safe to rerun (idempotent):

- iCal sync (`backend/src/jobs/ical-cron.ts`): runs every `SYNC_INTERVAL_MINUTES` (default 15). Pulls Airbnb iCal feeds for every active unit and updates the `availability` table.
- Stuck preauthorization alert (`backend/src/jobs/stuck-preauth-alert.ts`): runs daily at 09:00 America/Asuncion. Emails `ALERT_EMAIL_TO` when a manual-path booking has had a preauthorized payment for more than `PREAUTH_STUCK_ALERT_DAYS` days (default 5). Does not mutate state, only alerts.
- Abandoned booking cleanup (`backend/src/jobs/abandoned-booking-cleanup.ts`): runs every 30 minutes. Releases widget-source date blocks for pending bookings older than `PENDING_EXPIRY_HOURS` that never completed checkout. Manual-path holds with a preauthorized payment are explicitly excluded.

## Troubleshooting

### Payments are not actually charging in dev

Check `PAYMENT_MODE`. The intended values are `stub` (no Bancard calls, used for local dev and tests), `staging` (Bancard sandbox), and `live` (production VPOS). Local `.env` should always be `stub` unless you are explicitly testing the staging integration with the sandbox keys.

### Airbnb iCal sync is rate-limited or returns stale data

Airbnb publishes calendar feeds with a few minutes of cache. Polling more frequently than every 10 minutes does not return fresher data and increases the chance of being temporarily throttled. Keep `SYNC_INTERVAL_MINUTES` at 15 in production. If a single unit looks stuck, hit the manual sync action from Settings to Sync.

### CORS errors after adding a new frontend origin

Update `CORS_EXTRA_ORIGINS` (comma-separated list) and redeploy the backend, or add the origin to `FRONTEND_URL` or `ADMIN_DASHBOARD_URL` if it is the canonical one. The CORS middleware deliberately answers with no `Access-Control-Allow-Origin` header instead of throwing, so the browser surfaces a clean failure in the console.

### Cannot sign in to the dashboard, or the dashboard says you are not an admin

Two things to verify:

1. The user exists in Supabase Auth (Authentication, Users in the Supabase dashboard).
2. There is a row in `public.admin_users` with `auth_id` set to that auth user's UUID, `status = 'active'`, and the right `role`. The Team Members UI keeps these in sync, but a manually-created Auth user will not have the `admin_users` row until you insert it.

### Bancard returns "invalid signature" in staging

Confirm `BANCARD_PUBLIC_KEY` and `BANCARD_PRIVATE_KEY` belong to the same commerce and to the same environment (`BANCARD_API_URL` must match). Mixing a staging public key with a live private key is the most common cause and the error message is generic.

### Email invites not arriving

The backend uses Resend through `src/services/email.service.ts` with `RESEND_API_KEY` and sends from `EMAIL_FROM`. Check Resend logs for delivery status. Spam filters tend to flag unrecognized domains, so verify the sending domain in Resend before going live.
