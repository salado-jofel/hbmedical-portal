-- Client delivered the actual 2026 pricing. The catalog moves from flat
-- single-price SKUs (yesterday's seed) to tiered supply-duration SKUs —
-- each supply box (15 / 21 / 30 day) is its own product row so the existing
-- picker / line-items / commissions logic continues to work unchanged.
--
-- Strategy:
--  1. Deactivate the 4 old flat SKUs that are now split into tiers. The
--     CLG-DRS-7X7 row is left alone per client ("leave it as is") since no
--     pricing was provided for 7x7.
--  2. Insert 17 new tiered SKUs with real prices. Name encodes the supply
--     duration so it's visible in the picker.
--  3. New products:
--     - 4x4 Collagen Dressing (all three tiers) — wasn't in the old seed
--     - Surgical Collagen Powder 1ml / 5ml vials — different pricing model
--       (vial size, not supply days); HCPCS left blank until client confirms.
--
-- ON CONFLICT makes this safely re-runnable.

-- ── Deactivate superseded flat SKUs ──────────────────────────────────────
UPDATE "public"."products"
   SET "is_active" = false,
       "updated_at" = now()
 WHERE "sku" IN (
     'CLG-PWD-1G',
     'CLG-DRS-1X1',
     'CLG-DRS-2X2',
     'CLG-DRS-5X10'
   );

-- ── Insert the tiered catalog ───────────────────────────────────────────
INSERT INTO "public"."products"
  ("sku", "name", "category", "hcpcs_code", "unit_price", "is_active", "sort_order")
VALUES
  -- 1 Gram Collagen Powder
  ('CLG-PWD-1G-15D',    '1 Gram Collagen Powder — 15 Day Supply',      'Collagen', 'A6010',  315.00, true, 100),
  ('CLG-PWD-1G-21D',    '1 Gram Collagen Powder — 21 Day Supply',      'Collagen', 'A6010',  441.00, true, 101),
  ('CLG-PWD-1G-30D',    '1 Gram Collagen Powder — 30 Day Supply',      'Collagen', 'A6010',  630.00, true, 102),

  -- 1x1 Collagen Dressing
  ('CLG-DRS-1X1-15D',   'Collagen Dressing 1" x 1" — 15 Day Supply',   'Collagen', 'A6021',  202.50, true, 110),
  ('CLG-DRS-1X1-21D',   'Collagen Dressing 1" x 1" — 21 Day Supply',   'Collagen', 'A6021',  283.50, true, 111),
  ('CLG-DRS-1X1-30D',   'Collagen Dressing 1" x 1" — 30 Day Supply',   'Collagen', 'A6021',  405.00, true, 112),

  -- 2x2 Collagen Dressing
  ('CLG-DRS-2X2-15D',   'Collagen Dressing 2" x 2" — 15 Day Supply',   'Collagen', 'A6021',  240.00, true, 120),
  ('CLG-DRS-2X2-21D',   'Collagen Dressing 2" x 2" — 21 Day Supply',   'Collagen', 'A6021',  336.00, true, 121),
  ('CLG-DRS-2X2-30D',   'Collagen Dressing 2" x 2" — 30 Day Supply',   'Collagen', 'A6021',  580.00, true, 122),

  -- 4x4 Collagen Dressing (new size, A6021 family per client)
  ('CLG-DRS-4X4-15D',   'Collagen Dressing 4" x 4" — 15 Day Supply',   'Collagen', 'A6021',  315.00, true, 130),
  ('CLG-DRS-4X4-21D',   'Collagen Dressing 4" x 4" — 21 Day Supply',   'Collagen', 'A6021',  441.00, true, 131),
  ('CLG-DRS-4X4-30D',   'Collagen Dressing 4" x 4" — 30 Day Supply',   'Collagen', 'A6021',  630.00, true, 132),

  -- 5x10 Collagen Dressing
  ('CLG-DRS-5X10-15D',  'Collagen Dressing 5" x 10" — 15 Day Supply',  'Collagen', 'A6023', 1800.00, true, 140),
  ('CLG-DRS-5X10-21D',  'Collagen Dressing 5" x 10" — 21 Day Supply',  'Collagen', 'A6023', 2520.00, true, 141),
  ('CLG-DRS-5X10-30D',  'Collagen Dressing 5" x 10" — 30 Day Supply',  'Collagen', 'A6023', 3600.00, true, 142),

  -- Surgical Collagen Powder (vial sizes, not supply days — HCPCS blank until confirmed)
  ('CLG-SURG-1ML',      'Surgical Collagen Powder — 1ml Vial',         'Collagen', NULL,     400.00, true, 200),
  ('CLG-SURG-5ML',      'Surgical Collagen Powder — 5ml Vial',         'Collagen', NULL,    1390.00, true, 201)
ON CONFLICT ("sku") DO UPDATE SET
  "name"       = EXCLUDED."name",
  "category"   = EXCLUDED."category",
  "hcpcs_code" = EXCLUDED."hcpcs_code",
  "unit_price" = EXCLUDED."unit_price",
  "is_active"  = true,
  "sort_order" = EXCLUDED."sort_order",
  "updated_at" = now();
