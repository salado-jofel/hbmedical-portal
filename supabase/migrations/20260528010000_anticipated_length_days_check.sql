-- Add CHECK constraint on order_form.anticipated_length_days to match
-- the existing positive-integer constraints on this table
-- (followup_days_check, followup_weeks_check, wound_visit_number_check).
--
-- The UI bug that triggered this: anticipated_length_days could be saved
-- as -13 because the input had no min/step, the onChange used the truthy
-- trap (v ? Number(v) : null), and the DB had no CHECK. The UI is now
-- fixed and the server validates, but DB belt-and-suspenders makes it
-- impossible for any future caller (curl, stale bundle, migration
-- script) to slip a 0/negative through.
--
-- Straight ADD CONSTRAINT per pattern. Migration will FAIL if any
-- existing row has anticipated_length_days <= 0; fix the data manually
-- in that case and re-run.

ALTER TABLE public.order_form
  ADD CONSTRAINT order_form_anticipated_length_days_check
    CHECK ((anticipated_length_days IS NULL) OR (anticipated_length_days > 0));
