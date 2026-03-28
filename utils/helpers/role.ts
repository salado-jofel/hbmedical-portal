export type UserRole = "sales_representative" | "doctor" | "admin" | null;

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

export function isDoctor(role: UserRole): boolean {
  return role === "doctor";
}

export function isSalesRep(role: UserRole): boolean {
  return role === "sales_representative";
}
