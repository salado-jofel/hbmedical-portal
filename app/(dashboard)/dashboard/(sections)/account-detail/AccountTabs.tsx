"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/utils";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { IContact } from "@/utils/interfaces/contacts";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { IRepProfile } from "@/utils/interfaces/accounts";
import { OverviewTab } from "./OverviewTab";
import { ContactsTab } from "./ContactsTab";
import { ActivitiesTab } from "./ActivitiesTab";
import { OrdersTab } from "./OrdersTab";

type TabId = "overview" | "contacts" | "activities" | "orders";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "activities", label: "Activities" },
  { id: "orders", label: "Orders" },
];

interface AccountTabsProps {
  account: IAccount;
  contacts: IContact[];
  orders: DashboardOrder[];
  isAdmin: boolean;
  isAssignedRep: boolean;
  salesReps: IRepProfile[];
}

export function AccountTabs({
  account,
  contacts,
  orders,
  isAdmin,
  isAssignedRep,
  salesReps,
}: AccountTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  return (
    <div className="space-y-4">
      {/* ── Tab bar ── */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "text-[#15689E]"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="account-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#15689E] rounded-full"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
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
            isAdmin={isAdmin}
            isAssignedRep={isAssignedRep}
          />
        )}
        {activeTab === "activities" && (
          <ActivitiesTab
            facilityId={account.id}
            isAdmin={isAdmin}
            isAssignedRep={isAssignedRep}
          />
        )}
        {activeTab === "orders" && <OrdersTab orders={orders} />}
      </motion.div>
    </div>
  );
}
