"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrThrow, getCurrentUserOrThrow, getUserRole } from "@/lib/supabase/auth";
import { isAdmin, isSalesRep } from "@/utils/helpers/role";
import { setCommissionRateSchema } from "@/utils/validators/commissions";
import { COMMISSION_RATES_TABLE, COMMISSION_TABLE, PAYOUTS_TABLE, COMMISSIONS_PATH } from "@/utils/constants/commissions";
import type {
  ICommissionRate,
  ICommission,
  IPayout,
  ICommissionRateFormState,
  ICommissionSummary,
} from "@/utils/interfaces/commissions";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function profileName(p: { first_name: string; last_name: string } | null): string {
  if (!p) return "Unknown";
  return `${p.first_name} ${p.last_name}`.trim();
}

/* -------------------------------------------------------------------------- */
/* 1. getCommissionRates                                                      */
/* -------------------------------------------------------------------------- */

export async function getCommissionRates(): Promise<ICommissionRate[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const adminClient = createAdminClient();

  let query = adminClient
    .from(COMMISSION_RATES_TABLE)
    .select(`
      id, rep_id, set_by, rate_percent, override_percent,
      effective_from, effective_to, created_at,
      rep:profiles!commission_rates_rep_id_fkey(first_name, last_name, role),
      setter:profiles!commission_rates_set_by_fkey(first_name, last_name)
    `)
    .is("effective_to", null);

  if (!isAdmin(role)) {
    // Sales rep sees rates they set OR rates set for them
    query = query.or(`set_by.eq.${user.id},rep_id.eq.${user.id}`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[getCommissionRates] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch commission rates.");
  }

  return (data ?? []).map((r: any) => ({
    id:              r.id,
    repId:           r.rep_id,
    repName:         profileName(r.rep),
    setBy:           r.set_by,
    setByName:       profileName(r.setter),
    ratePercent:     Number(r.rate_percent),
    overridePercent: Number(r.override_percent),
    effectiveFrom:   r.effective_from,
    effectiveTo:     r.effective_to,
    createdAt:       r.created_at,
  })).sort((a, b) => a.repName.localeCompare(b.repName));
}

/* -------------------------------------------------------------------------- */
/* 2. setCommissionRate                                                       */
/* -------------------------------------------------------------------------- */

export async function setCommissionRate(
  _prev: ICommissionRateFormState | null,
  formData: FormData,
): Promise<ICommissionRateFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);
    const role = await getUserRole(supabase);

    if (!isAdmin(role) && !isSalesRep(role)) {
      return { success: false, error: "Unauthorized." };
    }

    const raw = {
      rep_id:           formData.get("rep_id") as string,
      rate_percent:     formData.get("rate_percent") as string,
      override_percent: formData.get("override_percent") as string,
    };

    const parsed = setCommissionRateSchema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors: ICommissionRateFormState["fieldErrors"] = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof NonNullable<ICommissionRateFormState["fieldErrors"]>;
        fieldErrors[field] = issue.message;
      }
      return { success: false, error: null, fieldErrors };
    }

    const { rep_id, rate_percent, override_percent } = parsed.data;
    const adminClient = createAdminClient();

    // If rep (not admin): verify target is a direct sub-rep
    if (!isAdmin(role)) {
      const { data: hierarchy, error: hErr } = await adminClient
        .from("rep_hierarchy")
        .select("id")
        .eq("parent_rep_id", user.id)
        .eq("child_rep_id", rep_id)
        .maybeSingle();

      if (hErr) {
        console.error("[setCommissionRate] Hierarchy check error:", JSON.stringify(hErr));
        return { success: false, error: "Failed to verify rep relationship." };
      }
      if (!hierarchy) {
        return { success: false, error: "You can only set rates for your own sub-reps." };
      }
    }

    const today = todayISO();

    // Insert new rate first — if this fails, old rate remains active (safe).
    // Closing old rate after ensures there is never a gap with no active rate.
    const { data: insertedRate, error: insertError } = await adminClient
      .from(COMMISSION_RATES_TABLE)
      .insert({
        rep_id,
        set_by:           user.id,
        rate_percent,
        override_percent,
        effective_from:   today,
        effective_to:     null,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[setCommissionRate] Insert error:", JSON.stringify(insertError));
      return { success: false, error: insertError.message ?? "Failed to set commission rate." };
    }

    // Close all previous active rates for this rep, excluding the one just inserted
    const { error: closeError } = await adminClient
      .from(COMMISSION_RATES_TABLE)
      .update({ effective_to: today })
      .eq("rep_id", rep_id)
      .is("effective_to", null)
      .neq("id", insertedRate.id);

    if (closeError) {
      console.error("[setCommissionRate] Close old rate error:", JSON.stringify(closeError));
      // Non-fatal: new rate is already active. Old rate will be shadowed by effective_from ordering.
    }

    revalidatePath(COMMISSIONS_PATH);
    return { success: true, error: null };
  } catch (err) {
    console.error("[setCommissionRate] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* 3. getCommissions                                                          */
/* -------------------------------------------------------------------------- */

export async function getCommissions(period?: string): Promise<ICommission[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const adminClient = createAdminClient();

  let query = adminClient
    .from(COMMISSION_TABLE)
    .select(`
      id, order_id, rep_id, type, order_amount, rate_percent,
      commission_amount, adjustment, final_amount, status,
      payout_period, paid_at, notes, created_at,
      order:orders!commissions_order_id_fkey(order_number),
      rep:profiles!commissions_rep_id_fkey(first_name, last_name)
    `);

  if (!isAdmin(role)) {
    query = query.eq("rep_id", user.id);
  }

  if (period) {
    query = query.eq("payout_period", period);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    console.error("[getCommissions] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch commissions.");
  }

  return (data ?? []).map((c: any) => ({
    id:               c.id,
    orderId:          c.order_id,
    orderNumber:      c.order?.order_number ?? "—",
    repId:            c.rep_id,
    repName:          profileName(c.rep),
    type:             c.type,
    orderAmount:      Number(c.order_amount),
    ratePercent:      Number(c.rate_percent),
    commissionAmount: Number(c.commission_amount),
    adjustment:       Number(c.adjustment ?? 0),
    finalAmount:      c.final_amount != null ? Number(c.final_amount) : null,
    status:           c.status,
    payoutPeriod:     c.payout_period,
    paidAt:           c.paid_at,
    notes:            c.notes,
    createdAt:        c.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* 4. calculateOrderCommission                                                */
/* -------------------------------------------------------------------------- */

export async function calculateOrderCommission(orderId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const adminClient = createAdminClient();

    // Fetch order with facility → assigned sales rep (NOT user_id which is the clinic owner)
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_number, order_status, facilities!orders_facility_id_fkey(assigned_rep)")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("[calculateOrderCommission] Order fetch error:", JSON.stringify(orderError));
      return { success: false, error: "Order not found." };
    }

    const facility = Array.isArray(order.facilities) ? order.facilities[0] : order.facilities;
    const repId: string | null = facility?.assigned_rep ?? null;
    if (!repId) return { success: false, error: "No rep assigned to this order." };

    // Fetch order total from order_items
    const { data: items, error: itemsError } = await adminClient
      .from("order_items")
      .select("total_amount")
      .eq("order_id", orderId);

    if (itemsError) {
      console.error("[calculateOrderCommission] Items fetch error:", JSON.stringify(itemsError));
      return { success: false, error: "Failed to fetch order items." };
    }

    const orderAmount = (items ?? []).reduce((sum: number, i: any) => sum + Number(i.total_amount ?? 0), 0);

    if (orderAmount <= 0) {
      console.info("[calculateOrderCommission] Skipping — order amount is $0 for order:", orderId);
      return { success: true };
    }

    // Fetch active commission rate for rep
    const { data: rate, error: rateError } = await adminClient
      .from(COMMISSION_RATES_TABLE)
      .select("id, rate_percent, override_percent")
      .eq("rep_id", repId)
      .is("effective_to", null)
      .maybeSingle();

    if (rateError) {
      console.error("[calculateOrderCommission] Rate fetch error:", JSON.stringify(rateError));
      return { success: false, error: "Failed to fetch commission rate." };
    }
    if (!rate) return { success: false, error: "No active commission rate for this rep." };

    const ratePercent = Number(rate.rate_percent);
    const commissionAmount = (orderAmount * ratePercent) / 100;
    const period = currentPeriod();

    // Idempotency: skip if direct commission already exists for this order + rep
    const { data: existingDirect } = await adminClient
      .from(COMMISSION_TABLE)
      .select("id")
      .eq("order_id", orderId)
      .eq("rep_id", repId)
      .eq("type", "direct")
      .maybeSingle();

    if (existingDirect) {
      console.info("[calculateOrderCommission] Direct commission already exists for order:", orderId, "— skipping.");
      return { success: true };
    }

    // Insert direct commission
    const { error: insertError } = await adminClient
      .from(COMMISSION_TABLE)
      .insert({
        order_id:          orderId,
        rep_id:            repId,
        type:              "direct",
        order_amount:      orderAmount,
        rate_percent:      ratePercent,
        commission_amount: commissionAmount,
        adjustment:        0,
        status:            "pending",
        payout_period:     period,
      });

    if (insertError) {
      console.error("[calculateOrderCommission] Insert error:", JSON.stringify(insertError));
      return { success: false, error: "Failed to insert commission record." };
    }

    // Check for parent rep (override commission)
    const { data: hierarchy } = await adminClient
      .from("rep_hierarchy")
      .select("parent_rep_id")
      .eq("child_rep_id", repId)
      .maybeSingle();

    if (hierarchy?.parent_rep_id) {
      const parentRepId = hierarchy.parent_rep_id;

      // Fetch override_percent from parent's rate (rate set by parent for this child rep)
      const { data: parentRate } = await adminClient
        .from(COMMISSION_RATES_TABLE)
        .select("override_percent")
        .eq("rep_id", repId)
        .eq("set_by", parentRepId)
        .is("effective_to", null)
        .maybeSingle();

      if (parentRate) {
        const overridePct = Number(parentRate.override_percent);
        const overrideAmount = (orderAmount * overridePct) / 100;

        // Skip $0 override commissions
        if (overrideAmount <= 0) {
          console.info("[calculateOrderCommission] Skipping $0 override for parent:", parentRepId);
        } else {
          // Idempotency: skip if override already exists
          const { data: existingOverride } = await adminClient
            .from(COMMISSION_TABLE)
            .select("id")
            .eq("order_id", orderId)
            .eq("rep_id", parentRepId)
            .eq("type", "override")
            .maybeSingle();

          if (!existingOverride) {
            const { error: overrideError } = await adminClient
              .from(COMMISSION_TABLE)
              .insert({
                order_id:          orderId,
                rep_id:            parentRepId,
                type:              "override",
                order_amount:      orderAmount,
                rate_percent:      overridePct,
                commission_amount: overrideAmount,
                adjustment:        0,
                status:            "pending",
                payout_period:     period,
              });

            if (overrideError) {
              console.error("[calculateOrderCommission] Override insert error:", JSON.stringify(overrideError));
              // Non-fatal: direct commission already created
            }
          }
        }
      }
    }

    revalidatePath(COMMISSIONS_PATH);
    return { success: true };
  } catch (err) {
    console.error("[calculateOrderCommission] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* 5. adjustCommission                                                        */
/* -------------------------------------------------------------------------- */

export async function adjustCommission(
  commissionId: string,
  adjustment: number,
  notes: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);

    if (!isFinite(adjustment)) return { success: false, error: "Invalid adjustment value." };
    if (Math.abs(adjustment) > 1_000_000) return { success: false, error: "Adjustment exceeds maximum allowed value." };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from(COMMISSION_TABLE)
      .update({ adjustment, notes })
      .eq("id", commissionId);

    if (error) {
      console.error("[adjustCommission] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to adjust commission." };
    }

    revalidatePath(COMMISSIONS_PATH);
    return { success: true };
  } catch (err) {
    console.error("[adjustCommission] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* 6. approveCommissions                                                      */
/* -------------------------------------------------------------------------- */

export async function approveCommissions(
  commissionIds: string[],
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);

    if (commissionIds.length === 0) return { success: true };

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from(COMMISSION_TABLE)
      .update({ status: "approved" })
      .in("id", commissionIds)
      .eq("status", "pending");

    if (error) {
      console.error("[approveCommissions] Error:", JSON.stringify(error));
      return { success: false, error: error.message ?? "Failed to approve commissions." };
    }

    revalidatePath(COMMISSIONS_PATH);
    return { success: true };
  } catch (err) {
    console.error("[approveCommissions] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* 7. getPayouts                                                              */
/* -------------------------------------------------------------------------- */

export async function getPayouts(period?: string): Promise<IPayout[]> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const adminClient = createAdminClient();

  let query = adminClient
    .from(PAYOUTS_TABLE)
    .select(`
      id, rep_id, period, total_amount, status, paid_at, paid_by, notes, created_at,
      rep:profiles!payouts_rep_id_fkey(first_name, last_name)
    `);

  if (!isAdmin(role)) {
    query = query.eq("rep_id", user.id);
  }

  if (period) {
    query = query.eq("period", period);
  }

  const { data, error } = await query.order("period", { ascending: false });

  if (error) {
    console.error("[getPayouts] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch payouts.");
  }

  return (data ?? []).map((p: any) => ({
    id:          p.id,
    repId:       p.rep_id,
    repName:     profileName(p.rep),
    period:      p.period,
    totalAmount: Number(p.total_amount),
    status:      p.status,
    paidAt:      p.paid_at,
    paidBy:      p.paid_by,
    notes:       p.notes,
    createdAt:   p.created_at,
  }));
}

/* -------------------------------------------------------------------------- */
/* 8. generatePayout                                                          */
/* -------------------------------------------------------------------------- */

export async function generatePayout(
  repId: string,
  period: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);

    const adminClient = createAdminClient();

    // Sum all approved commissions for this rep + period
    const { data: commissions, error: sumError } = await adminClient
      .from(COMMISSION_TABLE)
      .select("final_amount, commission_amount, adjustment")
      .eq("rep_id", repId)
      .eq("payout_period", period)
      .eq("status", "approved");

    if (sumError) {
      console.error("[generatePayout] Sum error:", JSON.stringify(sumError));
      return { success: false, error: "Failed to sum approved commissions." };
    }

    const totalAmount = (commissions ?? []).reduce((sum: number, c: any) => {
      // final_amount is a generated column (commission_amount + adjustment); fall back if null
      return sum + (c.final_amount != null ? Number(c.final_amount) : Number(c.commission_amount) + Number(c.adjustment ?? 0));
    }, 0);

    if (totalAmount === 0) {
      return { success: false, error: "No approved commissions found for this rep and period." };
    }

    // Upsert payout (rep_id + period unique)
    const { error: upsertError } = await adminClient
      .from(PAYOUTS_TABLE)
      .upsert(
        { rep_id: repId, period, total_amount: totalAmount, status: "draft" },
        { onConflict: "rep_id,period" },
      );

    if (upsertError) {
      console.error("[generatePayout] Upsert error:", JSON.stringify(upsertError));
      return { success: false, error: upsertError.message ?? "Failed to generate payout." };
    }

    revalidatePath(COMMISSIONS_PATH);
    return { success: true };
  } catch (err) {
    console.error("[generatePayout] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* 9. markPayoutPaid                                                          */
/* -------------------------------------------------------------------------- */

export async function markPayoutPaid(
  payoutId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    await requireAdminOrThrow(supabase);
    const user = await getCurrentUserOrThrow(supabase);

    const adminClient = createAdminClient();
    const now = new Date().toISOString();

    // Fetch rep_id + period so we can update related commissions
    const { data: payout, error: fetchError } = await adminClient
      .from(PAYOUTS_TABLE)
      .select("rep_id, period")
      .eq("id", payoutId)
      .maybeSingle();

    if (fetchError || !payout) {
      console.error("[markPayoutPaid] Fetch error:", JSON.stringify(fetchError));
      return { success: false, error: "Payout not found." };
    }

    // Mark payout as paid
    const { error: payoutError } = await adminClient
      .from(PAYOUTS_TABLE)
      .update({ status: "paid", paid_at: now, paid_by: user.id })
      .eq("id", payoutId);

    if (payoutError) {
      console.error("[markPayoutPaid] Payout update error:", JSON.stringify(payoutError));
      return { success: false, error: payoutError.message ?? "Failed to mark payout as paid." };
    }

    // Mark all related commissions as paid (includes both approved and pending-in-draft payouts)
    const { error: commError } = await adminClient
      .from(COMMISSION_TABLE)
      .update({ status: "paid", paid_at: now })
      .eq("rep_id", payout.rep_id)
      .eq("payout_period", payout.period)
      .in("status", ["draft", "approved"]);

    if (commError) {
      console.error("[markPayoutPaid] Commission update error:", JSON.stringify(commError));
      // Non-fatal: payout already marked paid
    }

    revalidatePath(COMMISSIONS_PATH);
    return { success: true };
  } catch (err) {
    console.error("[markPayoutPaid] Unexpected error:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/* -------------------------------------------------------------------------- */
/* 10. getRepCommissionSummary                                                */
/* -------------------------------------------------------------------------- */

export async function getRepCommissionSummary(repId?: string): Promise<ICommissionSummary> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const role = await getUserRole(supabase);

  const adminMode = isAdmin(role);
  const adminClient = createAdminClient();

  // Admin with no repId → aggregate all commissions; with repId → filter to that rep.
  // Sales rep → always filter to own commissions only.
  let commQuery = adminClient
    .from(COMMISSION_TABLE)
    .select("status, final_amount, commission_amount, adjustment");

  if (adminMode) {
    if (repId) commQuery = commQuery.eq("rep_id", repId);
    // else: no filter — admin sees totals across all reps
  } else {
    commQuery = commQuery.eq("rep_id", user.id);
  }

  // Admin currentRate: most recent active rate they've set for any rep (set_by = admin).
  // Rep currentRate: their own active rate (rep_id = user.id).
  let rateData: { rate_percent: number } | null = null;
  let rateError: { message?: string } | null = null;

  if (adminMode) {
    const { data, error } = await adminClient
      .from(COMMISSION_RATES_TABLE)
      .select("rate_percent")
      .eq("set_by", user.id)
      .is("effective_to", null)
      .order("created_at", { ascending: false })
      .limit(1);
    rateData = data?.[0] ?? null;
    rateError = error;
  } else {
    const { data, error } = await adminClient
      .from(COMMISSION_RATES_TABLE)
      .select("rate_percent")
      .eq("rep_id", user.id)
      .is("effective_to", null)
      .maybeSingle();
    rateData = data;
    rateError = error;
  }

  const { data: commissions, error: commError } = await commQuery;

  console.info("[getRepCommissionSummary] adminMode:", adminMode, "| rows:", commissions?.length ?? 0, "| currentRate:", rateData?.rate_percent ?? null);

  if (commError) {
    console.error("[getRepCommissionSummary] Commissions error:", JSON.stringify(commError));
    throw new Error(commError.message ?? "Failed to fetch commission summary.");
  }
  if (rateError) {
    console.error("[getRepCommissionSummary] Rate error:", JSON.stringify(rateError));
    throw new Error(rateError.message ?? "Failed to fetch commission rate.");
  }

  const getAmount = (c: any) =>
    c.final_amount != null
      ? Number(c.final_amount)
      : Number(c.commission_amount) + Number(c.adjustment ?? 0);

  const rows = commissions ?? [];
  const totalEarned  = rows.reduce((s: number, c: any) => s + getAmount(c), 0);
  const totalPending = rows.filter((c: any) => c.status === "pending").reduce((s: number, c: any) => s + getAmount(c), 0);
  const totalPaid    = rows.filter((c: any) => c.status === "paid").reduce((s: number, c: any) => s + getAmount(c), 0);

  return {
    totalEarned,
    totalPending,
    totalPaid,
    currentRate: rateData ? Number(rateData.rate_percent) : null,
  };
}
