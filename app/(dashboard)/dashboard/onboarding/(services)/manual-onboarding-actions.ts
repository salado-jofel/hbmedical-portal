"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { UUID_SHAPE_REGEX } from "@/utils/validators/shared";
import {
  manualOnboardingSchema,
  issuesToFieldErrors,
} from "@/utils/validators/manual-onboarding";
import type {
  ManualOnboardingPayload,
  ManualOnboardingResult,
  PrepareOfflineUploadResult,
} from "@/utils/interfaces/manual-onboarding";
import {
  MAX_OFFLINE_CONTRACT_BYTES,
  OFFLINE_CONTRACTS,
  type OfflineContractKey,
} from "@/utils/constants/manual-onboarding";
import { INVITE_TOKENS_TABLE } from "./_onboarding-shared";
import {
  BUCKET,
  cleanupManualOnboarding,
  isOfflineContractPath,
  loadOfflineContracts,
  offlineContractFolder,
  offlineContractPath,
  requireOnboarder,
  sendOfflineOnboardingEmails,
} from "./_manual-onboarding-shared";
import { insertEnrollment, insertOfflineSignatures } from "./_manual-onboarding-inserts";

/* -------------------------------------------------------------------------- */
/* prepareOfflineContractUpload — signed upload URL for one scanned contract   */
/* -------------------------------------------------------------------------- */

export async function prepareOfflineContractUpload(input: {
  batchId: string;
  contractType: OfflineContractKey;
  mimeType: string;
  size: number;
}): Promise<PrepareOfflineUploadResult> {
  try {
    await requireOnboarder();
    const { batchId, contractType, mimeType, size } = input;
    if (!UUID_SHAPE_REGEX.test(batchId)) return { success: false, error: "Invalid upload batch." };
    if (!OFFLINE_CONTRACTS.some((c) => c.key === contractType)) {
      return { success: false, error: "Invalid contract type." };
    }
    if (mimeType !== "application/pdf") return { success: false, error: "Only PDF scans are accepted." };
    if (size <= 0) return { success: false, error: "The file is empty." };
    if (size > MAX_OFFLINE_CONTRACT_BYTES) return { success: false, error: "PDF is too large (max 25 MB)." };

    const admin = createAdminClient();
    // Fresh timestamped name per upload (see offlineContractPath); a replaced
    // scan's previous object is removed so the folder holds only live files.
    const folder = offlineContractFolder(batchId);
    const { data: existing } = await admin.storage.from(BUCKET).list(folder);
    const stale = (existing ?? [])
      .filter((o) => o.name.startsWith(`${contractType}-`))
      .map((o) => `${folder}/${o.name}`);
    if (stale.length > 0) await admin.storage.from(BUCKET).remove(stale);
    const filePath = offlineContractPath(batchId, contractType);
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(filePath);
    if (error || !data) {
      console.error("[prepareOfflineContractUpload] signed URL error:", error?.message);
      return { success: false, error: "Failed to prepare upload." };
    }
    return { success: true, bucket: BUCKET, filePath, uploadToken: data.token };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed to prepare upload." };
  }
}

/* -------------------------------------------------------------------------- */
/* manualOnboardProvider — create the provider + clinic from admin/rep input  */
/* -------------------------------------------------------------------------- */

