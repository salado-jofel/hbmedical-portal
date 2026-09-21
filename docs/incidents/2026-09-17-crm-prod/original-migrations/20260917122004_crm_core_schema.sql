-- ============================================================================
-- CRM Phase 2 — core schema
-- Additive. Existing tables gain nullable columns / relaxed constraints only.
-- ============================================================================

-- ---------- helpers -------------------------------------------------------
create or replace function public.crm_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.crm_is_rep()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'sales_representative');
$$;

-- Every rep in the caller's tree (self + sub-reps, recursively). Mirrors rep_facility_ids().
create or replace function public.crm_rep_tree(p_rep uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  with recursive rep_tree as (
    select p_rep as id
    union all
    select rh.child_rep_id from public.rep_hierarchy rh join rep_tree rt on rt.id = rh.parent_rep_id
  )
  select id from rep_tree;
$$;

-- ---------- crm_leads -----------------------------------------------------
-- A clinic in the sales pipeline. Exists BEFORE the clinic has a portal account
-- (facility_id null) and is linked to the facility once they sign up from an invite.
create table public.crm_leads (
  id                uuid primary key default gen_random_uuid(),
  name              text not null check (btrim(name) <> ''),
  practice_type     text check (practice_type in ('podiatry','wound_care','vascular','orthopedics','dermatology','primary_care','other')),
  city              text,
  state             text check (state is null or state ~ '^[A-Z]{2}$'),
  phone             text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  stage             text not null default 'lead' check (stage in ('lead','contacted','demo','invite_sent','onboarded','ordering','lost')),
  stage_changed_at  timestamptz not null default now(),
  est_monthly_value numeric(12,2) not null default 0 check (est_monthly_value >= 0),
  owner_rep_id      uuid not null references public.profiles(id) on delete restrict,
  source            text check (source in ('referral','cold_call','conference','website','existing_provider','other')),
  facility_id       uuid unique references public.facilities(id) on delete set null,
  invite_token_id   uuid references public.invite_tokens(id) on delete set null,
  lost_reason       text,
  notes             text,
  created_by        uuid not null references public.profiles(id) on delete cascade,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.crm_leads is 'Sales pipeline. One row per prospective or active clinic. facility_id is null until the clinic creates a portal account; stage advances automatically on invite → signup → first order.';
create index crm_leads_owner_idx on public.crm_leads(owner_rep_id);
create index crm_leads_stage_idx on public.crm_leads(stage);
create trigger crm_leads_set_updated_at before update on public.crm_leads for each row execute function public.set_updated_at();

-- keep stage_changed_at honest
create or replace function public.crm_leads_stage_touch()
returns trigger language plpgsql as $$
begin
  if new.stage is distinct from old.stage then new.stage_changed_at = now(); end if;
  return new;
end $$;
create trigger crm_leads_stage_touch before update on public.crm_leads for each row execute function public.crm_leads_stage_touch();

-- ---------- contacts / activities / tasks: attach to a lead -----------------
alter table public.contacts   add column lead_id uuid references public.crm_leads(id) on delete cascade;
alter table public.activities add column lead_id uuid references public.crm_leads(id) on delete cascade;
alter table public.tasks      add column lead_id uuid references public.crm_leads(id) on delete cascade;
create index contacts_lead_idx   on public.contacts(lead_id);
create index activities_lead_idx on public.activities(lead_id);
create index tasks_lead_idx      on public.tasks(lead_id);

-- Before a clinic signs up there is no facility, so allow lead-only rows.
alter table public.contacts   alter column facility_id drop not null;
alter table public.activities alter column facility_id drop not null;
alter table public.contacts   add constraint contacts_facility_or_lead   check (facility_id is not null or lead_id is not null);
alter table public.activities add constraint activities_facility_or_lead check (facility_id is not null or lead_id is not null);

-- New activity / step types: gift drop-offs and lunch & learns (transfers of value).
alter table public.activities drop constraint if exists activities_type_check;
alter table public.activities add constraint activities_type_check check (type in ('visit','call','email','demo','gift','lunch'));

-- Task provenance (manual / sequence step / reorder radar)
alter table public.tasks add column source        text not null default 'manual' check (source in ('manual','sequence','reorder'));
alter table public.tasks add column step_type     text check (step_type is null or step_type in ('visit','call','email','demo','gift','lunch'));
alter table public.tasks add column enrollment_id uuid;          -- FK added after crm_enrollments exists
alter table public.tasks add column step_index    integer;
alter table public.tasks add column completed_at  timestamptz;

create or replace function public.tasks_completed_touch()
returns trigger language plpgsql as $$
begin
  if new.status = 'done' and (old.status is distinct from 'done') then new.completed_at = now();
  elsif new.status = 'open' then new.completed_at = null; end if;
  return new;
end $$;
create trigger tasks_completed_touch before update on public.tasks for each row execute function public.tasks_completed_touch();

-- ---------- sequences -----------------------------------------------------
create table public.crm_sequences (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (btrim(name) <> ''),
  description text,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.crm_sequences is 'Follow-up cadence templates. Admin-managed; reps start them on a lead.';
create trigger crm_sequences_set_updated_at before update on public.crm_sequences for each row execute function public.set_updated_at();

create table public.crm_sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references public.crm_sequences(id) on delete cascade,
  step_index  integer not null check (step_index >= 0),
  day_offset  integer not null check (day_offset >= 0),
  step_type   text not null check (step_type in ('visit','call','email','demo','gift','lunch')),
  title       text not null check (btrim(title) <> ''),
  unique (sequence_id, step_index)
);
create index crm_sequence_steps_seq_idx on public.crm_sequence_steps(sequence_id, step_index);

create table public.crm_enrollments (
  id           uuid primary key default gen_random_uuid(),
  lead_id      uuid not null references public.crm_leads(id) on delete cascade,
  sequence_id  uuid not null references public.crm_sequences(id) on delete restrict,
  status       text not null default 'active' check (status in ('active','completed','stopped')),
  started_on   date not null default current_date,
  started_by   uuid references public.profiles(id) on delete set null,
  stopped_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz not null default now()
);
comment on table public.crm_enrollments is 'A lead running a sequence. Steps become rows in tasks (source = sequence). Only one active enrollment per lead.';
create unique index crm_enrollments_one_active_per_lead on public.crm_enrollments(lead_id) where status = 'active';
create index crm_enrollments_lead_idx on public.crm_enrollments(lead_id);

alter table public.tasks add constraint tasks_enrollment_fk foreign key (enrollment_id) references public.crm_enrollments(id) on delete cascade;
create index tasks_enrollment_idx on public.tasks(enrollment_id);

-- ---------- reminder settings (singleton) + send log -----------------------
create table public.crm_reminder_settings (
  id                   integer primary key default 1 check (id = 1),
  is_enabled           boolean not null default false,          -- master switch: nothing sends until true
  timezone             text not null default 'America/New_York',
  rep_reminder_time    time not null default '07:00',
  rep_bell             boolean not null default true,
  rep_email            boolean not null default true,
  rep_sms              boolean not null default false,
  digest_time          time not null default '07:30',
  digest_recipients    uuid[] not null default '{}',
  digest_overdue       boolean not null default true,
  digest_stale         boolean not null default true,
  digest_invites       boolean not null default true,
  digest_reorders      boolean not null default true,
  stale_days           integer not null default 14 check (stale_days > 0),
  invite_days          integer not null default 7  check (invite_days > 0),
  auto_reorder_tasks   boolean not null default true,
  reorder_late_days    integer not null default 7  check (reorder_late_days > 0),
  from_email           text not null default 'crm@meridianportal.io',
  updated_by           uuid references public.profiles(id) on delete set null,
  updated_at           timestamptz not null default now()
);
comment on table public.crm_reminder_settings is 'Single row (id = 1). Controls the morning rep reminders and admin digest. is_enabled = false means the scheduler does nothing.';
create trigger crm_reminder_settings_set_updated_at before update on public.crm_reminder_settings for each row execute function public.set_updated_at();

create table public.crm_reminder_log (
  id            uuid primary key default gen_random_uuid(),
  run_date      date not null,
  kind          text not null check (kind in ('rep_reminder','admin_digest','reorder_scan')),
  recipient_id  uuid references public.profiles(id) on delete cascade,
  channel       text check (channel in ('bell','email','sms','none')),
  item_count    integer not null default 0,
  status        text not null check (status in ('sent','skipped','failed')),
  provider_id   text,
  error         text,
  created_at    timestamptz not null default now()
);
comment on table public.crm_reminder_log is 'One row per reminder attempt. Used to prevent double-sends and for troubleshooting.';
create index crm_reminder_log_day_idx on public.crm_reminder_log(run_date, kind, recipient_id);

-- ---------- bell notifications for CRM events -----------------------------
-- notifications was order-only. CRM types have no order; keep the guarantee for order types.
alter table public.notifications alter column order_id drop not null;
alter table public.notifications alter column order_number drop not null;
alter table public.notifications add constraint notifications_order_required_unless_crm
  check (type like 'crm_%' or (order_id is not null and order_number is not null));
alter table public.notifications add column lead_id uuid references public.crm_leads(id) on delete cascade;
alter table public.notifications add column task_id uuid references public.tasks(id) on delete cascade;

-- ---------- RLS -----------------------------------------------------------
alter table public.crm_leads             enable row level security;
alter table public.crm_sequences         enable row level security;
alter table public.crm_sequence_steps    enable row level security;
alter table public.crm_enrollments       enable row level security;
alter table public.crm_reminder_settings enable row level security;
alter table public.crm_reminder_log      enable row level security;

-- leads: admins everything; reps their own tree; support staff read-only
create policy crm_leads_admin_all on public.crm_leads for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
create policy crm_leads_rep_tree  on public.crm_leads for all to authenticated
  using (public.crm_is_rep() and owner_rep_id in (select public.crm_rep_tree(auth.uid())))
  with check (public.crm_is_rep() and owner_rep_id in (select public.crm_rep_tree(auth.uid())));
create policy crm_leads_support_read on public.crm_leads for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'support_staff'));

