import { describe, expect, it } from "vitest";
import {
  buildRepLedgerTotals,
  buildRepPipelineTotals,
  classifyOrderMoney,
  estimateCommission,
  isOverdueForCollection,
  ledgerRowAmount,
  mergeRepPipelineTotals,
} from "./rep-pipeline";

describe("classifyOrderMoney", () => {
  it("puts an early-workflow order in progress", () => {
    for (const orderStatus of [
      "draft",
      "pending_signature",
      "manufacturer_review",
      "additional_info_needed",
    ]) {
      expect(
        classifyOrderMoney({
          orderStatus,
          paymentStatus: "pending",
          invoiceStatus: "not_applicable",
        }),
      ).toBe("in_progress");
    }
  });

  it("counts an approved/shipped/delivered unbilled order as fulfilled", () => {
    for (const orderStatus of ["approved", "shipped", "delivered"]) {
      expect(
        classifyOrderMoney({
          orderStatus,
          paymentStatus: "pending",
          invoiceStatus: "not_applicable",
        }),
      ).toBe("fulfilled");
    }
  });

  it("treats a draft invoice as not yet billed", () => {
    expect(
      classifyOrderMoney({
        orderStatus: "shipped",
        paymentStatus: "pending",
        invoiceStatus: "draft",
      }),
    ).toBe("fulfilled");
  });

  it("counts every outstanding billed state as collectible", () => {
    for (const invoiceStatus of [
      "issued",
      "sent",
      "partially_paid",
      "overdue",
    ]) {
      expect(
        classifyOrderMoney({
          orderStatus: "shipped",
          paymentStatus: "pending",
          invoiceStatus,
        }),
      ).toBe("collectible");
    }
  });

  it("reads the money axis before the workflow axis", () => {
    // Shipped *and* paid is paid, not fulfilled.
    expect(
      classifyOrderMoney({
        orderStatus: "shipped",
        paymentStatus: "paid",
        invoiceStatus: "paid",
      }),
    ).toBe("paid");

    // Approved *and* overdue is collectible, not fulfilled.
    expect(
      classifyOrderMoney({
        orderStatus: "approved",
        paymentStatus: "pending",
        invoiceStatus: "overdue",
      }),
    ).toBe("collectible");
  });

  it("counts an order paid on either axis", () => {
    expect(
      classifyOrderMoney({ orderStatus: "shipped", paymentStatus: "paid" }),
    ).toBe("paid");
    expect(
      classifyOrderMoney({ orderStatus: "shipped", invoiceStatus: "paid" }),
    ).toBe("paid");
  });

  it("treats a partial refund as paid — the money did arrive", () => {
    expect(
      classifyOrderMoney({
        orderStatus: "delivered",
        paymentStatus: "partially_refunded",
      }),
    ).toBe("paid");
  });

  it("excludes canceled, refunded and voided money", () => {
    expect(classifyOrderMoney({ orderStatus: "canceled" })).toBe("excluded");
    expect(classifyOrderMoney({ paymentStatus: "canceled" })).toBe("excluded");
    expect(classifyOrderMoney({ paymentStatus: "refunded" })).toBe("excluded");
    expect(classifyOrderMoney({ invoiceStatus: "void" })).toBe("excluded");
  });

  it("excludes a canceled order even when it was paid first", () => {
    // A refund reverses the money; the forecast must not keep claiming it.
    expect(
      classifyOrderMoney({
        orderStatus: "canceled",
        paymentStatus: "paid",
        invoiceStatus: "paid",
      }),
    ).toBe("excluded");
  });

  it("falls back to in_progress on missing/unknown statuses", () => {
    expect(classifyOrderMoney({})).toBe("in_progress");
    expect(
      classifyOrderMoney({ orderStatus: null, paymentStatus: null, invoiceStatus: null }),
    ).toBe("in_progress");
  });
});

