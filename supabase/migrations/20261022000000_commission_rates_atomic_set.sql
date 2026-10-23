-- -----------------------------------------------------------------------------
-- Atomic commission-rate writes + one-active-rate-per-rep guarantee.
--
-- WHY
-- Every reader of commission_rates in the app selects the rep's ACTIVE row
-- (`effective_to IS NULL`), and three of them use .maybeSingle(), which ERRORS
-- when the filter matches more than one row:
--   calculateOrderCommission            -> commissions/(services)/actions.ts
--   getSubRepDetail                     -> my-team/(services)/actions.ts
--   getMyTeamKpis                       -> my-team/(services)/actions.ts
-- So a rep with two active rate rows does not get a wrong commission; they get
-- NO commission, silently, on every future order.
--
-- The old server action could produce exactly that. It inserted the new rate
-- and then closed the old one in a second statement, so the two-active-row
-- state was briefly COMMITTED, and any failure between the two left it
-- permanently. Doing the two writes in one transaction is the real fix, and a
-- transaction can only be expressed here, not in the supabase-js client.
--
-- NOTE on ordering: this function closes BEFORE inserting, the reverse of the
-- old action. That ordering is only safe inside a transaction -- a failed
-- insert rolls the close back, so the rep is never left with no active rate.
-- It is also required by the unique index below, which cannot be deferred
-- (a partial unique INDEX has no DEFERRABLE option, and a DEFERRABLE UNIQUE
-- CONSTRAINT cannot be partial).
--
-- Authorization stays in the server action (admin, or the rep's own parent),
-- so EXECUTE is granted to service_role only and never to authenticated.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_commission_rate(
  p_rep_id           uuid,
  p_set_by           uuid,
  p_rate_percent     numeric,
  p_override_percent numeric DEFAULT NULL  -- NULL = keep the rep's current value
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today    date := CURRENT_DATE;
  v_override numeric;
  v_id       uuid;
BEGIN
  -- Serialize saves for this rep. Without this, two concurrent saves could
  -- both pass the close step and then collide on the unique index below.
  PERFORM pg_advisory_xact_lock(hashtextextended('commission_rate:' || p_rep_id::text, 0));

  -- override_percent is what this rep's PARENT earns on their sales. A caller
  -- who does not submit one (the form hides the field for main reps) must not
  -- reset it, so the current value is carried forward -- inside this
  -- transaction, which also closes the read-then-write race the app-side
  -- carry-forward had.
  SELECT COALESCE(p_override_percent, override_percent, 0)
    INTO v_override
    FROM commission_rates
   WHERE rep_id = p_rep_id
     AND effective_to IS NULL;

  -- No active row yet (new rep): fall back to what was passed, else 0.
  v_override := COALESCE(v_override, p_override_percent, 0);

  -- Re-save on the same day updates the row in place. Closing it instead would
  -- write effective_to = effective_from, leaving a zero-length history row for
  -- every correction an admin makes while tuning a rate.
  UPDATE commission_rates
     SET rate_percent     = p_rate_percent,
         override_percent = v_override,
         set_by           = p_set_by
   WHERE rep_id = p_rep_id
     AND effective_to IS NULL
     AND effective_from = v_today
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Close the old rate, then open the new one. Both in this transaction.
  UPDATE commission_rates
     SET effective_to = v_today
   WHERE rep_id = p_rep_id
     AND effective_to IS NULL;

  INSERT INTO commission_rates
    (rep_id, set_by, rate_percent, override_percent, effective_from, effective_to)
  VALUES
    (p_rep_id, p_set_by, p_rate_percent, v_override, v_today, NULL)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL    ON FUNCTION public.set_commission_rate(uuid, uuid, numeric, numeric) FROM PUBLIC;
REVOKE ALL    ON FUNCTION public.set_commission_rate(uuid, uuid, numeric, numeric) FROM authenticated;
GRANT  EXECUTE ON FUNCTION public.set_commission_rate(uuid, uuid, numeric, numeric) TO service_role;

COMMENT ON FUNCTION public.set_commission_rate(uuid, uuid, numeric, numeric) IS
  'Atomically replaces a rep''s active commission rate: closes the current row and opens a new one in one transaction. Pass NULL override_percent to carry the current value forward. Service role only; callers must authorize first.';

-- -----------------------------------------------------------------------------
-- The backstop. Guarantees the invariant every reader already assumes.
--
-- This migration FAILS if any rep currently has more than one active rate row.
-- Verified 0 on both dev and prod before writing this; re-check with:
--   SELECT rep_id, count(*) FROM commission_rates
--    WHERE effective_to IS NULL GROUP BY 1 HAVING count(*) > 1;
-- -----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "commission_rates_one_active_per_rep"
  ON "public"."commission_rates" USING btree ("rep_id")
  WHERE ("effective_to" IS NULL);
