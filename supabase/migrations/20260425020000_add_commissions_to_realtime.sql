-- Add `commissions` to the supabase_realtime publication so surfaces that
-- display commission rows (CommissionLedger, AdminApprovalsCard, the
-- sub-rep Commission History card) can subscribe to inserts/updates/deletes
-- without polling.
--
-- Existing tables already in the publication: invoices, notifications,
-- order_form, order_messages, orders, payments, plus the order_* sub-tables
-- added by 20260424010000. `commissions` was missed — adding here.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'commissions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.commissions';
  END IF;
END $$;
