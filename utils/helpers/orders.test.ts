import { describe, expect, it } from "vitest";
import { getSingleRelation } from "@/utils/helpers/orders";

/* Supabase returns an embedded one-to-one relation as either an object or a
   single-element array depending on how the FK hint is written, so every read
   path funnels through getSingleRelation. */
describe("getSingleRelation", () => {
  it("returns an object relation unchanged", () => {
    const row = { id: "a" };
    expect(getSingleRelation(row)).toBe(row);
  });

  it("unwraps a single-element array", () => {
    const row = { id: "a" };
    expect(getSingleRelation([row])).toBe(row);
  });

  it("takes the first element of a multi-element array", () => {
    expect(getSingleRelation([{ id: "a" }, { id: "b" }])).toEqual({ id: "a" });
  });

  it("returns null for an empty array", () => {
    expect(getSingleRelation([])).toBeNull();
  });

  it("returns null for null", () => {
    expect(getSingleRelation(null)).toBeNull();
  });
});
