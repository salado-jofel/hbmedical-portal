-- Fax Intake: persist the provider's secondary ID so a fax can be
-- re-downloaded after the fact.
--
-- iFax's fax-download endpoint requires BOTH jobId and transactionId.
-- We only stored jobId (as external_id), so when the initial download
-- produced a 0-byte PDF (2026-09-16 incident — every fax that arrived
-- before the shape-hardening fix), there was no way to fetch the file
-- again without walking iFax's fax-list-all to recover the second ID.
--
-- Nullable: Documo rows (single-ID provider) and legacy iFax rows stay
-- NULL. The re-download action falls back to the fax-list-all lookup
-- for those and back-fills this column once it finds the ID.

ALTER TABLE public.intake_documents
  ADD COLUMN IF NOT EXISTS provider_transaction_id text;

COMMENT ON COLUMN public.intake_documents.provider_transaction_id IS
  'Provider-specific secondary ID needed to re-fetch the file (iFax transactionId). NULL for Documo and for iFax rows that predate this column.';
