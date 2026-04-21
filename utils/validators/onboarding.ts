import { z } from "zod";

export const inviteSubRepSchema = z.object({
  email: z.string().email("Enter a valid email address.").min(1, "Email is required."),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(30),
});

export const clinicStaffInviteSchema = z.object({
  email: z.string().email("Enter a valid email address.").min(1, "Email is required."),
  expires_in_days: z.coerce.number().int().min(1).max(365).default(30),
});

export const repSetupSchema = z.object({
  first_name: z.string().min(1, "First name is required.").transform((s) => s.trim()),
  last_name: z.string().min(1, "Last name is required.").transform((s) => s.trim()),
  practice_name: z.string().min(1, "Account name is required."),
  phone: z.string().min(1, "Account phone is required."),
  address_line_1: z.string().min(1, "Street address is required."),
  city: z.string().min(1, "City is required."),
  state: z.string().min(2, "State is required."),
  postal_code: z.string().min(1, "ZIP code is required."),
});
