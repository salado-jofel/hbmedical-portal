export type UserRole =
  | "sales_representative"
  | "doctor"
  | "admin"
  | "supervisor"
  | "clinical_provider"
  | "non_clinical_staff"
  | null;

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isDoctor(role: UserRole): boolean {
  return role === "doctor";
}

export function isSalesRep(role: UserRole): boolean {
  return role === "sales_representative";
}

export function isSupervisor(role: UserRole): boolean {
  return role === "supervisor";
}

export function isClinicalProvider(role: UserRole): boolean {
  return role === "clinical_provider";
}

export function isNonClinicalStaff(role: UserRole): boolean {
  return role === "non_clinical_staff";
}

/** Returns true for clinic/facility staff invited via invite link */
export function isFacilityMember(role: UserRole): boolean {
  return (
    role === "supervisor" ||
    role === "clinical_provider" ||
    role === "non_clinical_staff"
  );
}

export const ROLE_LABELS: Record<NonNullable<UserRole>, string> = {
  admin: "Admin",
  sales_representative: "Sales Representative",
  doctor: "Physician",
  supervisor: "Supervisor",
  clinical_provider: "Clinical Provider",
  non_clinical_staff: "Non-Clinical Staff",
};
