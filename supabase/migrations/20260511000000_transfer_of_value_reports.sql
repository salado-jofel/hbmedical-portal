-- =============================================================================
-- Transfer of Value Tracking — Sunshine Act / Open Payments monthly reports
--
-- A sales rep files one report per calendar month logging every transfer of
-- value (meal, gift, travel, honorarium, etc.) given to a Covered Recipient
-- (physician, qualifying non-physician practitioner, or teaching hospital).
-- HB Medical is the legal filer with CMS; reps capture the firsthand data.
--
-- Tables in this migration:
--   1. sales_rep_value_reports   — one row per rep per month (the header)
--   2. value_transfer_entries    — detail log (Section 3.3/3.4)
--   3. value_group_meal_entries  — group meal allocations (Section 3.5)
--   4. value_sample_entries      — product samples / eval units (Section 4)
--
-- Workflow:
--   - Rep creates a draft for the current month
--   - Logs entries throughout the month
--   - Submits → status flips to 'submitted', certified_at + signature stamped,
--     PDF rendered and emailed to ben@hbmedicalsupplies.io
--   - Admin compliance team can later set compliance_reviewed_*, marking
--     status='reviewed'
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. sales_rep_value_reports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."sales_rep_value_reports" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "rep_id"           uuid NOT NULL REFERENCES "public"."profiles"("id") ON DELETE CASCADE,

  -- Reporting period
  "reporting_year"   int  NOT NULL,
  "reporting_month"  int  NOT NULL CHECK ("reporting_month" BETWEEN 1 AND 12),
  "territory"        text,

  -- Lifecycle
  "status"           text NOT NULL DEFAULT 'draft'
                       CHECK ("status" IN ('draft','submitted','reviewed')),

  -- Section 5 — Consulting / honoraria summary
  "consulting_proposed"   bool NOT NULL DEFAULT false,
  "consulting_recipient"  text,
  "consulting_topic"      text,
  "consulting_status"     text CHECK (
                            "consulting_status" IS NULL OR "consulting_status" IN
                            ('referred_to_compliance','contract_pending','contract_executed')
                          ),

  -- Section 6 — Seven compliance flags (each: bool + describe text)
  "flag_recipient_no_report"          bool NOT NULL DEFAULT false,
  "flag_recipient_no_report_note"     text,
  "flag_ownership_inquiry"            bool NOT NULL DEFAULT false,
  "flag_ownership_inquiry_note"       text,
  "flag_mischaracterize"              bool NOT NULL DEFAULT false,
  "flag_mischaracterize_note"         text,
  "flag_third_party"                  bool NOT NULL DEFAULT false,
  "flag_third_party_note"             text,
  "flag_funding_for_referrals"        bool NOT NULL DEFAULT false,
  "flag_funding_for_referrals_note"   text,
  "flag_family_member"                bool NOT NULL DEFAULT false,
  "flag_family_member_note"           text,
  "flag_other"                        bool NOT NULL DEFAULT false,
  "flag_other_note"                   text,

  -- Section 7 — Certification (set on submit)
  "certified_name"          text,
  "certified_signature_url" text,
  "certified_at"            timestamptz,
  "submitted_at"            timestamptz,
  "pdf_url"                 text,

  -- HB Medical Compliance Acknowledgment (admin side)
  "compliance_reviewed_by"  uuid REFERENCES "public"."profiles"("id") ON DELETE SET NULL,
  "compliance_reviewed_at"  timestamptz,
  "compliance_issues"       text,
  "compliance_notes"        text,

  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- One report per rep per month.
CREATE UNIQUE INDEX IF NOT EXISTS "sales_rep_value_reports_rep_month_key"
  ON "public"."sales_rep_value_reports" ("rep_id", "reporting_year", "reporting_month");

CREATE INDEX IF NOT EXISTS "sales_rep_value_reports_rep_idx"
  ON "public"."sales_rep_value_reports" ("rep_id");

CREATE INDEX IF NOT EXISTS "sales_rep_value_reports_status_idx"
  ON "public"."sales_rep_value_reports" ("status");

