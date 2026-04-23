-- Allow multiple payout rows per (rep_id, period). The original assumption
-- was "one monthly batch per rep" but in practice commissions accrue
-- throughout the month, and admin sends multiple Stripe transfers as new
-- earnings get approved. Each Stripe transfer should own its own payouts
-- row for clean audit (with its own stripe_transfer_id).
--
-- Uniqueness is preserved at a finer grain via the existing
-- `payouts_stripe_transfer_id_key` index — one Stripe transfer = one row.

DROP INDEX IF EXISTS "public"."payouts_rep_period_uidx";
