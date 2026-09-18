-- IVR Phase 3: Extend notifications to also cover standalone IVR events.
--
-- Before: notifications.order_id was NOT NULL and every row was tied to
-- an order. IVR events (approved/denied by an external reviewer) don't
-- have a parent order until the IVR is later converted, so we need to
-- allow either kind: order-linked OR ivr-linked.
--
-- Schema shape:
--   - order_id: uuid, nullable (was NOT NULL)
--   - standalone_ivr_id: uuid, nullable (new)
--   - CHECK exactly-one-of: every row must have exactly one parent
--
-- Also loosens order_number NOT NULL (IVR notifications don't have one).

ALTER TABLE public.notifications
  ADD COLUMN standalone_ivr_id uuid REFERENCES public.standalone_ivrs(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.notifications
  ALTER COLUMN order_number DROP NOT NULL;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_parent_check
    CHECK (
      (order_id IS NOT NULL AND standalone_ivr_id IS NULL) OR
      (order_id IS NULL AND standalone_ivr_id IS NOT NULL)
    );

CREATE INDEX notifications_standalone_ivr_idx
  ON public.notifications (standalone_ivr_id)
  WHERE standalone_ivr_id IS NOT NULL;