-- -----------------------------------------------------------------------------
-- 2. value_transfer_entries — detail log (Section 3.3 / 3.4)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."value_transfer_entries" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id"             uuid NOT NULL REFERENCES "public"."sales_rep_value_reports"("id") ON DELETE CASCADE,

  "transfer_date"         date NOT NULL,
  "recipient_name"        text NOT NULL,
  -- Credential / type — physician credentials, NPP credentials, or teaching hospital
  "recipient_credential"  text NOT NULL CHECK ("recipient_credential" IN
                            ('MD','DO','DDS','DMD','DPM','OD','DC',
                             'PA','NP','CNS','CRNA','CNM',
                             'TEACHING_HOSPITAL','OTHER')),
  -- 10-digit NPI for physicians/NPPs. Null for teaching hospitals (use address).
  "recipient_npi"         text,
  -- Used for teaching hospitals (name + address); optional for individuals.
  "recipient_address"     text,
  "affiliation"           text,

  -- Form / category of transfer (Open Payments CMS taxonomy)
  "form_category"         text NOT NULL CHECK ("form_category" IN
                            ('meal','beverage','gift','travel','lodging',
                             'honorarium','consulting_fee','education',
                             'royalty','entertainment','charitable_contribution',
                             'grant','other')),
  "description"           text,
  "value_amount"          numeric(12,2) NOT NULL CHECK ("value_amount" >= 0),
  "is_estimate"           bool NOT NULL DEFAULT false,

  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "value_transfer_entries_report_idx"
  ON "public"."value_transfer_entries" ("report_id");

CREATE INDEX IF NOT EXISTS "value_transfer_entries_date_idx"
  ON "public"."value_transfer_entries" ("transfer_date");

-- -----------------------------------------------------------------------------
-- 3. value_group_meal_entries — group meal allocations (Section 3.5)
--
-- When a meal is given to a mixed group of Covered + non-Covered Recipients,
-- the per-person allocation = total_cost / total_attendees, applied to each
-- Covered Recipient attendee. We store the recipient roster as JSONB so we
-- don't need a separate child table for a list-of-strings.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."value_group_meal_entries" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id"           uuid NOT NULL REFERENCES "public"."sales_rep_value_reports"("id") ON DELETE CASCADE,

  "group_meal_date"     date NOT NULL,
  "total_cost"          numeric(12,2) NOT NULL CHECK ("total_cost" >= 0),
  "total_attendees"     int NOT NULL CHECK ("total_attendees" > 0),
  -- Array of { name, credential, npi? } objects — one per Covered Recipient attendee.
  "covered_recipients"  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "notes"               text,

  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "value_group_meal_entries_report_idx"
  ON "public"."value_group_meal_entries" ("report_id");

-- -----------------------------------------------------------------------------
-- 4. value_sample_entries — product samples / evaluation units (Section 4)
--
-- Tracked separately from reportable transfers — samples for patient use and
-- short-term eval units (under 90 days) are NOT reportable under Sunshine Act
-- but HB Medical wants the audit trail for FDA + inventory purposes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."value_sample_entries" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "report_id"           uuid NOT NULL REFERENCES "public"."sales_rep_value_reports"("id") ON DELETE CASCADE,

  "sample_date"         date NOT NULL,
  "recipient_facility"  text NOT NULL,
  "product_lot"         text NOT NULL,
  "quantity"            int NOT NULL CHECK ("quantity" > 0),
  "purpose"             text,
  "return_date"         date,

  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "value_sample_entries_report_idx"
  ON "public"."value_sample_entries" ("report_id");

-- -----------------------------------------------------------------------------
-- Touch triggers — bump updated_at on every UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION "public"."touch_value_transfer_updated_at"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "sales_rep_value_reports_touch_updated_at"
  ON "public"."sales_rep_value_reports";
CREATE TRIGGER "sales_rep_value_reports_touch_updated_at"
  BEFORE UPDATE ON "public"."sales_rep_value_reports"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_transfer_updated_at"();

DROP TRIGGER IF EXISTS "value_transfer_entries_touch_updated_at"
  ON "public"."value_transfer_entries";
CREATE TRIGGER "value_transfer_entries_touch_updated_at"
  BEFORE UPDATE ON "public"."value_transfer_entries"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_transfer_updated_at"();

DROP TRIGGER IF EXISTS "value_group_meal_entries_touch_updated_at"
  ON "public"."value_group_meal_entries";
CREATE TRIGGER "value_group_meal_entries_touch_updated_at"
  BEFORE UPDATE ON "public"."value_group_meal_entries"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_transfer_updated_at"();

DROP TRIGGER IF EXISTS "value_sample_entries_touch_updated_at"
  ON "public"."value_sample_entries";
CREATE TRIGGER "value_sample_entries_touch_updated_at"
  BEFORE UPDATE ON "public"."value_sample_entries"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_value_transfer_updated_at"();

-- =============================================================================
-- RLS — Row Level Security
--
-- Default deny. Rep can CRUD their own draft. After submit, the report and
-- its children become read-only at the DB layer (write policies require
-- status='draft'). Admins can SELECT anything via a JWT-role check; their
-- writes go through createAdminClient() (service role bypasses RLS), so we
-- don't grant admin writes here.
-- =============================================================================

ALTER TABLE "public"."sales_rep_value_reports"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."value_transfer_entries"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."value_group_meal_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."value_sample_entries"     ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- sales_rep_value_reports policies
-- -----------------------------------------------------------------------------

