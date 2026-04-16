import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SubRep, IRepListRow, IMyTeamKpis } from "@/utils/interfaces/my-team";
export type { SubRep };

interface MyTeamState {
  items: SubRep[];
  rows: IRepListRow[];
  kpis: IMyTeamKpis | null;
}

const initialState: MyTeamState = {
  items: [],
  rows: [] as IRepListRow[],
  kpis: null as IMyTeamKpis | null,
};

const myTeamSlice = createSlice({
  name: "myTeam",
  initialState,
  reducers: {
    setMyTeam(state, action: PayloadAction<SubRep[]>) {
      state.items = action.payload;
    },
    setRows(state, action: PayloadAction<IRepListRow[]>) {
      state.rows = action.payload;
    },
    setKpis(state, action: PayloadAction<IMyTeamKpis | null>) {
      state.kpis = action.payload;
    },
  },
});

export const { setMyTeam, setRows, setKpis } = myTeamSlice.actions;
export default myTeamSlice.reducer;
