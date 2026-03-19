import type { Order } from "@/app/(interfaces)/order";

export interface OrdersState {
  items: Order[];
}

export const initialState: OrdersState = {
  items: [],
};
