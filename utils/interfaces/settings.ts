import type { AccountStatus } from "./accounts";

export interface IClinicAccount {
  id: string;
  name: string;
  status: AccountStatus;
  primaryDoctor: string;
  doctorEmail: string;
  memberCount: number;
}
