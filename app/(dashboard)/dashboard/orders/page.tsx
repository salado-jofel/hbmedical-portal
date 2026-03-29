import Providers from "./(sections)/Providers";
import { OrdersPageClient } from "./(sections)/OrdersPageClient";
import { getAllOrders } from "./(services)/actions";

export default async function OrdersPage() {
  const orders = await getAllOrders();

  return (
    <div className="p-4 md:p-8 mx-auto space-y-6">
      <Providers orders={orders}>
        <OrdersPageClient />
      </Providers>
    </div>
  );
}
