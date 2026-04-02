export const PROFILE_ROLES = ["sales_representative"] as const;
export const FACILITY_STATUSES = ["active", "inactive"] as const;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;
export const ISO2_REGEX = /^[A-Z]{2}$/;
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const DEFAULT_FACILITY_STATUS = "active";
