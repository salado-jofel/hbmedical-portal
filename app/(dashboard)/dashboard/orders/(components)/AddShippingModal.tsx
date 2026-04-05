"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Truck } from "lucide-react";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { addShippingInfo } from "../(services)/actions";
import toast from "react-hot-toast";

interface AddShippingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DashboardOrder;
  onSuccess?: () => void;
}

export function AddShippingModal({
  open,
  onOpenChange,
  order,
  onSuccess,
}: AddShippingModalProps) {
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [shippedAt, setShippedAt] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [estimatedDeliveryAt, setEstimatedDeliveryAt] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!carrier.trim()) {
      toast.error("Carrier is required.");
      return;
    }
    if (!trackingNumber.trim()) {
      toast.error("Tracking number is required.");
      return;
    }

    startTransition(async () => {
      const result = await addShippingInfo(order.id, {
        carrier: carrier.trim(),
        trackingNumber: trackingNumber.trim(),
        shippedAt,
        estimatedDeliveryAt: estimatedDeliveryAt || undefined,
      });

      if (result.success) {
        toast.success("Shipping info saved. Order marked as shipped.");
        handleClose();
        onSuccess?.();
      } else {
        toast.error(result.error ?? "Failed to save shipping info.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-teal-400 via-teal-500 to-cyan-500" />

        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Truck className="w-5 h-5 text-teal-500" />
              Add Shipping Info
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
            <span className="text-slate-500">Order: </span>
            <span className="font-semibold text-slate-800">{order.order_number}</span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Carrier <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. FedEx, UPS, USPS"
                value={carrier}
                onChange={(e) => setCarrier(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-700">
                Tracking Number <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. 1Z999AA10123456784"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Shipped Date
                </label>
                <Input
                  type="date"
                  value={shippedAt}
                  onChange={(e) => setShippedAt(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Est. Delivery
                </label>
                <Input
                  type="date"
                  value={estimatedDeliveryAt}
                  onChange={(e) => setEstimatedDeliveryAt(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl border-slate-200"
              disabled={isPending}
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
              disabled={isPending}
              onClick={handleSubmit}
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 mr-2" />
                  Mark as Shipped
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
