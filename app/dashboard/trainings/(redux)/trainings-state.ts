import { TrainingMaterial } from "@/app/(interfaces)/trainings";

export interface TrainingsState {
  items: TrainingMaterial[];
}

export const initialState: TrainingsState = {
  items: [],
};
