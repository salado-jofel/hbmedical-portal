export type UserRole =
  | "admin"
  | "sales_representative"
  | "support_staff"
  | "clinical_provider"
  | "clinical_staff"
  | null;

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isSalesRep(role: UserRole): boolean {
  return role === "sales_representative";
}

export function isSupport(role: UserRole): boolean {
  return role === "support_staff";
}

export function isClinicalProvider(role: UserRole): boolean {
  return role === "clinical_provider";
}

export function isClinicalStaff(role: UserRole): boolean {
  return role === "clinical_staff";
}

export function isDistributionSide(role: UserRole): boolean {
  return (
    role === "admin" ||
    role === "sales_representative" ||
    role === "support_staff"
  );
}

export function isClinicSide(role: UserRole): boolean {
  return role === "clinical_provider" || role === "clinical_staff";
}

export function canSignOrders(role: UserRole): boolean {
  return role === "clinical_provider";
}

export function canCreateOrders(role: UserRole): boolean {
  return role === "clinical_provider" || role === "clinical_staff";
}

export const ROLE_LABELS: Record<NonNullable<UserRole>, string> = {
  admin: "Admin",
  sales_representative: "Sales Rep",
  support_staff: "Support Staff",
  clinical_provider: "Clinical Provider",
  clinical_staff: "Clinical Staff",
};
