import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentUserOrThrow,
  getUserRole,
} from "@/lib/supabase/auth";
import {
  isClinicSide,
  isSupport,
} from "@/utils/helpers/role";

export const ORDERS_PATH = "/dashboard/orders";
export const BUCKET = "hbmedical-bucket-private";

export const ORDER_WITH_RELATIONS_SELECT = `
  id, order_number, facility_id, order_status,
  payment_method, payment_status, invoice_status,
  fulfillment_status, delivery_status, tracking_number,
  notes, admin_notes, placed_at, paid_at, delivered_at, created_at, updated_at,
  created_by, signed_by, signed_at, wound_type, date_of_service,
  patient_id, assigned_provider_id,
  wound_visit_number, chief_complaint,
  has_vasculitis_or_burns, is_receiving_home_health,
  is_patient_at_snf, icd10_code, followup_days, symptoms,
  ai_extracted, ai_extracted_at, order_form_locked,
  patients (id, facility_id, first_name, last_name, date_of_birth, patient_ref, notes, is_active, created_at, updated_at),
  order_items (id, order_id, product_id, product_name, product_sku, unit_price, quantity, shipping_amount, tax_amount, subtotal, total_amount, created_at, updated_at),
  order_documents (id, document_type, file_name, file_path, mime_type, file_size, uploaded_by, created_at),
  facilities!orders_facility_id_fkey (id, name),
  invoices (due_at, status, amount_due)
`;

