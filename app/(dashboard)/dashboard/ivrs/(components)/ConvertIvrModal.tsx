"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowRight } from "lucide-react";
import { WOUND_TYPES } from "@/utils/constants/orders";
import { useAppDispatch } from "@/store/hooks";
import { updateIvrInStore } from "../(redux)/ivrs-slice";
import { convertIvrToOrder, getStandaloneIvrById } from "../(services)/actions";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";

interface ConvertIvrModalProps {
  open: boolean;
  ivrId: string | null;
  patientName: string;
  onClose: () => void;
}

/**
 * Confirms conversion of an approved IVR into a new draft order. Captures
 * the one piece of info the standalone IVR doesn't already have —
 * wound_type — and stamps date_of_service (default today). Everything
 * else carries over from the IVR.
 */
export function ConvertIvrModal({
  open,
  ivrId,
  patientName,
  onClose,
}: ConvertIvrModalProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [woundType, setWoundType] = useState<
    "chronic" | "post_surgical" | "dfu" | "vlu"
  >("chronic");
  const [dateOfService, setDateOfService] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [pending, startTransition] = useTransition();

  function reset() {
    setWoundType("chronic");
    setDateOfService(new Date().toISOString().split("T")[0]);
  }

  function handleClose() {
    if (pending) return;
    reset();
    onClose();
  }

  function handleConfirm() {
    if (!ivrId) return;
    startTransition(async () => {
      const res = await convertIvrToOrder({
        ivrId,
        woundType,
        dateOfService,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to convert IVR.");
        return;
      }
      // Refresh the source IVR so its status flips to "converted" in the
      // list without a full page reload.
      const refreshed = await getStandaloneIvrById(ivrId);
      if (refreshed) dispatch(updateIvrInStore(refreshed));
      toast.success("Order created. Opening it now…");
      handleClose();
      if (res.orderId) {
        router.push(`/dashboard/orders?open=${res.orderId}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold">
            Create Order from Approved IVR
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5 text-[12px] text-blue-900">
            A new draft order will be created for{" "}
            <span className="font-semibold">{patientName}</span>, seeded with
            the IVR's patient, physician, and facility info. The approved IVR
            document will be attached to the order.
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#374151] block mb-2">
              Wound Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {WOUND_TYPES.map((wt) => (
                <button
                  key={wt.value}
                  type="button"
                  onClick={() => setWoundType(wt.value)}
                  disabled={pending}
                  className={cn(
                    "py-2 px-3 rounded-lg border-2 text-[13px] font-medium transition-all",
                    woundType === wt.value
                      ? "border-[var(--navy)] bg-blue-50 text-[var(--navy)]"
                      : "border-slate-200 text-slate-600 hover:border-slate-300",
                  )}
                >
                  {wt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[#374151] block mb-1">
              Date of Service <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              value={dateOfService}
              onChange={(e) => setDateOfService(e.target.value)}
              disabled={pending}
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#eee] bg-[#fafafa]">
          <Button variant="outline" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={pending || !dateOfService}
            className="gap-1.5"
          >
            {pending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Create Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
