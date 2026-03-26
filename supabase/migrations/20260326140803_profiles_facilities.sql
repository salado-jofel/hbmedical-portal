-- ============================================
-- Phase 1: Profiles + Facilities
-- Final corrected version for brand-new creation
-- - location removed
-- - stripe_synced_at removed
-- - stripe_customer_id kept
-- - added profiles_email_not_blank
-- - added grants for authenticated + service_role
-- ============================================

create extension if not exists pgcrypto;

-- --------------------------------------------
-- Helper: auto-update updated_at
-- --------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;

$$;

-- ============================================
-- profiles
-- One app-level profile per auth user
-- ============================================
create table if not exists public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  email text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  role text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_email_not_blank
    check (btrim(email) <> ''),

  constraint profiles_first_name_not_blank
    check (btrim(first_name) <> ''),

  constraint profiles_last_name_not_blank
    check (btrim(last_name) <> ''),

  constraint profiles_role_check
    check (role in ('sales_representative', 'doctor')),

  constraint profiles_phone_e164_check
    check (
      phone is null
      or phone ~ '^\+[1-9][0-9]{7,14}$'
    )
);

create unique index if not exists profiles_email_lower_uidx
  on public.profiles (lower(email));

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

comment on table public.profiles is
  'Application profile for each auth user. Exactly one profile per auth.users row.';

comment on column public.profiles.phone is
  'User phone in E.164 format, e.g. +639310259241';

comment on column public.profiles.role is
  'Application role: sales_representative or doctor';

-- ============================================
-- facilities
-- Exactly one facility per user account
-- ============================================
create table if not exists public.facilities (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null unique
    references public.profiles(id)
    on delete cascade,

  name text not null,
  status text not null default 'active',
  contact text not null,
  phone text not null,

  address_line_1 text not null,
  address_line_2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country text not null,

  stripe_customer_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint facilities_name_not_blank
    check (btrim(name) <> ''),

  constraint facilities_contact_not_blank
    check (btrim(contact) <> ''),

  constraint facilities_status_check
    check (status in ('active', 'inactive')),

  constraint facilities_phone_e164_check
    check (
      phone ~ '^\+[1-9][0-9]{7,14}$'
    ),

  constraint facilities_address_line_1_not_blank
    check (btrim(address_line_1) <> ''),

  constraint facilities_city_not_blank
    check (btrim(city) <> ''),

  constraint facilities_state_not_blank
    check (btrim(state) <> ''),

  constraint facilities_postal_code_not_blank
    check (btrim(postal_code) <> ''),

  constraint facilities_country_iso2_check
    check (country ~ '^[A-Z]{2}$')
);

create unique index if not exists facilities_stripe_customer_id_uidx
  on public.facilities (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists facilities_user_id_idx
  on public.facilities (user_id);

drop trigger if exists trg_facilities_set_updated_at on public.facilities;
create trigger trg_facilities_set_updated_at
before update on public.facilities
for each row
execute function public.set_updated_at();

comment on table public.facilities is
  'Exactly one facility per user account. Enforced by unique(user_id).';

comment on column public.facilities.user_id is
  '1:1 owner link to public.profiles(id).';

comment on column public.facilities.country is
  'Two-letter ISO country code, e.g. US, PH.';

comment on column public.facilities.phone is
  'Facility phone in E.164 format, e.g. +15550000000';

comment on column public.facilities.stripe_customer_id is
  'Stripe customer id associated with this facility/account for checkout and invoicing.';

-- ============================================
-- RLS
-- Strict owner-only access
-- ============================================
alter table public.profiles enable row level security;
alter table public.facilities enable row level security;

-- Clean re-runs
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;

drop policy if exists facilities_select_own on public.facilities;
drop policy if exists facilities_insert_own on public.facilities;
drop policy if exists facilities_update_own on public.facilities;

-- profiles: user can read/write only own profile
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- facilities: user can read/write only own facility
-- facilities.user_id references public.profiles(id),
-- and profiles.id is the same UUID as auth.users.id
create policy facilities_select_own
on public.facilities
for select
to authenticated
using (user_id = auth.uid());

create policy facilities_insert_own
on public.facilities
for insert
to authenticated
with check (user_id = auth.uid());

create policy facilities_update_own
on public.facilities
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ============================================
-- Grants
-- ============================================
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.facilities to authenticated;

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.facilities to service_role;
