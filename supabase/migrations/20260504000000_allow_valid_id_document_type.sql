-- Allow `valid_id` as an order_documents.document_type. Per client request,
-- the Create Order modal now collects the patient's government-issued ID
-- (driver's license, passport, etc.) as part of the document set.
--
-- Mirrors the pattern from 20260424040000_allow_delivery_invoice_document_type.sql:
-- drop the existing CHECK constraint and re-add it with the extended set.
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
    'delivery_invoice'::text,
    'valid_id'::text,
    'other'::text
  ]));
