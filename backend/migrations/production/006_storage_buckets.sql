-- ============================================================================
-- 006_storage_buckets.sql
-- Storage bucket for unit photos.
--
-- Backend uploads via service role using admin.routes.ts (multer memory).
-- Public read is required because the booking widget renders photos in <img>.
-- Writes are closed to anyone except service_role.
--
-- Bucket name intentionally clean (`units`). The dev project used
-- `Airbnd bucket` which is fragile and URL-encoded badly. Do not reuse it.
-- Update SUPABASE_STORAGE_BUCKET=units in Railway when switching.
-- ============================================================================

-- Create bucket if it does not exist. public=true so `getPublicUrl` works.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'units',
  'units',
  true,
  10 * 1024 * 1024,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif'
  ]
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- Storage policies.
-- Supabase storage uses RLS on storage.objects scoped by bucket_id.
-- ----------------------------------------------------------------------------

-- Public read of units bucket (mirrors public=true, explicit for defense in depth).
drop policy if exists "units_public_read" on storage.objects;
create policy "units_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'units');

-- Only service role can write, update or delete.
drop policy if exists "units_service_insert" on storage.objects;
create policy "units_service_insert"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'units');

drop policy if exists "units_service_update" on storage.objects;
create policy "units_service_update"
  on storage.objects for update
  to service_role
  using (bucket_id = 'units') with check (bucket_id = 'units');

drop policy if exists "units_service_delete" on storage.objects;
create policy "units_service_delete"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'units');
