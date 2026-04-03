"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils/utils";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { IContact } from "@/utils/interfaces/contacts";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { IRepProfile } from "@/utils/interfaces/accounts";
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
  orders,
  canEdit,
  salesReps,
  showActivities,
}: AccountDetailClientProps) {
  const tabs = ALL_TABS.filter((t) => t.id !== "activities" || showActivities);
  const [activeTab, setActiveTab] = useState<TabId>("overview");

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
        {activeTab === "orders" && <OrdersTab orders={orders} />}
      </motion.div>
    </div>
  );
}
