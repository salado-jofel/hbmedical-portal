import { Building2, ClipboardList, FileUp, ListChecks, User } from "lucide-react";

/** Storage prefix shared with inline e-signatures (see lib/pdf/sign-contract.ts).
 *  Offline rows use a synthetic invite token `offline-<batchId>` so both the
 *  storage path and the (invite_token, contract_type) unique index line up. */
export const OFFLINE_TOKEN_PREFIX = "offline-";

/** Marker stored in `provider_contract_signatures.source_path` for uploads —
 *  there is no Meridian template involved, the PDF is the clinic's own scan. */
export const OFFLINE_SOURCE_PATH = "offline-upload";

export const OFFLINE_SIGNATURE_METHOD = "offline" as const;

export const MAX_OFFLINE_CONTRACT_BYTES = 25 * 1024 * 1024; // 25 MB per scan

export const OFFLINE_CONTRACTS = [
  { key: "baa", label: "Business Associate Agreement", short: "BAA" },
  { key: "product_services", label: "Product & Services Agreement", short: "P&S" },
] as const;

export type OfflineContractKey = (typeof OFFLINE_CONTRACTS)[number]["key"];

export const MANUAL_ONBOARDING_STEPS = [
  { key: "provider", label: "Provider", icon: User },
  { key: "practice", label: "Practice", icon: Building2 },
  { key: "enrollment", label: "Enrollment", icon: ClipboardList },
  { key: "documents", label: "Documents", icon: FileUp },
  { key: "review", label: "Review", icon: ListChecks },
] as const;

export type ManualOnboardingStepKey = (typeof MANUAL_ONBOARDING_STEPS)[number]["key"];

export const MANUAL_ONBOARDING_PATH = "/dashboard/onboarding/manual";
