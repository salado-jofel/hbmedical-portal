-- Bound the orders.order_type column to a known enum set. Previously the
-- column was unconstrained text — the UI had a hidden toggle that
-- defaulted to "omeza", and a few legacy rows still carry
-- "surgical_collagen" from before the rebrand.
--
-- Phase 1 of the Skin Grafts / DME Collagen expansion. Adds the two new
-- enum values per Dr. Ben's spec while keeping the legacy values valid
-- so no row-level data backfill is needed.
--
-- Risk: zero — the CHECK is a superset of every value that exists today.
-- Straight DROP IF EXISTS + ADD per project pattern.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_check
    CHECK ((order_type IS NULL)
        OR (order_type = ANY (ARRAY[
              'skin_grafts'::text,
              'dme_collagen'::text,
              -- legacy values, kept for existing rows
              'surgical_collagen'::text,
              'omeza'::text
            ])));
