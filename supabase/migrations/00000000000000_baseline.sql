


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."get_unread_message_counts"("p_user_id" "uuid") RETURNS TABLE("order_id" "uuid", "unread_count" bigint)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT
    om.order_id,
    COUNT(*) AS unread_count
  FROM public.order_messages om
  WHERE om.sender_id != p_user_id  -- not my own messages
    AND NOT EXISTS (
      SELECT 1 FROM public.message_reads mr
      WHERE mr.message_id = om.id
        AND mr.user_id = p_user_id
    )
  GROUP BY om.order_id;
$$;


ALTER FUNCTION "public"."get_unread_message_counts"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_facility_ids"("user_uuid" "uuid") RETURNS TABLE("facility_id" "uuid")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT fm.facility_id FROM public.facility_members fm
  WHERE fm.user_id = user_uuid;
$$;


ALTER FUNCTION "public"."get_user_facility_ids"("user_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_login"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When last_sign_in_at changes from NULL to a value (first login)
  -- update the profile status from 'pending' to 'active'
  IF OLD.last_sign_in_at IS NULL AND NEW.last_sign_in_at IS NOT NULL THEN
    UPDATE public.profiles
    SET status = 'active'
    WHERE id = NEW.id AND status = 'pending';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_user_login"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."hash_pin"("input_pin" "text") RETURNS "text"
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT crypt(input_pin, gen_salt('bf'));
$$;


ALTER FUNCTION "public"."hash_pin"("input_pin" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_facility_member"("p_facility_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.facility_members fm
    WHERE fm.facility_id = p_facility_id
      AND fm.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.facilities f
    WHERE f.id = p_facility_id
      AND f.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_facility_member"("p_facility_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_rep_facility"("p_rep_id" "uuid", "p_facility_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  WITH RECURSIVE rep_tree AS (
    SELECT p_rep_id AS id
    UNION ALL
    SELECT rh.child_rep_id
    FROM public.rep_hierarchy rh
    JOIN rep_tree rt ON rt.id = rh.parent_rep_id
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.facilities f
    JOIN rep_tree rt ON rt.id = f.assigned_rep
    WHERE f.id = p_facility_id
      AND f.facility_type = 'clinic'
  );
$$;


ALTER FUNCTION "public"."is_rep_facility"("p_rep_id" "uuid", "p_facility_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_row_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;

$$;


ALTER FUNCTION "public"."set_row_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."verify_pin"("input_pin" "text", "stored_hash" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT stored_hash = crypt(input_pin, stored_hash);
$$;


ALTER FUNCTION "public"."verify_pin"("input_pin" "text", "stored_hash" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "logged_by" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "activity_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "outcome" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activities_outcome_check" CHECK ((("outcome" IS NULL) OR ("outcome" = ANY (ARRAY['positive'::"text", 'neutral'::"text", 'negative'::"text", 'no_response'::"text"])))),
    CONSTRAINT "activities_type_check" CHECK (("type" = ANY (ARRAY['visit'::"text", 'call'::"text", 'email'::"text", 'demo'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."activities" IS 'Rep activity log: visits, calls, emails, demos against an account and optional contact.';



COMMENT ON COLUMN "public"."activities"."type" IS 'visit | call | email | demo';



COMMENT ON COLUMN "public"."activities"."outcome" IS 'positive | neutral | negative | no_response';



CREATE TABLE IF NOT EXISTS "public"."commission_rates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rep_id" "uuid" NOT NULL,
    "set_by" "uuid" NOT NULL,
    "rate_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "override_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "effective_from" "date" DEFAULT CURRENT_DATE NOT NULL,
    "effective_to" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commission_rates_effective_range" CHECK ((("effective_to" IS NULL) OR ("effective_to" >= "effective_from"))),
    CONSTRAINT "commission_rates_override_percent_range" CHECK ((("override_percent" >= (0)::numeric) AND ("override_percent" <= (100)::numeric))),
    CONSTRAINT "commission_rates_rate_percent_range" CHECK ((("rate_percent" >= (0)::numeric) AND ("rate_percent" <= (100)::numeric)))
);


ALTER TABLE "public"."commission_rates" OWNER TO "postgres";


COMMENT ON TABLE "public"."commission_rates" IS 'Commission rate configuration per sales rep. Admin sets rates on main reps; main reps set rates on sub-reps. Versioned via effective_from/to.';



COMMENT ON COLUMN "public"."commission_rates"."rep_id" IS 'The sales rep this rate applies to.';



COMMENT ON COLUMN "public"."commission_rates"."set_by" IS 'Admin or parent rep who configured this rate.';



COMMENT ON COLUMN "public"."commission_rates"."rate_percent" IS 'Commission percentage the rep earns on their own sales (e.g. 5.00 = 5%).';



COMMENT ON COLUMN "public"."commission_rates"."override_percent" IS 'Override percentage the setter earns on this reps sales (e.g. 2.00 = 2%). 0 if no override.';



COMMENT ON COLUMN "public"."commission_rates"."effective_from" IS 'Date this rate becomes active.';



COMMENT ON COLUMN "public"."commission_rates"."effective_to" IS 'Date this rate expires. NULL = currently active.';



CREATE TABLE IF NOT EXISTS "public"."commissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "rep_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'direct'::"text" NOT NULL,
    "order_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "rate_percent" numeric(5,2) DEFAULT 0 NOT NULL,
    "commission_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "adjustment" numeric(12,2) DEFAULT 0 NOT NULL,
    "final_amount" numeric(12,2) GENERATED ALWAYS AS (("commission_amount" + "adjustment")) STORED,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payout_period" "text",
    "paid_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "commissions_commission_amount_non_negative" CHECK (("commission_amount" >= (0)::numeric)),
    CONSTRAINT "commissions_order_amount_non_negative" CHECK (("order_amount" >= (0)::numeric)),
    CONSTRAINT "commissions_payout_period_format" CHECK ((("payout_period" IS NULL) OR ("payout_period" ~ '^\d{4}-\d{2}$'::"text"))),
    CONSTRAINT "commissions_rate_percent_range" CHECK ((("rate_percent" >= (0)::numeric) AND ("rate_percent" <= (100)::numeric))),
    CONSTRAINT "commissions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'paid'::"text", 'void'::"text"]))),
    CONSTRAINT "commissions_type_check" CHECK (("type" = ANY (ARRAY['direct'::"text", 'override'::"text"])))
);


ALTER TABLE "public"."commissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."commissions" IS 'Individual commission records. One row per rep per order. Snapshots the rate at time of calculation so future rate changes do not affect past commissions.';



COMMENT ON COLUMN "public"."commissions"."type" IS 'direct = rep own sale commission. override = parent rep cut from sub-rep sale.';



COMMENT ON COLUMN "public"."commissions"."order_amount" IS 'Total order value snapshot at time of commission calculation.';



COMMENT ON COLUMN "public"."commissions"."rate_percent" IS 'Rate snapshot at time of calculation.';



COMMENT ON COLUMN "public"."commissions"."commission_amount" IS 'Calculated: order_amount × rate_percent / 100.';



COMMENT ON COLUMN "public"."commissions"."adjustment" IS 'Manual admin adjustment (+/-). Default 0.';



COMMENT ON COLUMN "public"."commissions"."final_amount" IS 'Generated: commission_amount + adjustment.';



COMMENT ON COLUMN "public"."commissions"."status" IS 'pending → approved → paid. void for canceled/reversed.';



COMMENT ON COLUMN "public"."commissions"."payout_period" IS 'Year-month string (e.g. 2026-04) for grouping into monthly payouts.';



CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "title" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "preferred_contact" "text" DEFAULT 'email'::"text" NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contacts_email_check" CHECK ((("email" IS NULL) OR ("email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))),
    CONSTRAINT "contacts_first_name_check" CHECK (("btrim"("first_name") <> ''::"text")),
    CONSTRAINT "contacts_last_name_check" CHECK (("btrim"("last_name") <> ''::"text")),
    CONSTRAINT "contacts_phone_check" CHECK ((("phone" IS NULL) OR ("phone" ~ '^\+[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "contacts_preferred_contact_check" CHECK (("preferred_contact" = ANY (ARRAY['email'::"text", 'phone'::"text", 'in_person'::"text"])))
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


COMMENT ON TABLE "public"."contacts" IS 'Individual contacts (doctors, procurement managers, dept heads) linked to a facility/account.';



COMMENT ON COLUMN "public"."contacts"."phone" IS 'E.164 format, e.g. +639310259241';



COMMENT ON COLUMN "public"."contacts"."preferred_contact" IS 'Preferred contact method: email | phone | in_person';



CREATE TABLE IF NOT EXISTS "public"."contract_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "tag" "text" NOT NULL,
    "bucket" "text" DEFAULT 'hbmedical-bucket-private'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "contract_materials_bucket_check" CHECK (("bucket" = 'hbmedical-bucket-private'::"text")),
    CONSTRAINT "contract_materials_bucket_not_blank" CHECK (("btrim"("bucket") <> ''::"text")),
    CONSTRAINT "contract_materials_file_name_not_blank" CHECK (("btrim"("file_name") <> ''::"text")),
    CONSTRAINT "contract_materials_file_path_not_blank" CHECK (("btrim"("file_path") <> ''::"text")),
    CONSTRAINT "contract_materials_file_path_prefix_check" CHECK (("file_path" ~~ 'contracts/%'::"text")),
    CONSTRAINT "contract_materials_tag_not_blank" CHECK (("btrim"("tag") <> ''::"text")),
    CONSTRAINT "contract_materials_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);


ALTER TABLE "public"."contract_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "contact" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "address_line_1" "text" NOT NULL,
    "address_line_2" "text",
    "city" "text" NOT NULL,
    "state" "text" NOT NULL,
    "postal_code" "text" NOT NULL,
    "country" "text" NOT NULL,
    "stripe_customer_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_rep" "uuid",
    "facility_type" "text" DEFAULT 'clinic'::"text" NOT NULL,
    CONSTRAINT "facilities_address_line_1_not_blank" CHECK (("btrim"("address_line_1") <> ''::"text")),
    CONSTRAINT "facilities_city_not_blank" CHECK (("btrim"("city") <> ''::"text")),
    CONSTRAINT "facilities_contact_not_blank" CHECK (("btrim"("contact") <> ''::"text")),
    CONSTRAINT "facilities_country_iso2_check" CHECK (("country" ~ '^[A-Z]{2}$'::"text")),
    CONSTRAINT "facilities_facility_type_check" CHECK (("facility_type" = ANY (ARRAY['clinic'::"text", 'rep_office'::"text"]))),
    CONSTRAINT "facilities_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "facilities_phone_e164_check" CHECK (("phone" ~ '^\+[1-9][0-9]{7,14}$'::"text")),
    CONSTRAINT "facilities_postal_code_not_blank" CHECK (("btrim"("postal_code") <> ''::"text")),
    CONSTRAINT "facilities_state_not_blank" CHECK (("btrim"("state") <> ''::"text")),
    CONSTRAINT "facilities_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'prospect'::"text"])))
);


ALTER TABLE "public"."facilities" OWNER TO "postgres";


COMMENT ON TABLE "public"."facilities" IS 'Exactly one facility per user account. Enforced by unique(user_id).';



COMMENT ON COLUMN "public"."facilities"."user_id" IS '1:1 owner link to public.profiles(id).';



COMMENT ON COLUMN "public"."facilities"."phone" IS 'Facility phone in E.164 format, e.g. +15550000000';



COMMENT ON COLUMN "public"."facilities"."country" IS 'Two-letter ISO country code, e.g. US, PH.';



COMMENT ON COLUMN "public"."facilities"."stripe_customer_id" IS 'Stripe customer id associated with this facility/account for checkout and invoicing.';



COMMENT ON COLUMN "public"."facilities"."assigned_rep" IS 'Sales rep assigned to this account. FK → profiles.id (role = sales_representative).';



COMMENT ON COLUMN "public"."facilities"."facility_type" IS 'clinic = hospital/clinic facility (owned by clinical_provider/clinical_staff) |
   rep_office = sales rep business office (owned by sales_representative)';



CREATE TABLE IF NOT EXISTS "public"."facility_enrollment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "facility_npi" "text",
    "facility_ein" "text",
    "facility_tin" "text",
    "facility_ptan" "text",
    "ap_contact_name" "text",
    "ap_contact_email" "text",
    "billing_address" "text",
    "billing_city" "text",
    "billing_state" "text",
    "billing_zip" "text",
    "billing_phone" "text",
    "billing_fax" "text",
    "dpa_contact" "text",
    "dpa_contact_email" "text",
    "additional_provider_1_name" "text",
    "additional_provider_1_npi" "text",
    "additional_provider_2_name" "text",
    "additional_provider_2_npi" "text",
    "shipping_facility_name" "text",
    "shipping_facility_npi" "text",
    "shipping_contact_name" "text",
    "shipping_facility_tin" "text",
    "shipping_contact_email" "text",
    "shipping_facility_ptan" "text",
    "shipping_address" "text",
    "shipping_days_times" "text",
    "shipping_phone" "text",
    "shipping_fax" "text",
    "shipping2_facility_name" "text",
    "shipping2_facility_npi" "text",
    "shipping2_contact_name" "text",
    "shipping2_facility_tin" "text",
    "shipping2_contact_email" "text",
    "shipping2_facility_ptan" "text",
    "shipping2_address" "text",
    "shipping2_days_times" "text",
    "shipping2_phone" "text",
    "shipping2_fax" "text",
    "claims_contact_name" "text",
    "claims_contact_phone" "text",
    "claims_contact_email" "text",
    "claims_third_party" "text",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."facility_enrollment" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_enrollment" IS 'Extended facility data collected during provider onboarding — billing, shipping, claims contact';



CREATE TABLE IF NOT EXISTS "public"."facility_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_type" "text" DEFAULT 'clinical_provider'::"text" NOT NULL,
    "can_sign_orders" boolean DEFAULT false NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "facility_members_role_type_check" CHECK (("role_type" = ANY (ARRAY['clinical_provider'::"text", 'clinical_staff'::"text"])))
);


ALTER TABLE "public"."facility_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_members" IS 'Links multiple clinic-side users to one facility.
   Supervisors have full visibility and can invite more members.
   Clinical providers can create and sign orders.
   Non-clinical staff can create orders but cannot sign them.';



COMMENT ON COLUMN "public"."facility_members"."can_sign_orders" IS 'True for clinical_provider role types who have completed credentialing.';



COMMENT ON COLUMN "public"."facility_members"."is_primary" IS 'True for the first user who created the facility account.';



CREATE TABLE IF NOT EXISTS "public"."hospital_onboarding_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "tag" "text" NOT NULL,
    "bucket" "text" DEFAULT 'hbmedical-bucket-private'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "hospital_onboarding_materials_bucket_check" CHECK (("bucket" = 'hbmedical-bucket-private'::"text")),
    CONSTRAINT "hospital_onboarding_materials_bucket_not_blank" CHECK (("btrim"("bucket") <> ''::"text")),
    CONSTRAINT "hospital_onboarding_materials_file_name_not_blank" CHECK (("btrim"("file_name") <> ''::"text")),
    CONSTRAINT "hospital_onboarding_materials_file_path_not_blank" CHECK (("btrim"("file_path") <> ''::"text")),
    CONSTRAINT "hospital_onboarding_materials_file_path_prefix_check" CHECK (("file_path" ~~ 'hospital-onboarding/%'::"text")),
    CONSTRAINT "hospital_onboarding_materials_tag_not_blank" CHECK (("btrim"("tag") <> ''::"text")),
    CONSTRAINT "hospital_onboarding_materials_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);


ALTER TABLE "public"."hospital_onboarding_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invite_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "created_by" "uuid" NOT NULL,
    "facility_id" "uuid",
    "role_type" "text" DEFAULT 'clinical_provider'::"text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '7 days'::interval) NOT NULL,
    "used_at" timestamp with time zone,
    "used_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_email" "text",
    CONSTRAINT "invite_tokens_invited_email_check" CHECK ((("invited_email" IS NULL) OR ("invited_email" ~* '^[^@]+@[^@]+\.[^@]+$'::"text"))),
    CONSTRAINT "invite_tokens_role_type_check" CHECK (("role_type" = ANY (ARRAY['clinical_provider'::"text", 'clinical_staff'::"text", 'sales_representative'::"text", 'support_staff'::"text"])))
);


ALTER TABLE "public"."invite_tokens" OWNER TO "postgres";


COMMENT ON TABLE "public"."invite_tokens" IS 'One-time invite links. facility_id is null for rep-generated clinic invites
   (clinic creates facility on signup). facility_id is set for clinic-generated
   member invites (new user joins existing facility).';



COMMENT ON COLUMN "public"."invite_tokens"."token" IS 'URL-safe 64-char hex token embedded in the invite link.';



COMMENT ON COLUMN "public"."invite_tokens"."facility_id" IS 'NULL = rep invite (clinic creates new facility).
   SET  = clinic member invite (user joins existing facility).';



COMMENT ON COLUMN "public"."invite_tokens"."used_at" IS 'Set when the token is consumed. NULL = still valid.';



CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "invoice_number" "text" NOT NULL,
    "provider" "text" DEFAULT 'internal'::"text" NOT NULL,
    "provider_invoice_id" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "amount_due" numeric(12,2) NOT NULL,
    "amount_paid" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "issued_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "hosted_invoice_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "net30_last_reminder_stage" "text",
    "net30_last_reminder_sent_at" timestamp with time zone,
    "net30_reminder_count" integer DEFAULT 0 NOT NULL,
    "net30_reminder_email_error" "text",
    "net30_reminder_lock_id" "uuid",
    CONSTRAINT "invoices_amount_due_non_negative" CHECK (("amount_due" >= (0)::numeric)),
    CONSTRAINT "invoices_amount_paid_lte_amount_due" CHECK (("amount_paid" <= "amount_due")),
    CONSTRAINT "invoices_amount_paid_non_negative" CHECK (("amount_paid" >= (0)::numeric)),
    CONSTRAINT "invoices_currency_iso3_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "invoices_invoice_number_not_blank" CHECK (("btrim"("invoice_number") <> ''::"text")),
    CONSTRAINT "invoices_net30_last_reminder_stage_check" CHECK ((("net30_last_reminder_stage" IS NULL) OR ("net30_last_reminder_stage" = ANY (ARRAY['upcoming'::"text", 'tomorrow'::"text", 'due_today'::"text", 'overdue'::"text"])))),
    CONSTRAINT "invoices_provider_not_blank" CHECK (("btrim"("provider") <> ''::"text")),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'sent'::"text", 'partially_paid'::"text", 'paid'::"text", 'overdue'::"text", 'void'::"text"])))
);

