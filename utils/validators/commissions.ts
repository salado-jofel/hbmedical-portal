import { z } from "zod";

export const setCommissionRateSchema = z.object({
  rep_id:           z.string().uuid("Invalid rep ID."),
  rate_percent:     z.coerce.number().min(0, "Rate must be at least 0.").max(100, "Rate cannot exceed 100."),
  override_percent: z.coerce.number().min(0, "Override must be at least 0.").max(100, "Override cannot exceed 100."),
});
