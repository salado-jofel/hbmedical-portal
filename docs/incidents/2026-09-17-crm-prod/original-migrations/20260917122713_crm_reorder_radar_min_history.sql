drop view public.crm_reorder_radar;
-- A cadence only means something with real history: 3+ orders on 2+ distinct days, at least 3 days apart on average.
create view public.crm_reorder_radar with (security_invoker = true) as
with o as (
  select o.facility_id, o.id, o.placed_at::date as placed_on,
         coalesce((select sum(i.total_amount) from public.order_items i where i.order_id = o.id), 0) as amount
    from public.orders o where o.order_status <> 'draft'
),
agg as (
  select facility_id, count(*) as order_count, count(distinct placed_on) as order_days,
         min(placed_on) as first_order, max(placed_on) as last_order, sum(amount) as total_amount
    from o group by facility_id
),
calc as (
  select a.*, l.id as lead_id, f.name as facility_name, f.city, f.state, f.assigned_rep,
         case when order_count >= 3 and order_days >= 2 and (last_order - first_order) >= 3 * (order_days - 1)
              then greatest(3, round((last_order - first_order)::numeric / (order_days - 1))) end as cadence_days,
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