ALTER TABLE ONLY "public"."invoices" REPLICA IDENTITY FULL;


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON TABLE "public"."invoices" IS 'Invoice records for net-30 or manually invoiced orders.';



COMMENT ON COLUMN "public"."invoices"."provider" IS 'Invoice system/provider, e.g. internal, stripe, manual.';



COMMENT ON COLUMN "public"."invoices"."provider_invoice_id" IS 'External provider invoice id when applicable.';



COMMENT ON COLUMN "public"."invoices"."hosted_invoice_url" IS 'Hosted invoice page URL if provided by external billing system.';



CREATE TABLE IF NOT EXISTS "public"."marketing_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "tag" "text" NOT NULL,
    "bucket" "text" DEFAULT 'hbmedical-bucket-private'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "marketing_materials_bucket_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "bucket")) > 0)),
    CONSTRAINT "marketing_materials_file_name_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "file_name")) > 0)),
    CONSTRAINT "marketing_materials_file_path_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "file_path")) > 0)),
    CONSTRAINT "marketing_materials_tag_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "tag")) > 0)),
    CONSTRAINT "marketing_materials_title_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "title")) > 0))
);


ALTER TABLE "public"."marketing_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."message_reads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "read_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."message_reads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "order_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "order_number" "text" NOT NULL,
    "old_status" "text",
    "new_status" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "bucket" "text" DEFAULT 'hbmedical-bucket-private'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text",
    "file_size" bigint,
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['facesheet'::"text", 'clinical_docs'::"text", 'wound_pictures'::"text", 'order_form'::"text", 'form_1500'::"text", 'additional_ivr'::"text", 'other'::"text"]))),
    CONSTRAINT "order_documents_file_name_check" CHECK (("btrim"("file_name") <> ''::"text")),
    CONSTRAINT "order_documents_file_path_check" CHECK (("btrim"("file_path") <> ''::"text"))
);


ALTER TABLE "public"."order_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_form" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "wound_visit_number" integer,
    "chief_complaint" "text",
    "has_vasculitis_or_burns" boolean DEFAULT false,
    "is_receiving_home_health" boolean DEFAULT false,
    "is_patient_at_snf" boolean DEFAULT false,
    "icd10_code" "text",
    "followup_days" integer,
    "wound_site" "text",
    "wound_stage" "text",
    "wound_length_cm" numeric(6,2),
    "wound_width_cm" numeric(6,2),
    "wound_depth_cm" numeric(6,2),
    "subjective_symptoms" "text"[] DEFAULT '{}'::"text"[],
    "clinical_notes" "text",
    "ai_extracted" boolean DEFAULT false NOT NULL,
    "ai_extracted_at" timestamp with time zone,
    "is_locked" boolean DEFAULT false NOT NULL,
    "locked_at" timestamp with time zone,
    "locked_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "surgical_dressing_type" "text",
    "use_blood_thinners" boolean DEFAULT false,
    "blood_thinner_details" "text",
    "condition_decreased_mobility" boolean DEFAULT false,
    "condition_diabetes" boolean DEFAULT false,
    "condition_infection" boolean DEFAULT false,
    "condition_cvd" boolean DEFAULT false,
    "condition_copd" boolean DEFAULT false,
    "condition_chf" boolean DEFAULT false,
    "condition_anemia" boolean DEFAULT false,
    "wound_location_side" "text",
    "granulation_tissue_pct" numeric,
    "wound2_length_cm" numeric,
    "wound2_width_cm" numeric,
    "wound2_depth_cm" numeric,
    "exudate_amount" "text",
    "third_degree_burns" boolean DEFAULT false,
    "active_vasculitis" boolean DEFAULT false,
    "active_charcot" boolean DEFAULT false,
    "skin_condition" "text",
    "drainage_description" "text",
    "treatment_plan" "text",
    "anticipated_length_days" integer,
    "followup_weeks" integer,
    "patient_name" "text",
    "patient_date" "text",
    "physician_signature" "text",
    "physician_signature_date" "text",
    "physician_signed_at" timestamp with time zone,
    "physician_signed_by" "uuid",
    CONSTRAINT "order_form_followup_days_check" CHECK ((("followup_days" IS NULL) OR ("followup_days" > 0))),
    CONSTRAINT "order_form_wound_visit_number_check" CHECK ((("wound_visit_number" IS NULL) OR ("wound_visit_number" > 0)))
);


