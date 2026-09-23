import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { sendInviteEmail } from "@/lib/emails/send-invite-email";
import { sendProviderContractsSignedEmail } from "@/lib/emails/send-provider-contracts-signed";
import { STORAGE_BUCKETS } from "@/utils/constants/storage";
import { SIGNED_CONTRACTS_NOTIFY_TO } from "@/utils/constants/onboarding";
import {
  OFFLINE_CONTRACTS,
  OFFLINE_TOKEN_PREFIX,
  type OfflineContractKey,
} from "@/utils/constants/manual-onboarding";

export const BUCKET = STORAGE_BUCKETS.private;

export interface Onboarder {
  id: string;
  role: "admin" | "sales_representative";
  name: string;
  hasCompletedSetup: boolean;
}

/** Admin or sales rep signed in; reps must have finished office setup (same
 *  rule as the invite-link section on the Onboarding page). */
export async function requireOnboarder(): Promise<Onboarder> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  if (!isAdmin(role) && !isSalesRep(role)) {
    throw new Error("Only admins and sales reps can onboard clinics.");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, has_completed_setup")
    .eq("id", user.id)
    .maybeSingle();
  const hasCompletedSetup = isAdmin(role) ? true : Boolean(profile?.has_completed_setup);
  if (!hasCompletedSetup) {
    throw new Error("Complete your office setup before onboarding clinics.");
  }
  return {
    id: user.id,
    role: isAdmin(role) ? "admin" : "sales_representative",
    name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Meridian",
    hasCompletedSetup,
  };
}

export function offlineToken(batchId: string): string {
  return `${OFFLINE_TOKEN_PREFIX}${batchId}`;
}

/** Folder shared by both scans of one wizard run — same prefix inline
 *  e-signatures use (`provider-contracts-signed/<token>/`). */
export function offlineContractFolder(batchId: string): string {
  return `provider-contracts-signed/${offlineToken(batchId)}`;
}

/** Every upload gets a fresh, timestamped object name. Overwriting the same
 *  path is NOT safe: Supabase storage keeps serving the previous bytes from
 *  its cache for a while, which made a replaced scan fail validation. */
export function offlineContractPath(batchId: string, contractType: OfflineContractKey): string {
  return `${offlineContractFolder(batchId)}/${contractType}-${Date.now()}.pdf`;
}

export function isOfflineContractPath(
  batchId: string,
  contractType: OfflineContractKey,
  filePath: string,
): boolean {
  const prefix = `${offlineContractFolder(batchId)}/${contractType}-`;
  return filePath.startsWith(prefix) && /^\d+\.pdf$/.test(filePath.slice(prefix.length));
}

export interface LoadedContract {
  contractType: OfflineContractKey;
  filename: string;
  content: Buffer;
}

/** Downloads both scanned PDFs (at the exact paths the wizard uploaded to,
 *  already checked against the batch folder) and verifies they are real,
 *  non-empty PDFs. Throws with a user-facing message otherwise. */
export async function loadOfflineContracts(
  contracts: Array<{ contractType: string; filePath: string }>,
  providerName: string,
): Promise<LoadedContract[]> {
  const admin = createAdminClient();
  return Promise.all(
    OFFLINE_CONTRACTS.map(async (def) => {
      const path = contracts.find((c) => c.contractType === def.key)?.filePath;
      if (!path) throw new Error(`The ${def.short} upload is missing. Please upload it again.`);
      const { data, error } = await admin.storage.from(BUCKET).download(path);
      if (error || !data) {
        throw new Error(`The ${def.short} upload is missing. Please upload it again.`);
      }
      const content = Buffer.from(await data.arrayBuffer());
      if (content.length === 0 || content.subarray(0, 5).toString("latin1") !== "%PDF-") {
        throw new Error(`The ${def.short} file is not a valid PDF. Please upload the scanned PDF again.`);
      }
      return {
        contractType: def.key,
        filename: `${def.label} - ${providerName}.pdf`,
        content,
      };
    }),
  );
}

/** Best-effort rollback for a half-created provider. Mirrors inviteSignUp:
 *  drop the clinic facility, then the auth user (profiles / credentials /
 *  signatures cascade from auth.users). */
export async function cleanupManualOnboarding(userId: string | null, facilityId: string | null) {
  const admin = createAdminClient();
  if (facilityId) {
    try {
      await admin.from("facilities").delete().eq("id", facilityId);
    } catch {
      // noop
    }
  }
  if (userId) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // noop
    }
  }
}

/** Welcome email (set-password link + contract copies) to the provider, and
 *  the same internal notification the inline e-sign flow sends. Both are
 *  fire-and-forget: the account is already committed. */
export async function sendOfflineOnboardingEmails(args: {
  providerEmail: string;
  providerName: string;
  clinicName: string;
  actionLink: string;
  onboarderName: string;
  contracts: LoadedContract[];
}): Promise<void> {
  const attachments = args.contracts.map((c) => ({ filename: c.filename, content: c.content }));

  const [welcome, internal] = await Promise.all([
    sendInviteEmail({
      to: args.providerEmail,
      inviteUrl: args.actionLink,
      roleType: "clinical_provider_offline",
      inviterName: args.onboarderName,
      attachments,
    }),
    sendProviderContractsSignedEmail({
      to: SIGNED_CONTRACTS_NOTIFY_TO,
      providerName: args.providerName,
      providerEmail: args.providerEmail,
      clinicName: args.clinicName,
      signedAt: new Date(),
      attachments,
    }),
  ]);
  if (welcome.error) console.error("[manualOnboardProvider] welcome email:", welcome.error);
  if (internal.error) console.error("[manualOnboardProvider] internal email:", internal.error);
}
