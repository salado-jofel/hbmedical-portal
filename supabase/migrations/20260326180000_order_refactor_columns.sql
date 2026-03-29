begin;

-- 1) Add explicit lifecycle state for orders
alter table public.orders
add column if not exists order_status text not null default 'submitted';

-- 2) Constrain lifecycle values
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_status_check'
  ) then
    alter table public.orders
    add constraint orders_order_status_check
    check (
      order_status = any (array[
        'draft'::text,
        'submitted'::text,
        'canceled'::text
      ])
    );
  end if;
end

$$;

-- 3) payment_method must be optional while order is still a draft
alter table public.orders
alter column payment_method drop not null;

-- 4) Add a lifecycle/payment consistency rule
-- draft      => payment_method must be null
-- submitted  => payment_method must be pay_now or net_30
-- canceled   => payment_method may be null or previously chosen
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_order_status_payment_method_check'
  ) then
    alter table public.orders
    add constraint orders_order_status_payment_method_check
    check (
      (order_status = 'draft' and payment_method is null)
      or
      (order_status = 'submitted' and payment_method in ('pay_now', 'net_30'))
      or
      (order_status = 'canceled')
    );
  end if;
end

$$;

-- 5) Backfill existing rows as already-submitted orders
update public.orders
set order_status = 'submitted'
where order_status is null
   or order_status = 'submitted';

-- 6) Helpful index for UI filtering
create index if not exists orders_order_status_idx
on public.orders (order_status);

commit;
