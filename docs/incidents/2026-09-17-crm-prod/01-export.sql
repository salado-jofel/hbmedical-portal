-- ============================================================================
-- 01-export.sql — READ-ONLY. Copies the client's CRM data out as JSON so the
-- rebuild can re-import it. Run each statement in the SQL Editor, click the
-- single result cell, copy, and save as the named file under
-- docs/incidents/2026-09-17-crm-prod/export/ (git-ignored if it holds PHI —
-- leads are business contacts, not patients, but keep it out of git anyway).
-- ============================================================================

-- export/crm_leads.json
select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(l) order by l.created_at), '[]'))
  from public.crm_leads l;

-- export/crm_sequences.json  (templates + their steps, nested)
select jsonb_pretty(coalesce(jsonb_agg(
         to_jsonb(s) || jsonb_build_object('steps',
           (select coalesce(jsonb_agg(to_jsonb(st) order by st.step_index), '[]')
              from public.crm_sequence_steps st where st.sequence_id = s.id))
         order by s.created_at), '[]'))
  from public.crm_sequences s;

-- export/crm_enrollments.json
select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(e) order by e.created_at), '[]'))
  from public.crm_enrollments e;

-- export/crm_reminder_settings.json
select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(s)), '[]'))
  from public.crm_reminder_settings s;

-- export/crm_reminder_log.json
select jsonb_pretty(coalesce(jsonb_agg(to_jsonb(x) order by x.created_at), '[]'))
  from public.crm_reminder_log x;

-- export/crm_rows_in_core_tables.json  (what the CRM wrote into YOUR tables)
select jsonb_pretty(jsonb_build_object(
  'tasks',         (select coalesce(jsonb_agg(to_jsonb(t)), '[]') from public.tasks t
                     where t.source <> 'manual' or t.lead_id is not null),
  'contacts',      (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.contacts c
                     where c.facility_id is null or c.lead_id is not null),
  'activities',    (select coalesce(jsonb_agg(to_jsonb(a)), '[]') from public.activities a
                     where a.facility_id is null or a.lead_id is not null or a.type in ('gift','lunch')),
  'notifications', (select coalesce(jsonb_agg(to_jsonb(n)), '[]') from public.notifications n
                     where n.type like 'crm_%' or n.order_id is null)
));
