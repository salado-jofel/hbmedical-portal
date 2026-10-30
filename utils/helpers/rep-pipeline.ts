/* Rep money pipeline — what a sales rep has in flight, and what it is worth.
 *
 * Why this exists: a rep could see *how many* orders were moving (the
 * "Active Orders" / "Orders This Month" counts) but no dollar figure attached
 * to any of them, because a `commissions` row is only ever created by a Stripe
 * payment-success webhook (`calculateOrderCommission` is called from
 * handleInvoicePaid / handleCheckoutSessionCompleted / ...AsyncSucceeded and
 * nowhere else). Until the clinic paid, the rep's money view was $0.
 *
 * The classification below reads the two independent status axes an order
 * carries — `order_status` (workflow) and `payment_status` / `invoice_status`
 * (money) — and sorts an order into one of the buckets the client asked for:
 * what went through, what is collectible, what is paid.
 *
 * Nothing here writes to the commission ledger. Pre-payment figures are
 * ESTIMATES derived from the rep's current rate, and are labelled as such in
 * the UI; the ledger stays the single source of truth for money actually owed.
 * Mixing the two would let a forecast become a payout.
 */

/** Invoice states that mean "billed, money still outstanding". */
const COLLECTIBLE_INVOICE_STATUSES = new Set([
  "issued",
  "sent",
  "partially_paid",
  "overdue",
]);

/** Order states that mean the order cleared review and is being fulfilled. */
const FULFILLED_ORDER_STATUSES = new Set([
  "approved",
  "shipped",
  "delivered",
]);

export type RepMoneyBucket =
  /** Still in the clinic/review workflow — money is speculative. */
  | "in_progress"
  /** Cleared review, not yet billed — "what went through". */
  | "fulfilled"
  /** Billed, awaiting payment — "what is collectible". */
  | "collectible"
  /** Money arrived. */
  | "paid"
  /** Canceled, refunded or voided — counts toward nothing. */
  | "excluded";

export type OrderMoneyStatuses = {
  orderStatus?: string | null;
  paymentStatus?: string | null;
  invoiceStatus?: string | null;
};

/**
 * Sort one order into a money bucket.
 *
 * Order of the checks matters: an order can be `shipped` *and* paid, or
 * `approved` *and* overdue, so the money axis is read before the workflow
 * axis. A canceled or refunded order is excluded outright rather than being
 * allowed to inflate a forecast.
 */
export function classifyOrderMoney(
  statuses: OrderMoneyStatuses,
): RepMoneyBucket {
  const orderStatus = statuses.orderStatus ?? "";
  const paymentStatus = statuses.paymentStatus ?? "";
  const invoiceStatus = statuses.invoiceStatus ?? "";

  // 1. Dead money — never counts, whatever the workflow says.
  if (
    orderStatus === "canceled" ||
    paymentStatus === "canceled" ||
    paymentStatus === "refunded" ||
    invoiceStatus === "void"
  ) {
    return "excluded";
  }

  // 2. Collected. `partially_refunded` is treated as paid: the money did
  //    arrive, and the refunded part is reconciled on the ledger, not here.
  if (
    paymentStatus === "paid" ||
    paymentStatus === "partially_refunded" ||
    invoiceStatus === "paid"
  ) {
    return "paid";
  }

  // 3. Billed and outstanding.
  if (COLLECTIBLE_INVOICE_STATUSES.has(invoiceStatus)) {
    return "collectible";
  }

  // 4. Through the workflow, not yet billed.
  if (FULFILLED_ORDER_STATUSES.has(orderStatus)) {
    return "fulfilled";
  }

  // 5. Everything earlier: draft, pending_signature, manufacturer_review,
  //    additional_info_needed.
  return "in_progress";
}

/** An order is chaseable when it has been billed and has gone past due. */
export function isOverdueForCollection(
  statuses: OrderMoneyStatuses,
): boolean {
  return (
    classifyOrderMoney(statuses) === "collectible" &&
    (statuses.invoiceStatus ?? "") === "overdue"
  );
}

/**
 * Commission on an order amount at a given rate.
 *
 * Returns null when no rate is known, so the UI can say "no rate set" instead
 * of showing a confident $0 — a rep with no configured rate earning nothing is
 * a setup problem someone needs to fix, not a real forecast.
 */
export function estimateCommission(
  orderAmount: number,
  ratePercent: number | null | undefined,
): number | null {
  if (ratePercent === null || ratePercent === undefined) return null;
  if (!Number.isFinite(ratePercent) || !Number.isFinite(orderAmount)) return null;
  return (orderAmount * ratePercent) / 100;
}

export type RepPipelineBucketTotal = {
  bucket: RepMoneyBucket;
  orders: number;
  orderAmount: number;
  /** null when the rep has no active commission rate. */
  commissionEstimate: number | null;
};

export type RepPipelineTotals = {
  buckets: Record<
    Exclude<RepMoneyBucket, "excluded">,
    RepPipelineBucketTotal
  >;
  /** Billed, outstanding and past due — the rep's chase list. */
  overdueOrders: number;
  overdueAmount: number;
  excludedOrders: number;
};

