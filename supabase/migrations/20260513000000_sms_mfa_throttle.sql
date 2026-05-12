-- =============================================================================
-- SMS MFA throttle column
--
-- Tracks the last time an SMS MFA verification code was sent (via Twilio
-- Verify) for a given user. Used by `tryClaimSmsMfaSend` (an atomic
-- conditional UPDATE) to enforce a 30-second server-side cooldown between
-- consecutive sends — closing the gap that earlier let multi-tab loads,
-- back-button navigation, and a brief redirect-loop bug fire repeated SMSes
-- and trigger Twilio's fraud-block heuristic on the destination number.
--
-- Atomic claim pattern:
--   UPDATE profiles
--      SET last_sms_mfa_send_at = now()
--    WHERE id = $uid
--      AND (last_sms_mfa_send_at IS NULL
--           OR last_sms_mfa_send_at < now() - interval '30 seconds')
--   RETURNING id;
--
-- If the WHERE clause matches, the slot is claimed (UPDATE returns the row).
-- If two requests race, Postgres's row-lock serializes them; the second
-- request sees the just-updated timestamp, the WHERE clause no longer
-- matches, and the UPDATE returns 0 rows — that's the throttle in action.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_sms_mfa_send_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.profiles.last_sms_mfa_send_at IS
  'Timestamp of the most recent SMS MFA code sent via Twilio Verify. Read by '
  'the page auto-send and Resend action to enforce a 30-second server-side '
  'cooldown via an atomic conditional UPDATE. See '
  'lib/supabase/sms-mfa-throttle.ts.';
