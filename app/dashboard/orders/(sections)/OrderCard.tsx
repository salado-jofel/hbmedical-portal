"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import {
  updateOrderInStore,
  removeOrderFromStore,
} from "../(redux)/orders-slice";
import {
  createOrderCheckout,
  deleteOrder,
  startOrderNet30,
  submitOrderPaymentChoice,
} from "../(services)/actions";

import type {
  DashboardOrder,
  OrderPaymentMethod,
} from "@/utils/interfaces/orders";
import {
  canChoosePaymentMethod,
  canDeleteOrder,
  canEditOrder,
  getOrderLockReason,
} from "@/utils/helpers/orders";
import { DEFAULT_INVOICE_STATUS } from "@/utils/constants/orders";

import {
  Trash2,
  Package,
  Building2,
  Loader2,
  CreditCard,
  CheckCircle2,
  Boxes,
  DollarSign,
  Truck,
  Clock3,
  ChevronDown,
  CalendarClock,
  Edit3,
  ReceiptText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderInfoRow } from "./OrderInfoRow";
import { EditOrderModal } from "./EditOrderModal";
import toast from "react-hot-toast";
import { PaymentBadge } from "@/app/(components)/PaymentBadge";
import { FulfillmentBadge } from "@/app/(components)/FulfillmentBadge";
import { mapOrderToBoardStatus } from "./kanban-config";

type OrderCardActionMeta = DashboardOrder & {
  stripe_checkout_url?: string | null;
  stripe_invoice_hosted_url?: string | null;
  stripe_receipt_url?: string | null;
  receipt_url?: string | null;
};

function formatCurrency(value: number | string | null | undefined) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return `$${(Number.isFinite(amount) ? amount : 0).toFixed(2)}`;
}

function getPaymentDisplayStatus(order: DashboardOrder) {
  if (order.payment_status === "paid") return "paid";
  if (order.payment_status === "failed") return "payment_failed";
  if (order.payment_status === "canceled") return "canceled";
  if (order.invoice_status === "overdue") return "overdue";
  if (order.invoice_status === "sent") return "invoice_sent";
  if (order.invoice_status === "partially_paid") return "partially_paid";
  if (order.payment_status === "pending") return "pending";
  return "unpaid";
}

function getOrderFulfillmentLabel(order: DashboardOrder) {
  if (order.delivery_status === "delivered") return "Delivered";
  if (order.delivery_status === "in_transit") return "In Transit";
  if (order.delivery_status === "label_created") return "Label Created";
  if (order.delivery_status === "returned") return "Returned";
  if (order.delivery_status === "exception") return "Delivery Issue";
  if (order.delivery_status === "canceled") return "Canceled";

  if (
    order.payment_status === "paid" ||
    (order.payment_method === "net_30" &&
      order.invoice_status !== DEFAULT_INVOICE_STATUS)
  ) {
    return "Awaiting Shipment";
  }

  if (order.order_status === "draft") return "Draft";
  return "Awaiting Payment";
}

function getPaymentMethodLabel(method: DashboardOrder["payment_method"]) {
  if (method === "pay_now") return "Pay Now";
  if (method === "net_30") return "Pay Later (Net 30)";
  return "Not selected";
}

function getNet30DueMeta(order: DashboardOrder, nowMs = Date.now()) {
  if (order.payment_method !== "net_30") return null;
  if (order.invoice_status === DEFAULT_INVOICE_STATUS) return null;
  if (!order.placed_at) return null;

  const placedAt = new Date(order.placed_at);
  if (Number.isNaN(placedAt.getTime())) return null;

  const due = new Date(placedAt);
  due.setDate(due.getDate() + 30);

  const now = new Date(nowMs);

  const today = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();

  const dueDay = new Date(
    due.getFullYear(),
    due.getMonth(),
    due.getDate(),
  ).getTime();

  const diffDays = Math.round((dueDay - today) / (1000 * 60 * 60 * 24));

  let relativeText = "";
  let toneClasses = "border-amber-100 bg-amber-50 text-amber-700";
  let subToneClasses = "text-amber-600";

  if (diffDays > 1) {
    relativeText = `${diffDays} days left`;
  } else if (diffDays === 1) {
    relativeText = "1 day left";
  } else if (diffDays === 0) {
    relativeText = "Due today";
    toneClasses = "border-orange-100 bg-orange-50 text-orange-700";
    subToneClasses = "text-orange-600";
  } else if (diffDays === -1) {
    relativeText = "Overdue by 1 day";
    toneClasses = "border-red-100 bg-red-50 text-red-700";
    subToneClasses = "text-red-600";
  } else {
    relativeText = `Overdue by ${Math.abs(diffDays)} days`;
    toneClasses = "border-red-100 bg-red-50 text-red-700";
    subToneClasses = "text-red-600";
  }

  const formattedDate = due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return {
    formattedDate,
    relativeText,
    toneClasses,
    subToneClasses,
  };
}

