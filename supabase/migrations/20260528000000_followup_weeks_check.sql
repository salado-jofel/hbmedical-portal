-- Add CHECK constraint on order_form.followup_weeks to match the existing
-- order_form_followup_days_check. The schema previously enforced
-- "positive integer or null" for followup_days but silently accepted 0
-- and negative values for followup_weeks — meaning the UI could (and a
-- bug did) persist nonsense weeks without any error.
--
-- Mirrors:
--   CONSTRAINT order_form_followup_days_check
--     CHECK ((followup_days IS NULL) OR (followup_days > 0))
--
-- Straight ADD CONSTRAINT (no NOT VALID + backfill + VALIDATE).
-- Migration will FAIL if any existing row has followup_weeks <= 0;
-- fix the data manually in that case and re-run.

ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_followup_weeks_check
    CHECK ((followup_weeks IS NULL) OR (followup_weeks > 0));
