


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
begin
  new.updated_at = now();
  return new;
end;

$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    CONSTRAINT "facilities_address_line_1_not_blank" CHECK (("btrim"("address_line_1") <> ''::"text")),
    CONSTRAINT "facilities_city_not_blank" CHECK (("btrim"("city") <> ''::"text")),
    CONSTRAINT "facilities_contact_not_blank" CHECK (("btrim"("contact") <> ''::"text")),
    CONSTRAINT "facilities_country_iso2_check" CHECK (("country" ~ '^[A-Z]{2}$'::"text")),
    CONSTRAINT "facilities_name_not_blank" CHECK (("btrim"("name") <> ''::"text")),
    CONSTRAINT "facilities_phone_e164_check" CHECK (("phone" ~ '^\+[1-9][0-9]{7,14}$'::"text")),
    CONSTRAINT "facilities_postal_code_not_blank" CHECK (("btrim"("postal_code") <> ''::"text")),
    CONSTRAINT "facilities_state_not_blank" CHECK (("btrim"("state") <> ''::"text")),
    CONSTRAINT "facilities_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text"])))
);


ALTER TABLE "public"."facilities" OWNER TO "postgres";


COMMENT ON TABLE "public"."facilities" IS 'Exactly one facility per user account. Enforced by unique(user_id).';



COMMENT ON COLUMN "public"."facilities"."user_id" IS '1:1 owner link to public.profiles(id).';



COMMENT ON COLUMN "public"."facilities"."phone" IS 'Facility phone in E.164 format, e.g. +15550000000';



COMMENT ON COLUMN "public"."facilities"."country" IS 'Two-letter ISO country code, e.g. US, PH.';



COMMENT ON COLUMN "public"."facilities"."stripe_customer_id" IS 'Stripe customer id associated with this facility/account for checkout and invoicing.';



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
    CONSTRAINT "invoices_amount_due_non_negative" CHECK (("amount_due" >= (0)::numeric)),
    CONSTRAINT "invoices_amount_paid_lte_amount_due" CHECK (("amount_paid" <= "amount_due")),
    CONSTRAINT "invoices_amount_paid_non_negative" CHECK (("amount_paid" >= (0)::numeric)),
    CONSTRAINT "invoices_currency_iso3_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "invoices_invoice_number_not_blank" CHECK (("btrim"("invoice_number") <> ''::"text")),
    CONSTRAINT "invoices_provider_not_blank" CHECK (("btrim"("provider") <> ''::"text")),
    CONSTRAINT "invoices_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'issued'::"text", 'sent'::"text", 'partially_paid'::"text", 'paid'::"text", 'overdue'::"text", 'void'::"text"])))
);


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


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_number" "text" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "product_sku" "text" NOT NULL,
    "quantity" integer DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "shipping_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "tax_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "subtotal" numeric(12,2) GENERATED ALWAYS AS ((("quantity")::numeric * "unit_price")) STORED,
    "total_amount" numeric(12,2) GENERATED ALWAYS AS ((((("quantity")::numeric * "unit_price") + "shipping_amount") + "tax_amount")) STORED,
    "payment_method" "text" NOT NULL,
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
    CONSTRAINT "orders_delivery_status_check" CHECK (("delivery_status" = ANY (ARRAY['not_shipped'::"text", 'label_created'::"text", 'in_transit'::"text", 'delivered'::"text", 'returned'::"text", 'exception'::"text", 'canceled'::"text"]))),
    CONSTRAINT "orders_fulfillment_status_check" CHECK (("fulfillment_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'fulfilled'::"text", 'canceled'::"text"]))),
    CONSTRAINT "orders_invoice_status_check" CHECK (("invoice_status" = ANY (ARRAY['not_applicable'::"text", 'draft'::"text", 'issued'::"text", 'sent'::"text", 'partially_paid'::"text", 'paid'::"text", 'overdue'::"text", 'void'::"text"]))),
    CONSTRAINT "orders_order_number_not_blank" CHECK (("btrim"("order_number") <> ''::"text")),
    CONSTRAINT "orders_payment_method_check" CHECK (("payment_method" = ANY (ARRAY['pay_now'::"text", 'net_30'::"text"]))),
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'partially_refunded'::"text", 'canceled'::"text"]))),
    CONSTRAINT "orders_product_name_not_blank" CHECK (("btrim"("product_name") <> ''::"text")),
    CONSTRAINT "orders_product_sku_not_blank" CHECK (("btrim"("product_sku") <> ''::"text")),
    CONSTRAINT "orders_quantity_positive" CHECK (("quantity" > 0)),
    CONSTRAINT "orders_shipping_amount_non_negative" CHECK (("shipping_amount" >= (0)::numeric)),
    CONSTRAINT "orders_tax_amount_non_negative" CHECK (("tax_amount" >= (0)::numeric)),
    CONSTRAINT "orders_unit_price_non_negative" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


