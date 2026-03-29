-- ============================================
-- Phase 2: Commerce Tables
-- Final corrected version for brand-new creation
-- Tables:
-- - products
-- - orders
-- - invoices
-- - payments
-- - shipments
--
-- Assumptions:
-- - public.profiles already exists
-- - public.facilities already exists
-- - one facility belongs to one user
-- - one order = one product + quantity
-- ============================================

create extension if not exists pgcrypto;

-- --------------------------------------------
-- Helper: auto-update updated_at
-- Safe to re-declare for standalone migration use
-- --------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;

$$;

-- ============================================
-- products
-- Shared product catalog
-- ============================================
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),

  sku text not null,
  name text not null,
  description text,
  category text,

  unit_price numeric(12,2) not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_sku_not_blank
    check (btrim(sku) <> ''),

  constraint products_name_not_blank
    check (btrim(name) <> ''),

  constraint products_category_not_blank
    check (category is null or btrim(category) <> ''),

  constraint products_unit_price_non_negative
    check (unit_price >= 0),

  constraint products_sort_order_non_negative
    check (sort_order >= 0)
);

create unique index if not exists products_sku_lower_uidx
  on public.products (lower(sku));

create index if not exists products_is_active_idx
  on public.products (is_active);

create index if not exists products_category_idx
  on public.products (category);

create index if not exists products_sort_order_idx
  on public.products (sort_order);

drop trigger if exists trg_products_set_updated_at on public.products;
create trigger trg_products_set_updated_at
before update on public.products
for each row
execute function public.set_updated_at();

comment on table public.products is
  'Shared product catalog for ordering.';

comment on column public.products.sku is
  'Unique product SKU used across catalog, ordering, and integrations.';

comment on column public.products.unit_price is
  'Current catalog unit price. Historical order pricing is stored on orders.';

comment on column public.products.sort_order is
  'Ascending UI display order for active products.';

-- ============================================
-- orders
-- One order = one product + quantity
-- Stores product snapshot fields for historical accuracy
-- ============================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),

  order_number text not null,

  facility_id uuid not null
    references public.facilities(id)
    on delete restrict,

  product_id uuid not null
    references public.products(id)
    on delete restrict,

  product_name text not null,
  product_sku text not null,

  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,

  shipping_amount numeric(12,2) not null default 0,
  tax_amount numeric(12,2) not null default 0,

  subtotal numeric(12,2)
    generated always as ((quantity::numeric * unit_price)) stored,

  total_amount numeric(12,2)
    generated always as (((quantity::numeric * unit_price) + shipping_amount + tax_amount)) stored,

  payment_method text not null,
  payment_status text not null default 'pending',
  invoice_status text not null default 'not_applicable',
  fulfillment_status text not null default 'pending',
  delivery_status text not null default 'not_shipped',

  tracking_number text,
  notes text,

  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  delivered_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_order_number_not_blank
    check (btrim(order_number) <> ''),

  constraint orders_product_name_not_blank
    check (btrim(product_name) <> ''),

  constraint orders_product_sku_not_blank
    check (btrim(product_sku) <> ''),

  constraint orders_quantity_positive
    check (quantity > 0),

  constraint orders_unit_price_non_negative
    check (unit_price >= 0),

  constraint orders_shipping_amount_non_negative
    check (shipping_amount >= 0),

  constraint orders_tax_amount_non_negative
    check (tax_amount >= 0),

  constraint orders_payment_method_check
    check (payment_method in ('pay_now', 'net_30')),

  constraint orders_payment_status_check
    check (
      payment_status in (
        'pending',
        'paid',
        'failed',
        'refunded',
        'partially_refunded',
        'canceled'
      )
    ),

  constraint orders_invoice_status_check
    check (
      invoice_status in (
        'not_applicable',
        'draft',
        'issued',
        'sent',
        'partially_paid',
        'paid',
        'overdue',
        'void'
      )
    ),

  constraint orders_fulfillment_status_check
    check (
      fulfillment_status in (
        'pending',
        'processing',
        'fulfilled',
        'canceled'
      )
    ),

  constraint orders_delivery_status_check
    check (
      delivery_status in (
        'not_shipped',
        'label_created',
        'in_transit',
        'delivered',
        'returned',
        'exception',
        'canceled'
      )
    )
);

