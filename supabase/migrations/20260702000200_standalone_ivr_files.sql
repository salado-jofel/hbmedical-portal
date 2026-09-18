-- IVR Phase 1 · Foundations · Table 3 of 4.
--
-- standalone_ivr_files: attachments belonging to a standalone IVR.
-- Faxed IVRs often arrive as multiple pages/files; we keep them as
-- separate rows so the approver's review page can render each in turn.
-- Bytes live in the shared "order-documents" storage bucket under
-- prefix "standalone-ivrs/<ivr-id>/…" — same RLS + signed-URL story
-- as order documents.
--
-- RLS: inherit from the parent IVR — if the current user can see the
-- IVR row, they can see its files.

CREATE TABLE public.standalone_ivr_files (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standalone_ivr_id     uuid NOT NULL REFERENCES public.standalone_ivrs(id) ON DELETE CASCADE,
  file_path             text NOT NULL,
  file_name             text NOT NULL,
  mime_type             text,
  file_size             bigint,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX standalone_ivr_files_ivr_idx
  ON public.standalone_ivr_files (standalone_ivr_id);

ALTER TABLE public.standalone_ivr_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inherit_standalone_ivr_files"
  ON public.standalone_ivr_files
  USING (
    EXISTS (
      SELECT 1 FROM public.standalone_ivrs
      WHERE standalone_ivrs.id = standalone_ivr_files.standalone_ivr_id
    )
  );
