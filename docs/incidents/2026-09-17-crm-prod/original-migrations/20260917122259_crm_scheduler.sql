-- ============================================================================
-- CRM Phase 2 — scheduler. pg_cron pings the crm-scheduler edge function every
-- hour; the function decides (in the configured timezone) whether it is time
-- for rep reminders, the admin digest, or the nightly reorder scan.
-- ============================================================================
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

-- tighten the two reader functions: service role (no JWT), admins, or a rep for their own tree
create or replace function public.crm_admin_digest_guarded()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.crm_is_admin() then raise exception 'Admins only'; end if;
  return public.crm_admin_digest();
end $$;
revoke execute on function public.crm_admin_digest() from authenticated, anon;
grant  execute on function public.crm_admin_digest_guarded() to authenticated;

create or replace function public.crm_my_followups(p_rep uuid default auth.uid())
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.crm_is_admin() and p_rep not in (select public.crm_rep_tree(auth.uid())) then
    raise exception 'Not allowed';
  end if;
  return public.crm_due_followups(p_rep);
end $$;
revoke execute on function public.crm_due_followups(uuid) from authenticated, anon;
grant  execute on function public.crm_my_followups(uuid) to authenticated;

-- shared secret between the cron job and the edge function (never leaves the database / function runtime)
select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'crm_cron_secret', 'Header value pg_cron sends to the crm-scheduler edge function');
-- the anon (publishable) key so the call passes Supabase's JWT gate; it is a public key by design
select vault.create_secret('<anon key redacted in this copy; original in Supabase migration history>', 'crm_anon_key', 'Publishable anon key used by pg_cron to call edge functions');

-- Hourly at :05. The function itself is a no-op unless crm_reminder_settings.is_enabled = true.
select cron.schedule(
  'crm-scheduler-hourly',
  '5 * * * *',
  $cron$
  select net.http_post(
    url     := 'https://ersdsmuybpfvgvaiwcgl.supabase.co/functions/v1/crm-scheduler',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'crm_anon_key'),
                 'x-crm-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'crm_cron_secret')),
    body    := '{"source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 60000);
  $cron$
);