create unique index if not exists orders_order_number_lower_uidx
  on public.orders (lower(order_number));

create index if not exists orders_facility_id_idx
  on public.orders (facility_id);

create index if not exists orders_product_id_idx
  on public.orders (product_id);

create index if not exists orders_payment_method_idx
  on public.orders (payment_method);

create index if not exists orders_payment_status_idx
  on public.orders (payment_status);

create index if not exists orders_invoice_status_idx
  on public.orders (invoice_status);

create index if not exists orders_fulfillment_status_idx
  on public.orders (fulfillment_status);

create index if not exists orders_delivery_status_idx
  on public.orders (delivery_status);

create index if not exists orders_placed_at_idx
  on public.orders (placed_at desc);

drop trigger if exists trg_orders_set_updated_at on public.orders;
create trigger trg_orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

comment on table public.orders is
  'Commerce order table. Each row represents one purchased product and quantity for one facility.';

comment on column public.orders.product_name is
  'Snapshot of product name at time of order creation.';

comment on column public.orders.product_sku is
  'Snapshot of product SKU at time of order creation.';

comment on column public.orders.unit_price is
  'Snapshot of unit price at time of order creation.';

comment on column public.orders.payment_method is
  'Checkout method: pay_now or net_30.';

comment on column public.orders.payment_status is
  'Summary payment state for UI and workflow handling.';

comment on column public.orders.invoice_status is
  'Summary invoice state for net-30 flow.';

comment on column public.orders.fulfillment_status is
  'Internal fulfillment status before/after shipping.';

comment on column public.orders.delivery_status is
  'Shipment delivery state mirrored for UI convenience.';

comment on column public.orders.tracking_number is
  'Current tracking number summary mirrored from shipments when available.';

-- ============================================
-- invoices
-- Net-30 invoice records linked to orders
-- Typically one invoice per order
-- ============================================
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  invoice_number text not null,
  provider text not null default 'internal',
  provider_invoice_id text,

  status text not null default 'draft',

  amount_due numeric(12,2) not null,
  amount_paid numeric(12,2) not null default 0,
  currency text not null default 'USD',

  due_at timestamptz,
  issued_at timestamptz,
  paid_at timestamptz,

  hosted_invoice_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_invoice_number_not_blank
    check (btrim(invoice_number) <> ''),

  constraint invoices_provider_not_blank
    check (btrim(provider) <> ''),

  constraint invoices_status_check
    check (
      status in (
        'draft',
        'issued',
        'sent',
        'partially_paid',
        'paid',
        'overdue',
        'void'
      )
    ),

  constraint invoices_amount_due_non_negative
    check (amount_due >= 0),

  constraint invoices_amount_paid_non_negative
    check (amount_paid >= 0),

  constraint invoices_amount_paid_lte_amount_due
    check (amount_paid <= amount_due),

  constraint invoices_currency_iso3_check
    check (currency ~ '^[A-Z]{3}$')
);

create unique index if not exists invoices_order_id_uidx
  on public.invoices (order_id);

create unique index if not exists invoices_invoice_number_lower_uidx
  on public.invoices (lower(invoice_number));

create unique index if not exists invoices_provider_invoice_id_uidx
  on public.invoices (provider_invoice_id)
  where provider_invoice_id is not null;

create index if not exists invoices_status_idx
  on public.invoices (status);

create index if not exists invoices_due_at_idx
  on public.invoices (due_at);

create index if not exists invoices_paid_at_idx
  on public.invoices (paid_at);

