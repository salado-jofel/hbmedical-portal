-- Silo the Order Form to the clinic side: admin becomes read-only on it.
--
-- Client instruction (2026-10-28): "the form can be changed and manipulated
-- on the admin side. It needs to be siloed out and only changeable on the
-- clinic side." Scoped to the Order Form alone -- the IVR, HCFA/1500 and
-- invoices stay fully admin-editable and are untouched here.
--
-- Before: admin_all_order_form was FOR ALL with no further condition, so an
-- admin could insert, update or delete any order_form row at any status. The
-- two clinic-side policies both require is_locked = false; admin's did not.
--
-- Now: admin keeps unrestricted SELECT and loses INSERT/UPDATE/DELETE.
--
-- This is defence-in-depth, not the primary gate. saveOrderForm reaches the
-- database through the service-role client, which bypasses RLS entirely, so
-- the enforcement that actually stops an admin edit is
-- requireOrderFormEditRole in app/(dashboard)/dashboard/orders/(services)/
-- _shared.ts. This policy covers a direct client-side write instead.
--
-- Nothing in the app relied on admin's write access through RLS: every
-- server-side order_form write (AI extraction, signing, PDF regeneration,
-- saveOrderForm) uses the service-role client and is unaffected.

DROP POLICY IF EXISTS "admin_all_order_form" ON public.order_form;

CREATE POLICY "admin_read_order_form" ON public.order_form
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

COMMENT ON POLICY "admin_read_order_form" ON public.order_form IS
  'Admin reads every order_form but cannot write one. The order form is the clinic''s prescription; admins request changes via Request Info instead of editing. Replaced admin_all_order_form (FOR ALL) on 2026-10-29.';
