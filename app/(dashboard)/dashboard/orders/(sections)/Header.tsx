import { DashboardHeader } from "@/app/(components)/DashboardHeader";
import { CreateOrderModal } from "../(components)/CreateOrderModal";

export default function Header() {
  return (
    <DashboardHeader
      title="Orders"
      description="Track and manage your orders"
      actions={<CreateOrderModal />}
    />
  );
}
