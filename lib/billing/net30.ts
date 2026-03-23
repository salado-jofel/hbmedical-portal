"use server";

import { createAdminClient } from "@/utils/supabase/admin";

export const NET30_CREDIT_LIMIT_USD = 50000;

type Net30OrderRow = {
  id: string;
  user_id: string | null;
  order_id: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  stripe_invoice_status: string | null;
  stripe_invoice_number: string | null;
  stripe_invoice_hosted_url: string | null;
  invoice_due_date: string | null;
  invoice_amount_due: number | null;
  invoice_amount_remaining: number | null;
  invoice_overdue_at: string | null;
  net30_last_reminder_stage: string | null;
  net30_last_reminder_sent_at: string | null;
  net30_reminder_count: number | null;
};

export type Net30CreditStatus = {
  blocked: boolean;
  reason: string | null;
  outstandingBalance: number;
  overdueBalance: number;
  activeInvoiceCount: number;
  overdueInvoiceCount: number;
  creditLimit: number;
};

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function diffUtcDays(targetDateIso: string, now = new Date()): number {
  const target = startOfUtcDay(new Date(targetDateIso));
  const today = startOfUtcDay(now);

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function isOpenUnpaidNet30(row: Net30OrderRow): boolean {
  return (
    row.payment_mode === "net_30" &&
    row.payment_status !== "paid" &&
    row.stripe_invoice_status !== "paid" &&
    row.stripe_invoice_status !== "void"
  );
}

function isOverdue(row: Net30OrderRow, now = new Date()): boolean {
  if (!row.invoice_due_date) return false;
  if (!isOpenUnpaidNet30(row)) return false;
  if (toNumber(row.invoice_amount_remaining) <= 0) return false;

  return diffUtcDays(row.invoice_due_date, now) < 0;
}

export async function getNet30CreditStatusByUserId(
  userId: string,
): Promise<Net30CreditStatus> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        user_id,
        payment_mode,
        payment_status,
        stripe_invoice_status,
        invoice_due_date,
        invoice_amount_remaining
      `,
    )
    .eq("user_id", userId)
    .eq("payment_mode", "net_30");

  if (error) {
    throw new Error(`Failed to load Net 30 credit status: ${error.message}`);
  }

  const rows = (data ?? []) as Net30OrderRow[];

  let outstandingBalance = 0;
  let overdueBalance = 0;
  let activeInvoiceCount = 0;
  let overdueInvoiceCount = 0;

  for (const row of rows) {
    if (!isOpenUnpaidNet30(row)) continue;

    const remaining = toNumber(row.invoice_amount_remaining);

    if (remaining <= 0) continue;

    outstandingBalance += remaining;
    activeInvoiceCount += 1;

    if (isOverdue(row)) {
      overdueBalance += remaining;
      overdueInvoiceCount += 1;
    }
  }

  const blocked =
    outstandingBalance > NET30_CREDIT_LIMIT_USD || overdueBalance > 0;

  let reason: string | null = null;

  if (overdueBalance > 0) {
    reason =
      "Your account has overdue Net 30 balances. Please settle overdue invoices before placing another order.";
  } else if (outstandingBalance > NET30_CREDIT_LIMIT_USD) {
    reason =
      "Your account has exceeded the $50,000 Net 30 credit limit. Please settle outstanding invoices before placing another order.";
  }

  return {
    blocked,
    reason,
    outstandingBalance,
    overdueBalance,
    activeInvoiceCount,
    overdueInvoiceCount,
    creditLimit: NET30_CREDIT_LIMIT_USD,
  };
}

export async function assertOrderingAllowedByUserId(userId: string) {
  const status = await getNet30CreditStatusByUserId(userId);

  if (status.blocked) {
    throw new Error(
      status.reason ??
        "Ordering is temporarily disabled due to outstanding Net 30 balances.",
    );
  }

  return status;
}

export async function processNet30DailyMonitor() {
  const supabase = createAdminClient();
  const now = new Date();

  const { data, error } = await supabase
    .from("orders")
    .select(
      `
        id,
        user_id,
        order_id,
        payment_mode,
        payment_status,
        stripe_invoice_status,
        stripe_invoice_number,
        stripe_invoice_hosted_url,
        invoice_due_date,
        invoice_amount_due,
        invoice_amount_remaining,
        invoice_overdue_at,
        net30_last_reminder_stage,
        net30_last_reminder_sent_at,
        net30_reminder_count
      `,
    )
    .eq("payment_mode", "net_30")
    .neq("payment_status", "paid");

  if (error) {
    throw new Error(`Failed to load Net 30 orders: ${error.message}`);
  }

  const rows = (data ?? []) as Net30OrderRow[];

  let processed = 0;
  let remindersSent = 0;
  let markedOverdue = 0;
  const errors: string[] = [];

  for (const row of rows) {
    processed += 1;

    try {
      const updates: Record<string, unknown> = {};
      const overdue = isOverdue(row, now);

      if (overdue) {
        if (row.payment_status !== "overdue") {
          updates.payment_status = "overdue";
        }

        if (!row.invoice_overdue_at) {
          updates.invoice_overdue_at = now.toISOString();
        }

        if (row.payment_status !== "overdue" || !row.invoice_overdue_at) {
          markedOverdue += 1;
        }
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from("orders")
          .update(updates)
          .eq("id", row.id);

        if (updateError) {
          throw new Error(updateError.message);
        }
      }
    } catch (rowError) {
      errors.push(
        `${row.id}: ${
          rowError instanceof Error ? rowError.message : "Unknown error"
        }`,
      );
    }
  }

  return {
    processed,
    remindersSent,
    markedOverdue,
    errors,
  };
}
