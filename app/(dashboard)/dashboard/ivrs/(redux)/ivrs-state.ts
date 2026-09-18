import type { IStandaloneIvr } from "@/utils/interfaces/standalone-ivrs";

export interface IvrsState {
  items: IStandaloneIvr[];
  search: string;
}

export const initialState: IvrsState = {
  items: [],
  search: "",
};
