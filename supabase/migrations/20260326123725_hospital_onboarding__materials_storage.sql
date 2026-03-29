begin;

-- =========================================================
-- hospital_onboarding_materials
-- Private bucket: hbmedical-bucket-private
-- Expected file path prefix: hospital-onboarding/
-- =========================================================

create table public.hospital_onboarding_materials (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  tag text not null,
  bucket text not null default 'hbmedical-bucket-private',
  file_path text not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  constraint hospital_onboarding_materials_title_not_blank
    check (btrim(title) <> ''),

  constraint hospital_onboarding_materials_tag_not_blank
    check (btrim(tag) <> ''),

  constraint hospital_onboarding_materials_bucket_not_blank
    check (btrim(bucket) <> ''),

  constraint hospital_onboarding_materials_file_path_not_blank
    check (btrim(file_path) <> ''),

  constraint hospital_onboarding_materials_file_name_not_blank
    check (btrim(file_name) <> ''),

  constraint hospital_onboarding_materials_bucket_check
    check (bucket = 'hbmedical-bucket-private'),

  constraint hospital_onboarding_materials_file_path_prefix_check
    check (file_path like 'hospital-onboarding/%')
);

create unique index hospital_onboarding_materials_bucket_file_path_key
  on public.hospital_onboarding_materials (bucket, file_path);

create index idx_hospital_onboarding_materials_tag
  on public.hospital_onboarding_materials (tag);

create index idx_hospital_onboarding_materials_is_active
  on public.hospital_onboarding_materials (is_active);

create index idx_hospital_onboarding_materials_sort_order
  on public.hospital_onboarding_materials (sort_order);

create index idx_hospital_onboarding_materials_created_at
  on public.hospital_onboarding_materials (created_at desc);

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;

$$;

drop trigger if exists set_hospital_onboarding_materials_updated_at
on public.hospital_onboarding_materials;

create trigger set_hospital_onboarding_materials_updated_at
before update on public.hospital_onboarding_materials
for each row
execute function public.set_row_updated_at();

alter table public.hospital_onboarding_materials enable row level security;

drop policy if exists "Authenticated users can view active hospital onboarding materials"
on public.hospital_onboarding_materials;

create policy "Authenticated users can view active hospital onboarding materials"
on public.hospital_onboarding_materials
for select
to authenticated
using (is_active = true);

grant select on public.hospital_onboarding_materials to authenticated;
grant select on public.hospital_onboarding_materials to service_role;

commit;
