-- Lets the crm-scheduler edge function (service role) read the cron shared secret. Nobody else.
create or replace function public.crm_vault_secret(p_name text)
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;
revoke execute on function public.crm_vault_secret(text) from public, authenticated, anon;
grant  execute on function public.crm_vault_secret(text) to service_role;

-- same lock-down for the scheduler-only readers
revoke execute on function public.crm_due_followups(uuid), public.crm_admin_digest(), public.crm_run_reorder_scan(), public.crm_bell_reminders() from public;
grant  execute on function public.crm_due_followups(uuid), public.crm_admin_digest(), public.crm_run_reorder_scan(), public.crm_bell_reminders() to service_role;
