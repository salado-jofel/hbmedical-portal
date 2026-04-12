"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";

export async function getMySubReps() {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  const { data: hierarchy } = await adminClient
    .from("rep_hierarchy")
    .select("child_rep_id")
    .eq("parent_rep_id", user.id);

  if (!hierarchy || hierarchy.length === 0) return [];

  const childIds = hierarchy.map((h) => h.child_rep_id);

  const { data: subReps } = await adminClient
    .from("profiles")
    .select("id, first_name, last_name, email, phone, status, role")
    .in("id", childIds)
    .order("first_name");

  if (!subReps) return [];

  const enriched = await Promise.all(
    subReps.map(async (rep) => {
      const { count: accountCount } = await adminClient
        .from("facilities")
        .select("id", { count: "exact", head: true })
        .eq("assigned_rep", rep.id)
        .neq("facility_type", "rep_office");

      const { data: repFacilities } = await adminClient
        .from("facilities")
        .select("id")
        .eq("assigned_rep", rep.id);

      const facilityIds = (repFacilities || []).map((f) => f.id);

      let orderCount = 0;
      let revenue = 0;

      if (facilityIds.length > 0) {
        const { data: orders } = await adminClient
          .from("orders")
          .select("id, order_items(total_amount)")
          .in("facility_id", facilityIds)
          .neq("order_status", "canceled");

        orderCount = orders?.length || 0;
        revenue = (orders || []).reduce((sum, o) => {
          const itemTotal = (
            o.order_items as { total_amount: string | number }[]
          ).reduce((s, i) => s + (Number(i.total_amount) || 0), 0);
          return sum + itemTotal;
        }, 0);
      }

      const { data: rate } = await adminClient
        .from("commission_rates")
        .select("rate_percent, override_percent")
        .eq("rep_id", rep.id)
        .is("effective_to", null)
        .maybeSingle();

      return {
        ...rep,
        accountCount: accountCount || 0,
        orderCount,
        revenue,
        commissionRate: rate?.rate_percent || 0,
        overridePercent: rate?.override_percent || 0,
      };
    }),
  );

  return enriched;
}
