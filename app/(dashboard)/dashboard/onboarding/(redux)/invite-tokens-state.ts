import type { IInviteToken } from "@/utils/interfaces/invite-tokens";

export interface InviteTokensState {
  items: IInviteToken[];
}

export const initialState: InviteTokensState = {
  items: [],
};
