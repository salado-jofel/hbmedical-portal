export interface ISubRep {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: "pending" | "active" | "inactive";
  created_at: string;
}
