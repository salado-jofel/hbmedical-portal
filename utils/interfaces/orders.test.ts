import { describe, expect, it } from "vitest";
import { mapOrder, type RawOrderRecord } from "@/utils/interfaces/orders";

/* mapOrder flattens an order and its line items into one DashboardOrder.

   Until 2026-11-04 the money fields read items[0] instead of summing, so every
   line after the first was discarded. On the admin dashboard that reported
   $40,841 of revenue against a true $86,036.50 — and the number was unstable,
   because order_items is selected with no `order by` and "first" was physical
   row order, which moves after any UPDATE or autovacuum.

   These tests pin the split: money sums every line, the single-product summary
   fields stay on the first one. */

type RawItem = NonNullable<RawOrderRecord["order_items"]>;

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    order_id: "order-1",
    product_id: "prod-1",
    product_name: "Membrane Wrap",
    product_sku: "MW-001",
    unit_price: 100,
    quantity: 1,
    shipping_amount: 0,
    tax_amount: 0,
    subtotal: 100,
    total_amount: 100,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function makeOrder(items: unknown[]): RawOrderRecord {
  return {
    id: "order-1",
    order_number: "HBM-20260101-TEST",
    facility_id: "fac-1",
    order_status: "draft",
    payment_method: null,
    payment_status: "pending",
    invoice_status: "not_applicable",
    fulfillment_status: "pending",
    delivery_status: "not_shipped",
    order_items: items as RawItem,
  } as unknown as RawOrderRecord;
}

describe("mapOrder money fields", () => {
  it("sums total_amount across every line item", () => {
    const order = makeOrder([
      makeItem({ id: "a", total_amount: 1200 }),
      makeItem({ id: "b", total_amount: 1800 }),
      makeItem({ id: "c", total_amount: 600 }),
    ]);
    expect(mapOrder(order).total_amount).toBe(3600);
  });

  it("sums subtotal, shipping and tax too", () => {
    const order = makeOrder([
      makeItem({ id: "a", subtotal: 100, shipping_amount: 10, tax_amount: 5 }),
      makeItem({ id: "b", subtotal: 250, shipping_amount: 15, tax_amount: 20 }),
    ]);
    const mapped = mapOrder(order);
    expect(mapped.subtotal).toBe(350);
    expect(mapped.shipping_amount).toBe(25);
    expect(mapped.tax_amount).toBe(25);
  });

  it("does not depend on the order the items arrive in", () => {
    const items = [
      makeItem({ id: "a", total_amount: 1200 }),
      makeItem({ id: "b", total_amount: 1800 }),
      makeItem({ id: "c", total_amount: 600 }),
    ];
    const forwards = mapOrder(makeOrder(items)).total_amount;
    const backwards = mapOrder(makeOrder([...items].reverse())).total_amount;
    expect(forwards).toBe(backwards);
  });

  it("treats null and missing amounts as zero", () => {
    const order = makeOrder([
      makeItem({ id: "a", total_amount: 500 }),
      makeItem({ id: "b", total_amount: null }),
    ]);
    expect(mapOrder(order).total_amount).toBe(500);
  });

  it("returns zero for an order with no items", () => {
    const mapped = mapOrder(makeOrder([]));
    expect(mapped.total_amount).toBe(0);
    expect(mapped.subtotal).toBe(0);
  });

  it("handles a single-item order unchanged", () => {
    expect(mapOrder(makeOrder([makeItem({ total_amount: 750 })])).total_amount).toBe(750);
  });
});

describe("mapOrder product summary fields", () => {
  /* These describe one line on purpose — OrderCard renders
     "<product_name> × <quantity>" and EditOrderModal prefills from them. A sum
     would be meaningless for unit_price and wrong for the edit form. */
  it("keeps product and unit fields on the first item", () => {
    const mapped = mapOrder(
      makeOrder([
        makeItem({ id: "a", product_name: "Membrane Wrap", quantity: 2, unit_price: 100 }),
        makeItem({ id: "b", product_name: "Collagen Dressing", quantity: 9, unit_price: 55 }),
      ]),
    );
    expect(mapped.product_name).toBe("Membrane Wrap");
    expect(mapped.quantity).toBe(2);
    expect(mapped.unit_price).toBe(100);
  });
});
