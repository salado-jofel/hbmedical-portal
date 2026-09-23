import "server-only";

import { headers } from "next/headers";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { ManualOnboardingParsed } from "@/utils/validators/manual-onboarding";
import {
  OFFLINE_SIGNATURE_METHOD,
  OFFLINE_SOURCE_PATH,
} from "@/utils/constants/manual-onboarding";
import { offlineToken } from "./_manual-onboarding-shared";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Mirrors the facility_enrollment insert in inviteSignUp: billing comes from
 *  the practice step, everything else is optional and NULL when blank. */
export async function insertEnrollment(
  admin: AdminClient,
  facilityId: string,
  d: ManualOnboardingParsed,
): Promise<void> {
  const e = d.enrollment;
  const nullable = (v: string) => v || null;
  const { error: enrollError } = await admin.from("facility_enrollment").insert({
    facility_id: facilityId,
    facility_npi: nullable(e.facility_npi),
    facility_ein: nullable(e.facility_ein),
    facility_ptan: nullable(e.facility_ptan),
    medicare_mac: nullable(e.medicare_mac),
    ap_contact_name: nullable(e.ap_contact_name),
    ap_contact_email: nullable(e.ap_contact_email),
    billing_address: d.office_address,
    billing_city: d.office_city,
    billing_state: d.office_state,
    billing_zip: d.office_postal_code,
    billing_phone: d.office_phone,
    dpa_contact: nullable(e.dpa_contact),
    dpa_contact_email: nullable(e.dpa_contact_email),
    additional_provider_1_name: nullable(e.additional_provider_1_name),
    additional_provider_1_npi: nullable(e.additional_provider_1_npi),
    additional_provider_2_name: nullable(e.additional_provider_2_name),
    additional_provider_2_npi: nullable(e.additional_provider_2_npi),
    shipping_facility_name: nullable(e.shipping_facility_name),
    shipping_facility_npi: nullable(e.shipping_facility_npi),
    shipping_facility_ptan: nullable(e.shipping_facility_ptan),
    shipping_contact_name: nullable(e.shipping_contact_name),
    shipping_contact_email: nullable(e.shipping_contact_email),
    shipping_address: nullable(e.shipping_address),
    shipping_phone: nullable(e.shipping_phone),
    completed_at: new Date().toISOString(),
  });
  if (enrollError) throw new Error(enrollError.message ?? "Failed to save enrollment data.");
}

/** One provider_contract_signatures row per uploaded scan, flagged offline
 *  and attributed to the admin/rep who uploaded it. */
export async function insertOfflineSignatures(
  admin: AdminClient,
  userId: string,
  uploadedBy: string,
  d: ManualOnboardingParsed,
): Promise<void> {
  const h = await headers();
  const ipAddress = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  const userAgent = h.get("user-agent") || null;
  const { error: sigError } = await admin.from("provider_contract_signatures").insert(
    d.contracts.map((c) => ({
      user_id: userId,
      invite_token: offlineToken(d.batchId),
      contract_type: c.contractType,
      source_path: OFFLINE_SOURCE_PATH,
      signed_path: c.filePath,
      typed_name: c.signerName,
      typed_title: c.signerTitle,
      signature_method: OFFLINE_SIGNATURE_METHOD,
      signed_at: new Date(c.signedOn).toISOString(),
      uploaded_by: uploadedBy,
      ip_address: ipAddress,
      user_agent: userAgent,
    })),
  );
  if (sigError) throw new Error(sigError.message ?? "Failed to record the signed contracts.");
}
