-- Fax Intake feature — Meridian receives IVRs/orders by inbound FAX at a
-- dedicated Documo number. Each fax lands here as an intake_documents row,
-- awaiting staff triage.
--
-- Provider spec (Dr. Ben 2026-07-09): FAX ONLY. No email path. If email
-- is added later we widen the `source` CHECK; kept single-valued for now
-- to keep the shape honest.
--
-- Trust model: admin + support see the whole inbox. Clinic staff and reps
-- do NOT see it — inbound faxes come to Meridian's central intake number,
-- and Meridian staff route each doc to the appropriate facility during the
-- Build IVR / Build Order handoff. If a per-facility fax number is added
-- later we can loosen this policy per-row via facility_id.

CREATE TABLE public.intake_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Where the fax came in (provider metadata)
  source        text NOT NULL DEFAULT 'fax'
                CHECK (source IN ('fax')),
  provider      text NOT NULL DEFAULT 'documo',
  external_id   text,          -- Documo fax_id, used for idempotency
  from_number   text,          -- sender fax number, e.g. "+13055551234"
  to_number     text,          -- our fax number that received it
  received_at   timestamptz NOT NULL DEFAULT now(),
  page_count    integer,

  -- The stored PDF (bytes live in Supabase Storage)
  bucket        text NOT NULL DEFAULT 'hbmedical-bucket-private',
  file_path     text NOT NULL,  -- e.g. "intake/<id>.pdf"
  file_name     text,
  mime_type     text,
  file_size     bigint,

  -- Triage state
  status        text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'converted_ivr',
                                  'converted_order', 'dismissed')),
  -- Optional AI first-pass guess (populated by a later phase)
  classified_as    text CHECK (classified_as IN ('ivr', 'order', 'unknown')),
  ai_classification jsonb,

  -- Where it landed after triage
  converted_to_type text CHECK (converted_to_type IN
                                 ('standalone_ivr', 'order')),
  converted_to_id   uuid,
  converted_at      timestamptz,
  converted_by      uuid REFERENCES auth.users(id),

  -- Dismissal metadata (non-fax intake / spam / duplicate)
  dismissed_at   timestamptz,
  dismissed_by   uuid REFERENCES auth.users(id),
  dismiss_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotency for the Documo webhook — Documo sometimes retries the same
-- fax delivery. Same external_id twice ⇒ the second insert cleanly fails
-- and we can 200 the retry without duplicating the row.
CREATE UNIQUE INDEX intake_documents_external_id_unique
  ON public.intake_documents (provider, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX intake_documents_status_received
  ON public.intake_documents (status, received_at DESC);

ALTER TABLE public.intake_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_support_all_intake"
  ON public.intake_documents
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support_staff')
    )
  );

-- Realtime so the Intake Inbox refreshes when a new fax lands.
ALTER PUBLICATION supabase_realtime ADD TABLE public.intake_documents;
