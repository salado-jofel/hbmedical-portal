-- ============================================================================
--  provider_contract_signatures
--
--  Tracks provider-signed BAA and Product & Services agreements captured
--  during invite signup (DocuSign-style inline signing flow).
--
--  Rows are created BEFORE the auth user exists: signing happens while the
--  invitee is still authenticating, keyed by invite_token. On successful
--  account creation the inviteSignUp action back-fills user_id.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.provider_contract_signatures (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid null references auth.users(id) on delete cascade,
  invite_token      text not null,
  contract_type     text not null check (contract_type in ('baa', 'product_services')),
  source_path       text not null,
  signed_path       text not null,
  typed_name        text not null,
  typed_title       text not null,
  signature_method  text not null check (signature_method in ('type', 'draw', 'upload')),
  signed_at         timestamptz not null default now(),
  ip_address        inet null,
  user_agent        text null,
  created_at        timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS provider_contract_signatures_user_id_idx
  ON public.provider_contract_signatures (user_id);

CREATE INDEX IF NOT EXISTS provider_contract_signatures_invite_token_idx
  ON public.provider_contract_signatures (invite_token);

-- One signature per (invite_token, contract_type); re-signing overwrites via
-- the server action (it deletes any prior row before inserting the new one).
CREATE UNIQUE INDEX IF NOT EXISTS provider_contract_signatures_token_type_unique
  ON public.provider_contract_signatures (invite_token, contract_type);

COMMENT ON TABLE public.provider_contract_signatures IS
  'Audit trail of provider-signed BAA and Product & Services agreements captured during invite signup.';

COMMENT ON COLUMN public.provider_contract_signatures.user_id IS
  'Set to auth.users.id after account creation; null while the invitee is still mid-signup.';

COMMENT ON COLUMN public.provider_contract_signatures.signed_path IS
  'Storage path inside hbmedical-bucket-private pointing to the per-provider stamped PDF.';

-- ──────────────────────────────────────────────────────────────────────────
-- RLS: reads restricted to the owning user; writes only via service role
-- (the signContract server action uses the admin client).
-- ──────────────────────────────────────────────────────────────────────────

ALTER TABLE public.provider_contract_signatures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read own contract signatures"
  ON public.provider_contract_signatures;

CREATE POLICY "read own contract signatures"
  ON public.provider_contract_signatures
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
