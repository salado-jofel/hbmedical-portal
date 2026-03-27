alter table public.payments
add column if not exists stripe_charge_id text null,
add column if not exists receipt_url text null;
