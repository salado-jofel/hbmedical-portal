-- Post-surgical order form: Surgical/Wound Origin section + new attestation +
-- dressing change frequency.
--
-- Rendered only when orders.wound_type = 'post_surgical'. Chronic orders leave
-- these columns NULL — keeping every column nullable means the migration is
-- non-destructive and chronic write paths don't need to change.
--
-- Maps to IOrderForm interface (utils/interfaces/orders.ts) — the post-
-- surgical block at the bottom of the type.

ALTER TABLE "public"."order_form"
  ADD COLUMN IF NOT EXISTS "surgical_qualifying_basis" text,
  ADD COLUMN IF NOT EXISTS "debridement_date" date,
  ADD COLUMN IF NOT EXISTS "date_of_surgery" date,
  ADD COLUMN IF NOT EXISTS "cpt_codes" text,
  ADD COLUMN IF NOT EXISTS "procedure_name" text,
  ADD COLUMN IF NOT EXISTS "surgeon_name" text,
  ADD COLUMN IF NOT EXISTS "within_global_period" boolean,
  ADD COLUMN IF NOT EXISTS "attest_not_routine_care" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "attest_wound_measured_at_surgery" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dressing_change_frequency" text;

ALTER TABLE "public"."order_form"
  DROP CONSTRAINT IF EXISTS "order_form_surgical_qualifying_basis_check";
ALTER TABLE "public"."order_form"
  ADD CONSTRAINT "order_form_surgical_qualifying_basis_check"
  CHECK (
    "surgical_qualifying_basis" IS NULL
    OR "surgical_qualifying_basis" = ANY (ARRAY[
      'surgically_created'::text,
      'debrided'::text,
      'stage_3_4_pu'::text,
      'other_full_thickness'::text
    ])
  );

ALTER TABLE "public"."order_form"
  DROP CONSTRAINT IF EXISTS "order_form_dressing_change_frequency_check";
ALTER TABLE "public"."order_form"
  ADD CONSTRAINT "order_form_dressing_change_frequency_check"
  CHECK (
    "dressing_change_frequency" IS NULL
    OR "dressing_change_frequency" = ANY (ARRAY[
      'daily'::text,
      'every_other_day'::text,
      'every_3_days'::text,
      'weekly'::text,
      'as_needed'::text
    ])
  );

COMMENT ON COLUMN "public"."order_form"."surgical_qualifying_basis" IS
  'Medicare Surgical Dressings benefit qualifying basis (LCD L33831). Post-surgical orders only.';
COMMENT ON COLUMN "public"."order_form"."attest_wound_measured_at_surgery" IS
  'Practitioner attests the wound was measured and documented at the time of surgery — replaces capturing dimensions on the post-surgical form.';
