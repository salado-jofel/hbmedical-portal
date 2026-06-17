-- Extend the orders.wound_type CHECK constraint to allow DFU and VLU.
-- Phase 1 of the DFU/VLU wound-type expansion. The buttons + interim
-- rendering ship with this migration; Phase 2 will wire custom form
-- variants once Dr. Ben provides the file format.
--
-- Risk: zero — no existing rows have dfu/vlu and the new constraint is
-- a superset of the old one. Straight DROP + ADD per project pattern.

ALTER TABLE public.orders
  DROP CONSTRAINT orders_wound_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_wound_type_check
    CHECK ((wound_type IS NULL)
        OR (wound_type = ANY (ARRAY['chronic'::text,
                                    'post_surgical'::text,
                                    'dfu'::text,
                                    'vlu'::text])));
