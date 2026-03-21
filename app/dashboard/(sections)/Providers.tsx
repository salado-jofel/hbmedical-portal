"use client";

import { ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setOrders } from "@/app/dashboard/orders/(redux)/orders-slice";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Order } from "@/app/(interfaces)/order";
import { UserData } from "../(services)/actions";
import { setUser } from "../(redux)/dashboard-slice";

interface DashboardProvidersProps {
  children: ReactNode;
  orders: Order[];
  userData: UserData | null;
}

export default function Providers({
  children,
  orders,
  userData,
}: DashboardProvidersProps) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setOrders(orders));
    if (userData) {
      dispatch(setUser(userData));
    }
  }, [dispatch, orders, userData]);

  return <>{children}</>;
}
