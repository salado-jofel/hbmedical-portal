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

  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

export type InsertFacilityPayload = Omit<Facility, "id" | "created_at">;
export type UpdateFacilityPayload = Partial<InsertFacilityPayload>;
