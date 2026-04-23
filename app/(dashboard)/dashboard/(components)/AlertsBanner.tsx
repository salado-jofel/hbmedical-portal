"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertBanner } from "@/app/(components)/AlertBanner";
import type { DashboardOrder } from "@/utils/interfaces/orders";

const MS_48H = 48 * 60 * 60 * 1000;

export function AlertsBanner({
  orders,
  users,
}: {
  orders: DashboardOrder[];
  users: Array<{ status: string }>;
}) {
  const router = useRouter();

  const alerts = useMemo(() => {
    const now = Date.now();
    const list: { variant: "red" | "warn" | "green"; message: string; actionLabel?: string; href?: string }[] = [];

    // (a) Orders stuck in manufacturer_review > 48h
    const stuckInReview = orders.filter(
      (o) =>
        o.order_status === "manufacturer_review" &&
        now - new Date(o.placed_at).getTime() > MS_48H,
    );
    if (stuckInReview.length > 0) {
      list.push({
        variant: "red",
        message: `${stuckInReview.length} order${stuckInReview.length > 1 ? "s" : ""} under review for over 48 hours.`,
        actionLabel: "View Orders",
        href: "/dashboard/orders",
      });
    }

    // (b) Approved orders with payment still pending
    const pendingPayment = orders.filter(
      (o) => o.order_status === "approved" && o.payment_status === "pending",
    );
    if (pendingPayment.length > 0) {
      list.push({
        variant: "warn",
        message: `${pendingPayment.length} approved order${pendingPayment.length > 1 ? "s" : ""} awaiting payment.`,
        actionLabel: "View Orders",
        href: "/dashboard/orders",
      });
    }

    // (c) Users with pending status
    const pendingUsers = users.filter((u) => u.status === "pending");
    if (pendingUsers.length > 0) {
      list.push({
        variant: "warn",
        message: `${pendingUsers.length} user${pendingUsers.length > 1 ? "s" : ""} pending setup or approval.`,
        actionLabel: "View Users",
        href: "/dashboard/users",
      });
    }

    // (d) All clear
    if (list.length === 0) {
      list.push({ variant: "green", message: "All clear — no items need attention." });
    }

    return list;
  }, [orders, users]);

  return (
    <div className="flex flex-col gap-2">
      {alerts.map((alert, i) => (
        <AlertBanner
          key={i}
          variant={alert.variant}
          message={alert.message}
          actionLabel={alert.actionLabel}
          onAction={alert.href ? () => router.push(alert.href!) : undefined}
        />
      ))}
    </div>
  );
}
