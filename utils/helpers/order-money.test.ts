import { describe, expect, it } from "vitest";
import {
  bucketOrderMoney,
  isCollected,
  isOutstanding,
  type OrderMoneyRow,
} from "@/utils/helpers/order-money";

/* The admin dashboard used to report one "Total Revenue" that summed every
   non-canceled order regardless of payment state. On dev that read $86,036.50
   of "revenue" when only $29,376.00 had actually been collected, $1,490.00 was
   invoiced and unpaid, and $55,170.50 had never been billed at all.

   These tests pin the three-way split and, in particular, that the two status
   axes are read in the right order: payment_status decides first. */

function order(overrides: Partial<OrderMoneyRow> = {}): OrderMoneyRow {
  return {
    order_status: "approved",
    payment_status: "pending",
    invoice_status: "not_applicable",
    total_amount: 100,
    ...overrides,
  };
}

describe("isCollected", () => {
  it("is true only for payment_status paid", () => {
    expect(isCollected(order({ payment_status: "paid" }))).toBe(true);
    expect(isCollected(order({ payment_status: "pending" }))).toBe(false);
    expect(isCollected(order({ payment_status: "failed" }))).toBe(false);
    expect(isCollected(order({ payment_status: "refunded" }))).toBe(false);
  });
});

describe("isOutstanding", () => {
  it("counts invoices that are issued, sent, partially paid or overdue", () => {
    for (const invoice_status of ["issued", "sent", "partially_paid", "overdue"]) {
      expect(isOutstanding(order({ invoice_status }))).toBe(true);
    }
  });

  it("excludes invoices that are draft, void or not applicable", () => {
    for (const invoice_status of ["draft", "void", "not_applicable"]) {
      expect(isOutstanding(order({ invoice_status }))).toBe(false);
    }
  });

  it("is false once the order is paid, whatever the invoice says", () => {
    // Stripe stamps invoice_status and payment_status from the same webhook,
    // but they can lag each other. Paid wins, so money is never double-counted.
    expect(
      isOutstanding(order({ payment_status: "paid", invoice_status: "issued" })),
    ).toBe(false);
  });

  it("is false when there is no invoice status at all", () => {
    expect(isOutstanding(order({ invoice_status: null }))).toBe(false);
  });
});

describe("bucketOrderMoney", () => {
  it("splits collected, outstanding and pipeline", () => {
    const result = bucketOrderMoney([
      order({ payment_status: "paid", total_amount: 1200 }),
      order({ payment_status: "paid", total_amount: 800 }),
      order({ invoice_status: "issued", total_amount: 500 }),
      order({ invoice_status: "not_applicable", total_amount: 300 }),
      order({ order_status: "draft", invoice_status: "draft", total_amount: 250 }),
    ]);

    expect(result.collected).toBe(2000);
    expect(result.collectedOrders).toBe(2);
    expect(result.outstanding).toBe(500);
    expect(result.outstandingOrders).toBe(1);
    expect(result.pipeline).toBe(550);
    expect(result.pipelineOrders).toBe(2);
  });

  it("always has the three buckets sum to the total", () => {
    const result = bucketOrderMoney([
      order({ payment_status: "paid", total_amount: 1200 }),
      order({ invoice_status: "overdue", total_amount: 500 }),
      order({ total_amount: 300 }),
      order({ payment_status: "failed", invoice_status: "void", total_amount: 75 }),
    ]);
    expect(result.collected + result.outstanding + result.pipeline).toBe(result.total);
    expect(result.total).toBe(2075);
  });

  it("excludes canceled orders from every bucket", () => {
    const result = bucketOrderMoney([
      order({ order_status: "canceled", payment_status: "paid", total_amount: 9999 }),
      order({ payment_status: "paid", total_amount: 100 }),
    ]);
    expect(result.collected).toBe(100);
    expect(result.total).toBe(100);
  });

  it("treats a missing amount as zero but still counts the order", () => {
    const result = bucketOrderMoney([
      order({ payment_status: "paid", total_amount: null }),
    ]);
    expect(result.collected).toBe(0);
    expect(result.collectedOrders).toBe(1);
  });

  it("returns an empty split for no orders", () => {
    const result = bucketOrderMoney([]);
    expect(result.total).toBe(0);
    expect(result.collectedOrders).toBe(0);
    expect(result.outstandingOrders).toBe(0);
    expect(result.pipelineOrders).toBe(0);
  });
});
