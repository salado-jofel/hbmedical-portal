import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendNet30ReminderEmail,
  type Net30ReminderStage,
} from "@/lib/emails/send-net30-reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDERS_PATH = "/dashboard/orders";
const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS_BEFORE_DUE = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

type FlatCandidate = {
  orderId: string;
  orderNumber: string | null;
  invoiceId: string;
  providerInvoiceId: string;
  invoiceNumber: string | null;
  invoiceStatus: string;
  dueAt: string;
  /** stored in major units (dollars) in the DB */
  amountDue: number;
  amountPaid: number;
  currency: string;
  hostedInvoiceUrl: string | null;
  lastReminderStage: Net30ReminderStage | null;
  reminderCount: number;
  reminderLockId: string | null;
  facilityName: string | null;
  facilityUserId: string | null;
  productName: string | null;
};

type ReminderDecision =
  | { shouldSend: false; reason: string }
  | { shouldSend: true; stage: Net30ReminderStage; overdueDays: number | null };

type ProcessResult = {
  orderId: string;
  orderNumber: string | null;
  invoiceId: string;
  status: "sent" | "skipped" | "failed";
  stage: Net30ReminderStage | null;
  reason?: string;
  error?: string;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;
  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token.trim();
}

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Allow all requests in dev when CRON_SECRET is not configured.
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }
  return getBearerToken(request) === cronSecret;
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toUtcStartOfDay(value: Date | string): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function diffUtcCalendarDays(from: Date, to: Date): number {
  return Math.round(
    (toUtcStartOfDay(to).getTime() - toUtcStartOfDay(from).getTime()) / DAY_MS,
  );
}

// ─── Relation helpers ─────────────────────────────────────────────────────────

function getSingle<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const ORDER_WITH_INVOICE_SELECT = `
  id,
  order_number,
  payment_status,
  facilities ( name, user_id ),
  order_items ( product_name ),
  invoices (
    id,
    provider_invoice_id,
    invoice_number,
    status,
    amount_due,
    amount_paid,
    currency,
    due_at,
    hosted_invoice_url,
    net30_last_reminder_stage,
    net30_reminder_count,
    net30_reminder_lock_id
  )
`;

