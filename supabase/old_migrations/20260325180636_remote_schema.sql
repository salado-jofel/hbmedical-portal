


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






CREATE OR REPLACE FUNCTION "public"."create_user_with_facility"("p_email" "text", "p_password" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_role" "text", "p_facility_name" "text", "p_facility_location" "text" DEFAULT NULL::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
DECLARE
  v_user_id     uuid;
  v_encrypted   text;
  v_result      json;
BEGIN

  -- ── 1. Check for existing email ───────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = p_email) THEN
    RETURN json_build_object('error', 'An account with this email already exists.');
  END IF;

  -- ── 2. Generate user ID ───────────────────────────────────────────────────
  v_user_id := gen_random_uuid();

  -- ── 3. Encrypt the password (Supabase uses bcrypt) ────────────────────────
  v_encrypted := crypt(p_password, gen_salt('bf'));

  -- ── 4. Insert into auth.users with email pre-verified ────────────────────
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,       -- ✅ marks email as verified immediately
    raw_user_meta_data,
    raw_app_meta_data,
    role,
    aud,
    created_at,
    updated_at,
    is_sso_user,
    is_anonymous
  )
  VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    p_email,
    v_encrypted,
    now(),                    -- ✅ email_confirmed_at = now() = verified
    jsonb_build_object(
      'first_name',  p_first_name,
      'last_name',   p_last_name,
      'full_name',   trim(p_first_name || ' ' || p_last_name),
      'role',        p_role,
      'phone',       p_phone
    ),
    jsonb_build_object(
      'provider',   'email',
      'providers',  ARRAY['email']
    ),
    'authenticated',
    'authenticated',
    now(),
    now(),
    false,
    false
  );

  -- ── 5. Insert identity record (required for email login to work) ──────────
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
  )
  VALUES (
    gen_random_uuid(),
    v_user_id,
    p_email,
    'email',
    jsonb_build_object(
      'sub',   v_user_id::text,
      'email', p_email
    ),
    now(),
    now(),
    now()
  );

  -- ── 6. Insert public profile ──────────────────────────────────────────────
  INSERT INTO public.profiles (
    id,
    email,
    name,
    first_name,
    last_name,
    phone,
    role
  )
  VALUES (
    v_user_id,
    p_email,
    trim(p_first_name || ' ' || p_last_name),
    p_first_name,
    p_last_name,
    p_phone,
    p_role
  );

  -- ── 7. Insert facility ────────────────────────────────────────────────────
  INSERT INTO public.facilities (
    name,
    location,
    user_id,
    status,
    qb_customer_id,
    qb_sync_token,
    qb_synced_at
  )
  VALUES (
    p_facility_name,
    p_facility_location,
    v_user_id,
    'Active',
    NULL,
    NULL,
    NULL
  );

  RETURN json_build_object('user_id', v_user_id, 'error', null);

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;

$$;


ALTER FUNCTION "public"."create_user_with_facility"("p_email" "text", "p_password" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_role" "text", "p_facility_name" "text", "p_facility_location" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'sales_representative')
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name  = EXCLUDED.last_name,
    phone      = EXCLUDED.phone,
    role       = EXCLUDED.role;
  RETURN NEW;
END;

$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."contracts_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text" NOT NULL,
    "tag" "text",
    "description" "text",
    "file_url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."contracts_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "status" "text" DEFAULT 'Active'::"text",
    "type" "text",
    "contact" "text",
    "phone" "text",
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_synced_at" timestamp with time zone,
    "address_line_1" "text",
    "address_line_2" "text",
    "city" "text",
    "state" "text",
    "postal_code" "text",
    "country" "text" DEFAULT 'US'::"text"
);


ALTER TABLE "public"."facilities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."facilities"."address_line_1" IS 'Primary shipping street address for ShipStation sync';



COMMENT ON COLUMN "public"."facilities"."address_line_2" IS 'Secondary shipping address line (suite, floor, etc.)';



COMMENT ON COLUMN "public"."facilities"."city" IS 'Shipping city for ShipStation sync';



COMMENT ON COLUMN "public"."facilities"."state" IS 'Shipping state or province for ShipStation sync';



COMMENT ON COLUMN "public"."facilities"."postal_code" IS 'Shipping postal code for ShipStation sync';



COMMENT ON COLUMN "public"."facilities"."country" IS 'Shipping country code for ShipStation sync, default US';



