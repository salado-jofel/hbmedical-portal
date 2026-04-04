"use client";

import { useState, useTransition } from "react";
import { useAppDispatch } from "@/store/hooks";
import { removeOrderFromStore } from "../(redux)/orders-slice";
import {
  recallOrder,
  resubmitForReview,
  deleteOrder,
} from "../(services)/actions";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import {
  User,
  Package,
  CalendarDays,
  Trash2,
  PenLine,
  RotateCcw,
  Send,
  RefreshCw,
  CheckCircle,
  Truck,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { SignOrderModal } from "./SignOrderModal";
import { ApproveOrderModal } from "./ApproveOrderModal";
import { AddShippingModal } from "./AddShippingModal";
import toast from "react-hot-toast";

interface OrderCardProps {
  order: DashboardOrder;
  canSign: boolean;
  canCreate: boolean;
  isAdmin: boolean;
  currentUserId?: string;
  currentUserName?: string;
  onClick?: () => void;
}

export function OrderCard({
  order,
  canSign,
  canCreate,
  isAdmin,
  currentUserId,
  currentUserName,
  onClick,
}: OrderCardProps) {
  const dispatch = useAppDispatch();
  const [, startTransition] = useTransition();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const status = order.order_status;

  function stopPropagation(e: React.MouseEvent) {
    e.stopPropagation();
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await deleteOrder(order.id);
      dispatch(removeOrderFromStore(order.id));
      toast.success(`Order ${order.order_number} deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  function handleAction(fn: () => Promise<{ success: boolean; error?: string }>, successMsg: string) {
    setIsActing(true);
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.success) {
          toast.success(successMsg);
        } else {
          toast.error(result.error ?? "Action failed.");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Unexpected error.");
      } finally {
        setIsActing(false);
      }
    });
  }

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Order?"
        description={`Order ${order.order_number} will be permanently deleted.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />

      <SignOrderModal
        open={signOpen}
        onOpenChange={setSignOpen}
        order={order}
        providerName={currentUserName ?? "Provider"}
      />

      <ApproveOrderModal
        open={approveOpen}
        onOpenChange={setApproveOpen}
        order={order}
      />

      <AddShippingModal
        open={shippingOpen}
        onOpenChange={setShippingOpen}
        order={order}
      />

      <div
        className="rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all hover:-translate-y-0.5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)] cursor-pointer"
        onClick={onClick}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#15689E]">
              Order
            </p>
            <h3 className="text-sm font-bold text-[#0F172A]">{order.order_number}</h3>
          </div>
          <OrderStatusBadge status={order.order_status} />
        </div>

        {/* Info rows */}
        <div className="mt-3 space-y-1.5">
          {order.patient_full_name && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{order.patient_full_name}</span>
            </div>
          )}
          {order.wound_type && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="capitalize">{order.wound_type.replace("_", " ")} wound</span>
            </div>
          )}
          {order.date_of_service && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>DOS: {order.date_of_service}</span>
            </div>
          )}
          {order.product_name && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">
                {order.product_name} × {order.quantity}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-wrap gap-2" onClick={stopPropagation}>
          {/* Draft actions */}
          {status === "draft" && canCreate && (
            <>
              <Button
                size="sm"
                className="h-8 text-xs bg-[#15689E] hover:bg-[#125d8e] text-white"
                onClick={onClick}
              >
                <Send className="w-3 h-3 mr-1" />
                Edit and Submit Order →
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-red-500 hover:bg-red-50"
                disabled={isDeleting}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            </>
          )}

          {/* Pending signature: provider can sign, both can recall */}
          {status === "pending_signature" && (
            <>
              {canSign && (
                <Button
                  size="sm"
                  className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setSignOpen(true)}
                >
                  <PenLine className="w-3 h-3 mr-1" />
                  Sign
                </Button>
              )}
              {canCreate && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-slate-300"
                  disabled={isActing}
                  onClick={() => handleAction(() => recallOrder(order.id), "Order recalled to draft.")}
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Recall
                </Button>
              )}
            </>
          )}

          {/* Manufacturer review: admin can approve / request info */}
          {status === "manufacturer_review" && isAdmin && (
            <>
              <Button
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setApproveOpen(true)}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                disabled={isActing}
                onClick={() =>
                  handleAction(
                    () =>
                      import("../(services)/actions").then((m) =>
                        m.requestAdditionalInfo(order.id),
                      ),
                    "Additional info requested.",
                  )
                }
              >
                Request Info
              </Button>
            </>
          )}

          {/* Additional info needed: clinic can resubmit */}
          {status === "additional_info_needed" && canCreate && (
            <Button
              size="sm"
              className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white"
              disabled={isActing}
              onClick={() =>
                handleAction(() => resubmitForReview(order.id), "Resubmitted for review.")
              }
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Resubmit
            </Button>
          )}

          {/* Approved: admin can add shipping */}
          {status === "approved" && isAdmin && (
            <Button
              size="sm"
              className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white"
              onClick={() => setShippingOpen(true)}
            >
              <Truck className="w-3 h-3 mr-1" />
              Add Shipping
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
