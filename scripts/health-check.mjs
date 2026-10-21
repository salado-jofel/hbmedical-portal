#!/usr/bin/env node
/**
 * Portal health check — read-only.
 *
 * Finds the things a customer would notice before they report them: faxes that
 * downloaded empty, AI extractions that failed, contracts whose PDF is missing
 * from storage, orders sitting in a review state for too long, providers who
 * can't sign because they have no PIN, clinics with no rep attached.
 *
 * Usage (dev):
 *   node --env-file=.env.local scripts/health-check.mjs
 *   npm run health
 *
 * Usage (prod): point it at the prod project for one run — nothing is written.
 *   node --env-file=.env.production.local scripts/health-check.mjs
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   (required)
 *   HEALTH_CHECK_BASE_URL                                  (optional, e.g. https://portal.example.com)
 *
 * Exit code is 1 when any check FAILs, so it can be wired to a cron/CI alert.
 */

import { createClient } from "@supabase/supabase-js";

/* ── Thresholds — tune these as the business changes ── */
const STUCK_ORDER_DAYS = 7; // manufacturer_review / additional_info_needed with no movement
const UNANSWERED_IVR_DAYS = 7; // standalone IVR sent to an approver, no decision
const SIGNATURE_SAMPLE = 100; // newest contract signatures to verify in storage
const PRIVATE_BUCKET = "hbmedical-bucket-private";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const baseUrl = process.env.HEALTH_CHECK_BASE_URL;

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run with:  node --env-file=.env.local scripts/health-check.mjs",
  );
  process.exit(2);
}

const db = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const daysAgo = (n) => new Date(Date.now() - n * 86400_000).toISOString();
const ok = (name, note) => ({ name, status: "PASS", note: note ?? "" });
const warn = (name, note, sample) => ({ name, status: "WARN", note, sample });
const fail = (name, note, sample) => ({ name, status: "FAIL", note, sample });
const ids = (rows, field = "id") => rows.slice(0, 5).map((r) => r[field]).join(", ");

/* ── Checks ── */

async function emptyFaxFiles() {
  const { data, error } = await db
    .from("intake_documents")
    .select("id, file_name, received_at, file_size, status")
    .or("file_size.is.null,file_size.eq.0")
    .neq("status", "dismissed");
  if (error) throw error;
  if (data.length === 0) return ok("Inbound fax files", "all have content");
  return fail(
    "Inbound fax files",
    `${data.length} intake document(s) are 0 bytes — the PDF will not open. Use "Re-download from iFax" on each.`,
    ids(data),
  );
}

async function extractionFailures() {
  const { data, error } = await db
    .from("orders")
    .select("id, order_number, ai_extraction_error, updated_at")
    .not("ai_extraction_error", "is", null);
  if (error) throw error;
  if (data.length === 0) return ok("AI extraction", "no recorded failures");
  return fail(
    "AI extraction",
    `${data.length} order(s) show an extraction error banner to the user. Open each and press "Retry extraction".`,
    ids(data, "order_number"),
  );
}

async function emptyOrderDocuments() {
  const { data, error } = await db
    .from("order_documents")
    .select("id, order_id, file_name, document_type")
    .or("file_size.is.null,file_size.eq.0");
  if (error) throw error;
  if (data.length === 0) return ok("Order documents", "no empty uploads");
  return fail(
    "Order documents",
    `${data.length} order document(s) are empty — downloads will fail.`,
    ids(data, "file_name"),
  );
}

/** Contract PDFs are linked from Resources; a missing object = a dead "View" link. */
async function missingContractPdfs() {
  const { data, error } = await db
    .from("provider_contract_signatures")
    .select("id, signed_path, contract_type, signed_at")
    .order("signed_at", { ascending: false })
    .limit(SIGNATURE_SAMPLE);
  if (error) throw error;
  if (data.length === 0) return ok("Signed contract PDFs", "no signatures yet");

  const byFolder = new Map();
  for (const row of data) {
    const i = row.signed_path.lastIndexOf("/");
    const folder = row.signed_path.slice(0, i);
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push({ ...row, file: row.signed_path.slice(i + 1) });
  }

  const missing = [];
  for (const [folder, rows] of byFolder) {
    const { data: objects } = await db.storage
      .from(PRIVATE_BUCKET)
      .list(folder, { limit: 100 });
    const present = new Set((objects ?? []).map((o) => o.name));
    for (const r of rows) if (!present.has(r.file)) missing.push(r);
  }

  if (missing.length === 0)
    return ok("Signed contract PDFs", `${data.length} checked, all present`);
  return fail(
    "Signed contract PDFs",
    `${missing.length} signature row(s) point at a file that is not in storage — "View" is broken on the Resources page.`,
    missing.slice(0, 5).map((m) => m.signed_path).join(", "),
  );
}

async function stuckOrders() {
  const { data, error } = await db
    .from("orders")
    .select("id, order_number, order_status, updated_at")
    .in("order_status", ["manufacturer_review", "additional_info_needed"])
    .lt("updated_at", daysAgo(STUCK_ORDER_DAYS));
  if (error) throw error;
  if (data.length === 0) return ok("Order pipeline", "nothing stalled");
  return warn(
    "Order pipeline",
    `${data.length} order(s) have not moved in ${STUCK_ORDER_DAYS}+ days — the clinic is waiting.`,
    ids(data, "order_number"),
  );
}

