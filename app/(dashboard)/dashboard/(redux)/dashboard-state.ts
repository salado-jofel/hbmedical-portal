import type { UserRole } from "@/utils/helpers/role";
export type { UserRole };

export interface UserState {
  name: string;
  email: string;
  initials: string;
  role: UserRole;
  isSidebarOpen: boolean;
}

export const initialState: UserState = {
  name: "",
  email: "",
  initials: "",
  role: null,
  isSidebarOpen: false,
};
