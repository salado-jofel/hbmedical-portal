export interface SignUpState {
  error: string;
}

export interface SignUpFormValues {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  facilityName: string;
  facilityAddressLine1: string;
  facilityAddressLine2: string | null;
  facilityCity: string;
  facilityState: string;
  facilityPostalCode: string;
  facilityCountry: string;
}

export interface ProfileInsert {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
}

export interface FacilityInsert {
  user_id: string;
  name: string;
  status: string;
  contact: string;
  phone: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  stripe_customer_id: string | null;
}
