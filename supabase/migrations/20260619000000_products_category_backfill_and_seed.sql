-- Phase 1 of the Skin Grafts / DME Collagen product category work.
--
-- Two operations, one migration:
--   1. Backfill the existing 23 "Collagen" products to the canonical
--      "dme_collagen" category value so the order picker can filter them
--      when a DME Collagen order is created.
--   2. Seed six new SKUs per Dr. Ben's spec: three Skin Grafts products
--      (Carefirst, Resolve Matrix, Caregraft) and three DME Collagen
--      variants (1g powder, dressings >48 sq, dressings <48 sq).
--
-- Per product decision: NO DB CHECK constraint on products.category — the
-- column stays soft-typed so future categories don't require a migration.
-- The UI dropdown is the enforcement layer.
--
-- Idempotent guards:
--   - The backfill only flips rows that are still on the legacy value.
--   - The seed uses ON CONFLICT (sku) DO NOTHING so re-running is safe.

-- ── Step 1: Backfill existing Collagen products ──
UPDATE public.products
   SET category = 'dme_collagen',
       updated_at = now()
 WHERE category = 'Collagen';

-- ── Step 2: Seed new products per Dr. Ben (2026-06-19) ──
-- Skin Grafts category. HCPCS codes left NULL — Dr. Ben can fill them in
-- via the admin UI once the manufacturer-specific codes are confirmed.
-- Unit prices left at 0.00 — placeholder until pricing is locked in.

INSERT INTO public.products (sku, name, category, hcpcs_code, unit_price, is_active)
VALUES
  ('SG-CAREFIRST',  'Carefirst',       'skin_grafts',  NULL, 0.00, true),
  ('SG-RESMTX',     'Resolve Matrix',  'skin_grafts',  NULL, 0.00, true),
  ('SG-CAREGRAFT',  'Caregraft',       'skin_grafts',  NULL, 0.00, true),
  ('DME-CLG-PWD-1G',         'Collagen Powder 1 Gram',       'dme_collagen', 'A6010', 0.00, true),
  ('DME-CLG-DRS-GT48',       'Collagen Dressings >48 squares', 'dme_collagen', 'A6021', 0.00, true),
  ('DME-CLG-DRS-LT48',       'Collagen Dressings <48 squares', 'dme_collagen', 'A6021', 0.00, true)
ON CONFLICT (sku) DO NOTHING;
