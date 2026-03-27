import {
  EMAIL_REGEX,
  PASSWORD_REGEX,
  PROFILE_ROLES,
  E164_REGEX,
  ISO2_REGEX,
} from "../constants/auth";

export function validateEmail(email: string) {
  if (!EMAIL_REGEX.test(email.trim().toLowerCase())) {
    throw new Error("Please enter a valid email address.");
  }
}

export function validatePassword(password: string) {
  if (!PASSWORD_REGEX.test(password)) {
    throw new Error(
      "Password must be at least 8 characters and include at least 1 letter and 1 number.",
    );
  }
}

export function validateRole(role: string) {
  if (!PROFILE_ROLES.includes(role as (typeof PROFILE_ROLES)[number])) {
    throw new Error("Invalid role.");
  }
}

export function validatePhone(phone: string, label: string) {
  if (!E164_REGEX.test(phone.trim())) {
    throw new Error(`${label} must be a valid international phone number.`);
  }
}

export function validateCountry(country: string) {
  if (!ISO2_REGEX.test(country.trim().toUpperCase())) {
    throw new Error("Facility country must be a 2-letter ISO code.");
  }
}
