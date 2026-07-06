-- IVR Phase 1 · Foundations · Table 4 of 4.
--
-- standalone_ivr_history: append-only audit trail for every state
-- transition on a standalone IVR. Powers the timeline view + serves
-- as the compliance record of who acted (or which external approver
-- clicked) and when.
--
-- actor_id is null when an EXTERNAL approver acts (they have no portal
-- account) — actor_display carries their snapshot name/email in that
-- case. When a portal user acts (upload, edit, resubmit, convert),
-- actor_id links to auth.users.
--
-- RLS: inherit from the parent IVR (view-only — no one edits history).

CREATE TABLE public.standalone_ivr_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standalone_ivr_id    uuid NOT NULL REFERENCES public.standalone_ivrs(id) ON DELETE CASCADE,
  event                text NOT NULL,
  actor_id             uuid REFERENCES auth.users(id),
  actor_display        text,
  note                 text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT standalone_ivr_history_event_check
    CHECK (event IN ('created', 'sent', 'approved', 'denied',
                     'edited', 'resubmitted', 'converted'))
);

CREATE INDEX standalone_ivr_history_ivr_time_idx
  ON public.standalone_ivr_history (standalone_ivr_id, created_at DESC);

ALTER TABLE public.standalone_ivr_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inherit_standalone_ivr_history"
  ON public.standalone_ivr_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.standalone_ivrs
      WHERE standalone_ivrs.id = standalone_ivr_history.standalone_ivr_id
    )
  );
