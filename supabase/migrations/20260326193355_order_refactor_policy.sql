begin;

drop policy if exists "orders_update_own" on public.orders;
drop policy if exists "orders_update_own_editable_only" on public.orders;
drop policy if exists "orders_delete_own_editable_only" on public.orders;
drop policy if exists "orders_delete_own_unpaid_without_invoice" on public.orders;

create policy "orders_update_own_editable_only"
on public.orders
for update
to authenticated
using (
  exists (
    select 1
    from public.facilities f
    where f.id = orders.facility_id
      and f.user_id = auth.uid()
  )
  and orders.order_status <> 'canceled'
  and orders.payment_status not in ('paid', 'refunded', 'partially_refunded')
  and orders.invoice_status = 'not_applicable'
)
with check (
  exists (
    select 1
    from public.facilities f
    where f.id = orders.facility_id
      and f.user_id = auth.uid()
  )
  and orders.order_status <> 'canceled'
  and orders.payment_status not in ('paid', 'refunded', 'partially_refunded')
  and orders.invoice_status = 'not_applicable'
);

create policy "orders_delete_own_editable_only"
on public.orders
for delete
to authenticated
using (
  exists (
    select 1
    from public.facilities f
    where f.id = orders.facility_id
      and f.user_id = auth.uid()
  )
  and orders.order_status <> 'canceled'
  and orders.payment_status not in ('paid', 'refunded', 'partially_refunded')
  and orders.invoice_status = 'not_applicable'
);

commit;
