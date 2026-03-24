import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/utils/supabase/admin";
import {
  sendNet30ReminderEmail,
  type Net30ReminderStage,
} from "@/utils/emails/send-net30-reminder";
import type { PersistedPaymentStatus } from "@/app/(interfaces)/payment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDERS_PATH = "/dashboard/orders";
const DAY_MS = 24 * 60 * 60 * 1000;
const UPCOMING_DAYS_BEFORE_DUE = 7;
const DEFAULT_CURRENCY = "usd";

type ReminderCandidateRow = {
  id: string;
  order_id: string | null;

  payment_mode: string | null;
  payment_status: PersistedPaymentStatus | null;

  receipt_email: string | null;

  stripe_invoice_id: string | null;
  stripe_invoice_number: string | null;
  stripe_invoice_hosted_url: string | null;

  invoice_due_date: string | null;
  invoice_amount_due: number | null;
  invoice_amount_remaining: number | null;
  invoice_overdue_at: string | null;

  net30_last_reminder_stage: Net30ReminderStage | null;
  net30_last_reminder_sent_at: string | null;
  net30_reminder_count: number | null;
  net30_reminder_email_error: string | null;
  net30_reminder_lock_id: string | null;

  facilities?:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null;

  products?:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null;
};

type ReminderDecision =
  | {
      shouldSend: false;
      reason: string;
    }
  | {
      shouldSend: true;
      stage: Net30ReminderStage;
      overdueDays: number | null;
    };

type ProcessResult = {
  orderId: string;
  orderNumber: string | null;
  recipient: string | null;
  status: "sent" | "skipped" | "failed";
  stage: Net30ReminderStage | null;
  reason?: string;
  error?: string;
};

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;

  return token.trim();
}

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // Allow local/dev execution if no CRON_SECRET is set.
  if (!cronSecret) {
    return process.env.NODE_ENV !== "production";
  }

  const bearerToken = getBearerToken(request);
  return bearerToken === cronSecret;
}

function toUtcStartOfDay(value: Date | string): Date {
  const date = typeof value === "string" ? new Date(value) : value;

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function diffUtcCalendarDays(from: Date, to: Date): number {
  const fromStart = toUtcStartOfDay(from).getTime();
  const toStart = toUtcStartOfDay(to).getTime();

  return Math.round((toStart - fromStart) / DAY_MS);
}

function getRelatedName(
  value:
    | { name?: string | null }
    | Array<{ name?: string | null }>
    | null
    | undefined,
): string | null {
  if (!value) return null;

  if (Array.isArray(value)) {
    return value[0]?.name?.trim() || null;
  }

  return value.name?.trim() || null;
}

function isBlank(value: string | null | undefined): boolean {
  return !value || value.trim().length === 0;
}

function getEffectiveAmountRemaining(
  order: ReminderCandidateRow,
): number | null {
  if (
    typeof order.invoice_amount_remaining === "number" &&
    Number.isFinite(order.invoice_amount_remaining)
  ) {
    return order.invoice_amount_remaining;
  }

  if (
    typeof order.invoice_amount_due === "number" &&
    Number.isFinite(order.invoice_amount_due)
  ) {
    return order.invoice_amount_due;
  }

  return null;
}

function decideReminderStage(
  order: ReminderCandidateRow,
  now: Date,
): ReminderDecision {
  if (order.payment_mode !== "net_30") {
    return { shouldSend: false, reason: "not_net_30" };
  }

  if (!order.stripe_invoice_id) {
    return { shouldSend: false, reason: "missing_invoice_id" };
  }

  if (order.payment_status === "paid") {
    return { shouldSend: false, reason: "already_paid" };
  }

  if (isBlank(order.receipt_email)) {
    return { shouldSend: false, reason: "missing_receipt_email" };
  }

  if (!order.invoice_due_date) {
    return { shouldSend: false, reason: "missing_due_date" };
  }

  const amountRemaining = getEffectiveAmountRemaining(order);

  if (amountRemaining != null && amountRemaining <= 0) {
    return { shouldSend: false, reason: "no_balance_remaining" };
  }

  const today = toUtcStartOfDay(now);
  const dueDate = toUtcStartOfDay(order.invoice_due_date);
  const daysUntilDue = diffUtcCalendarDays(today, dueDate);

  if (daysUntilDue === UPCOMING_DAYS_BEFORE_DUE) {
    return {
      shouldSend: true,
      stage: "upcoming",
      overdueDays: null,
    };
  }

  if (daysUntilDue === 1) {
    return {
      shouldSend: true,
      stage: "tomorrow",
      overdueDays: null,
    };
  }

  if (daysUntilDue === 0) {
    return {
      shouldSend: true,
      stage: "due_today",
      overdueDays: null,
    };
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

async function loadReminderCandidates(): Promise<ReminderCandidateRow[]> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      order_id,
      payment_mode,
      payment_status,
      receipt_email,
      stripe_invoice_id,
      stripe_invoice_number,
      stripe_invoice_hosted_url,
      invoice_due_date,
      invoice_amount_due,
      invoice_amount_remaining,
      invoice_overdue_at,
      net30_last_reminder_stage,
      net30_last_reminder_sent_at,
      net30_reminder_count,
      net30_reminder_email_error,
      net30_reminder_lock_id,
      facilities(name),
      products(name)
    `,
    )
    .eq("payment_mode", "net_30")
    .not("stripe_invoice_id", "is", null)
    .not("invoice_due_date", "is", null)
    .in("payment_status", [
      "unpaid",
      "invoice_sent",
      "overdue",
      "payment_failed",
    ])
    .order("invoice_due_date", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to load reminder candidates: ${error.message}`,
    );
  }

  return (data ?? []) as ReminderCandidateRow[];
}

