import { z } from "zod";
import { uuidString } from "./shared";

export const setQuotaSchema = z.object({
  rep_id:        uuidString("Please select a rep."),
  period:        z.string().regex(/^\d{4}-\d{2}$/, "Period must be in YYYY-MM format."),
  target_amount: z.coerce.number().min(0, "Target amount must be 0 or greater."),
});
