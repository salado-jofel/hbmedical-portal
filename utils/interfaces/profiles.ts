// app/(interfaces)/profiles.ts

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "admin" | "sales_representative" | "support_staff" | "clinical_provider" | "clinical_staff";
  created_at?: string;
}

export interface UpdateProfilePayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}
