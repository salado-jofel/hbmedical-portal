"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import type { Order } from "@/app/(interfaces)/order";
import { EmptyState } from "@/app/(components)/EmptyState";
import { OrderCard } from "./OrderCard";
import {
  BOARD_STATUSES,
  STATUS_CONFIG,
  type BoardStatus,
} from "./kanban-config";

export function MobileKanbanTabs({
  grouped,
}: {
  grouped: Record<BoardStatus, Order[]>;
}) {
  const [activeTab, setActiveTab] = useState<BoardStatus>("Processing");
  const config = STATUS_CONFIG[activeTab];

  return (
    <div>
      {/* Tab bar */}
      <div className="flex bg-slate-100 rounded-xl p-1 gap-1 mb-4">
        {BOARD_STATUSES.map((status) => {
          const isActive = activeTab === status;
          const cfg = STATUS_CONFIG[status];
          return (
            <button
              key={status}
              onClick={() => setActiveTab(status)}
              className={`
                flex flex-1 items-center justify-center gap-1.5
                py-2 px-2 rounded-lg text-xs font-semibold
                transition-all duration-200
                ${
                  isActive
                    ? "bg-white shadow-sm text-slate-800"
                    : "text-slate-400 hover:text-slate-600"
                }
              `}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
              <span className="truncate">{status}</span>
              <span
                className={`
                  shrink-0 min-w-4.5 h-4.5 flex items-center justify-center
                  rounded-full text-[10px] font-bold px-1
                  ${
                    isActive
                      ? "bg-[#2db0b0] text-white"
                      : "bg-slate-200 text-slate-500"
                  }
                `}
              >
                {grouped[status].length}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active column indicator */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
        <span className="text-sm font-semibold text-slate-700">
          {activeTab}
        </span>
        <span className="text-xs text-slate-400">
          {grouped[activeTab].length}{" "}
          {grouped[activeTab].length === 1 ? "order" : "orders"}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-3">
        {grouped[activeTab].length === 0 ? (
          <div className="bg-slate-50 rounded-xl border border-slate-200 py-14">
            <EmptyState
              icon={<Package className="w-8 h-8 text-slate-300 opacity-30" />}
              message="No orders"
              description={`Nothing in ${activeTab} yet`}
            />
          </div>
        ) : (
          grouped[activeTab].map((order) => (
            <OrderCard key={order.id} order={order} />
          ))
        )}
      </div>
    </div>
  );
}
