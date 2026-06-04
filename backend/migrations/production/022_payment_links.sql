-- ============================================================================
-- 022_payment_links.sql
-- Standalone payment links. An admin creates a link with an amount and a
-- concept, sends it to a person, and that person pays by card via the same
-- Bancard vPOS flow used for bookings. Also covers the 1 USD international
-- card test.
--
-- Design:
--   - Amount is stored in USD (authoritative for the admin) plus the PYG
--     amount and effective FX snapshot captured at creation time, mirroring
--     the per-payment snapshot on `payments` (018). PYG is what Bancard
--     charges; storing both makes the link reproducible and auditable.
--   - A link is reusable until paid: a denied card (Bancard response_code 12,
--     etc) leaves the link `active` so the person can retry with another card.
--     The webhook only flips it to `paid` on an approved charge.
--   - payments.booking_id becomes nullable and a new payment_link_id is added.
--     A payment row belongs to exactly one of the two (enforced by CHECK), so
--     the confirmation webhook branches cleanly without guessing.
--   - RLS on, no public policies. Service role only, same posture as payments
--     and booking_requests. The public /pay page reads through the backend
--     service key, never PostgREST directly.
-- ============================================================================

create table if not exists public.payment_links (
  id               uuid           primary key default gen_random_uuid(),
  amount_usd       numeric(12, 2) not null check (amount_usd > 0),
  amount_pyg       numeric(15, 2) not null check (amount_pyg > 0),
  fx_rate_snapshot numeric(12, 4) not null check (fx_rate_snapshot > 0),
  concept          text           not null check (char_length(concept) between 2 and 200),
  status           text           not null default 'active'
                     check (status in ('active', 'paid', 'expired')),
  shop_process_id  text,
  booking_id       uuid           references public.booking_requests(id) on delete set null,
  expires_at       timestamptz,
  paid_at          timestamptz,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now()
);

comment on table public.payment_links is 'Admin-generated standalone card payment links for Park Lofts. Paid via the same Bancard vPOS flow as bookings. Reusable until an approved charge flips status to paid.';
comment on column public.payment_links.amount_pyg is 'PYG amount charged by Bancard, computed from amount_usd at the FX rate captured in fx_rate_snapshot at creation.';
comment on column public.payment_links.fx_rate_snapshot is 'Effective USD/PYG rate (market * markup) used to compute amount_pyg when the link was created.';
comment on column public.payment_links.shop_process_id is 'Last Bancard shop_process_id associated with this link. Updated on each pay attempt so the webhook can match back.';
comment on column public.payment_links.booking_id is 'Optional link to a booking when the payment relates to an existing reservation. Nullable for ad hoc charges and the 1 USD test.';

-- Reuse the generic updated_at trigger function installed by 004.
drop trigger if exists trg_payment_links_updated_at on public.payment_links;
create trigger trg_payment_links_updated_at
  before update on public.payment_links
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- payments: support both bookings and payment links on one row.
-- booking_id goes nullable; payment_link_id is added; exactly one must be set.
-- ----------------------------------------------------------------------------
alter table public.payments
  alter column booking_id drop not null;

alter table public.payments
  add column if not exists payment_link_id uuid
    references public.payment_links(id) on delete cascade;

comment on column public.payments.payment_link_id is 'Set when this payment was initiated from a payment_link instead of a booking. Mutually exclusive with booking_id.';

-- A payment belongs to exactly one parent. Guards against orphan or dual-owned
-- rows that would make the confirmation webhook ambiguous.
alter table public.payments
  drop constraint if exists payments_one_parent;
alter table public.payments
  add constraint payments_one_parent
  check (
    (booking_id is not null and payment_link_id is null) or
    (booking_id is null and payment_link_id is not null)
  );

-- ----------------------------------------------------------------------------
-- indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_payment_links_status     on public.payment_links (status);
create index if not exists idx_payment_links_created_at on public.payment_links (created_at desc);
create index if not exists idx_payment_links_booking_id on public.payment_links (booking_id);

create index if not exists idx_payments_payment_link_id on public.payments (payment_link_id);

-- Partial index mirroring idx_payments_active_per_booking for the link path,
-- used to reuse an in-flight payment instead of creating a duplicate.
create index if not exists idx_payments_active_per_link
  on public.payments (payment_link_id)
  where payment_status in ('pending', 'preauthorized');

-- ----------------------------------------------------------------------------
-- RLS: service-role only, fail closed for anon/authenticated.
-- ----------------------------------------------------------------------------
alter table public.payment_links enable row level security;
alter table public.payment_links force row level security;

drop policy if exists payment_links_service_all on public.payment_links;
create policy payment_links_service_all
  on public.payment_links for all
  to service_role
  using (true) with check (true);

revoke all on public.payment_links from anon, authenticated;
grant all on public.payment_links to service_role;
