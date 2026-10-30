-- Products: restrict writes to admin.
--
-- The four policies this replaces were all `USING (true)` for the
-- `authenticated` role — every signed-in user (sales rep, clinical provider,
-- clinical staff, support) could insert, reprice or DELETE any row in the
-- product catalog by calling the client directly. The Products page is
-- admin-only in the sidebar, which hid the capability but did not remove it:
-- nav visibility is not an authorization boundary.
--
-- SELECT stays open to every authenticated user on purpose — order creation
-- reads the catalog through the *user* client (`getProducts` in
-- order-misc-actions.ts), so clinic-side roles and reps must keep read access
-- or ordering breaks.
--
-- The admin write path is unaffected: addProduct / editProduct / deleteProduct
-- in app/(dashboard)/dashboard/products/(services)/actions.ts also run on the
-- user client and are already gated by requireAdminOrThrow, so an admin
-- satisfies both the action gate and these policies.

DROP POLICY IF EXISTS "products_select_all_authenticated" ON public.products;
DROP POLICY IF EXISTS "products_insert_authenticated"      ON public.products;
DROP POLICY IF EXISTS "products_update_authenticated"      ON public.products;
DROP POLICY IF EXISTS "products_delete_authenticated"      ON public.products;

-- Read: any authenticated user (required by order creation).
CREATE POLICY "products_select_authenticated" ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

-- Write: admin only.
CREATE POLICY "products_admin_insert" ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
  );

CREATE POLICY "products_admin_update" ON public.products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
  );

CREATE POLICY "products_admin_delete" ON public.products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid()) AND profiles.role = 'admin'
    )
  );
