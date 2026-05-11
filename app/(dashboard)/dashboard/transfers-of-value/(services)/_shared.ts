"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import { VALUE_REPORTS_TABLE } from "@/utils/constants/value-transfers";

export type ReportAccess = {
  userId: string;
  isAdmin: boolean;
  reportId: string;
  repId: string;
  status: "draft" | "submitted" | "reviewed";
};

/**
 * Verify the caller can READ a given report and return basic ownership info.
 * Sales reps may read their own; admins may read any. Returns null when not
 * authorized — server actions should treat that as "not found".
 */
export async function getReportAccess(
  reportId: string,
): Promise<ReportAccess | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);
  const admin = isAdmin(role);

  const client = admin ? createAdminClient() : supabase;
  const { data, error } = await client
    .from(VALUE_REPORTS_TABLE)
    .select("id, rep_id, status")
    .eq("id", reportId)
    .maybeSingle();

  if (error || !data) return null;

  // Non-admin must own the report.
  if (!admin && data.rep_id !== user.id) return null;

  return {
    userId: user.id,
    isAdmin: admin,
    reportId: data.id as string,
    repId: data.rep_id as string,
    status: data.status as ReportAccess["status"],
  };
}

/**
 * Same as getReportAccess but additionally enforces the rep's write rules:
 * caller is the report owner AND the report is still a draft.
 */
export async function requireReportWriteAccess(
  reportId: string,
): Promise<ReportAccess> {
  const access = await getReportAccess(reportId);
  if (!access) throw new Error("Report not found.");
  if (access.isAdmin) throw new Error("Admins cannot edit reports.");
  if (access.userId !== access.repId)
    throw new Error("You can only edit your own report.");
  if (access.status !== "draft")
    throw new Error("This report is locked — submitted reports cannot be edited.");
  return access;
}
