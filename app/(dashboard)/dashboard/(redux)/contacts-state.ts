import type { IContact } from "@/utils/interfaces/contacts";

export interface ContactsState {
  items: IContact[];
}

export const initialState: ContactsState = {
  items: [],
};