-- Rep can read their own reports (any status).
CREATE POLICY "rep_read_own_value_reports"
  ON "public"."sales_rep_value_reports"
  FOR SELECT
  USING ("rep_id" = auth.uid());

-- Admin can read all reports.
CREATE POLICY "admin_read_all_value_reports"
  ON "public"."sales_rep_value_reports"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
       WHERE "id" = auth.uid() AND "role" = 'admin'
    )
  );

-- Rep can insert reports for themselves only.
CREATE POLICY "rep_insert_own_value_reports"
  ON "public"."sales_rep_value_reports"
  FOR INSERT
  WITH CHECK ("rep_id" = auth.uid());

-- Rep can update their own report only while it's a draft.
CREATE POLICY "rep_update_own_draft_value_reports"
  ON "public"."sales_rep_value_reports"
  FOR UPDATE
  USING ("rep_id" = auth.uid() AND "status" = 'draft')
  WITH CHECK ("rep_id" = auth.uid());

-- Rep can delete only their own drafts.
CREATE POLICY "rep_delete_own_draft_value_reports"
  ON "public"."sales_rep_value_reports"
  FOR DELETE
  USING ("rep_id" = auth.uid() AND "status" = 'draft');

-- -----------------------------------------------------------------------------
-- Helper macro — ownership through the parent report.
-- (Duplicated per child table for readability; Postgres doesn't support
-- inheriting policies.)
-- -----------------------------------------------------------------------------

-- value_transfer_entries policies
CREATE POLICY "rep_read_own_value_transfer_entries"
  ON "public"."value_transfer_entries"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_transfer_entries.report_id
         AND r.rep_id = auth.uid()
    )
  );

CREATE POLICY "admin_read_all_value_transfer_entries"
  ON "public"."value_transfer_entries"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
       WHERE "id" = auth.uid() AND "role" = 'admin'
    )
  );

CREATE POLICY "rep_insert_own_value_transfer_entries"
  ON "public"."value_transfer_entries"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_transfer_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

CREATE POLICY "rep_update_own_value_transfer_entries"
  ON "public"."value_transfer_entries"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_transfer_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

CREATE POLICY "rep_delete_own_value_transfer_entries"
  ON "public"."value_transfer_entries"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_transfer_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

-- value_group_meal_entries policies
CREATE POLICY "rep_read_own_value_group_meal_entries"
  ON "public"."value_group_meal_entries"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_group_meal_entries.report_id
         AND r.rep_id = auth.uid()
    )
  );

CREATE POLICY "admin_read_all_value_group_meal_entries"
  ON "public"."value_group_meal_entries"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
       WHERE "id" = auth.uid() AND "role" = 'admin'
    )
  );

CREATE POLICY "rep_insert_own_value_group_meal_entries"
  ON "public"."value_group_meal_entries"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_group_meal_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

CREATE POLICY "rep_update_own_value_group_meal_entries"
  ON "public"."value_group_meal_entries"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_group_meal_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

CREATE POLICY "rep_delete_own_value_group_meal_entries"
  ON "public"."value_group_meal_entries"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_group_meal_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

-- value_sample_entries policies
CREATE POLICY "rep_read_own_value_sample_entries"
  ON "public"."value_sample_entries"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_sample_entries.report_id
         AND r.rep_id = auth.uid()
    )
  );

CREATE POLICY "admin_read_all_value_sample_entries"
  ON "public"."value_sample_entries"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."profiles"
       WHERE "id" = auth.uid() AND "role" = 'admin'
    )
  );

CREATE POLICY "rep_insert_own_value_sample_entries"
  ON "public"."value_sample_entries"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_sample_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

CREATE POLICY "rep_update_own_value_sample_entries"
  ON "public"."value_sample_entries"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_sample_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

CREATE POLICY "rep_delete_own_value_sample_entries"
  ON "public"."value_sample_entries"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."sales_rep_value_reports" r
       WHERE r.id = value_sample_entries.report_id
         AND r.rep_id = auth.uid()
         AND r.status = 'draft'
    )
  );

COMMIT;

COMMENT ON TABLE "public"."sales_rep_value_reports"  IS
  'Monthly Sunshine Act / Open Payments report — one per sales rep per calendar month. HB Medical files the annual CMS submission; this captures the rep firsthand data.';
COMMENT ON TABLE "public"."value_transfer_entries"   IS
  'Detail log of transfers of value to Covered Recipients — meals, gifts, travel, honoraria, etc. Section 3.3 / 3.4 of the tracking form.';
COMMENT ON TABLE "public"."value_group_meal_entries" IS
  'Group meal allocations — total cost split per attendee, applied to each Covered Recipient. Section 3.5 of the tracking form.';
COMMENT ON TABLE "public"."value_sample_entries"     IS
  'Product samples / evaluation units. Generally NOT reportable under Sunshine Act but tracked for FDA + inventory. Section 4 of the tracking form.';
