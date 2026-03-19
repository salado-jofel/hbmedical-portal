// app/(interfaces)/profiles.ts

export interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: "sales_representative" | "doctor";
  created_at?: string;
}

export interface UpdateProfilePayload {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}