export function OrderCard({ order }: { order: DashboardOrder }) {
  console.log("order test: ", order);
  const dispatch = useAppDispatch();
  const actionOrder = order as OrderCardActionMeta;

  const [isDeleting, setIsDeleting] = useState(false);
  const [isPayingNow, setIsPayingNow] = useState(false);
  const [isPayingLater, setIsPayingLater] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const paymentMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        paymentMenuRef.current &&
        !paymentMenuRef.current.contains(event.target as Node)
      ) {
        setPaymentMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const boardStatus = mapOrderToBoardStatus(order as never);

  const isPaid = order.payment_status === "paid";

  const hasInvoice =
    order.payment_method === "net_30" &&
    order.invoice_status !== DEFAULT_INVOICE_STATUS;

  const hasInvoiceUrl = Boolean(actionOrder.stripe_invoice_hosted_url);

  const receiptUrl =
    actionOrder.stripe_receipt_url ?? actionOrder.receipt_url ?? null;

  const showResumePayment =
    order.payment_method === "pay_now" && order.payment_status === "pending";

  const showViewInvoice =
    order.payment_method === "net_30" &&
    order.invoice_status !== DEFAULT_INVOICE_STATUS &&
    order.payment_status !== "paid";

  const isDelivered = boardStatus === "Delivered";
  const fulfillmentLabel = getOrderFulfillmentLabel(order);

  const quantity = Number(order.quantity ?? 1);
  const totalAmount = Number(order.total_amount ?? 0);
  const unitPrice = Number(order.unit_price ?? 0);

  const canDelete = canDeleteOrder(order);
  const canEdit = canEditOrder(order);
  const canChoosePayment = canChoosePaymentMethod(order);
  const lockReason = getOrderLockReason(order);

  const isBusy = isPayingNow || isPayingLater || isDeleting;

  const net30DueMeta = useMemo(
    () => getNet30DueMeta(order, nowMs),
    [order, nowMs],
  );

  const shouldShowNet30DueDate =
    order.payment_method === "net_30" &&
    !isPaid &&
    !!net30DueMeta &&
    order.invoice_status !== DEFAULT_INVOICE_STATUS;

  async function handleDelete() {
    if (!order.id) return;

    setIsDeleting(true);
    try {
      await deleteOrder(order.id);
      dispatch(removeOrderFromStore(order.id));
      toast.success(`Order ${order.order_number} deleted successfully.`);
    } catch (err) {
      console.error("[handleDelete]", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to delete order. Please try again.",
      );
    } finally {
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  }

  async function handlePaymentChoice(method: OrderPaymentMethod) {
    if (!order.id || isPaid) return;

    setPaymentMenuOpen(false);

    if (method === "pay_now") {
      setIsPayingNow(true);
    } else {
      setIsPayingLater(true);
    }

    try {
      if (method === "net_30") {
        const updatedOrder = await startOrderNet30(order.id);
        dispatch(updateOrderInStore(updatedOrder));
        toast.success("Net 30 invoice created in Stripe.");
        return;
      }

      const updatedOrder = await submitOrderPaymentChoice({
        id: order.id,
        payment_method: method,
      });

      dispatch(updateOrderInStore(updatedOrder));

      toast.success("Redirecting to Stripe checkout...");

      const { url } = await createOrderCheckout(order.id);
      if (url) {
        window.location.assign(url);
      }
    } catch (err) {
      console.error("[handlePaymentChoice]", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to update payment choice. Please try again.",
      );
    } finally {
      setIsPayingNow(false);
      setIsPayingLater(false);
    }
  }

  async function handleResumePayment() {
    if (!order.id || isPayingNow || isPaid) return;

    setIsPayingNow(true);

    try {
      toast.success("Redirecting to Stripe checkout...");
      const { url } = await createOrderCheckout(order.id);
      if (url) {
        window.location.assign(url);
      }
    } catch (err) {
      console.error("[handleResumePayment]", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to resume payment. Please try again.",
      );
    } finally {
      setIsPayingNow(false);
    }
  }

  function handleViewInvoice() {
    if (!actionOrder.stripe_invoice_hosted_url) {
      toast.error("Invoice link is not available yet.");
      return;
    }

    window.open(
      actionOrder.stripe_invoice_hosted_url,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function handleViewReceipt() {
    if (!receiptUrl) {
      toast.error("Receipt link is not available yet.");
      return;
    }

    window.open(receiptUrl, "_blank", "noopener,noreferrer");
  }

  function handleTrackOrder() {
    toast.success("Track Order will be wired with ShipStation next.");
  }

  function handleEditClick() {
    if (!canEdit) {
      toast.error(lockReason || "This order cannot be edited.");
      return;
    }

    setEditOpen(true);
  }

  function renderPrimaryAction() {
    if (showResumePayment) {
      return (
        <Button
          type="button"
          size="sm"
          onClick={handleResumePayment}
          disabled={isPayingNow}
          className="h-9 cursor-pointer bg-[#15689E] text-white hover:bg-[#0f4f7a]"
        >
          {isPayingNow ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              <CreditCard className="mr-1 h-4 w-4" />
              Resume Payment
            </>
          )}
        </Button>
      );
    }

    if (showViewInvoice) {
      return (
        <Button
          type="button"
          size="sm"
          onClick={handleViewInvoice}
          disabled={!hasInvoiceUrl}
          className="h-9 cursor-pointer bg-[#15689E] text-white hover:bg-[#0f4f7a] disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          <ReceiptText className="mr-1 h-4 w-4" />
          View Invoice
        </Button>
      );
    }

    if (isPaid) {
      return (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {order.payment_method === "pay_now" ? (
            <Button
              type="button"
              size="sm"
              onClick={handleViewReceipt}
              disabled={!receiptUrl}
              className="h-9 cursor-pointer bg-[#15689E] text-white hover:bg-[#0f4f7a] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <ReceiptText className="mr-1 h-4 w-4" />
              View Receipt
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleViewInvoice}
              disabled={!hasInvoiceUrl}
              className="h-9 cursor-pointer bg-[#15689E] text-white hover:bg-[#0f4f7a] disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <ReceiptText className="mr-1 h-4 w-4" />
              View Invoice
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={handleTrackOrder}
            className="h-9 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Truck className="mr-1 h-4 w-4" />
            Track Order
          </Button>
        </div>
      );
    }

    if (canChoosePayment) {
      return (
        <div className="relative" ref={paymentMenuRef}>
          <Button
            type="button"
            size="sm"
            onClick={() => setPaymentMenuOpen((prev) => !prev)}
            disabled={isBusy}
            className="h-9 cursor-pointer bg-[#15689E] text-white hover:bg-[#0f4f7a]"
          >
            {isPayingNow || isPayingLater ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="mr-1 h-4 w-4" />
                Choose Payment
                <ChevronDown className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>

          {paymentMenuOpen && !isBusy && (
            <div className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                onClick={() => handlePaymentChoice("pay_now")}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Now
              </button>

              <button
                type="button"
                onClick={() => handlePaymentChoice("net_30")}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Clock3 className="mr-2 h-4 w-4" />
                Pay Later (Net 30)
              </button>
            </div>
          )}
        </div>
      );
    }

    if (hasInvoice) {
      return (
        <Button
          type="button"
          size="sm"
          disabled
          className="h-9 bg-amber-600 text-white hover:bg-amber-600"
        >
          <ReceiptText className="mr-1 h-4 w-4" />
          Invoice Created
        </Button>
      );
    }

    return (
      <Button
        type="button"
        size="sm"
        disabled
        className="h-9 bg-slate-600 text-white hover:bg-slate-600"
      >
        <Clock3 className="mr-1 h-4 w-4" />
        Awaiting Payment
      </Button>
    );
  }

  function renderPaymentText() {
    if (order.payment_status === "paid") return "Paid";
    if (order.invoice_status === "sent") return "Invoice Sent";
    if (order.invoice_status === "overdue") return "Overdue";
    if (order.invoice_status === "partially_paid") return "Partially Paid";
    if (order.payment_status === "failed") return "Payment Failed";
    if (order.payment_status === "pending") return "Pending";
    if (order.payment_status === "canceled") return "Canceled";
    return "Unpaid";
  }

  const displayStatus = isDelivered
    ? "Delivered"
    : isPaid || hasInvoice
      ? "Awaiting Shipment"
      : "Awaiting Payment";

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Order?"
        description={`Order ${order.order_number} will be permanently deleted and cannot be recovered.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleDelete}
      />

      <EditOrderModal
        open={editOpen}
        onOpenChange={setEditOpen}
        order={order}
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#15689E]">
              Order
            </p>
            <h3 className="text-sm font-bold text-slate-800">
              {order.order_number}
            </h3>
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleEditClick}
              disabled={!canEdit || isBusy}
              title={
                canEdit
                  ? "Edit order"
                  : lockReason || "This order cannot be edited."
              }
              className="h-7 w-7 cursor-pointer text-slate-300 hover:bg-slate-100 hover:text-slate-600"
            >
              <Edit3 className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!canDelete) {
                  toast.error(lockReason || "This order cannot be deleted.");
                  return;
                }
                setConfirmOpen(true);
              }}
              disabled={isDeleting || !canDelete}
              title={
                canDelete
                  ? "Delete order"
                  : lockReason || "This order cannot be deleted."
              }
              className="h-7 w-7 cursor-pointer text-slate-300 hover:bg-red-50 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PaymentBadge status={getPaymentDisplayStatus(order)} />
          <FulfillmentBadge label={fulfillmentLabel} delivered={isDelivered} />
        </div>

        <div className="mt-4 space-y-2">
          <OrderInfoRow
            icon={Package}
            text={`Product: ${order.product_name ?? ""}`}
            primary
          />

          <OrderInfoRow
            icon={Building2}
            text={`Facility: ${order.facility_name ?? ""}`}
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Quantity
              </p>
              <div className="mt-1 flex items-center gap-2 text-slate-800">
                <Boxes className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold">{quantity}</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Unit Price
              </p>
              <div className="mt-1 flex items-center gap-2 text-slate-800">
                <DollarSign className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold">
                  {formatCurrency(unitPrice)}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Payment Method
            </p>
            <div className="mt-1 flex items-center gap-2 text-slate-800">
              <CreditCard className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold">
                {getPaymentMethodLabel(order.payment_method)}
              </span>
            </div>
          </div>

          {order.payment_method === "net_30" &&
          order.invoice_status !== DEFAULT_INVOICE_STATUS ? (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Invoice Status
              </p>
              <div className="mt-1 flex items-center gap-2 text-slate-800">
                <ReceiptText className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold">
                  {order.invoice_status.replace(/_/g, " ")}
                </span>
              </div>
            </div>
          ) : null}

          {shouldShowNet30DueDate && net30DueMeta ? (
            <div
              className={`rounded-xl border px-3 py-2 ${net30DueMeta.toneClasses}`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide">
                Invoice Due
              </p>

              <div className="mt-1 flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {net30DueMeta.formattedDate}
                </span>
              </div>

              <p className={`mt-1 text-xs ${net30DueMeta.subToneClasses}`}>
                {net30DueMeta.relativeText}
              </p>
            </div>
          ) : null}

          {order.tracking_number ? (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-500">
                Tracking
              </p>
              <div className="mt-1 flex items-center gap-2 text-blue-800">
                <Truck className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  {order.tracking_number}
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Total Amount
              </span>
              <span className="mt-1 text-xl font-bold text-slate-800">
                {formatCurrency(totalAmount)}
              </span>
              <span className="text-xs text-slate-500">
                {quantity} × {formatCurrency(unitPrice)}
              </span>
            </div>

            {renderPrimaryAction()}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Payment:{" "}
            <span className="font-semibold text-slate-700">
              {renderPaymentText()}
            </span>
          </span>

          <span className="text-slate-500">
            Status:{" "}
            <span className="font-semibold text-slate-700">
              {displayStatus}
            </span>
          </span>
        </div>
      </div>
    </>
  );
}
