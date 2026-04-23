"use client";

import { useEffect, useState } from "react";
import { cn } from "@/utils/utils";
import { getOrderDeliveryInvoice } from "../(services)/order-delivery-invoice-actions";
import { InvoiceDocument } from "./InvoiceDocument";
import type { DashboardOrder, IDeliveryInvoice } from "@/utils/interfaces/orders";

interface InvoiceTabProps {
  isActive: boolean;
  order: DashboardOrder;
  onDirtyChange?: (dirty: boolean) => void;
}

// Loading state — mirrors the paper-document layout (header band, two field
// columns, line-items table, acknowledgement grid) so the swap to the real
// form feels like content settling in, not a layout jump.
function InvoiceSkeleton() {
  return (
    <div className="mx-auto bg-white border border-[#ddd] shadow-[0_1px_3px_rgba(0,0,0,0.08)] animate-pulse"
      style={{ maxWidth: 800, padding: "28px 32px" }}
    >
      {/* Header band */}
      <div className="flex items-start justify-between pb-3 border-b border-[#e5e5e5]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-md bg-gray-200" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-2 w-20 bg-gray-100 rounded" />
            <div className="h-2 w-28 bg-gray-100 rounded" />
          </div>
        </div>
        <div className="space-y-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-2 w-44 bg-gray-100 rounded" />
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="flex justify-center py-3">
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>

      {/* Invoice # + Date */}
      <div className="flex justify-end gap-6 mb-3">
        <div className="h-6 w-44 bg-gray-100 rounded" />
        <div className="h-6 w-40 bg-gray-100 rounded" />
      </div>

      {/* Two-column customer/insurance */}
      <div className="grid grid-cols-2 gap-5">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 w-20 bg-gray-200 rounded" />
              <div className="h-5 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <div className="h-2 w-24 bg-gray-200 rounded" />
              <div className="h-5 w-full bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Delivery method row */}
      <div className="flex flex-wrap gap-4 my-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-4 w-28 bg-gray-100 rounded" />
        ))}
      </div>

      {/* Line items table */}
      <div className="border border-[#ddd] rounded-md overflow-hidden">
        <div className="h-7 bg-gray-100 border-b border-[#ddd]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 border-b border-[#eee] last:border-0" />
        ))}
      </div>

      {/* Acknowledgements grid */}
      <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-100 rounded" />
        ))}
      </div>
    </div>
  );
}

// Mirrors IVRTab/HCFATab: stays mounted (hidden via class), fetches its own
// data on first activation. Keeps tab swaps cheap.
export function InvoiceTab({ isActive, order, onDirtyChange }: InvoiceTabProps) {
  const [invoice, setInvoice] = useState<IDeliveryInvoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!isActive || hasLoaded) return;
    setLoading(true);
    let cancelled = false;
    getOrderDeliveryInvoice(order.id)
      .then((res) => {
        if (cancelled) return;
        if (res.error) setError(res.error);
        setInvoice(res.invoice);
        setHasLoaded(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, hasLoaded, order.id]);

  return (
    <div className={cn("absolute inset-0 overflow-y-auto px-3", !isActive && "hidden")}>
      {loading || !hasLoaded ? (
        <InvoiceSkeleton />
      ) : error || !invoice ? (
        <div className="text-center py-16 text-[var(--text3)]">
          {error ?? "Could not load invoice."}
        </div>
      ) : (
        <InvoiceDocument
          order={order}
          initialInvoice={invoice}
          onDirtyChange={onDirtyChange}
        />
      )}
    </div>
  );
}
