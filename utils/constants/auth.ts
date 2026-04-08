export const PROFILE_ROLES = ["sales_representative"] as const;
export const FACILITY_STATUSES = ["active", "inactive"] as const;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;
export const ISO2_REGEX = /^[A-Z]{2}$/;
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const DEFAULT_FACILITY_STATUS = "active";

export const CREDENTIAL_OPTIONS = [
  { value: "MD",   label: "MD — Medical Doctor" },
  { value: "DO",   label: "DO — Doctor of Osteopathic Medicine" },
  { value: "ARNP", label: "ARNP — Advanced Registered Nurse Practitioner" },
  { value: "PA",   label: "PA — Physician Assistant" },
  { value: "RN",   label: "RN — Registered Nurse" },
  { value: "CCA",  label: "CCA — Certified Coding Associate" },
  { value: "LPN",  label: "LPN — Licensed Practical Nurse" },
  { value: "Admin", label: "Admin" },
  { value: "Other", label: "Other" },
];