async function loadOrderById(
  orderId: string,
): Promise<ReminderCandidateRow | null> {
  const supabaseAdmin = createAdminClient();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      order_id,
      payment_mode,
      payment_status,
      receipt_email,
      stripe_invoice_id,
      stripe_invoice_number,
      stripe_invoice_hosted_url,
      invoice_due_date,
      invoice_amount_due,
      invoice_amount_remaining,
      invoice_overdue_at,
      net30_last_reminder_stage,
      net30_last_reminder_sent_at,
      net30_reminder_count,
      net30_reminder_email_error,
      net30_reminder_lock_id,
      facilities(name),
      products(name)
    `,
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to reload order ${orderId}: ${error.message}`,
    );
  }

  return (data as ReminderCandidateRow | null) ?? null;
}

async function claimReminderLock(orderId: string): Promise<string | null> {
  const supabaseAdmin = createAdminClient();
  const lockId = crypto.randomUUID();

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      net30_reminder_lock_id: lockId,
    })
    .eq("id", orderId)
    .is("net30_reminder_lock_id", null)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to claim reminder lock for ${orderId}: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  return lockId;
}

async function releaseReminderLock(orderId: string, lockId: string) {
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      net30_reminder_lock_id: null,
    })
    .eq("id", orderId)
    .eq("net30_reminder_lock_id", lockId);

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to release reminder lock for ${orderId}: ${error.message}`,
    );
  }
}

async function markOrderOverdueIfNeeded(
  orderId: string,
  currentStatus: PersistedPaymentStatus | null,
  lockId: string,
) {
  if (currentStatus === "overdue") return;

  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: "overdue",
      invoice_overdue_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("net30_reminder_lock_id", lockId);

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to mark order ${orderId} overdue: ${error.message}`,
    );
  }
}

