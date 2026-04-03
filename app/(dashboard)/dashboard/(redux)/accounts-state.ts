import type { IAccount } from "@/utils/interfaces/accounts";

export interface AccountsState {
  items: IAccount[];
}

export const initialState: AccountsState = {
  items: [],
};