export async function manualOnboardProvider(
  payload: ManualOnboardingPayload,
): Promise<ManualOnboardingResult> {
  let createdUserId: string | null = null;
  let createdFacilityId: string | null = null;

  try {
    const actor = await requireOnboarder();

    const parsed = manualOnboardingSchema.safeParse(payload);
    if (!parsed.success) {
      return { success: false, error: null, fieldErrors: issuesToFieldErrors(parsed.error.issues) };
    }
    const d = parsed.data;
    const providerName = `${d.first_name} ${d.last_name}`.trim();

    // Reps can only onboard into their own book — never trust repId from a rep.
    const assignedRepId = actor.role === "admin" ? d.repId : actor.id;
    if (!assignedRepId) return { success: false, error: null, fieldErrors: { repId: "Select a sales rep." } };

    const admin = createAdminClient();

    if (actor.role === "admin") {
      const { data: rep } = await admin
        .from("profiles")
        .select("id")
        .eq("id", assignedRepId)
        .eq("role", "sales_representative")
        .eq("status", "active")
        .maybeSingle();
      if (!rep) return { success: false, error: null, fieldErrors: { repId: "Selected rep is not active." } };
    }

    // Uploads must live in this batch's folder and be valid PDFs before we touch auth.
    for (const c of d.contracts) {
      if (!isOfflineContractPath(d.batchId, c.contractType as OfflineContractKey, c.filePath)) {
        return { success: false, error: null, fieldErrors: { [`contracts.${c.contractType}.filePath`]: "Upload the signed PDF again." } };
      }
    }
    const contracts = await loadOfflineContracts(d.contracts, providerName);
    const byType = new Map(d.contracts.map((c) => [c.contractType, c]));

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", d.email)
      .maybeSingle();
    if (existing) {
      return { success: false, error: null, fieldErrors: { email: "An account with this email already exists." } };
    }

    // Auth user via invite link (same as sub-rep flow): no password yet, the
    // provider sets it from the emailed /set-password link.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "invite",
      email: d.email,
      options: {
        data: {
          first_name: d.first_name,
          last_name: d.last_name,
          full_name: providerName,
          role: "clinical_provider",
          phone: d.phone,
          invited_by: actor.id,
          onboarded_offline: true,
        },
        redirectTo: `${appUrl}/set-password`,
      },
    });
    if (linkError || !linkData?.user) {
      console.error("[manualOnboardProvider] generateLink error:", linkError);
      const msg = linkError?.message?.toLowerCase() ?? "";
      if (msg.includes("already")) {
        return { success: false, error: null, fieldErrors: { email: "An account with this email already exists." } };
      }
      return { success: false, error: linkError?.message ?? "Failed to create the provider account." };
    }
    createdUserId = linkData.user.id;
    const actionLink = linkData.properties?.action_link ?? "";

    const { error: profileError } = await admin.from("profiles").upsert({
      id: createdUserId,
      email: d.email,
      first_name: d.first_name,
      last_name: d.last_name,
      phone: d.phone,
      role: "clinical_provider",
      status: "pending",
      has_completed_setup: true,
    });
    if (profileError) throw new Error(profileError.message ?? "Failed to create profile.");

    const { data: facility, error: facilityError } = await admin
      .from("facilities")
      .insert({
        user_id: createdUserId,
        name: d.office_name,
        contact: providerName,
        phone: d.office_phone,
        address_line_1: d.office_address,
        city: d.office_city,
        state: d.office_state,
        postal_code: d.office_postal_code,
        country: "US",
        status: "active",
        facility_type: "clinic",
        assigned_rep: assignedRepId,
      })
      .select("id")
      .single();
    if (facilityError || !facility) throw new Error(facilityError?.message ?? "Failed to create clinic.");
    createdFacilityId = facility.id;

    const { error: memberError } = await admin.from("facility_members").insert({
      facility_id: facility.id,
      user_id: createdUserId,
      role_type: "clinical_provider",
      can_sign_orders: true,
      is_primary: true,
      invited_by: actor.id,
    });
    if (memberError) throw new Error(memberError.message ?? "Failed to link provider to clinic.");

    await insertEnrollment(admin, facility.id, d);

    const baa = byType.get("baa")!;
    const ps = byType.get("product_services")!;
    // pin_hash stays NULL — the provider creates it on first login (PIN gate).
    const { error: credError } = await admin.from("provider_credentials").insert({
      user_id: createdUserId,
      npi_number: d.npi_number,
      credential: d.credential || null,
      pin_hash: null,
      baa_signed_at: new Date(baa.signedOn).toISOString(),
      terms_signed_at: new Date(ps.signedOn).toISOString(),
    });
    if (credError) throw new Error(credError.message ?? "Failed to save provider credentials.");

    await insertOfflineSignatures(admin, createdUserId, actor.id, d);

    // Consumed-on-creation token so the clinic shows up in the invite list
    // with the "used" status, exactly like a direct sub-rep invite.
    await admin.from(INVITE_TOKENS_TABLE).insert({
      created_by: actor.id,
      facility_id: null,
      role_type: "clinical_provider",
      expires_at: new Date().toISOString(),
      invited_email: d.email,
      used_by: createdUserId,
      used_at: new Date().toISOString(),
    });

    sendOfflineOnboardingEmails({
      providerEmail: d.email,
      providerName,
      clinicName: d.office_name,
      actionLink,
      onboarderName: actor.name,
      contracts,
    }).catch((err) => console.error("[manualOnboardProvider] email error:", err));

    revalidatePath("/dashboard/onboarding");
    revalidatePath("/dashboard/accounts");
    return { success: true, error: null, providerEmail: d.email, facilityName: d.office_name };
  } catch (err) {
    console.error("[manualOnboardProvider] failed:", err);
    await cleanupManualOnboarding(createdUserId, createdFacilityId);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to onboard the clinic. Please try again.",
    };
  }
}
