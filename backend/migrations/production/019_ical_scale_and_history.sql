-- ============================================================================
-- 019_ical_scale_and_history.sql
-- Make the Airbnb iCal sync safe and cheap at 50+ units.
--
-- Two problems fixed here:
--
--   1) History destruction. The previous sync_availability RPC deleted every
--      row with source = 'airbnb' for the unit and reinserted the full set on
--      each run. Airbnb's iCal export only contains current and future stays,
--      so every past Airbnb block was wiped on every poll. That is why the
--      dashboard reports $0 Airbnb revenue for months prior to the current
--      one. The new version only touches rows on or after today (Asuncion),
--      preserving past history forever.
--
--   2) Fan-out. A 15 minute cron on 50 units produced 4,800 GETs per day,
--      none of which reflected reality because Airbnb's iCal CDN caches for
--      ~2h. We add per-unit conditional-GET hints (ETag / Last-Modified), a
--      body SHA-256 fast path, a last_synced_at timestamp, and a stable
--      sync_offset_minutes per unit so the cron can spread per-unit polling
--      evenly across a 2h window.
--
-- Notes:
--   * All date cutoffs are computed in America/Asuncion. Postgres current_date
--     is session UTC, which drifts late evenings Paraguay time.
--   * availability(unit_id, blocked_date) index already exists (003_indexes).
--     We add one more composite index to support the diff-based delete filter.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- units: cache + scheduling columns.
-- ----------------------------------------------------------------------------
alter table public.units
  add column if not exists ical_body_hash       text,
  add column if not exists ical_last_etag       text,
  add column if not exists ical_last_modified   timestamptz,
  add column if not exists last_synced_at       timestamptz,
  add column if not exists sync_offset_minutes  smallint not null
    default (floor(random() * 120))::smallint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'units_sync_offset_minutes_range'
  ) then
    alter table public.units
      add constraint units_sync_offset_minutes_range
      check (sync_offset_minutes between 0 and 119);
  end if;
end
$$;

comment on column public.units.ical_body_hash is
  'SHA-256 (hex) of the last fetched iCal body. Used as a cheap no-change fast path when Airbnb ignores conditional GET.';
comment on column public.units.ical_last_etag is
  'ETag returned by Airbnb on the last 200 response. Replayed in If-None-Match to elicit a 304.';
comment on column public.units.ical_last_modified is
  'Last-Modified returned by Airbnb on the last 200 response. Replayed in If-Modified-Since.';
comment on column public.units.last_synced_at is
  'Wall-clock timestamp (UTC) of the last completed sync attempt, regardless of no_change / 304 / update outcome.';
comment on column public.units.sync_offset_minutes is
  'Stable per-unit offset in [0,119]. The cron fires a unit when (minute of the hour-mod-120) matches, spreading 50+ units across a 2h window.';

-- ----------------------------------------------------------------------------
-- Scheduling index. The cron picks units due for a sync by last_synced_at.
-- ----------------------------------------------------------------------------
create index if not exists idx_units_last_synced
  on public.units (last_synced_at nulls first)
  where status = 'active';

-- ----------------------------------------------------------------------------
-- Support the diff-based sync_availability: we filter by (unit_id, source,
-- blocked_date) to select "future Airbnb rows only". The existing
-- idx_availability_unit_date covers (unit_id, blocked_date) so this one is
-- complementary and cheap.
-- ----------------------------------------------------------------------------
create index if not exists idx_availability_unit_source_date
  on public.availability (unit_id, source, blocked_date);

-- ----------------------------------------------------------------------------
-- sync_logs: record a no-change path so the admin UI can distinguish "polled,
-- nothing to do" from "never ran".
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'sync_status' and e.enumlabel = 'no_change'
  ) then
    alter type sync_status add value if not exists 'no_change';
  end if;
end
$$;

-- Optional observability columns. Nullable so existing inserts keep working.
alter table public.sync_logs
  add column if not exists http_status        smallint,
  add column if not exists rows_inserted      integer,
  add column if not exists rows_deleted       integer,
  add column if not exists etag_hit           boolean,
  add column if not exists body_hash_hit      boolean;

-- ----------------------------------------------------------------------------
-- sync_availability, diff-based.
--
-- Input:
--   p_unit_id        uuid
--   p_blocked_dates  date[]  (the blocked dates Airbnb currently reports)
--
-- Behavior:
--   * Cutoff = today in America/Asuncion. Rows with blocked_date < cutoff are
--     NEVER touched. This preserves past history Airbnb no longer exports.
--   * From the cutoff forward:
--       - Insert rows present in the input but not in the DB.
--       - Delete rows present in the DB (source = 'airbnb') but not in the
--         input. Those represent stays Airbnb released.
--   * Widget / manual rows are untouched regardless of date.
--
-- Returns: jsonb { "inserted": int, "deleted": int } so the caller can log a
-- meaningful diff instead of always 0.
-- ----------------------------------------------------------------------------
drop function if exists public.sync_availability(uuid, date[]);

create or replace function public.sync_availability(
  p_unit_id       uuid,
  p_blocked_dates date[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cutoff   date;
  v_inserted integer := 0;
  v_deleted  integer := 0;
  v_input    date[];
begin
  v_cutoff := (current_timestamp at time zone 'America/Asuncion')::date;
  v_input  := coalesce(p_blocked_dates, array[]::date[]);

  -- Delete future Airbnb rows not in the new input. History (< cutoff) is
  -- never touched.
  with removed as (
    delete from public.availability
     where unit_id      = p_unit_id
       and source       = 'airbnb'
       and blocked_date >= v_cutoff
       and not (blocked_date = any (v_input))
    returning 1
  )
  select count(*) into v_deleted from removed;

  -- Insert missing future rows. on conflict guards against races and also
  -- handles dates that already exist as widget or manual (unique constraint
  -- is on (unit_id, blocked_date) regardless of source).
  with incoming as (
    select p_unit_id as unit_id, d as blocked_date, 'airbnb'::availability_source as source
      from unnest(v_input) d
     where d >= v_cutoff
  ),
  added as (
    insert into public.availability (unit_id, blocked_date, source)
    select unit_id, blocked_date, source from incoming
    on conflict (unit_id, blocked_date) do nothing
    returning 1
  )
  select count(*) into v_inserted from added;

  return jsonb_build_object(
    'inserted', v_inserted,
    'deleted',  v_deleted
  );
end;
$$;

comment on function public.sync_availability(uuid, date[]) is
  'Diff-based Airbnb sync. Inserts missing future rows, deletes released future rows. History (before America/Asuncion today) is never touched. Returns {inserted, deleted}.';

revoke all on function public.sync_availability(uuid, date[]) from public;
grant execute on function public.sync_availability(uuid, date[]) to service_role;
