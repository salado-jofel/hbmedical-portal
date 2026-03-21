export interface Facility {
  id?: string;
  created_at?: string;
  name: string;
  location?: string | null;
  type?: string;
  contact?: string;
  phone?: string;
  status?: string;
}

export type InsertFacilityPayload = Omit<Facility, "id" | "created_at">;
export type UpdateFacilityPayload = Partial<InsertFacilityPayload>;
