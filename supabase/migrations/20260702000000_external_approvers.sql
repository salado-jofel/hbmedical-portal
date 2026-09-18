-- IVR Phase 1 · Foundations · Table 1 of 4.
--
-- external_approvers: a directory of people OUTSIDE the portal (e.g.
-- Fortify's IVR team, independent reviewers, other manufacturer approvers)
-- who receive IVRs by email and click Approve/Deny in one-time links.
-- They do NOT have portal accounts — only their name + email is stored
-- so we can address IVRs to them and log who acted on each decision.
--
-- Rows are soft-deactivated (is_active=false) rather than removed, so
-- historical decisions retain the approver display name even if the
-- record is later disabled.

CREATE TABLE public.external_approvers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (btrim(name) <> ''),
  email      text NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX external_approvers_email_unique
  ON public.external_approvers (lower(email));

CREATE INDEX external_approvers_active
  ON public.external_approvers (is_active) WHERE is_active = true;

ALTER TABLE public.external_approvers ENABLE ROW LEVEL SECURITY;

-- Only admin + support_staff can read/write approvers.
CREATE POLICY "admin_support_all_external_approvers"
  ON public.external_approvers
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'support_staff')
    )
  );
