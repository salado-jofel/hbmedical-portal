-- 1. Create order_items table
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null check (btrim(product_name) <> ''),
  product_sku text not null check (btrim(product_sku) <> ''),
  unit_price numeric not null default 0 check (unit_price >= 0),
  quantity int not null default 1 check (quantity > 0),
  shipping_amount numeric not null default 0 check (shipping_amount >= 0),
  tax_amount numeric not null default 0 check (tax_amount >= 0),
  subtotal numeric generated always as (quantity::numeric * unit_price) stored,
  total_amount numeric generated always as (
    (quantity::numeric * unit_price) + shipping_amount + tax_amount
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Enable RLS
alter table public.order_items enable row level security;

-- 3. RLS policies
create policy "Facility owner can view own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      join public.facilities f on f.id = o.facility_id
      where o.id = order_items.order_id
        and f.user_id = auth.uid()
    )
  );

create policy "Facility owner can insert order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      join public.facilities f on f.id = o.facility_id
      where o.id = order_items.order_id
        and f.user_id = auth.uid()
    )
  );

create policy "Facility owner can update own order items"
  on public.order_items for update
  using (
    exists (
      select 1 from public.orders o
      join public.facilities f on f.id = o.facility_id
      where o.id = order_items.order_id
        and f.user_id = auth.uid()
    )
  );

create policy "Facility owner can delete own order items"
  on public.order_items for delete
  using (
    exists (
      select 1 from public.orders o
      join public.facilities f on f.id = o.facility_id
      where o.id = order_items.order_id
        and f.user_id = auth.uid()
    )
  );

-- 4. Backfill existing orders into order_items
insert into public.order_items (
  order_id, product_id, product_name, product_sku,
  unit_price, quantity, shipping_amount, tax_amount
)
select
  id, product_id, product_name, product_sku,
  unit_price, quantity, shipping_amount, tax_amount
from public.orders;

-- 5. Drop generated columns FIRST (they depend on unit_price and quantity)
alter table public.orders
  drop column subtotal,
  drop column total_amount;

-- 6. Now drop the remaining line-item columns safely
alter table public.orders
  drop column product_id,
  drop column product_name,
  drop column product_sku,
  drop column unit_price,
  drop column quantity,
  drop column shipping_amount,
  drop column tax_amount;