-- ============================================================================
-- 018_fx_rates.sql
-- USD/PYG exchange rate persistence + per-payment snapshot.
--
-- Why:
--   Hardcoded USD_TO_PYG_RATE in env was 7800 while market hovered around
--   6315 in April 2026, a 23% inflation that would overcharge guests on every
--   Bancard transaction. We need a live source plus an audit trail tying each
--   payment to the exact rate used so disputes can be reconciled months later.
--
-- Design:
--   - fx_rates stores raw market quotes (no markup applied). One row per
--     fetch, retained for history. Latest row is source of truth.
--   - fx_rate_snapshot on payments captures the EFFECTIVE rate (market *
--     markup) actually used to compute amount_pyg. amount_usd / snapshot
--     reproduces amount_pyg exactly.
--   - settings.fx_markup_pct is the operator-controlled buffer applied on top
--     of the market rate to absorb FX volatility between booking and payout.
--   - RLS enabled, no public policies. Service role only, same posture as
--     every other admin-owned table.
-- ============================================================================

create table if not exists public.fx_rates (
  id           uuid          primary key default gen_random_uuid(),
  base         char(3)       not null,
  quote        char(3)       not null,
  market_rate  numeric(12,4) not null check (market_rate > 0),
  source       text          not null,
  fetched_at   timestamptz   not null default now(),
  unique (base, quote, fetched_at)
);

comment on table public.fx_rates is 'Historical USD/PYG (and any future pair) market quotes. One row per cron fetch. Latest row by fetched_at desc is current.';
comment on column public.fx_rates.market_rate is 'Mid-market rate as returned by source. Markup is applied at read time, not stored here.';
comment on column public.fx_rates.source is 'open.er-api.com, manual, fallback, etc. Used for audit when a stale or off-market value is suspected.';

create index if not exists idx_fx_rates_pair_fetched
  on public.fx_rates (base, quote, fetched_at desc);

alter table public.fx_rates enable row level security;

-- Per-payment snapshot. Nullable so existing rows are not retroactively touched.
-- Forward-only: every new payment gets the snapshot; old payments can be
-- reconciled from amount_usd / amount_pyg if questioned.
alter table public.payments
  add column if not exists fx_rate_snapshot numeric(12,4);

comment on column public.payments.fx_rate_snapshot is 'Effective USD/PYG rate (market * markup) used to compute amount_pyg at payment time. Null for payments created before 018.';

-- Markup default. 3% absorbs ~72h FX vol plus mid-market vs commercial spread.
-- Operator can override from Settings UI. Stored as text to match the existing
-- settings schema; cast to numeric on read.
insert into public.settings (key, value)
values ('fx_markup_pct', '3.0')
on conflict (key) do nothing;
