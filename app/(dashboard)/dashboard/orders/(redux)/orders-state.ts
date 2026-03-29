import type { DashboardOrder } from "@/utils/interfaces/orders";

export interface OrdersState {
  items: DashboardOrder[];
}

export const initialState: OrdersState = {
  items: [],
};
