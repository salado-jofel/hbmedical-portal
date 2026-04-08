import { z } from "zod";

export const updateProfileSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required."),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required."),
  phone: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/, "Enter a valid phone number.")
    .optional()
    .or(z.literal("")),
});
