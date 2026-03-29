begin;

-- 1) Allow 'admin' in public.profiles.role
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role = any (
      array[
        'sales_representative'::text,
        'doctor'::text,
        'admin'::text
      ]
    )
  );

-- 2) Optional helper function for server-side checks / RLS
create or replace function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = coalesce(check_user_id, auth.uid())
      and p.role = 'admin'
  );

$$;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to service_role;

commit;
