-- order_documents has a CHECK constraint on document_type that predates the
-- Invoice tab. Inserts for 'delivery_invoice' fail silently inside
-- generateOrderPdf (the insert error isn't surfaced), which is why the
-- invoice card on the right panel stays yellow even though the PDF is
-- uploaded to storage.
--
-- Drop the old constraint and re-add it with the extended set. Kept in
-- sync with documentTypeSchema in utils/interfaces/orders.ts.

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
    'delivery_invoice'::text,
    'other'::text
  ]));
