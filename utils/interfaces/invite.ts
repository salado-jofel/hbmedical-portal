export type InviteTokenInvalidReason = "not_found" | "expired" | "used";

export interface InviteSignUpState {
  error: string | null;
}