CREATE TABLE IF NOT EXISTS "public"."marketing_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text" NOT NULL,
    "tag" "text",
    "description" "text",
    "file_url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."marketing_materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "order_id" "text" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "product_id" "uuid" NOT NULL,
    "amount" numeric(10,2) DEFAULT 0.00,
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"(),
    "quantity" integer DEFAULT 1 NOT NULL,
    "payment_provider" "text" DEFAULT 'stripe'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "stripe_checkout_session_id" "text",
    "stripe_payment_intent_id" "text",
    "stripe_invoice_id" "text",
    "stripe_checkout_url" "text",
    "stripe_customer_id" "text",
    "paid_at" timestamp with time zone,
    "shipstation_sync_status" "text" DEFAULT 'not_sent'::"text",
    "shipstation_shipment_id" "text",
    "shipstation_fulfillment_id" "text",
    "tracking_number" "text",
    "carrier_code" "text",
    "shipped_at" timestamp with time zone,
    "delivered_at" timestamp with time zone,
    "shipstation_raw" "jsonb",
    "shipstation_order_id" "text",
    "shipstation_status" "text",
    "shipstation_label_url" "text",
    "receipt_email" "text",
    "stripe_receipt_url" "text",
    "receipt_email_sent_at" timestamp with time zone,
    "receipt_email_error" "text",
    "receipt_email_lock_id" "text",
    "payment_mode" "text",
    "stripe_invoice_number" "text",
    "stripe_invoice_status" "text",
    "stripe_invoice_hosted_url" "text",
    "invoice_due_date" timestamp with time zone,
    "invoice_sent_at" timestamp with time zone,
    "invoice_paid_at" timestamp with time zone,
    "invoice_amount_due" integer,
    "invoice_amount_remaining" integer,
    "invoice_email_sent_at" timestamp with time zone,
    "invoice_email_error" "text",
    "net30_last_reminder_stage" "text",
    "net30_last_reminder_sent_at" timestamp with time zone,
    "net30_reminder_count" integer DEFAULT 0 NOT NULL,
    "invoice_overdue_at" timestamp with time zone,
    "net30_reminder_email_error" "text",
    "net30_reminder_lock_id" "uuid",
    CONSTRAINT "orders_net30_last_reminder_stage_check" CHECK ((("net30_last_reminder_stage" IS NULL) OR ("net30_last_reminder_stage" = ANY (ARRAY['upcoming'::"text", 'tomorrow'::"text", 'due_today'::"text", 'overdue'::"text"])))),
    CONSTRAINT "orders_payment_mode_check" CHECK ((("payment_mode" = ANY (ARRAY['pay_now'::"text", 'net_30'::"text"])) OR ("payment_mode" IS NULL))),
    CONSTRAINT "orders_payment_provider_check" CHECK (("payment_provider" = ANY (ARRAY['stripe'::"text", 'legacy_qb'::"text"]))),
    CONSTRAINT "orders_payment_status_check" CHECK ((("payment_status" IS NULL) OR ("payment_status" = ANY (ARRAY['unpaid'::"text", 'invoice_sent'::"text", 'paid'::"text", 'overdue'::"text", 'payment_failed'::"text"]))))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "name" "text" NOT NULL,
    "price" numeric(10,2) DEFAULT 0.00
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "name" "text",
    "role" "text" DEFAULT 'sales_representative'::"text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "phone" "text" DEFAULT ''::"text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['sales_representative'::"text", 'doctor'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "stripe_object_id" "text",
    "checkout_session_id" "text",
    "order_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."training_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "title" "text" NOT NULL,
    "tag" "text",
    "description" "text",
    "file_url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0
);


ALTER TABLE "public"."training_materials" OWNER TO "postgres";


ALTER TABLE ONLY "public"."contracts_materials"
    ADD CONSTRAINT "contracts_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."marketing_materials"
    ADD CONSTRAINT "marketing_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("event_id");



ALTER TABLE ONLY "public"."training_materials"
    ADD CONSTRAINT "training_materials_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "facilities_stripe_customer_id_uidx" ON "public"."facilities" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "idx_orders_net30_due_date_open" ON "public"."orders" USING "btree" ("invoice_due_date") WHERE (("payment_mode" = 'net_30'::"text") AND ("stripe_invoice_id" IS NOT NULL) AND ("payment_status" = ANY (ARRAY['unpaid'::"text", 'invoice_sent'::"text", 'overdue'::"text", 'payment_failed'::"text"])));



CREATE INDEX "idx_orders_net30_invoice_status" ON "public"."orders" USING "btree" ("stripe_invoice_status");



CREATE INDEX "idx_orders_net30_last_reminder_stage" ON "public"."orders" USING "btree" ("net30_last_reminder_stage", "net30_last_reminder_sent_at") WHERE ("payment_mode" = 'net_30'::"text");



CREATE INDEX "idx_orders_net30_monitor" ON "public"."orders" USING "btree" ("payment_mode", "payment_status", "invoice_due_date");



CREATE INDEX "idx_orders_net30_reminder_lock_id" ON "public"."orders" USING "btree" ("net30_reminder_lock_id") WHERE ("net30_reminder_lock_id" IS NOT NULL);



CREATE INDEX "idx_orders_net30_user_id" ON "public"."orders" USING "btree" ("user_id");



CREATE INDEX "idx_orders_receipt_email_lock_id" ON "public"."orders" USING "btree" ("receipt_email_lock_id") WHERE ("receipt_email_lock_id" IS NOT NULL);



