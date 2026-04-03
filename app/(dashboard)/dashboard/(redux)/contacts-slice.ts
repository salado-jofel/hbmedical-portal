import type { IContact } from "@/utils/interfaces/contacts";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./contacts-state";

const contactsSlice = createSlice({
  name: "contacts",
  initialState,
  reducers: {
    setContacts(state, action: PayloadAction<IContact[]>) {
      state.items = action.payload;
    },
    addContactToStore(state, action: PayloadAction<IContact>) {
      state.items.unshift(action.payload);
    },
    updateContactInStore(state, action: PayloadAction<IContact>) {
      const index = state.items.findIndex((c) => c.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeContactFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((c) => c.id !== action.payload);
    },
  },
});

export const {
  setContacts,
  addContactToStore,
  updateContactInStore,
  removeContactFromStore,
} = contactsSlice.actions;

export default contactsSlice.reducer;
