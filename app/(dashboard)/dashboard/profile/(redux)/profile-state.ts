import { Profile } from "@/utils/interfaces/profiles";

export interface ProfileState {
  item: Profile | null;
}

export const initialState: ProfileState = {
  item: null,
};