describe("isOverdueForCollection", () => {
  it("is true only for a billed, outstanding, past-due order", () => {
    expect(
      isOverdueForCollection({
        orderStatus: "shipped",
        paymentStatus: "pending",
        invoiceStatus: "overdue",
      }),
    ).toBe(true);
  });

  it("is false once the overdue invoice is paid", () => {
    expect(
      isOverdueForCollection({
        orderStatus: "shipped",
        paymentStatus: "paid",
        invoiceStatus: "overdue",
      }),
    ).toBe(false);
  });

  it("is false for an unbilled order no matter how old", () => {
    expect(
      isOverdueForCollection({
        orderStatus: "delivered",
        invoiceStatus: "not_applicable",
      }),
    ).toBe(false);
  });
});

describe("estimateCommission", () => {
  it("applies the rate as a percentage", () => {
    expect(estimateCommission(1000, 10)).toBe(100);
    expect(estimateCommission(2500, 7.5)).toBe(187.5);
  });

  it("returns null when no rate is known, rather than a confident zero", () => {
    expect(estimateCommission(1000, null)).toBeNull();
    expect(estimateCommission(1000, undefined)).toBeNull();
  });

  it("returns null on non-finite input", () => {
    expect(estimateCommission(1000, Number.NaN)).toBeNull();
    expect(estimateCommission(Number.POSITIVE_INFINITY, 10)).toBeNull();
  });

  it("returns zero for a real rate of zero", () => {
    // Distinct from null: the rate is known and it is nothing.
    expect(estimateCommission(1000, 0)).toBe(0);
  });
});

describe("buildRepPipelineTotals", () => {
  const orders = [
    { orderStatus: "draft", amount: 100 },
    { orderStatus: "pending_signature", amount: 200 },
    { orderStatus: "approved", invoiceStatus: "not_applicable", amount: 400 },
    { orderStatus: "shipped", invoiceStatus: "sent", amount: 800 },
    { orderStatus: "shipped", invoiceStatus: "overdue", amount: 1600 },
    { orderStatus: "delivered", paymentStatus: "paid", amount: 3200 },
    { orderStatus: "canceled", amount: 6400 },
  ];

  it("sorts orders and sums amounts per bucket", () => {
    const totals = buildRepPipelineTotals(orders, 10);

    expect(totals.buckets.in_progress.orders).toBe(2);
    expect(totals.buckets.in_progress.orderAmount).toBe(300);

    expect(totals.buckets.fulfilled.orders).toBe(1);
    expect(totals.buckets.fulfilled.orderAmount).toBe(400);

    expect(totals.buckets.collectible.orders).toBe(2);
    expect(totals.buckets.collectible.orderAmount).toBe(2400);

    expect(totals.buckets.paid.orders).toBe(1);
    expect(totals.buckets.paid.orderAmount).toBe(3200);
  });

  it("keeps canceled money out of every bucket", () => {
    const totals = buildRepPipelineTotals(orders, 10);
    const counted =
      totals.buckets.in_progress.orderAmount +
      totals.buckets.fulfilled.orderAmount +
      totals.buckets.collectible.orderAmount +
      totals.buckets.paid.orderAmount;

    expect(counted).toBe(6300);
    expect(totals.excludedOrders).toBe(1);
  });

  it("tracks the overdue chase list separately", () => {
    const totals = buildRepPipelineTotals(orders, 10);
    expect(totals.overdueOrders).toBe(1);
    expect(totals.overdueAmount).toBe(1600);
  });

  it("estimates commission per bucket at the rep's rate", () => {
    const totals = buildRepPipelineTotals(orders, 10);
    expect(totals.buckets.collectible.commissionEstimate).toBe(240);
    expect(totals.buckets.paid.commissionEstimate).toBe(320);
  });

  it("leaves estimates null when the rep has no rate set", () => {
    const totals = buildRepPipelineTotals(orders, null);
    expect(totals.buckets.collectible.commissionEstimate).toBeNull();
    // Counts and order amounts still work — only the commission is unknown.
    expect(totals.buckets.collectible.orderAmount).toBe(2400);
  });

  it("returns zeroed buckets for a rep with no orders", () => {
    const totals = buildRepPipelineTotals([], 10);
    expect(totals.buckets.in_progress.orders).toBe(0);
    expect(totals.buckets.paid.orderAmount).toBe(0);
    expect(totals.overdueOrders).toBe(0);
    expect(totals.excludedOrders).toBe(0);
  });

  it("treats a non-finite amount as zero instead of poisoning the total", () => {
    const totals = buildRepPipelineTotals(
      [{ orderStatus: "approved", amount: Number.NaN }],
      10,
    );
    expect(totals.buckets.fulfilled.orders).toBe(1);
    expect(totals.buckets.fulfilled.orderAmount).toBe(0);
  });
});

