-- supabase/migrations/20260326170000_marketing_materials_storage.sql

begin;

-- 1) updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;

$$;

-- 2) marketing_materials table
create table if not exists public.marketing_materials (
  id uuid primary key default gen_random_uuid(),

  title text not null,
  description text,
  tag text not null,

  -- Storage reference
  bucket text not null default 'marketing-materials',
  file_path text not null,
  file_name text not null,
  mime_type text,

  sort_order integer not null default 0,
  is_active boolean not null default true,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint marketing_materials_file_path_not_empty
    check (char_length(trim(file_path)) > 0),

  constraint marketing_materials_file_name_not_empty
    check (char_length(trim(file_name)) > 0),

  constraint marketing_materials_bucket_not_empty
    check (char_length(trim(bucket)) > 0),

  constraint marketing_materials_title_not_empty
    check (char_length(trim(title)) > 0),

  constraint marketing_materials_tag_not_empty
    check (char_length(trim(tag)) > 0)
);

-- 3) indexes
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

-- 4) updated_at trigger
drop trigger if exists set_marketing_materials_updated_at on public.marketing_materials;

create trigger set_marketing_materials_updated_at
before update on public.marketing_materials
for each row
execute function public.set_updated_at();

-- 5) table permissions + RLS
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

-- Optional: if you want anon users to see active materials too, uncomment below.
-- grant select on public.marketing_materials to anon;
-- drop policy if exists "Anon users can view active marketing materials"
--   on public.marketing_materials;
-- create policy "Anon users can view active marketing materials"
-- on public.marketing_materials
-- for select
-- to anon
-- using (is_active = true);

-- 6) private storage bucket
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'marketing-materials',
  'marketing-materials',
  false,
  52428800,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 7) storage policies (read-only for authenticated users)
drop policy if exists "Authenticated users can read marketing material files"
  on storage.objects;

create policy "Authenticated users can read marketing material files"
on storage.objects
for select
to authenticated
using (bucket_id = 'marketing-materials');

-- Optional admin/service-role-managed uploads only:
-- No insert/update/delete policies are created here on purpose.
-- Your server actions using the service role key can still manage files.

commit;