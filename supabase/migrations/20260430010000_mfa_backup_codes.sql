-- ============================================================================
--  mfa_backup_codes
--
--  Single-use recovery codes generated when a user enrolls TOTP. If the user
--  loses their authenticator (phone gone, app deleted, etc.), they can sign
--  in by entering one of these codes instead of a TOTP — each code burns on
--  use. Industry-standard pattern; Supabase Auth doesn't ship native backup
--  codes, so we layer them on top.
--
--  Codes are bcrypt-hashed (never stored plaintext); we show the plaintext to
--  the user exactly once at generation time, then it's gone forever — same
--  rule as Paubox API keys.
--
--  Format: 8 alphanumeric chars, displayed hyphenated as XXXX-XXXX. 10 codes
--  per user. They never expire (regenerate replaces them; admin reset wipes
--  them).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.mfa_backup_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- bcrypt hash of the plaintext code (cost factor matches our PIN-hash setup).
  code_hash   text not null,
  -- nullable: marked when consumed. Querying WHERE used_at IS NULL gives the
  -- "remaining" set — that's why the partial index below excludes used rows.
  used_at     timestamptz null,
  -- diagnostics for "where was this code used from" audit trail
  used_ip     inet null,
  used_user_agent text null,
  created_at  timestamptz not null default now()
);

-- Partial index: hot path is "find unused codes for this user". Rows with
-- used_at set are read-only audit history that nobody queries by user_id +
-- status anymore, so excluding them keeps the index small.
CREATE INDEX IF NOT EXISTS mfa_backup_codes_user_unused_idx
  ON public.mfa_backup_codes (user_id)
  WHERE used_at IS NULL;

COMMENT ON TABLE public.mfa_backup_codes IS
  'Single-use TOTP backup/recovery codes. 10 per user, generated at enrollment. Bcrypt-hashed; plaintext shown once and never persisted server-side.';

COMMENT ON COLUMN public.mfa_backup_codes.code_hash IS
  'bcrypt(plaintext_code). Never NULL — even consumed codes keep their hash for audit lookup if a code reuse attack is suspected.';

COMMENT ON COLUMN public.mfa_backup_codes.used_at IS
  'NULL = code is still valid. Set on first successful verify; second attempt against the same code returns no-match because the partial index filters it out.';

-- ──────────────────────────────────────────────────────────────────────────
-- RLS — codes are sensitive but never read by the user themselves at runtime
-- (verification compares hashes server-side via the admin client). Block
-- direct user access entirely; only the service role can read/write.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE public.mfa_backup_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "no direct access to backup codes"
  ON public.mfa_backup_codes;

-- Default deny: with no permissive policy, RLS rejects every read/write from
-- the `authenticated` role. Service role bypasses RLS, so server actions
-- using the admin client can still operate on this table.
-- (We intentionally don't even let users SELECT their own rows — they have
-- no need to read them, and exposing the bcrypt hashes is a needless leak.)
