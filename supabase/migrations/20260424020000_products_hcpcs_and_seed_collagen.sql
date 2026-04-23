-- Adds HCPCS billing code to products + order_items, then replaces the
-- product catalog with the 5 Collagen items.
--
-- Replace strategy: any pre-existing product is set is_active=false rather
-- than deleted, so historical order_items keep their FK + the catalog
-- doesn't show stale entries in the picker.
--
-- Seed prices are 0.00 — admin will edit real prices via the Products page.

ALTER TABLE "public"."products"
  ADD COLUMN IF NOT EXISTS "hcpcs_code" text;

ALTER TABLE "public"."order_items"
  ADD COLUMN IF NOT EXISTS "hcpcs_code" text;

-- Index helps when reporting commissions/billing by HCPCS later.
CREATE INDEX IF NOT EXISTS "products_hcpcs_code_idx"
  ON "public"."products" ("hcpcs_code")
  WHERE "hcpcs_code" IS NOT NULL;

-- ── Replace the existing catalog ─────────────────────────────────────────
-- Deactivate everything that isn't one of the new SKUs. ON CONFLICT in the
-- INSERT below lets this migration be re-run safely.
UPDATE "public"."products"
   SET "is_active" = false
 WHERE "is_active" = true
   AND "sku" NOT IN (
     'CLG-PWD-1G',
     'CLG-DRS-1X1',
     'CLG-DRS-2X2',
     'CLG-DRS-7X7',
     'CLG-DRS-5X10'
   );

-- ── Seed the 5 new products ─────────────────────────────────────────────
-- Prices are 0.00 placeholders — admin edits via the Products page after
-- this migration runs.
INSERT INTO "public"."products"
  ("sku", "name", "category", "hcpcs_code", "unit_price", "is_active", "sort_order")
VALUES
  ('CLG-PWD-1G',   'Collagen Powder 1g',          'Collagen', 'A6010', 0.00, true, 10),
  ('CLG-DRS-1X1',  'Collagen Dressing 1" x 1"',   'Collagen', 'A6021', 0.00, true, 20),
  ('CLG-DRS-2X2',  'Collagen Dressing 2" x 2"',   'Collagen', 'A6021', 0.00, true, 30),
  ('CLG-DRS-7X7',  'Collagen Dressing 7" x 7"',   'Collagen', 'A6023', 0.00, true, 40),
  ('CLG-DRS-5X10', 'Collagen Dressing 5" x 10"',  'Collagen', 'A6023', 0.00, true, 50)
ON CONFLICT ("sku") DO UPDATE SET
  "name"       = EXCLUDED."name",
  "category"   = EXCLUDED."category",
  "hcpcs_code" = EXCLUDED."hcpcs_code",
  "is_active"  = true,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();

COMMENT ON COLUMN "public"."products"."hcpcs_code" IS
  'HCPCS billing code (e.g. A6010, A6021). Multiple products can share a code — HCPCS is a billing classification, not a unique product ID.';

COMMENT ON COLUMN "public"."order_items"."hcpcs_code" IS
  'Denormalized snapshot of products.hcpcs_code at order time, so historical orders survive product edits.';
