import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState, UserState } from "./dashboard-state";

const dashboardSlice = createSlice({
  name: "Dashboard",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<Omit<UserState, "isSidebarOpen">>) {
      state.name = action.payload.name;
      state.email = action.payload.email;
      state.initials = action.payload.initials;
      state.role = action.payload.role;
    },
    openSidebar(state) {
      state.isSidebarOpen = true;
    },
    closeSidebar(state) {
      state.isSidebarOpen = false;
    },
    toggleSidebar(state) {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
  },
});

export const { setUser, openSidebar, closeSidebar, toggleSidebar } =
  dashboardSlice.actions;
export default dashboardSlice.reducer;
