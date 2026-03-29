-- ============================================
-- Fix products RLS for dashboard CRUD
-- ============================================

alter table public.products enable row level security;

-- Clean re-runs
drop policy if exists products_select_active on public.products;
drop policy if exists products_select_all_authenticated on public.products;
drop policy if exists products_insert_authenticated on public.products;
drop policy if exists products_update_authenticated on public.products;
drop policy if exists products_delete_authenticated on public.products;

-- Allow authenticated users to view all products in dashboard
create policy products_select_all_authenticated
on public.products
for select
to authenticated
using (true);

-- Allow authenticated users to add products
create policy products_insert_authenticated
on public.products
for insert
to authenticated
with check (true);

-- Allow authenticated users to update products
create policy products_update_authenticated
on public.products
for update
to authenticated
using (true)
with check (true);

-- Allow authenticated users to delete products
create policy products_delete_authenticated
on public.products
for delete
to authenticated
using (true);

-- Grants
grant select, insert, update, delete on public.products to authenticated;
grant select, insert, update, delete on public.products to service_role;
