"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Building2, Calendar, Package, Receipt, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { PillBadge } from "@/app/(components)/PillBadge";
import { getOrderById } from "@/app/(dashboard)/dashboard/orders/(services)/order-read-actions";
import {
  getOrderPayment,
  getOrderInvoice,
} from "@/app/(dashboard)/dashboard/orders/(services)/order-payment-actions";
import { formatAmount, formatDate } from "@/utils/helpers/formatter";
import { getDisplayOrderStatus } from "@/utils/helpers/orders";
import { useSingleOrderRealtime } from "@/utils/hooks/useOrderRealtime";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import type { IPayment, IInvoice } from "@/utils/interfaces/orders";

interface OrderQuickViewProps {
  orderId: string | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<string, { label: string; variant: "green" | "gold" | "blue" | "red" }> = {
  draft:     { label: "Draft",     variant: "gold" },
  pending:   { label: "Pending",   variant: "gold" },
  approved:  { label: "Approved",  variant: "blue" },
  processed: { label: "Processed", variant: "green" },
  shipped:   { label: "Shipped",   variant: "blue" },
  delivered: { label: "Delivered", variant: "green" },
  canceled:  { label: "Canceled",  variant: "red"  },
};

export default function OrderQuickView({ orderId, onClose }: OrderQuickViewProps) {
  const [order, setOrder] = useState<DashboardOrder | null>(null);
  const [payment, setPayment] = useState<IPayment | null>(null);
  const [invoice, setInvoice] = useState<IInvoice | null>(null);
  const [loading, setLoading] = useState(false);

  // Shared fetch — used for initial load and realtime refresh. Wrapped in
  // useCallback so the realtime hook's callback ref stays stable.
  const refetch = useCallback(async (id: string, withSpinner: boolean) => {
    if (withSpinner) setLoading(true);
    try {
      const [o, p, i] = await Promise.all([
        getOrderById(id),
        getOrderPayment(id),
        getOrderInvoice(id),
      ]);
      setOrder(o);
      setPayment(p);
      setInvoice(i);
    } finally {
      if (withSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!orderId) {
      setOrder(null);
      setPayment(null);
      setInvoice(null);
      return;
    }
    refetch(orderId, true);
  }, [orderId, refetch]);

  // Realtime: keep this dialog in sync when someone else updates the order
  // (status change, payment received, shipment added, etc). Silent refetch
  // — no spinner — so the dialog doesn't flicker.
  useSingleOrderRealtime(orderId ?? null, () => {
    if (orderId) refetch(orderId, false);
  });

  const displayStatus = order ? getDisplayOrderStatus(order) : null;
  const statusCfg = displayStatus ? STATUS_LABEL[displayStatus] ?? STATUS_LABEL.pending : null;

  const items = order?.all_items ?? [];
  const orderTotal = items.reduce(
    (sum, i) => sum + Number(i.totalAmount ?? i.unitPrice * i.quantity),
    0,
  );

  return (
    <Dialog open={!!orderId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-2xl border border-[var(--border)] p-0 shadow-2xl">
        {/* Radix requires a DialogTitle at all times for a11y. Render a stable one
            in the header; fall back to "Order details" when the order is still loading. */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <DialogTitle className="text-[15px] font-semibold text-[var(--navy)]">
              {order ? (order.patient_full_name ?? "Unnamed patient") : "Order details"}
            </DialogTitle>
            {order && (
              <p
                className="mt-0.5 text-[11px] text-[var(--text3)]"
                style={{ fontFamily: "var(--font-dm-mono), monospace" }}
              >
                {order.order_number}
              </p>
            )}
          </div>
          {statusCfg && <PillBadge label={statusCfg.label} variant={statusCfg.variant} />}
        </div>

        {loading || !order ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--text3)]" />
          </div>
        ) : (
          <>

            <div className="space-y-4 p-5">
              {/* Clinic + date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                <div className="flex items-start gap-2">
                  <Building2 className="w-3.5 h-3.5 text-[var(--text3)] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Clinic</p>
                    <p className="text-[var(--navy)]">{order.facility_name ?? "—"}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="w-3.5 h-3.5 text-[var(--text3)] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Date of service</p>
                    <p className="text-[var(--navy)]">
                      {order.date_of_service ? formatDate(order.date_of_service) : "—"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-[10px] uppercase tracking-wide text-[var(--text3)] mb-2 flex items-center gap-1.5">
                  <Package className="w-3 h-3" />
                  Order items ({items.length})
                </p>
                <div className="rounded-[9px] border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-[var(--bg)] border-b border-[var(--border)]">
                        {["Product", "Qty", "Unit", "Total"].map((h, i) => (
                          <th
                            key={h}
                            className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.6px] text-[var(--text3)] whitespace-nowrap ${i > 0 ? "text-right" : ""}`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-3 py-2 text-[12px]">
                            <p className="font-medium text-[var(--navy)]">{item.productName}</p>
                            <p
                              className="text-[10px] text-[var(--text3)]"
                              style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                            >
                              {item.productSku}
                            </p>
                          </td>
                          <td className="px-3 py-2 text-[12px] text-right text-[var(--text2)]">
                            ×{item.quantity}
                          </td>
                          <td
                            className="px-3 py-2 text-[12px] text-right text-[var(--text2)]"
                            style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                          >
                            {formatAmount(Number(item.unitPrice))}
                          </td>
                          <td
                            className="px-3 py-2 text-[12px] text-right font-medium text-[var(--navy)]"
                            style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                          >
                            {formatAmount(Number(item.totalAmount ?? item.unitPrice * item.quantity))}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[var(--bg)]">
                        <td colSpan={3} className="px-3 py-2 text-right text-[11px] text-[var(--text3)] uppercase tracking-wide">
                          Order Total
                        </td>
                        <td
                          className="px-3 py-2 text-[13px] text-right font-semibold text-[var(--navy)]"
                          style={{ fontFamily: "var(--font-dm-mono), monospace" }}
                        >
                          {formatAmount(orderTotal)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment */}
              <div className="grid grid-cols-3 gap-3 rounded-[9px] border border-[var(--border)] bg-[var(--bg)] px-3 py-3 text-[12px]">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Payment method</p>
                  <p className="mt-0.5 text-[var(--navy)] capitalize">
                    {order.payment_method ? order.payment_method.replace("_", " ") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Payment status</p>
                  <p className="mt-0.5 text-[var(--navy)] capitalize">{order.payment_status ?? "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-[var(--text3)]">Delivery</p>
                  <p className="mt-0.5 text-[var(--navy)] capitalize">{order.delivery_status ?? "—"}</p>
                </div>
              </div>

              {/* Receipt (Pay Now) / Invoice (Net 30) — open in new tab */}
              {(payment?.receiptUrl || invoice?.hostedInvoiceUrl) && (
                <div className="flex flex-wrap gap-2">
                  {order.payment_method === "pay_now" && payment?.receiptUrl && (
                    <a
                      href={payment.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--navy)] hover:border-[var(--navy)] transition-colors"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View Receipt
                    </a>
                  )}
                  {order.payment_method === "net_30" && invoice?.hostedInvoiceUrl && (
                    <a
                      href={invoice.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-[7px] border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-medium text-[var(--navy)] hover:border-[var(--navy)] transition-colors"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Invoice{invoice.invoiceNumber ? ` · ${invoice.invoiceNumber}` : ""}
                    </a>
                  )}
                </div>
              )}

              <p className="text-[11px] text-[var(--text3)]">
                Need more detail?{" "}
                <a
                  href={`/dashboard/orders?open=${order.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-[var(--navy)]"
                >
                  Open full order ↗
                </a>
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
