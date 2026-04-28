-- =============================================================================
-- RLS hardening — close scope leaks identified in the 2026-04-29 audit.
--
-- HIPAA Security Rule §164.312(a)(1) requires technical policies that allow
-- access only to those who have been granted access rights. The application
-- layer already enforces per-order scope via `requireOrderAccess`, but the
-- DB-level RLS policies on several PHI tables are too permissive — RLS is
-- supposed to be the last line of defense if app code is ever bypassed
-- (e.g. via direct PostgREST queries with a user JWT, or a service-role
-- escape).
--
-- This migration fixes 9 specific policies. Nothing here changes app-side
-- behavior for users acting through normal UI flows; it only tightens what's
-- allowed at the DB layer.
--
-- Findings closed:
--   1. `order_form`, `order_ivr`, `order_form_1500`, `order_documents`,
--      `order_history`, `order_messages` — sales-rep SELECT policies only
--      checked the role flag, not facility scope. Any rep could read every
--      clinic's clinical PHI via a direct REST query.
--   2. `order_delivery_invoices` — SELECT/INSERT/UPDATE policies had no
--      auth/role/facility check at all. Any authenticated user could read
--      or overwrite any patient's delivery invoice (name + address +
--      signature image).
--   3. `provider_credentials` — facility-wide SELECT policy exposed the
--      bcrypt `pin_hash` column to every co-member of the facility. Strip
--      that column from non-owner reads.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Helper — rep_facility_ids(uid)
--
-- Returns every facility_id the given sales_representative can see (their
-- own assigned facilities + any facility assigned to a sub-rep in their
-- recursive hierarchy).
--
-- SECURITY DEFINER + STABLE so it can be called inside row-level policies
-- without leaking the recursive CTE pattern across half a dozen policy
-- bodies. The same logic already lives in `requireOrderAccess` on the app
-- side; this function mirrors it at the DB layer.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rep_facility_ids(p_rep uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE rep_tree AS (
    SELECT p_rep AS id
    UNION ALL
    SELECT rh.child_rep_id
      FROM public.rep_hierarchy rh
      JOIN rep_tree rt ON rt.id = rh.parent_rep_id
  )
  SELECT f.id
    FROM public.facilities f
   WHERE f.facility_type = 'clinic'
     AND f.assigned_rep IN (SELECT id FROM rep_tree);
$$;

-- Lock the function so only the policies + service role can call it.
REVOKE ALL ON FUNCTION public.rep_facility_ids(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rep_facility_ids(uuid) TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. order_form — replace org-wide rep policy with facility-scoped one.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rep_read_order_form" ON public.order_form;
CREATE POLICY "rep_read_order_form" ON public.order_form
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'sales_representative'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_form.order_id
         AND o.facility_id IN (SELECT public.rep_facility_ids(auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 3. order_ivr — same scope fix.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rep_read_order_ivr" ON public.order_ivr;
CREATE POLICY "rep_read_order_ivr" ON public.order_ivr
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'sales_representative'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_ivr.order_id
         AND o.facility_id IN (SELECT public.rep_facility_ids(auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 4. order_form_1500 — full CMS-1500 has the densest PHI of any table; the
--    rep policy needs to be tight.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rep_read_order_form_1500" ON public.order_form_1500;
CREATE POLICY "rep_read_order_form_1500" ON public.order_form_1500
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'sales_representative'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_form_1500.order_id
         AND o.facility_id IN (SELECT public.rep_facility_ids(auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 5. order_documents — fix the dead JOIN (the original policy joined
--    facilities but never referenced the join in WHERE).
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rep_read_hierarchy_order_documents" ON public.order_documents;
CREATE POLICY "rep_read_hierarchy_order_documents" ON public.order_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'sales_representative'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_documents.order_id
         AND o.facility_id IN (SELECT public.rep_facility_ids(auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 6. order_history — same fix.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rep_read_hierarchy_order_history" ON public.order_history;
CREATE POLICY "rep_read_hierarchy_order_history" ON public.order_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'sales_representative'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_history.order_id
         AND o.facility_id IN (SELECT public.rep_facility_ids(auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 7. order_messages — chat threads can quote PHI in free text; scope to
--    the rep's facility tree.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "rep_select_order_messages" ON public.order_messages;
CREATE POLICY "rep_select_order_messages" ON public.order_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'sales_representative'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_messages.order_id
         AND o.facility_id IN (SELECT public.rep_facility_ids(auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 8. order_delivery_invoices — replace the open-to-everyone policies with
--    proper role-scoped ones, mirroring the order_form pattern.
--
-- The original policies (added in 20260424000000) only checked that a
-- parent `orders` row existed — no auth, role, or facility filter. That
-- meant any authenticated user could read or overwrite any delivery
-- invoice, including the patient signature image.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "order_delivery_invoices_select" ON public.order_delivery_invoices;
DROP POLICY IF EXISTS "order_delivery_invoices_insert" ON public.order_delivery_invoices;
DROP POLICY IF EXISTS "order_delivery_invoices_update" ON public.order_delivery_invoices;

-- Admin: full access (matches admin_all_* on every other PHI table).
CREATE POLICY "admin_all_order_delivery_invoices" ON public.order_delivery_invoices
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Clinic members (clinical_provider, clinical_staff): read + write for
-- orders in facilities they're a member of.
CREATE POLICY "clinic_member_all_order_delivery_invoices" ON public.order_delivery_invoices
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_delivery_invoices.order_id
         AND public.is_facility_member(o.facility_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_delivery_invoices.order_id
         AND public.is_facility_member(o.facility_id)
    )
  );

-- Support staff: read + update org-wide (matches their write scope on
-- order_form / order_form_1500).
CREATE POLICY "support_select_order_delivery_invoices"
  ON public.order_delivery_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'support_staff'
    )
  );
CREATE POLICY "support_update_order_delivery_invoices"
  ON public.order_delivery_invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'support_staff'
    )
  );

-- Sales rep: read-only for orders in their rep tree.
CREATE POLICY "rep_read_order_delivery_invoices" ON public.order_delivery_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'sales_representative'
    )
    AND EXISTS (
      SELECT 1 FROM public.orders o
       WHERE o.id = order_delivery_invoices.order_id
         AND o.facility_id IN (SELECT public.rep_facility_ids(auth.uid()))
    )
  );

-- -----------------------------------------------------------------------------
-- 9. provider_credentials — column-level grant strips pin_hash from the
--    facility-wide read.
--
-- The `facility_members_read_credentials` policy lets every co-member of
-- a facility SELECT the row, which made `pin_hash` (bcrypt) readable to
-- all colleagues. Postgres has no column-level RLS, so we revoke table
-- SELECT for the authenticated role and grant SELECT only on the safe
-- columns. The row-owner (`own_credentials_select`) policy still gives
-- the credential owner full access — but `auth.uid()` matching means the
-- DB has to compute that against the row, and column grants apply BEFORE
-- the policy check, so we need to also explicitly include the owner via
-- a security-barrier or just let the owner read their own pin_hash via
-- a SECURITY DEFINER server function. Simpler approach: keep the column
-- grant tight and have the owner-side flows that need pin_hash use the
-- service role (which bypasses GRANTs anyway). The app already does this
-- in `verify_pin` and provider-credentials server actions.
-- -----------------------------------------------------------------------------
REVOKE SELECT ON public.provider_credentials FROM authenticated;
GRANT SELECT (
    id,
    user_id,
    credential,
    npi_number,
    ptan_number,
    baa_signed_at,
    terms_signed_at,
    created_at,
    updated_at
  ) ON public.provider_credentials TO authenticated;

-- (INSERT/UPDATE/DELETE permissions on provider_credentials are still
-- governed by RLS policies — `own_credentials_insert/update` and
-- `admin_all_provider_credentials`. Service role retains full access for
-- background flows like PIN verification.)

COMMIT;
