import type { AccountStatus } from "@/utils/interfaces/accounts";

export const ACCOUNTS_TABLE = "facilities";
export const CONTACTS_TABLE = "contacts";
export const PROFILES_TABLE = "profiles";

export const ACCOUNTS_PATH = "/dashboard/accounts";

export const ACCOUNT_SELECT = `
  id,
  user_id,
  name,
  status,
  contact,
  phone,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code,
  country,
  stripe_customer_id,
  assigned_rep,
  created_at,
  updated_at,
  assigned_rep_profile:profiles!facilities_assigned_rep_fkey (
    id,
    first_name,
    last_name,
    email,
    phone
  ),
  orders (count),
  contacts (count)
`;

export const ACCOUNT_DETAIL_SELECT = `
  id,
  user_id,
  name,
  status,
  contact,
  phone,
  address_line_1,
  address_line_2,
  city,
  state,
  postal_code,
  country,
  stripe_customer_id,
  assigned_rep,
  created_at,
  updated_at,
  assigned_rep_profile:profiles!facilities_assigned_rep_fkey (
    id,
    first_name,
    last_name,
    email,
    phone
  ),
  orders (count),
  contacts (count)
`;

export const CONTACT_SELECT = `
  id,
  facility_id,
  first_name,
  last_name,
  title,
  email,
  phone,
  preferred_contact,
  notes,
  is_active,
  created_at,
  updated_at
`;

export const SALES_REP_SELECT = `
  id,
  first_name,
  last_name,
  email
`;

export const ACCOUNT_STATUS_FILTER_OPTIONS: { value: AccountStatus | "all"; label: string }[] = [
  { value: "all",      label: "All statuses" },
  { value: "active",   label: "Active" },
  { value: "prospect", label: "Prospect" },
  { value: "inactive", label: "Inactive" },
];
