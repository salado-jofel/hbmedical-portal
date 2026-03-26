begin;

-- 1) Reassign any existing admin users before restoring the stricter constraint
update public.profiles
set
  role = 'sales_representative',
  updated_at = timezone('utc', now())
where role = 'admin';

-- 2) Drop helper function
drop function if exists public.is_admin(uuid);

-- 3) Restore original role constraint
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role = any (
      array[
        'sales_representative'::text,
        'doctor'::text
      ]
    )
  );

commit;
