-- ============================================================================
--  sales_rep_contract_signatures
--
--  Tracks sales-rep-signed onboarding contracts captured during invite signup
--  (DocuSign-style inline signing flow for sales reps / sub-reps).
--
--  6 documents per rep today: code_of_conduct, conflict_of_interest,
--  hep_b_consent, i9, tb_risk_assessment, w9. contract_type is free text so we
--  can add/remove documents without a migration.
--
--  Rows are created BEFORE the auth user exists: signing happens while the
--  invitee is still authenticating, keyed by invite_token. On successful
--  account creation the inviteSignUp action back-fills user_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sales_rep_contract_signatures (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid null references auth.users(id) on delete cascade,
  invite_token      text not null,
  contract_type     text not null,
  source_path       text not null,
  signed_path       text not null,
  typed_name        text not null,
  typed_title       text null,
  signature_method  text not null check (signature_method in ('type', 'draw', 'upload')),
  /** JSON payload of the form fields captured for the document (varies per
      contract_type). Example for W-9: { name, business_name, classification,
      address, ssn_or_ein, ... } */
  form_data         jsonb not null default '{}'::jsonb,
  signed_at         timestamptz not null default now(),
  ip_address        inet null,
  user_agent        text null,
  created_at        timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS sales_rep_contract_signatures_user_id_idx
  ON public.sales_rep_contract_signatures (user_id);

CREATE INDEX IF NOT EXISTS sales_rep_contract_signatures_invite_token_idx
  ON public.sales_rep_contract_signatures (invite_token);

-- One signature per (invite_token, contract_type); re-signing overwrites via
-- the server action (upsert with onConflict).
CREATE UNIQUE INDEX IF NOT EXISTS sales_rep_contract_signatures_token_type_unique
  ON public.sales_rep_contract_signatures (invite_token, contract_type);

COMMENT ON TABLE public.sales_rep_contract_signatures IS
  'Audit trail of sales-rep-signed onboarding contracts (Code of Conduct, Conflict of Interest, Hep B Consent, I-9, TB Risk Assessment, W-9) captured during invite signup.';

COMMENT ON COLUMN public.sales_rep_contract_signatures.user_id IS
  'Set to auth.users.id after account creation; null while the invitee is still mid-signup.';

COMMENT ON COLUMN public.sales_rep_contract_signatures.form_data IS
  'Per-document field answers captured from the UI (document-type-specific JSON).';

COMMENT ON COLUMN public.sales_rep_contract_signatures.signed_path IS
  'Storage path inside hbmedical-bucket-private pointing to the per-rep stamped PDF.';

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: reads restricted to the owning user; writes only via service role
-- (the signSalesRepContract server action uses the admin client).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.sales_rep_contract_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own sales rep contract signatures"
  ON public.sales_rep_contract_signatures;

CREATE POLICY "read own sales rep contract signatures"
  ON public.sales_rep_contract_signatures
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
