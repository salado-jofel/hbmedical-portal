import { describe, expect, it } from "vitest";
import { resolveOrderFormDob } from "@/utils/helpers/order-form-dob";

describe("resolveOrderFormDob", () => {
  it("prefers the value saved on the form", () => {
    expect(
      resolveOrderFormDob({
        formPatientDob: "1982-05-12",
        extractedDob: "1990-01-01",
        patientRecordDob: "1975-03-03",
      }),
    ).toBe("1982-05-12");
  });

  it("falls back to the extracted DOB, then the patient record", () => {
    expect(
      resolveOrderFormDob({ extractedDob: "1990-01-01", patientRecordDob: "1975-03-03" }),
    ).toBe("1990-01-01");
    expect(resolveOrderFormDob({ patientRecordDob: "1975-03-03" })).toBe("1975-03-03");
  });

  it("returns null when no source knows the DOB", () => {
    expect(resolveOrderFormDob({})).toBeNull();
    expect(
      resolveOrderFormDob({
        formPatientDob: null,
        extractedDob: undefined,
        patientRecordDob: "",
      }),
    ).toBeNull();
  });

  it("treats whitespace as unknown rather than as a date", () => {
    expect(resolveOrderFormDob({ formPatientDob: "   ", patientRecordDob: "1975-03-03" }))
      .toBe("1975-03-03");
  });

  it("trims a padded value instead of passing it through", () => {
    expect(resolveOrderFormDob({ formPatientDob: " 1982-05-12 " })).toBe("1982-05-12");
  });

  /* ── The regression this helper exists for ── */
  it("has no date-of-service input at all", () => {
    // The original defect was a DOB that fell back to the service date via
    // order_form.patient_date. The type has no slot for either, so a future
    // edit cannot reintroduce the fallback without changing this signature.
    expect(Object.keys(resolveOrderFormDob)).not.toContain("dateOfService");
    const dateOfService = "2026-10-27";
    const resolved = resolveOrderFormDob({
      formPatientDob: null,
      extractedDob: null,
      patientRecordDob: null,
    });
    expect(resolved).toBeNull();
    expect(resolved).not.toBe(dateOfService);
  });

  it("does not invent today's date when the DOB is unknown", () => {
    // Ben's production screenshot showed a DOB equal to that day's date on a
    // form marked "All required fields complete — ready for signing".
    const today = new Date().toISOString().slice(0, 10);
    expect(resolveOrderFormDob({})).not.toBe(today);
  });
});

describe("resolveOrderFormDob — extraction source ordering", () => {
  /* Regression for a miss found by an end-to-end run on 2026-10-30: the
     route passed only the IVR's extracted DOB and the patient record. The AI
     returned null for the IVR DOB, and the patient record is created later in
     the same run, so order_form.patient_dob was written null even though the
     1500 extraction had read 1982-05-12 off the facesheet. */
  it("uses the 1500 DOB when the IVR extraction came back empty", () => {
    expect(
      resolveOrderFormDob({
        formPatientDob: null,
        extractedDob: "1982-05-12",
        ivrExtractedDob: null,
        patientRecordDob: null, // patient row does not exist yet at this point
      }),
    ).toBe("1982-05-12");
  });

  it("falls back to the IVR DOB when the 1500 has none", () => {
    expect(
      resolveOrderFormDob({ extractedDob: null, ivrExtractedDob: "1975-03-03" }),
    ).toBe("1975-03-03");
  });

  it("prefers the 1500 DOB over the IVR's when both are present", () => {
    expect(
      resolveOrderFormDob({ extractedDob: "1982-05-12", ivrExtractedDob: "1975-03-03" }),
    ).toBe("1982-05-12");
  });

  it("still lets a clinician correction outrank every extracted source", () => {
    expect(
      resolveOrderFormDob({
        formPatientDob: "1990-07-04",
        extractedDob: "1982-05-12",
        ivrExtractedDob: "1975-03-03",
        patientRecordDob: "1960-01-01",
      }),
    ).toBe("1990-07-04");
  });
});
