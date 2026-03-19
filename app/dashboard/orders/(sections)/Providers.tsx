"use client";

import type { Order } from "@/app/(interfaces)/order";
import { useAppDispatch } from "@/store/hooks";
import { type ReactNode, useEffect } from "react";
import { setOrders } from "../(redux)/orders-slice";

export default function Providers({
  children,
  orders,
}: {
  children: ReactNode;
  orders: Order[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setOrders(orders));
  }, [dispatch, orders]);

  return <>{children}</>;
}
