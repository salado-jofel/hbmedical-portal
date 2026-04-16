import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ISubRepDetail } from "@/utils/interfaces/my-team";

interface SubRepDetailState {
  detail: ISubRepDetail | null;
}

const initialState: SubRepDetailState = { detail: null };

const subRepDetailSlice = createSlice({
  name: "subRepDetail",
  initialState,
  reducers: {
    setSubRepDetail(state, action: PayloadAction<ISubRepDetail | null>) {
      state.detail = action.payload;
    },
  },
});

export const { setSubRepDetail } = subRepDetailSlice.actions;
export default subRepDetailSlice.reducer;