ALTER TABLE "public"."order_form" OWNER TO "postgres";


COMMENT ON COLUMN "public"."order_form"."surgical_dressing_type" IS 'Primary or Secondary surgical dressing';



COMMENT ON COLUMN "public"."order_form"."use_blood_thinners" IS 'Patient uses blood thinners (ASA, Plavix, Coumadin, Eliquis, Xarelto, Pradaxa)';



COMMENT ON COLUMN "public"."order_form"."wound_location_side" IS 'RT (right), LT (left), bilateral';



COMMENT ON COLUMN "public"."order_form"."exudate_amount" IS 'none, minimal, moderate, heavy';



COMMENT ON COLUMN "public"."order_form"."skin_condition" IS 'normal, thin, atrophic, stasis, ischemic';



COMMENT ON COLUMN "public"."order_form"."anticipated_length_days" IS 'Anticipated length of need in days (15, 21, 30)';



COMMENT ON COLUMN "public"."order_form"."patient_name" IS 'Patient name override — auto-populated from patients table, editable by user';



COMMENT ON COLUMN "public"."order_form"."patient_date" IS 'Patient signature date on the order form';



COMMENT ON COLUMN "public"."order_form"."physician_signature" IS 'Physician name for signature line — auto-populated from signed_by profile';



COMMENT ON COLUMN "public"."order_form"."physician_signature_date" IS 'Physician signature date on the order form';



CREATE TABLE IF NOT EXISTS "public"."order_form_1500" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "insurance_type" "text",
    "insured_id_number" "text",
    "patient_last_name" "text",
    "patient_first_name" "text",
    "patient_middle_initial" "text",
    "patient_dob" "text",
    "patient_sex" "text",
    "insured_last_name" "text",
    "insured_first_name" "text",
    "insured_middle_initial" "text",
    "patient_address" "text",
    "patient_city" "text",
    "patient_state" "text",
    "patient_zip" "text",
    "patient_phone" "text",
    "patient_relationship" "text",
    "insured_address" "text",
    "insured_city" "text",
    "insured_state" "text",
    "insured_zip" "text",
    "insured_phone" "text",
    "other_insured_name" "text",
    "other_insured_policy" "text",
    "other_insured_dob" "text",
    "other_insured_sex" "text",
    "other_insured_employer" "text",
    "other_insured_plan" "text",
    "condition_employment" boolean DEFAULT false,
    "condition_auto_accident" boolean DEFAULT false,
    "condition_auto_state" "text",
    "condition_other_accident" boolean DEFAULT false,
    "insured_policy_group" "text",
    "insured_dob" "text",
    "insured_sex" "text",
    "insured_employer" "text",
    "insured_plan_name" "text",
    "another_health_benefit" boolean DEFAULT false,
    "patient_signature" "text",
    "patient_signature_date" "text",
    "insured_signature" "text",
    "illness_date" "text",
    "illness_qualifier" "text",
    "other_date" "text",
    "other_date_qualifier" "text",
    "unable_work_from" "text",
    "unable_work_to" "text",
    "referring_provider_name" "text",
    "referring_provider_npi" "text",
    "referring_provider_qual" "text",
    "hospitalization_from" "text",
    "hospitalization_to" "text",
    "additional_claim_info" "text",
    "outside_lab" boolean DEFAULT false,
    "outside_lab_charges" "text",
    "diagnosis_a" "text",
    "diagnosis_b" "text",
    "diagnosis_c" "text",
    "diagnosis_d" "text",
    "diagnosis_e" "text",
    "diagnosis_f" "text",
    "diagnosis_g" "text",
    "diagnosis_h" "text",
    "diagnosis_i" "text",
    "diagnosis_j" "text",
    "diagnosis_k" "text",
    "diagnosis_l" "text",
    "resubmission_code" "text",
    "original_ref_number" "text",
    "prior_auth_number" "text",
    "service_lines" "jsonb" DEFAULT '[]'::"jsonb",
    "federal_tax_id" "text",
    "tax_id_ssn" boolean DEFAULT false,
    "patient_account_number" "text",
    "accept_assignment" boolean DEFAULT false,
    "total_charge" "text",
    "amount_paid" "text",
    "rsvd_nucc" "text",
    "physician_signature" "text",
    "physician_signature_date" "text",
    "service_facility_name" "text",
    "service_facility_address" "text",
    "service_facility_npi" "text",
    "billing_provider_name" "text",
    "billing_provider_address" "text",
    "billing_provider_phone" "text",
    "billing_provider_npi" "text",
    "billing_provider_tax_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nucc_use" "text",
    "insurance_name" "text",
    "insurance_address" "text",
    "insurance_address2" "text",
    "insurance_city_state_zip" "text",
    "claim_codes" "text",
    "icd_indicator" "text",
    "physician_signed_at" timestamp with time zone,
    "physician_signed_by" "uuid",
    CONSTRAINT "order_form_1500_insurance_type_check" CHECK ((("insurance_type" IS NULL) OR ("insurance_type" = ANY (ARRAY['medicare'::"text", 'medicaid'::"text", 'tricare'::"text", 'champva'::"text", 'group_health_plan'::"text", 'feca_blk_lung'::"text", 'other'::"text"])))),
    CONSTRAINT "order_form_1500_patient_relationship_check" CHECK ((("patient_relationship" IS NULL) OR ("patient_relationship" = ANY (ARRAY['self'::"text", 'spouse'::"text", 'child'::"text", 'other'::"text"])))),
    CONSTRAINT "order_form_1500_patient_sex_check" CHECK ((("patient_sex" IS NULL) OR ("patient_sex" = ANY (ARRAY['male'::"text", 'female'::"text", 'other'::"text"]))))
);


ALTER TABLE "public"."order_form_1500" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "performed_by" "uuid",
    "action" "text" NOT NULL,
    "old_status" "text",
    "new_status" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_history_action_check" CHECK (("btrim"("action") <> ''::"text"))
);


ALTER TABLE "public"."order_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "product_name" "text" NOT NULL,
    "product_sku" "text" NOT NULL,
    "unit_price" numeric DEFAULT 0 NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "shipping_amount" numeric DEFAULT 0 NOT NULL,
    "tax_amount" numeric DEFAULT 0 NOT NULL,
    "subtotal" numeric GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED,
    "total_amount" numeric GENERATED ALWAYS AS ((((("quantity")::numeric * "unit_price") + "shipping_amount") + "tax_amount")) STORED,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_items_product_name_check" CHECK (("btrim"("product_name") <> ''::"text")),
    CONSTRAINT "order_items_product_sku_check" CHECK (("btrim"("product_sku") <> ''::"text")),
    CONSTRAINT "order_items_quantity_check" CHECK (("quantity" > 0)),
    CONSTRAINT "order_items_shipping_amount_check" CHECK (("shipping_amount" >= (0)::numeric)),
    CONSTRAINT "order_items_tax_amount_check" CHECK (("tax_amount" >= (0)::numeric)),
    CONSTRAINT "order_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."order_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_ivr" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "insurance_provider" "text",
    "insurance_phone" "text",
    "member_id" "text",
    "group_number" "text",
    "plan_name" "text",
    "plan_type" "text",
    "subscriber_name" "text",
    "subscriber_dob" "date",
    "subscriber_relationship" "text",
    "coverage_start_date" "date",
    "coverage_end_date" "date",
    "deductible_amount" numeric(10,2),
    "deductible_met" numeric(10,2),
    "out_of_pocket_max" numeric(10,2),
    "out_of_pocket_met" numeric(10,2),
    "copay_amount" numeric(10,2),
    "coinsurance_percent" numeric(5,2),
    "dme_covered" boolean DEFAULT false,
    "wound_care_covered" boolean DEFAULT false,
    "prior_auth_required" boolean DEFAULT false,
    "prior_auth_number" "text",
    "prior_auth_start_date" "date",
    "prior_auth_end_date" "date",
    "units_authorized" integer,
    "verified_by" "text",
    "verified_date" "date",
    "verification_reference" "text",
    "notes" "text",
    "ai_extracted" boolean DEFAULT false,
    "ai_extracted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "place_of_service" "text",
    "medicare_admin_contractor" "text",
    "facility_npi" "text",
    "facility_tin" "text",
    "facility_ptan" "text",
    "facility_fax" "text",
    "physician_tin" "text",
    "physician_fax" "text",
    "physician_address" "text",
    "patient_phone" "text",
    "patient_address" "text",
    "ok_to_contact_patient" boolean DEFAULT false,
    "provider_participates_primary" "text",
    "provider_participates_secondary" "text",
    "secondary_insurance_provider" "text",
    "secondary_insurance_phone" "text",
    "secondary_subscriber_name" "text",
    "secondary_policy_number" "text",
    "secondary_subscriber_dob" "date",
    "secondary_plan_type" "text",
    "secondary_group_number" "text",
    "secondary_subscriber_relationship" "text",
    "application_cpts" "text",
    "surgical_global_period" boolean DEFAULT false,
    "global_period_cpt" "text",
    "prior_auth_permission" boolean DEFAULT false,
    "specialty_site_name" "text",
    "facility_name" "text",
    "facility_address" "text",
    "facility_phone" "text",
    "facility_contact" "text",
    "physician_name" "text",
    "physician_phone" "text",
    "physician_npi" "text",
    "patient_name" "text",
    "patient_dob" "date",
    "sales_rep_name" "text",
    "wound_type" "text",
    "wound_sizes" "text",
    "date_of_procedure" "date",
    "icd10_codes" "text",
    "product_information" "text",
    "is_patient_at_snf" boolean DEFAULT false,
    "physician_signature" "text",
    "physician_signature_date" "text",
    "physician_signed_at" timestamp with time zone,
    "physician_signed_by" "uuid"
);


ALTER TABLE "public"."order_ivr" OWNER TO "postgres";


COMMENT ON COLUMN "public"."order_ivr"."place_of_service" IS 'Office, Outpatient Hospital, Ambulatory Surgical Center, Other';



COMMENT ON COLUMN "public"."order_ivr"."provider_participates_primary" IS 'yes, no, or not_sure';



COMMENT ON COLUMN "public"."order_ivr"."provider_participates_secondary" IS 'yes, no, or not_sure';



COMMENT ON COLUMN "public"."order_ivr"."application_cpts" IS 'Application CPT codes for the procedure';



COMMENT ON COLUMN "public"."order_ivr"."prior_auth_permission" IS 'Permission to work with payer on behalf of provider';



COMMENT ON COLUMN "public"."order_ivr"."facility_name" IS 'Override for facility name. Auto-populated from facilities.name, editable by user.';



COMMENT ON COLUMN "public"."order_ivr"."physician_name" IS 'Override for physician name. Auto-populated from profiles, editable by user.';



COMMENT ON COLUMN "public"."order_ivr"."patient_name" IS 'Override for patient name. Auto-populated from patients, editable by user.';



COMMENT ON COLUMN "public"."order_ivr"."sales_rep_name" IS 'Sales rep name — auto-populated from facilities.assigned_rep profile';



COMMENT ON COLUMN "public"."order_ivr"."wound_type" IS 'Wound type override for IVR form — expanded options (DFU, VLU, PU, traumatic_burns, radiation_burns, necrotizing_fasciitis, dehisced_surgical, other)';



COMMENT ON COLUMN "public"."order_ivr"."wound_sizes" IS 'Wound size description';



COMMENT ON COLUMN "public"."order_ivr"."product_information" IS 'Product selection/info for IVR form';



