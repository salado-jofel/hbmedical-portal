import { z } from "zod";

// Updates to a provider's own clinic (facilities row). Phone validated as E.164
// to match the facilities_phone_e164_check DB constraint.
export const updateMyClinicSchema = z.object({
  name:           z.string().trim().min(1, "Clinic name is required."),
  phone:          z.string().regex(/^\+[1-9][0-9]{7,14}$/, "Phone must be in E.164 format (e.g. +15551234567)."),
  address_line_1: z.string().trim().min(1, "Street address is required."),
  address_line_2: z.string().trim().optional().default(""),
  city:           z.string().trim().min(1, "City is required."),
  state:          z.string().trim().min(2, "State is required."),
  postal_code:    z.string().trim().min(1, "ZIP code is required."),
});

export type UpdateMyClinicInput = z.infer<typeof updateMyClinicSchema>;
