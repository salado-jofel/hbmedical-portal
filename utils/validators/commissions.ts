import { z } from "zod";
import { uuidString } from "./shared";

export const setCommissionRateSchema = z.object({
  rep_id:           uuidString("Invalid rep ID."),
  rate_percent:     z.coerce.number().min(0, "Rate must be at least 0.").max(100, "Rate cannot exceed 100."),
  // Optional on purpose. When the form does not submit an override, the server
  // carries the rep's current value forward rather than resetting it to 0 —
  // the override is the parent rep's earning, not the caller's to clear.
  override_percent: z.coerce.number().min(0, "Override must be at least 0.").max(100, "Override cannot exceed 100.").optional(),
});
