export interface Facility {
  id?: string;
  created_at?: string;
  name: string;
  location?: string | null;
  type?: string;
  contact?: string;
  phone?: string;
  status?: string;
  stripe_customer_id?: string | null;
  stripe_synced_at?: string | null;
}

export type InsertFacilityPayload = Omit<Facility, "id" | "created_at">;
export type UpdateFacilityPayload = Partial<InsertFacilityPayload>;
