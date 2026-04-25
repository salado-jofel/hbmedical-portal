"use server";

/**
 * HIPAA audit-log writer (Security Rule §164.312(b) "Audit controls").
 *
 * Call this from any server-side path that reads or writes PHI on behalf of
 * a user. It records who-did-what-when into the append-only `phi_access_log`
 * table.
 *
 * Design constraints:
 *   - **Never throws.** A logging failure must NOT cause the underlying
 *     operation (an order read, a document download) to fail. The whole
 *     insert is wrapped in try/catch and only logs to console on error.
 *   - **Fire-and-forget OK.** Callers may `await` for ordering but failure
 *     never propagates.
 *   - **Snapshot user identity.** We capture user_email and user_role at
 *     write time so future deletions/role-changes don't poison the audit
 *     trail (the whole point of the log is post-hoc accountability).
 *   - **IP + user-agent best-effort.** Pulled from the headers() helper
 *     when available (Next.js App Router request context). May be null
 *     for cron / background jobs.
 *
 * Action naming convention: "<resource>.<verb>", e.g. "order.read",
 * "ivr.read", "document.download", "ai.extract", "pdf.regenerate". Keep
 * verbs short and consistent so admin filtering stays sane.
 */

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface PhiAccessLogEntry {
  /** "<resource>.<verb>" — e.g. "order.read", "document.download". */
  action: string;
  /** Logical resource name — typically a table name. */
  resource: string;
  /** UUID of the row touched, when applicable. */
  resourceId?: string | null;
  /** Order this access relates to, denormalized for fast lookup. */
  orderId?: string | null;
  /** Free-form context (filter snapshots, doc types, etc). Avoid PHI here. */
  metadata?: Record<string, unknown>;
}

/**
 * Insert one log row. Captures identity from the current Supabase session
 * if available, else from a passed-in fallback (background jobs).
 */
export async function logPhiAccess(entry: PhiAccessLogEntry): Promise<void> {
  try {
    // Identity snapshot — we read it from the user-side client (RLS-bound)
    // so a forged service-role call can't fake a user_id by passing one in.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let userEmail: string | null = user?.email ?? null;
    let userRole: string | null = null;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, role")
        .eq("id", user.id)
        .maybeSingle();
      userEmail = profile?.email ?? userEmail;
      userRole = (profile?.role as string | null) ?? null;
    }

    // Best-effort request metadata. headers() throws when called outside
    // of a request scope (e.g. a Webhook handler that already consumed
    // the request); swallow gracefully.
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
      userAgent = h.get("user-agent") ?? null;
    } catch {
      /* outside request scope — that's fine */
    }

    // Service-role insert: bypasses RLS (which only allows SELECT for
    // admins). The append-only invariant is enforced by the REVOKE on the
    // authenticated/anon roles in the migration — service role retains
    // full access by design (ops break-glass).
    const adminClient = createAdminClient();
    await adminClient.from("phi_access_log").insert({
      user_id: user?.id ?? null,
      user_email: userEmail,
      user_role: userRole,
      action: entry.action,
      resource: entry.resource,
      resource_id: entry.resourceId ?? null,
      order_id: entry.orderId ?? null,
      ip,
      user_agent: userAgent,
      metadata: entry.metadata ?? {},
    });
  } catch (err) {
    // Never throw. Logging failures are visible in server logs but do not
    // propagate to the caller — the actual data operation must continue.
    console.error("[logPhiAccess] insert failed:", err);
  }
}
