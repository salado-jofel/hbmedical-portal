import { OUTSTANDING_INVOICE_STATUSES } from "@/utils/constants/orders";

/* Order money, split three ways.
 *
 * An order's value sits in exactly one of three states, and conflating them is
 * what made the admin dashboard misleading: it reported a single "Total
 * Revenue" that summed every non-canceled order whatever its payment state, so
 * $55k of drafts that no one had been billed for read as earnings.
 *
 *   collected   — the clinic paid. Real money, in the bank.
 *   outstanding — we invoiced and they have not paid. A receivable.
 *   pipeline    — not yet billed. Potential, not money.
 *
 * Canceled orders are excluded from all three.
 *
 * The two axes are independent, so the order of the checks matters: a Net-30
 * invoice marked `paid` is collected, not outstanding, and `payment_status` is
 * the authority on that. See the two Stripe webhooks, which are the only
 * writers of payment_status = "paid".
 */

export type OrderMoneyRow = {
  order_status: string;
  payment_status: string;
  invoice_status?: string | null;
  total_amount?: number | null;
};

export type OrderMoneyBuckets = {
  collected: number;
  collectedOrders: number;
  outstanding: number;
  outstandingOrders: number;
  pipeline: number;
  pipelineOrders: number;
  /** collected + outstanding + pipeline. Every non-canceled order. */
  total: number;
};

/** The clinic's money has arrived. Set only by the Stripe webhooks. */
export function isCollected(order: OrderMoneyRow): boolean {
  return order.payment_status === "paid";
}

/** Billed, not yet paid — the receivable. Never true for a collected order. */
export function isOutstanding(order: OrderMoneyRow): boolean {
  if (isCollected(order)) return false;
  return (
    !!order.invoice_status && OUTSTANDING_INVOICE_STATUSES.has(order.invoice_status)
  );
}

function amountOf(order: OrderMoneyRow): number {
  const value = Number(order.total_amount ?? 0);
  return Number.isFinite(value) ? value : 0;
}

export function bucketOrderMoney(orders: OrderMoneyRow[]): OrderMoneyBuckets {
  const buckets: OrderMoneyBuckets = {
    collected: 0,
    collectedOrders: 0,
    outstanding: 0,
    outstandingOrders: 0,
    pipeline: 0,
    pipelineOrders: 0,
    total: 0,
  };

  for (const order of orders) {
    if (order.order_status === "canceled") continue;

    const amount = amountOf(order);
    buckets.total += amount;

    if (isCollected(order)) {
      buckets.collected += amount;
      buckets.collectedOrders += 1;
    } else if (isOutstanding(order)) {
      buckets.outstanding += amount;
      buckets.outstandingOrders += 1;
    } else {
      buckets.pipeline += amount;
      buckets.pipelineOrders += 1;
    }
  }

  return buckets;
}
