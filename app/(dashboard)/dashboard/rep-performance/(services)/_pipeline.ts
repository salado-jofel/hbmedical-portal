/* Rep money pipeline — data access.
 *
 * Pairs with utils/helpers/rep-pipeline.ts, which holds the (pure, tested)
 * bucket rules. This module only fetches: the rep's facilities, the orders at
 * them, those orders' line-item totals, and commission rates.
 *
 * Deliberately NOT derived from the `commissions` table: a commission row only
 * exists after a Stripe payment webhook fires, which is exactly why the rep's
 * unpaid pipeline read $0 before this. Open money has to be computed from the
 * orders themselves.
 *
 * Visibility rule (client, 2026-10-30, reaffirming 2026-09-19): a parent rep
 * sees "his own, his money and his override from his sales rep" — his own
 * facilities and orders, plus aggregate override money. Never his sub-reps'
 * facilities, accounts or orders. `buildRepMoneyPipeline` therefore scopes the
 * rep's own buckets to `facilities.assigned_rep = repId` with no hierarchy
 * expansion, and the override side returns money and counts only, carrying no
 * facility or order identity to the client.
 */

import type { createAdminClient } from "@/lib/supabase/admin";
import { COMMISSION_RATES_TABLE, COMMISSION_TABLE } from "@/utils/constants/commissions";
import {
  buildRepLedgerTotals,
  buildRepPipelineTotals,
  mergeRepPipelineTotals,
  type RepMoneyPipeline,
  type RepOverridePipeline,
  type RepPipelineTotals,
} from "@/utils/helpers/rep-pipeline";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Line-item totals for a set of orders, keyed by order id. */
async function sumOrderAmounts(
  orderIds: string[],
  adminClient: AdminClient,
): Promise<Map<string, number>> {
  const byOrder = new Map<string, number>();
  if (orderIds.length === 0) return byOrder;

  const { data: itemRows } = await adminClient
    .from("order_items")
    .select("order_id, total_amount")
    .in("order_id", orderIds);

  for (const item of itemRows ?? []) {
    const row = item as { order_id: string; total_amount: unknown };
    byOrder.set(
      row.order_id,
      (byOrder.get(row.order_id) ?? 0) + Number(row.total_amount ?? 0),
    );
  }
  return byOrder;
}

/**
 * Bucket totals for one rep's own facilities, valued at `ratePercent`.
 *
 * Used for the rep's own book and, with the sub-rep's override percentage, for
 * each sub-rep's contribution to a parent's override forecast.
 */
async function totalsForRepFacilities(
  repId: string,
  ratePercent: number | null,
  adminClient: AdminClient,
): Promise<RepPipelineTotals> {
  const { data: facs } = await adminClient
    .from("facilities")
    .select("id")
    .eq("assigned_rep", repId);

  // An empty result still goes through buildRepPipelineTotals so the rate is
  // applied: a rep with a known rate and no orders earns a real $0, which is
  // different from a rep whose rate is unknown. Only the latter is null.
  const facilityIds = (facs ?? []).map((f: { id: string }) => f.id);
  if (facilityIds.length === 0) return buildRepPipelineTotals([], ratePercent);

  const { data: orderRows } = await adminClient
    .from("orders")
    .select("id, order_status, payment_status, invoice_status")
    .in("facility_id", facilityIds);

  const orders = orderRows ?? [];
  if (orders.length === 0) return buildRepPipelineTotals([], ratePercent);

  const amountByOrder = await sumOrderAmounts(
    orders.map((o: { id: string }) => o.id),
    adminClient,
  );

  return buildRepPipelineTotals(
    orders.map((o: Record<string, unknown>) => ({
      orderStatus: o.order_status as string | null,
      paymentStatus: o.payment_status as string | null,
      invoiceStatus: o.invoice_status as string | null,
      amount: amountByOrder.get(o.id as string) ?? 0,
    })),
    ratePercent,
  );
}

/**
 * A parent rep's override forecast across their DIRECT sub-reps.
 *
 * One level only, matching how overrides are actually paid:
 * `calculateOrderCommission` looks up a single `rep_hierarchy` parent for the
 * selling rep, so a grandparent earns nothing on a grandchild's order. A
 * recursive forecast here would promise money the payout logic never creates.
 *
 * The percentage comes from each SUB-REP's own active rate row
 * (`override_percent`), not the parent's — again mirroring the payout code.
 */
async function buildOverridePipeline(
  parentRepId: string,
  adminClient: AdminClient,
): Promise<RepOverridePipeline | null> {
  const { data: edges } = await adminClient
    .from("rep_hierarchy")
    .select("child_rep_id")
    .eq("parent_rep_id", parentRepId);

  const childIds = (edges ?? []).map(
    (e: { child_rep_id: string }) => e.child_rep_id,
  );
  if (childIds.length === 0) return null;

  const { data: rateRows } = await adminClient
    .from(COMMISSION_RATES_TABLE)
    .select("rep_id, override_percent")
    .in("rep_id", childIds)
    .is("effective_to", null);

  const overrideByChild = new Map<string, number | null>();
  for (const r of rateRows ?? []) {
    const row = r as { rep_id: string; override_percent: unknown };
    overrideByChild.set(
      row.rep_id,
      row.override_percent != null ? Number(row.override_percent) : null,
    );
  }

  let subRepsMissingRate = 0;
  const parts: RepPipelineTotals[] = [];

  for (const childId of childIds) {
    const overridePercent = overrideByChild.get(childId) ?? null;
    if (overridePercent === null) subRepsMissingRate++;
    parts.push(
      await totalsForRepFacilities(childId, overridePercent, adminClient),
    );
  }

  return {
    totals: mergeRepPipelineTotals(parts),
    subRepCount: childIds.length,
    subRepsMissingRate,
  };
}

/**
 * Build the rep's money pipeline: their own book, plus override money from
 * their direct sub-reps.
 *
 * Not windowed to a month on purpose: open money does not stop mattering
 * because it was raised last month, and a rep chasing an overdue invoice needs
 * to see it however old it is. The month-scoped figures live separately in
 * `buildRepPerformance`.
 */
export async function buildRepMoneyPipeline(
  repId: string,
  adminClient: AdminClient,
): Promise<RepMoneyPipeline> {
  const { data: rateRow } = await adminClient
    .from(COMMISSION_RATES_TABLE)
    .select("rate_percent")
    .eq("rep_id", repId)
    .is("effective_to", null)
    .maybeSingle();

  const ratePercent =
    rateRow?.rate_percent != null ? Number(rateRow.rate_percent) : null;

  // Every period, not just the current one: "what have I earned" is a
  // lifetime question. The month-scoped figure is `commissionEarned` on
  // IRepPerformance, which this deliberately does not duplicate.
  const { data: ledgerRows } = await adminClient
    .from(COMMISSION_TABLE)
    .select("type, status, final_amount, commission_amount, adjustment")
    .eq("rep_id", repId)
    .neq("status", "void");

  const ledger = buildRepLedgerTotals(
    (ledgerRows ?? []).map((c) => {
      const row = c as Record<string, unknown>;
      return {
        type: row.type as string | null,
        status: row.status as string | null,
        finalAmount: row.final_amount as number | null,
        commissionAmount: row.commission_amount as number | null,
        adjustment: row.adjustment as number | null,
      };
    }),
  );

  const [own, override] = await Promise.all([
    totalsForRepFacilities(repId, ratePercent, adminClient),
    buildOverridePipeline(repId, adminClient),
  ]);

  return {
    ...own,
    ratePercent,
    ledger,
    override,
  };
}
