"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import { useAppSelector } from "@/store/hooks";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { IContact } from "@/utils/interfaces/contacts";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { IRepProfile } from "@/utils/interfaces/accounts";
import {
  getOrderById,
  getOrdersByFacility,
} from "@/app/(dashboard)/dashboard/orders/(services)/actions";
import { createClient } from "@/lib/supabase/client";
import { OrderDetailModal } from "@/app/(dashboard)/dashboard/orders/(components)/OrderDetailModal";
import { OverviewTab } from "../(components)/OverviewTab";
import { ContactsTab } from "../(components)/ContactsTab";
import { ActivitiesTab } from "../(components)/ActivitiesTab";
import { OrdersTab } from "../(components)/OrdersTab";

type TabId = "overview" | "contacts" | "activities" | "orders";

const ALL_TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "activities", label: "Activities" },
  { id: "orders", label: "Orders" },
];

interface AccountDetailClientProps {
  account: IAccount;
  contacts: IContact[];
  orders: DashboardOrder[];
  canEdit: boolean;
  salesReps: IRepProfile[];
  showActivities: boolean;
}

export function AccountDetailClient({
  account,
  contacts,
  orders: initialOrders,
  canEdit,
  salesReps,
  showActivities,
}: AccountDetailClientProps) {
  const tabs = ALL_TABS.filter((t) => t.id !== "activities" || showActivities);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const currentUserId = useAppSelector((state) => state.dashboard.userId);
  const currentUserName = useAppSelector((state) => state.dashboard.name);
  const userRole = useAppSelector((state) => state.dashboard.role);
  const isSupport = userRole === "support_staff";

  /* ── Orders state (mutable — updated by Realtime + modal actions) ── */
  const [orders, setOrders] = useState<DashboardOrder[]>(initialOrders);

  function handleOrderUpdated(updated: DashboardOrder) {
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  }

  /* ── Order modal state ── */
  const [selectedOrder, setSelectedOrder] = useState<DashboardOrder | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Keep selectedOrder in sync when orders list updates via Realtime
  useEffect(() => {
    if (!selectedOrder || !modalOpen) return;
    const latest = orders.find((o) => o.id === selectedOrder.id);
    if (latest && latest !== selectedOrder) setSelectedOrder(latest);
  }, [orders, modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleOrderClick(orderId: string) {
    const order = await getOrderById(orderId);
    if (!order) {
      toast.error("Could not load order.");
      return;
    }
    setSelectedOrder(order);
    setModalOpen(true);
  }

  async function handleModalClose() {
    setModalOpen(false);
    setSelectedOrder(null);
    // Refetch to ensure kanban is fully in sync after any actions
    const fresh = await getOrdersByFacility(account.id);
    setOrders(fresh);
  }

  /* ── Handle Stripe return — payment_success / payment_cancelled ── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentSuccess   = params.get("payment_success");
    const paymentCancelled = params.get("payment_cancelled");
    const returnOrderId    = params.get("order_id");

    if (!paymentSuccess && !paymentCancelled) return;

    // Strip payment params from URL without re-rendering
    window.history.replaceState({}, "", window.location.pathname);

    if (paymentSuccess === "true") {
      toast.success("Payment completed successfully!");
      if (returnOrderId) {
        setTimeout(() => {
          const found = orders.find((o) => o.id === returnOrderId);
          if (found) {
            setSelectedOrder(found);
            setModalOpen(true);
          } else {
            getOrderById(returnOrderId).then((fetched) => {
              if (!fetched) return;
              setSelectedOrder(fetched);
              setModalOpen(true);
            });
          }
        }, 400);
      }
    }

    if (paymentCancelled === "true") {
      toast.error("Payment was cancelled. No charge was made.");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Realtime: update kanban when any order in this facility changes ── */
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`account-orders-${account.id}`)
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "orders",
          filter: `facility_id=eq.${account.id}`,
        },
        async (payload) => {
          const updated = await getOrderById(
            (payload.new as { id: string }).id,
          );
          if (updated) handleOrderUpdated(updated);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [account.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* ── Tab bar ── */}
      <div className="flex border-b border-[#E2E8F0] overflow-x-auto gap-0 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "text-[#15689E] border-b-2 border-[#15689E]"
                : "text-[#94A3B8] hover:text-[#64748B]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {activeTab === "overview" && (
          <OverviewTab account={account} salesReps={salesReps} />
        )}
        {activeTab === "contacts" && (
          <ContactsTab
            facilityId={account.id}
            canEdit={canEdit}
          />
        )}
        {activeTab === "activities" && (
          <ActivitiesTab
            facilityId={account.id}
            canEdit={canEdit}
          />
        )}
        {activeTab === "orders" && (
          <OrdersTab
            orders={orders}
            onOrderClick={handleOrderClick}
          />
        )}
      </motion.div>

      {/* ── Order detail modal ── */}
      {selectedOrder && (
        <OrderDetailModal
          open={modalOpen}
          order={selectedOrder}
          isAdmin={canEdit}
          isSupport={isSupport}
          isClinical={false}
          canEdit={false}
          canSign={false}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          unreadCount={0}
          onClearUnread={() => {}}
          initialTab="overview"
          onOrderUpdated={handleOrderUpdated}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
