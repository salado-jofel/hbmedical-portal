"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";

export interface ITopAccount {
  id: string;
  name: string;
  city: string;
  state: string;
  deliveredRevenue: number;
}

export async function getTopAccountsByRep(
  repId: string,
  limit = 5,
): Promise<ITopAccount[]> {
  const supabase = await createClient();
  await getCurrentUserOrThrow(supabase);
  const adminClient = createAdminClient();

  const { data: facs } = await adminClient
    .from("facilities")
    .select("id, name, city, state")
    .eq("assigned_rep", repId)
    .eq("facility_type", "clinic");
  const facilities = facs ?? [];
  if (facilities.length === 0) return [];
  const facilityIds = facilities.map((f: any) => f.id as string);

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await adminClient
    .from("orders")
    .select("id, facility_id")
    .in("facility_id", facilityIds)
    .eq("delivery_status", "delivered")
    .gte("delivered_at", cutoff);

  const orderRows = orders ?? [];
  if (orderRows.length === 0) return [];
  const orderIds = orderRows.map((o: any) => o.id as string);

  const { data: items } = await adminClient
    .from("order_items")
    .select("order_id, total_amount")
    .in("order_id", orderIds);
  const itemTotalByOrder: Record<string, number> = {};
  for (const i of items ?? []) {
    itemTotalByOrder[i.order_id] =
      (itemTotalByOrder[i.order_id] ?? 0) + Number(i.total_amount ?? 0);
  }

  const revenueByFacility: Record<string, number> = {};
  for (const o of orderRows) {
    const fid = o.facility_id as string;
    revenueByFacility[fid] =
      (revenueByFacility[fid] ?? 0) + (itemTotalByOrder[o.id as string] ?? 0);
  }

  return facilities
    .map((f: any) => ({
      id: f.id as string,
      name: f.name as string,
      city: (f.city ?? "") as string,
      state: (f.state ?? "") as string,
      deliveredRevenue: revenueByFacility[f.id] ?? 0,
    }))
    .filter((a) => a.deliveredRevenue > 0)
    .sort((a, b) => b.deliveredRevenue - a.deliveredRevenue)
    .slice(0, limit);
}
