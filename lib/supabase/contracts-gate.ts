import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { SALES_REP_CONTRACTS } from "@/lib/pdf/sales-rep-contracts";
import type { UserRole } from "@/utils/helpers/role";

/**
 * Decision returned by `evaluateContractsGate` for the dashboard-layout redirect.
 * - `"ok"` — user has signed every required contract for their role; no gate.
 * - `"must_sign"` — user is missing one or more required contracts. The
 *   `missingKeys` payload lets the gate page highlight which ones still need
 *   action without re-querying.
 */
export type ContractsGateDecision =
  | { kind: "ok" }
  | {
      kind: "must_sign";
      audience: "sales_rep" | "provider";
      missingKeys: string[];
    };

/** Provider-side onboarding agreements (matches `provider_contract_signatures.contract_type`). */
export const PROVIDER_REQUIRED_KEYS = ["baa", "product_services"] as const;
export type ProviderContractKey = (typeof PROVIDER_REQUIRED_KEYS)[number];

/** Master switch. Set CONTRACTS_GATE_ENABLED=true in env to flip on. Off by
 *  default so the code can ship dark and be activated post-smoke-test. */
function gateEnabled(): boolean {
  return process.env.CONTRACTS_GATE_ENABLED === "true";
}

/**
 * Determine whether the signed-in user must be redirected to /onboarding/contracts.
 *
 * Scope (per design decisions):
 *  - sales_representative (and sub-reps, who share that role) → all 7 sales-rep
 *    contracts are required.
 *  - clinical_provider → BAA + Product & Services Agreement required.
 *  - admin / support_staff / clinical_staff → never gated (they have no
 *    onboarding contracts targeting them).
 *
 * Detection queries `sales_rep_contract_signatures` / `provider_contract_signatures`
 * by `user_id`. Old signups created BEFORE the contracts feature existed will
 * have zero rows → reported as missing every key, which is the desired behavior
 * (forces them through the gate to backfill).
 */
export async function evaluateContractsGate(
  userId: string,
  role: UserRole,
): Promise<ContractsGateDecision> {
  if (!gateEnabled()) return { kind: "ok" };
  if (!role) return { kind: "ok" };

  const admin = createAdminClient();

  if (role === "sales_representative") {
    const { data } = await admin
      .from("sales_rep_contract_signatures")
      .select("contract_type")
      .eq("user_id", userId);
    const signed = new Set((data ?? []).map((r) => r.contract_type));
    const missing = SALES_REP_CONTRACTS.filter((c) => !signed.has(c.key)).map(
      (c) => c.key,
    );
    if (missing.length === 0) return { kind: "ok" };
    return { kind: "must_sign", audience: "sales_rep", missingKeys: missing };
  }

  if (role === "clinical_provider") {
    const { data } = await admin
      .from("provider_contract_signatures")
      .select("contract_type")
      .eq("user_id", userId);
    const signed = new Set((data ?? []).map((r) => r.contract_type));
    const missing = PROVIDER_REQUIRED_KEYS.filter((k) => !signed.has(k));
    if (missing.length === 0) return { kind: "ok" };
    return { kind: "must_sign", audience: "provider", missingKeys: [...missing] };
  }

  return { kind: "ok" };
}
