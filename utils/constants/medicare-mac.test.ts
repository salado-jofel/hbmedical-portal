import { describe, expect, it } from "vitest";
import {
  getMedicareMacLabel,
  MEDICARE_MAC_OPTIONS,
} from "@/utils/constants/medicare-mac";

describe("getMedicareMacLabel", () => {
  it("translates the enrollment slug to the contractor's printed name", () => {
    expect(getMedicareMacLabel("palmetto_gba")).toBe("Palmetto GBA, LLC");
  });

  it("covers every option in the list", () => {
    for (const option of MEDICARE_MAC_OPTIONS) {
      expect(getMedicareMacLabel(option.value)).toBe(option.label);
    }
  });

  it("returns null for a missing value", () => {
    expect(getMedicareMacLabel(null)).toBeNull();
    expect(getMedicareMacLabel(undefined)).toBeNull();
    expect(getMedicareMacLabel("")).toBeNull();
    expect(getMedicareMacLabel("   ")).toBeNull();
  });

  it("returns null rather than echoing an unknown slug", () => {
    // A raw slug on a payer-facing form is worse than a blank the clinic can
    // notice and fill in.
    expect(getMedicareMacLabel("not_a_mac")).toBeNull();
    expect(getMedicareMacLabel("PALMETTO_GBA")).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(getMedicareMacLabel(1234)).toBeNull();
    expect(getMedicareMacLabel({})).toBeNull();
  });
});
