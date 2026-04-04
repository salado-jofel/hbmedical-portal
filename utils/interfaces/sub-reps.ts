export interface ISubRep {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: "pending" | "active" | "inactive";
  has_completed_setup: boolean;
  created_at: string;
}
