import { z } from "zod";

/* -------------------------------------------------------------------------- */
/* Enums / literal types                                                      */
/* -------------------------------------------------------------------------- */

export const contactPreferredContactSchema = z.enum(["email", "phone", "either"]);
export type ContactPreferredContact = z.infer<typeof contactPreferredContactSchema>;

/* -------------------------------------------------------------------------- */
/* Core contact interface                                                     */
/* -------------------------------------------------------------------------- */

export interface IContact {
  id: string;
  facility_id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  preferred_contact: ContactPreferredContact;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/* Form state (useActionState return shape)                                   */
/* -------------------------------------------------------------------------- */

export interface IContactFormState {
  error: string | null;
  success: boolean;
}

/* -------------------------------------------------------------------------- */
/* Zod schemas for validation                                                 */
/* -------------------------------------------------------------------------- */

export const createContactSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required."),
  last_name: z.string().trim().min(1, "Last name is required."),
  title: z.string().trim().nullable().optional(),
  email: z
    .string()
    .trim()
    .email("Invalid email address.")
    .nullable()
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().nullable().optional(),
  preferred_contact: contactPreferredContactSchema.default("either"),
  notes: z.string().trim().nullable().optional(),
});

export const updateContactSchema = createContactSchema;

export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

/* -------------------------------------------------------------------------- */
/* Insert / update payload types                                              */
/* -------------------------------------------------------------------------- */

export type InsertContactPayload = {
  facility_id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  preferred_contact: ContactPreferredContact;
  notes: string | null;
  is_active: true;
};

export type UpdateContactPayload = {
  first_name: string;
  last_name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  preferred_contact: ContactPreferredContact;
  notes: string | null;
};
