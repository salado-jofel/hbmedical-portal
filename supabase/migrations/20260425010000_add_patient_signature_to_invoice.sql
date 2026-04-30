-- Patient signature capture (proof of delivery) on the delivery invoice.
--
-- Rules locked with the client:
--   - Only clinical_provider (or admin) can capture, and only when the
--     order is in `shipped` status.
--   - Once `patient_signed_at` is set, the whole order is read-only for
--     non-admins — the signature IS the proof of delivery.
--   - Admin reviews the captured signature and manually flips the order
--     to `delivered`; the sign event itself does NOT change status.
--
-- `patient_signature_image` stores a base64 PNG data URL (same approach
-- as physician_signature_image on order_form / order_ivr). Kept inline
-- rather than in Storage because invoice volume is low and this keeps
-- read paths dependency-free.

ALTER TABLE "public"."order_delivery_invoices"
  ADD COLUMN IF NOT EXISTS "patient_signature_image"       text,
  ADD COLUMN IF NOT EXISTS "patient_signature_captured_by" uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS "signer_name"                   text,
  ADD COLUMN IF NOT EXISTS "signer_reason"                 text;