export function generateOrderNumber(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HBM-${year}${month}${day}-${rand}`;
}

export async function getUserFacilityId(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("facility_members")
    .select("facility_id")
    .eq("user_id", userId)
    .in("role_type", ["clinical_provider", "clinical_staff"])
    .maybeSingle();
  return data?.facility_id ?? null;
}

export async function requireClinicRole(): Promise<{
  userId: string;
  facilityId: string;
  role: string;
}> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  if (!isClinicSide(role)) {
    throw new Error("Only clinical providers and staff can perform this action.");
  }

  const facilityId = await getUserFacilityId(user.id);
  if (!facilityId) {
    throw new Error("No facility is assigned to your account.");
  }

  return { userId: user.id, facilityId, role: role! };
}

export async function requireIVREditRole(): Promise<{
  userId: string;
  role: string;
}> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const allowed =
    isClinicSide(role) ||
    isSupport(role);
  if (!allowed) {
    throw new Error("Only clinical staff, providers, or support staff can edit IVR records.");
  }

  return { userId: user.id, role: role! };
}

export function getDocumentLabel(type: string): string {
  const labels: Record<string, string> = {
    facesheet: "Facesheet",
    clinical_docs: "Clinical Documentation",
    order_form: "Order Form",
    additional_ivr: "Additional IVR Info",
    form_1500: "CMS-1500 Form",
    wound_pictures: "Wound Photos",
    other: "Additional Documentation",
  };
  return labels[type] ?? type;
}

export async function insertOrderHistory(
  adminClient: ReturnType<typeof createAdminClient>,
  orderId: string,
  action: string,
  oldStatus: string | null,
  newStatus: string | null,
  performedBy: string | null,
  notes?: string | null,
): Promise<void> {
  const { error } = await adminClient.from("order_history").insert({
    order_id: orderId,
    action,
    old_status: oldStatus,
    new_status: newStatus,
    performed_by: performedBy,
    notes: notes ?? null,
  });
  if (error) {
    console.error("[insertOrderHistory]", JSON.stringify(error));
  }
}

export async function createNotifications(params: {
  adminClient: ReturnType<typeof createAdminClient>;
  orderId: string;
  orderNumber: string;
  facilityId: string;
  type: string;
  title: string;
  body: string;
  oldStatus: string | null;
  newStatus: string | null;
  notifyRoles: string[];
  excludeUserId?: string;
}): Promise<void> {
  const { adminClient, orderId, orderNumber, facilityId, type, title, body, oldStatus, newStatus, notifyRoles, excludeUserId } = params;

  console.log("[createNotifications] called", { type, orderId, orderNumber, facilityId, notifyRoles });

  const clinicRoles = notifyRoles.filter((r) =>
    ["clinical_staff", "clinical_provider"].includes(r),
  );
  const globalRoles = notifyRoles.filter((r) =>
    ["admin", "support_staff"].includes(r),
  );

  const recipientIds: string[] = [];

  // Step 1+2: clinic roles — get facility members, then filter by role
  if (clinicRoles.length > 0) {
    const { data: members } = await adminClient
      .from("facility_members")
      .select("user_id")
      .eq("facility_id", facilityId);

    const memberIds = (members ?? []).map((m) => m.user_id);
    console.log("[createNotifications] facility members found:", memberIds.length);

    if (memberIds.length > 0) {
      const { data: clinicProfiles } = await adminClient
        .from("profiles")
        .select("id")
        .in("id", memberIds)
        .in("role", clinicRoles);

      console.log("[createNotifications] clinic recipients:", (clinicProfiles ?? []).length);
      recipientIds.push(...(clinicProfiles ?? []).map((p) => p.id));
    }
  }

  // Global roles — admin, support_staff
  if (globalRoles.length > 0) {
    const { data: globalProfiles } = await adminClient
      .from("profiles")
      .select("id")
      .in("role", globalRoles);

    console.log("[createNotifications] global recipients:", (globalProfiles ?? []).length);
    recipientIds.push(...(globalProfiles ?? []).map((p) => p.id));
  }

  const uniqueIds = [...new Set(recipientIds)].filter(
    (id) => id !== excludeUserId,
  );
  console.log("[createNotifications] total unique recipients:", uniqueIds.length, excludeUserId ? `(excluded sender ${excludeUserId})` : "");

  if (uniqueIds.length === 0) return;

  const { error } = await adminClient.from("notifications").insert(
    uniqueIds.map((userId) => ({
      user_id:      userId,
      order_id:     orderId,
      order_number: orderNumber,
      type,
      title,
      body,
      old_status:   oldStatus ?? null,
      new_status:   newStatus ?? null,
      is_read:      false,
    })),
  );

  if (error) {
    console.error("[createNotifications] insert error:", JSON.stringify(error));
  } else {
    console.log(`[createNotifications] created ${uniqueIds.length} notifications type=${type} order=${orderNumber}`);
  }
}

export async function triggerCombinedExtraction(
  orderId: string,
  documents: Array<{ documentType: string; filePath: string; bucket?: string }>,
): Promise<{ success: boolean; error: string | null; skipped?: boolean }> {
  try {
    const extractable = documents.filter((d) =>
      ["facesheet", "clinical_docs"].includes(d.documentType),
    );
    if (extractable.length === 0) {
      return { success: true, error: null, skipped: true };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/ai/extract-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        documents: extractable.map((d) => ({
          ...d,
          bucket: d.bucket ?? BUCKET,
        })),
      }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("[triggerCombinedExtraction]", data.error);
      return { success: false, error: data.error };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[triggerCombinedExtraction] unexpected:", err);
    return { success: false, error: "AI extraction failed — fill form manually." };
  }
}

export async function triggerAiExtraction(
  orderId: string,
  documentType: string,
  filePath: string,
): Promise<{ success: boolean; error: string | null; skipped?: boolean }> {
  try {
    if (!["facesheet", "clinical_docs"].includes(documentType)) {
      return { success: true, error: null, skipped: true };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/ai/extract-document`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, documentType, filePath, bucket: BUCKET }),
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error("[triggerAiExtraction]", data.error);
      return { success: false, error: data.error, skipped: false };
    }

    return { success: true, error: null };
  } catch (err) {
    console.error("[triggerAiExtraction] unexpected:", err);
    // Non-fatal — upload already succeeded; user can fill form manually
    return { success: false, error: "AI extraction failed — fill form manually." };
  }
}

export async function generateOrderPDFs(
  orderId: string,
  formTypes: ("order_form" | "ivr" | "hcfa_1500")[],
): Promise<{ success: boolean; error: string | null }> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    await Promise.allSettled(
      formTypes.map(formType =>
        fetch(`${baseUrl}/api/generate-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, formType }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.error) {
              console.error(`[PDF] ${formType} failed:`, data.error);
            }
          }),
      ),
    );

    return { success: true, error: null };
  } catch (err) {
    return { error: String(err), success: false };
  }
}
