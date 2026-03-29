begin;

-- Clean up old policies if they exist
drop policy if exists "orders_update_own" on public.orders;
drop policy if exists "orders_update_own_editable_only" on public.orders;
drop policy if exists "orders_delete_own_editable_only" on public.orders;
drop policy if exists "orders_delete_own_unpaid_without_invoice" on public.orders;

-- UPDATE: only editable orders owned by the authenticated user's facility
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
  and not exists (
    select 1
    from public.invoices i
    where i.order_id = orders.id
  )
  and not exists (
    select 1
    from public.payments p
    where p.order_id = orders.id
      and p.status in ('paid', 'refunded', 'partially_refunded')
  )
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
  and not exists (
    select 1
    from public.invoices i
    where i.order_id = orders.id
  )
  and not exists (
    select 1
    from public.payments p
    where p.order_id = orders.id
      and p.status in ('paid', 'refunded', 'partially_refunded')
  )
);

-- DELETE: same exact rule as update
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
  and not exists (
    select 1
    from public.invoices i
    where i.order_id = orders.id
  )
  and not exists (
    select 1
    from public.payments p
    where p.order_id = orders.id
      and p.status in ('paid', 'refunded', 'partially_refunded')
  )
);

commit;
