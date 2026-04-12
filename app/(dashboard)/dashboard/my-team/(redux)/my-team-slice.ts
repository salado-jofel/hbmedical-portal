import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface SubRep {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  role: string | null;
  accountCount: number;
  orderCount: number;
  revenue: number;
  commissionRate: number;
  overridePercent: number;
}

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
export type { SubRep };
export default myTeamSlice.reducer;