-- lead-attached contacts / activities / tasks (additive to the existing facility-based policies)
create policy contacts_rep_lead_tree on public.contacts for all to authenticated
  using (lead_id is not null and public.crm_is_rep() and exists (select 1 from public.crm_leads l where l.id = contacts.lead_id and l.owner_rep_id in (select public.crm_rep_tree(auth.uid()))))
  with check (lead_id is not null and public.crm_is_rep() and exists (select 1 from public.crm_leads l where l.id = contacts.lead_id and l.owner_rep_id in (select public.crm_rep_tree(auth.uid()))));
create policy activities_rep_lead_tree on public.activities for all to authenticated
  using (lead_id is not null and public.crm_is_rep() and exists (select 1 from public.crm_leads l where l.id = activities.lead_id and l.owner_rep_id in (select public.crm_rep_tree(auth.uid()))))
  with check (lead_id is not null and public.crm_is_rep() and exists (select 1 from public.crm_leads l where l.id = activities.lead_id and l.owner_rep_id in (select public.crm_rep_tree(auth.uid()))));
-- tasks already allow assigned_to / created_by for reps; add read for sub-rep tasks so a main rep sees their team's follow-ups
create policy tasks_rep_tree_read on public.tasks for select to authenticated
  using (public.crm_is_rep() and assigned_to in (select public.crm_rep_tree(auth.uid())));

