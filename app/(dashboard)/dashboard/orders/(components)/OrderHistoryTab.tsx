"use client";

import { Clock, User } from "lucide-react";
import type { IOrderHistory } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";

function HistorySkeleton() {
  return (
    <div className="p-4 space-y-3 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className="w-2 h-2 rounded-full bg-gray-300 mt-1.5 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-3 bg-gray-200 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-3/4" />
          </div>
          <div className="h-3 bg-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
  );
}

interface OrderHistoryTabProps {
  isActive: boolean;
  isReady: boolean;
  history: IOrderHistory[];
}

export function OrderHistoryTab({ isActive, isReady, history }: OrderHistoryTabProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto px-6 py-6",
        !isActive && "hidden",
      )}
    >
      {!isReady ? (
        <HistorySkeleton />
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
            <Clock className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400 font-medium">No history yet</p>
          <p className="text-xs text-gray-300 mt-1">
            Actions on this order will appear here
          </p>
        </div>
      ) : (
        <div className="relative pl-5">
          <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-100" />
          {history.map((h) => (
            <div key={h.id} className="relative mb-5 last:mb-0">
              <div
                className={cn(
                  "absolute -left-[17px] w-3 h-3 rounded-full border-2 border-white top-1",
                  h.action.includes("signed")
                    ? "bg-green-500"
                    : h.action.includes("approved")
                      ? "bg-green-600"
                      : h.action.includes("shipped")
                        ? "bg-blue-500"
                        : h.action.includes("canceled")
                          ? "bg-red-400"
                          : h.action.includes("AI")
                            ? "bg-purple-500"
                            : h.action.includes("recalled")
                              ? "bg-amber-500"
                              : "bg-[#15689E]",
                )}
              />
              <p className="text-sm font-semibold text-gray-800">{h.action}</p>
              {h.oldStatus && h.newStatus && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <span className="capitalize px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
                    {h.oldStatus.replace(/_/g, " ")}
                  </span>
                  <span>→</span>
                  <span className="capitalize px-1.5 py-0.5 bg-gray-100 rounded text-[10px]">
                    {h.newStatus.replace(/_/g, " ")}
                  </span>
                </p>
              )}
              <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                <User className="w-3 h-3" />
                {h.performedByName ?? "System"}
                <span className="text-gray-300">·</span>
                {new Date(h.createdAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
              {h.notes && (
                <p className="text-xs text-gray-500 mt-1 bg-gray-50 rounded-lg px-2 py-1 border border-gray-100">
                  {h.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
