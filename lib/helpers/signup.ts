import { DEFAULT_FACILITY_STATUS } from "../constants/auth";
import {
  SignUpFormValues,
  ProfileInsert,
  FacilityInsert,
} from "../interfaces/auth";

export function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function requireString(formData: FormData, key: string, label: string) {
  const value = getString(formData, key);
  if (!value) {
    throw new Error(`${label} is required.`);
  }
  return value;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeCountry(country: string) {
  return country.trim().toUpperCase();
}

export function buildSignUpFormValues(formData: FormData): SignUpFormValues {
  return {
    firstName: requireString(formData, "first_name", "First name"),
    lastName: requireString(formData, "last_name", "Last name"),
    email: normalizeEmail(requireString(formData, "email", "Email")),
    password: requireString(formData, "password", "Password"),
    role: requireString(formData, "role", "Role"),
    phone: requireString(formData, "phone", "Phone"),
    facilityName: requireString(formData, "facility_name", "Facility name"),
    facilityAddressLine1: requireString(
      formData,
      "address_line_1",
      "Address line 1",
    ),
    facilityAddressLine2: getString(formData, "address_line_2") || null,
    facilityCity: requireString(formData, "city", "City"),
    facilityState: requireString(formData, "state", "State / Province"),
    facilityPostalCode: requireString(formData, "postal_code", "Postal code"),
    facilityCountry: normalizeCountry(
      requireString(formData, "country", "Facility country"),
    ),
  };
}

export function formatMessage(message: string | undefined): string {
  if (!message) return "";
  const trimmed = message.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function buildProfileInsert(
  userId: string,
  values: SignUpFormValues,
): ProfileInsert {
  return {
    id: userId,
    email: values.email,
    first_name: values.firstName,
    last_name: values.lastName,
    phone: values.phone,
    role: values.role,
  };
}

export function buildFacilityInsert(
  userId: string,
  values: SignUpFormValues,
): FacilityInsert {
  return {
    user_id: userId,
    name: values.facilityName,
    status: DEFAULT_FACILITY_STATUS,
    contact: `${values.firstName} ${values.lastName}`,
    phone: values.phone,
    address_line_1: values.facilityAddressLine1,
    address_line_2: values.facilityAddressLine2,
    city: values.facilityCity,
    state: values.facilityState,
    postal_code: values.facilityPostalCode,
    country: values.facilityCountry,
    stripe_customer_id: null,
  };
}