async function unansweredIvrs() {
  const { data, error } = await db
    .from("standalone_ivrs")
    .select("id, patient_name, sent_at, approval_expires_at")
    .eq("status", "sent")
    .lt("sent_at", daysAgo(UNANSWERED_IVR_DAYS));
  if (error) throw error;
  if (data.length === 0) return ok("IVR approvals", "none overdue");
  const expired = data.filter(
    (r) => r.approval_expires_at && new Date(r.approval_expires_at) < new Date(),
  ).length;
  return warn(
    "IVR approvals",
    `${data.length} IVR(s) sent ${UNANSWERED_IVR_DAYS}+ days ago with no decision` +
      (expired > 0 ? `, ${expired} with an expired approval link (resend needed)` : ""),
    ids(data),
  );
}

/** With the PIN gate live, a provider without a PIN is blocked at first login. */
async function providersWithoutPin() {
  const { data: providers, error } = await db
    .from("profiles")
    .select("id, email, status")
    .eq("role", "clinical_provider")
    .neq("status", "inactive");
  if (error) throw error;
  if (providers.length === 0) return ok("Provider signing PINs", "no providers");

  const { data: creds, error: credErr } = await db
    .from("provider_credentials")
    .select("user_id, pin_hash")
    .in("user_id", providers.map((p) => p.id));
  if (credErr) throw credErr;

  const withPin = new Set((creds ?? []).filter((c) => c.pin_hash).map((c) => c.user_id));
  const blocked = providers.filter((p) => !withPin.has(p.id));
  if (blocked.length === 0)
    return ok("Provider signing PINs", `${providers.length} provider(s), all set`);
  return warn(
    "Provider signing PINs",
    `${blocked.length} provider(s) have no PIN and cannot sign orders until they set one ` +
      `(expected right after onboarding, a problem if it persists).`,
    ids(blocked, "email"),
  );
}

async function clinicsWithoutRep() {
  const { data, error } = await db
    .from("facilities")
    .select("id, name, status")
    .eq("facility_type", "clinic")
    .eq("status", "active")
    .is("assigned_rep", null);
  if (error) throw error;
  if (data.length === 0) return ok("Clinic → rep assignment", "every active clinic has a rep");
  return warn(
    "Clinic → rep assignment",
    `${data.length} active clinic(s) have no assigned rep — their orders earn no commission.`,
    ids(data, "name"),
  );
}

async function staleInvites() {
  const { data, error } = await db
    .from("invite_tokens")
    .select("id, invited_email, expires_at")
    .is("used_at", null)
    .lt("expires_at", new Date().toISOString());
  if (error) throw error;
  if (data.length === 0) return ok("Invite links", "no expired unused invites");
  return warn(
    "Invite links",
    `${data.length} invite(s) expired before being used — those people never got in.`,
    ids(data, "invited_email"),
  );
}

async function sitePages() {
  if (!baseUrl) return ok("Public pages", "skipped (set HEALTH_CHECK_BASE_URL)");
  const paths = ["/", "/sign-in"];
  const problems = [];
  let maintenance = false;
  for (const p of paths) {
    try {
      const res = await fetch(new URL(p, baseUrl), { redirect: "follow" });
      if (new URL(res.url).pathname.startsWith("/maintenance")) maintenance = true;
      if (res.status >= 400) problems.push(`${p} → ${res.status}`);
    } catch (err) {
      problems.push(`${p} → ${err.message}`);
    }
  }
  if (maintenance)
    return fail("Public pages", "the site is serving the MAINTENANCE page to everyone.");
  if (problems.length > 0) return fail("Public pages", problems.join("; "));
  return ok("Public pages", `${paths.length} page(s) responding`);
}

/* ── Runner ── */

const CHECKS = [
  emptyFaxFiles,
  extractionFailures,
  emptyOrderDocuments,
  missingContractPdfs,
  stuckOrders,
  unansweredIvrs,
  providersWithoutPin,
  clinicsWithoutRep,
  staleInvites,
  sitePages,
];

const ICON = { PASS: "ok  ", WARN: "WARN", FAIL: "FAIL" };

const projectRef = new URL(url).hostname.split(".")[0];
console.log(`\nMeridian Portal health check — ${new Date().toLocaleString()}`);
console.log(`Supabase project: ${projectRef}${baseUrl ? `   site: ${baseUrl}` : ""}`);
console.log("-".repeat(72));

const results = [];
for (const check of CHECKS) {
  try {
    results.push(await check());
  } catch (err) {
    results.push(fail(check.name, `check could not run: ${err.message ?? err}`));
  }
}

for (const r of results) {
  console.log(`[${ICON[r.status]}] ${r.name}${r.note ? ` — ${r.note}` : ""}`);
  if (r.sample) console.log(`         e.g. ${r.sample}`);
}

const failed = results.filter((r) => r.status === "FAIL").length;
const warned = results.filter((r) => r.status === "WARN").length;
console.log("-".repeat(72));
console.log(
  failed === 0 && warned === 0
    ? "All clear."
    : `${failed} needing a fix, ${warned} worth a look, ${results.length - failed - warned} clear.\n`,
);

process.exit(failed > 0 ? 1 : 0);
