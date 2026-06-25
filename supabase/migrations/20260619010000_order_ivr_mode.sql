-- Add ivr_mode to order_ivr. Two modes:
--   'built'    — clinician fills the in-portal IVR form (existing default)
--   'uploaded' — clinician uploads a completed external IVR document
--                (lives in order_documents with document_type='additional_ivr')
--
-- Per Dr. Ben's spec:
--  - Mode is freely switchable while order_status is in
--    {'draft','pending_signature'}.
--  - Once order_status hits 'manufacturer_review' or beyond, mode is
--    locked (enforced in the server action layer).
--  - Switching modes wipes the opposite-mode data (built fields OR
--    uploaded document) — single source of truth at any time.
--
-- Migration is safe: existing rows default to 'built', matching today's
-- behavior. No backfill needed beyond the column default.

ALTER TABLE public.order_ivr
  ADD COLUMN ivr_mode text DEFAULT 'built' NOT NULL;

ALTER TABLE public.order_ivr
  ADD CONSTRAINT order_ivr_mode_check
    CHECK (ivr_mode IN ('built', 'uploaded'));

COMMENT ON COLUMN public.order_ivr.ivr_mode IS
  'IVR source: "built" = filled in our IVR form; "uploaded" = external IVR '
  'document attached via order_documents. Mode is locked once order_status '
  'reaches manufacturer_review or beyond.';
