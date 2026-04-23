-- Restore the unique index dropped in 20260423160000.
-- Decision was reverted: the business runs monthly payouts (one per rep
-- per period), so the constraint is the right safety net. The application
-- layer also rejects a second payout for the same (rep, period) via an
-- explicit DB check, but enforcing it here too prevents data corruption
-- if any future code path forgets the application-level guard.
--
-- Note: this migration will FAIL if the database already contains more
-- than one payout row for any (rep_id, period). On dev we consolidated the
-- backfilled duplicate before applying this. Prod has no payouts yet so
-- there's nothing to consolidate.

CREATE UNIQUE INDEX IF NOT EXISTS "payouts_rep_period_uidx"
  ON "public"."payouts" USING btree ("rep_id", "period");
