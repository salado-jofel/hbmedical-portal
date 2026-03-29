import { TrainingMaterial } from "@/utils/interfaces/trainings";

export interface TrainingsState {
  items: TrainingMaterial[];
  selectedIds: string[];
  isSelecting: boolean;
}

export const initialState: TrainingsState = {
  items: [],
  selectedIds: [],
  isSelecting: false,
};
