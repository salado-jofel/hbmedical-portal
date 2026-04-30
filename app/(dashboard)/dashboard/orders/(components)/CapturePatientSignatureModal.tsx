"use client";

import { useRef, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import {
  SpecimenSignaturePad,
  type SpecimenSignaturePadHandle,
} from "@/app/(components)/SpecimenSignaturePad";
import { captureInvoicePatientSignature } from "../(services)/order-delivery-invoice-actions";
import type { IDeliveryInvoice, SignerRelationship } from "@/utils/interfaces/orders";

interface CapturePatientSignatureModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  clinicName: string;
  patientName: string | null;
  /** Fires after the signature is committed to the DB. */
  onCaptured?: (invoice: IDeliveryInvoice) => void;
}

const RELATIONSHIP_OPTIONS: { value: SignerRelationship; label: string }[] = [
  { value: "spouse_relative", label: "Spouse / Relative" },
  { value: "caregiver",       label: "Caregiver" },
  { value: "other",           label: "Other" },
];

/**
 * Patient proof-of-delivery capture. Provider opens this at hand-off, hands
 * the device to the patient (or the caregiver signing for them), and the
 * signature is written server-side + stamped onto the generated invoice.
 *
 * Fields:
 *   - acknowledgement text (uses the clinic's name dynamically)
 *   - signature pad (type / draw / upload via SpecimenSignaturePad)
 *   - "I am not the patient" toggle → reveals relationship + signer name + reason
 */
export function CapturePatientSignatureModal({
  open,
  onOpenChange,
  orderId,
  clinicName,
  patientName,
  onCaptured,
}: CapturePatientSignatureModalProps) {
  const padRef = useRef<SpecimenSignaturePadHandle | null>(null);
  const [padHasContent, setPadHasContent] = useState(false);

  const [isCaregiver, setIsCaregiver] = useState(false);
  const [relationship, setRelationship] = useState<SignerRelationship>("spouse_relative");
  const [signerName, setSignerName] = useState("");
  const [signerReason, setSignerReason] = useState("");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setIsCaregiver(false);
    setRelationship("spouse_relative");
    setSignerName("");
    setSignerReason("");
    setPadHasContent(false);
    setError(null);
    padRef.current?.clear();
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function handleConfirm() {
    setError(null);

    const dataUrl = padRef.current?.getDataUrl() ?? null;
    if (!dataUrl) {
      setError("Please capture a signature before confirming.");
      return;
    }

    if (isCaregiver && !signerName.trim()) {
      setError("Printed name of the signer is required when a caregiver signs.");
      return;
    }

    startTransition(async () => {
      const res = await captureInvoicePatientSignature(orderId, {
        signatureImage: dataUrl,
        relationship:   isCaregiver ? relationship : null,
        signerName:     isCaregiver ? signerName.trim() : null,
        signerReason:   isCaregiver && signerReason.trim() ? signerReason.trim() : null,
      });

      if (!res.success || !res.invoice) {
        setError(res.error ?? "Failed to save signature.");
        return;
      }
      toast.success("Patient signature captured.");
      onCaptured?.(res.invoice);
      reset();
      onOpenChange(false);

      // Kick PDF regen from the client so the right-side Invoice doc card
      // can flip to its blue "Generating…" state via the pdf-regenerating
      // CustomEvent pattern (same as OrderFormDocument / InvoiceDocument).
      // Fire-and-forget.
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "delivery_invoice", status: "start" },
        }),
      );
      fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, formType: "delivery_invoice" }),
      })
        .catch((err) =>
          console.error("[CapturePatientSignature] PDF regen failed:", err),
        )
        .finally(() => {
          window.dispatchEvent(
            new CustomEvent("pdf-regenerating", {
              detail: { type: "delivery_invoice", status: "done" },
            }),
          );
        });
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold">
            Capture Patient Signature
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Legal acknowledgement — uses the clinic name dynamically so each
              clinic's invoice reads with its own name (client requirement). */}
          <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2.5">
            <p className="text-[12px] leading-snug text-[#0f2d4a]">
              By signing below, I acknowledge receipt of the products listed on
              the invoice from{" "}
              <span className="font-semibold">{clinicName || "the supplier"}</span>{" "}
              in good condition.
              {patientName ? (
                <>
                  {" "}(Patient: <span className="font-medium">{patientName}</span>)
                </>
              ) : null}
            </p>
          </div>

          <SpecimenSignaturePad
            ref={padRef}
            defaultName={patientName ?? ""}
            onDirtyChange={setPadHasContent}
            padHeightClass="h-48"
          />

          {/* Caregiver toggle + conditional fields */}
          <div className="rounded-md border border-[#eee] p-3 bg-white">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCaregiver}
                onChange={(e) => setIsCaregiver(e.target.checked)}
                className="w-4 h-4 accent-[#0f2d4a]"
              />
              <span className="text-[12px] font-medium text-[#222]">
                I am signing on behalf of the patient
              </span>
            </label>

            {isCaregiver && (
              <div className="mt-3 space-y-2.5">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#555] mb-1">
                    Relationship
                  </div>
                  <div className="flex gap-4">
                    {RELATIONSHIP_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className="inline-flex items-center gap-1.5 cursor-pointer text-[12px]"
                      >
                        <input
                          type="radio"
                          name="relationship"
                          value={opt.value}
                          checked={relationship === opt.value}
                          onChange={() => setRelationship(opt.value)}
                          className="accent-[#0f2d4a]"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#555] mb-1">
                    Printed Name of Signer
                    <span className="text-red-500 ml-1">*</span>
                  </div>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full text-[13px] border border-[#ccc] rounded-md px-2 py-1.5 outline-none focus:border-[#0f2d4a]"
                  />
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#555] mb-1">
                    Reason (optional)
                  </div>
                  <input
                    type="text"
                    value={signerReason}
                    onChange={(e) => setSignerReason(e.target.value)}
                    placeholder="e.g. patient hospitalized"
                    className="w-full text-[13px] border border-[#ccc] rounded-md px-2 py-1.5 outline-none focus:border-[#0f2d4a]"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#eee] flex items-center justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!padHasContent || isPending}
            className="bg-[#0f2d4a] hover:bg-[#163b5f] text-white"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Saving...
              </>
            ) : (
              "Confirm Signature"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