CREATE INDEX "orders_invoice_due_date_idx" ON "public"."orders" USING "btree" ("invoice_due_date");



CREATE INDEX "orders_payment_mode_idx" ON "public"."orders" USING "btree" ("payment_mode");



CREATE INDEX "orders_payment_provider_idx" ON "public"."orders" USING "btree" ("payment_provider");



CREATE INDEX "orders_payment_status_idx" ON "public"."orders" USING "btree" ("payment_status");



CREATE UNIQUE INDEX "orders_stripe_checkout_session_id_uidx" ON "public"."orders" USING "btree" ("stripe_checkout_session_id") WHERE ("stripe_checkout_session_id" IS NOT NULL);



CREATE INDEX "orders_stripe_invoice_id_idx" ON "public"."orders" USING "btree" ("stripe_invoice_id");



CREATE INDEX "orders_stripe_payment_intent_id_idx" ON "public"."orders" USING "btree" ("stripe_payment_intent_id");



CREATE INDEX "stripe_webhook_events_checkout_session_id_idx" ON "public"."stripe_webhook_events" USING "btree" ("checkout_session_id");



CREATE UNIQUE INDEX "stripe_webhook_events_event_type_object_id_uidx" ON "public"."stripe_webhook_events" USING "btree" ("event_type", "stripe_object_id") WHERE ("stripe_object_id" IS NOT NULL);



CREATE INDEX "stripe_webhook_events_order_id_idx" ON "public"."stripe_webhook_events" USING "btree" ("order_id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Auth users can manage facilities" ON "public"."facilities" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth users can manage orders" ON "public"."orders" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth users can manage products" ON "public"."products" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Auth users can read profiles" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view marketing materials" ON "public"."marketing_materials" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Contracts visible to authenticated users" ON "public"."contracts_materials" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Facilities are viewable by everyone" ON "public"."facilities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Facilities visible to authenticated users" ON "public"."facilities" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Products are viewable by everyone" ON "public"."products" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Products visible to authenticated users" ON "public"."products" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Training materials visible to authenticated users" ON "public"."training_materials" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create their own orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only insert their own orders" ON "public"."orders" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only see their own orders" ON "public"."orders" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can only update their own orders" ON "public"."orders" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."contracts_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facility: delete own" ON "public"."facilities" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "facility: insert own" ON "public"."facilities" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "facility: select own" ON "public"."facilities" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "facility: update own" ON "public"."facilities" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."marketing_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "orders: delete own facility" ON "public"."orders" FOR DELETE USING (("facility_id" IN ( SELECT "facilities"."id"
   FROM "public"."facilities"
  WHERE ("facilities"."user_id" = "auth"."uid"()))));



CREATE POLICY "orders: insert own facility" ON "public"."orders" FOR INSERT WITH CHECK (("facility_id" IN ( SELECT "facilities"."id"
   FROM "public"."facilities"
  WHERE ("facilities"."user_id" = "auth"."uid"()))));



CREATE POLICY "orders: select own facility" ON "public"."orders" FOR SELECT USING (("facility_id" IN ( SELECT "facilities"."id"
   FROM "public"."facilities"
  WHERE ("facilities"."user_id" = "auth"."uid"()))));



CREATE POLICY "orders: update own facility" ON "public"."orders" FOR UPDATE USING (("facility_id" IN ( SELECT "facilities"."id"
   FROM "public"."facilities"
  WHERE ("facilities"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products: select for authenticated" ON "public"."products" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."training_materials" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_user_with_facility"("p_email" "text", "p_password" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_role" "text", "p_facility_name" "text", "p_facility_location" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_user_with_facility"("p_email" "text", "p_password" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_role" "text", "p_facility_name" "text", "p_facility_location" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_user_with_facility"("p_email" "text", "p_password" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_role" "text", "p_facility_name" "text", "p_facility_location" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";


















GRANT ALL ON TABLE "public"."contracts_materials" TO "anon";
GRANT ALL ON TABLE "public"."contracts_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."contracts_materials" TO "service_role";



GRANT ALL ON TABLE "public"."facilities" TO "anon";
GRANT ALL ON TABLE "public"."facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."facilities" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_materials" TO "anon";
GRANT ALL ON TABLE "public"."marketing_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_materials" TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



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



































drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Authenticated users can delete marketing files"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'spearhead-assets'::text) AND ((storage.foldername(name))[1] = 'marketing'::text)));



  create policy "Authenticated users can read assets"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using ((bucket_id = 'spearhead-assets'::text));



  create policy "Authenticated users can upload marketing files"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'spearhead-assets'::text) AND ((storage.foldername(name))[1] = 'marketing'::text)));



  create policy "Service role can delete assets"
  on "storage"."objects"
  as permissive
  for delete
  to service_role
using ((bucket_id = 'spearhead-assets'::text));



  create policy "Service role can manage assets"
  on "storage"."objects"
  as permissive
  for insert
  to service_role
with check ((bucket_id = 'spearhead-assets'::text));



