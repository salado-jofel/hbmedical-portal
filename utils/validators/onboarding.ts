import { z } from "zod";

const subRepCommissionPct = z.coerce
  .number()
  .min(0, "Must be ≥ 0%.")
  .max(100, "Must be ≤ 100%.");

export const inviteSubRepSchema = z.object({
  email: z.string().email("Enter a valid email address.").min(1, "Email is required."),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(30),
  /** Commission rate (%) the invited sub-rep earns on their own sales. */
  commission_rate: subRepCommissionPct,
  /** Commission override (%) the parent rep earns on this sub-rep's sales. */
  commission_override: subRepCommissionPct,
});

export const clinicStaffInviteSchema = z.object({
  email: z.string().email("Enter a valid email address.").min(1, "Email is required."),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(30),
});

export const repSetupSchema = z.object({
  first_name: z.string().min(1, "First name is required.").transform((s) => s.trim()),
  last_name: z.string().min(1, "Last name is required.").transform((s) => s.trim()),
  // Company name + Company number are optional — some sales reps operate as
  // individuals with no company entity. Server-side fallback "N/A" fills the
  // NOT NULL `facilities.name`.
  practice_name: z.string().optional().default(""),
  phone: z.string().optional().default(""),
  address_line_1: z.string().min(1, "Street address is required."),
  city: z.string().min(1, "City is required."),
  state: z.string().min(2, "State is required."),
  postal_code: z.string().min(1, "ZIP code is required."),
});
