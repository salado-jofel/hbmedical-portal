"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateOrderInStore } from "../(redux)/orders-slice";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { OrderDetailModal } from "../(components)/OrderDetailModal";
import {
  CLINICAL_STATUSES,
  KANBAN_STATUS_CONFIG,
  groupOrdersByStatus,
} from "../(components)/kanban-config";
import { getUnreadMessageCounts, getOrderById } from "../(services)/order-read-actions";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { OrdersTable } from "./OrdersTable";
import { OrdersKanbanView } from "./OrdersKanbanView";
import { ClinicOrdersTable } from "./ClinicOrdersTable";
import type { KanbanColumn } from "@/utils/interfaces/orders";

export function OrdersKanban({
  canCreate,
  canSign,
  isAdmin,
  isRep,
  isSupport,
  currentUserId,
  currentUserName,
}: {
  canCreate: boolean;
  canSign: boolean;
  isAdmin: boolean;
  isRep: boolean;
  isSupport: boolean;
  currentUserId?: string;
  currentUserName?: string;
}) {
  const orders = useAppSelector((state) => state.orders.items);
  const dispatch = useAppDispatch();

  const [selectedOrder, setSelectedOrder] = useState<DashboardOrder | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [initialTab, setInitialTab] = useState("overview");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Keep the open modal's order in sync with Redux store.
  // Only update on meaningful field changes — not every reference change — to avoid
  // re-triggering the Master AI effect and cancelling an in-progress poll.
  useEffect(() => {
    if (!selectedOrder || !modalOpen) return;
    const latest = orders.find((o) => o.id === selectedOrder.id);
    if (!latest) return;
    const itemsSig = (o: DashboardOrder) =>
      (o.all_items ?? []).map((i) => `${i.id}:${i.quantity}`).join(",");
    const meaningful =
      latest.order_status !== selectedOrder.order_status ||
      latest.ai_extracted !== selectedOrder.ai_extracted ||
      latest.patient_full_name !== selectedOrder.patient_full_name ||
      (latest.documents?.length ?? 0) !== (selectedOrder.documents?.length ?? 0) ||
      (latest.notes ?? "") !== (selectedOrder.notes ?? "") ||
      itemsSig(latest) !== itemsSig(selectedOrder);
    if (meaningful) setSelectedOrder(latest);
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
      const { orderId, tab } = (
        e as CustomEvent<{ orderId: string; tab: string }>
      ).detail;
      openModal(orderId, tab ?? "overview");
    }

    // sessionStorage: set by NotificationBell / Recent Orders deep-link
    const pending = sessionStorage.getItem("pending-order-open");
    if (pending) {
      try {
        const { orderId, tab } = JSON.parse(pending) as {
          orderId: string;
          tab: string;
        };
        sessionStorage.removeItem("pending-order-open");
        setTimeout(() => openModal(orderId, tab ?? "overview"), 600);
      } catch {
        /* ignore malformed */
      }
    }

    window.addEventListener("open-order-modal", handleOpenOrderModal);
    return () =>
      window.removeEventListener("open-order-modal", handleOpenOrderModal);
  }, [orders]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle Stripe return — payment_success / payment_cancelled query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess = params.get("payment_success");
    const paymentCancelled = params.get("payment_cancelled");
    const returnOrderId = params.get("order_id");

    if (!paymentSuccess && !paymentCancelled) return;

    // Strip payment params from URL without re-rendering
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, "", cleanUrl);

    if (paymentSuccess === "true") {
      toast.success("Payment completed successfully!");
      if (returnOrderId) {
        setTimeout(() => {
          const found = orders.find((o) => o.id === returnOrderId);
          if (found) {
            setSelectedOrder(found);
            setInitialTab("overview");
            setModalOpen(true);
          } else {
            getOrderById(returnOrderId).then((fetched) => {
              if (!fetched) return;
              setSelectedOrder(fetched);
              setInitialTab("overview");
              setModalOpen(true);
            });
          }
        }, 400);
      }
    }

    if (paymentCancelled === "true") {
      toast.error("Payment was cancelled. No charge was made.");
    }
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

    return () => {
      supabase.removeChannel(channel);
    };
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

    return () => {
      supabase.removeChannel(channel);
    };
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
  const [mobileTab, setMobileTab] = useState<OrderStatus | "paid">(
    (isAdmin || isSupport) ? "manufacturer_review" : "draft",
  );
  const [tableMode, setTableMode] = useState(true);

  // Clinic users get a persistent Table/Board toggle (defaults to table)
  const isClinic = canCreate && !isAdmin && !isSupport;
  const [clinicView, setClinicView] = useState<"table" | "kanban">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("orders-view") as "table" | "kanban") || "table";
    }
    return "table";
  });
  useEffect(() => {
    if (!isClinic) return;
    localStorage.setItem("orders-view", clinicView);
  }, [clinicView, isClinic]);

  // Reps get table-only; admin/support default to kanban with toggle.
  // Clinic users are routed entirely through the clinicView branches below,
  // so they must never fall into the admin OrdersTable branch.
  const shouldShowTable = !isClinic && (isRep || tableMode);

  const CLINIC_VISIBLE_STATUSES: OrderStatus[] = [
    "draft",
    "pending_signature",
    "manufacturer_review",
    "additional_info_needed",
    "approved",
    "shipped",
    "delivered",
  ];
  const ADMIN_VISIBLE_STATUSES: OrderStatus[] = [
    "manufacturer_review",
    "additional_info_needed",
    "approved",
    "shipped",
    "delivered",
  ];
  const VISIBLE_STATUSES = (isAdmin || isSupport)
    ? ADMIN_VISIBLE_STATUSES
    : CLINIC_VISIBLE_STATUSES;

  function handleOrderClick(order: DashboardOrder) {
    setSelectedOrder(order);
    setModalOpen(true);
  }

  function handleSummaryClose() {
    setModalOpen(false);
    setSelectedOrder(null);
    setInitialTab("overview");
  }

  // Filter orders — admin/support only see manufacturer_review onwards
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if ((isAdmin || isSupport) && !VISIBLE_STATUSES.includes(o.order_status)) {
        return false;
      }
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
  }, [orders, search, statusFilter, isAdmin, isSupport, VISIBLE_STATUSES]);

  const grouped = useMemo(() => groupOrdersByStatus(filtered), [filtered]);

  // "Approved" = no payment method set yet
  const approvedPending = useMemo(
    () => (grouped["approved"] ?? []).filter((o) => !o.payment_method),
    [grouped],
  );
  // "Processed" = payment initiated (pay_now OR net_30, any payment_status)
  const approvedProcessed = useMemo(
    () =>
      (grouped["approved"] ?? []).filter(
        (o) => o.payment_method !== null && o.payment_method !== undefined,
      ),
    [grouped],
  );

  const kanbanColumns: KanbanColumn[] = VISIBLE_STATUSES.flatMap((status) =>
    status === "approved"
      ? [
          { type: "status" as const, status: "approved" as OrderStatus },
          { type: "paid" as const },
        ]
      : [{ type: "status" as const, status }],
  );

  const modal = selectedOrder && (
    <OrderDetailModal
      open={modalOpen}
      onClose={handleSummaryClose}
      order={selectedOrder}
      canSign={canSign}
      isAdmin={isAdmin}
      isClinical={canCreate}
      canEdit={canCreate}
      isRep={isRep}
      isSupport={isSupport}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      unreadCount={unreadCounts[selectedOrder.id] ?? 0}
      onClearUnread={() => handleClearUnread(selectedOrder.id)}
      initialTab={initialTab}
    />
  );

  // Clinic table view
  if (isClinic && clinicView === "table") {
    return (
      <>
        <ClinicOrdersTable
          filtered={filtered}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          view={clinicView}
          onViewChange={setClinicView}
          canCreate={canCreate}
          onOrderClick={handleOrderClick}
        />
        {modal}
      </>
    );
  }

  if (shouldShowTable) {
    return (
      <>
        <OrdersTable
          filtered={filtered}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          tableMode={tableMode}
          onTableModeChange={setTableMode}
          isAdmin={isAdmin}
          isSupport={isSupport}
          onOrderClick={handleOrderClick}
        />
        {modal}
      </>
    );
  }

  return (
    <>
      <OrdersKanbanView
        orders={orders}
        grouped={grouped}
        approvedPending={approvedPending}
        approvedProcessed={approvedProcessed}
        kanbanColumns={kanbanColumns}
        unreadCounts={unreadCounts}
        mobileTab={mobileTab}
        onMobileTabChange={setMobileTab}
        tableMode={tableMode}
        onTableModeChange={setTableMode}
        isAdmin={isAdmin}
        isSupport={isSupport}
        canCreate={canCreate}
        onOrderClick={handleOrderClick}
        clinicView={isClinic ? clinicView : undefined}
        onClinicViewChange={isClinic ? setClinicView : undefined}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />
      {modal}
    </>
  );
}
