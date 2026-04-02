import type { IUser } from "@/utils/interfaces/users";

export interface UsersState {
  items: IUser[];
}

export const initialState: UsersState = {
  items: [],
};
