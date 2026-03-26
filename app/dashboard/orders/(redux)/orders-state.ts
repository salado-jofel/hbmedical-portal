import type { DashboardOrder } from "@/lib/interfaces/orders";

export interface OrdersState {
  items: DashboardOrder[];
}

export const initialState: OrdersState = {
  items: [],
};
