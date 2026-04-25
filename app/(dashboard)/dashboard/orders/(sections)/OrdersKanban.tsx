"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { updateOrderInStore } from "../(redux)/orders-slice";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";
import { OrderDetailModal } from "../(components)/OrderDetailModal";
import {
  CLINICAL_STATUSES,
  KANBAN_STATUS_CONFIG,
  groupOrdersByStatus,
} from "../(components)/kanban-config";
import {
  getUnreadMessageCounts,
  getOrderById,
  getOrdersPaginated,
  getFacilitiesForOrderFilter,
} from "../(services)/order-read-actions";
import { ORDER_SORT_COLUMNS } from "@/utils/constants/orders";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import { OrdersTable } from "./OrdersTable";
import { OrdersKanbanView } from "./OrdersKanbanView";
import { ClinicOrdersTable } from "./ClinicOrdersTable";
import type { KanbanColumn } from "@/utils/interfaces/orders";
import { useListParams } from "@/utils/hooks/useListParams";
import { useBriefBusy } from "@/utils/hooks/useBriefBusy";
import { DEFAULT_PAGE_SIZE } from "@/utils/interfaces/paginated";
import type { PaginatedResult } from "@/utils/interfaces/paginated";

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

    // ?open=<id> query param — used by cross-page deep-links (e.g. commission
    // approval card linking to the related order). Strip the param after use
    // so a refresh doesn't re-open.
    const urlParams = new URLSearchParams(window.location.search);
    const openId = urlParams.get("open");
    if (openId) {
      setTimeout(() => openModal(openId, "overview"), 300);
      urlParams.delete("open");
      const next = urlParams.toString();
      const cleanUrl = window.location.pathname + (next ? `?${next}` : "");
      window.history.replaceState({}, "", cleanUrl);
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

  // Realtime subscription for orders.UPDATE / .INSERT lives further down —
  // declared AFTER refetchPaged so the ref forward-declare works. See
  // "Realtime: keep Kanban cards in sync…" below.

  function handleClearUnread(orderId: string) {
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }

  // Search — kept in ephemeral state (NOT URL). Can contain PHI (patient
  // names, facility names); URLs end up in browser history / logs.
  const [search, setSearch] = useState("");
  // Local quick-filter for Kanban view (stays in sync with URL for table).
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [mobileTab, setMobileTab] = useState<OrderStatus | "paid">(
    (isAdmin || isSupport) ? "manufacturer_review" : "draft",
  );
  const [tableMode, setTableMode] = useState(true);

  // URL-backed pagination / sort / filter for the table view. Kanban view
  // ignores these; they sit dormant in the URL until the user flips to table.
  const listParams = useListParams<
    typeof ORDER_SORT_COLUMNS,
    readonly ["status", "facility"]
  >({
    defaultSort: "updated_at",
    defaultDir: "desc",
    allowedSorts: ORDER_SORT_COLUMNS,
    filterKeys: ["status", "facility"] as const,
  });

  // Facility filter only makes sense for admin/support — clinic users are
  // already scoped to their own facility, and reps see the whole list. List
  // is fetched once on mount.
  const [facilityOptions, setFacilityOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  useEffect(() => {
    if (!isAdmin && !isSupport) return;
    let cancelled = false;
    getFacilitiesForOrderFilter()
      .then((list) => {
        if (!cancelled) setFacilityOptions(list);
      })
      .catch((err) =>
        console.error("[OrdersKanban] facility list fetch failed:", err),
      );
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isSupport]);

  // Status filter is URL-synced for table users; Kanban filter button writes
  // the same param so the two stay in sync when flipping views.
  useEffect(() => {
    const urlStatus = listParams.filters.status;
    const next: OrderStatus | "all" = (urlStatus as OrderStatus | null) ?? "all";
    setStatusFilter((prev) => (prev === next ? prev : next));
  }, [listParams.filters.status]);

  // Paginated data for the Table view. Kanban reads from `orders` (Redux).
  const [pagedData, setPagedData] = useState<PaginatedResult<DashboardOrder>>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
  });
  const [isFetching, setIsFetching] = useState(false);

  // Debounce search so keystrokes don't fire a query each. 300ms feels
  // responsive without being wasteful.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Cancellation via an incrementing ref — prevents an older slower fetch
  // from overwriting a newer faster one when the user paginates quickly.
  const fetchIdRef = useRef(0);
  const refetchPaged = useCallback(async () => {
    const myFetchId = ++fetchIdRef.current;
    setIsFetching(true);
    try {
      const res = await getOrdersPaginated({
        page: listParams.page,
        pageSize: listParams.pageSize,
        sort: listParams.sort,
        dir: listParams.dir,
        filters: {
          status: listParams.filters.status,
          facility: listParams.filters.facility,
        },
        search: debouncedSearch,
      });
      if (myFetchId !== fetchIdRef.current) return; // stale response, drop
      setPagedData(res);
    } catch (err) {
      if (myFetchId !== fetchIdRef.current) return;
      console.error("[OrdersKanban] paginated fetch failed:", err);
      toast.error("Failed to load orders.");
    } finally {
      if (myFetchId === fetchIdRef.current) setIsFetching(false);
    }
  }, [
    listParams.page,
    listParams.pageSize,
    listParams.sort,
    listParams.dir,
    listParams.filters.status,
    listParams.filters.facility,
    debouncedSearch,
  ]);

  // Fire the fetch whenever the params or search change. No-op for Kanban
  // mode — Kanban's grouping is client-side off Redux.
  useEffect(() => {
    void refetchPaged();
  }, [refetchPaged]);

  // Visible busy indicator combining three signals so the bar is on
  // continuously from click → fetch settle:
  //   - listParams.isPending  → flips synchronously when the user clicks
  //                             sort/filter/page (covers the URL-update lag)
  //   - paramsBusy            → flips when search debounce settles into a
  //                             new value (search isn't URL-backed)
  //   - isFetching            → covers the actual server call
  const paramsBusy = useBriefBusy([debouncedSearch], 250);
  const tableBusy = isFetching || listParams.isPending || paramsBusy;

  // Realtime: keep Kanban cards in sync (row-level Redux update) AND
  // trigger a paged refetch for table-view users. Both callbacks live on
  // one subscription so we don't double-channel. `refetchPagedRef` stays
  // pinned to the latest `refetchPaged` closure without rebuilding the
  // channel on every re-render.
  const refetchPagedRef = useRef(refetchPaged);
  refetchPagedRef.current = refetchPaged;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("orders-realtime-kanban")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        async (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const fullOrder = await getOrderById(updated.id as string);
          if (fullOrder) dispatch(updateOrderInStore(fullOrder));
          refetchPagedRef.current();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        () => refetchPagedRef.current(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // "Processed" = payment has actually succeeded:
  //   • Pay Now  → payment_status === "paid"
  //   • Net-30   → invoice_status === "issued" (Stripe accepted the invoice)
  // Everything else under "approved" — including Pay Now sessions in flight,
  // abandoned checkouts, and orders with no method — stays in "Approved" so
  // the provider still sees it as actionable.
  const isProcessed = (o: DashboardOrder) => {
    if (o.payment_method === "pay_now" && o.payment_status === "paid") return true;
    if (o.payment_method === "net_30" && o.invoice_status === "issued") return true;
    return false;
  };
  const approvedPending = useMemo(
    () => (grouped["approved"] ?? []).filter((o) => !isProcessed(o)),
    [grouped],
  );
  const approvedProcessed = useMemo(
    () => (grouped["approved"] ?? []).filter(isProcessed),
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
      isProvider={canSign}
      currentUserId={currentUserId}
      currentUserName={currentUserName}
      unreadCount={unreadCounts[selectedOrder.id] ?? 0}
      onClearUnread={() => handleClearUnread(selectedOrder.id)}
      initialTab={initialTab}
    />
  );

  // Shared handler: status filter changes flow to both the URL (for the
  // table's paginated query) and local state (used by Kanban client filter).
  function handleStatusFilterChange(next: OrderStatus | "all") {
    setStatusFilter(next);
    listParams.setFilter("status", next === "all" ? null : next);
  }

  // Clinic table view — server-paginated rows + sort from URL params.
  if (isClinic && clinicView === "table") {
    return (
      <>
        <ClinicOrdersTable
          rows={pagedData.rows}
          total={pagedData.total}
          page={pagedData.page}
          pageSize={pagedData.pageSize}
          sort={listParams.sort}
          dir={listParams.dir}
          onToggleSort={(col) => listParams.toggleSort(col as typeof ORDER_SORT_COLUMNS[number])}
          onPageChange={listParams.setPage}
          onPageSizeChange={listParams.setPageSize}
          isFetching={tableBusy}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
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
          rows={pagedData.rows}
          total={pagedData.total}
          page={pagedData.page}
          pageSize={pagedData.pageSize}
          sort={listParams.sort}
          dir={listParams.dir}
          onToggleSort={(col) => listParams.toggleSort(col as typeof ORDER_SORT_COLUMNS[number])}
          onPageChange={listParams.setPage}
          onPageSizeChange={listParams.setPageSize}
          isFetching={tableBusy}
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          facilityFilter={listParams.filters.facility}
          onFacilityFilterChange={(v) => listParams.setFilter("facility", v)}
          facilityOptions={facilityOptions}
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
        onStatusFilterChange={handleStatusFilterChange}
      />
      {modal}
    </>
  );
}
