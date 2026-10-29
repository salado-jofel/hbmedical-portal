import { describe, expect, it } from "vitest";
import { isBlank, mergeFillingBlanks } from "@/utils/helpers/fill-blanks";

describe("isBlank", () => {
  it("treats null and undefined as blank", () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });

  it("treats an empty or whitespace-only string as blank", () => {
    expect(isBlank("")).toBe(true);
    expect(isBlank("   ")).toBe(true);
    expect(isBlank("\n\t")).toBe(true);
  });

  it("does NOT treat false as blank", () => {
    // Regression guard: `a || b` discards false, so "do not contact this
    // patient" would fall through to another source and flip to true.
    expect(isBlank(false)).toBe(false);
  });

  it("does NOT treat 0 as blank", () => {
    // Regression guard: a zero deductible / zero copay is a real answer.
    expect(isBlank(0)).toBe(false);
  });

  it("treats ordinary values as present", () => {
    expect(isBlank("x")).toBe(false);
    expect(isBlank(1)).toBe(false);
    expect(isBlank(true)).toBe(false);
  });
});

const BOOKKEEPING = ["order_id", "ai_extracted", "ai_extracted_at"] as const;

describe("mergeFillingBlanks", () => {
  it("passes the payload through untouched when there is no row yet", () => {
    const payload = { order_id: "o1", facility_npi: "123", patient_dob: null };
    const out = mergeFillingBlanks(null, payload, [...BOOKKEEPING]);
    expect(out.isInsert).toBe(true);
    expect(out.payload).toBe(payload);
  });

  it("treats undefined existing as an insert too", () => {
    const payload = { facility_npi: "123" };
    expect(mergeFillingBlanks(undefined, payload).isInsert).toBe(true);
  });

  it("never replaces a value the row already has", () => {
    // The core guarantee: a provider's correction survives re-extraction.
    const out = mergeFillingBlanks(
      { facility_npi: "PROVIDER-TYPED" },
      { facility_npi: "FROM-AI" },
    );
    expect(out.payload.facility_npi).toBeUndefined();
    expect(out.preserved).toBe(1);
    expect(out.filled).toBe(0);
  });

  it("fills a column that is blank on the row", () => {
    const out = mergeFillingBlanks(
      { facility_npi: null },
      { facility_npi: "FROM-AI" },
    );
    expect(out.payload.facility_npi).toBe("FROM-AI");
    expect(out.filled).toBe(1);
  });

  it("treats an empty string on the row as blank and fills it", () => {
    // A cleared input saves as "", which prints identically to missing.
    const out = mergeFillingBlanks({ facility_npi: "  " }, { facility_npi: "X" });
    expect(out.payload.facility_npi).toBe("X");
  });

  it("does not write a blank payload value over a blank column", () => {
    const out = mergeFillingBlanks({ facility_npi: null }, { facility_npi: "" });
    expect("facility_npi" in out.payload).toBe(false);
    expect(out.filled).toBe(0);
  });

  it("preserves false on the row instead of overwriting it", () => {
    const out = mergeFillingBlanks(
      { ok_to_contact_patient: false },
      { ok_to_contact_patient: true },
    );
    expect("ok_to_contact_patient" in out.payload).toBe(false);
    expect(out.preserved).toBe(1);
  });

  it("preserves 0 on the row instead of overwriting it", () => {
    const out = mergeFillingBlanks({ copay_amount: 0 }, { copay_amount: 25 });
    expect("copay_amount" in out.payload).toBe(false);
  });

  it("writes false and 0 into blank columns", () => {
    const out = mergeFillingBlanks(
      { ok_to_contact_patient: null, copay_amount: null },
      { ok_to_contact_patient: false, copay_amount: 0 },
    );
    expect(out.payload.ok_to_contact_patient).toBe(false);
    expect(out.payload.copay_amount).toBe(0);
    expect(out.filled).toBe(2);
  });

  it("always writes the bookkeeping columns, even over existing values", () => {
    const out = mergeFillingBlanks(
      { order_id: "o1", ai_extracted: true, ai_extracted_at: "2026-01-01" },
      {
        order_id: "o1",
        ai_extracted: true,
        ai_extracted_at: "2026-10-29",
        facility_npi: "X",
      },
      [...BOOKKEEPING],
    );
    expect(out.payload.ai_extracted_at).toBe("2026-10-29");
    expect(out.payload.order_id).toBe("o1");
  });

  it("omits bookkeeping keys the payload does not carry", () => {
    const out = mergeFillingBlanks({}, { facility_npi: "X" }, [...BOOKKEEPING]);
    expect("order_id" in out.payload).toBe(false);
  });

  it("resolves each column independently", () => {
    const out = mergeFillingBlanks(
      { facility_npi: "OWN", facility_tin: null, facility_ptan: "" },
      { facility_npi: "AI", facility_tin: "AI-TIN", facility_ptan: "AI-PTAN" },
    );
    expect(out.payload).toEqual({
      facility_tin: "AI-TIN",
      facility_ptan: "AI-PTAN",
    });
    expect(out.filled).toBe(2);
    expect(out.preserved).toBe(1);
  });

  it("is idempotent — a second run adds nothing", () => {
    // Extraction fires on every facesheet / clinical-doc upload, so run two
    // must be a no-op.
    const payload = { facility_npi: "AI", facility_tin: "AI-TIN" };
    const first = mergeFillingBlanks(null, payload);
    const afterFirst = { ...first.payload };
    const second = mergeFillingBlanks(afterFirst, payload);
    expect(second.payload).toEqual({});
    expect(second.filled).toBe(0);
    expect(second.preserved).toBe(2);
  });

  it("reports nothing to write when the row is fully answered", () => {
    const out = mergeFillingBlanks(
      { a: "1", b: "2" },
      { a: "x", b: "y" },
    );
    expect(out.payload).toEqual({});
    expect(out.filled).toBe(0);
  });
});
