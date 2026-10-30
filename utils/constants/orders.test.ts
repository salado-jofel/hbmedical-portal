import { describe, expect, it } from "vitest";
import {
  isInvoiceVisibleForStatus,
  isIvrLockedForUser,
  isItemsEditable,
  isOrderFullyLocked,
  ORDER_STATUS_FILTER_OPTIONS,
} from "@/utils/constants/orders";

/* Every real order status, taken from the filter options so this list cannot
   drift away from the one the UI offers. "all" is a filter pseudo-status. */
const ALL_STATUSES = ORDER_STATUS_FILTER_OPTIONS.map((o) => o.value).filter(
  (v) => v !== "all",
);

describe("isInvoiceVisibleForStatus", () => {
  it("is visible at draft", () => {
    // The change the client asked for on 2026-10-30: an invoice has to be
    // raisable as soon as the script arrives, not only once the order
    // reaches review.
    expect(isInvoiceVisibleForStatus("draft")).toBe(true);
  });

  it("is visible at pending_signature", () => {
    expect(isInvoiceVisibleForStatus("pending_signature")).toBe(true);
  });

  it("is visible for the whole lifecycle", () => {
    for (const status of ALL_STATUSES) {
      expect(isInvoiceVisibleForStatus(status), status).toBe(true);
    }
  });

  it("is not visible for an unknown or missing status", () => {
    // Guards the `!!status &&` branch: a null status must not render the tab.
    expect(isInvoiceVisibleForStatus(null)).toBe(false);
    expect(isInvoiceVisibleForStatus(undefined)).toBe(false);
    expect(isInvoiceVisibleForStatus("")).toBe(false);
    expect(isInvoiceVisibleForStatus("not_a_status")).toBe(false);
  });
});

describe("isOrderFullyLocked", () => {
  /* Visibility and editability are separate gates. Making the invoice visible
     at draft must not have made it editable where it previously was not. */
  it("leaves a draft invoice editable", () => {
    expect(isOrderFullyLocked("draft", null, false)).toBe(false);
  });

  it("still locks once the patient has signed", () => {
    expect(isOrderFullyLocked("draft", "2026-10-30T00:00:00Z", false)).toBe(true);
    expect(isOrderFullyLocked("shipped", "2026-10-30T00:00:00Z", false)).toBe(true);
  });

  it("still locks after approval", () => {
    expect(isOrderFullyLocked("approved", null, false)).toBe(true);
    expect(isOrderFullyLocked("delivered", null, false)).toBe(true);
  });

  it("admin bypasses the lock, patient signature included", () => {
    expect(isOrderFullyLocked("delivered", "2026-10-30T00:00:00Z", true)).toBe(false);
  });
});

describe("isItemsEditable", () => {
  it("allows edits only in the pre-review statuses", () => {
    expect(isItemsEditable("draft")).toBe(true);
    expect(isItemsEditable("pending_signature")).toBe(true);
    expect(isItemsEditable("additional_info_needed")).toBe(true);
    expect(isItemsEditable("manufacturer_review")).toBe(false);
    expect(isItemsEditable("delivered")).toBe(false);
    expect(isItemsEditable(null)).toBe(false);
  });
});

describe("isIvrLockedForUser", () => {
  it("leaves the IVR open before review", () => {
    expect(isIvrLockedForUser("draft", false)).toBe(false);
    expect(isIvrLockedForUser("pending_signature", false)).toBe(false);
  });

  it("locks the clinic out from manufacturer_review on", () => {
    // So an IVR cannot change under the manufacturer once it is queued.
    for (const status of [
      "manufacturer_review",
      "additional_info_needed",
      "approved",
      "shipped",
      "delivered",
      "canceled",
    ]) {
      expect(isIvrLockedForUser(status, false), status).toBe(true);
    }
  });

  /* ── The defect this helper was added to fix ── */
  it("never locks admin, at any status", () => {
    // The lock had no admin bypass, so admin was shut out of the IVR from
    // manufacturer_review onward — the exact statuses an admin works in, and
    // why a wrong MAC or TIN on a submitted order could not be corrected.
    // The client's rule is that admin may edit everything except the Order
    // Form.
    for (const status of ALL_STATUSES) {
      expect(isIvrLockedForUser(status, true), status).toBe(false);
    }
  });

  it("is not locked for an unknown or missing status", () => {
    expect(isIvrLockedForUser(null, false)).toBe(false);
    expect(isIvrLockedForUser(undefined, false)).toBe(false);
    expect(isIvrLockedForUser("not_a_status", false)).toBe(false);
  });

  it("locks the IVR for exactly the statuses that lock order items out of editing", () => {
    // IVR_LOCKED_STATUSES and ITEMS_EDITABLE_STATUSES should stay
    // complementary: additional_info_needed is the deliberate exception,
    // where items reopen but the IVR stays locked to non-admins.
    for (const status of ALL_STATUSES) {
      if (status === "additional_info_needed") continue;
      expect(isIvrLockedForUser(status, false), status).toBe(!isItemsEditable(status));
    }
  });
});
