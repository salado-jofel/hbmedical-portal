-- ============================================================================
-- 02-reverse.sql — exact reverse of the six crm_* migrations applied to
-- PRODUCTION on 2026-09-17. Restores the schema to
--   20260626000000 allow_uploaded_ivr_document_type
-- and removes the six versions from the migration history so the repo's
-- pending migrations apply with a plain `supabase db push`.
--
-- RUN ONLY:
--   • on the production project ersdsmuybpfvgvaiwcgl
--   • with maintenance mode ON
--   • after 00-inspect.sql was reviewed and 01-export.sql output was saved
--   • as ONE transaction (the whole file, SQL Editor → Run). Any failure
--     rolls everything back; nothing is half-applied.
--
-- Every step is annotated with the original migration it reverses.
-- Steps 1–3 are DESTRUCTIVE to the client's CRM data (exported in step 01).
-- ============================================================================
begin;

-- ---------------------------------------------------------------------------
-- 1. Scheduler first — stop anything from firing mid-reverse.
--    (reverses crm_scheduler)
-- ---------------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'crm-scheduler-hourly';
delete from vault.secrets where name in ('crm_cron_secret', 'crm_anon_key');

-- ---------------------------------------------------------------------------
-- 2. Detach the CRM from YOUR tables: triggers + policies.
--    (reverses crm_logic + crm_core_schema)
-- ---------------------------------------------------------------------------
drop trigger if exists crm_task_done_hook       on public.tasks;
drop trigger if exists tasks_completed_touch    on public.tasks;
drop trigger if exists crm_activity_stage_hook  on public.activities;
drop trigger if exists crm_facility_link_hook   on public.facilities;
drop trigger if exists crm_invite_used_hook     on public.invite_tokens;
drop trigger if exists crm_order_stage_hook     on public.orders;

drop policy if exists contacts_rep_lead_tree    on public.contacts;
drop policy if exists activities_rep_lead_tree  on public.activities;
drop policy if exists tasks_rep_tree_read       on public.tasks;

-- ---------------------------------------------------------------------------
-- 3. Remove the rows the CRM wrote into YOUR tables.
--    These are the exact predicates 00-inspect.sql counted. Real data never
--    matches them: your app never writes source<>'manual', lead_id,
--    facility-less contacts/activities, gift/lunch activities, or crm_*
--    notifications.
-- ---------------------------------------------------------------------------
delete from public.tasks         where source <> 'manual' or lead_id is not null or enrollment_id is not null;
delete from public.notifications where type like 'crm_%' or lead_id is not null or task_id is not null or order_id is null;
delete from public.activities    where facility_id is null or lead_id is not null or type in ('gift','lunch');
delete from public.contacts      where facility_id is null or lead_id is not null;

-- Sunshine Act rows created by crm_log_value_transfer(): NOT deleted
-- automatically — decide per row from 00-inspect.sql §4. If a row is his,
-- delete it explicitly here before proceeding, e.g.:
--   delete from public.value_transfer_entries where id in ('<uuid>', ...);
--   delete from public.sales_rep_value_reports r where r.id = '<uuid>'
--     and not exists (select 1 from public.value_transfer_entries e where e.report_id = r.id);

-- ---------------------------------------------------------------------------
-- 4. Views first — crm_lead_overview depends on tasks/contacts columns that
--    step 5 drops, and both views depend on the CRM tables.
--    (reverses crm_logic + crm_reorder_radar_min_history)
-- ---------------------------------------------------------------------------
drop view if exists public.crm_lead_overview;
drop view if exists public.crm_reorder_radar;

-- ---------------------------------------------------------------------------
-- 5. Restore YOUR tables to their baseline shape. Dropping these columns
--    also drops their FKs to crm_leads / crm_enrollments, which is what
--    lets step 6 drop those tables without CASCADE.
--    (reverses crm_core_schema — order matters: constraints → columns)
-- ---------------------------------------------------------------------------
-- notifications: baseline had order_id + order_number NOT NULL, no CHECK.
alter table public.notifications drop constraint if exists notifications_order_required_unless_crm;
alter table public.notifications drop column if exists lead_id;
alter table public.notifications drop column if exists task_id;
alter table public.notifications alter column order_id     set not null;
alter table public.notifications alter column order_number set not null;

-- tasks: six added columns (FK tasks_enrollment_fk + indexes go with them).
alter table public.tasks drop constraint if exists tasks_enrollment_fk;
alter table public.tasks drop column if exists enrollment_id;
alter table public.tasks drop column if exists step_index;
alter table public.tasks drop column if exists step_type;
alter table public.tasks drop column if exists source;
alter table public.tasks drop column if exists completed_at;
alter table public.tasks drop column if exists lead_id;

