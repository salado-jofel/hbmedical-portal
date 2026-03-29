-- supabase/migrations/20260326170000_marketing_materials_storage.sql

begin;

-- ---------------------------------------------------------------------------
-- 0) Helper function for updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;

$$;

-- ---------------------------------------------------------------------------
-- 1) marketing_materials table
--    Files for this table should live in:
--    bucket   = hbmedical-bucket-private
--    file_path like marketing/<filename>
-- ---------------------------------------------------------------------------
create table if not exists public.marketing_materials (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  tag text not null,

  bucket text not null default 'hbmedical-bucket-private',
  file_path text not null,
  file_name text not null,
  mime_type text,

  sort_order integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint marketing_materials_title_not_empty
    check (char_length(trim(title)) > 0),

  constraint marketing_materials_tag_not_empty
    check (char_length(trim(tag)) > 0),

  constraint marketing_materials_bucket_not_empty
    check (char_length(trim(bucket)) > 0),

  constraint marketing_materials_file_path_not_empty
    check (char_length(trim(file_path)) > 0),

  constraint marketing_materials_file_name_not_empty
    check (char_length(trim(file_name)) > 0),

  constraint marketing_materials_file_path_in_marketing_folder
    check (file_path like 'marketing/%')
);

-- Make the migration resilient if you've been iterating on names locally.
alter table public.marketing_materials
  alter column bucket set default 'hbmedical-bucket-private';

update public.marketing_materials
set bucket = 'hbmedical-bucket-private'
where bucket in ('marketing-materials', 'hbmedical--bucket-private');

-- ---------------------------------------------------------------------------
-- 2) Indexes
-- ---------------------------------------------------------------------------
create index if not exists marketing_materials_tag_idx
  on public.marketing_materials (tag);

create index if not exists marketing_materials_is_active_idx
  on public.marketing_materials (is_active);

create index if not exists marketing_materials_sort_order_idx
  on public.marketing_materials (sort_order);

create index if not exists marketing_materials_created_at_idx
  on public.marketing_materials (created_at desc);

create unique index if not exists marketing_materials_bucket_file_path_uidx
  on public.marketing_materials (bucket, file_path);

-- ---------------------------------------------------------------------------
-- 3) updated_at trigger
-- ---------------------------------------------------------------------------
drop trigger if exists set_marketing_materials_updated_at
  on public.marketing_materials;

create trigger set_marketing_materials_updated_at
before update on public.marketing_materials
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4) Table RLS
-- ---------------------------------------------------------------------------
alter table public.marketing_materials enable row level security;

grant select on public.marketing_materials to authenticated;
grant select on public.marketing_materials to service_role;

drop policy if exists "Authenticated users can view active marketing materials"
  on public.marketing_materials;

create policy "Authenticated users can view active marketing materials"
on public.marketing_materials
for select
to authenticated
using (is_active = true);

-- ---------------------------------------------------------------------------
-- 5) Buckets
-- ---------------------------------------------------------------------------
-- Private bucket for PDFs / business docs:
--   marketing/
--   orders/
--   invoices/
--   facilities/
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hbmedical-bucket-private',
  'hbmedical-bucket-private',
  false,
  104857600, -- 100 MB
  null
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket for stable asset URLs:
--   email/
--   brand/
--   avatars/
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'hbmedical-bucket-public',
  'hbmedical-bucket-public',
  true,
  10485760, -- 10 MB
  array[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 6) Storage policies - PRIVATE bucket
-- ---------------------------------------------------------------------------
-- Read access for authenticated users to private files.
-- This is what allows signed URL generation / controlled access flows.
drop policy if exists "Authenticated users can read private bucket files"
  on storage.objects;

create policy "Authenticated users can read private bucket files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hbmedical-bucket-private'
);

-- No client-side write policy is created for the private bucket on purpose.
-- Use dashboard uploads or server-side/service-role actions for:
--   marketing/
--   orders/
--   invoices/
--   facilities/

-- ---------------------------------------------------------------------------
-- 7) Storage policies - PUBLIC bucket
-- ---------------------------------------------------------------------------
-- Public buckets do not need SELECT policies for serving public file URLs.
-- We only define write-management policies here.

-- Users can upload only inside avatars/<their-user-id>/...
drop policy if exists "Users can upload their own avatar files"
  on storage.objects;

create policy "Users can upload their own avatar files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'hbmedical-bucket-public'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users can update their own avatar files"
  on storage.objects;

create policy "Users can update their own avatar files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'hbmedical-bucket-public'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'hbmedical-bucket-public'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "Users can delete their own avatar files"
  on storage.objects;

create policy "Users can delete their own avatar files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'hbmedical-bucket-public'
  and (storage.foldername(name))[1] = 'avatars'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Optional convenience policy if your app ever lists public-bucket object rows
-- through the storage API for authenticated users.
drop policy if exists "Authenticated users can view public bucket object rows"
  on storage.objects;

create policy "Authenticated users can view public bucket object rows"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hbmedical-bucket-public'
);

commit;
