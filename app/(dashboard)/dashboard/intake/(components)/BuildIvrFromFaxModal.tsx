"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
// Raw Radix primitives — same rationale as IntakeDetailModal: shadcn's
// shared DialogContent bakes `sm:max-w-sm` into a media query className
// can't override, and we need full-viewport sizing so the fax preview
// + form both fit comfortably side by side.
import { Dialog as RadixDialog } from "radix-ui";
import {
  DialogPortal,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, X, ArrowRight } from "lucide-react";
import { getIntakeSignedUrl } from "../(services)/actions";
import {
  extractIvrFieldsFromFax,
  type ExtractedIvrFields,
} from "../(services)/ivr-extract-actions";
import { createStandaloneIvrFromFax } from "../../ivrs/(services)/actions";
import {
  StandaloneIvrForm,
  emptyStandaloneIvrForm,
  mergeAiExtract,
  type StandaloneIvrFormValue,
} from "../../ivrs/(components)/StandaloneIvrForm";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";
import type { IIntakeDocument } from "@/utils/interfaces/intake";

interface BuildIvrFromFaxModalProps {
  intake: IIntakeDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  facilities: Array<{ id: string; name: string }>;
  /** Fired after the IVR has been created + intake flipped, so the
   *  parent can close its own detail modal / refresh the list. */
  onCreated?: () => void;
}

/**
 * "Build IVR from this fax" — side-by-side triage modal.
 *
 *   Left  (~60%): fax PDF iframe via a short-TTL signed URL.
 *   Right (~40%): the shared StandaloneIvrForm — visually identical to
 *                 the IVR form in an order — pre-filled by the AWS
 *                 Bedrock extractor. User has the final edit before
 *                 saving.
 *
 * Save IS the approval step — no external approver is assigned; the
 * created IVR lands with status='approved' and shows up on
 * /dashboard/ivrs, ready to be converted into an order.
 */
