"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Order } from "@/lib/interfaces/order";
import { createClient } from "@/utils/supabase/client";
import { CreateOrderModal } from "./CreateOrderModal";
import { KanbanColumn } from "./KanbanColumn";
import { MobileKanbanTabs } from "./MobileKanbanTabs";
import {
    BOARD_STATUSES,
    mapOrderToBoardStatus,
    type BoardStatus,
} from "./kanban-config";

type DashboardOrder = Order & {
    created_by_email?: string | null;
    facility_name?: string | null;
    product_name?: string | null;

    payment_provider?: string | null;
    payment_mode?: "pay_now" | "net_30" | string | null;
    payment_status?: string | null;

    stripe_checkout_session_id?: string | null;
    stripe_payment_intent_id?: string | null;
    stripe_invoice_id?: string | null;
    stripe_checkout_url?: string | null;
    stripe_invoice_status?: string | null;
    stripe_invoice_hosted_url?: string | null;
    stripe_customer_id?: string | null;
    stripe_receipt_url?: string | null;

    paid_at?: string | null;
    invoice_due_date?: string | null;
    invoice_sent_at?: string | null;
    invoice_paid_at?: string | null;
    invoice_amount_due?: number | string | null;
    invoice_amount_remaining?: number | string | null;

    shipstation_sync_status?: string | null;
    shipstation_order_id?: string | null;
    shipstation_shipment_id?: string | null;
    shipstation_fulfillment_id?: string | null;
    shipstation_status?: string | null;
    shipstation_label_url?: string | null;

    tracking_number?: string | null;
    carrier_code?: string | null;
    shipped_at?: string | null;
    delivered_at?: string | null;
};

type OrdersPageClientProps = {
    initialOrders: DashboardOrder[];
};

function toNumber(value: unknown, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }

    return fallback;
}

function toNullableNumber(value: unknown) {
    if (value == null) return null;

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }

    return null;
}

function normalizeOrder(order: DashboardOrder): DashboardOrder {
    return {
        ...order,
        amount: toNumber(order.amount, 0),
        quantity: toNumber(order.quantity ?? 1, 1),
        invoice_amount_due: toNullableNumber(order.invoice_amount_due),
        invoice_amount_remaining: toNullableNumber(order.invoice_amount_remaining),
    };
}

function sortOrdersDesc(orders: DashboardOrder[]) {
    return [...orders].sort((a, b) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
    });
}

function mergeIncomingOrder(
    current: DashboardOrder | undefined,
    incoming: Partial<DashboardOrder> & { id?: string | null },
): DashboardOrder | null {
    const resolvedId = incoming.id ?? current?.id;

    if (!resolvedId) return null;

    const merged: DashboardOrder = normalizeOrder({
        ...(current ?? ({} as DashboardOrder)),
        ...incoming,
        id: resolvedId,
        facility_name: incoming.facility_name ?? current?.facility_name ?? "—",
        product_name: incoming.product_name ?? current?.product_name ?? "—",
        created_by_email:
            incoming.created_by_email ?? current?.created_by_email ?? null,
        order_id: (incoming.order_id ?? current?.order_id ?? "") as string,
        facility_id: (incoming.facility_id ?? current?.facility_id ?? "") as string,
        product_id: (incoming.product_id ?? current?.product_id ?? "") as string,
        status: (incoming.status ?? current?.status ?? "Processing") as Order["status"],
        amount: toNumber(incoming.amount ?? current?.amount ?? 0, 0),
        quantity: toNumber(incoming.quantity ?? current?.quantity ?? 1, 1),
    });

    return merged;
}

function groupOrdersByBoardStatus(
    orders: DashboardOrder[],
): Record<BoardStatus, DashboardOrder[]> {
    const grouped = BOARD_STATUSES.reduce(
        (acc, status) => {
            acc[status] = [];
            return acc;
        },
        {} as Record<BoardStatus, DashboardOrder[]>,
    );

    for (const order of orders) {
        const boardStatus = mapOrderToBoardStatus(order);
        grouped[boardStatus].push(order);
    }

    return grouped;
}

export function OrdersPageClient({ initialOrders }: OrdersPageClientProps) {
    const router = useRouter();

    const [orders, setOrders] = useState<DashboardOrder[]>(
        sortOrdersDesc((initialOrders ?? []).map(normalizeOrder)),
    );

    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scheduleRefresh = () => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
        }

        refreshTimerRef.current = setTimeout(() => {
            router.refresh();
        }, 1200);
    };

    useEffect(() => {
        setOrders(sortOrdersDesc((initialOrders ?? []).map(normalizeOrder)));
    }, [initialOrders]);

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel("orders-live-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                },
                (
                    payload: RealtimePostgresChangesPayload<{
                        [key: string]: unknown;
                    }>,
                ) => {
                    const eventType = payload.eventType;

                    if (eventType === "DELETE") {
                        const deletedId = String(
                            (payload.old as { id?: string } | null)?.id ?? "",
                        );

                        if (!deletedId) {
                            scheduleRefresh();
                            return;
                        }

                        setOrders((prev) => prev.filter((order) => order.id !== deletedId));
                        scheduleRefresh();
                        return;
                    }

                    const incoming = payload.new as Partial<DashboardOrder> & {
                        id?: string | null;
                    };

                    if (!incoming?.id) {
                        scheduleRefresh();
                        return;
                    }

                    if (eventType === "INSERT") {
                        setOrders((prev) => {
                            const existing = prev.find((order) => order.id === incoming.id);
                            const merged = mergeIncomingOrder(existing, incoming);

                            if (!merged) return prev;

                            const next = existing
                                ? prev.map((order) => (order.id === merged.id ? merged : order))
                                : [merged, ...prev];

                            return sortOrdersDesc(next);
                        });

                        scheduleRefresh();
                        return;
                    }

                    if (eventType === "UPDATE") {
                        setOrders((prev) => {
                            const existing = prev.find((order) => order.id === incoming.id);
                            const merged = mergeIncomingOrder(existing, incoming);

                            if (!merged) return prev;

                            const next = existing
                                ? prev.map((order) => (order.id === merged.id ? merged : order))
                                : [merged, ...prev];

                            return sortOrdersDesc(next);
                        });
                    }
                },
            )
            .subscribe();

        const handleFocusRefresh = () => {
            router.refresh();
        };

        const handleVisibilityRefresh = () => {
            if (!document.hidden) {
                router.refresh();
            }
        };

        window.addEventListener("focus", handleFocusRefresh);
        document.addEventListener("visibilitychange", handleVisibilityRefresh);

        return () => {
            if (refreshTimerRef.current) {
                clearTimeout(refreshTimerRef.current);
            }

            window.removeEventListener("focus", handleFocusRefresh);
            document.removeEventListener("visibilitychange", handleVisibilityRefresh);
            void supabase.removeChannel(channel);
        };
    }, [router]);

    const grouped = useMemo(() => groupOrdersByBoardStatus(orders), [orders]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                        Orders Management
                    </h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Track payments, invoice status, due dates, and fulfillment in real
                        time.
                    </p>
                </div>

                <div className="shrink-0">
                    <CreateOrderModal />
                </div>
            </div>

            <div className="md:hidden">
                <MobileKanbanTabs grouped={grouped} />
            </div>

            <div className="hidden gap-4 overflow-x-auto pb-2 md:flex">
                {BOARD_STATUSES.map((status) => (
                    <KanbanColumn
                        key={status}
                        status={status}
                        orders={grouped[status]}
                    />
                ))}
            </div>
        </div>
    );
}