drop trigger if exists trg_invoices_set_updated_at on public.invoices;
create trigger trg_invoices_set_updated_at
before update on public.invoices
for each row
execute function public.set_updated_at();

comment on table public.invoices is
  'Invoice records for net-30 or manually invoiced orders.';

comment on column public.invoices.provider is
  'Invoice system/provider, e.g. internal, stripe, manual.';

comment on column public.invoices.provider_invoice_id is
  'External provider invoice id when applicable.';

comment on column public.invoices.hosted_invoice_url is
  'Hosted invoice page URL if provided by external billing system.';

-- ============================================
-- payments
-- Payment attempts and payment confirmations linked to orders
-- Can store Stripe checkout / webhook payment data
-- Multiple payments may exist per order if needed
-- ============================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  provider text not null,
  payment_type text not null,
  status text not null default 'pending',

  amount numeric(12,2) not null,
  currency text not null default 'USD',

  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  provider_payment_id text,

  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_provider_not_blank
    check (btrim(provider) <> ''),

  constraint payments_payment_type_check
    check (
      payment_type in (
        'checkout',
        'invoice',
        'manual'
      )
    ),

  constraint payments_status_check
    check (
      status in (
        'pending',
        'paid',
        'failed',
        'refunded',
        'partially_refunded',
        'canceled'
      )
    ),

  constraint payments_amount_non_negative
    check (amount >= 0),

  constraint payments_currency_iso3_check
    check (currency ~ '^[A-Z]{3}$')
);

create index if not exists payments_order_id_idx
  on public.payments (order_id);

create index if not exists payments_status_idx
  on public.payments (status);

create index if not exists payments_paid_at_idx
  on public.payments (paid_at);

create index if not exists payments_created_at_idx
  on public.payments (created_at desc);

create unique index if not exists payments_stripe_checkout_session_id_uidx
  on public.payments (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists payments_stripe_payment_intent_id_uidx
  on public.payments (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists payments_provider_payment_id_uidx
  on public.payments (provider_payment_id)
  where provider_payment_id is not null;

drop trigger if exists trg_payments_set_updated_at on public.payments;
create trigger trg_payments_set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

comment on table public.payments is
  'Payment records linked to orders, including Stripe checkout and invoice payment events.';

comment on column public.payments.provider is
  'Payment provider, e.g. stripe, invoice, manual.';

comment on column public.payments.payment_type is
  'Payment source type: checkout, invoice, or manual.';

comment on column public.payments.stripe_checkout_session_id is
  'Stripe Checkout Session id when payment_method is pay_now.';

comment on column public.payments.stripe_payment_intent_id is
  'Stripe Payment Intent id when available.';

comment on column public.payments.provider_payment_id is
  'External provider payment id when applicable.';

-- ============================================
-- shipments
-- Shipment tracking records linked to orders
-- Typically one shipment row per order in current model
-- ============================================
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),

  order_id uuid not null
    references public.orders(id)
    on delete cascade,

  carrier text,
  service_level text,
  tracking_number text,
  tracking_url text,

  shipstation_order_id text,
  shipstation_shipment_id text,

  status text not null default 'pending',

  shipped_at timestamptz,
  estimated_delivery_at timestamptz,
  delivered_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint shipments_carrier_not_blank
    check (carrier is null or btrim(carrier) <> ''),

  constraint shipments_service_level_not_blank
    check (service_level is null or btrim(service_level) <> ''),

  constraint shipments_tracking_number_not_blank
    check (tracking_number is null or btrim(tracking_number) <> ''),

  constraint shipments_status_check
    check (
      status in (
        'pending',
        'label_created',
        'in_transit',
        'delivered',
        'returned',
        'exception',
        'canceled'
      )
    )
);

create unique index if not exists shipments_order_id_uidx
  on public.shipments (order_id);

create unique index if not exists shipments_tracking_number_uidx
  on public.shipments (tracking_number)
  where tracking_number is not null;

