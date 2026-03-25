"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAppDispatch } from "@/store/hooks";
import {
  updateOrderInStore,
  removeOrderFromStore,
} from "../(redux)/orders-slice";
import {
  deleteOrder,
  createStripeCheckoutSession,
  createStripeNet30Invoice,
  shipOrderWithShipStation,
} from "../(services)/actions";

import type { Order } from "@/lib/interfaces/order";
import {
  Trash2,
  Package,
  Building2,
  User,
  Loader2,
  CreditCard,
  CheckCircle2,
  Boxes,
  DollarSign,
  Truck,
  BadgeCheck,
  Clock3,
  FileText,
  RefreshCcw,
  ChevronDown,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderInfoRow } from "./OrderInfoRow";
import { getFulfillmentLabel, mapOrderToBoardStatus } from "./kanban-config";
import toast from "react-hot-toast";
import { formatStatus } from "@/utils/formatter";

function PaymentBadge({
  status,
}: {
  status?: string | null;
}) {
  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Paid
      </span>
    );
  }

  if (status === "invoice_sent") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <FileText className="h-3.5 w-3.5" />
        Invoice Sent
      </span>
    );
  }

  if (status === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
        <Clock3 className="h-3.5 w-3.5" />
        Overdue
      </span>
    );
  }

  if (status === "payment_failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
        <RefreshCcw className="h-3.5 w-3.5" />
        Payment Failed
      </span>
    );
  }

  if ((status as string | null) === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
        <Clock3 className="h-3.5 w-3.5" />
        Pending
      </span>
    );
  }

  if (status === "unpaid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        <Clock3 className="h-3.5 w-3.5" />
        Unpaid
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Clock3 className="h-3.5 w-3.5" />
      Unpaid
    </span>
  );
}

