-- IVR Phase 1 · Foundations · Table 2 of 4.
--
-- standalone_ivrs: the core IVR entity, decoupled from orders. Doctors
-- upload completed IVR documents in bulk; the portal dispatches them
-- to external approvers (see external_approvers); clinic/support staff
-- later convert approved IVRs into orders (Phase 4).
--
-- Status lifecycle:
--   draft      — created but not yet emailed to an approver
--   sent       — approval email dispatched to assigned_approver
--   approved   — approver clicked Approve in the email
--   denied     — approver clicked Deny + gave a reason
--   converted  — a portal user has converted this into an order
--                (converted_to_order_id points at the resulting row)
--
-- Multiple products per IVR (per Dr. Ben) are captured for MVP as a
-- text summary. Phase 2 can normalize to a product_id/quantity table
-- once the upload flow lands.

CREATE TABLE public.standalone_ivrs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lifecycle
  status                   text NOT NULL DEFAULT 'draft',
  CONSTRAINT standalone_ivrs_status_check
    CHECK (status IN ('draft', 'sent', 'approved', 'denied', 'converted')),

  -- Required metadata (Q2: patient + physician + facility + products all
  -- required at upload time so batches can be audited without opening
  -- each file). Product summary is free text — clinician writes what
  -- they're requesting; Phase 2 may add structured line items.
  patient_name             text NOT NULL,
  patient_dob              date NOT NULL,
  physician_name           text NOT NULL,
  physician_npi            text,
  facility_id              uuid NOT NULL REFERENCES public.facilities(id),
  product_summary          text NOT NULL,

  -- Approval routing
  assigned_approver_id     uuid REFERENCES public.external_approvers(id),
  approval_token           uuid,
  approval_expires_at      timestamptz,
  sent_at                  timestamptz,

  -- Approval outcome (Q5: audit IP + user-agent when the click happens)
  approved_at              timestamptz,
  denied_at                timestamptz,
  denial_reason            text,
  approver_display_name    text,      -- snapshot at click time
  approver_ip              text,
  approver_user_agent      text,

  -- Bookkeeping
  uploaded_by              uuid REFERENCES auth.users(id),
  converted_to_order_id    uuid REFERENCES public.orders(id),
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX standalone_ivrs_approval_token_unique
  ON public.standalone_ivrs (approval_token) WHERE approval_token IS NOT NULL;

CREATE INDEX standalone_ivrs_status_idx    ON public.standalone_ivrs (status);
CREATE INDEX standalone_ivrs_approver_idx  ON public.standalone_ivrs (assigned_approver_id);
CREATE INDEX standalone_ivrs_facility_idx  ON public.standalone_ivrs (facility_id);
CREATE INDEX standalone_ivrs_uploaded_idx  ON public.standalone_ivrs (uploaded_by);

ALTER TABLE public.standalone_ivrs ENABLE ROW LEVEL SECURITY;

-- Admin + support see everything.
CREATE POLICY "admin_support_all_standalone_ivrs"
  ON public.standalone_ivrs
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support_staff')
    )
  );

-- Clinic members (clinical_provider + clinical_staff) see IVRs at their
-- facility. Same helper the orders/order_form policies use.
CREATE POLICY "clinic_member_all_standalone_ivrs"
  ON public.standalone_ivrs
  USING (public.is_facility_member(facility_id));

-- Sales reps see IVRs at facilities they cover (via their rep tree,
-- same helper the orders policies use).
CREATE POLICY "sales_rep_read_standalone_ivrs"
  ON public.standalone_ivrs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'sales_representative'
        AND public.is_rep_facility(profiles.id, standalone_ivrs.facility_id)
    )
  );
