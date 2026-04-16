import type { IAccountWithMetrics } from "@/utils/interfaces/accounts";

export interface AccountsState {
  items: IAccountWithMetrics[];
}

export const initialState: AccountsState = {
  items: [],
};