-- sequences: everyone signed-in can read active templates; only admins change them
create policy crm_sequences_read       on public.crm_sequences      for select to authenticated using (is_active or public.crm_is_admin());
create policy crm_sequences_admin      on public.crm_sequences      for all    to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
create policy crm_sequence_steps_read  on public.crm_sequence_steps for select to authenticated using (true);
create policy crm_sequence_steps_admin on public.crm_sequence_steps for all    to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());

-- enrollments follow the lead's visibility
create policy crm_enrollments_admin on public.crm_enrollments for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
create policy crm_enrollments_rep   on public.crm_enrollments for all to authenticated
  using (exists (select 1 from public.crm_leads l where l.id = crm_enrollments.lead_id and l.owner_rep_id in (select public.crm_rep_tree(auth.uid()))))
  with check (exists (select 1 from public.crm_leads l where l.id = crm_enrollments.lead_id and l.owner_rep_id in (select public.crm_rep_tree(auth.uid()))));

-- settings: everyone can read (the UI shows reminder time), admins edit
create policy crm_reminder_settings_read  on public.crm_reminder_settings for select to authenticated using (true);
create policy crm_reminder_settings_admin on public.crm_reminder_settings for all to authenticated using (public.crm_is_admin()) with check (public.crm_is_admin());
create policy crm_reminder_log_admin      on public.crm_reminder_log for select to authenticated using (public.crm_is_admin());
create policy crm_reminder_log_own        on public.crm_reminder_log for select to authenticated using (recipient_id = auth.uid());