/**
 * Add several reps' bucket totals together.
 *
 * Needed for a parent rep's override forecast: the override percentage lives
 * on each SUB-REP's own rate row, not the parent's, so each sub-rep's orders
 * must be valued at their own rate and only then summed. Applying one blended
 * rate to a combined order total would be wrong whenever two sub-reps are on
 * different override percentages.
 *
 * A null `commissionEstimate` (sub-rep with no rate configured) contributes
 * nothing rather than poisoning the sum to null — the caller reports how many
 * sub-reps were skipped so the gap is visible instead of silent.
 */
export function mergeRepPipelineTotals(
  parts: RepPipelineTotals[],
): RepPipelineTotals {
  const merged: RepPipelineTotals = {
    buckets: {
      in_progress: EMPTY_BUCKET("in_progress"),
      fulfilled: EMPTY_BUCKET("fulfilled"),
      collectible: EMPTY_BUCKET("collectible"),
      paid: EMPTY_BUCKET("paid"),
    },
    overdueOrders: 0,
    overdueAmount: 0,
    excludedOrders: 0,
  };

  for (const part of parts) {
    merged.overdueOrders += part.overdueOrders;
    merged.overdueAmount += part.overdueAmount;
    merged.excludedOrders += part.excludedOrders;

    for (const key of Object.keys(merged.buckets) as Array<
      keyof RepPipelineTotals["buckets"]
    >) {
      const into = merged.buckets[key];
      const from = part.buckets[key];
      into.orders += from.orders;
      into.orderAmount += from.orderAmount;
      if (from.commissionEstimate !== null) {
        into.commissionEstimate =
          (into.commissionEstimate ?? 0) + from.commissionEstimate;
      }
    }
  }

  return merged;
}

/**
 * A parent rep's override money across their direct sub-reps.
 *
 * Deliberately money-only. The client's rule (2026-10-30, reaffirming the
 * 2026-09-19 decision) is that a parent rep sees "his own, his money and his
 * override from his sales rep" — not the sub-reps' facilities, accounts or
 * orders. So this carries aggregate figures with no facility or order
 * identity, and the UI renders the override commission rather than the
 * underlying sub-rep revenue.
 */
export type RepOverridePipeline = {
  totals: RepPipelineTotals;
  /** Direct sub-reps counted. Overrides are one level only — see below. */
  subRepCount: number;
  /**
   * Direct sub-reps with no active override percentage, whose orders could
   * therefore not be valued. Surfaced so a missing rate reads as a setup gap
   * rather than as the parent having earned nothing.
   */
  subRepsMissingRate: number;
};

/**
 * The bucket totals plus the figures a rep needs to read them correctly:
 * the rate the estimates used, and what the commission ledger actually holds.
 */
export type RepMoneyPipeline = RepPipelineTotals & {
  /** The rate the estimates were computed at; null when none is configured. */
  ratePercent: number | null;
  /**
   * Commission actually recorded on the ledger, all periods, excluding voids,
   * split by type. Authoritative, unlike the estimates — shown alongside them
   * so a rep can see where forecast ends and owed money begins.
   */
  ledgerDirect: number;
  ledgerOverride: number;
  /** Null when the rep has no sub-reps. */
  override: RepOverridePipeline | null;
};

const EMPTY_BUCKET = (bucket: RepMoneyBucket): RepPipelineBucketTotal => ({
  bucket,
  orders: 0,
  orderAmount: 0,
  commissionEstimate: null,
});

/**
 * Aggregate orders into the rep's money buckets.
 *
 * `amount` is the order's own total (summed from its order_items by the
 * caller) — this helper stays pure so the bucket rules can be tested without
 * a database.
 */
export function buildRepPipelineTotals(
  orders: Array<OrderMoneyStatuses & { amount: number }>,
  ratePercent: number | null | undefined,
): RepPipelineTotals {
  const totals: RepPipelineTotals = {
    buckets: {
      in_progress: EMPTY_BUCKET("in_progress"),
      fulfilled: EMPTY_BUCKET("fulfilled"),
      collectible: EMPTY_BUCKET("collectible"),
      paid: EMPTY_BUCKET("paid"),
    },
    overdueOrders: 0,
    overdueAmount: 0,
    excludedOrders: 0,
  };

  for (const order of orders) {
    const bucket = classifyOrderMoney(order);
    const amount = Number.isFinite(order.amount) ? order.amount : 0;

    if (bucket === "excluded") {
      totals.excludedOrders++;
      continue;
    }

    const target = totals.buckets[bucket];
    target.orders++;
    target.orderAmount += amount;

    if (isOverdueForCollection(order)) {
      totals.overdueOrders++;
      totals.overdueAmount += amount;
    }
  }

  for (const bucket of Object.values(totals.buckets)) {
    bucket.commissionEstimate = estimateCommission(
      bucket.orderAmount,
      ratePercent,
    );
  }

  return totals;
}