COMMENT ON COLUMN "public"."order_ivr"."physician_signature" IS 'Physician signature name on IVR form';



COMMENT ON COLUMN "public"."order_ivr"."physician_signature_date" IS 'Physician signature date on IVR form';



CREATE TABLE IF NOT EXISTS "public"."order_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_messages_message_check" CHECK (("btrim"("message") <> ''::"text"))
);


ALTER TABLE "public"."order_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "payment_method" "text",
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invoice_status" "text" DEFAULT 'not_applicable'::"text" NOT NULL,
    "fulfillment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "delivery_status" "text" DEFAULT 'not_shipped'::"text" NOT NULL,
    "tracking_number" "text",
    "notes" "text",
    "placed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "paid_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "order_status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "created_by" "uuid",
    "signed_by" "uuid",
    "signed_at" timestamp with time zone,
    "wound_type" "text",
    "date_of_service" "date",
    "patient_id" "uuid",
    "assigned_provider_id" "uuid",
    "ai_extracted" boolean DEFAULT false,
    "ai_extracted_at" timestamp with time zone,
    "symptoms" "text"[] DEFAULT '{}'::"text"[],
    "wound_visit_number" integer,
    "chief_complaint" "text",
    "has_vasculitis_or_burns" boolean,
    "is_receiving_home_health" boolean,
    "is_patient_at_snf" boolean,
    "icd10_code" "text",
    "followup_days" integer,
    "order_form_locked" boolean DEFAULT false NOT NULL,
    "admin_notes" "text",
    "order_type" "text",
    CONSTRAINT "orders_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['not_shipped'::"text", 'label_created'::"text", 'in_transit'::"text", 'delivered'::"text", 'returned'::"text", 'exception'::"text", 'canceled'::"text"]))),
    CONSTRAINT "orders_fulfillment_status_check" CHECK (("fulfillment_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'fulfilled'::"text", 'canceled'::"text"]))),
    CONSTRAINT "orders_invoice_status_check" CHECK (("invoice_status" = ANY (ARRAY['not_applicable'::"text", 'draft'::"text", 'issued'::"text", 'sent'::"text", 'partially_paid'::"text", 'paid'::"text", 'overdue'::"text", 'void'::"text"]))),
    CONSTRAINT "orders_order_number_not_blank" CHECK (("btrim"("order_number") <> ''::"text")),
    CONSTRAINT "orders_order_status_check" CHECK (("order_status" = ANY (ARRAY['draft'::"text", 'pending_signature'::"text", 'manufacturer_review'::"text", 'additional_info_needed'::"text", 'approved'::"text", 'shipped'::"text", 'delivered'::"text", 'canceled'::"text"]))),
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'partially_refunded'::"text", 'canceled'::"text"]))),
    CONSTRAINT "orders_wound_type_check" CHECK ((("wound_type" IS NULL) OR ("wound_type" = ANY (ARRAY['chronic'::"text", 'post_surgical'::"text"]))))
);

ALTER TABLE ONLY "public"."orders" REPLICA IDENTITY FULL;


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."orders" IS 'Commerce order table. Each row represents one purchased product and quantity for one facility.';



COMMENT ON COLUMN "public"."orders"."payment_method" IS 'Checkout method: pay_now or net_30.';



COMMENT ON COLUMN "public"."orders"."payment_status" IS 'Summary payment state for UI and workflow handling.';



COMMENT ON COLUMN "public"."orders"."invoice_status" IS 'Summary invoice state for net-30 flow.';



COMMENT ON COLUMN "public"."orders"."fulfillment_status" IS 'Internal fulfillment status before/after shipping.';



COMMENT ON COLUMN "public"."orders"."delivery_status" IS 'Shipment delivery state mirrored for UI convenience.';



COMMENT ON COLUMN "public"."orders"."tracking_number" IS 'Current tracking number summary mirrored from shipments when available.';



CREATE TABLE IF NOT EXISTS "public"."patients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "date_of_birth" "date",
    "patient_ref" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "patients_first_name_check" CHECK (("btrim"("first_name") <> ''::"text")),
    CONSTRAINT "patients_last_name_check" CHECK (("btrim"("last_name") <> ''::"text"))
);


ALTER TABLE "public"."patients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "payment_type" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "provider_payment_id" "text",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "stripe_charge_id" "text",
    "receipt_url" "text",
    CONSTRAINT "payments_amount_non_negative" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_currency_iso3_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "payments_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['checkout'::"text", 'invoice'::"text", 'manual'::"text"]))),
    CONSTRAINT "payments_provider_not_blank" CHECK (("btrim"("provider") <> ''::"text")),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'partially_refunded'::"text", 'canceled'::"text"])))
);

ALTER TABLE ONLY "public"."payments" REPLICA IDENTITY FULL;


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."payments" IS 'Payment records linked to orders, including Stripe checkout and invoice payment events.';



COMMENT ON COLUMN "public"."payments"."provider" IS 'Payment provider, e.g. stripe, invoice, manual.';



COMMENT ON COLUMN "public"."payments"."payment_type" IS 'Payment source type: checkout, invoice, or manual.';



COMMENT ON COLUMN "public"."payments"."stripe_checkout_session_id" IS 'Stripe Checkout Session id when payment_method is pay_now.';



COMMENT ON COLUMN "public"."payments"."stripe_payment_intent_id" IS 'Stripe Payment Intent id when available.';



COMMENT ON COLUMN "public"."payments"."provider_payment_id" IS 'External provider payment id when applicable.';



CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rep_id" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "paid_at" timestamp with time zone,
    "paid_by" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payouts_period_format" CHECK (("period" ~ '^\d{4}-\d{2}$'::"text")),
    CONSTRAINT "payouts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'approved'::"text", 'paid'::"text"]))),
    CONSTRAINT "payouts_total_amount_non_negative" CHECK (("total_amount" >= (0)::numeric))
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


COMMENT ON TABLE "public"."payouts" IS 'Monthly payout batches per rep. Admin reviews, approves, and marks as paid.';



COMMENT ON COLUMN "public"."payouts"."period" IS 'Year-month string (e.g. 2026-04).';



COMMENT ON COLUMN "public"."payouts"."paid_by" IS 'Admin who marked this payout as paid.';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sku" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "products_category_not_blank" CHECK ((("category" IS NULL) OR ("btrim"("category") <> ''::"text"))),
    CONSTRAINT "products_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "products_sku_not_blank" CHECK (("btrim"("sku") <> ''::"text")),
    CONSTRAINT "products_sort_order_non_negative" CHECK (("sort_order" >= 0)),
    CONSTRAINT "products_unit_price_non_negative" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON TABLE "public"."products" IS 'Shared product catalog for ordering.';



COMMENT ON COLUMN "public"."products"."sku" IS 'Unique product SKU used across catalog, ordering, and integrations.';



COMMENT ON COLUMN "public"."products"."unit_price" IS 'Current catalog unit price. Historical order pricing is stored on orders.';



COMMENT ON COLUMN "public"."products"."sort_order" IS 'Ascending UI display order for active products.';



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "phone" "text",
    "role" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "has_completed_setup" boolean DEFAULT false NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    CONSTRAINT "profiles_first_name_not_blank" CHECK (("btrim"("first_name") <> ''::"text")),
    CONSTRAINT "profiles_last_name_not_blank" CHECK (("btrim"("last_name") <> ''::"text")),
    CONSTRAINT "profiles_phone_e164_check" CHECK ((("phone" IS NULL) OR ("phone" ~ '^\+[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'sales_representative'::"text", 'support_staff'::"text", 'clinical_provider'::"text", 'clinical_staff'::"text"]))),
    CONSTRAINT "profiles_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Application profile for each auth user. Exactly one profile per auth.users row.';



COMMENT ON COLUMN "public"."profiles"."phone" IS 'User phone in E.164 format, e.g. +639310259241';



COMMENT ON COLUMN "public"."profiles"."role" IS 'admin = HB Medical admin |
   sales_representative = HB Medical field rep |
   support_staff = HB Medical tech support (all accounts, IVR, CMS-1500) |
   clinical_provider = Clinic physician/doctor (can sign orders) |
   clinical_staff = Clinic staff (can create orders, cannot sign)';



COMMENT ON COLUMN "public"."profiles"."has_completed_setup" IS 'True after the user has completed their first-login setup 
   (reps: facility creation, clinic users: already done via invite signup).
   Used by middleware to redirect incomplete profiles to setup page.';



COMMENT ON COLUMN "public"."profiles"."status" IS 'pending = invited but never completed setup |
   active = fully onboarded |
   inactive = deactivated by admin';



CREATE TABLE IF NOT EXISTS "public"."provider_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential" "text",
    "npi_number" "text",
    "ptan_number" "text",
    "medical_license_number" "text",
    "pin_hash" "text",
    "baa_signed_at" timestamp with time zone,
    "terms_signed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "provider_credentials_credential_check" CHECK (("credential" = ANY (ARRAY['MD'::"text", 'DO'::"text", 'ARNP'::"text", 'PA'::"text", 'RN'::"text", 'CCA'::"text", 'LPN'::"text", 'Admin'::"text", 'Other'::"text"]))),
    CONSTRAINT "provider_credentials_npi_number_check" CHECK ((("npi_number" IS NULL) OR ("npi_number" ~ '^\d{10}$'::"text")))
);


ALTER TABLE "public"."provider_credentials" OWNER TO "postgres";


COMMENT ON TABLE "public"."provider_credentials" IS 'Stores clinical credentialing info and PIN hash for clinic-side users.
   PIN is bcrypt-hashed — never stored in plaintext.';



COMMENT ON COLUMN "public"."provider_credentials"."npi_number" IS '10-digit National Provider Identifier. Required for clinical providers to sign orders.';



COMMENT ON COLUMN "public"."provider_credentials"."ptan_number" IS 'Provider Transaction Access Number. Optional.';



COMMENT ON COLUMN "public"."provider_credentials"."pin_hash" IS 'Bcrypt hash of the user PIN used as digital signature on orders.';



COMMENT ON COLUMN "public"."provider_credentials"."baa_signed_at" IS 'Timestamp when the user signed the Business Associate Agreement.';



COMMENT ON COLUMN "public"."provider_credentials"."terms_signed_at" IS 'Timestamp when the user signed the Terms of Use.';



CREATE TABLE IF NOT EXISTS "public"."rep_hierarchy" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "parent_rep_id" "uuid" NOT NULL,
    "child_rep_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "rep_hierarchy_check" CHECK (("parent_rep_id" <> "child_rep_id"))
);


ALTER TABLE "public"."rep_hierarchy" OWNER TO "postgres";


COMMENT ON TABLE "public"."rep_hierarchy" IS 'Tracks which sales reps are sub-reps under a parent rep.
   Main reps and sub-reps can both create further sub-reps.
   Only admin can create top-level (main) rep accounts.';



CREATE TABLE IF NOT EXISTS "public"."sales_quotas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rep_id" "uuid" NOT NULL,
    "set_by" "uuid" NOT NULL,
    "period" "text" NOT NULL,
    "target_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sales_quotas_period_format" CHECK (("period" ~ '^\d{4}-\d{2}$'::"text")),
    CONSTRAINT "sales_quotas_target_non_negative" CHECK (("target_amount" >= (0)::numeric))
);


ALTER TABLE "public"."sales_quotas" OWNER TO "postgres";


COMMENT ON TABLE "public"."sales_quotas" IS 'Monthly revenue targets per sales rep. Admin sets targets; progress calculated from paid order revenue.';



COMMENT ON COLUMN "public"."sales_quotas"."period" IS 'Year-month string (e.g. 2026-04).';