create unique index if not exists shipments_shipstation_order_id_uidx
  on public.shipments (shipstation_order_id)
  where shipstation_order_id is not null;

create unique index if not exists shipments_shipstation_shipment_id_uidx
  on public.shipments (shipstation_shipment_id)
  where shipstation_shipment_id is not null;

create index if not exists shipments_status_idx
  on public.shipments (status);

create index if not exists shipments_delivered_at_idx
  on public.shipments (delivered_at);

drop trigger if exists trg_shipments_set_updated_at on public.shipments;
create trigger trg_shipments_set_updated_at
before update on public.shipments
for each row
execute function public.set_updated_at();

comment on table public.shipments is
  'Shipment and tracking records linked to orders.';

comment on column public.shipments.shipstation_order_id is
  'ShipStation order identifier when synced externally.';

comment on column public.shipments.shipstation_shipment_id is
  'ShipStation shipment identifier when synced externally.';

comment on column public.shipments.tracking_url is
  'Carrier or provider tracking URL for the shipment.';

-- ============================================
-- RLS
-- ============================================
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.shipments enable row level security;

-- Clean re-runs
drop policy if exists products_select_active on public.products;

drop policy if exists orders_select_own on public.orders;
drop policy if exists orders_insert_own on public.orders;
drop policy if exists orders_update_own on public.orders;

drop policy if exists invoices_select_own on public.invoices;
drop policy if exists payments_select_own on public.payments;
drop policy if exists shipments_select_own on public.shipments;

-- --------------------------------------------
-- products policies
-- Authenticated users can read active products
-- --------------------------------------------
create policy products_select_active
on public.products
for select
to authenticated
using (is_active = true);

-- --------------------------------------------
-- orders policies
-- Users can access only orders for their own facility
-- --------------------------------------------
create policy orders_select_own
on public.orders
for select
to authenticated
using (
  exists (
    select 1
    from public.facilities f
    where f.id = orders.facility_id
      and f.user_id = auth.uid()
  )
);

create policy orders_insert_own
on public.orders
for insert
to authenticated
with check (
  exists (
    select 1
    from public.facilities f
    where f.id = orders.facility_id
      and f.user_id = auth.uid()
  )
);

create policy orders_update_own
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
)
with check (
  exists (
    select 1
    from public.facilities f
    where f.id = orders.facility_id
      and f.user_id = auth.uid()
  )
);

-- --------------------------------------------
-- invoices policies
-- Users can read only invoices tied to their own orders
-- --------------------------------------------
create policy invoices_select_own
on public.invoices
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.facilities f
      on f.id = o.facility_id
    where o.id = invoices.order_id
      and f.user_id = auth.uid()
  )
);

-- --------------------------------------------
-- payments policies
-- Users can read only payments tied to their own orders
-- --------------------------------------------
create policy payments_select_own
on public.payments
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.facilities f
      on f.id = o.facility_id
    where o.id = payments.order_id
      and f.user_id = auth.uid()
  )
);

-- --------------------------------------------
-- shipments policies
-- Users can read only shipments tied to their own orders
-- --------------------------------------------
create policy shipments_select_own
on public.shipments
for select
to authenticated
using (
  exists (
    select 1
    from public.orders o
    join public.facilities f
      on f.id = o.facility_id
    where o.id = shipments.order_id
      and f.user_id = auth.uid()
  )
);

-- ============================================
-- Grants
-- ============================================
grant select on public.products to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select on public.invoices to authenticated;
grant select on public.payments to authenticated;
grant select on public.shipments to authenticated;

grant select, insert, update, delete on public.products to service_role;
grant select, insert, update, delete on public.orders to service_role;
grant select, insert, update, delete on public.invoices to service_role;
grant select, insert, update, delete on public.payments to service_role;
grant select, insert, update, delete on public.shipments to service_role;
