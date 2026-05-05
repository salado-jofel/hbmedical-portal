-- SMS MFA for sales reps
-- ----------------------------------------------------------------------------
-- Sales reps verify with SMS OTP via Twilio Verify instead of TOTP. Other
-- roles continue to use Supabase Auth's built-in TOTP factor (handled by
-- the existing /sign-in/mfa flow). This migration adds the two pieces of
-- state we need on top of the existing profiles.phone column:
--   1. phone_verified_at — set once Twilio confirms the user owns the number.
--      Distinguishes "user typed a phone" from "user proved they own it".
--   2. sms_mfa_sessions — one row per successful SMS verification, bound to
--      a httpOnly cookie via token_hash. Used by the dashboard MFA gate to
--      decide whether the rep needs to re-verify (default: every 12 hours).

ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "phone_verified_at" timestamp with time zone;

COMMENT ON COLUMN "public"."profiles"."phone_verified_at" IS
  'Set when the user proves ownership of phone via Twilio Verify SMS code. Required for SMS-MFA roles (sales reps).';

CREATE TABLE IF NOT EXISTS "public"."sms_mfa_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "verified_at" timestamp with time zone NOT NULL DEFAULT now(),
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "user_agent" text,
  "ip_address" text
);

COMMENT ON TABLE "public"."sms_mfa_sessions" IS
  'One row per successful SMS MFA verification. Cookie holds the raw token; DB stores the SHA-256 hash. Lookup = hash(cookie) → row → verify expires_at + revoked_at + user_id.';

CREATE INDEX IF NOT EXISTS "sms_mfa_sessions_user_id_active_idx"
  ON "public"."sms_mfa_sessions" ("user_id")
  WHERE "revoked_at" IS NULL;

ALTER TABLE "public"."sms_mfa_sessions" ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions (e.g., for "active devices" UI later).
-- All writes are done via server actions using the service-role admin client,
-- so no INSERT/UPDATE/DELETE policy is needed for end users.
CREATE POLICY "users_read_own_sms_mfa_sessions"
  ON "public"."sms_mfa_sessions"
  FOR SELECT
  USING (auth.uid() = user_id);
