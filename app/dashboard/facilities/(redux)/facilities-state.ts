import { Facility } from "@/app/(interfaces)/facility";

export const initialState: {
  items: Facility[];
  search: string;
  typeFilter: string;
} = {
  items: [],
  search: "",
  typeFilter: "All Types",
};
