type UserRole = "sales_representative" | "doctor" | null;

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
