import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./profile-state";
import { Profile } from "@/app/(interfaces)/profiles";

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    setProfile(state, action: PayloadAction<Profile>) {
      state.item = action.payload;
    },
    updateProfileInStore(state, action: PayloadAction<Partial<Profile>>) {
      if (state.item) {
        state.item = { ...state.item, ...action.payload };
      }
    },
    clearProfile(state) {
      state.item = null;
    },
  },
});

export const { setProfile, updateProfileInStore, clearProfile } =
  profileSlice.actions;
export default profileSlice.reducer;
