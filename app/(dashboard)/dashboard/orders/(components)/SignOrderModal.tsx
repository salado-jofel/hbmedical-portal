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
import { Loader2, AlertTriangle, PenLine } from "lucide-react";
import type { DashboardOrder } from "@/utils/interfaces/orders";
import { signOrder } from "../(services)/actions";
import toast from "react-hot-toast";

interface SignOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: DashboardOrder;
  providerName: string;
  onSuccess?: () => void;
}

export function SignOrderModal({
  open,
  onOpenChange,
  order,
  providerName,
  onSuccess,
}: SignOrderModalProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noPinSet, setNoPinSet] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    if (isPending) return;
    setPin("");
    setError(null);
    setNoPinSet(false);
    onOpenChange(false);
  }

  function handleSubmit() {
    if (!pin.trim()) {
      setError("Please enter your PIN.");
      return;
    }

    startTransition(async () => {
      const result = await signOrder(order.id, pin.trim());
      if (result.success) {
        toast.success("Order signed successfully.");
        handleClose();
        onSuccess?.();
      } else {
        if (result.noPinSet) {
          setNoPinSet(true);
          setError(null);
        } else {
          setError(result.error ?? "Failed to sign order.");
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md rounded-2xl border-0 shadow-2xl p-0 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-blue-500 to-indigo-500" />

        <div className="p-6 space-y-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <PenLine className="w-5 h-5 text-blue-500" />
              Sign Order
            </DialogTitle>
          </DialogHeader>

          {/* Order summary */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Order</span>
              <span className="font-semibold text-slate-800">{order.order_number}</span>
            </div>
            {order.patient_full_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-semibold text-slate-800">{order.patient_full_name}</span>
              </div>
            )}
            {order.wound_type && (
              <div className="flex justify-between">
                <span className="text-slate-500">Wound Type</span>
                <span className="font-semibold text-slate-800 capitalize">
                  {order.wound_type.replace("_", " ")}
                </span>
              </div>
            )}
            {order.date_of_service && (
              <div className="flex justify-between">
                <span className="text-slate-500">Date of Service</span>
                <span className="font-semibold text-slate-800">{order.date_of_service}</span>
              </div>
            )}
          </div>

          <div className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            Signing as: <span className="font-semibold text-blue-700">{providerName}</span>
          </div>

          {noPinSet ? (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">No PIN configured</p>
                <p className="text-xs text-amber-700 mt-1">
                  Please set up your provider PIN in your profile settings before signing orders.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">
                Enter your provider PIN
              </label>
              <Input
                type="password"
                placeholder="••••••"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                disabled={isPending}
                className="text-center tracking-widest text-lg"
                maxLength={10}
              />
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
            </div>
          )}

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
            {!noPinSet && (
              <Button
                type="button"
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isPending || !pin}
                onClick={handleSubmit}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing...
                  </>
                ) : (
                  <>
                    <PenLine className="w-4 h-4 mr-2" />
                    Sign Order
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
