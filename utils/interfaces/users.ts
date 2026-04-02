import type { UserRole } from "@/utils/helpers/role";

export interface IUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: NonNullable<UserRole>;
  created_at: string;
  is_active: boolean;
  facility: {
    id: string;
    name: string;
    status: string | null;
    city: string | null;
    state: string | null;
  } | null;
}

export interface IUserFormState {
  error?: string | null;
  success?: boolean;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: string;
  };
}
