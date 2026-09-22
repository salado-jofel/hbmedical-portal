"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import type { RepWithFacility } from "@/utils/interfaces/onboarding";
import {
  EMPTY_MANUAL_ONBOARDING_FORM,
  type ManualFormPatch,
  type ManualOnboardingForm,
  type ManualOnboardingResult,
} from "@/utils/interfaces/manual-onboarding";
import { MANUAL_ONBOARDING_STEPS, OFFLINE_CONTRACTS } from "@/utils/constants/manual-onboarding";
import { manualOnboardProvider } from "@/app/(dashboard)/dashboard/onboarding/(services)/manual-onboarding-actions";
import { validateManualStep, normalizeServerFieldErrors } from "@/utils/helpers/manual-onboarding";
import { WizardStepper } from "../(components)/WizardStepper";
import { ProviderStep } from "../(components)/ProviderStep";
import { PracticeStep } from "../(components)/PracticeStep";
import { EnrollmentStep } from "../(components)/EnrollmentStep";
import { DocumentsStep } from "../(components)/DocumentsStep";
import { ReviewStep } from "../(components)/ReviewStep";
import { OnboardSuccess } from "../(components)/OnboardSuccess";

export function ManualOnboardingWizard({
  isAdmin,
  reps,
}: {
  isAdmin: boolean;
  reps: RepWithFacility[];
}) {
  // One batch id per wizard mount groups the two PDF uploads in storage.
  const [batchId] = useState(() => crypto.randomUUID());
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<ManualOnboardingForm>(EMPTY_MANUAL_ONBOARDING_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<ManualOnboardingResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const current = MANUAL_ONBOARDING_STEPS[step];
  const isLast = step === MANUAL_ONBOARDING_STEPS.length - 1;

  // Accepts an updater so async callers (uploads) never clobber fields the
  // user edited while awaiting.
  function patch(partial: ManualFormPatch) {
    setForm((f) => ({ ...f, ...(typeof partial === "function" ? partial(f) : partial) }));
  }
  function clearError(key: string) {
    setFieldErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  function goNext() {
    const errs = validateManualStep(current.key, form, isAdmin);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    setServerError(null);
    setStep((s) => s + 1);
  }

  function handleSubmit() {
    setServerError(null);
    startTransition(async () => {
      const res = await manualOnboardProvider({
        batchId,
        ...form,
        contracts: OFFLINE_CONTRACTS.map((c) => ({
          contractType: c.key,
          ...form.contracts[c.key],
        })),
      });
      if (!res.success) {
        if (res.fieldErrors) {
          const errs = normalizeServerFieldErrors(res.fieldErrors);
          setFieldErrors(errs);
          // Jump back to the first step that owns an error.
          const idx = MANUAL_ONBOARDING_STEPS.findIndex((s) =>
            Object.keys(errs).some((k) => stepOwnsField(s.key, k)),
          );
          if (idx >= 0) setStep(idx);
        }
        const msg = res.error ?? "Please fix the highlighted fields.";
        setServerError(msg);
        toast.error(msg);
        return;
      }
      setResult(res);
    });
  }

  if (result?.success) {
    return <OnboardSuccess providerEmail={result.providerEmail ?? form.email} facilityName={result.facilityName ?? form.office_name} />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <WizardStepper steps={MANUAL_ONBOARDING_STEPS} current={step} />

      <section className="bg-white rounded-xl border border-[var(--border)] p-5 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {current.key === "provider" && (
          <ProviderStep form={form} patch={patch} errors={fieldErrors} clearError={clearError} isAdmin={isAdmin} reps={reps} />
        )}
        {current.key === "practice" && (
          <PracticeStep form={form} patch={patch} errors={fieldErrors} clearError={clearError} />
        )}
        {current.key === "enrollment" && <EnrollmentStep form={form} patch={patch} />}
        {current.key === "documents" && (
          <DocumentsStep batchId={batchId} form={form} patch={patch} errors={fieldErrors} clearError={clearError} />
        )}
        {current.key === "review" && <ReviewStep form={form} isAdmin={isAdmin} reps={reps} />}

        {serverError && (
          <p className="mt-4 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={step === 0 || isPending}
            onClick={() => {
              setServerError(null);
              setStep((s) => s - 1);
            }}
            className="h-9 gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          {isLast ? (
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={handleSubmit}
              className="h-9 gap-1.5 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Create clinic account
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={goNext}
              className="h-9 gap-1 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function stepOwnsField(stepKey: string, field: string): boolean {
  if (field.startsWith("enrollment.")) return stepKey === "enrollment";
  if (field.startsWith("contracts")) return stepKey === "documents";
  if (field.startsWith("office_")) return stepKey === "practice";
  return stepKey === "provider";
}