-- contacts / activities: lead_id, relaxed NOT NULL, or-lead CHECKs.
alter table public.contacts   drop constraint if exists contacts_facility_or_lead;
alter table public.activities drop constraint if exists activities_facility_or_lead;
alter table public.contacts   drop column if exists lead_id;
alter table public.activities drop column if exists lead_id;
alter table public.contacts   alter column facility_id set not null;
alter table public.activities alter column facility_id set not null;

-- activities.type: baseline CHECK is exactly these four.
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check
  check (type = any (array['visit'::text, 'call'::text, 'email'::text, 'demo'::text]));

-- ---------------------------------------------------------------------------
-- 6. Drop the CRM tables (FK order: children first). Their own triggers
--    (crm_leads_stage_touch, crm_lead_invite_hook, *_set_updated_at) go
--    with them — which is why functions are dropped AFTER this step.
--    (reverses crm_core_schema)
-- ---------------------------------------------------------------------------
drop table if exists public.crm_reminder_log;
drop table if exists public.crm_reminder_settings;
drop table if exists public.crm_enrollments;
drop table if exists public.crm_sequence_steps;
drop table if exists public.crm_sequences;
drop table if exists public.crm_leads;

-- ---------------------------------------------------------------------------
-- 7. Functions — nothing depends on them any more (triggers went in steps
--    2 and 6, views in step 4). Order within the list doesn't matter.
--    (reverses crm_core_schema, crm_logic, crm_scheduler, crm_vault_helper)
-- ---------------------------------------------------------------------------
drop function if exists public.crm_vault_secret(text);
drop function if exists public.crm_my_followups(uuid);
drop function if exists public.crm_admin_digest_guarded();
drop function if exists public.crm_bell_reminders();
drop function if exists public.crm_admin_digest();
drop function if exists public.crm_due_followups(uuid);
drop function if exists public.crm_run_reorder_scan();
drop function if exists public.crm_log_value_transfer(uuid, date, text, numeric, text, boolean, uuid, uuid);
drop function if exists public.crm_order_stage_hook();
drop function if exists public.crm_invite_used_hook();
drop function if exists public.crm_facility_link_hook();
drop function if exists public.crm_lead_invite_hook();
drop function if exists public.crm_activity_stage_hook();
drop function if exists public.crm_task_done_hook();
drop function if exists public.crm_stop_sequence(uuid);
drop function if exists public.crm_start_sequence(uuid, uuid, date);
drop function if exists public.crm_lead_display(uuid, uuid);
drop function if exists public.tasks_completed_touch();
drop function if exists public.crm_leads_stage_touch();
drop function if exists public.crm_rep_tree(uuid);
drop function if exists public.crm_is_rep();
drop function if exists public.crm_is_admin();

-- ---------------------------------------------------------------------------
-- 8. Extensions he installed (verified absent on the dev branch 2026-09-21).
--    (reverses crm_scheduler)
-- ---------------------------------------------------------------------------
drop extension if exists pg_net;
drop extension if exists pg_cron;

-- ---------------------------------------------------------------------------
-- 9. Migration history — remove the six versions so prod's newest version
--    is 20260626000000 again. This is what `supabase migration repair
--    --status reverted` does; doing it here keeps everything in one
--    transaction and avoids a second CLI/password round-trip.
-- ---------------------------------------------------------------------------
delete from supabase_migrations.schema_migrations
 where version in ('20260917122004', '20260917122208', '20260917122259',
                   '20260917122449', '20260917122713', '20260917122739');

commit;

-- ---------------------------------------------------------------------------
-- 10. Self-check (runs AFTER commit so the editor displays it — it only
--    shows the last statement's result). Every count must be 0. If any
--    isn't, stop and report it; the transaction above is already durable,
--    so the fix is a follow-up statement, not a rollback.
-- ---------------------------------------------------------------------------
select 'crm tables left'    as check_, count(*) from pg_tables where schemaname = 'public' and tablename like 'crm_%'
union all select 'crm functions left', count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                                                  where n.nspname = 'public' and p.proname like 'crm_%'
union all select 'crm views left',     count(*) from pg_views where schemaname = 'public' and viewname like 'crm_%'
union all select 'crm triggers left',  count(*) from information_schema.triggers where trigger_schema = 'public'
                                                  and (trigger_name like 'crm_%' or trigger_name = 'tasks_completed_touch')
union all select 'crm policies left',  count(*) from pg_policies where schemaname = 'public'
                                                  and policyname in ('contacts_rep_lead_tree','activities_rep_lead_tree','tasks_rep_tree_read')
union all select 'crm columns left',   count(*) from information_schema.columns where table_schema = 'public'
                                                  and ((table_name = 'tasks' and column_name in ('lead_id','source','step_type','enrollment_id','step_index','completed_at'))
                                                    or (table_name in ('contacts','activities','notifications') and column_name in ('lead_id','task_id')))
union all select 'crm history left',   count(*) from supabase_migrations.schema_migrations where version like '20260917%'
union all select 'pg_cron/pg_net left', count(*) from pg_extension where extname in ('pg_cron','pg_net');
