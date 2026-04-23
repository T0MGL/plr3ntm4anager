-- ============================================================================
-- 014_create_settings_table.sql
-- Generic key/value settings store for operator-configurable values.
--
-- Design:
--   - key is the primary key (text), value is always text. Callers cast as
--     needed (e.g. integer host IDs).
--   - updated_at is maintained by the existing set_updated_at() trigger.
--   - RLS is enabled; no public policy. Service-role key only, same pattern
--     as admin_users.
--   - Seeded with the Park Lofts Airbnb host ID so the sync feature works
--     immediately after running this migration.
-- ============================================================================

create table if not exists public.settings (
  key        text        primary key,
  value      text        not null,
  updated_at timestamptz not null default now()
);

comment on table public.settings is 'Operator-configurable key/value pairs. All values stored as text; callers cast as needed.';
comment on column public.settings.key is 'Unique setting identifier, e.g. airbnb_host_id.';
comment on column public.settings.value is 'Setting value as text.';

drop trigger if exists trg_settings_updated_at on public.settings;
create trigger trg_settings_updated_at
  before update on public.settings
  for each row execute function public.set_updated_at();

-- RLS: enabled, no public policy. Service-role key bypasses RLS entirely.
alter table public.settings enable row level security;

-- Seed the default Airbnb host ID for Park Lofts.
-- ON CONFLICT is safe to re-run: it preserves an operator-set value.
insert into public.settings (key, value)
values ('airbnb_host_id', '744342154')
on conflict (key) do nothing;
