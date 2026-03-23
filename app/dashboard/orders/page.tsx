export const dynamic = "force-dynamic";

import { Metadata } from "next";
import { getAllOrders } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import Header from "./(sections)/Header";
import { KanbanBoard } from "./(sections)/KanbanBoard";
import PaymentToastHandler from "./(sections)/PaymentToastHandler";
import { getSupabaseClient } from "@/utils/supabase/db";
import { getNet30CreditStatusByUserId } from "@/lib/billing/net30";
import { Net30CreditBanner } from "@/app/(components)/Net30CreditBanner";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function OrdersPage() {
  const [orders, supabase] = await Promise.all([
    getAllOrders(),
    getSupabaseClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const creditStatus = user
    ? await getNet30CreditStatusByUserId(user.id)
    : {
      blocked: false,
      reason: null,
      outstandingBalance: 0,
      overdueBalance: 0,
      activeInvoiceCount: 0,
      overdueInvoiceCount: 0,
      creditLimit: 50000,
    };

  return (
    <Providers orders={orders}>
      <PaymentToastHandler />
      <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none h-full overflow-y-auto">
        <Header creditStatus={creditStatus} />
        <Net30CreditBanner status={creditStatus} />
        <KanbanBoard orders={orders} />
      </div>
    </Providers>
  );
}
