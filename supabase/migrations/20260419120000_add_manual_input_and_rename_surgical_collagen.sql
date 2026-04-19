-- ============================================================================
--  Orders: rename 'non_omeza' order type → 'surgical_collagen'
--          and add manual_input flag (skip AI extraction entirely)
-- ============================================================================

-- 1. Persist manual_input flag on the orders row.
--    Default false = AI extraction runs as before. true = user chose to fill
--    order_form, IVR, and HCFA/1500 manually; no AI extraction, no enrollment
--    auto-init, document uploads become optional.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS manual_input boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.manual_input IS
  'True if the user chose to skip AI extraction and fill order_form / IVR / HCFA-1500 manually. Uploads (facesheet, clinical docs) are optional in this mode.';

-- 2. Rename stored value for the product category: non_omeza → surgical_collagen.
--    order_type is an unconstrained text column, so no check constraint to drop.
UPDATE public.orders
   SET order_type = 'surgical_collagen'
 WHERE order_type = 'non_omeza';
