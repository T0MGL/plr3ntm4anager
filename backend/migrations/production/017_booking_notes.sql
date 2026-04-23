-- ============================================================================
-- 017_booking_notes.sql
-- Internal notes attached to a booking_request for the admin team.
--
-- Append-only by design: no UPDATE or DELETE policy is granted because notes
-- are part of the operational audit trail. If the team later needs editing,
-- it should be modeled as a soft delete + new row, not in-place mutation.
--
-- RLS is enabled with no public policy. The service-role key bypasses RLS so
-- the backend continues to read/write through supabaseAdmin. Direct anon
-- access from the widget is impossible.
-- ============================================================================

create table if not exists public.booking_notes (
  id          uuid        primary key default gen_random_uuid(),
  booking_id  uuid        not null references public.booking_requests(id) on delete cascade,
  author_id   uuid        not null references public.admin_users(id) on delete restrict,
  content     text        not null check (char_length(trim(content)) between 1 and 5000),
  created_at  timestamptz not null default now()
);

comment on table  public.booking_notes is 'Internal admin-only notes per booking. Append-only audit trail.';
comment on column public.booking_notes.author_id is 'admin_users.id of the note author. on delete restrict so deactivating an admin does not erase their notes.';

-- Listing notes for a booking is by far the hottest path; index booking_id.
create index if not exists idx_booking_notes_booking_id_created_at
  on public.booking_notes (booking_id, created_at desc);

alter table public.booking_notes enable row level security;
