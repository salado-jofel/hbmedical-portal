-- Extend realtime coverage to the remaining collaborative surfaces.
--
-- Tables added here:
--   tasks       — admin assigns tasks to reps; TodaysFocus + tasks board
--                 need live updates so the assignee sees them without
--                 reloading the page.
--   payouts     — admin initiates payouts; other admins watching
--                 PayoutTable / AdminPayoutCard see status flips live.
--   profiles    — admin-managed user records (invites, status, role
--                 changes); UsersList stays stale today.
--   facilities  — admin-approved clinic accounts; AccountsList surface.
--   products    — admin edits catalog; order product pickers and the
--                 products admin page.
--
-- All guarded IF NOT EXISTS so the migration is idempotent on envs where
-- any of these may have already been added out-of-band.

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'tasks',
    'payouts',
    'profiles',
    'facilities',
    'products'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
