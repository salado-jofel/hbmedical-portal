"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { paubox, ACCOUNTS_FROM_EMAIL } from "@/lib/emails/paubox";
import { buildIvrDecisionEmail } from "@/lib/emails/build-ivr-approval-email";

/**
 * Server-side lookup for the public approval page. Validates the token
 * before returning any patient data.
 */
export async function loadIvrByToken(token: string): Promise<
  | {
      state: "valid";
      ivr: {
        id: string;
        patientName: string;
        patientDob: string;
        physicianName: string;
        physicianNpi: string | null;
        facilityName: string | null;
        productSummary: string;
        status: string;
        approvalExpiresAt: string;
      };
      files: Array<{
        id: string;
        fileName: string;
        signedUrl: string;
      }>;
    }
  | { state: "invalid" | "expired" | "already_decided" | "converted" }
> {
  if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
    return { state: "invalid" };
  }
  const adminClient = createAdminClient();

  const { data: ivr } = await adminClient
    .from("standalone_ivrs")
    .select(
      `id, patient_name, patient_dob, physician_name, physician_npi,
       product_summary, status, approval_expires_at,
       facilities ( name )`,
    )
    .eq("approval_token", token)
    .maybeSingle();

  if (!ivr) return { state: "invalid" };

  if (
    ivr.approval_expires_at &&
    new Date(ivr.approval_expires_at as string).getTime() < Date.now()
  ) {
    return { state: "expired" };
  }
  if (ivr.status === "approved" || ivr.status === "denied") {
    return { state: "already_decided" };
  }
  if (ivr.status === "converted") {
    return { state: "converted" };
  }

  const { data: files } = await adminClient
    .from("standalone_ivr_files")
    .select("id, file_path, file_name")
    .eq("standalone_ivr_id", ivr.id);

  const signedFiles = await Promise.all(
    (files ?? []).map(async (f) => {
      const { data: signed } = await adminClient.storage
        .from(process.env.SUPABASE_BUCKET ?? "hbmedical-bucket-private")
        .createSignedUrl(f.file_path as string, 60 * 15);
      return {
        id: f.id as string,
        fileName: f.file_name as string,
        signedUrl: signed?.signedUrl ?? "",
      };
    }),
  );

  const facilityRaw = ivr.facilities as unknown as
    | { name: string | null }
    | Array<{ name: string | null }>
    | null;
  const facility = Array.isArray(facilityRaw) ? facilityRaw[0] ?? null : facilityRaw;
  return {
    state: "valid",
    ivr: {
      id: ivr.id as string,
      patientName: ivr.patient_name as string,
      patientDob: ivr.patient_dob as string,
      physicianName: ivr.physician_name as string,
      physicianNpi: (ivr.physician_npi as string | null) ?? null,
      facilityName: facility?.name ?? null,
      productSummary: ivr.product_summary as string,
      status: ivr.status as string,
      approvalExpiresAt: ivr.approval_expires_at as string,
    },
    files: signedFiles,
  };
}

/**
 * Commits the approver's decision. Called from the public approval page —
 * the token IS the auth. Logs IP + user-agent for audit (Q5), sends
 * notifications to internal parties, writes a history row.
 */