describe("mergeRepPipelineTotals", () => {
  // A parent rep's override: each sub-rep's orders valued at that sub-rep's
  // OWN override_percent, then summed. Two sub-reps on different rates is the
  // case a single blended rate would get wrong.
  const subRepA = buildRepPipelineTotals(
    [
      { orderStatus: "approved", amount: 1000 },
      { orderStatus: "shipped", invoiceStatus: "overdue", amount: 500 },
    ],
    5, // 5% override
  );
  const subRepB = buildRepPipelineTotals(
    [{ orderStatus: "approved", amount: 1000 }],
    10, // 10% override
  );

  it("values each sub-rep at their own rate rather than a blended one", () => {
    const merged = mergeRepPipelineTotals([subRepA, subRepB]);
    // fulfilled: A 1000 @5% = 50, B 1000 @10% = 100 → 150.
    // A single blended rate over the combined 2000 could not produce this.
    expect(merged.buckets.fulfilled.orderAmount).toBe(2000);
    expect(merged.buckets.fulfilled.commissionEstimate).toBe(150);
  });

  it("sums counts, amounts and the overdue chase list", () => {
    const merged = mergeRepPipelineTotals([subRepA, subRepB]);
    expect(merged.buckets.fulfilled.orders).toBe(2);
    expect(merged.buckets.collectible.orders).toBe(1);
    expect(merged.buckets.collectible.commissionEstimate).toBe(25); // 500 @5%
    expect(merged.overdueOrders).toBe(1);
    expect(merged.overdueAmount).toBe(500);
  });

  it("skips a rateless sub-rep's commission without nulling the whole sum", () => {
    const rateless = buildRepPipelineTotals(
      [{ orderStatus: "approved", amount: 9999 }],
      null,
    );
    const merged = mergeRepPipelineTotals([subRepB, rateless]);
    // B's 100 survives; the rateless sub-rep contributes order volume only.
    expect(merged.buckets.fulfilled.commissionEstimate).toBe(100);
    expect(merged.buckets.fulfilled.orders).toBe(2);
    expect(merged.buckets.fulfilled.orderAmount).toBe(10999);
  });

  it("leaves the estimate null when no sub-rep has a rate at all", () => {
    const a = buildRepPipelineTotals([{ orderStatus: "approved", amount: 100 }], null);
    const b = buildRepPipelineTotals([{ orderStatus: "approved", amount: 200 }], null);
    expect(mergeRepPipelineTotals([a, b]).buckets.fulfilled.commissionEstimate).toBeNull();
  });

  it("returns zeroed totals for a parent with no sub-reps", () => {
    const merged = mergeRepPipelineTotals([]);
    expect(merged.buckets.paid.orders).toBe(0);
    expect(merged.buckets.paid.commissionEstimate).toBeNull();
    expect(merged.overdueOrders).toBe(0);
  });

  it("does not mutate the inputs it merges", () => {
    const before = subRepB.buckets.fulfilled.commissionEstimate;
    mergeRepPipelineTotals([subRepA, subRepB]);
    mergeRepPipelineTotals([subRepA, subRepB]);
    expect(subRepB.buckets.fulfilled.commissionEstimate).toBe(before);
  });
});