COMMENT ON COLUMN "public"."sales_quotas"."target_amount" IS 'Revenue target for the month in dollars.';



CREATE TABLE IF NOT EXISTS "public"."shipments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "carrier" "text",
    "service_level" "text",
    "tracking_number" "text",
    "tracking_url" "text",
    "shipstation_order_id" "text",
    "shipstation_shipment_id" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "shipped_at" timestamp with time zone,
    "estimated_delivery_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "shipments_carrier_not_blank" CHECK ((("carrier" IS NULL) OR ("btrim"("carrier") <> ''::"text"))),
    CONSTRAINT "shipments_service_level_not_blank" CHECK ((("service_level" IS NULL) OR ("btrim"("service_level") <> ''::"text"))),
    CONSTRAINT "shipments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'label_created'::"text", 'in_transit'::"text", 'delivered'::"text", 'returned'::"text", 'exception'::"text", 'canceled'::"text"]))),
    CONSTRAINT "shipments_tracking_number_not_blank" CHECK ((("tracking_number" IS NULL) OR ("btrim"("tracking_number") <> ''::"text")))
);


ALTER TABLE "public"."shipments" OWNER TO "postgres";


COMMENT ON TABLE "public"."shipments" IS 'Shipment and tracking records linked to orders.';



COMMENT ON COLUMN "public"."shipments"."tracking_url" IS 'Carrier or provider tracking URL for the shipment.';



COMMENT ON COLUMN "public"."shipments"."shipstation_order_id" IS 'ShipStation order identifier when synced externally.';



COMMENT ON COLUMN "public"."shipments"."shipstation_shipment_id" IS 'ShipStation shipment identifier when synced externally.';



CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "object_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid",
    "contact_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "assigned_to" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "due_date" "date" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "notes" "text",
    "reminder_sent" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tasks_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'done'::"text"]))),
    CONSTRAINT "tasks_title_check" CHECK (("btrim"("title") <> ''::"text"))
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


COMMENT ON TABLE "public"."tasks" IS 'Rep tasks and follow-up reminders, optionally linked to an account and contact.';



COMMENT ON COLUMN "public"."tasks"."priority" IS 'low | medium | high';



COMMENT ON COLUMN "public"."tasks"."status" IS 'open | done';



CREATE TABLE IF NOT EXISTS "public"."training_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "tag" "text" NOT NULL,
    "bucket" "text" DEFAULT 'hbmedical-bucket-private'::"text" NOT NULL,
    "file_path" "text" NOT NULL,
    "file_name" "text" NOT NULL,
    "mime_type" "text" DEFAULT 'application/pdf'::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "training_materials_bucket_check" CHECK (("bucket" = 'hbmedical-bucket-private'::"text")),
    CONSTRAINT "training_materials_bucket_not_blank" CHECK (("btrim"("bucket") <> ''::"text")),
    CONSTRAINT "training_materials_file_name_not_blank" CHECK (("btrim"("file_name") <> ''::"text")),
    CONSTRAINT "training_materials_file_path_not_blank" CHECK (("btrim"("file_path") <> ''::"text")),
    CONSTRAINT "training_materials_file_path_prefix_check" CHECK (("file_path" ~~ 'trainings/%'::"text")),
    CONSTRAINT "training_materials_tag_not_blank" CHECK (("btrim"("tag") <> ''::"text")),
    CONSTRAINT "training_materials_title_not_blank" CHECK (("btrim"("title") <> ''::"text"))
);


ALTER TABLE "public"."training_materials" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commission_rates"
    ADD CONSTRAINT "commission_rates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_materials"
    ADD CONSTRAINT "contract_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."facility_enrollment"
    ADD CONSTRAINT "facility_enrollment_facility_id_key" UNIQUE ("facility_id");



ALTER TABLE ONLY "public"."facility_enrollment"
    ADD CONSTRAINT "facility_enrollment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_members"
    ADD CONSTRAINT "facility_members_facility_id_user_id_key" UNIQUE ("facility_id", "user_id");



ALTER TABLE ONLY "public"."facility_members"
    ADD CONSTRAINT "facility_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."hospital_onboarding_materials"
    ADD CONSTRAINT "hospital_onboarding_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invite_tokens"
    ADD CONSTRAINT "invite_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invite_tokens"
    ADD CONSTRAINT "invite_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_materials"
    ADD CONSTRAINT "marketing_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_message_id_user_id_key" UNIQUE ("message_id", "user_id");



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_documents"
    ADD CONSTRAINT "order_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_form_1500"
    ADD CONSTRAINT "order_form_1500_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_form_1500"
    ADD CONSTRAINT "order_form_1500_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_form"
    ADD CONSTRAINT "order_form_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_form"
    ADD CONSTRAINT "order_form_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_history"
    ADD CONSTRAINT "order_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_ivr"
    ADD CONSTRAINT "order_ivr_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_ivr"
    ADD CONSTRAINT "order_ivr_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_messages"
    ADD CONSTRAINT "order_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_unique" UNIQUE ("sku");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_credentials"
    ADD CONSTRAINT "provider_credentials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."provider_credentials"
    ADD CONSTRAINT "provider_credentials_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."rep_hierarchy"
    ADD CONSTRAINT "rep_hierarchy_parent_rep_id_child_rep_id_key" UNIQUE ("parent_rep_id", "child_rep_id");



ALTER TABLE ONLY "public"."rep_hierarchy"
    ADD CONSTRAINT "rep_hierarchy_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sales_quotas"
    ADD CONSTRAINT "sales_quotas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_materials"
    ADD CONSTRAINT "training_materials_pkey" PRIMARY KEY ("id");



CREATE INDEX "activities_contact_id_idx" ON "public"."activities" USING "btree" ("contact_id");



CREATE INDEX "activities_date_idx" ON "public"."activities" USING "btree" ("activity_date" DESC);



CREATE INDEX "activities_facility_id_idx" ON "public"."activities" USING "btree" ("facility_id");



CREATE INDEX "activities_logged_by_idx" ON "public"."activities" USING "btree" ("logged_by");



CREATE INDEX "commission_rates_effective_idx" ON "public"."commission_rates" USING "btree" ("rep_id", "effective_from", "effective_to");



CREATE INDEX "commission_rates_rep_id_idx" ON "public"."commission_rates" USING "btree" ("rep_id");



CREATE INDEX "commission_rates_set_by_idx" ON "public"."commission_rates" USING "btree" ("set_by");



CREATE INDEX "commissions_order_id_idx" ON "public"."commissions" USING "btree" ("order_id");



CREATE UNIQUE INDEX "commissions_order_rep_type_uidx" ON "public"."commissions" USING "btree" ("order_id", "rep_id", "type");



CREATE INDEX "commissions_payout_period_idx" ON "public"."commissions" USING "btree" ("payout_period");



CREATE INDEX "commissions_rep_id_idx" ON "public"."commissions" USING "btree" ("rep_id");



CREATE INDEX "commissions_rep_period_idx" ON "public"."commissions" USING "btree" ("rep_id", "payout_period");



CREATE INDEX "commissions_status_idx" ON "public"."commissions" USING "btree" ("status");



CREATE INDEX "contacts_facility_id_idx" ON "public"."contacts" USING "btree" ("facility_id");



CREATE UNIQUE INDEX "contract_materials_bucket_file_path_key" ON "public"."contract_materials" USING "btree" ("bucket", "file_path");



CREATE INDEX "facilities_assigned_rep_idx" ON "public"."facilities" USING "btree" ("assigned_rep");



CREATE UNIQUE INDEX "facilities_stripe_customer_id_uidx" ON "public"."facilities" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "facilities_user_id_idx" ON "public"."facilities" USING "btree" ("user_id");



CREATE INDEX "facility_members_facility_id_idx" ON "public"."facility_members" USING "btree" ("facility_id");



CREATE INDEX "facility_members_user_id_idx" ON "public"."facility_members" USING "btree" ("user_id");



CREATE UNIQUE INDEX "hospital_onboarding_materials_bucket_file_path_key" ON "public"."hospital_onboarding_materials" USING "btree" ("bucket", "file_path");



CREATE INDEX "idx_contract_materials_created_at" ON "public"."contract_materials" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contract_materials_is_active" ON "public"."contract_materials" USING "btree" ("is_active");



CREATE INDEX "idx_contract_materials_sort_order" ON "public"."contract_materials" USING "btree" ("sort_order");



CREATE INDEX "idx_contract_materials_tag" ON "public"."contract_materials" USING "btree" ("tag");



CREATE INDEX "idx_hospital_onboarding_materials_created_at" ON "public"."hospital_onboarding_materials" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hospital_onboarding_materials_is_active" ON "public"."hospital_onboarding_materials" USING "btree" ("is_active");



CREATE INDEX "idx_hospital_onboarding_materials_sort_order" ON "public"."hospital_onboarding_materials" USING "btree" ("sort_order");



CREATE INDEX "idx_hospital_onboarding_materials_tag" ON "public"."hospital_onboarding_materials" USING "btree" ("tag");



CREATE INDEX "idx_message_reads_message_id" ON "public"."message_reads" USING "btree" ("message_id");



CREATE INDEX "idx_message_reads_user_id" ON "public"."message_reads" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_order_id" ON "public"."notifications" USING "btree" ("order_id");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_training_materials_created_at" ON "public"."training_materials" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_training_materials_is_active" ON "public"."training_materials" USING "btree" ("is_active");



CREATE INDEX "idx_training_materials_sort_order" ON "public"."training_materials" USING "btree" ("sort_order");



CREATE INDEX "idx_training_materials_tag" ON "public"."training_materials" USING "btree" ("tag");



CREATE INDEX "invite_tokens_created_by_idx" ON "public"."invite_tokens" USING "btree" ("created_by");



CREATE INDEX "invite_tokens_facility_id_idx" ON "public"."invite_tokens" USING "btree" ("facility_id");



CREATE INDEX "invite_tokens_token_idx" ON "public"."invite_tokens" USING "btree" ("token");



CREATE INDEX "invoices_due_at_idx" ON "public"."invoices" USING "btree" ("due_at");



CREATE UNIQUE INDEX "invoices_invoice_number_lower_uidx" ON "public"."invoices" USING "btree" ("lower"("invoice_number"));



CREATE INDEX "invoices_net30_reminder_lock_id_idx" ON "public"."invoices" USING "btree" ("net30_reminder_lock_id") WHERE ("net30_reminder_lock_id" IS NOT NULL);



CREATE UNIQUE INDEX "invoices_order_id_uidx" ON "public"."invoices" USING "btree" ("order_id");



CREATE INDEX "invoices_paid_at_idx" ON "public"."invoices" USING "btree" ("paid_at");



CREATE UNIQUE INDEX "invoices_provider_invoice_id_uidx" ON "public"."invoices" USING "btree" ("provider_invoice_id") WHERE ("provider_invoice_id" IS NOT NULL);



CREATE INDEX "invoices_status_idx" ON "public"."invoices" USING "btree" ("status");



CREATE UNIQUE INDEX "marketing_materials_bucket_file_path_uidx" ON "public"."marketing_materials" USING "btree" ("bucket", "file_path");



CREATE INDEX "marketing_materials_created_at_idx" ON "public"."marketing_materials" USING "btree" ("created_at" DESC);



CREATE INDEX "marketing_materials_is_active_idx" ON "public"."marketing_materials" USING "btree" ("is_active");



CREATE INDEX "marketing_materials_sort_order_idx" ON "public"."marketing_materials" USING "btree" ("sort_order");



