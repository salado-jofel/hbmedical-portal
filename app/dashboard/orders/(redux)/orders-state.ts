import type { Order } from "@/lib/interfaces/order";

export interface OrdersState {
  items: Order[];
}

export const initialState: OrdersState = {
  items: [],
};
