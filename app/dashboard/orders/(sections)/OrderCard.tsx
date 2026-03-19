"use client";

import { useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  updateOrderInStore,
  removeOrderFromStore,
} from "../(redux)/orders-slice";
import { updateOrderStatus, deleteOrder } from "../(services)/actions";
import type { Order } from "@/app/(interfaces)/order";
import {
  Trash2,
  Package,
  Building2,
  User,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderInfoRow } from "./OrderInfoRow";
import QuickBooksInvoiceBadge from "../../../(components)/QuickBooksInvoiceBadge";
import { STATUS_CONFIG, type BoardStatus } from "./kanban-config";

export function OrderCard({ order }: { order: Order }) {
  const dispatch = useAppDispatch();
  const config = STATUS_CONFIG[order.status as BoardStatus];
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleAdvance() {
    if (!order.id || !config?.next || isAdvancing) return;
    setIsAdvancing(true);
    try {
      const formData = new FormData();
      formData.set("status", config.next);
      await updateOrderStatus(order.id, formData);
      dispatch(updateOrderInStore({ ...order, status: config.next }));
    } catch (err) {
      console.error("[handleAdvance]", err);
    } finally {
      setIsAdvancing(false);
    }
  }

  async function handleDelete() {
    if (!order.id) return;
    setIsDeleting(true);
    try {
      await deleteOrder(order.id);
      dispatch(removeOrderFromStore(order.id));
    } catch (err) {
      console.error("[handleDelete]", err);
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Order?"
        description={`Order ${order.order_id} will be permanently deleted and cannot be recovered.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
        {/* Top Row */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#2db0b0] tracking-wide">
            {order.order_id}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            disabled={isDeleting}
            className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Info Rows */}
        <OrderInfoRow icon={Package} text={order.product_name ?? "—"} primary />
        <OrderInfoRow icon={Building2} text={order.facility_name ?? "—"} />
        {order.created_by_email && (
          <OrderInfoRow icon={User} text={order.created_by_email} />
        )}

        <div className="border-t border-slate-100" />

        <QuickBooksInvoiceBadge
          orderId={order.id!}
          orderDocNumber={order.order_id}
          qbInvoiceId={order.qb_invoice_id}
          qbInvoiceStatus={order.qb_invoice_status}
          facilityQbCustomerId={order.facility_qb_customer_id}
          productQbItemId={order.product_qb_item_id}
        />

        <div className="border-t border-slate-100" />

        {/* Bottom Row */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-slate-800">
            ${Number(order.amount).toFixed(2)}
          </span>
          {config?.next && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAdvance}
              disabled={isAdvancing}
              className="h-7 px-2 text-xs text-[#2db0b0] hover:text-[#249191] hover:bg-teal-50 font-medium cursor-pointer"
            >
              {isAdvancing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  Moving...
                </>
              ) : (
                <>
                  {config.next}
                  <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