CREATE INDEX "marketing_materials_tag_idx" ON "public"."marketing_materials" USING "btree" ("tag");



CREATE INDEX "orders_delivery_status_idx" ON "public"."orders" USING "btree" ("delivery_status");



CREATE INDEX "orders_facility_id_idx" ON "public"."orders" USING "btree" ("facility_id");



CREATE INDEX "orders_fulfillment_status_idx" ON "public"."orders" USING "btree" ("fulfillment_status");



CREATE INDEX "orders_invoice_status_idx" ON "public"."orders" USING "btree" ("invoice_status");



CREATE UNIQUE INDEX "orders_order_number_lower_uidx" ON "public"."orders" USING "btree" ("lower"("order_number"));



CREATE INDEX "orders_order_status_idx" ON "public"."orders" USING "btree" ("order_status");



CREATE INDEX "orders_payment_method_idx" ON "public"."orders" USING "btree" ("payment_method");



CREATE INDEX "orders_payment_status_idx" ON "public"."orders" USING "btree" ("payment_status");



CREATE INDEX "orders_placed_at_idx" ON "public"."orders" USING "btree" ("placed_at" DESC);



CREATE INDEX "payments_created_at_idx" ON "public"."payments" USING "btree" ("created_at" DESC);



CREATE INDEX "payments_order_id_idx" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "payments_paid_at_idx" ON "public"."payments" USING "btree" ("paid_at");



CREATE UNIQUE INDEX "payments_provider_payment_id_uidx" ON "public"."payments" USING "btree" ("provider_payment_id") WHERE ("provider_payment_id" IS NOT NULL);



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status");



CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_uidx" ON "public"."payments" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_uidx" ON "public"."payments" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "payouts_period_idx" ON "public"."payouts" USING "btree" ("period");



CREATE INDEX "payouts_rep_id_idx" ON "public"."payouts" USING "btree" ("rep_id");



CREATE UNIQUE INDEX "payouts_rep_period_uidx" ON "public"."payouts" USING "btree" ("rep_id", "period");



CREATE INDEX "payouts_status_idx" ON "public"."payouts" USING "btree" ("status");



CREATE INDEX "products_category_idx" ON "public"."products" USING "btree" ("category");



CREATE INDEX "products_is_active_idx" ON "public"."products" USING "btree" ("is_active");



CREATE UNIQUE INDEX "products_sku_lower_uidx" ON "public"."products" USING "btree" ("lower"("sku"));



CREATE INDEX "products_sort_order_idx" ON "public"."products" USING "btree" ("sort_order");



CREATE UNIQUE INDEX "profiles_email_lower_uidx" ON "public"."profiles" USING "btree" ("lower"("email"));



CREATE INDEX "profiles_setup_idx" ON "public"."profiles" USING "btree" ("id", "has_completed_setup");



CREATE INDEX "profiles_status_idx" ON "public"."profiles" USING "btree" ("status");



CREATE INDEX "rep_hierarchy_child_idx" ON "public"."rep_hierarchy" USING "btree" ("child_rep_id");



CREATE INDEX "rep_hierarchy_parent_idx" ON "public"."rep_hierarchy" USING "btree" ("parent_rep_id");



CREATE INDEX "sales_quotas_period_idx" ON "public"."sales_quotas" USING "btree" ("period");



CREATE INDEX "sales_quotas_rep_id_idx" ON "public"."sales_quotas" USING "btree" ("rep_id");



CREATE UNIQUE INDEX "sales_quotas_rep_period_uidx" ON "public"."sales_quotas" USING "btree" ("rep_id", "period");



CREATE INDEX "shipments_delivered_at_idx" ON "public"."shipments" USING "btree" ("delivered_at");



CREATE UNIQUE INDEX "shipments_order_id_uidx" ON "public"."shipments" USING "btree" ("order_id");



CREATE UNIQUE INDEX "shipments_shipstation_order_id_uidx" ON "public"."shipments" USING "btree" ("shipstation_order_id") WHERE ("shipstation_order_id" IS NOT NULL);



CREATE UNIQUE INDEX "shipments_shipstation_shipment_id_uidx" ON "public"."shipments" USING "btree" ("shipstation_shipment_id") WHERE ("shipstation_shipment_id" IS NOT NULL);



CREATE INDEX "shipments_status_idx" ON "public"."shipments" USING "btree" ("status");



CREATE UNIQUE INDEX "shipments_tracking_number_uidx" ON "public"."shipments" USING "btree" ("tracking_number") WHERE ("tracking_number" IS NOT NULL);



CREATE INDEX "stripe_webhook_events_event_type_idx" ON "public"."stripe_webhook_events" USING "btree" ("event_type");



CREATE INDEX "stripe_webhook_events_object_id_idx" ON "public"."stripe_webhook_events" USING "btree" ("object_id");



CREATE INDEX "tasks_assigned_to_idx" ON "public"."tasks" USING "btree" ("assigned_to");



CREATE INDEX "tasks_created_by_idx" ON "public"."tasks" USING "btree" ("created_by");



CREATE INDEX "tasks_due_date_idx" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "tasks_facility_id_idx" ON "public"."tasks" USING "btree" ("facility_id");



CREATE INDEX "tasks_status_idx" ON "public"."tasks" USING "btree" ("status");



CREATE UNIQUE INDEX "training_materials_bucket_file_path_key" ON "public"."training_materials" USING "btree" ("bucket", "file_path");



CREATE OR REPLACE TRIGGER "activities_set_updated_at" BEFORE UPDATE ON "public"."activities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "contacts_set_updated_at" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "provider_credentials_set_updated_at" BEFORE UPDATE ON "public"."provider_credentials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_commission_rates_updated_at" BEFORE UPDATE ON "public"."commission_rates" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_commissions_updated_at" BEFORE UPDATE ON "public"."commissions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_contract_materials_updated_at" BEFORE UPDATE ON "public"."contract_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_facility_enrollment_updated_at" BEFORE UPDATE ON "public"."facility_enrollment" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_hospital_onboarding_materials_updated_at" BEFORE UPDATE ON "public"."hospital_onboarding_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_marketing_materials_updated_at" BEFORE UPDATE ON "public"."marketing_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_payouts_updated_at" BEFORE UPDATE ON "public"."payouts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_sales_quotas_updated_at" BEFORE UPDATE ON "public"."sales_quotas" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_training_materials_updated_at" BEFORE UPDATE ON "public"."training_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "tasks_set_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_facilities_set_updated_at" BEFORE UPDATE ON "public"."facilities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_set_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_set_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_products_set_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_shipments_set_updated_at" BEFORE UPDATE ON "public"."shipments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commission_rates"
    ADD CONSTRAINT "commission_rates_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commission_rates"
    ADD CONSTRAINT "commission_rates_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commissions"
    ADD CONSTRAINT "commissions_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_assigned_rep_fkey" FOREIGN KEY ("assigned_rep") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_enrollment"
    ADD CONSTRAINT "facility_enrollment_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_members"
    ADD CONSTRAINT "facility_members_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_members"
    ADD CONSTRAINT "facility_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."facility_members"
    ADD CONSTRAINT "facility_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_tokens"
    ADD CONSTRAINT "invite_tokens_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_tokens"
    ADD CONSTRAINT "invite_tokens_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invite_tokens"
    ADD CONSTRAINT "invite_tokens_used_by_fkey" FOREIGN KEY ("used_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."order_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."message_reads"
    ADD CONSTRAINT "message_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_documents"
    ADD CONSTRAINT "order_documents_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_documents"
    ADD CONSTRAINT "order_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_form_1500"
    ADD CONSTRAINT "order_form_1500_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_form_1500"
    ADD CONSTRAINT "order_form_1500_physician_signed_by_fkey" FOREIGN KEY ("physician_signed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_form"
    ADD CONSTRAINT "order_form_locked_by_fkey" FOREIGN KEY ("locked_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_form"
    ADD CONSTRAINT "order_form_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_form"
    ADD CONSTRAINT "order_form_physician_signed_by_fkey" FOREIGN KEY ("physician_signed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_history"
    ADD CONSTRAINT "order_history_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_history"
    ADD CONSTRAINT "order_history_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_items"
    ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_ivr"
    ADD CONSTRAINT "order_ivr_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_ivr"
    ADD CONSTRAINT "order_ivr_physician_signed_by_fkey" FOREIGN KEY ("physician_signed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_messages"
    ADD CONSTRAINT "order_messages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_messages"
    ADD CONSTRAINT "order_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_assigned_provider_id_fkey" FOREIGN KEY ("assigned_provider_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_signed_by_fkey" FOREIGN KEY ("signed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."patients"
    ADD CONSTRAINT "patients_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."provider_credentials"
    ADD CONSTRAINT "provider_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rep_hierarchy"
    ADD CONSTRAINT "rep_hierarchy_child_rep_id_fkey" FOREIGN KEY ("child_rep_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rep_hierarchy"
    ADD CONSTRAINT "rep_hierarchy_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."rep_hierarchy"
    ADD CONSTRAINT "rep_hierarchy_parent_rep_id_fkey" FOREIGN KEY ("parent_rep_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_quotas"
    ADD CONSTRAINT "sales_quotas_rep_id_fkey" FOREIGN KEY ("rep_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sales_quotas"
    ADD CONSTRAINT "sales_quotas_set_by_fkey" FOREIGN KEY ("set_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;



CREATE POLICY "Authenticated users can view active contract materials" ON "public"."contract_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authenticated users can view active hospital onboarding materia" ON "public"."hospital_onboarding_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authenticated users can view active marketing materials" ON "public"."marketing_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authenticated users can view active training materials" ON "public"."training_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_all_activities" ON "public"."activities" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_commission_rates" ON "public"."commission_rates" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_commissions" ON "public"."commissions" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_contacts" ON "public"."contacts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_facilities" ON "public"."facilities" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_facility_members" ON "public"."facility_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_invite_tokens" ON "public"."invite_tokens" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_invoices" ON "public"."invoices" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_order_documents" ON "public"."order_documents" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_order_form" ON "public"."order_form" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_order_form_1500" ON "public"."order_form_1500" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_order_history" ON "public"."order_history" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_order_items" ON "public"."order_items" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_order_ivr" ON "public"."order_ivr" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_order_messages" ON "public"."order_messages" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_orders" ON "public"."orders" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_patients" ON "public"."patients" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_payments" ON "public"."payments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_payouts" ON "public"."payouts" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_provider_credentials" ON "public"."provider_credentials" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_rep_hierarchy" ON "public"."rep_hierarchy" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_sales_quotas" ON "public"."sales_quotas" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_shipments" ON "public"."shipments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_all_tasks" ON "public"."tasks" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_delete_contracts" ON "public"."contract_materials" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_delete_hospital_onboarding" ON "public"."hospital_onboarding_materials" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_delete_marketing" ON "public"."marketing_materials" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_delete_trainings" ON "public"."training_materials" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_enrollment" ON "public"."facility_enrollment" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_insert_contracts" ON "public"."contract_materials" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_insert_hospital_onboarding" ON "public"."hospital_onboarding_materials" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_insert_marketing" ON "public"."marketing_materials" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_insert_trainings" ON "public"."training_materials" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_select_all_contracts" ON "public"."contract_materials" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_select_all_hospital_onboarding" ON "public"."hospital_onboarding_materials" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_select_all_marketing" ON "public"."marketing_materials" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_select_all_trainings" ON "public"."training_materials" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_update_contracts" ON "public"."contract_materials" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_update_hospital_onboarding" ON "public"."hospital_onboarding_materials" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_update_marketing" ON "public"."marketing_materials" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "admin_update_trainings" ON "public"."training_materials" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "all_roles_insert_payments_approved" ON "public"."payments" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "payments"."order_id") AND ("o"."order_status" = 'approved'::"text")))) AND ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'support_staff'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "payments"."order_id") AND "public"."is_facility_member"("o"."facility_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."facilities" "f" ON (("f"."id" = "o"."facility_id")))
  WHERE (("o"."id" = "payments"."order_id") AND ("f"."facility_type" = 'clinic'::"text") AND ("f"."assigned_rep" IN ( WITH RECURSIVE "rep_tree" AS (
                 SELECT "auth"."uid"() AS "id"
                UNION ALL
                 SELECT "rh"."child_rep_id"
                   FROM ("public"."rep_hierarchy" "rh"
                     JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
                )
         SELECT "rep_tree"."id"
           FROM "rep_tree"))))))));



CREATE POLICY "all_roles_select_payments" ON "public"."payments" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'support_staff'::"text"]))))) OR (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "payments"."order_id") AND "public"."is_facility_member"("o"."facility_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."facilities" "f" ON (("f"."id" = "o"."facility_id")))
  WHERE (("o"."id" = "payments"."order_id") AND ("f"."facility_type" = 'clinic'::"text") AND ("f"."assigned_rep" IN ( WITH RECURSIVE "rep_tree" AS (
                 SELECT "auth"."uid"() AS "id"
                UNION ALL
                 SELECT "rh"."child_rep_id"
                   FROM ("public"."rep_hierarchy" "rh"
                     JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
                )
         SELECT "rep_tree"."id"
           FROM "rep_tree")))))));



