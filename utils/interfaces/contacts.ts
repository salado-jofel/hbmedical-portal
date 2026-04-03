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
  contact?: IContact;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
    title?: string;
    email?: string;
    phone?: string;
    preferred_contact?: string;
    notes?: string;
  };
}

/* -------------------------------------------------------------------------- */
/* Zod schemas for validation                                                 */
/* -------------------------------------------------------------------------- */

export const createContactSchema = z.object({
  first_name:        z.string().trim().min(1, "First name is required."),
  last_name:         z.string().trim().min(1, "Last name is required."),
  title:             z.string().trim().min(1, "Title is required."),
  email:             z.string().trim().email("Enter a valid email."),
  phone:             z
                       .string()
                       .trim()
                       .min(1, "Phone number is required.")
                       .regex(/^\+[1-9][0-9]{7,14}$/, "Enter a valid phone number."),
  preferred_contact: contactPreferredContactSchema,
  notes:             z.string().trim().optional(),
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
  title: string;
  email: string;
  phone: string;
  preferred_contact: ContactPreferredContact;
  notes: string | null;
  is_active: true;
};

export type UpdateContactPayload = {
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  preferred_contact: ContactPreferredContact;
  notes: string | null;
};
