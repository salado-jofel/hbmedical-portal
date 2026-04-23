-- Add Stripe Connect (Express) payout fields to sales rep profiles.
-- Only sales_representative profiles will populate these, but the columns live
-- on profiles (1:1 with auth.users) to keep lookups simple.

ALTER TABLE "public"."profiles"
  ADD COLUMN IF NOT EXISTS "stripe_connect_account_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_payouts_enabled"    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripe_charges_enabled"    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "stripe_details_submitted"  boolean NOT NULL DEFAULT false;

-- Unique index so one Stripe account cannot be attached to two profiles.
-- (Partial index — nulls are excluded.)
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_stripe_connect_account_id_key"
  ON "public"."profiles" ("stripe_connect_account_id")
  WHERE "stripe_connect_account_id" IS NOT NULL;

COMMENT ON COLUMN "public"."profiles"."stripe_connect_account_id" IS
  'Stripe Connect Express account id (acct_...). Set when a sales rep starts payout onboarding.';
COMMENT ON COLUMN "public"."profiles"."stripe_payouts_enabled" IS
  'Mirrored from stripe.accounts.retrieve(id).payouts_enabled on onboarding return and webhook events.';
COMMENT ON COLUMN "public"."profiles"."stripe_charges_enabled" IS
  'Mirrored from stripe.accounts.retrieve(id).charges_enabled.';
COMMENT ON COLUMN "public"."profiles"."stripe_details_submitted" IS
  'Mirrored from stripe.accounts.retrieve(id).details_submitted — true once the rep finishes the Stripe onboarding form.';
