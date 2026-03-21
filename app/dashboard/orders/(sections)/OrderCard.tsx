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
import { STATUS_CONFIG, type BoardStatus } from "./kanban-config";
import toast from "react-hot-toast";

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
      toast.success(`Order moved to "${config.next}".`);
    } catch (err) {
      console.error("[handleAdvance]", err);
      toast.error("Failed to advance order. Please try again.");
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
      toast.success(`Order ${order.order_id} deleted successfully.`);
    } catch (err) {
      console.error("[handleDelete]", err);
      toast.error("Failed to delete order. Please try again.");
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
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#15689E] tracking-wide">
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

        <OrderInfoRow icon={Package} text={order.product_name ?? "—"} primary />
        <OrderInfoRow icon={Building2} text={order.facility_name ?? "—"} />

        {order.created_by_email && (
          <OrderInfoRow icon={User} text={order.created_by_email} />
        )}

        <div className="border-t border-slate-100" />

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
              className="h-7 px-2 text-xs text-[#15689E] hover:text-[#0f4f7a] hover:bg-[#15689E]/10 font-medium cursor-pointer"
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
