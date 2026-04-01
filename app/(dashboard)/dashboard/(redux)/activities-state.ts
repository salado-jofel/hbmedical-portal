import type { IActivity } from "@/utils/interfaces/activities";

export interface ActivitiesState {
  items: IActivity[];
}

export const initialState: ActivitiesState = {
  items: [],
};