COMMENT ON TABLE "public"."orders" IS 'Commerce order table. Each row represents one purchased product and quantity for one facility.';



COMMENT ON COLUMN "public"."orders"."product_name" IS 'Snapshot of product name at time of order creation.';



COMMENT ON COLUMN "public"."orders"."product_sku" IS 'Snapshot of product SKU at time of order creation.';



COMMENT ON COLUMN "public"."orders"."unit_price" IS 'Snapshot of unit price at time of order creation.';



COMMENT ON COLUMN "public"."orders"."payment_method" IS 'Checkout method: pay_now or net_30.';



COMMENT ON COLUMN "public"."orders"."payment_status" IS 'Summary payment state for UI and workflow handling.';



COMMENT ON COLUMN "public"."orders"."invoice_status" IS 'Summary invoice state for net-30 flow.';



COMMENT ON COLUMN "public"."orders"."fulfillment_status" IS 'Internal fulfillment status before/after shipping.';



COMMENT ON COLUMN "public"."orders"."delivery_status" IS 'Shipment delivery state mirrored for UI convenience.';



COMMENT ON COLUMN "public"."orders"."tracking_number" IS 'Current tracking number summary mirrored from shipments when available.';



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
    CONSTRAINT "payments_amount_non_negative" CHECK (("amount" >= (0)::numeric)),
    CONSTRAINT "payments_currency_iso3_check" CHECK (("currency" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "payments_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['checkout'::"text", 'invoice'::"text", 'manual'::"text"]))),
    CONSTRAINT "payments_provider_not_blank" CHECK (("btrim"("provider") <> ''::"text")),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'paid'::"text", 'failed'::"text", 'refunded'::"text", 'partially_refunded'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


COMMENT ON TABLE "public"."payments" IS 'Payment records linked to orders, including Stripe checkout and invoice payment events.';



COMMENT ON COLUMN "public"."payments"."provider" IS 'Payment provider, e.g. stripe, invoice, manual.';



COMMENT ON COLUMN "public"."payments"."payment_type" IS 'Payment source type: checkout, invoice, or manual.';



COMMENT ON COLUMN "public"."payments"."stripe_checkout_session_id" IS 'Stripe Checkout Session id when payment_method is pay_now.';



COMMENT ON COLUMN "public"."payments"."stripe_payment_intent_id" IS 'Stripe Payment Intent id when available.';



COMMENT ON COLUMN "public"."payments"."provider_payment_id" IS 'External provider payment id when applicable.';



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
    CONSTRAINT "profiles_first_name_not_blank" CHECK (("btrim"("first_name") <> ''::"text")),
    CONSTRAINT "profiles_last_name_not_blank" CHECK (("btrim"("last_name") <> ''::"text")),
    CONSTRAINT "profiles_phone_e164_check" CHECK ((("phone" IS NULL) OR ("phone" ~ '^\+[1-9][0-9]{7,14}$'::"text"))),
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['sales_representative'::"text", 'doctor'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."profiles" IS 'Application profile for each auth user. Exactly one profile per auth.users row.';



COMMENT ON COLUMN "public"."profiles"."phone" IS 'User phone in E.164 format, e.g. +639310259241';



COMMENT ON COLUMN "public"."profiles"."role" IS 'Application role: sales_representative or doctor';



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


ALTER TABLE ONLY "public"."contract_materials"
    ADD CONSTRAINT "contract_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."hospital_onboarding_materials"
    ADD CONSTRAINT "hospital_onboarding_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."marketing_materials"
    ADD CONSTRAINT "marketing_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."training_materials"
    ADD CONSTRAINT "training_materials_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "contract_materials_bucket_file_path_key" ON "public"."contract_materials" USING "btree" ("bucket", "file_path");



CREATE UNIQUE INDEX "facilities_stripe_customer_id_uidx" ON "public"."facilities" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "facilities_user_id_idx" ON "public"."facilities" USING "btree" ("user_id");



CREATE UNIQUE INDEX "hospital_onboarding_materials_bucket_file_path_key" ON "public"."hospital_onboarding_materials" USING "btree" ("bucket", "file_path");



CREATE INDEX "idx_contract_materials_created_at" ON "public"."contract_materials" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contract_materials_is_active" ON "public"."contract_materials" USING "btree" ("is_active");



CREATE INDEX "idx_contract_materials_sort_order" ON "public"."contract_materials" USING "btree" ("sort_order");



CREATE INDEX "idx_contract_materials_tag" ON "public"."contract_materials" USING "btree" ("tag");



CREATE INDEX "idx_hospital_onboarding_materials_created_at" ON "public"."hospital_onboarding_materials" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_hospital_onboarding_materials_is_active" ON "public"."hospital_onboarding_materials" USING "btree" ("is_active");



CREATE INDEX "idx_hospital_onboarding_materials_sort_order" ON "public"."hospital_onboarding_materials" USING "btree" ("sort_order");



CREATE INDEX "idx_hospital_onboarding_materials_tag" ON "public"."hospital_onboarding_materials" USING "btree" ("tag");



CREATE INDEX "idx_training_materials_created_at" ON "public"."training_materials" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_training_materials_is_active" ON "public"."training_materials" USING "btree" ("is_active");



CREATE INDEX "idx_training_materials_sort_order" ON "public"."training_materials" USING "btree" ("sort_order");



CREATE INDEX "idx_training_materials_tag" ON "public"."training_materials" USING "btree" ("tag");



CREATE INDEX "invoices_due_at_idx" ON "public"."invoices" USING "btree" ("due_at");



CREATE UNIQUE INDEX "invoices_invoice_number_lower_uidx" ON "public"."invoices" USING "btree" ("lower"("invoice_number"));



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



CREATE INDEX "orders_payment_method_idx" ON "public"."orders" USING "btree" ("payment_method");



CREATE INDEX "orders_payment_status_idx" ON "public"."orders" USING "btree" ("payment_status");



CREATE INDEX "orders_placed_at_idx" ON "public"."orders" USING "btree" ("placed_at" DESC);



CREATE INDEX "orders_product_id_idx" ON "public"."orders" USING "btree" ("product_id");



CREATE INDEX "payments_created_at_idx" ON "public"."payments" USING "btree" ("created_at" DESC);



CREATE INDEX "payments_order_id_idx" ON "public"."payments" USING "btree" ("order_id");



CREATE INDEX "payments_paid_at_idx" ON "public"."payments" USING "btree" ("paid_at");



CREATE UNIQUE INDEX "payments_provider_payment_id_uidx" ON "public"."payments" USING "btree" ("provider_payment_id") WHERE ("provider_payment_id" IS NOT NULL);



CREATE INDEX "payments_status_idx" ON "public"."payments" USING "btree" ("status");



CREATE UNIQUE INDEX "payments_stripe_checkout_session_id_uidx" ON "public"."payments" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_uidx" ON "public"."payments" USING "btree" ("stripe_payment_intent_id") WHERE ("stripe_payment_intent_id" IS NOT NULL);



CREATE INDEX "products_category_idx" ON "public"."products" USING "btree" ("category");



CREATE INDEX "products_is_active_idx" ON "public"."products" USING "btree" ("is_active");



CREATE UNIQUE INDEX "products_sku_lower_uidx" ON "public"."products" USING "btree" ("lower"("sku"));



CREATE INDEX "products_sort_order_idx" ON "public"."products" USING "btree" ("sort_order");



CREATE UNIQUE INDEX "profiles_email_lower_uidx" ON "public"."profiles" USING "btree" ("lower"("email"));



CREATE INDEX "shipments_delivered_at_idx" ON "public"."shipments" USING "btree" ("delivered_at");



CREATE UNIQUE INDEX "shipments_order_id_uidx" ON "public"."shipments" USING "btree" ("order_id");



CREATE UNIQUE INDEX "shipments_shipstation_order_id_uidx" ON "public"."shipments" USING "btree" ("shipstation_order_id") WHERE ("shipstation_order_id" IS NOT NULL);



CREATE UNIQUE INDEX "shipments_shipstation_shipment_id_uidx" ON "public"."shipments" USING "btree" ("shipstation_shipment_id") WHERE ("shipstation_shipment_id" IS NOT NULL);



CREATE INDEX "shipments_status_idx" ON "public"."shipments" USING "btree" ("status");



CREATE UNIQUE INDEX "shipments_tracking_number_uidx" ON "public"."shipments" USING "btree" ("tracking_number") WHERE ("tracking_number" IS NOT NULL);



CREATE UNIQUE INDEX "training_materials_bucket_file_path_key" ON "public"."training_materials" USING "btree" ("bucket", "file_path");



CREATE OR REPLACE TRIGGER "set_contract_materials_updated_at" BEFORE UPDATE ON "public"."contract_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_hospital_onboarding_materials_updated_at" BEFORE UPDATE ON "public"."hospital_onboarding_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "set_marketing_materials_updated_at" BEFORE UPDATE ON "public"."marketing_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "set_training_materials_updated_at" BEFORE UPDATE ON "public"."training_materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_row_updated_at"();



CREATE OR REPLACE TRIGGER "trg_facilities_set_updated_at" BEFORE UPDATE ON "public"."facilities" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_invoices_set_updated_at" BEFORE UPDATE ON "public"."invoices" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_orders_set_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_products_set_updated_at" BEFORE UPDATE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_shipments_set_updated_at" BEFORE UPDATE ON "public"."shipments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shipments"
    ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



CREATE POLICY "Authenticated users can view active contract materials" ON "public"."contract_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authenticated users can view active hospital onboarding materia" ON "public"."hospital_onboarding_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authenticated users can view active marketing materials" ON "public"."marketing_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Authenticated users can view active training materials" ON "public"."training_materials" FOR SELECT TO "authenticated" USING (("is_active" = true));



ALTER TABLE "public"."contract_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facilities_insert_own" ON "public"."facilities" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "facilities_select_own" ON "public"."facilities" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "facilities_update_own" ON "public"."facilities" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."hospital_onboarding_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "invoices_select_own" ON "public"."invoices" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."facilities" "f" ON (("f"."id" = "o"."facility_id")))
  WHERE (("o"."id" = "invoices"."order_id") AND ("f"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."marketing_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders_insert_own" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "orders"."facility_id") AND ("f"."user_id" = "auth"."uid"())))));