CREATE POLICY "all_roles_update_payment_status_approved" ON "public"."orders" FOR UPDATE USING ((("order_status" = 'approved'::"text") AND ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"text", 'support_staff'::"text"]))))) OR "public"."is_facility_member"("facility_id") OR (EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "orders"."facility_id") AND ("f"."facility_type" = 'clinic'::"text") AND ("f"."assigned_rep" IN ( WITH RECURSIVE "rep_tree" AS (
                 SELECT "auth"."uid"() AS "id"
                UNION ALL
                 SELECT "rh"."child_rep_id"
                   FROM ("public"."rep_hierarchy" "rh"
                     JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
                )
         SELECT "rep_tree"."id"
           FROM "rep_tree")))))))) WITH CHECK (true);



CREATE POLICY "authenticated_read_all_profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "clinic_member_all_order_form_1500" ON "public"."order_form_1500" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_form_1500"."order_id") AND "public"."is_facility_member"("o"."facility_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_form_1500"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_all_order_ivr" ON "public"."order_ivr" USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_ivr"."order_id") AND "public"."is_facility_member"("o"."facility_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_ivr"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_delete_draft_orders" ON "public"."orders" FOR DELETE USING (("public"."is_facility_member"("facility_id") AND ("order_status" = 'draft'::"text") AND ("payment_status" <> ALL (ARRAY['paid'::"text", 'refunded'::"text", 'partially_refunded'::"text"]))));



CREATE POLICY "clinic_member_delete_order_documents" ON "public"."order_documents" FOR DELETE USING ((("uploaded_by" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text"))))));



CREATE POLICY "clinic_member_delete_order_items" ON "public"."order_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND "public"."is_facility_member"("o"."facility_id") AND ("o"."order_status" = 'draft'::"text")))));



CREATE POLICY "clinic_member_insert_order_documents" ON "public"."order_documents" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_documents"."order_id") AND "public"."is_facility_member"("o"."facility_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['clinical_provider'::"text", 'clinical_staff'::"text"])))))));



CREATE POLICY "clinic_member_insert_order_form" ON "public"."order_form" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_form"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_insert_order_history" ON "public"."order_history" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_history"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_insert_order_items" ON "public"."order_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND "public"."is_facility_member"("o"."facility_id") AND ("o"."order_status" = 'draft'::"text")))));



CREATE POLICY "clinic_member_insert_order_messages" ON "public"."order_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_messages"."order_id") AND "public"."is_facility_member"("o"."facility_id"))))));



CREATE POLICY "clinic_member_insert_orders" ON "public"."orders" FOR INSERT WITH CHECK (("public"."is_facility_member"("facility_id") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['clinical_provider'::"text", 'clinical_staff'::"text"])))))));



CREATE POLICY "clinic_member_insert_patients" ON "public"."patients" FOR INSERT WITH CHECK (("public"."is_facility_member"("facility_id") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['clinical_provider'::"text", 'clinical_staff'::"text"])))))));



CREATE POLICY "clinic_member_select_invoices" ON "public"."invoices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "invoices"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_select_order_documents" ON "public"."order_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_documents"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_select_order_form" ON "public"."order_form" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_form"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_select_order_history" ON "public"."order_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_history"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_select_order_items" ON "public"."order_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_select_order_messages" ON "public"."order_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_messages"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_select_orders" ON "public"."orders" FOR SELECT USING ("public"."is_facility_member"("facility_id"));



CREATE POLICY "clinic_member_select_own_facility" ON "public"."facilities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."facility_members" "fm"
  WHERE (("fm"."facility_id" = "facilities"."id") AND ("fm"."user_id" = "auth"."uid"())))));



CREATE POLICY "clinic_member_select_patients" ON "public"."patients" FOR SELECT USING ("public"."is_facility_member"("facility_id"));



CREATE POLICY "clinic_member_select_shipments" ON "public"."shipments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "shipments"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_update_additional_info_orders" ON "public"."orders" FOR UPDATE USING (("public"."is_facility_member"("facility_id") AND ("order_status" = 'additional_info_needed'::"text"))) WITH CHECK ("public"."is_facility_member"("facility_id"));



CREATE POLICY "clinic_member_update_draft_orders" ON "public"."orders" FOR UPDATE USING (("public"."is_facility_member"("facility_id") AND ("order_status" = 'draft'::"text"))) WITH CHECK ("public"."is_facility_member"("facility_id"));



CREATE POLICY "clinic_member_update_order_form" ON "public"."order_form" FOR UPDATE USING ((("is_locked" = false) AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_form"."order_id") AND "public"."is_facility_member"("o"."facility_id")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_form"."order_id") AND "public"."is_facility_member"("o"."facility_id")))));



CREATE POLICY "clinic_member_update_order_items" ON "public"."order_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND "public"."is_facility_member"("o"."facility_id") AND ("o"."order_status" = 'draft'::"text")))));



CREATE POLICY "clinic_member_update_patients" ON "public"."patients" FOR UPDATE USING ("public"."is_facility_member"("facility_id"));



CREATE POLICY "clinic_member_update_pending_orders" ON "public"."orders" FOR UPDATE USING (("public"."is_facility_member"("facility_id") AND ("order_status" = 'pending_signature'::"text"))) WITH CHECK ("public"."is_facility_member"("facility_id"));



CREATE POLICY "clinical_provider_read_own_facility_contacts" ON "public"."contacts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("f"."id" = "contacts"."facility_id") AND ("p"."role" = 'clinical_provider'::"text") AND ("f"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."commission_rates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."commissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contract_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facilities_insert_own" ON "public"."facilities" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "facilities_select_own" ON "public"."facilities" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "facilities_update_own" ON "public"."facilities" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."facility_enrollment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facility_members_read_credentials" ON "public"."provider_credentials" FOR SELECT TO "authenticated" USING (("user_id" IN ( SELECT "fm"."user_id"
   FROM "public"."facility_members" "fm"
  WHERE ("fm"."facility_id" IN ( SELECT "fm2"."facility_id"
           FROM "public"."facility_members" "fm2"
          WHERE ("fm2"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "facility_owner_enrollment" ON "public"."facility_enrollment" USING ((("facility_id" IN ( SELECT "facilities"."id"
   FROM "public"."facilities"
  WHERE ("facilities"."user_id" = "auth"."uid"()))) OR ("facility_id" IN ( SELECT "facility_members"."facility_id"
   FROM "public"."facility_members"
  WHERE ("facility_members"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."hospital_onboarding_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invite_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members_see_same_facility" ON "public"."facility_members" FOR SELECT TO "authenticated" USING (("facility_id" IN ( SELECT "f"."facility_id"
   FROM "public"."get_user_facility_ids"(( SELECT "auth"."uid"() AS "uid")) "f"("facility_id"))));



ALTER TABLE "public"."message_reads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "message_reads_admin_all" ON "public"."message_reads" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "message_reads_insert_own" ON "public"."message_reads" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "message_reads_select_own" ON "public"."message_reads" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_admin_all" ON "public"."notifications" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"text")))));



CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "notifications_service_insert" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "notifications_update_own" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."order_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_form" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_form_1500" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_ivr" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own_credentials_insert" ON "public"."provider_credentials" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own_credentials_select" ON "public"."provider_credentials" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own_credentials_update" ON "public"."provider_credentials" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own_membership" ON "public"."facility_members" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "own_message_delete" ON "public"."order_messages" FOR DELETE USING (("sender_id" = "auth"."uid"()));



ALTER TABLE "public"."patients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_delete_authenticated" ON "public"."products" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "products_insert_authenticated" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "products_select_all_authenticated" ON "public"."products" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "products_update_authenticated" ON "public"."products" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."provider_credentials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "public_read_token_by_value" ON "public"."invite_tokens" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "rep_contacts_assigned_facilities" ON "public"."contacts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("f"."id" = "contacts"."facility_id") AND ("p"."role" = 'sales_representative'::"text") AND ("f"."assigned_rep" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("f"."id" = "contacts"."facility_id") AND ("p"."role" = 'sales_representative'::"text") AND ("f"."assigned_rep" = "auth"."uid"())))));



CREATE POLICY "rep_create_subrep" ON "public"."rep_hierarchy" FOR INSERT TO "authenticated" WITH CHECK ((("parent_rep_id" = ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'sales_representative'::"text"))))));



ALTER TABLE "public"."rep_hierarchy" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rep_insert_order_messages" ON "public"."order_messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text"))))));



CREATE POLICY "rep_manage_sub_rep_rates" ON "public"."commission_rates" USING ((("set_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."rep_hierarchy"
  WHERE (("rep_hierarchy"."parent_rep_id" = "auth"."uid"()) AND ("rep_hierarchy"."child_rep_id" = "commission_rates"."rep_id")))))) WITH CHECK ((("set_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."rep_hierarchy"
  WHERE (("rep_hierarchy"."parent_rep_id" = "auth"."uid"()) AND ("rep_hierarchy"."child_rep_id" = "commission_rates"."rep_id"))))));



CREATE POLICY "rep_or_provider_own_invite_tokens" ON "public"."invite_tokens" USING (("created_by" = "auth"."uid"())) WITH CHECK ((("created_by" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['sales_representative'::"text", 'clinical_provider'::"text"])))))));



CREATE POLICY "rep_own_hierarchy" ON "public"."rep_hierarchy" FOR SELECT TO "authenticated" USING ((("parent_rep_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("child_rep_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "rep_own_tasks" ON "public"."tasks" TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'sales_representative'::"text")))) AND (("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"())))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."role" = 'sales_representative'::"text")))) AND (("assigned_to" = "auth"."uid"()) OR ("created_by" = "auth"."uid"()))));



