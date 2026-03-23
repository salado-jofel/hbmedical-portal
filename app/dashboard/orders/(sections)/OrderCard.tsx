"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppDispatch } from "@/store/hooks";
import { removeOrderFromStore } from "../(redux)/orders-slice";
import {
  deleteOrder,
  createStripeCheckoutSession,
  shipOrderWithShipStation,
} from "../(services)/actions";
import type { Order } from "@/app/(interfaces)/order";
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
  MapPin,
  FileText,
  RefreshCcw,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { OrderInfoRow } from "./OrderInfoRow";
import { getFulfillmentLabel } from "./kanban-config";
import toast from "react-hot-toast";

function PaymentBadge({
  paymentStatus,
}: {
  paymentStatus?: string | null;
}) {
  switch (paymentStatus) {
    case "paid":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Paid
        </span>
      );

    case "pending":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
          <Clock3 className="h-3.5 w-3.5" />
          Pending
        </span>
      );

    case "invoice_sent":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
          <FileText className="h-3.5 w-3.5" />
          Invoice Sent
        </span>
      );

    case "overdue":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Overdue
        </span>
      );

    case "payment_failed":
    case "failed":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
          <RefreshCcw className="h-3.5 w-3.5" />
          Payment Failed
        </span>
      );

    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          <Clock3 className="h-3.5 w-3.5" />
          Unpaid
        </span>
      );
  }
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
    text: syncStatus,
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

export function OrderCard({ order }: { order: Order }) {
  const dispatch = useAppDispatch();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isFulfilling, setIsFulfilling] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isPaid = order.payment_status === "paid";
  const isDelivered = order.status === "Delivered";
  const fulfillmentLabel = getFulfillmentLabel(order);

  const quantity = Number(order.quantity ?? 1);
  const totalAmount = Number(order.amount ?? 0);
  const unitPrice = quantity > 0 ? totalAmount / quantity : totalAmount;

  const hasMockShipment = !!order.shipstation_shipment_id;
  const syncFailed = order.shipstation_sync_status === "failed";
  const syncReady =
    order.shipstation_sync_status === "ready" ||
    (!order.shipstation_sync_status && isPaid && !hasMockShipment);

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
    if (!order.id || isPaying || isPaid) return;

    setIsPaying(true);
    try {
      const checkoutUrl = await createStripeCheckoutSession(order.id);
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("[handlePayNow]", err);
      toast.error("Failed to start payment. Please try again.");
      setIsPaying(false);
    }
  }

  async function handleMockShipStationSync() {
    if (!order.id || isFulfilling || !isPaid) return;

    setIsFulfilling(true);

    try {
      const result = await shipOrderWithShipStation(order.id);

      if (result.alreadyShipped) {
        toast.success(
          `Existing mock shipment loaded: ${result.carrierCode} • ${result.trackingNumber}`,
        );
      } else {
        toast.success(
          `Mock shipment synced: ${result.carrierCode} • ${result.trackingNumber}`,
        );
      }
    } catch (err) {
      console.error("[handleMockShipStationSync]", err);
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to sync mock ShipStation shipment. Please try again.",
      );
    } finally {
      setIsFulfilling(false);
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
            className="h-7 w-7 cursor-pointer text-slate-300 hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <PaymentBadge paymentStatus={order.payment_status} />
          <FulfillmentBadge label={fulfillmentLabel} delivered={isDelivered} />
          <ShipStationSyncBadge syncStatus={order.shipstation_sync_status} />
        </div>

        <div className="mt-4 space-y-2">
          <OrderInfoRow
            icon={Package}
            text={`Product: ${order.product_name ?? "—"}`}
            primary
          />

          <OrderInfoRow
            icon={Building2}
            text={`Facility: ${order.facility_name ?? "—"}`}
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

          {order.tracking_number && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-500">
                Tracking
              </p>
              <div className="mt-1 flex items-center gap-2 text-blue-800">
                <MapPin className="h-4 w-4" />
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
                  View Mock Label
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

            {!isPaid ? (
              <Button
                type="button"
                size="sm"
                onClick={handlePayNow}
                disabled={isPaying}
                className="h-9 cursor-pointer bg-[#15689E] text-white hover:bg-[#0f4f7a]"
              >
                {isPaying ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Redirecting...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-1 h-4 w-4" />
                    {order.payment_status === "pending"
                      ? "Resume Payment"
                      : "Pay Now"}
                  </>
                )}
              </Button>
            ) : syncFailed ? (
              <Button
                type="button"
                size="sm"
                onClick={handleMockShipStationSync}
                disabled={isFulfilling}
                className="h-9 cursor-pointer bg-red-600 text-white hover:bg-red-700"
              >
                {isFulfilling ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="mr-1 h-4 w-4" />
                    Retry Mock Sync
                  </>
                )}
              </Button>
            ) : syncReady ? (
              <Button
                type="button"
                size="sm"
                onClick={handleMockShipStationSync}
                disabled={isFulfilling}
                className="h-9 cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {isFulfilling ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <Truck className="mr-1 h-4 w-4" />
                    Sync Mock Shipment
                  </>
                )}
              </Button>
            ) : hasMockShipment && order.shipstation_label_url ? (
              <Link href={order.shipstation_label_url} target="_blank">
                <Button
                  type="button"
                  size="sm"
                  className="h-9 cursor-pointer bg-violet-600 text-white hover:bg-violet-700"
                >
                  <FileText className="mr-1 h-4 w-4" />
                  View Mock Shipment
                </Button>
              </Link>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleMockShipStationSync}
                disabled={isFulfilling}
                className="h-9 cursor-pointer bg-violet-600 text-white hover:bg-violet-700"
              >
                {isFulfilling ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Truck className="mr-1 h-4 w-4" />
                    View Mock Shipment
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Payment:{" "}
            <span className="font-semibold text-slate-700">
              {order.payment_status ?? "unpaid"}
            </span>
          </span>

          <span className="text-slate-500">
            Status:{" "}
            <span className="font-semibold text-slate-700">
              {order.status ?? "Processing"}
            </span>
          </span>
        </div>
      </div>
    </>
  );
}
