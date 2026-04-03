import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserRole, getCurrentUserOrThrow } from "@/lib/supabase/auth";
import { isClinicalProvider, isClinicalStaff } from "@/utils/helpers/role";
import Providers from "./(sections)/Providers";
import { OrdersPageClient } from "./(sections)/OrdersPageClient";
import { getAllOrders } from "./(services)/actions";

export default async function OrdersPage() {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isClinicalProvider(role) && !isClinicalStaff(role)) redirect("/dashboard/products");

  const user = await getCurrentUserOrThrow(supabase);
  const { data: memberRecord } = await supabase
    .from("facility_members")
    .select("can_sign_orders")
    .eq("user_id", user.id)
    .maybeSingle();
  const canSign = memberRecord?.can_sign_orders ?? false;

  const orders = await getAllOrders();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <Providers orders={orders}>
        <OrdersPageClient canSign={canSign} />
      </Providers>
    </div>
  );
}