export async function submitIvrDecision(input: {
  token: string;
  decision: "approve" | "deny";
  approverName: string;
  denialReason?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { token, decision, approverName } = input;
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return { success: false, error: "Invalid link." };
    }
    if (!approverName?.trim()) {
      return { success: false, error: "Please enter your name." };
    }
    if (decision === "deny" && !input.denialReason?.trim()) {
      return { success: false, error: "Please provide a denial reason." };
    }

    const adminClient = createAdminClient();

    const { data: ivr } = await adminClient
      .from("standalone_ivrs")
      .select(
        `id, status, patient_name, physician_name, product_summary,
         facility_id, uploaded_by, approval_expires_at, assigned_approver_id,
         external_approvers ( id, name, email )`,
      )
      .eq("approval_token", token)
      .maybeSingle();
    if (!ivr) return { success: false, error: "Invalid link." };

    if (
      ivr.approval_expires_at &&
      new Date(ivr.approval_expires_at as string).getTime() < Date.now()
    ) {
      return { success: false, error: "This approval link has expired." };
    }
    if (ivr.status !== "sent") {
      return {
        success: false,
        error: `This IVR is already ${ivr.status}. No further action needed.`,
      };
    }

    // Audit: capture the requester's IP + UA at click time. Behind
    // Vercel/CF proxies, X-Forwarded-For has the real chain.
    const headerBag = await headers();
    const ip =
      headerBag.get("x-forwarded-for")?.split(",")[0].trim() ??
      headerBag.get("x-real-ip") ??
      "unknown";
    const ua = headerBag.get("user-agent") ?? "unknown";
    const nowIso = new Date().toISOString();

    const patch: Record<string, unknown> = {
      status: decision === "approve" ? "approved" : "denied",
      approver_display_name: approverName.trim(),
      approver_ip: ip,
      approver_user_agent: ua,
      updated_at: nowIso,
    };
    if (decision === "approve") patch.approved_at = nowIso;
    else {
      patch.denied_at = nowIso;
      patch.denial_reason = input.denialReason!.trim();
    }

    const { error: updErr } = await adminClient
      .from("standalone_ivrs")
      .update(patch)
      .eq("id", ivr.id);
    if (updErr) {
      console.error("[submitIvrDecision] update", updErr);
      return { success: false, error: "Failed to record decision." };
    }

    await adminClient.from("standalone_ivr_history").insert({
      standalone_ivr_id: ivr.id,
      event: decision === "approve" ? "approved" : "denied",
      actor_id: null, // external — no portal auth.uid
      actor_display: `${approverName.trim()} (external)`,
      note:
        decision === "deny"
          ? `Reason: ${input.denialReason!.trim()}`
          : `Approved from IP ${ip}`,
    });

    // In-app notifications for internal parties. Body/title short — the
    // full detail lives in the linked IVR.
    const recipients = await gatherInternalRecipients(
      adminClient,
      ivr.uploaded_by as string | null,
      ivr.facility_id as string,
    );
    for (const r of recipients) {
      await adminClient.from("notifications").insert({
        user_id: r,
        standalone_ivr_id: ivr.id,
        type:
          decision === "approve" ? "ivr_approved" : "ivr_denied",
        title:
          decision === "approve"
            ? `IVR approved — ${ivr.patient_name}`
            : `IVR denied — ${ivr.patient_name}`,
        body:
          decision === "approve"
            ? `${approverName.trim()} approved the IVR.`
            : `${approverName.trim()} denied. Reason: ${input.denialReason!.trim()}`,
      });
    }

    // Email notifications — same recipient list, but resolve to emails.
    const recipientEmails = await resolveEmails(adminClient, recipients);
    const dashboardUrl =
      (process.env.NEXT_PUBLIC_APP_URL ??
        process.env.NEXT_PUBLIC_SITE_URL ??
        "http://localhost:3000") + `/dashboard/ivrs`;

    for (const rec of recipientEmails) {
      const email = buildIvrDecisionEmail({
        recipientName: rec.name,
        decision: decision === "approve" ? "approved" : "denied",
        approverDisplayName: approverName.trim(),
        patientName: ivr.patient_name as string,
        physicianName: ivr.physician_name as string,
        productSummary: ivr.product_summary as string,
        denialReason: decision === "deny" ? input.denialReason!.trim() : null,
        ivrUrl: dashboardUrl,
      });
      try {
        await paubox.emails.send({
          from: ACCOUNTS_FROM_EMAIL,
          to: rec.email,
          subject: email.subject,
          html: email.html,
          text: email.text,
        });
      } catch (err) {
        console.error("[submitIvrDecision] paubox notify", err, {
          to: rec.email,
        });
      }
    }

    revalidatePath("/dashboard/ivrs");
    return { success: true };
  } catch (err) {
    console.error("[submitIvrDecision]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unexpected error.",
    };
  }
}

async function gatherInternalRecipients(
  adminClient: ReturnType<typeof createAdminClient>,
  uploaderId: string | null,
  facilityId: string,
): Promise<string[]> {
  const ids = new Set<string>();
  if (uploaderId) ids.add(uploaderId);

  // Clinic staff/providers at the facility (doctor's staff).
  const { data: members } = await adminClient
    .from("facility_members")
    .select("user_id")
    .eq("facility_id", facilityId);
  if (members) {
    for (const m of members) ids.add(m.user_id as string);
  }

  // Meridian internal (admin + support).
  const { data: internal } = await adminClient
    .from("profiles")
    .select("id")
    .in("role", ["admin", "support_staff"]);
  if (internal) {
    for (const p of internal) ids.add(p.id as string);
  }

  return Array.from(ids);
}

async function resolveEmails(
  adminClient: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Array<{ email: string; name: string }>> {
  if (userIds.length === 0) return [];
  // Emails live on auth.users, names on profiles.
  const { data: profiles } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", userIds);
  const nameById = new Map<string, string>();
  for (const p of profiles ?? []) {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
    nameById.set(p.id as string, name || "there");
  }
  const results: Array<{ email: string; name: string }> = [];
  for (const uid of userIds) {
    try {
      const { data } = await adminClient.auth.admin.getUserById(uid);
      const email = data?.user?.email;
      if (email) {
        results.push({ email, name: nameById.get(uid) ?? "there" });
      }
    } catch {
      // best-effort — skip if not found
    }
  }
  return results;
}
