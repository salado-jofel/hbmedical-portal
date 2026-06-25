-- Add `uploaded_ivr` as an order_documents.document_type, distinct from
-- `additional_ivr`.
--
-- Why both:
--   - `additional_ivr` — the SYSTEM-GENERATED IVR PDF rendered from the
--     built IVR form by the PDF pipeline (ivr-form-<order-number>.pdf).
--     Auto-created on every IVR form save.
--   - `uploaded_ivr` — a clinician-uploaded EXTERNAL IVR document. Lives
--     in the IVR tab's upload section. Distinct so the upload UI doesn't
--     surface the auto-generated PDF as if the user uploaded it.
--
-- Mirrors the pattern from prior CHECK-extension migrations:
-- 20260424040000 (delivery_invoice) and 20260504000000 (valid_id).
-- Kept in sync with documentTypeSchema in utils/interfaces/orders.ts.

ALTER TABLE "public"."order_documents"
  DROP CONSTRAINT IF EXISTS "order_documents_document_type_check";

ALTER TABLE "public"."order_documents"
  ADD CONSTRAINT "order_documents_document_type_check"
  CHECK ("document_type" = ANY (ARRAY[
    'facesheet'::text,
    'clinical_docs'::text,
    'wound_pictures'::text,
    'order_form'::text,
    'form_1500'::text,
    'additional_ivr'::text,
    'uploaded_ivr'::text,
    'delivery_invoice'::text,
    'valid_id'::text,
    'other'::text
  ]));
