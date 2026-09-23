-- ============================================================================
--  Offline (paper) provider onboarding
--
--  Admins and sales reps can now onboard a clinic whose provider signed the
--  BAA / Product & Services agreement on paper. The scanned PDF is uploaded
--  and recorded in `provider_contract_signatures` like an inline e-signature,
--  but flagged with signature_method = 'offline' and the uploader's id so the
--  Resources page can label it "Signed on paper".
--
--  `invite_token` stays NOT NULL: offline rows use a synthetic
--  `offline-<uuid>` token shared by the BAA + P&S pair (the unique index on
--  (invite_token, contract_type) still applies).
-- ============================================================================

ALTER TABLE public.provider_contract_signatures
  DROP CONSTRAINT IF EXISTS provider_contract_signatures_signature_method_check;

ALTER TABLE public.provider_contract_signatures
  ADD CONSTRAINT provider_contract_signatures_signature_method_check
  CHECK (signature_method IN ('type', 'draw', 'upload', 'offline'));

ALTER TABLE public.provider_contract_signatures
  ADD COLUMN IF NOT EXISTS uploaded_by uuid NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.provider_contract_signatures.signature_method IS
  'type | draw | upload = inline e-signature captured at invite signup; offline = wet-signed paper contract scanned and uploaded by an admin/sales rep during manual onboarding.';

COMMENT ON COLUMN public.provider_contract_signatures.uploaded_by IS
  'For signature_method = offline: the admin or sales rep who uploaded the scanned contract. NULL for inline e-signatures.';
