-- Track the Stripe transfer that paid this payout. Enables auditing and is
-- the hook for future features like payout reversal, receipts, reconciliation.

ALTER TABLE "public"."payouts"
  ADD COLUMN IF NOT EXISTS "stripe_transfer_id" text;

CREATE UNIQUE INDEX IF NOT EXISTS "payouts_stripe_transfer_id_key"
  ON "public"."payouts" ("stripe_transfer_id")
  WHERE "stripe_transfer_id" IS NOT NULL;

COMMENT ON COLUMN "public"."payouts"."stripe_transfer_id" IS
  'Stripe transfer id (tr_...) for the Connect payout. Null for draft/pending payouts that have not yet been sent.';
