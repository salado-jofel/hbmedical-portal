-- HIPAA audit log — Security Rule §164.312(b) "Audit controls".
--
-- Captures every PHI read/write the application performs on behalf of a
-- user. Required so that, in the event of a suspected breach, the operator
-- can identify which patient records were viewed by whom, when, from where.
-- Without this, a breach notification has to assume every patient was
-- affected (HHS expectation under §164.404).
--
-- Design choices:
--   - Append-only at the DB level: only INSERT is permitted to the
--     application role. UPDATE/DELETE are revoked so a compromised app
--     cannot rewrite history. Service role still has full access for
--     manual investigation, but that's a known break-glass.
--   - No FKs to auth.users / orders / patients: the row stays valid even
--     if the referenced row is later deleted (which is itself a logged
--     event). user_id / row_id are stored as plain uuid/text.
--   - GIN index on metadata jsonb so admin search can filter by arbitrary
--     keys ("show every download for facility X").
--   - Indexes on user_id, order_id, created_at desc for the typical
--     admin queries ("recent activity by user", "everything touching
--     order Y").
--   - Retention is left at "forever" by design (per the HIPAA plan
--     decision); 6-year minimum is satisfied trivially.

CREATE TABLE IF NOT EXISTS public.phi_access_log (
  id          uuid       PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid,                       -- nullable: cron / system writes
  user_email  text,                       -- snapshot — survives profile rename
  user_role   text,                       -- snapshot — survives role change
  action      text       NOT NULL,        -- e.g. "order.read", "ivr.read", "document.download"
  resource    text       NOT NULL,        -- e.g. "orders", "order_ivr", "order_documents"
  resource_id uuid,                       -- the row touched (when applicable)
  order_id    uuid,                       -- denormalized for fast "everything for this order" queries
  ip          text,
  user_agent  text,
  metadata    jsonb      NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS phi_access_log_user_idx
  ON public.phi_access_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS phi_access_log_order_idx
  ON public.phi_access_log (order_id, created_at DESC) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS phi_access_log_action_idx
  ON public.phi_access_log (action, created_at DESC);

CREATE INDEX IF NOT EXISTS phi_access_log_created_at_idx
  ON public.phi_access_log (created_at DESC);

CREATE INDEX IF NOT EXISTS phi_access_log_metadata_gin
  ON public.phi_access_log USING GIN (metadata);

-- RLS: read = admin only. Writes always go through service role
-- (logPhiAccess server helper) so we don't need INSERT policies for the
-- authenticated app role.
ALTER TABLE public.phi_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_phi_access_log"
  ON public.phi_access_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Tamper-resistance: revoke UPDATE/DELETE from authenticated + anon. Even
-- if a future RLS policy is mis-written, the privilege itself is gone.
-- Service role retains full access for ops investigations.
REVOKE UPDATE, DELETE ON public.phi_access_log FROM authenticated, anon;
