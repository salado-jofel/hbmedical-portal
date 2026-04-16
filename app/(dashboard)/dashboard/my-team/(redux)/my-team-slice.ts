import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SubRep } from "@/utils/interfaces/my-team";
export type { SubRep };

interface MyTeamState {
  items: SubRep[];
}

const initialState: MyTeamState = { items: [] };

const myTeamSlice = createSlice({
  name: "myTeam",
  initialState,
  reducers: {
    setMyTeam(state, action: PayloadAction<SubRep[]>) {
      state.items = action.payload;
    },
  },
});

export const { setMyTeam } = myTeamSlice.actions;
export default myTeamSlice.reducer;
