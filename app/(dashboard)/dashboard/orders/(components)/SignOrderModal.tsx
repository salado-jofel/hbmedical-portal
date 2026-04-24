"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, PenLine, ArrowLeft } from "lucide-react";
import { cn } from "@/utils/utils";
import { signOrder } from "../(services)/order-workflow-actions";
import {
  SpecimenSignaturePad,
  type SpecimenSignaturePadHandle,
} from "@/app/(components)/SpecimenSignaturePad";
import toast from "react-hot-toast";

interface SignOrderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_number?: string | null;
    patient_full_name?: string | null;
    wound_type?: string | null;
    date_of_service?: string | null;
  };
  providerName: string;
  /**
   * Fires after the PIN verifies. Receives both the specimen signature PNG
   * and the (validated) PIN so the parent can stash them in local "pending"
   * state and commit them later when the user clicks Save on the form.
   */
  onSuccess?: (signatureImage: string, pin: string) => void;
  /**
   * Override the verification action. Should PIN-check only — no DB writes.
   * If omitted, calls `signOrder(orderId, pin)` (legacy commit-on-submit
   * behavior for callers that still want that).
   */
  onSign?: (
    pin: string,
    signatureImage: string,
  ) => Promise<{ success: boolean; error?: string; noPinSet?: boolean }>;
  /** Override the modal title. Defaults to "Sign Order". */
  title?: string;
  /** Override the success toast message. */
  successMessage?: string;
}

type Phase = "signature" | "pin";

export function SignOrderModal({
  open,
  onOpenChange,
  order,
  providerName,
  onSuccess,
  onSign,
  title: titleProp,
  successMessage,
}: SignOrderModalProps) {
  const [phase, setPhase] = useState<Phase>("signature");
  const [hasSignature, setHasSignature] = useState(false);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noPinSet, setNoPinSet] = useState(false);
  const [isPending, startTransition] = useTransition();
  const padRef = useRef<SpecimenSignaturePadHandle>(null);

  // Reset everything when reopened so the provider starts fresh per doc.
  useEffect(() => {
    if (open) {
      setPhase("signature");
      setHasSignature(false);
      setSignatureImage(null);
      setPin("");
      setError(null);
      setNoPinSet(false);
      padRef.current?.clear();
    }
  }, [open]);

  function handleClose() {
    if (isPending) return;
    onOpenChange(false);
  }

  function handleContinue() {
    const dataUrl = padRef.current?.getDataUrl();
    if (!dataUrl) {
      toast.error("Please provide your signature first.");
      return;
    }
    setSignatureImage(dataUrl);
    setPhase("pin");
  }

  function handleBack() {
    if (isPending) return;
    setPhase("signature");
    setError(null);
    setNoPinSet(false);
    setPin("");
  }

  function handleSubmit() {
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    if (!signatureImage) {
      // Shouldn't happen — phase gate prevents this — but be defensive.
      setPhase("signature");
      return;
    }

    const capturedSig = signatureImage;
    startTransition(async () => {
      const action =
        onSign ??
        // Legacy fallback — caller didn't wire a sign-with-signature
        // handler, so we fall back to the old PIN-only path and drop the
        // captured signature on the floor.
        ((p: string, _img: string) => signOrder(order.id, p));
      const trimmedPin = pin.trim();
      const result = await action(trimmedPin, capturedSig);
      if (result.success) {
        toast.success(successMessage ?? "Signature ready. Click Save to commit.");
        onSuccess?.(capturedSig, trimmedPin);
        onOpenChange(false);
      } else if (result.noPinSet) {
        setNoPinSet(true);
        setError(null);
      } else {
        setError(result.error ?? "Failed to sign order.");
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
              {titleProp ?? "Sign Order"}
            </DialogTitle>
          </DialogHeader>

          {/* Order summary — shown on both phases for context */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Order</span>
              <span className="font-semibold text-slate-800">
                {order.order_number}
              </span>
            </div>
            {order.patient_full_name && (
              <div className="flex justify-between">
                <span className="text-slate-500">Patient</span>
                <span className="font-semibold text-slate-800">
                  {order.patient_full_name}
                </span>
              </div>
            )}
            {order.date_of_service && (
              <div className="flex justify-between">
                <span className="text-slate-500">Date of Service</span>
                <span className="font-semibold text-slate-800">
                  {order.date_of_service}
                </span>
              </div>
            )}
          </div>

          <div className="text-sm text-slate-600 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
            Signing as:{" "}
            <span className="font-semibold text-blue-700">{providerName}</span>
          </div>

          {/* Phase indicator — two dots */}
          <div className="flex items-center justify-center gap-2">
            <span
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                phase === "signature" ? "bg-blue-600" : "bg-blue-200",
              )}
            />
            <span
              className={cn(
                "h-1.5 w-8 rounded-full transition-colors",
                phase === "pin" ? "bg-blue-600" : "bg-blue-200",
              )}
            />
          </div>

          {/* ── Phase 1: specimen signature ── */}
          {phase === "signature" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                Your signature will be stamped onto the document at today&apos;s
                date.
              </p>
              <SpecimenSignaturePad
                ref={padRef}
                defaultName={providerName}
                onDirtyChange={setHasSignature}
              />
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl border-slate-200"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={!hasSignature}
                  onClick={handleContinue}
                >
                  Continue to PIN
                </Button>
              </div>
            </div>
          )}

          {/* ── Phase 2: PIN ── */}
          {phase === "pin" && (
            <div className="space-y-3">
              {signatureImage && (
                <div className="rounded-md border border-slate-200 bg-white p-2 flex items-center justify-center h-16 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signatureImage}
                    alt="Your signature"
                    className="max-h-12 object-contain"
                  />
                </div>
              )}
              {noPinSet ? (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      No PIN configured
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Please set up your provider PIN in your profile settings
                      before signing orders.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">
                    Enter your provider PIN
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSubmit();
                    }}
                    disabled={isPending}
                    maxLength={4}
                    autoFocus
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-center tracking-[0.5em] text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50"
                  />
                  <div className="flex gap-2 justify-center">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-3 h-3 rounded-full border-2 transition-all duration-150",
                          pin.length > i
                            ? "bg-blue-600 border-blue-600"
                            : "border-slate-300",
                        )}
                      />
                    ))}
                  </div>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 rounded-xl border-slate-200"
                  disabled={isPending}
                  onClick={handleBack}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                {!noPinSet && (
                  <Button
                    type="button"
                    className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isPending || pin.length !== 4}
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
                        Sign
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
