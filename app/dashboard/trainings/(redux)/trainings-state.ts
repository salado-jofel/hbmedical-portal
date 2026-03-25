import { TrainingMaterial } from "@/lib/interfaces/trainings";

export interface TrainingsState {
  items: TrainingMaterial[];
}

export const initialState: TrainingsState = {
  items: [],
};
