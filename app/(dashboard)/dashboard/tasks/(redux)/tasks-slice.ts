import type { ITask } from "@/utils/interfaces/tasks";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { initialState } from "./tasks-state";

const tasksSlice = createSlice({
  name: "tasks",
  initialState,
  reducers: {
    setTasks(state, action: PayloadAction<ITask[]>) {
      state.items = action.payload;
    },
    addTaskToStore(state, action: PayloadAction<ITask>) {
      state.items.unshift(action.payload);
    },
    updateTaskInStore(state, action: PayloadAction<ITask>) {
      const index = state.items.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removeTaskFromStore(state, action: PayloadAction<string>) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  setTasks,
  addTaskToStore,
  updateTaskInStore,
  removeTaskFromStore,
} = tasksSlice.actions;

export default tasksSlice.reducer;
