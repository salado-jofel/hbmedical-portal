-- Meridian delivery invoice (the paper handover doc that goes with the
-- product at delivery). Distinct from the existing public.invoices table
-- which represents a Stripe payment invoice for "Pay Now" orders.
--
-- One row per order. Created lazily when the user first opens the Invoice
-- tab on an order whose status has reached manufacturer_review or later.

CREATE TABLE IF NOT EXISTS "public"."order_delivery_invoices" (
  "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id"           uuid NOT NULL REFERENCES "public"."orders"("id") ON DELETE CASCADE,
  "invoice_number"     text NOT NULL,
  "invoice_date"       date,

  -- Customer block (mirrors the patient on the order; pre-filled from
  -- order_ivr but editable in case the delivery address differs).
  "customer_name"      text,
  "address_line_1"     text,
  "address_line_2"     text,
  "city"               text,
  "state"              text,
  "postal_code"        text,

  -- Insurance + ordering doctor.
  "insurance_name"     text,
  "insurance_number"   text,
  "doctor_name"        text,

  -- Delivery channel (one of these is checked on the printed sheet).
  "delivery_method"    text CHECK ("delivery_method" IN
                          ('home_delivery','patient_picked_up','mail_order','return')),

  -- Line items — placeholder for now. Once products land we'll either
  -- mirror order_items here or render them on the fly. JSONB keeps this
  -- forward-compatible without a schema change.
  "line_items"         jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Medicare rent vs purchase election (only meaningful for DME items).
  "rent_or_purchase"   text CHECK ("rent_or_purchase" IN ('rent','purchase')),

  -- Money fields (numeric so we don't lose cents).
  "due_copay"          numeric(12,2),
  "total_received"     numeric(12,2),

  -- Acknowledgement checklist. Defaults to all-true (the bundle is always
  -- handed over). JSONB so we can add/remove items without a migration.
  "acknowledgements"   jsonb NOT NULL DEFAULT jsonb_build_object(
    'medicare_supplier_standards',     true,
    'training_safe_use',               true,
    'complaint_grievance',             true,
    'warranty_information',            true,
    'rights_responsibilities',         true,
    'hipaa_privacy',                   true,
    'safety_packet',                   true,
    'maintenance_cleaning',            true,
    'medical_info_authorization',      true,
    'written_instructions',            true,
    'repair_return_policy',            true,
    'return_demo',                     true,
    'capped_rental_info',              true,
    'emergency_preparedness',          true,
    'mission_statement',               true,
    'financial_responsibility',        true,
    'acceptance_of_services',          true,
    'participation_plan_of_care',      true,
    'patient_rental_purchase_option',  true
  ),

  -- Signature block. patient_signature_url left null until the capture
  -- flow lands (separate discussion). When null the PDF prints a blank line.
  "patient_signature_url" text,
  "patient_signed_at"     timestamptz,
  "relationship"          text CHECK ("relationship" IN
                            ('patient','spouse_relative','caregiver','other')),

  "created_at"  timestamptz NOT NULL DEFAULT now(),
  "updated_at"  timestamptz NOT NULL DEFAULT now()
);

-- One delivery invoice per order.
CREATE UNIQUE INDEX IF NOT EXISTS "order_delivery_invoices_order_id_key"
  ON "public"."order_delivery_invoices" ("order_id");

CREATE INDEX IF NOT EXISTS "order_delivery_invoices_invoice_number_idx"
  ON "public"."order_delivery_invoices" ("invoice_number");

-- Touch updated_at on every UPDATE.
CREATE OR REPLACE FUNCTION "public"."touch_order_delivery_invoices_updated_at"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "order_delivery_invoices_touch_updated_at"
  ON "public"."order_delivery_invoices";
CREATE TRIGGER "order_delivery_invoices_touch_updated_at"
  BEFORE UPDATE ON "public"."order_delivery_invoices"
  FOR EACH ROW EXECUTE FUNCTION "public"."touch_order_delivery_invoices_updated_at"();

-- RLS — same pattern as the other order_* tables: anyone allowed to read
-- the parent order can read the invoice; admins/staff can write.
ALTER TABLE "public"."order_delivery_invoices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_delivery_invoices_select"
  ON "public"."order_delivery_invoices"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "public"."orders" o
      WHERE o.id = order_delivery_invoices.order_id
    )
  );

CREATE POLICY "order_delivery_invoices_insert"
  ON "public"."order_delivery_invoices"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "public"."orders" o
      WHERE o.id = order_delivery_invoices.order_id
    )
  );

CREATE POLICY "order_delivery_invoices_update"
  ON "public"."order_delivery_invoices"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "public"."orders" o
      WHERE o.id = order_delivery_invoices.order_id
    )
  );

-- Allow the new doc_type for generated invoice PDFs in order_documents.
-- (order_documents.document_type is text, not an enum, so no DDL needed —
-- the application layer enforces the allowed set via documentTypeSchema.)
COMMENT ON TABLE "public"."order_delivery_invoices" IS
  'Meridian Surgical Supplies delivery invoice — paper handover doc. Distinct from public.invoices (Stripe payment invoice).';
