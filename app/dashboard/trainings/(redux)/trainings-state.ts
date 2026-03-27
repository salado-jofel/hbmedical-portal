import { TrainingMaterial } from "@/utils/interfaces/trainings";

export interface TrainingsState {
  items: TrainingMaterial[];
}

export const initialState: TrainingsState = {
  items: [],
};