export function BuildIvrFromFaxModal({
  intake,
  open,
  onOpenChange,
  facilities,
  onCreated,
}: BuildIvrFromFaxModalProps) {
  const router = useRouter();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  // Facility must be picked because RLS keys off it and admin/support
  // triaging the fax don't belong to a facility of their own.
  const [facilityId, setFacilityId] = useState<string>("");
  // Full IVR form state — mirrors IStandaloneIvrForm + the top-level
  // metadata columns bundled in the same value bag.
  const [form, setForm] = useState<StandaloneIvrFormValue>(
    emptyStandaloneIvrForm(),
  );

  const [extracting, setExtracting] = useState(false);
  const [autofilled, setAutofilled] = useState(false);
  const [saving, startSave] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  // Auto-pick facility when there's only one available.
  useEffect(() => {
    if (open && facilities.length === 1 && !facilityId) {
      setFacilityId(facilities[0].id);
    }
  }, [open, facilities, facilityId]);

  // Reset form each time the modal opens against a fresh intake so
  // previous typing doesn't bleed through.
  useEffect(() => {
    if (!open) return;
    setForm(emptyStandaloneIvrForm());
    setAutofilled(false);
    setSubmitted(false);
    if (!facilities.length || facilities.length !== 1) setFacilityId("");
  }, [open, intake?.id, facilities]);

  // Signed URL for the fax preview.
  useEffect(() => {
    if (!open || !intake) {
      setSignedUrl(null);
      return;
    }
    let cancelled = false;
    getIntakeSignedUrl(intake.filePath).then((res) => {
      if (!cancelled) setSignedUrl(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [open, intake]);

  async function runExtract() {
    if (!intake) return;
    setExtracting(true);
    try {
      const res = await extractIvrFieldsFromFax(intake.id);
      if (!res.success) {
        toast.error(res.error ?? "Auto-fill failed.");
        return;
      }
      setForm((prev) =>
        mergeAiExtract(prev, extractedToFormPatch(res.fields)),
      );
      setAutofilled(true);
      toast.success("Fields pre-filled — review before saving.");
    } finally {
      setExtracting(false);
    }
  }

  function handleFormChange(patch: Partial<StandaloneIvrFormValue>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSave() {
    if (!intake) return;
    setSubmitted(true);
    if (!facilityId) {
      toast.error("Pick which clinic this IVR belongs to.");
      return;
    }
    startSave(async () => {
      // Split top-level metadata from the rich-form bag — the server
      // action wants them separately so it can validate + trim the
      // required-ish top-levels.
      const { patientName, patientDob, physicianName, physicianNpi, productSummary, ...formOnly } =
        form;
      const res = await createStandaloneIvrFromFax({
        intakeId: intake.id,
        facilityId,
        patientName: patientName ?? null,
        patientDob: patientDob ?? null,
        physicianName: physicianName ?? null,
        physicianNpi: physicianNpi ?? null,
        productSummary: productSummary ?? null,
        form: formOnly,
        aiExtracted: autofilled,
      });
      if (!res.success) {
        toast.error(res.error ?? "Failed to build the IVR.");
        return;
      }
      toast.success("IVR built and approved. Ready to convert to an order.");
      onOpenChange(false);
      onCreated?.();
      router.push("/dashboard/ivrs");
    });
  }

  const facilityMissing = submitted && !facilityId;
  const busy = extracting || saving;

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(next) => !next && !busy && onOpenChange(false)}
    >
      <DialogPortal>
        <DialogOverlay />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 outline-none"
        >
          <DialogTitle className="sr-only">Build IVR from Fax</DialogTitle>

          <div className="bg-white w-[97vw] max-w-[1600px] h-[94vh] max-h-[calc(100vh-2rem)] rounded-[14px] shadow-xl border border-[var(--border)] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-[#eee] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-semibold">
                  Build IVR from Fax
                </h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-green-50 text-green-700 border-green-200">
                  Save = Approve
                </span>
              </div>
              <button
                type="button"
                onClick={() => !busy && onOpenChange(false)}
                className="w-8 h-8 rounded-[7px] hover:bg-[var(--bg)] transition-colors flex items-center justify-center disabled:opacity-40"
                aria-label="Close"
                disabled={busy}
              >
                <X className="w-4 h-4 text-[var(--text2)]" />
              </button>
            </div>

            {!intake ? (
              <div className="flex-1 flex items-center justify-center text-[var(--text3)]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading…
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 flex-1 min-h-0">
                {/* ── Fax preview (left) ── */}
                <div className="border-b md:border-b-0 md:border-r border-[#eee] bg-[#f9fafb] min-h-[400px] md:min-h-0 flex flex-col">
                  {signedUrl ? (
                    <iframe
                      src={signedUrl}
                      title={intake.fileName ?? "Fax"}
                      className="w-full h-full min-h-[500px] md:min-h-0"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-[var(--text3)]">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Loading preview…
                    </div>
                  )}
                </div>

                {/* ── IVR form (right) ── */}
                <div className="p-4 space-y-3 overflow-y-auto min-h-0">
                  {/* Facility picker + AI CTA sit above the paper form
                      as the two "meta" controls the form itself doesn't
                      capture. Everything else is inside StandaloneIvrForm. */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                    <div>
                      <label className="text-[11.5px] font-semibold text-[#374151] block mb-1">
                        Clinic / Facility{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={facilityId}
                        onChange={(e) => setFacilityId(e.target.value)}
                        className={cn(
                          "w-full h-9 px-2 border rounded-md text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]",
                          facilityMissing
                            ? "border-red-300 bg-red-50"
                            : "border-[#d1d5db]",
                        )}
                        disabled={busy}
                      >
                        <option value="">— Select the clinic —</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1.5"
                      onClick={runExtract}
                      disabled={busy}
                    >
                      {extracting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Reading fax…
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          {autofilled ? "Re-extract" : "Auto-fill with AI"}
                        </>
                      )}
                    </Button>
                  </div>
                  {facilityMissing && (
                    <p className="text-[11px] text-red-500">
                      Pick which clinic this fax is for.
                    </p>
                  )}
                  {facilities.length === 0 && (
                    <p className="text-[11px] text-amber-600">
                      No clinics available. Add a facility first.
                    </p>
                  )}

                  {/* The paper IVR form. Sits inside a padded container
                      so the sectioned white-paper look doesn't run to
                      the modal edge. */}
                  <div className="rounded-md border border-[#e5e7eb] overflow-hidden">
                    <StandaloneIvrForm
                      value={form}
                      onChange={handleFormChange}
                      disabled={busy}
                      highlightEmpty={autofilled}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#eee] bg-[#fafafa] shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => !busy && onOpenChange(false)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={busy || !intake}
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Save &amp; Approve
                  </>
                )}
              </Button>
            </div>
          </div>
        </RadixDialog.Content>
      </DialogPortal>
    </RadixDialog.Root>
  );
}

/**
 * Map the extractor's flat DTO onto a StandaloneIvrFormValue patch. The
 * extractor's field names are the SAME as the form's, so this is largely
 * an identity function — kept explicit so a future extractor rename
 * doesn't silently drop fields.
 */
function extractedToFormPatch(
  e: ExtractedIvrFields,
): Partial<StandaloneIvrFormValue> {
  return {
    patientName: e.patientName,
    patientDob: e.patientDob,
    physicianName: e.physicianName,
    physicianNpi: e.physicianNpi,
    productSummary: e.productSummary,
    salesRepName: e.salesRepName,
    placeOfService: e.placeOfService,
    medicareAdminContractor: e.medicareAdminContractor,
    facilityName: e.facilityName,
    facilityAddress: e.facilityAddress,
    facilityContact: e.facilityContact,
    facilityPhone: e.facilityPhone,
    facilityFax: e.facilityFax,
    facilityNpi: e.facilityNpi,
    facilityTin: e.facilityTin,
    facilityPtan: e.facilityPtan,
    physicianPhone: e.physicianPhone,
    physicianFax: e.physicianFax,
    physicianAddress: e.physicianAddress,
    physicianTin: e.physicianTin,
    patientPhone: e.patientPhone,
    patientAddress: e.patientAddress,
    insuranceProvider: e.insuranceProvider,
    insurancePhone: e.insurancePhone,
    memberId: e.memberId,
    groupNumber: e.groupNumber,
    planName: e.planName,
    planType: e.planType,
    subscriberName: e.subscriberName,
    subscriberDob: e.subscriberDob,
    subscriberRelationship: e.subscriberRelationship,
    secondaryInsuranceProvider: e.secondaryInsuranceProvider,
    secondaryInsurancePhone: e.secondaryInsurancePhone,
    secondarySubscriberName: e.secondarySubscriberName,
    secondaryPolicyNumber: e.secondaryPolicyNumber,
    secondarySubscriberDob: e.secondarySubscriberDob,
    secondaryPlanType: e.secondaryPlanType,
    secondaryGroupNumber: e.secondaryGroupNumber,
    secondarySubscriberRelationship: e.secondarySubscriberRelationship,
    woundType: e.woundType,
    woundSizes: e.woundSizes,
    applicationCpts: e.applicationCpts,
    dateOfProcedure: e.dateOfProcedure,
    icd10Codes: e.icd10Codes,
    productInformation: e.productInformation,
  };
}
