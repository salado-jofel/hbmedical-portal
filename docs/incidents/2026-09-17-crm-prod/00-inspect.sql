-- ============================================================================
-- 00-inspect.sql — READ-ONLY. Run in Supabase Dashboard → SQL Editor on the
-- PRODUCTION project (ersdsmuybpfvgvaiwcgl) BEFORE 02-reverse.sql.
-- ONE query → ONE result set (the editor only shows the last statement's
-- output, so everything is folded into a single SELECT).
-- ============================================================================
select * from (

  -- 1. Scheduler state — did anything ever actually send?
  select 10 as ord, 'settings' as section, to_jsonb(s) - 'digest_recipients' as detail
    from public.crm_reminder_settings s
  union all
  select 11, 'reminder_log by kind/channel/status',
         jsonb_build_object('kind', kind, 'channel', channel, 'status', status, 'n', count(*))
    from public.crm_reminder_log group by kind, channel, status
  union all
  select 12, 'cron job', jsonb_build_object('jobid', jobid, 'schedule', schedule, 'active', active)
    from cron.job where jobname = 'crm-scheduler-hourly'
  union all
  select 13, 'vault secrets', jsonb_build_object('name', name, 'created_at', created_at)
    from vault.secrets where name in ('crm_cron_secret','crm_anon_key')

  -- 2. His CRM data (exported by 01-export.sql, then dropped)
  union all select 20, 'crm_leads',          jsonb_build_object('rows', count(*)) from public.crm_leads
  union all select 21, 'crm_sequences',      jsonb_build_object('rows', count(*)) from public.crm_sequences
  union all select 22, 'crm_sequence_steps', jsonb_build_object('rows', count(*)) from public.crm_sequence_steps
  union all select 23, 'crm_enrollments',    jsonb_build_object('rows', count(*)) from public.crm_enrollments

  -- 3. Rows the CRM wrote INTO YOUR tables — the reverse deletes these
  union all select 30, 'tasks: source<>manual / lead / enrollment', jsonb_build_object('rows', count(*))
    from public.tasks where source <> 'manual' or lead_id is not null or enrollment_id is not null
  union all select 31, 'contacts: no facility / lead', jsonb_build_object('rows', count(*))
    from public.contacts where facility_id is null or lead_id is not null
  union all select 32, 'activities: no facility / lead / gift,lunch', jsonb_build_object('rows', count(*))
    from public.activities where facility_id is null or lead_id is not null or type in ('gift','lunch')
  union all select 33, 'notifications: crm_* / lead / task / no order', jsonb_build_object('rows', count(*))
    from public.notifications where type like 'crm_%' or lead_id is not null or task_id is not null or order_id is null

  -- 4. Sunshine Act — every entry, newest first. Decide manually which (if
  --    any) came from crm_log_value_transfer(); the reverse won't touch them.
  union all
  select 40, 'value_transfer_entries',
         jsonb_build_object('id', e.id, 'created_at', e.created_at, 'transfer_date', e.transfer_date,
                            'recipient', e.recipient_name, 'affiliation', e.affiliation,
                            'category', e.form_category, 'amount', e.value_amount,
                            'report_status', r.status, 'report_created', r.created_at, 'rep_id', r.rep_id)
    from public.value_transfer_entries e join public.sales_rep_value_reports r on r.id = e.report_id
  union all
  select 41, 'value_reports created since 2026-09-17',
         jsonb_build_object('id', id, 'rep_id', rep_id, 'year', reporting_year, 'month', reporting_month,
                            'status', status, 'created_at', created_at)
    from public.sales_rep_value_reports where created_at >= '2026-09-17'

  -- 5. Current trigger / policy footprint on YOUR tables
  union all
  select 50, 'trigger', jsonb_build_object('table', event_object_table, 'name', trigger_name)
    from information_schema.triggers
   where trigger_schema = 'public' and (trigger_name like 'crm_%' or trigger_name = 'tasks_completed_touch')
   group by event_object_table, trigger_name
  union all
  select 51, 'policy', jsonb_build_object('table', tablename, 'name', policyname)
    from pg_policies
   where schemaname = 'public'
     and policyname in ('contacts_rep_lead_tree','activities_rep_lead_tree','tasks_rep_tree_read')

  -- 6. Migration history — the six versions the reverse will remove
  union all
  select 60, 'migration', jsonb_build_object('version', version, 'name', name)
    from supabase_migrations.schema_migrations where version like '20260917%'

) x
order by ord, detail::text;
