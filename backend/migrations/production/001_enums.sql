-- ============================================================================
-- 001_enums.sql
-- Strongly typed status enums. Backed by Postgres enum types rather than free
-- text so the database rejects invalid values instead of the API layer alone.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'unit_status') then
    create type unit_status as enum ('active', 'inactive');
  end if;

  if not exists (select 1 from pg_type where typname = 'booking_status') then
    create type booking_status as enum (
      'pending',
      'approved',
      'rejected',
      'paid',
      'cancelled'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum (
      'pending',
      'preauthorized',
      'completed',
      'failed',
      'refunded'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'sync_status') then
    create type sync_status as enum (
      'in_progress',
      'success',
      'failed'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'availability_source') then
    create type availability_source as enum ('airbnb', 'widget', 'manual');
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_method') then
    create type payment_method as enum ('bancard', 'cash', 'transfer');
  end if;
end
$$;
