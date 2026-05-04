import { z } from "zod";

export const createUserSchema = z.object({
  first_name: z.string().min(1, "First name is required."),
  last_name: z.string().min(1, "Last name is required."),
  email: z.string().email("Enter a valid email."),
  role: z.enum(["admin", "sales_representative", "support_staff"] as const, {
    error: "Select a valid role.",
  }),
  /** How long the invite link is valid. Used by the createUser server
   *  action to set invite_tokens.expires_at. Constrained to the same
   *  options exposed in EXPIRY_OPTIONS so the UI and server agree. */
  expires_in_days: z.coerce.number().int().refine(
    (n) => [7, 14, 30, 90].includes(n),
    "Pick a valid expiry duration.",
  ),
});