function FulfillmentBadge({
  label,
  delivered,
}: {
  label: string;
  delivered: boolean;
}) {
  if (delivered) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700">
        <BadgeCheck className="h-3.5 w-3.5" />
        Delivered
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
      <Truck className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function ShipStationSyncBadge({
  syncStatus,
}: {
  syncStatus?: string | null;
}) {
  if (!syncStatus) return null;

  const map: Record<string, { text: string; className: string }> = {
    ready: {
      text: "ShipStation Ready",
      className: "bg-sky-100 text-sky-700",
    },
    syncing: {
      text: "ShipStation Syncing",
      className: "bg-amber-100 text-amber-700",
    },
    sent: {
      text: "ShipStation Synced",
      className: "bg-violet-100 text-violet-700",
    },
    failed: {
      text: "ShipStation Failed",
      className: "bg-red-100 text-red-700",
    },
  };

  const display = map[syncStatus] ?? {
    text: formatStatus(syncStatus),
    className: "bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${display.className}`}
    >
      <Truck className="h-3.5 w-3.5" />
      {display.text}
    </span>
  );
}

function getNet30DueMeta(invoiceDueDate?: string | null, nowMs = Date.now()) {
  if (!invoiceDueDate) return null;

  const due = new Date(invoiceDueDate);
  if (Number.isNaN(due.getTime())) return null;

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

export function OrderCard({ order }: { order: Order }) {
  const dispatch = useAppDispatch();
  const boardStatus = mapOrderToBoardStatus(order);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isPayingNow, setIsPayingNow] = useState(false);
  const [isPayingLater, setIsPayingLater] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paymentMenuOpen, setPaymentMenuOpen] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());

  const paymentMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 60_000);

    return () => window.clearInterval(timer);
  }, []);

  const isPaid = order.payment_status === "paid";
  const hasCheckout = Boolean(order.stripe_checkout_url);
  const hasInvoice = Boolean(order.stripe_invoice_hosted_url);
  const isNet30 = order.payment_mode === "net_30";
  const isPayNowMode = order.payment_mode === "pay_now";

  const isDelivered = boardStatus === "Delivered";
  const fulfillmentLabel = getFulfillmentLabel(order);

  const quantity = Number(order.quantity ?? 1);
  const totalAmount = Number(order.amount ?? 0);
  const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount;

  const canSyncToShipStation =
    isPaid || (isNet30 && Boolean(order.stripe_invoice_id));

  const syncing = order.shipstation_sync_status === "syncing";
  const syncSent = order.shipstation_sync_status === "sent";
  const syncFailed = order.shipstation_sync_status === "failed";
  const syncReady =
    order.shipstation_sync_status === "ready" ||
    (!order.shipstation_sync_status && canSyncToShipStation && !syncSent);

  const hasLegacyMockShipment = !!order.shipstation_shipment_id;
  const isLegacyMockCarrier = (order.carrier_code ?? "").startsWith("mock-");
  const shouldHideLegacyShipmentDetails =
    hasLegacyMockShipment || isLegacyMockCarrier;

  const isBusy = isPayingNow || isPayingLater || isFulfilling || isDeleting;

  const net30DueMeta = useMemo(
    () => getNet30DueMeta(order.invoice_due_date, nowMs),
    [order.invoice_due_date, nowMs],
  );

  const shouldShowNet30DueDate =
    isNet30 &&
    !isPaid &&
    !!net30DueMeta &&
    (order.payment_status === "invoice_sent" ||
      order.payment_status === "overdue");

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

  async function handlePayNow() {
    if (!order.id || isPayingNow || isPaid) return;

    setPaymentMenuOpen(false);
    setIsPayingNow(true);

    try {
      const checkoutUrl = await createStripeCheckoutSession(order.id);
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("[handlePayNow]", err);
      toast.error("Failed to start payment. Please try again.");
      setIsPayingNow(false);
    }
  }

  async function handlePayLater() {
    if (!order.id || isPayingLater || isPaid) return;

    setPaymentMenuOpen(false);
    setIsPayingLater(true);

    try {
      const updatedOrder = await createStripeNet30Invoice(order.id);
      dispatch(updateOrderInStore(updatedOrder));
      toast.success("Net 30 invoice created.");

      if (updatedOrder.stripe_invoice_hosted_url) {
        window.open(updatedOrder.stripe_invoice_hosted_url, "_blank");
      }
    } catch (err) {
      console.error("[handlePayLater]", err);
      toast.error("Failed to create Net 30 invoice. Please try again.");
    } finally {
      setIsPayingLater(false);
    }
  }

  async function handleShipStationSync() {
    if (!order.id || isFulfilling || !canSyncToShipStation) return;

    setIsFulfilling(true);

    try {
      const result = await shipOrderWithShipStation(order.id);

      if (result.alreadySynced) {
        toast.success("Order already synced to ShipStation.");
      } else {
        toast.success("Order synced to ShipStation successfully.");
      }
    } catch (err) {
      console.error("[handleShipStationSync]", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to sync order to ShipStation. Please try again.",
      );
    } finally {
      setIsFulfilling(false);
    }
  }

  function renderPrimaryAction() {
    if (!isPaid) {
      if (isNet30 && hasInvoice) {
        return (
          <Link href={order.stripe_invoice_hosted_url!} target="_blank">
            <Button
              type="button"
              size="sm"
              className="h-9 bg-[#15689E] text-white hover:bg-[#0f4f7a] cursor-pointer"
            >
              <FileText className="mr-1 h-4 w-4" />
              View Invoice
            </Button>
          </Link>
        );
      }

      if (isPayNowMode && hasCheckout) {
        return (
          <Button
            type="button"
            size="sm"
            onClick={handlePayNow}
            disabled={isPayingNow}
            className="h-9 bg-[#15689E] text-white hover:bg-[#0f4f7a] cursor-pointer"
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

      return (
        <div className="relative" ref={paymentMenuRef}>
          <Button
            type="button"
            size="sm"
            onClick={() => setPaymentMenuOpen((prev) => !prev)}
            disabled={isBusy}
            className="h-9 bg-[#15689E] text-white hover:bg-[#0f4f7a] cursor-pointer"
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
                onClick={handlePayNow}
                className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Pay Now
              </button>

              <button
                type="button"
                onClick={handlePayLater}
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

    if (syncFailed) {
      return (
        <Button
          type="button"
          size="sm"
          onClick={handleShipStationSync}
          disabled={isFulfilling}
          className="h-9 bg-red-600 text-white hover:bg-red-700 cursor-pointer"
        >
          {isFulfilling ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCcw className="mr-1 h-4 w-4" />
              Retry ShipStation Sync
            </>
          )}
        </Button>
      );
    }

    if (syncing || isFulfilling) {
      return (
        <Button
          type="button"
          size="sm"
          disabled
          className="h-9 bg-amber-600 text-white hover:bg-amber-600"
        >
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          Syncing...
        </Button>
      );
    }

    if (syncReady) {
      return (
        <Button
          type="button"
          size="sm"
          onClick={handleShipStationSync}
          disabled={isFulfilling}
          className="h-9 bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
        >
          <Truck className="mr-1 h-4 w-4" />
          Sync to ShipStation
        </Button>
      );
    }

    if (syncSent) {
      return (
        <Button
          type="button"
          size="sm"
          disabled
          className="h-9 bg-violet-600 text-white hover:bg-violet-600"
        >
          <Truck className="mr-1 h-4 w-4" />
          Synced to ShipStation
        </Button>
      );
    }

    return (
      <Button
        type="button"
        size="sm"
        onClick={handleShipStationSync}
        disabled={!canSyncToShipStation || isFulfilling}
        className="h-9 bg-violet-600 text-white hover:bg-violet-700 cursor-pointer"
      >
        {isFulfilling ? (
          <>
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <Truck className="mr-1 h-4 w-4" />
            Sync to ShipStation
          </>
        )}
      </Button>
    );
  }

  function renderPaymentText() {
    if (order.payment_status === "paid") return "Paid";
    if (order.payment_status === "invoice_sent") return "Invoice Sent";
    if (order.payment_status === "overdue") return "Overdue";
    if (order.payment_status === "payment_failed") return "Payment Failed";
    if ((order.payment_status as string | null) === "pending") return "Pending";
    if (order.payment_status === "unpaid") return "Unpaid";
    return "Unpaid";
  }

  const displayStatus =
    shouldHideLegacyShipmentDetails && order.status === "Shipped"
      ? "Processing"
      : order.status ?? "Processing";

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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#15689E]">
              Order
            </p>
            <h3 className="text-sm font-bold text-slate-800">
              {order.order_id}
            </h3>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setConfirmOpen(true)}
            disabled={isDeleting}
            className="h-7 w-7 text-slate-300 hover:bg-red-50 hover:text-red-500 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PaymentBadge status={order.payment_status} />
          <FulfillmentBadge label={fulfillmentLabel} delivered={isDelivered} />
          {/* <ShipStationSyncBadge syncStatus={order.shipstation_sync_status} /> */}
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

          {order.created_by_email && (
            <OrderInfoRow icon={User} text={order.created_by_email} />
          )}

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
                  ${unitPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {shouldShowNet30DueDate && net30DueMeta && (
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
          )}

          {order.tracking_number && !shouldHideLegacyShipmentDetails && (
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

              {order.carrier_code ? (
                <p className="mt-1 text-xs text-blue-600">
                  Carrier: {order.carrier_code}
                </p>
              ) : null}

              {order.shipstation_label_url ? (
                <Link
                  href={order.shipstation_label_url}
                  target="_blank"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 underline underline-offset-2"
                >
                  <FileText className="h-3.5 w-3.5" />
                  View Label
                </Link>
              ) : null}
            </div>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
          <div className="flex items-end justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                Total Amount
              </span>
              <span className="mt-1 text-xl font-bold text-slate-800">
                ${totalAmount.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500">
                {quantity} × ${unitPrice.toFixed(2)}
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
