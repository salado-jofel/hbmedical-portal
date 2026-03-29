-- Add Net-30 reminder tracking columns to the invoices table.
--
-- The cron job (app/api/cron/net-30-reminders) needs per-invoice state to track
-- which reminder stage was last sent, prevent duplicate sends via an optimistic
-- lock, and record transient email errors. The invoices table is the correct owner
-- of this state (not orders).

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS net30_last_reminder_stage   text,
  ADD COLUMN IF NOT EXISTS net30_last_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS net30_reminder_count        integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net30_reminder_email_error  text,
  ADD COLUMN IF NOT EXISTS net30_reminder_lock_id      uuid;

-- Ensure only valid stage values are stored.
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_net30_last_reminder_stage_check
    CHECK (
      net30_last_reminder_stage IS NULL OR
      net30_last_reminder_stage IN ('upcoming', 'tomorrow', 'due_today', 'overdue')
    );

-- Index used by the lock claim query (.is("net30_reminder_lock_id", null)).
CREATE INDEX IF NOT EXISTS invoices_net30_reminder_lock_id_idx
  ON public.invoices (net30_reminder_lock_id)
  WHERE net30_reminder_lock_id IS NOT NULL;
