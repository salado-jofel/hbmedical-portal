-- Allow `admin` as an invite_tokens.role_type so the Create User flow can
-- issue tokens with configurable expiry (7/14/30/90 days), instead of relying
-- on Supabase Auth recovery links which cap at 24h.
--
-- Existing values: clinical_provider, clinical_staff, sales_representative,
-- support_staff. Adding 'admin' completes role parity.

ALTER TABLE "public"."invite_tokens"
  DROP CONSTRAINT IF EXISTS "invite_tokens_role_type_check";

ALTER TABLE "public"."invite_tokens"
  ADD CONSTRAINT "invite_tokens_role_type_check"
  CHECK ("role_type" = ANY (ARRAY[
    'admin'::text,
    'clinical_provider'::text,
    'clinical_staff'::text,
    'sales_representative'::text,
    'support_staff'::text
  ]));

-- Admin / Support staff invites collect first + last name at invite time
-- (per the Create User modal). Stash them on the token so the invite-signup
-- page can pre-fill / commit them when the invitee sets their password.
-- Nullable so existing token rows aren't affected.
ALTER TABLE "public"."invite_tokens"
  ADD COLUMN IF NOT EXISTS "invited_first_name" text,
  ADD COLUMN IF NOT EXISTS "invited_last_name"  text;

COMMENT ON COLUMN "public"."invite_tokens"."invited_first_name" IS
  'First name captured when admin issued the invite (admin/support flow). Null for rep/clinic-generated tokens where the invitee fills in their own name.';

COMMENT ON COLUMN "public"."invite_tokens"."invited_last_name" IS
  'Last name captured when admin issued the invite. See invited_first_name.';
