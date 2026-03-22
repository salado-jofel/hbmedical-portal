export const dynamic = "force-dynamic";

import { getAllOrders } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import Header from "./(sections)/Header";
import { Metadata } from "next";
import { KanbanBoard } from "./(sections)/KanbanBoard";
import PaymentToastHandler from "./(sections)/PaymentToastHandler";

export const metadata: Metadata = {
  title: "Orders",
};

export default async function OrdersPage() {
  const orders = await getAllOrders();

  return (
    <Providers orders={orders}>
      <PaymentToastHandler />
      <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none h-full overflow-y-auto">
        <Header />
        <KanbanBoard orders={orders} />
      </div>
    </Providers>
  );
}
