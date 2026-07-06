-- IVR Phase 4: link the order-side IVR record back to the standalone IVR
-- it was converted from.
--
-- When clinic staff clicks "Create Order from IVR" on an approved standalone
-- IVR, the portal seeds an order + order_ivr row from it. Storing the source
-- ID on order_ivr lets the IVR tab display an "approved externally by …"
-- banner and gives compliance a hard link between the two records.
--
-- Nullable — orders that weren't created from a standalone IVR (all today's
-- orders, and any DME/collagen-path orders where the IVR is built in-portal)
-- leave this column NULL and behave exactly as before.

ALTER TABLE public.order_ivr
  ADD COLUMN linked_standalone_ivr_id uuid
    REFERENCES public.standalone_ivrs(id) ON DELETE SET NULL;

CREATE INDEX order_ivr_linked_standalone_idx
  ON public.order_ivr (linked_standalone_ivr_id)
  WHERE linked_standalone_ivr_id IS NOT NULL;