-- ---------- seed: settings row + sequence templates -------------------------
insert into public.crm_reminder_settings (id, digest_recipients)
values (1, array(select id from public.profiles where role = 'admin' and lower(email) in ('ben@meridiansurgicalsupplies.com','erika@meridiansurgicalsupplies.com','kelsey@meridiansurgicalsupplies.com')));

with s as (
  insert into public.crm_sequences (name, description) values
    ('New lead outreach',       'Six touches over three weeks for a clinic that has not been contacted yet.'),
    ('Post-demo follow-up',     'Keep momentum after a demo and move to a portal invite.'),
    ('Invite nudge',            'For clinics that received a portal invite but have not signed up.'),
    ('New customer check-in',   'First 60 days after onboarding to lock in reorders.'),
    ('Re-engage quiet clinic',  'For a lead or customer that has gone quiet for two weeks or more.')
  returning id, name
)
insert into public.crm_sequence_steps (sequence_id, step_index, day_offset, step_type, title)
select s.id, x.i, x.d, x.t, x.title from s
join lateral (values
  ('New lead outreach', 0, 0,  'email', 'Send intro packet and completeFT sales sheet'),
  ('New lead outreach', 1, 2,  'call',  'Intro call — confirm they received the packet'),
  ('New lead outreach', 2, 5,  'call',  'Second call attempt'),
  ('New lead outreach', 3, 9,  'gift',  'Drop by with donuts and samples for the front office'),
  ('New lead outreach', 4, 14, 'email', 'Send reimbursement guide and case study'),
  ('New lead outreach', 5, 21, 'call',  'Final call — ask for a demo date'),
  ('Post-demo follow-up', 0, 1,  'email', 'Thank-you email with pricing and next steps'),
  ('Post-demo follow-up', 1, 3,  'call',  'Call to answer questions from the demo'),
  ('Post-demo follow-up', 2, 7,  'visit', 'Visit to walk through the portal signup'),
  ('Post-demo follow-up', 3, 14, 'call',  'Ask for the go-ahead to send the portal invite'),
  ('Invite nudge', 0, 3,  'email', 'Reminder — invite link and what to expect at signup'),
  ('Invite nudge', 1, 7,  'call',  'Call the practice manager to help with signup'),
  ('Invite nudge', 2, 14, 'call',  'Escalate to the provider'),
  ('New customer check-in', 0, 7,  'call',  'Check that the first order went smoothly'),
  ('New customer check-in', 1, 14, 'lunch', 'Lunch & learn — train staff on IVR uploads'),
  ('New customer check-in', 2, 30, 'call',  'Reorder check-in'),
  ('New customer check-in', 3, 60, 'visit', 'Quarterly review visit'),
  ('Re-engage quiet clinic', 0, 0,  'gift',  'Drop off donuts — leave a card with your cell number'),
  ('Re-engage quiet clinic', 1, 3,  'call',  'Call the office manager'),
  ('Re-engage quiet clinic', 2, 10, 'lunch', 'Lunch & learn with the providers'),
  ('Re-engage quiet clinic', 3, 17, 'call',  'Ask for a demo date or a reorder')
) as x(name, i, d, t, title) on x.name = s.name;
