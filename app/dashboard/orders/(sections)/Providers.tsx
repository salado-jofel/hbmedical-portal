"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { useAppDispatch } from "@/store/hooks";
import { setOrders } from "../(redux)/orders-slice";

export default function Providers({
  children,
  orders,
}: {
  children: ReactNode;
  orders: DashboardOrder[];
}) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setOrders(orders));
  }, [dispatch, orders]);

  return <>{children}</>;
}
