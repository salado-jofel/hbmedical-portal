import {
  providerStepSchema,
  practiceStepSchema,
  offlineContractSchema,
  issuesToFieldErrors,
} from "@/utils/validators/manual-onboarding";
import type { ManualOnboardingForm } from "@/utils/interfaces/manual-onboarding";
import {
  OFFLINE_CONTRACTS,
  type ManualOnboardingStepKey,
} from "@/utils/constants/manual-onboarding";

/** Client-side per-step validation. Reuses the same zod schemas the server
 *  runs so the wizard can't advance with data the action would reject. */
export function validateManualStep(
  step: ManualOnboardingStepKey,
  form: ManualOnboardingForm,
  isAdmin: boolean,
): Record<string, string> {
  switch (step) {
    case "provider": {
      const parsed = providerStepSchema.safeParse(form);
      const errs = parsed.success ? {} : issuesToFieldErrors(parsed.error.issues);
      if (isAdmin && !form.repId) errs.repId = "Select a sales rep.";
      return errs;
    }
    case "practice": {
      const parsed = practiceStepSchema.safeParse(form);
      return parsed.success ? {} : issuesToFieldErrors(parsed.error.issues);
    }
    case "documents": {
      const errs: Record<string, string> = {};
      for (const def of OFFLINE_CONTRACTS) {
        const draft = form.contracts[def.key];
        if (draft.uploading) {
          errs[`contracts.${def.key}.filePath`] = "Upload still in progress.";
          continue;
        }
        const parsed = offlineContractSchema.safeParse({ contractType: def.key, ...draft });
        if (!parsed.success) {
          for (const [k, v] of Object.entries(issuesToFieldErrors(parsed.error.issues))) {
            errs[`contracts.${def.key}.${k}`] = v;
          }
        }
      }
      return errs;
    }
    default:
      return {};
  }
}

/** Server errors arrive as `contracts.0.signerName`; the wizard keys slots by
 *  contract type (`contracts.baa.signerName`). */
export function normalizeServerFieldErrors(errs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, msg] of Object.entries(errs)) {
    const m = key.match(/^contracts\.(\d+)\.(.+)$/);
    if (m) {
      const def = OFFLINE_CONTRACTS[Number(m[1])];
      out[def ? `contracts.${def.key}.${m[2]}` : key] = msg;
    } else if (key === "contracts") {
      out["contracts.baa.filePath"] = msg;
    } else {
      out[key] = msg;
    }
  }
  return out;
}

export function formatDateOnPaper(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
