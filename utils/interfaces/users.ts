import type { UserRole } from "@/utils/helpers/role";

export type UserStatus = "pending" | "active" | "inactive";

export type StatusFilter = "all" | "active" | "pending" | "inactive";

export type UserData = {
  name: string;
  email: string;
  initials: string;
  role: UserRole;
  isSubRep: boolean;
  userId: string;
};

export interface IUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: NonNullable<UserRole>;
  created_at: string;
  is_active: boolean;
  status: UserStatus;
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
  user?: IUser | null;
  fieldErrors?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    role?: string;
  };
}
