// app/(interfaces)/profiles.ts

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: "admin" | "sales_representative" | "support_staff" | "clinical_provider" | "clinical_staff";
  created_at?: string;
}

export interface UpdateProfilePayload {
  first_name: string;
  last_name: string;
  phone: string | null;
}

export interface IProfileFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
  };
}

export interface IChangePasswordFormState {
  success: boolean;
  error: string | null;
  fieldErrors?: {
    new_password?: string;
    confirm_password?: string;
  };
}