async function markReminderSent(
  order: ReminderCandidateRow,
  stage: Net30ReminderStage,
  lockId: string,
) {
  const supabaseAdmin = createAdminClient();

  const nextReminderCount = (order.net30_reminder_count ?? 0) + 1;

  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      net30_last_reminder_stage: stage,
      net30_last_reminder_sent_at: new Date().toISOString(),
      net30_reminder_count: nextReminderCount,
      net30_reminder_email_error: null,
      net30_reminder_lock_id: null,
    })
    .eq("id", order.id)
    .eq("net30_reminder_lock_id", lockId);

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to save reminder send state for ${order.id}: ${error.message}`,
    );
  }
}

async function markReminderFailed(
  orderId: string,
  lockId: string,
  message: string,
) {
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from("orders")
    .update({
      net30_reminder_email_error: message,
      net30_reminder_lock_id: null,
    })
    .eq("id", orderId)
    .eq("net30_reminder_lock_id", lockId);

  if (error) {
    throw new Error(
      `[net30 reminders] Failed to save reminder error state for ${orderId}: ${error.message}`,
    );
  }
}

async function processReminderForOrder(
  order: ReminderCandidateRow,
  now: Date,
  dryRun: boolean,
): Promise<ProcessResult> {
  const initialDecision = decideReminderStage(order, now);

  if (!initialDecision.shouldSend) {
    return {
      orderId: order.id,
      orderNumber: order.order_id,
      recipient: order.receipt_email,
      status: "skipped",
      stage: null,
      reason: initialDecision.reason,
    };
  }

  if (order.net30_last_reminder_stage === initialDecision.stage) {
    return {
      orderId: order.id,
      orderNumber: order.order_id,
      recipient: order.receipt_email,
      status: "skipped",
      stage: initialDecision.stage,
      reason: "stage_already_sent",
    };
  }

  if (dryRun) {
    return {
      orderId: order.id,
      orderNumber: order.order_id,
      recipient: order.receipt_email,
      status: "sent",
      stage: initialDecision.stage,
      reason: "dry_run",
    };
  }

  const lockId = await claimReminderLock(order.id);

  if (!lockId) {
    return {
      orderId: order.id,
      orderNumber: order.order_id,
      recipient: order.receipt_email,
      status: "skipped",
      stage: initialDecision.stage,
      reason: "locked_by_another_process",
    };
  }

  try {
    const freshOrder = await loadOrderById(order.id);

    if (!freshOrder) {
      await releaseReminderLock(order.id, lockId);

      return {
        orderId: order.id,
        orderNumber: order.order_id,
        recipient: order.receipt_email,
        status: "skipped",
        stage: initialDecision.stage,
        reason: "order_missing_after_lock",
      };
    }

    const freshDecision = decideReminderStage(freshOrder, now);

    if (!freshDecision.shouldSend) {
      await releaseReminderLock(order.id, lockId);

      return {
        orderId: freshOrder.id,
        orderNumber: freshOrder.order_id,
        recipient: freshOrder.receipt_email,
        status: "skipped",
        stage: null,
        reason: freshDecision.reason,
      };
    }

    if (freshOrder.net30_last_reminder_stage === freshDecision.stage) {
      await releaseReminderLock(order.id, lockId);

      return {
        orderId: freshOrder.id,
        orderNumber: freshOrder.order_id,
        recipient: freshOrder.receipt_email,
        status: "skipped",
        stage: freshDecision.stage,
        reason: "stage_already_sent",
      };
    }

    if (freshDecision.stage === "overdue") {
      await markOrderOverdueIfNeeded(
        freshOrder.id,
        freshOrder.payment_status,
        lockId,
      );
    }

    await sendNet30ReminderEmail({
      to: freshOrder.receipt_email!.trim(),
      orderId: freshOrder.id,
      orderNumber: freshOrder.order_id,
      facilityName: getRelatedName(freshOrder.facilities),
      productName: getRelatedName(freshOrder.products),
      amountRemaining:
        getEffectiveAmountRemaining(freshOrder) ??
        freshOrder.invoice_amount_due ??
        null,
      currency: DEFAULT_CURRENCY,
      dueDate: freshOrder.invoice_due_date,
      hostedInvoiceUrl: freshOrder.stripe_invoice_hosted_url,
      invoiceNumber: freshOrder.stripe_invoice_number,
      reminderStage: freshDecision.stage,
      overdueDays: freshDecision.overdueDays,
    });

    await markReminderSent(freshOrder, freshDecision.stage, lockId);

    return {
      orderId: freshOrder.id,
      orderNumber: freshOrder.order_id,
      recipient: freshOrder.receipt_email,
      status: "sent",
      stage: freshDecision.stage,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown reminder send error";

    try {
      await markReminderFailed(order.id, lockId, message);
    } catch (persistError) {
      console.error(
        "[net30 reminders] Failed to persist reminder failure:",
        persistError,
      );
    }

    return {
      orderId: order.id,
      orderNumber: order.order_id,
      recipient: order.receipt_email,
      status: "failed",
      stage: initialDecision.stage,
      error: message,
    };
  }
}

async function handleReminderCron(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "1";

  try {
    const now = new Date();
    const candidates = await loadReminderCandidates();

    const results: ProcessResult[] = [];

    for (const order of candidates) {
      const result = await processReminderForOrder(order, now, dryRun);
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
      summary: {
        candidateCount: candidates.length,
        sent,
        skipped,
        failed,
      },
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Net 30 reminder cron failed.";

    console.error("[net30 reminders] fatal error:", message);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return handleReminderCron(request);
}

export async function POST(request: Request) {
  return handleReminderCron(request);
}
