-- Trigger functions are never meant to be called through the API.
revoke execute on function
  public.crm_leads_stage_touch(), public.tasks_completed_touch(), public.crm_task_done_hook(),
  public.crm_activity_stage_hook(), public.crm_lead_invite_hook(), public.crm_facility_link_hook(),
  public.crm_invite_used_hook(), public.crm_order_stage_hook()
from public, anon, authenticated;

-- Pin search_path on the non-definer trigger functions too.
alter function public.crm_leads_stage_touch()  set search_path = public;
alter function public.tasks_completed_touch()  set search_path = public;
alter function public.crm_lead_invite_hook()   set search_path = public;

-- Signed-in users only for the callable CRM API; anonymous never.
revoke execute on function
  public.crm_is_admin(), public.crm_is_rep(), public.crm_rep_tree(uuid), public.crm_lead_display(uuid, uuid),
  public.crm_start_sequence(uuid, uuid, date), public.crm_stop_sequence(uuid),
  public.crm_log_value_transfer(uuid, date, text, numeric, text, boolean, uuid, uuid),
  public.crm_my_followups(uuid), public.crm_admin_digest_guarded()
from public, anon;
grant execute on function
  public.crm_is_admin(), public.crm_is_rep(), public.crm_rep_tree(uuid), public.crm_lead_display(uuid, uuid),
  public.crm_start_sequence(uuid, uuid, date), public.crm_stop_sequence(uuid),
  public.crm_log_value_transfer(uuid, date, text, numeric, text, boolean, uuid, uuid),
  public.crm_my_followups(uuid), public.crm_admin_digest_guarded()
to authenticated, service_role;
