/**
 * Centralized order-access gate. Use this from any API route / server action
 * that takes an `orderId` from the request and needs to verify the caller is
 * allowed to act on that order.
 *
 * Returns the authenticated user + the order's `facility_id` on success;
 * throws on failure. Callers should catch and translate to an appropriate
 * HTTP status (typically 401 for "not signed in" and 403 for "no access").
 *
 * Access rules:
 *   - admin / support_staff       → access to every order
 *   - sales_representative        → access to orders for their assigned
 *                                   facilities (own + sub-rep facilities)
 *   - clinical_provider           → access only to orders for their facility
 *   - clinical_staff              → access only to orders for their facility
 *
 * NOTE: this complements RLS but does NOT replace it. RLS policies still
 * enforce the same rules at the DB level for any non-service-role query.
 * This helper exists because API routes commonly use the service role
 * (createAdminClient) to do work the user shouldn't do directly — and the
 * service role bypasses RLS, so we re-check authorization here.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import {
  isAdmin,
  isClinicalProvider,
  isClinicalStaff,
  isSalesRep,
  isSupport,
} from "@/utils/helpers/role";

export class OrderAccessError extends Error {
  /** "unauthenticated" → 401; "forbidden" → 403; "not_found" → 404. */
  readonly kind: "unauthenticated" | "forbidden" | "not_found";

  constructor(
    kind: "unauthenticated" | "forbidden" | "not_found",
    message: string,
  ) {
    super(message);
    this.kind = kind;
    this.name = "OrderAccessError";
  }
}

export interface OrderAccessContext {
  userId: string;
  role: NonNullable<Awaited<ReturnType<typeof getUserRole>>>;
  facilityId: string;
}

/**
 * Verify the signed-in user can access the given order. Returns the user's
 * id + role + the order's facility_id. Throws OrderAccessError otherwise.
 */
export async function requireOrderAccess(
  orderId: string,
): Promise<OrderAccessContext> {
  // Auth check.
  const supabase = await createClient();
  let user;
  try {
    user = await getCurrentUserOrThrow(supabase);
  } catch {
    throw new OrderAccessError("unauthenticated", "You must be signed in.");
  }

  const role = await getUserRole(supabase);
  if (!role) {
    throw new OrderAccessError("forbidden", "Your account has no role assigned.");
  }

  // Look up the order's facility — service-role read bypasses RLS so we can
  // do the membership check ourselves regardless of which role asked.
  const adminClient = createAdminClient();
  const { data: order, error } = await adminClient
    .from("orders")
    .select("facility_id")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new OrderAccessError("not_found", "Order lookup failed.");
  }
  if (!order) {
    throw new OrderAccessError("not_found", "Order not found.");
  }

  const facilityId = order.facility_id as string;

  // Admin / support — unconditional access.
  if (isAdmin(role) || isSupport(role)) {
    return { userId: user.id, role, facilityId };
  }

  // Clinic side — must be a member of the order's facility.
  if (isClinicalProvider(role) || isClinicalStaff(role)) {
    const { data: membership } = await adminClient
      .from("facility_members")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("facility_id", facilityId)
      .maybeSingle();

    if (!membership) {
      throw new OrderAccessError(
        "forbidden",
        "You do not have access to this order.",
      );
    }
    return { userId: user.id, role, facilityId };
  }

  // Sales rep — access via assigned facility OR a child rep's facility.
  if (isSalesRep(role)) {
    const { data: facility } = await adminClient
      .from("facilities")
      .select("assigned_rep")
      .eq("id", facilityId)
      .maybeSingle();
    const assigned = facility?.assigned_rep as string | null | undefined;
    if (assigned === user.id) {
      return { userId: user.id, role, facilityId };
    }
    if (assigned) {
      const { data: hierarchy } = await adminClient
        .from("rep_hierarchy")
        .select("child_rep_id")
        .eq("parent_rep_id", user.id)
        .eq("child_rep_id", assigned)
        .maybeSingle();
      if (hierarchy) {
        return { userId: user.id, role, facilityId };
      }
    }
    throw new OrderAccessError(
      "forbidden",
      "You do not have access to this order.",
    );
  }

  throw new OrderAccessError("forbidden", "Your role cannot access orders.");
}

/** Map an OrderAccessError to an appropriate HTTP status code. */
export function orderAccessErrorStatus(err: OrderAccessError): 401 | 403 | 404 {
  switch (err.kind) {
    case "unauthenticated":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
  }
}
