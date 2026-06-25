-- Flip the physician-attestation column defaults from false → true and
-- backfill any UNSIGNED (is_locked = false) rows that still have the old
-- default. Per Dr. Ben's spec the clinician opens the form expecting to
-- attest; pre-checking matches the workflow, and unchecking is still
-- possible (and still blocks signing via the existing 5-of-5 gate).
--
-- SIGNED rows are intentionally NOT backfilled — their attest values are
-- the physician's locked-in record at signing time. Touching those would
-- corrupt the audit trail.
--
-- Buildverify-safe: columns stay NOT NULL, no schema-shape change.

ALTER TABLE public.order_form
  ALTER COLUMN attest_examined_patient            SET DEFAULT true,
  ALTER COLUMN attest_medically_necessary         SET DEFAULT true,
  ALTER COLUMN attest_conservative_tx_inadequate  SET DEFAULT true,
  ALTER COLUMN attest_freq_qty_clinical_judgment  SET DEFAULT true,
  ALTER COLUMN attest_lcd_supported               SET DEFAULT true;

-- Backfill unsigned rows that still carry the old false default.
UPDATE public.order_form
   SET attest_examined_patient           = true,
       attest_medically_necessary        = true,
       attest_conservative_tx_inadequate = true,
       attest_freq_qty_clinical_judgment = true,
       attest_lcd_supported              = true
 WHERE is_locked = false
   AND (
        attest_examined_patient            = false
     OR attest_medically_necessary         = false
     OR attest_conservative_tx_inadequate  = false
     OR attest_freq_qty_clinical_judgment  = false
     OR attest_lcd_supported               = false
   );
