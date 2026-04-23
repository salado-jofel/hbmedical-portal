-- ============================================================================
--  invite_tokens — attach commission rate + override on sales-rep invites
--
--  Admins (inviting main reps) and main reps (inviting sub-reps) must pick a
--  commission rate + override at invite time. When the invite is accepted the
--  signup action uses these values to seed a `commission_rates` row for the
--  new rep (same shape as setCommissionRate produces).
--
--  Columns stay NULLABLE so existing/older invite tokens (non-rep or admin
--  historical) don't break. The app-layer form validator enforces presence
--  only for `role_type = 'sales_representative'` invites going forward.
-- ============================================================================

ALTER TABLE public.invite_tokens
  ADD COLUMN IF NOT EXISTS commission_rate     numeric(5,2),
  ADD COLUMN IF NOT EXISTS commission_override numeric(5,2);

ALTER TABLE public.invite_tokens
  DROP CONSTRAINT IF EXISTS invite_tokens_commission_rate_range;
ALTER TABLE public.invite_tokens
  ADD CONSTRAINT invite_tokens_commission_rate_range
  CHECK (commission_rate IS NULL
         OR (commission_rate >= 0 AND commission_rate <= 100));

ALTER TABLE public.invite_tokens
  DROP CONSTRAINT IF EXISTS invite_tokens_commission_override_range;
ALTER TABLE public.invite_tokens
  ADD CONSTRAINT invite_tokens_commission_override_range
  CHECK (commission_override IS NULL
         OR (commission_override >= 0 AND commission_override <= 100));

COMMENT ON COLUMN public.invite_tokens.commission_rate IS
  'Commission % the invited sales rep will earn on their own sales. Required for sales_representative invites; null for other roles. Applied once on signup.';

COMMENT ON COLUMN public.invite_tokens.commission_override IS
  'Override % the inviter (parent rep / admin) will earn on this reps sales. Required for sales_representative invites; null for other roles.';
