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
  // Only meaningful for sales reps (top-level + sub). Drives the post-login
  // gate that blocks portal access until Stripe Connect onboarding finishes.
  // Null/false for non-rep roles.
  stripeDetailsSubmitted: boolean;
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
  // Set when an action succeeded but a non-critical side effect failed
  // (e.g. user was deleted from our DB but the orphaned Stripe Connect
  // account couldn't be cleaned up). Surfaces a yellow toast in the UI.
  warning?: string;
}
