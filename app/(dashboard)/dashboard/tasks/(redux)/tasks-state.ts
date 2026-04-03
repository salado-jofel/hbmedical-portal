import type { ITask } from "@/utils/interfaces/tasks";

export interface TasksState {
  items: ITask[];
}

export const initialState: TasksState = {
  items: [],
};