CREATE POLICY "orders_select_own" ON "public"."orders" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "orders"."facility_id") AND ("f"."user_id" = "auth"."uid"())))));



CREATE POLICY "orders_update_own" ON "public"."orders" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "orders"."facility_id") AND ("f"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "orders"."facility_id") AND ("f"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_select_own" ON "public"."payments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."facilities" "f" ON (("f"."id" = "o"."facility_id")))
  WHERE (("o"."id" = "payments"."order_id") AND ("f"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_delete_authenticated" ON "public"."products" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "products_insert_authenticated" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "products_select_all_authenticated" ON "public"."products" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "products_update_authenticated" ON "public"."products" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_own" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_own" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "profiles_update_own" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



ALTER TABLE "public"."shipments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "shipments_select_own" ON "public"."shipments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."orders" "o"
     JOIN "public"."facilities" "f" ON (("f"."id" = "o"."facility_id")))
  WHERE (("o"."id" = "shipments"."order_id") AND ("f"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."training_materials" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_row_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."contract_materials" TO "anon";
GRANT ALL ON TABLE "public"."contract_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_materials" TO "service_role";



GRANT ALL ON TABLE "public"."facilities" TO "anon";
GRANT ALL ON TABLE "public"."facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."facilities" TO "service_role";



GRANT ALL ON TABLE "public"."hospital_onboarding_materials" TO "anon";
GRANT ALL ON TABLE "public"."hospital_onboarding_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."hospital_onboarding_materials" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_materials" TO "anon";
GRANT ALL ON TABLE "public"."marketing_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_materials" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."shipments" TO "anon";
GRANT ALL ON TABLE "public"."shipments" TO "authenticated";
GRANT ALL ON TABLE "public"."shipments" TO "service_role";



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































