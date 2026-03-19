export const dynamic = "force-dynamic";

import { getAllOrders } from "./(services)/actions";
import Providers from "./(sections)/Providers";
import Header from "./(sections)/Header";
import KanbanBoard from "./(sections)/KanBoard";

export default async function OrdersPage() {
  const orders = await getAllOrders();

  return (
    <Providers orders={orders}>
      <div className="p-4 md:p-8 w-full mx-auto space-y-6 select-none h-full overflow-y-auto">
        <Header />
        <KanbanBoard />
      </div>
    </Providers>
  );
}