CREATE POLICY "rep_read_hierarchy_activities" ON "public"."activities" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))) AND ("facility_id" IN ( WITH RECURSIVE "rep_tree" AS (
         SELECT "auth"."uid"() AS "id"
        UNION ALL
         SELECT "rh"."child_rep_id"
           FROM ("public"."rep_hierarchy" "rh"
             JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
        )
 SELECT "f"."id"
   FROM "public"."facilities" "f"
  WHERE (("f"."assigned_rep" IN ( SELECT "rep_tree"."id"
           FROM "rep_tree")) AND ("f"."facility_type" = 'clinic'::"text"))))));



CREATE POLICY "rep_read_hierarchy_order_documents" ON "public"."order_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."facilities" "f" ON (("f"."id" = "o"."facility_id")))
  WHERE (("o"."id" = "order_documents"."order_id") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text"))))))));



CREATE POLICY "rep_read_hierarchy_order_history" ON "public"."order_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."facilities" "f" ON (("f"."id" = "o"."facility_id")))
  WHERE (("o"."id" = "order_history"."order_id") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text"))))))));



CREATE POLICY "rep_read_hierarchy_order_items" ON "public"."order_items" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))) AND (EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_items"."order_id") AND ("o"."facility_id" IN ( WITH RECURSIVE "rep_tree" AS (
                 SELECT "auth"."uid"() AS "id"
                UNION ALL
                 SELECT "rh"."child_rep_id"
                   FROM ("public"."rep_hierarchy" "rh"
                     JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
                )
         SELECT "f"."id"
           FROM "public"."facilities" "f"
          WHERE (("f"."assigned_rep" IN ( SELECT "rep_tree"."id"
                   FROM "rep_tree")) AND ("f"."facility_type" = 'clinic'::"text")))))))));



CREATE POLICY "rep_read_hierarchy_orders" ON "public"."orders" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))) AND ("facility_id" IN ( WITH RECURSIVE "rep_tree" AS (
         SELECT "auth"."uid"() AS "id"
        UNION ALL
         SELECT "rh"."child_rep_id"
           FROM ("public"."rep_hierarchy" "rh"
             JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
        )
 SELECT "f"."id"
   FROM "public"."facilities" "f"
  WHERE (("f"."assigned_rep" IN ( SELECT "rep_tree"."id"
           FROM "rep_tree")) AND ("f"."facility_type" = 'clinic'::"text"))))));



CREATE POLICY "rep_read_hierarchy_patients" ON "public"."patients" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))) AND ("facility_id" IN ( WITH RECURSIVE "rep_tree" AS (
         SELECT "auth"."uid"() AS "id"
        UNION ALL
         SELECT "rh"."child_rep_id"
           FROM ("public"."rep_hierarchy" "rh"
             JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
        )
 SELECT "f"."id"
   FROM "public"."facilities" "f"
  WHERE (("f"."assigned_rep" IN ( SELECT "rep_tree"."id"
           FROM "rep_tree")) AND ("f"."facility_type" = 'clinic'::"text"))))));



CREATE POLICY "rep_read_order_form" ON "public"."order_form" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))));



CREATE POLICY "rep_read_order_form_1500" ON "public"."order_form_1500" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."orders" "o"
  WHERE (("o"."id" = "order_form_1500"."order_id") AND (EXISTS ( SELECT 1
           FROM "public"."profiles"
          WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text"))))))));



CREATE POLICY "rep_read_order_ivr" ON "public"."order_ivr" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))));



CREATE POLICY "rep_read_own_commission_rates" ON "public"."commission_rates" FOR SELECT USING ((("rep_id" = "auth"."uid"()) OR ("set_by" = "auth"."uid"())));



CREATE POLICY "rep_read_own_commissions" ON "public"."commissions" FOR SELECT USING (("rep_id" = "auth"."uid"()));



CREATE POLICY "rep_read_own_payouts" ON "public"."payouts" FOR SELECT USING (("rep_id" = "auth"."uid"()));



CREATE POLICY "rep_read_own_quota" ON "public"."sales_quotas" FOR SELECT USING (("rep_id" = "auth"."uid"()));



CREATE POLICY "rep_sees_hierarchy_facilities" ON "public"."facilities" FOR SELECT USING ((("facility_type" = 'clinic'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))) AND ("assigned_rep" IN ( WITH RECURSIVE "rep_tree" AS (
         SELECT "auth"."uid"() AS "id"
        UNION ALL
         SELECT "rh"."child_rep_id"
           FROM ("public"."rep_hierarchy" "rh"
             JOIN "rep_tree" "rt" ON (("rt"."id" = "rh"."parent_rep_id")))
        )
 SELECT "rep_tree"."id"
   FROM "rep_tree"))));



CREATE POLICY "rep_select_order_messages" ON "public"."order_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'sales_representative'::"text")))));



CREATE POLICY "rep_update_child_status" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."rep_hierarchy"
  WHERE (("rep_hierarchy"."parent_rep_id" = "auth"."uid"()) AND ("rep_hierarchy"."child_rep_id" = "profiles"."id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."rep_hierarchy"
  WHERE (("rep_hierarchy"."parent_rep_id" = "auth"."uid"()) AND ("rep_hierarchy"."child_rep_id" = "profiles"."id")))));



CREATE POLICY "rep_write_assigned_activities" ON "public"."activities" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("f"."id" = "activities"."facility_id") AND ("p"."role" = 'sales_representative'::"text") AND ("f"."assigned_rep" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("f"."id" = "activities"."facility_id") AND ("p"."role" = 'sales_representative'::"text") AND ("f"."assigned_rep" = "auth"."uid"())))));



ALTER TABLE "public"."sales_quotas" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "support_all_order_ivr" ON "public"."order_ivr" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_insert_order_form_1500" ON "public"."order_form_1500" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_insert_order_messages" ON "public"."order_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text"))))));



CREATE POLICY "support_read_order_documents" ON "public"."order_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_read_order_form" ON "public"."order_form" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_read_order_form_1500" ON "public"."order_form_1500" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_select_order_messages" ON "public"."order_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_all_payments" ON "public"."payments" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_read_all_activities" ON "public"."activities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_read_all_contacts" ON "public"."contacts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_read_all_facilities" ON "public"."facilities" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_read_all_facility_members" ON "public"."facility_members" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_read_all_orders" ON "public"."orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_read_all_patients" ON "public"."patients" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_select_invoices" ON "public"."invoices" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_staff_update_mfr_review_orders" ON "public"."orders" FOR UPDATE USING ((("order_status" = ANY (ARRAY['manufacturer_review'::"text", 'additional_info_needed'::"text", 'approved'::"text", 'shipped'::"text"])) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



CREATE POLICY "support_update_order_form" ON "public"."order_form" FOR UPDATE USING ((("is_locked" = false) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text"))))));



CREATE POLICY "support_update_order_form_1500" ON "public"."order_form_1500" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'support_staff'::"text")))));



ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_materials" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."invoices";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_form";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."order_messages";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."orders";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."payments";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."get_unread_message_counts"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_unread_message_counts"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_unread_message_counts"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_facility_ids"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_facility_ids"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_facility_ids"("user_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_login"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_login"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_login"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hash_pin"("input_pin" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."hash_pin"("input_pin" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hash_pin"("input_pin" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_facility_member"("p_facility_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_facility_member"("p_facility_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_facility_member"("p_facility_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_rep_facility"("p_rep_id" "uuid", "p_facility_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_rep_facility"("p_rep_id" "uuid", "p_facility_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_rep_facility"("p_rep_id" "uuid", "p_facility_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."verify_pin"("input_pin" "text", "stored_hash" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."verify_pin"("input_pin" "text", "stored_hash" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."verify_pin"("input_pin" "text", "stored_hash" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."commission_rates" TO "anon";
GRANT ALL ON TABLE "public"."commission_rates" TO "authenticated";
GRANT ALL ON TABLE "public"."commission_rates" TO "service_role";



GRANT ALL ON TABLE "public"."commissions" TO "anon";
GRANT ALL ON TABLE "public"."commissions" TO "authenticated";
GRANT ALL ON TABLE "public"."commissions" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."contract_materials" TO "anon";
GRANT ALL ON TABLE "public"."contract_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_materials" TO "service_role";



GRANT ALL ON TABLE "public"."facilities" TO "anon";
GRANT ALL ON TABLE "public"."facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."facilities" TO "service_role";



GRANT ALL ON TABLE "public"."facility_enrollment" TO "anon";
GRANT ALL ON TABLE "public"."facility_enrollment" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_enrollment" TO "service_role";



GRANT ALL ON TABLE "public"."facility_members" TO "anon";
GRANT ALL ON TABLE "public"."facility_members" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_members" TO "service_role";



GRANT ALL ON TABLE "public"."hospital_onboarding_materials" TO "anon";
GRANT ALL ON TABLE "public"."hospital_onboarding_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."hospital_onboarding_materials" TO "service_role";



GRANT ALL ON TABLE "public"."invite_tokens" TO "anon";
GRANT ALL ON TABLE "public"."invite_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."invite_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_materials" TO "anon";
GRANT ALL ON TABLE "public"."marketing_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_materials" TO "service_role";



GRANT ALL ON TABLE "public"."message_reads" TO "anon";
GRANT ALL ON TABLE "public"."message_reads" TO "authenticated";
GRANT ALL ON TABLE "public"."message_reads" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."order_documents" TO "anon";
GRANT ALL ON TABLE "public"."order_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."order_documents" TO "service_role";



GRANT ALL ON TABLE "public"."order_form" TO "anon";
GRANT ALL ON TABLE "public"."order_form" TO "authenticated";
GRANT ALL ON TABLE "public"."order_form" TO "service_role";



GRANT ALL ON TABLE "public"."order_form_1500" TO "anon";
GRANT ALL ON TABLE "public"."order_form_1500" TO "authenticated";
GRANT ALL ON TABLE "public"."order_form_1500" TO "service_role";



GRANT ALL ON TABLE "public"."order_history" TO "anon";
GRANT ALL ON TABLE "public"."order_history" TO "authenticated";
GRANT ALL ON TABLE "public"."order_history" TO "service_role";



GRANT ALL ON TABLE "public"."order_items" TO "anon";
GRANT ALL ON TABLE "public"."order_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_ivr" TO "anon";
GRANT ALL ON TABLE "public"."order_ivr" TO "authenticated";
GRANT ALL ON TABLE "public"."order_ivr" TO "service_role";



GRANT ALL ON TABLE "public"."order_messages" TO "anon";
GRANT ALL ON TABLE "public"."order_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."order_messages" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."patients" TO "anon";
GRANT ALL ON TABLE "public"."patients" TO "authenticated";
GRANT ALL ON TABLE "public"."patients" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."payouts" TO "anon";
GRANT ALL ON TABLE "public"."payouts" TO "authenticated";
GRANT ALL ON TABLE "public"."payouts" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."provider_credentials" TO "anon";
GRANT ALL ON TABLE "public"."provider_credentials" TO "authenticated";
GRANT ALL ON TABLE "public"."provider_credentials" TO "service_role";



GRANT ALL ON TABLE "public"."rep_hierarchy" TO "anon";
GRANT ALL ON TABLE "public"."rep_hierarchy" TO "authenticated";
GRANT ALL ON TABLE "public"."rep_hierarchy" TO "service_role";



GRANT ALL ON TABLE "public"."sales_quotas" TO "anon";
GRANT ALL ON TABLE "public"."sales_quotas" TO "authenticated";
GRANT ALL ON TABLE "public"."sales_quotas" TO "service_role";



GRANT ALL ON TABLE "public"."shipments" TO "anon";
GRANT ALL ON TABLE "public"."shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."shipments" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."training_materials" TO "anon";
GRANT ALL ON TABLE "public"."training_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."training_materials" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































