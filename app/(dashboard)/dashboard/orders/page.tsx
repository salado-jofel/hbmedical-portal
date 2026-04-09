import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, getCurrentUserOrThrow } from "@/lib/supabase/auth";

export const metadata: Metadata = { title: "Orders" };
import {
  isAdmin,
  isClinicalProvider,
  isClinicalStaff,
  isSalesRep,
  isSupport,
  isClinicSide,
  isDistributionSide,
} from "@/utils/helpers/role";
import Providers from "./(sections)/Providers";
import { OrdersKanban } from "./(sections)/OrdersKanban";
import { getOrders } from "./(services)/order-read-actions";
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);

  // Only roles that should see orders
  if (!isClinicSide(role) && !isDistributionSide(role)) {
    redirect("/dashboard");
  }

  const user = await getCurrentUserOrThrow(supabase);

  // Get profile name for sign modal
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const orders = await getOrders();

  const canCreate = isClinicalProvider(role) || isClinicalStaff(role);
  const canSign = isClinicalProvider(role);
  const adminUser = isAdmin(role);
  const repUser = isSalesRep(role);
  const supportUser = isSupport(role);

  return (
    <Providers orders={orders}>
      <OrdersKanban
        canCreate={canCreate}
        canSign={canSign}
        isAdmin={adminUser}
        isRep={repUser}
        isSupport={supportUser}
        currentUserId={user.id}
        currentUserName={(profile as { full_name?: string } | null)?.full_name ?? undefined}
      />
    </Providers>
  );
}
