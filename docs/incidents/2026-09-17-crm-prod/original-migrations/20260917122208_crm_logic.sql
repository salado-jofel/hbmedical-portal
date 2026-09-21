-- ============================================================================
-- CRM Phase 2 — logic: sequences, stage automation, Open Payments hook,
-- reorder radar, reminder builders. All functions run as the caller unless
-- they must cross RLS (marked security definer, with explicit auth checks).
-- ============================================================================

-- ---------- lead display name (lead or its facility) ------------------------
create or replace function public.crm_lead_display(p_lead_id uuid, p_facility_id uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.crm_leads where id = p_lead_id),
                  (select name from public.facilities where id = p_facility_id), '—');
$$;

-- ---------- sequences -----------------------------------------------------
-- Start a cadence on a lead: one open task per step, dated from today,
-- assigned to the lead's owner. Returns the enrollment id.
create or replace function public.crm_start_sequence(p_lead_id uuid, p_sequence_id uuid, p_start date default current_date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_lead      public.crm_leads%rowtype;
  v_enroll_id uuid;
  v_contact   uuid;
  v_seq_ok    boolean;
begin
  select * into v_lead from public.crm_leads where id = p_lead_id;
  if not found then raise exception 'Lead not found'; end if;
  if not (public.crm_is_admin() or v_lead.owner_rep_id in (select public.crm_rep_tree(auth.uid()))) then
    raise exception 'Not allowed to start a sequence on this lead';
  end if;
  select is_active into v_seq_ok from public.crm_sequences where id = p_sequence_id;
  if v_seq_ok is not true then raise exception 'Sequence is not active'; end if;
  if exists (select 1 from public.crm_enrollments where lead_id = p_lead_id and status = 'active') then
    raise exception 'This clinic is already on a sequence — stop it first';
  end if;

  select id into v_contact from public.contacts
   where (lead_id = p_lead_id or (v_lead.facility_id is not null and facility_id = v_lead.facility_id)) and is_active
   order by created_at limit 1;

  insert into public.crm_enrollments (lead_id, sequence_id, started_on, started_by)
  values (p_lead_id, p_sequence_id, p_start, auth.uid()) returning id into v_enroll_id;

  insert into public.tasks (facility_id, lead_id, contact_id, created_by, assigned_to, title, due_date, priority, status,
                            source, step_type, enrollment_id, step_index)
  select v_lead.facility_id, p_lead_id, v_contact, coalesce(auth.uid(), v_lead.owner_rep_id), v_lead.owner_rep_id,
         s.title, p_start + s.day_offset, 'medium', 'open', 'sequence', s.step_type, v_enroll_id, s.step_index
    from public.crm_sequence_steps s where s.sequence_id = p_sequence_id order by s.step_index;

  return v_enroll_id;
end $$;

-- Stop a cadence: remaining open steps are removed, done ones stay as history.
create or replace function public.crm_stop_sequence(p_enrollment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_owner uuid;
begin
  select e.lead_id, l.owner_rep_id into v_lead, v_owner
    from public.crm_enrollments e join public.crm_leads l on l.id = e.lead_id where e.id = p_enrollment_id;
  if not found then raise exception 'Enrollment not found'; end if;
  if not (public.crm_is_admin() or v_owner in (select public.crm_rep_tree(auth.uid()))) then
    raise exception 'Not allowed';
  end if;
  delete from public.tasks where enrollment_id = p_enrollment_id and status = 'open';
  update public.crm_enrollments set status = 'stopped', stopped_at = now() where id = p_enrollment_id and status = 'active';
end $$;

-- When the last step of a sequence is done, the enrollment completes.
-- Completing any typed step also logs the activity so the timeline stays honest.
create or replace function public.crm_task_done_hook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and old.status is distinct from 'done' then
    if new.step_type is not null and (new.lead_id is not null or new.facility_id is not null) then
      insert into public.activities (facility_id, lead_id, contact_id, logged_by, type, activity_date, notes)
      values (new.facility_id, new.lead_id, new.contact_id, coalesce(auth.uid(), new.assigned_to), new.step_type, current_date, new.title);
    end if;
    if new.enrollment_id is not null and not exists (
         select 1 from public.tasks where enrollment_id = new.enrollment_id and status = 'open' and id <> new.id) then
      update public.crm_enrollments set status = 'completed', completed_at = now()
       where id = new.enrollment_id and status = 'active';
    end if;
  end if;
  return new;
end $$;
create trigger crm_task_done_hook after update on public.tasks for each row execute function public.crm_task_done_hook();

-- ---------- stage automation ----------------------------------------------
-- First logged activity moves a brand-new lead to Contacted.
create or replace function public.crm_activity_stage_hook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null then
    update public.crm_leads set stage = 'contacted' where id = new.lead_id and stage = 'lead';
  end if;
  return new;
end $$;
create trigger crm_activity_stage_hook after insert on public.activities for each row execute function public.crm_activity_stage_hook();

-- Linking an invite to a lead = Invite Sent.
create or replace function public.crm_lead_invite_hook()
returns trigger language plpgsql as $$
begin
  if new.invite_token_id is not null and old.invite_token_id is distinct from new.invite_token_id
     and new.stage in ('lead','contacted','demo') then
    new.stage = 'invite_sent';
  end if;
  return new;
end $$;
create trigger crm_lead_invite_hook before update on public.crm_leads for each row execute function public.crm_lead_invite_hook();

-- Clinic signs up from the invite → link the facility, stage = Onboarded.
create or replace function public.crm_facility_link_hook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.crm_leads l
     set facility_id = new.id, stage = case when l.stage in ('ordering','lost') then l.stage else 'onboarded' end
    from public.invite_tokens t
   where t.id = l.invite_token_id and t.used_by = new.user_id and l.facility_id is null;
  return new;
end $$;
create trigger crm_facility_link_hook after insert on public.facilities for each row execute function public.crm_facility_link_hook();

-- Invite redeemed after the facility already exists (either order of operations works).
create or replace function public.crm_invite_used_hook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.used_by is not null and old.used_by is distinct from new.used_by then
    update public.crm_leads l
       set facility_id = f.id, stage = case when l.stage in ('ordering','lost') then l.stage else 'onboarded' end
      from public.facilities f
     where l.invite_token_id = new.id and f.user_id = new.used_by and l.facility_id is null;
  end if;
  return new;
end $$;
create trigger crm_invite_used_hook after update on public.invite_tokens for each row execute function public.crm_invite_used_hook();

-- First non-draft order → Ordering (won).
create or replace function public.crm_order_stage_hook()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.order_status is distinct from 'draft' then
    update public.crm_leads set stage = 'ordering'
     where facility_id = new.facility_id and stage not in ('ordering','lost');
  end if;
  return new;
end $$;
create trigger crm_order_stage_hook after insert or update of order_status on public.orders for each row execute function public.crm_order_stage_hook();

-- ---------- Open Payments (Sunshine Act) hook -------------------------------
-- Called by the UI after a gift / lunch step. Finds or creates the rep's draft
-- monthly report and adds the value entry. Returns the entry id.
create or replace function public.crm_log_value_transfer(
  p_contact_id   uuid,
  p_transfer_date date,
  p_form_category text,          -- meal | beverage | gift | education | travel | lodging | other
  p_value_amount  numeric,
  p_description   text default null,
  p_is_estimate   boolean default false,
  p_lead_id       uuid default null,
  p_facility_id   uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_rep uuid := auth.uid();
  v_report uuid; v_entry uuid; v_c public.contacts%rowtype; v_cred text; v_aff text;
begin
  if v_rep is null then raise exception 'Not signed in'; end if;
  select * into v_c from public.contacts where id = p_contact_id;
  if not found then raise exception 'Contact not found'; end if;

  -- credential from the contact's title; anything unrecognized is OTHER (compliance can correct it)
  v_cred := case
    when v_c.title ~* '\mDPM\M' then 'DPM' when v_c.title ~* '\mMD\M' then 'MD' when v_c.title ~* '\mDO\M' then 'DO'
    when v_c.title ~* '\mPA(-C)?\M' then 'PA' when v_c.title ~* '\mNP\M' then 'NP' when v_c.title ~* '\mDDS\M' then 'DDS'
    else 'OTHER' end;
  v_aff := public.crm_lead_display(coalesce(p_lead_id, v_c.lead_id), coalesce(p_facility_id, v_c.facility_id));

  select id into v_report from public.sales_rep_value_reports
   where rep_id = v_rep and reporting_year = extract(year from p_transfer_date)::int
     and reporting_month = extract(month from p_transfer_date)::int and status = 'draft'
   order by created_at desc limit 1;
  if v_report is null then
    insert into public.sales_rep_value_reports (rep_id, reporting_year, reporting_month, status)
    values (v_rep, extract(year from p_transfer_date)::int, extract(month from p_transfer_date)::int, 'draft')
    returning id into v_report;
  end if;

  insert into public.value_transfer_entries (report_id, transfer_date, recipient_name, recipient_credential, affiliation,
                                             form_category, description, value_amount, is_estimate)
  values (v_report, p_transfer_date, v_c.first_name || ' ' || v_c.last_name, v_cred, v_aff,
          p_form_category, p_description, p_value_amount, coalesce(p_is_estimate, false))
  returning id into v_entry;
  return v_entry;
end $$;

-- ---------- reorder radar ---------------------------------------------------
-- Each clinic's order rhythm from real portal orders (non-draft), amounts from order_items.
create or replace view public.crm_reorder_radar with (security_invoker = true) as
with o as (
  select o.facility_id, o.id, o.placed_at::date as placed_on,
         coalesce((select sum(i.total_amount) from public.order_items i where i.order_id = o.id), 0) as amount
    from public.orders o where o.order_status <> 'draft'
),
agg as (
  select facility_id, count(*) as order_count, min(placed_on) as first_order, max(placed_on) as last_order, sum(amount) as total_amount
    from o group by facility_id
),
calc as (
  select a.*, l.id as lead_id, f.name as facility_name, f.city, f.state, f.assigned_rep,
         case when order_count >= 2 then round((last_order - first_order)::numeric / (order_count - 1)) end as cadence_days,
         (select amount from o where o.facility_id = a.facility_id order by placed_on desc limit 1) as last_amount
    from agg a join public.facilities f on f.id = a.facility_id left join public.crm_leads l on l.facility_id = f.id
   where f.facility_type = 'clinic'
)
select c.*,
       case when cadence_days is not null then last_order + cadence_days::int end as expected_reorder,
       case when cadence_days is not null then (current_date - (last_order + cadence_days::int)) end as days_late,
       case when cadence_days is null then 'new'
            when current_date - (last_order + cadence_days::int) >= (select reorder_late_days from public.crm_reminder_settings where id = 1) then 'overdue'
            when current_date - (last_order + cadence_days::int) >= 0 then 'late'
            when current_date - (last_order + cadence_days::int) >= -7 then 'soon'
            else 'ok' end as status
  from calc c;
comment on view public.crm_reorder_radar is 'Per-clinic reorder cadence from order history. status: new | ok | soon | late | overdue.';

-- Nightly: create a reorder check-in task for clinics past the threshold (once per lateness episode).
create or replace function public.crm_run_reorder_scan()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; r record; s public.crm_reminder_settings%rowtype;
begin
  select * into s from public.crm_reminder_settings where id = 1;
  if not s.is_enabled or not s.auto_reorder_tasks then return 0; end if;
  for r in select * from public.crm_reorder_radar where status = 'overdue' and assigned_rep is not null loop
    if not exists (select 1 from public.tasks t where t.facility_id = r.facility_id and t.source = 'reorder'
                     and (t.status = 'open' or t.completed_at > (current_date - r.cadence_days::int))) then
      insert into public.tasks (facility_id, lead_id, contact_id, created_by, assigned_to, title, due_date, priority, status, source, step_type)
      values (r.facility_id, r.lead_id,
              (select id from public.contacts where facility_id = r.facility_id and is_active order by created_at limit 1),
              r.assigned_rep, r.assigned_rep,
              format('Reorder check-in — %s days past expected reorder (usually every %s days)', r.days_late, r.cadence_days),
              current_date, 'high', 'open', 'reorder', 'call');
      v_n := v_n + 1;
    end if;
  end loop;
  insert into public.crm_reminder_log (run_date, kind, channel, item_count, status) values (current_date, 'reorder_scan', 'none', v_n, 'sent');
  return v_n;
end $$;

-- ---------- reminder builders (read by the edge function) -------------------
-- Open follow-ups due today or earlier for one rep, with everything the email needs.
create or replace function public.crm_due_followups(p_rep uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'task_id', t.id, 'title', t.title, 'due_date', t.due_date, 'days_overdue', current_date - t.due_date,
           'step_type', t.step_type, 'source', t.source, 'priority', t.priority,
           'lead_id', t.lead_id, 'facility_id', t.facility_id,
           'clinic', public.crm_lead_display(t.lead_id, t.facility_id),
           'city', coalesce(l.city, f.city), 'state', coalesce(l.state, f.state),
           'contact', case when c.id is not null then c.first_name || ' ' || c.last_name end,
           'contact_title', c.title, 'contact_phone', c.phone,
           'sequence', s.name, 'step_index', t.step_index
         ) order by t.due_date, t.priority desc), '[]'::jsonb)
    from public.tasks t
    left join public.crm_leads l on l.id = t.lead_id
    left join public.facilities f on f.id = t.facility_id
    left join public.contacts c on c.id = t.contact_id
    left join public.crm_enrollments e on e.id = t.enrollment_id
    left join public.crm_sequences s on s.id = e.sequence_id
   where t.assigned_to = p_rep and t.status = 'open' and t.due_date <= current_date;
$$;

-- Company-wide digest.
create or replace function public.crm_admin_digest()
returns jsonb language sql stable security definer set search_path = public as $$
  with s as (select * from public.crm_reminder_settings where id = 1),
  overdue as (
    select t.assigned_to, p.first_name || ' ' || p.last_name as rep, count(*) as n,
           jsonb_agg(public.crm_lead_display(t.lead_id, t.facility_id) order by t.due_date) as clinics
      from public.tasks t join public.profiles p on p.id = t.assigned_to
     where t.status = 'open' and t.due_date < current_date group by 1, 2),
  stale as (
    select l.id, l.name, l.stage, p.first_name || ' ' || p.last_name as rep,
           (select max(activity_date) from public.activities a where a.lead_id = l.id or (l.facility_id is not null and a.facility_id = l.facility_id)) as last_activity
      from public.crm_leads l join public.profiles p on p.id = l.owner_rep_id, s
     where l.stage in ('lead','contacted','demo','invite_sent','onboarded')
       and coalesce((select max(activity_date) from public.activities a where a.lead_id = l.id or (l.facility_id is not null and a.facility_id = l.facility_id)), l.created_at::date) <= current_date - s.stale_days),
  invites as (
    select l.id, l.name, l.stage_changed_at::date as sent_on, p.first_name || ' ' || p.last_name as rep
      from public.crm_leads l join public.profiles p on p.id = l.owner_rep_id, s
     where l.stage = 'invite_sent' and l.stage_changed_at <= now() - (s.invite_days || ' days')::interval),
  reorders as (
    select r.facility_name, r.days_late, r.cadence_days, r.last_order, p.first_name || ' ' || p.last_name as rep
      from public.crm_reorder_radar r left join public.profiles p on p.id = r.assigned_rep
     where r.status in ('late','overdue'))
  select jsonb_build_object(
    'open_total',  (select count(*) from public.tasks where status = 'open'),
    'due_today',   (select count(*) from public.tasks where status = 'open' and due_date = current_date),
    'overdue_total', (select count(*) from public.tasks where status = 'open' and due_date < current_date),
    'overdue_by_rep', (select coalesce(jsonb_agg(to_jsonb(o) order by o.n desc), '[]') from overdue o),
    'stale_leads',    (select coalesce(jsonb_agg(to_jsonb(x) order by x.last_activity nulls first), '[]') from stale x),
    'invites',        (select coalesce(jsonb_agg(to_jsonb(i) order by i.sent_on), '[]') from invites i),
    'reorders',       (select coalesce(jsonb_agg(to_jsonb(r) order by r.days_late desc), '[]') from reorders r));
$$;

-- Bell notifications for every rep with something due (idempotent per day).
create or replace function public.crm_bell_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare v_n integer := 0; r record; v_items jsonb; v_cnt integer; s public.crm_reminder_settings%rowtype;
begin
  select * into s from public.crm_reminder_settings where id = 1;
  if not s.is_enabled or not s.rep_bell then return 0; end if;
  for r in select distinct t.assigned_to as rep from public.tasks t
            where t.status = 'open' and t.due_date <= current_date loop
    if exists (select 1 from public.crm_reminder_log where run_date = current_date and kind = 'rep_reminder'
                  and recipient_id = r.rep and channel = 'bell' and status = 'sent') then continue; end if;
    v_items := public.crm_due_followups(r.rep); v_cnt := jsonb_array_length(v_items);
    insert into public.notifications (user_id, type, title, body)
    values (r.rep, 'crm_followups_due',
            format('%s follow-up%s due today', v_cnt, case when v_cnt = 1 then '' else 's' end),
            (select string_agg(i->>'clinic' || ' — ' || (i->>'title'), E'\n') from jsonb_array_elements(v_items) i));
    insert into public.crm_reminder_log (run_date, kind, recipient_id, channel, item_count, status)
    values (current_date, 'rep_reminder', r.rep, 'bell', v_cnt, 'sent');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- ---------- a convenient overview for the UI --------------------------------
create or replace view public.crm_lead_overview with (security_invoker = true) as
select l.*,
       p.first_name || ' ' || p.last_name as owner_name,
       (select max(a.activity_date) from public.activities a where a.lead_id = l.id or (l.facility_id is not null and a.facility_id = l.facility_id)) as last_activity_on,
       (select count(*) from public.contacts c where c.lead_id = l.id or (l.facility_id is not null and c.facility_id = l.facility_id)) as contact_count,
       nt.id as next_task_id, nt.title as next_task_title, nt.due_date as next_task_due, nt.step_type as next_task_type,
       e.id as enrollment_id, s.name as sequence_name,
       (select count(*) from public.tasks t where t.enrollment_id = e.id and t.status = 'done') as sequence_done,
       (select count(*) from public.tasks t where t.enrollment_id = e.id) as sequence_total,
       (current_date - l.stage_changed_at::date) as days_in_stage
  from public.crm_leads l
  join public.profiles p on p.id = l.owner_rep_id
  left join lateral (select t.* from public.tasks t where (t.lead_id = l.id or (l.facility_id is not null and t.facility_id = l.facility_id)) and t.status = 'open' order by t.due_date limit 1) nt on true
  left join public.crm_enrollments e on e.lead_id = l.id and e.status = 'active'
  left join public.crm_sequences s on s.id = e.sequence_id;

grant execute on function public.crm_start_sequence(uuid, uuid, date), public.crm_stop_sequence(uuid),
      public.crm_log_value_transfer(uuid, date, text, numeric, text, boolean, uuid, uuid),
      public.crm_due_followups(uuid), public.crm_admin_digest() to authenticated;
-- scheduler-only functions are not granted to authenticated; the edge function calls them with the service role.
revoke execute on function public.crm_run_reorder_scan(), public.crm_bell_reminders() from authenticated, anon;
