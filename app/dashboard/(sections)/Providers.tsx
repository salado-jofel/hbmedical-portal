"use client";

import { ReactNode, useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { setFacilities } from "@/app/dashboard/facilities/(redux)/facilities-slice";
import { setOrders } from "@/app/dashboard/orders/(redux)/orders-slice";
import type { Facility } from "@/app/(interfaces)/facility";
import type { Order } from "@/app/(interfaces)/order";
import { UserData } from "../(services)/actions";
import { setUser } from "../(redux)/dashboard-slice";

interface DashboardProvidersProps {
  children: ReactNode;
  facilities: Facility[];
  orders: Order[];
  userData: UserData | null;
}

export default function Providers({
  children,
  facilities,
  orders,
  userData,
}: DashboardProvidersProps) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(setFacilities(facilities));
    dispatch(setOrders(orders));
    if (userData) {
      dispatch(setUser(userData));
    }
  }, [dispatch, facilities, orders, userData]);

  return <>{children}</>;
}
