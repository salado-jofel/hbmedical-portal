"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateOrderInStore } from "../(redux)/orders-slice";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { CreateOrderModal } from "../(components)/CreateOrderModal";
import { OrderCard } from "../(components)/OrderCard";
import { OrderDetailModal } from "../(components)/OrderDetailModal";
import { OrderStatusBadge } from "../(components)/OrderStatusBadge";
import {
  CLINICAL_STATUSES,
  KANBAN_STATUS_CONFIG,
  groupOrdersByStatus,
} from "../(components)/kanban-config";
import { getUnreadMessageCounts, getOrderById } from "../(services)/actions";
import { createClient } from "@/lib/supabase/client";
import { EmptyState } from "@/app/(components)/EmptyState";
import { Package, Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/utils/utils";

interface OrdersPageClientProps {
  canCreate: boolean;
  canSign: boolean;
  isAdmin: boolean;
  isRep: boolean;
  isSupport: boolean;
  currentUserId?: string;
  currentUserName?: string;
}

const VISIBLE_STATUSES: OrderStatus[] = [
  "draft",
  "pending_signature",
  "manufacturer_review",
  "additional_info_needed",
  "approved",
  "shipped",
];

export function OrdersPageClient({
  canCreate,
  canSign,
  isAdmin,
  isRep,
  isSupport,
  currentUserId,
  currentUserName,
}: OrdersPageClientProps) {
  const orders = useAppSelector((state) => state.orders.items);
  const dispatch = useAppDispatch();

  const [selectedOrder, setSelectedOrder] = useState<DashboardOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState("overview");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => { currentUserIdRef.current = currentUserId; }, [currentUserId]);

  // Keep the open modal's order in sync with Redux store (so updateOrderInStore refreshes it)
  useEffect(() => {
    if (!selectedOrder || !modalOpen) return;
    const latest = orders.find((o) => o.id === selectedOrder.id);
    if (latest && latest !== selectedOrder) setSelectedOrder(latest);
  }, [orders, modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open modal from notification — CustomEvent (same page) or sessionStorage (navigated)
  useEffect(() => {
    function openModal(orderId: string, tab: string) {
      const found = orders.find((o) => o.id === orderId);
      if (found) {
        setSelectedOrder(found);
        setInitialTab(tab);
        setModalOpen(true);
      } else {
        getOrderById(orderId).then((fetched) => {
          if (!fetched) return;
          setSelectedOrder(fetched);
          setInitialTab(tab);
          setModalOpen(true);
        });
      }
    }

    // CustomEvent: dispatched by NotificationBell when already on this page
    function handleOpenOrderModal(e: Event) {
      const { orderId, tab } = (e as CustomEvent<{ orderId: string; tab: string }>).detail;
      openModal(orderId, tab ?? "overview");
    }

    // sessionStorage: set by NotificationBell when navigating from another page
    const pending = sessionStorage.getItem("pending-order-open");
    if (pending) {
      try {
        const { orderId, tab } = JSON.parse(pending) as { orderId: string; tab: string };
        sessionStorage.removeItem("pending-order-open");
        setTimeout(() => openModal(orderId, tab ?? "overview"), 600);
      } catch { /* ignore malformed */ }
    }

    window.addEventListener("open-order-modal", handleOpenOrderModal);
    return () => window.removeEventListener("open-order-modal", handleOpenOrderModal);
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load unread counts on mount (admin + clinical only)
  useEffect(() => {
    if (!canCreate && !isAdmin) return;
    getUnreadMessageCounts().then((counts) => setUnreadCounts(counts));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: increment unread when a new message arrives for any order
  useEffect(() => {
    if (!canCreate && !isAdmin) return;

    const supabase = createClient();
    const channel = supabase
      .channel("global-order-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_messages" },
        (payload) => {
          const msg = payload.new as { order_id: string; sender_id: string };
          if (msg.sender_id === currentUserIdRef.current) return;
          setUnreadCounts((prev) => ({
            ...prev,
            [msg.order_id]: (prev[msg.order_id] ?? 0) + 1,
          }));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, canCreate, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: re-fetch and update order card when status changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("orders-status-changes")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        async (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const old = payload.old as Record<string, unknown>;
          if (updated.order_status === old.order_status) return;

          const fullOrder = await getOrderById(updated.id as string);
          if (!fullOrder) return;
          dispatch(updateOrderInStore(fullOrder));
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClearUnread(orderId: string) {
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [mobileTab, setMobileTab] = useState<OrderStatus>("draft");

  const showTableView = isAdmin || isRep || isSupport;

  function handleOrderClick(order: DashboardOrder) {
    setSelectedOrder(order);
    setModalOpen(true);
  }

  function handleSummaryClose() {
    setModalOpen(false);
    setSelectedOrder(null);
    setInitialTab("overview");
  }

  // Filter orders
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch =
        !search ||
        o.order_number.toLowerCase().includes(search.toLowerCase()) ||
        (o.patient_full_name ?? "")
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        (o.facility_name ?? "").toLowerCase().includes(search.toLowerCase());

      const matchStatus =
        statusFilter === "all" || o.order_status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [orders, search, statusFilter]);

  const grouped = useMemo(() => groupOrdersByStatus(filtered), [filtered]);

  /* ── Order detail modal ── */
  const sheetPortal = selectedOrder && (
    <OrderDetailModal
      open={modalOpen}
      onClose={handleSummaryClose}
      order={selectedOrder}
      canSign={canSign}
      isAdmin={isAdmin}
      isClinical={canCreate}
      canEdit={canCreate}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      unreadCount={unreadCounts[selectedOrder.id] ?? 0}
      onClearUnread={() => handleClearUnread(selectedOrder.id)}
      initialTab={initialTab}
    />
  );

  /* ── TABLE VIEW (admin / rep / support) ── */
  if (showTableView) {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#0F172A]">Orders</h1>
            <p className="text-sm text-[#64748B] mt-1">
              All orders across facilities
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search by order #, patient, facility..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as OrderStatus | "all")
              }
              className="appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-[#15689E]/20 focus:border-[#15689E] bg-white"
            >
              <option value="all">All Statuses</option>
              {CLINICAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {KANBAN_STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Package className="w-10 h-10 stroke-1" />}
            message="No orders found"
            description="Adjust your filters or wait for orders to come in."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Order #
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                    Facility
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    Wound
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                    DOS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => handleOrderClick(order)}
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-[#15689E] text-xs">
                      {order.order_number}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {order.patient_full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                      {order.facility_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell capitalize">
                      {order.wound_type?.replace("_", " ") ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 hidden lg:table-cell">
                      {order.date_of_service ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.order_status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sheetPortal}
      </div>
    );
  }

  /* ── KANBAN VIEW (clinic) ── */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pb-4 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[#0F172A]">Orders</h1>
          <p className="text-sm text-[#64748B] mt-1">
            Track and manage your orders
          </p>
        </div>
        <div className="shrink-0">
          <CreateOrderModal />
        </div>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={<Package className="w-10 h-10 stroke-1" />}
          message="No orders yet"
          description="Create your first order to get started."
        />
      ) : (
        <>
          {/* Mobile: tabbed */}
          <div className="md:hidden">
            <div className="flex overflow-x-auto gap-1 pb-2 mb-4">
              {VISIBLE_STATUSES.map((status) => {
                const cfg = KANBAN_STATUS_CONFIG[status];
                const count = grouped[status].length;
                return (
                  <button
                    key={status}
                    onClick={() => setMobileTab(status)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all",
                      mobileTab === status
                        ? "bg-[#15689E] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                    {cfg.label}
                    <span
                      className={cn(
                        "ml-0.5 rounded-full text-[10px] px-1.5 py-0.5 font-bold",
                        mobileTab === status
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 text-slate-600",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {grouped[mobileTab].length === 0 ? (
                <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] py-14">
                  <EmptyState
                    icon={<Package className="w-8 h-8 text-[#E2E8F0]" />}
                    message={`No ${KANBAN_STATUS_CONFIG[mobileTab].label} orders`}
                  />
                </div>
              ) : (
                grouped[mobileTab].map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onClick={() => handleOrderClick(order)}
                    unreadCount={unreadCounts[order.id] ?? 0}
                  />
                ))
              )}
            </div>
          </div>

          {/* Desktop: kanban columns */}
          <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
            {VISIBLE_STATUSES.map((status) => {
              const cfg = KANBAN_STATUS_CONFIG[status];
              const columnOrders = grouped[status];
              return (
                <div
                  key={status}
                  className="flex flex-col bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl min-w-[220px] flex-1"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0]">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                      <span className="text-xs font-semibold text-[#0F172A]">
                        {cfg.label}
                      </span>
                    </div>
                    <span className="min-w-5.5 h-5.5 flex items-center justify-center rounded-full bg-[#15689E] text-white text-xs font-bold px-1.5">
                      {columnOrders.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 p-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]">
                    {columnOrders.length === 0 ? (
                      <EmptyState
                        icon={<Package className="w-7 h-7 text-[#E2E8F0]" />}
                        message="No orders"
                        className="py-8"
                      />
                    ) : (
                      columnOrders.map((order) => (
                        <OrderCard
                          key={order.id}
                          order={order}
                          onClick={() => handleOrderClick(order)}
                          unreadCount={unreadCounts[order.id] ?? 0}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {sheetPortal}
    </div>
  );
}