function flattenCandidate(row: Record<string, unknown>): FlatCandidate | null {
  // Skip terminal order payment states
  const paymentStatus = row.payment_status as string | null;
  if (
    paymentStatus === "paid" ||
    paymentStatus === "canceled" ||
    paymentStatus === "refunded" ||
    paymentStatus === "partially_refunded"
  ) {
    return null;
  }

  const invoice = getSingle(row.invoices as unknown);
  if (!invoice) return null;

  const inv = invoice as Record<string, unknown>;

  // Must have a Stripe invoice ID and due date to send reminders
  if (!inv.provider_invoice_id || !inv.due_at) return null;

  // Skip already settled invoices
  if (inv.status === "paid" || inv.status === "void") return null;

  const facility = getSingle(row.facilities as unknown) as Record<
    string,
    unknown
  > | null;
  const orderItems = row.order_items as Array<Record<string, unknown>> | null;
  const firstItem = Array.isArray(orderItems) ? (orderItems[0] ?? null) : null;

  return {
    orderId: row.id as string,
    orderNumber: (row.order_number as string | null) ?? null,
    invoiceId: inv.id as string,
    providerInvoiceId: inv.provider_invoice_id as string,
    invoiceNumber: (inv.invoice_number as string | null) ?? null,
    invoiceStatus: (inv.status as string | null) ?? "issued",
    dueAt: inv.due_at as string,
    amountDue: Number(inv.amount_due ?? 0),
    amountPaid: Number(inv.amount_paid ?? 0),
    currency: (inv.currency as string | null) ?? "USD",
    hostedInvoiceUrl: (inv.hosted_invoice_url as string | null) ?? null,
    lastReminderStage:
      (inv.net30_last_reminder_stage as Net30ReminderStage | null) ?? null,
    reminderCount: (inv.net30_reminder_count as number | null) ?? 0,
    reminderLockId: (inv.net30_reminder_lock_id as string | null) ?? null,
    facilityName: (facility?.name as string | null) ?? null,
    facilityUserId: (facility?.user_id as string | null) ?? null,
    productName: (firstItem?.product_name as string | null) ?? null,
  };
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadCandidates(): Promise<FlatCandidate[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("orders")
    .select(ORDER_WITH_INVOICE_SELECT)
    .eq("payment_method", "net_30")
    .in("payment_status", ["pending", "failed"])
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to load candidates: ${error.message}`,
    );
  }

  const candidates: FlatCandidate[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const candidate = flattenCandidate(row);
    if (candidate) candidates.push(candidate);
  }
  return candidates;
}

async function refreshCandidate(orderId: string): Promise<FlatCandidate | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("orders")
    .select(ORDER_WITH_INVOICE_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) return null;
  return flattenCandidate(data as Record<string, unknown>);
}

// ─── Email lookup ──────────────────────────────────────────────────────────────

async function resolveRecipientEmail(
  userId: string | null,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (!userId) return null;
  if (cache.has(userId)) return cache.get(userId) ?? null;

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const email = error ? null : (data?.user?.email ?? null);
  cache.set(userId, email);
  return email;
}

// ─── Reminder decision ────────────────────────────────────────────────────────

function decideReminderStage(
  candidate: FlatCandidate,
  now: Date,
): ReminderDecision {
  const today = toUtcStartOfDay(now);
  const dueDate = toUtcStartOfDay(candidate.dueAt);
  const daysUntilDue = diffUtcCalendarDays(today, dueDate);

  if (daysUntilDue === UPCOMING_DAYS_BEFORE_DUE) {
    return { shouldSend: true, stage: "upcoming", overdueDays: null };
  }
  if (daysUntilDue === 1) {
    return { shouldSend: true, stage: "tomorrow", overdueDays: null };
  }
  if (daysUntilDue === 0) {
    return { shouldSend: true, stage: "due_today", overdueDays: null };
  }
  if (daysUntilDue < 0) {
    return {
      shouldSend: true,
      stage: "overdue",
      overdueDays: Math.abs(daysUntilDue),
    };
  }
  return { shouldSend: false, reason: "not_in_send_window" };
}

// ─── DB write helpers ─────────────────────────────────────────────────────────

async function claimLock(invoiceId: string): Promise<string | null> {
  const admin = createAdminClient();
  const lockId = crypto.randomUUID();

  const { data, error } = await admin
    .from("invoices")
    .update({ net30_reminder_lock_id: lockId })
    .eq("id", invoiceId)
    .is("net30_reminder_lock_id", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `[net30 reminders] claimLock failed for invoice ${invoiceId}: ${error.message}`,
    );
  }
  return data ? lockId : null;
}

async function releaseLock(invoiceId: string, lockId: string): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("invoices")
    .update({ net30_reminder_lock_id: null })
    .eq("id", invoiceId)
    .eq("net30_reminder_lock_id", lockId);
}

async function markReminderSent(
  candidate: FlatCandidate,
  stage: Net30ReminderStage,
  lockId: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({
      net30_last_reminder_stage: stage,
      net30_last_reminder_sent_at: new Date().toISOString(),
      net30_reminder_count: candidate.reminderCount + 1,
      net30_reminder_email_error: null,
      net30_reminder_lock_id: null,
    })
    .eq("id", candidate.invoiceId)
    .eq("net30_reminder_lock_id", lockId);

  if (error) {
    throw new Error(
      `[net30 reminders] markReminderSent failed for invoice ${candidate.invoiceId}: ${error.message}`,
    );
  }
}

async function markReminderFailed(
  invoiceId: string,
  lockId: string,
  message: string,
): Promise<void> {
  const admin = createAdminClient();
  await admin
    .from("invoices")
    .update({
      net30_reminder_email_error: message,
      net30_reminder_lock_id: null,
    })
    .eq("id", invoiceId)
    .eq("net30_reminder_lock_id", lockId);
}

async function markInvoiceOverdueIfNeeded(
  orderId: string,
  invoiceId: string,
  currentInvoiceStatus: string,
  lockId: string,
): Promise<void> {
  if (currentInvoiceStatus === "overdue") return;

  const admin = createAdminClient();

  await Promise.all([
    // Update invoices.status — guards with lock to prevent race
    admin
      .from("invoices")
      .update({ status: "overdue" })
      .eq("id", invoiceId)
      .eq("net30_reminder_lock_id", lockId),
    // Mirror to orders.invoice_status for UI display
    admin.from("orders").update({ invoice_status: "overdue" }).eq("id", orderId),
  ]);
}

// ─── Process one candidate ────────────────────────────────────────────────────

async function processCandidate(
  candidate: FlatCandidate,
  recipientEmail: string | null,
  now: Date,
  dryRun: boolean,
): Promise<ProcessResult> {
  const base = {
    orderId: candidate.orderId,
    orderNumber: candidate.orderNumber,
    invoiceId: candidate.invoiceId,
  };

  if (!recipientEmail) {
    return { ...base, status: "skipped", stage: null, reason: "missing_recipient_email" };
  }

  const initialDecision = decideReminderStage(candidate, now);

  if (!initialDecision.shouldSend) {
    return { ...base, status: "skipped", stage: null, reason: initialDecision.reason };
  }

  if (candidate.lastReminderStage === initialDecision.stage) {
    return {
      ...base,
      status: "skipped",
      stage: initialDecision.stage,
      reason: "stage_already_sent",
    };
  }

  if (dryRun) {
    return { ...base, status: "sent", stage: initialDecision.stage, reason: "dry_run" };
  }

  const lockId = await claimLock(candidate.invoiceId);

  if (!lockId) {
    return {
      ...base,
      status: "skipped",
      stage: initialDecision.stage,
      reason: "locked_by_another_process",
    };
  }

  try {
    // Re-read after acquiring lock to guard against concurrent updates
    const fresh = await refreshCandidate(candidate.orderId);

    if (!fresh) {
      await releaseLock(candidate.invoiceId, lockId);
      return { ...base, status: "skipped", stage: null, reason: "invoice_gone_after_lock" };
    }

    const freshDecision = decideReminderStage(fresh, now);

    if (!freshDecision.shouldSend) {
      await releaseLock(fresh.invoiceId, lockId);
      return {
        orderId: fresh.orderId,
        orderNumber: fresh.orderNumber,
        invoiceId: fresh.invoiceId,
        status: "skipped",
        stage: null,
        reason: freshDecision.reason,
      };
    }

    if (fresh.lastReminderStage === freshDecision.stage) {
      await releaseLock(fresh.invoiceId, lockId);
      return {
        orderId: fresh.orderId,
        orderNumber: fresh.orderNumber,
        invoiceId: fresh.invoiceId,
        status: "skipped",
        stage: freshDecision.stage,
        reason: "stage_already_sent",
      };
    }

    if (freshDecision.stage === "overdue") {
      await markInvoiceOverdueIfNeeded(
        fresh.orderId,
        fresh.invoiceId,
        fresh.invoiceStatus,
        lockId,
      );
    }

    // DB stores amounts in major units (dollars); email expects cents
    const amountRemainingCents = Math.round(
      (fresh.amountDue - fresh.amountPaid) * 100,
    );

    await sendNet30ReminderEmail({
      to: recipientEmail,
      orderId: fresh.orderId,
      orderNumber: fresh.orderNumber,
      facilityName: fresh.facilityName,
      productName: fresh.productName,
      amountRemaining: amountRemainingCents > 0 ? amountRemainingCents : null,
      currency: fresh.currency,
      dueDate: fresh.dueAt,
      hostedInvoiceUrl: fresh.hostedInvoiceUrl,
      invoiceNumber: fresh.invoiceNumber,
      reminderStage: freshDecision.stage,
      overdueDays: freshDecision.overdueDays,
    });

    await markReminderSent(fresh, freshDecision.stage, lockId);

    return {
      orderId: fresh.orderId,
      orderNumber: fresh.orderNumber,
      invoiceId: fresh.invoiceId,
      status: "sent",
      stage: freshDecision.stage,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown reminder error";
    try {
      await markReminderFailed(candidate.invoiceId, lockId, message);
    } catch (persistErr) {
      console.error("[net30 reminders] Failed to persist failure state:", persistErr);
    }
    return {
      ...base,
      status: "failed",
      stage: initialDecision.stage,
      error: message,
    };
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

async function handleReminderCron(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const now = new Date();

  try {
    const candidates = await loadCandidates();
    const emailCache = new Map<string, string | null>();
    const results: ProcessResult[] = [];

    for (const candidate of candidates) {
      const email = await resolveRecipientEmail(candidate.facilityUserId, emailCache);
      const result = await processCandidate(candidate, email, now, dryRun);
      results.push(result);
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const failed = results.filter((r) => r.status === "failed").length;

    if (sent > 0 && !dryRun) {
      revalidatePath(ORDERS_PATH);
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      processedAt: now.toISOString(),
      summary: { candidateCount: candidates.length, sent, skipped, failed },
      results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Net 30 reminder cron failed.";
    console.error("[net30 reminders] fatal error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return handleReminderCron(request);
}

export async function POST(request: Request) {
  return handleReminderCron(request);
}
