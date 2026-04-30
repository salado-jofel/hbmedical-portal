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

  // Get provider's display name for the Sign modal. `full_name` doesn't
  // exist on profiles — use first + last and compose.
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  const currentUserName = profile
    ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || undefined
    : undefined;

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
        currentUserName={currentUserName}
      />
    </Providers>
  );
}
