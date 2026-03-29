begin;

-- =========================================================
-- contract_materials
-- Private bucket: hbmedical-bucket-private
-- Expected file path prefix: contracts/
-- =========================================================

create table public.contract_materials (
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

  constraint contract_materials_title_not_blank
    check (btrim(title) <> ''),

  constraint contract_materials_tag_not_blank
    check (btrim(tag) <> ''),

  constraint contract_materials_bucket_not_blank
    check (btrim(bucket) <> ''),

  constraint contract_materials_file_path_not_blank
    check (btrim(file_path) <> ''),

  constraint contract_materials_file_name_not_blank
    check (btrim(file_name) <> ''),

  constraint contract_materials_bucket_check
    check (bucket = 'hbmedical-bucket-private'),

  constraint contract_materials_file_path_prefix_check
    check (file_path like 'contracts/%')
);

-- Prevent duplicate records for the same storage object
create unique index contract_materials_bucket_file_path_key
  on public.contract_materials (bucket, file_path);

create index idx_contract_materials_tag
  on public.contract_materials (tag);

create index idx_contract_materials_is_active
  on public.contract_materials (is_active);

create index idx_contract_materials_sort_order
  on public.contract_materials (sort_order);

create index idx_contract_materials_created_at
  on public.contract_materials (created_at desc);

-- =========================================================
-- updated_at trigger helper
-- =========================================================

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;

$$;

create trigger set_contract_materials_updated_at
before update on public.contract_materials
for each row
execute function public.set_row_updated_at();

-- =========================================================
-- RLS
-- =========================================================

alter table public.contract_materials enable row level security;

-- Authenticated users can read active contract materials
create policy "Authenticated users can view active contract materials"
on public.contract_materials
for select
to authenticated
using (is_active = true);

grant select on public.contract_materials to authenticated;
grant select on public.contract_materials to service_role;

commit;