describe("ledgerRowAmount", () => {
  it("prefers the settled final_amount over the raw commission", () => {
    expect(
      ledgerRowAmount({ finalAmount: 90, commissionAmount: 100, adjustment: 5 }),
    ).toBe(90);
  });

  it("falls back to commission plus adjustment", () => {
    expect(ledgerRowAmount({ commissionAmount: 100, adjustment: 5 })).toBe(105);
    expect(ledgerRowAmount({ commissionAmount: 100 })).toBe(100);
  });

  it("treats a negative adjustment as a deduction", () => {
    expect(ledgerRowAmount({ commissionAmount: 100, adjustment: -25 })).toBe(75);
  });

  it("reads a zero final_amount as zero, not as missing", () => {
    // A settled-to-nothing row must not silently fall back to the raw amount.
    expect(ledgerRowAmount({ finalAmount: 0, commissionAmount: 100 })).toBe(0);
  });

  it("returns zero rather than NaN on unusable input", () => {
    expect(ledgerRowAmount({})).toBe(0);
    expect(ledgerRowAmount({ finalAmount: Number.NaN })).toBe(0);
  });
});

describe("buildRepLedgerTotals", () => {
  const rows = [
    { type: "direct", status: "pending", commissionAmount: 100 },
    { type: "direct", status: "approved", commissionAmount: 200 },
    { type: "direct", status: "paid", commissionAmount: 400 },
    { type: "override", status: "pending", commissionAmount: 10 },
    { type: "override", status: "paid", commissionAmount: 20 },
    { type: "direct", status: "void", commissionAmount: 9999 },
  ];

  it("splits recorded commission by lifecycle stage", () => {
    const { all } = buildRepLedgerTotals(rows);
    expect(all.pending).toBe(110);
    expect(all.approved).toBe(200);
    expect(all.paid).toBe(420);
    expect(all.total).toBe(730);
  });

  it("keeps direct and override earnings apart", () => {
    const { direct, override } = buildRepLedgerTotals(rows);
    expect(direct.total).toBe(700);
    expect(override.total).toBe(30);
    expect(override.approved).toBe(0);
  });

  it("excludes voided commission entirely", () => {
    const { all, direct } = buildRepLedgerTotals(rows);
    // The 9999 void appears in no stage and in no total.
    expect(all.total).toBe(730);
    expect(direct.pending + direct.approved + direct.paid).toBe(direct.total);
  });

  it("keeps each side's stages summing to its own total", () => {
    const { direct, override, all } = buildRepLedgerTotals(rows);
    for (const side of [direct, override, all]) {
      expect(side.pending + side.approved + side.paid).toBe(side.total);
    }
    expect(direct.total + override.total).toBe(all.total);
  });

  it("counts an unknown status as pending instead of dropping the money", () => {
    // Dropping it would quietly shrink the rep's earned total; "not yet paid
    // out" is the conservative reading.
    const { all } = buildRepLedgerTotals([
      { type: "direct", status: "on_hold", commissionAmount: 50 },
      { type: "direct", status: null, commissionAmount: 25 },
    ]);
    expect(all.pending).toBe(75);
    expect(all.paid).toBe(0);
    expect(all.total).toBe(75);
  });

  it("treats a row with no type as direct, not override", () => {
    const { direct, override } = buildRepLedgerTotals([
      { status: "paid", commissionAmount: 60 },
    ]);
    expect(direct.paid).toBe(60);
    expect(override.total).toBe(0);
  });

  it("returns zeroed totals for a rep with no commission rows", () => {
    const { all, direct, override } = buildRepLedgerTotals([]);
    expect(all.total).toBe(0);
    expect(direct.total).toBe(0);
    expect(override.total).toBe(0);
  });
});
