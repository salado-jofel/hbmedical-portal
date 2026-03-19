import { ReactNode } from "react";

export interface Facility {
  location?: ReactNode;
  id?: string;
  created_at?: string;
  name: string;
  type?: string; // ✅ optional — not always selected
  contact?: string; // ✅ optional — not always selected
  phone?: string; // ✅ optional — not always selected
  status?: string; // ✅ optional — not always selected
  qb_customer_id?: string | null;
  qb_synced_at?: string | null;
}

export type InsertFacilityPayload = Omit<Facility, "id" | "created_at">;
export type UpdateFacilityPayload = Partial<InsertFacilityPayload>;
