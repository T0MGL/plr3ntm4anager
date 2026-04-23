-- ============================================================================
-- 012_admin_users.sql
-- Admin user accounts for the Park Lofts Rent Manager dashboard.
--
-- Design:
--   - Hard-enforced cap of 10 rows via a CHECK constraint + before-insert
--     trigger so the limit survives concurrent inserts.
--   - auth_id is nullable: the row exists before Supabase Auth is provisioned
--     (e.g., after a failed invite), and is filled in on reinvite.
--   - RLS is enabled but no public policy is granted; access is exclusively
--     through the service-role key, which bypasses RLS.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'admin_role') then
    create type admin_role as enum ('admin', 'staff');
  end if;

  if not exists (select 1 from pg_type where typname = 'admin_status') then
    create type admin_status as enum ('active', 'inactive');
  end if;
end
$$;

create table if not exists public.admin_users (
  id         uuid         primary key default gen_random_uuid(),
  auth_id    uuid         unique references auth.users(id) on delete set null,
  name       text         not null check (char_length(name) between 2 and 200),
  email      citext       not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role       admin_role   not null default 'staff',
  status     admin_status not null default 'active',
  created_at timestamptz  not null default now(),
  updated_at timestamptz  not null default now()
);

comment on table public.admin_users is 'Dashboard admin accounts, capped at 10 rows. auth_id links to Supabase Auth.';
comment on column public.admin_users.auth_id is 'Nullable: set after first successful invite. Re-invite fills it in when missing.';

-- updated_at trigger (reuses the function created in 004_triggers_and_functions.sql)
drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at
  before update on public.admin_users
  for each row execute function public.set_updated_at();

-- Hard cap: no more than 10 rows total
create or replace function public.enforce_admin_users_cap()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.admin_users) >= 10 then
    raise exception 'admin_users cap reached: maximum 10 users allowed'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_admin_users_cap on public.admin_users;
create trigger trg_admin_users_cap
  before insert on public.admin_users
  for each row execute function public.enforce_admin_users_cap();

-- Performance index for email lookups (invite deduplication, auth resolution)
create index if not exists idx_admin_users_email on public.admin_users (email);
create index if not exists idx_admin_users_status on public.admin_users (status);

-- RLS: enabled, no public policy. Service-role key bypasses RLS entirely.
alter table public.admin_users enable row level security;
