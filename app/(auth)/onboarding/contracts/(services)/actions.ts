"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  stampContractPdf,
  signedContractPath,
  CONTRACT_SOURCES,
  type ContractType,
  type ContractParagraphFields,
} from "@/lib/pdf/sign-contract";
import {
  SALES_REP_CONTRACTS,
  getContractDef,
  salesRepContractSignedPath,
  type SalesRepContractKey,
} from "@/lib/pdf/sales-rep-contracts";
import { stampSalesRepContract } from "@/lib/pdf/sign-sales-rep-contract";
import {
  isKnownContractTemplate,
  loadContractTemplate,
} from "@/lib/pdf/templates";

/* ──────────────────────────────────────────────────────────────────────────
 *  Post-login contracts gate — parallel sign actions keyed by the
 *  authenticated user instead of an invite_token.
 *
 *  Why parallel actions instead of polymorphism on the existing ones?
 *  The invite-signup actions are battle-tested and run during a delicate
 *  pre-account window where mistakes are hard to recover from. Mirroring
 *  the logic here keeps that flow untouched and makes the gate's risk
 *  surface easy to reason about.
 *
 *  Storage + DB compatibility:
 *  - The existing tables key signatures by (invite_token, contract_type).
 *    For gate signs we synthesize `invite_token = user_id` so the unique
 *    constraint still holds. UUID format ≠ 64-char hex of real invite
 *    tokens, so collisions are impossible.
 *  - Storage paths use the same helpers — they just take a string segment.
 * ──────────────────────────────────────────────────────────────────────── */

const BUCKET = "hbmedical-bucket-private";
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): Uint8Array | null {
  const match = /^data:image\/(png|jpeg|jpg);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[2], "base64");
  } catch {
    return null;
  }
}

interface AuthedUser {
  id: string;
  email: string;
  role: string;
}

async function getAuthedUserOrFail(): Promise<AuthedUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    role: profile?.role ?? user.user_metadata?.role ?? "",
  };
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Provider-side: BAA + Product Services Agreement (post-login signing).
 * ──────────────────────────────────────────────────────────────────────── */

export interface SignProviderContractAsUserInput {
  contractType: ContractType;
  typedName: string;
  typedTitle: string;
  signatureMethod: "type" | "draw" | "upload";
  signatureDataUrl: string;
  paragraph?: ContractParagraphFields;
}

export interface SignContractResult {
  success: boolean;
  signedUrl?: string;
  error?: string;
}

export async function signProviderContractAsUser(
  input: SignProviderContractAsUserInput,
): Promise<SignContractResult> {
  try {
    const user = await getAuthedUserOrFail();
    if (!user) return { success: false, error: "Not signed in." };
    if (user.role !== "clinical_provider") {
      return { success: false, error: "Only providers can sign these contracts." };
    }

    const {
      contractType,
      typedName,
      typedTitle,
      signatureMethod,
      signatureDataUrl,
    } = input;

    if (!typedName?.trim() || !typedTitle?.trim()) {
      return { success: false, error: "Name, title, and signature are required." };
    }
    if (!["baa", "product_services"].includes(contractType)) {
      return { success: false, error: "Invalid contract type." };
    }
    if (!["type", "draw", "upload"].includes(signatureMethod)) {
      return { success: false, error: "Invalid signature method." };
    }

    const signatureBytes = decodeDataUrl(signatureDataUrl);
    if (!signatureBytes) return { success: false, error: "Invalid signature image." };
    if (signatureBytes.length > MAX_SIGNATURE_BYTES) {
      return { success: false, error: "Signature image is too large (max 2 MB)." };
    }

    const admin = createAdminClient();
    const source = CONTRACT_SOURCES[contractType];

    let sourceBytes: Uint8Array;
    try {
      if (!isKnownContractTemplate(source.templateFile)) {
        return { success: false, error: "Unknown contract template." };
      }
      sourceBytes = await loadContractTemplate(source.templateFile);
    } catch (err) {
      console.error("[signProviderContractAsUser] template load failed:", err);
      return { success: false, error: "Failed to load contract template." };
    }

    const today = new Date();

    const stamped = await stampContractPdf({
      sourcePdf: sourceBytes,
      contractType,
      client: {
        name: typedName.trim(),
        title: typedTitle.trim(),
        date: today,
        signaturePng: signatureBytes,
      },
      meridianDate: today,
      paragraph: input.paragraph,
    });

    // Synthesize invite_token = user_id so the existing storage path helper +
    // (invite_token, contract_type) unique constraint keep working unchanged.
    const signedPath = signedContractPath(user.id, contractType);
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(signedPath, stamped, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) {
      console.error("[signProviderContractAsUser] upload failed:", uploadErr.message);
      return { success: false, error: "Failed to save signed contract." };
    }

    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for") ?? "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const userAgent = h.get("user-agent") || null;

    const { error: rowErr } = await admin
      .from("provider_contract_signatures")
      .upsert(
        {
          user_id: user.id,
          invite_token: user.id, // synthetic: see file header
          contract_type: contractType,
          source_path: source.templateFile,
          signed_path: signedPath,
          typed_name: typedName.trim(),
          typed_title: typedTitle.trim(),
          signature_method: signatureMethod,
          signed_at: today.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        { onConflict: "invite_token,contract_type" },
      );
    if (rowErr) {
      console.error("[signProviderContractAsUser] row upsert failed:", JSON.stringify(rowErr));
      return { success: false, error: "Failed to record signature." };
    }

    const { data: urlData } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(signedPath, 3600);

    return { success: true, signedUrl: urlData?.signedUrl };
  } catch (err) {
    console.error("[signProviderContractAsUser] unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sign contract.",
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Sales-rep side: 7 onboarding contracts (post-login signing).
 * ──────────────────────────────────────────────────────────────────────── */

export interface SignSalesRepContractAsUserInput {
  contractKey: SalesRepContractKey;
  typedName: string;
  typedTitle?: string;
  signatureMethod: "type" | "draw" | "upload";
  signatureDataUrl: string;
  formData: Record<string, unknown>;
  attachmentPaths?: string[];
}

export async function signSalesRepContractAsUser(
  input: SignSalesRepContractAsUserInput,
): Promise<SignContractResult> {
  try {
    const user = await getAuthedUserOrFail();
    if (!user) return { success: false, error: "Not signed in." };
    if (user.role !== "sales_representative") {
      return { success: false, error: "Only sales reps can sign these documents." };
    }

    const {
      contractKey,
      typedName,
      typedTitle,
      signatureMethod,
      signatureDataUrl,
      formData,
      attachmentPaths,
    } = input;

    if (!typedName?.trim()) {
      return { success: false, error: "Name and signature are required." };
    }
    if (!["type", "draw", "upload"].includes(signatureMethod)) {
      return { success: false, error: "Invalid signature method." };
    }

    const def = getContractDef(contractKey);
    if (!def) return { success: false, error: "Unknown contract type." };

    const signatureBytes = decodeDataUrl(signatureDataUrl);
    if (!signatureBytes) return { success: false, error: "Invalid signature image." };
    if (signatureBytes.length > MAX_SIGNATURE_BYTES) {
      return { success: false, error: "Signature image is too large (max 2 MB)." };
    }

    const admin = createAdminClient();

    let sourceBytes: Uint8Array;
    try {
      if (!isKnownContractTemplate(def.templateFile)) {
        return { success: false, error: "Unknown contract template." };
      }
      sourceBytes = await loadContractTemplate(def.templateFile);
    } catch (err) {
      console.error("[signSalesRepContractAsUser] template load failed:", err);
      return { success: false, error: "Failed to load contract template." };
    }

    let attachments:
      | Array<{ bytes: Uint8Array; mime: string; filename: string }>
      | undefined;
    if (attachmentPaths && attachmentPaths.length > 0) {
      attachments = [];
      for (const p of attachmentPaths) {
        const { data: blob } = await admin.storage.from(BUCKET).download(p);
        if (!blob) continue;
        attachments.push({
          bytes: new Uint8Array(await blob.arrayBuffer()),
          mime: blob.type || "application/octet-stream",
          filename: p.split("/").pop() ?? "attachment",
        });
      }
    }

    const today = new Date();
    const stamped = await stampSalesRepContract({
      contract: def,
      sourcePdf: sourceBytes,
      formData,
      signaturePng: signatureBytes,
      signedDate: today,
      typedName: typedName.trim(),
      attachments,
    });

    const signedPath = salesRepContractSignedPath(user.id, contractKey);
    const { error: uploadErr } = await admin.storage
      .from(BUCKET)
      .upload(signedPath, stamped, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) {
      console.error("[signSalesRepContractAsUser] upload failed:", uploadErr.message);
      return { success: false, error: "Failed to save signed contract." };
    }

    const h = await headers();
    const forwardedFor = h.get("x-forwarded-for") ?? "";
    const ipAddress = forwardedFor.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    const userAgent = h.get("user-agent") || null;

    const { error: rowErr } = await admin
      .from("sales_rep_contract_signatures")
      .upsert(
        {
          user_id: user.id,
          invite_token: user.id,
          contract_type: contractKey,
          source_path: def.templateFile,
          signed_path: signedPath,
          typed_name: typedName.trim(),
          typed_title: typedTitle?.trim() || null,
          signature_method: signatureMethod,
          form_data: formData,
          signed_at: today.toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        { onConflict: "invite_token,contract_type" },
      );
    if (rowErr) {
      console.error("[signSalesRepContractAsUser] row upsert failed:", JSON.stringify(rowErr));
      return { success: false, error: "Failed to record signature." };
    }

    const { data: urlData } = await admin.storage
      .from(BUCKET)
      .createSignedUrl(signedPath, 3600);

    return { success: true, signedUrl: urlData?.signedUrl };
  } catch (err) {
    console.error("[signSalesRepContractAsUser] unexpected:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to sign contract.",
    };
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 *  Status fetcher — list source URLs + signed URLs for the gate UI.
 * ──────────────────────────────────────────────────────────────────────── */

export interface ContractGateStatus {
  audience: "sales_rep" | "provider";
  // Sales-rep side
  salesRep: Array<{
    key: SalesRepContractKey;
    label: string;
    sourceUrl: string;
    signedUrl: string | null;
  }>;
  // Provider side
  provider: Array<{
    type: ContractType;
    label: string;
    sourceUrl: string;
    signedUrl: string | null;
  }>;
}

export async function getContractGateStatus(): Promise<{
  status: ContractGateStatus | null;
  error: string | null;
}> {
  try {
    const user = await getAuthedUserOrFail();
    if (!user) return { status: null, error: "Not signed in." };

    const admin = createAdminClient();
    const EXPIRES_IN = 3600;

    if (user.role === "sales_representative") {
      const salesRep: ContractGateStatus["salesRep"] = [];
      for (const def of SALES_REP_CONTRACTS) {
        const sourceUrl = `/api/contract-template/${def.templateFile}`;
        const signedPath = salesRepContractSignedPath(user.id, def.key);
        const { data: list } = await admin.storage
          .from(BUCKET)
          .list(`sales-rep-contracts-signed/${user.id}`, {
            search: `${def.key}.pdf`,
          });
        let signedUrl: string | null = null;
        if (list && list.some((f) => f.name === `${def.key}.pdf`)) {
          const { data } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(signedPath, EXPIRES_IN);
          signedUrl = data?.signedUrl ?? null;
        }
        salesRep.push({ key: def.key, label: def.label, sourceUrl, signedUrl });
      }
      return {
        status: { audience: "sales_rep", salesRep, provider: [] },
        error: null,
      };
    }

    if (user.role === "clinical_provider") {
      const provider: ContractGateStatus["provider"] = [];
      const PROVIDER_LABELS: Record<ContractType, string> = {
        baa: "Business Associate Agreement (BAA)",
        product_services: "Product & Services Agreement",
      };
      for (const type of ["baa", "product_services"] as ContractType[]) {
        const source = CONTRACT_SOURCES[type];
        const sourceUrl = `/api/contract-template/${source.templateFile}`;
        const signedPath = signedContractPath(user.id, type);
        const { data: list } = await admin.storage
          .from(BUCKET)
          .list(`provider-contracts-signed/${user.id}`, {
            search: `${type}.pdf`,
          });
        let signedUrl: string | null = null;
        if (list && list.some((f) => f.name === `${type}.pdf`)) {
          const { data } = await admin.storage
            .from(BUCKET)
            .createSignedUrl(signedPath, EXPIRES_IN);
          signedUrl = data?.signedUrl ?? null;
        }
        provider.push({ type, label: PROVIDER_LABELS[type], sourceUrl, signedUrl });
      }
      return {
        status: { audience: "provider", salesRep: [], provider },
        error: null,
      };
    }

    return { status: null, error: "Your role does not require contract signing." };
  } catch (err) {
    console.error("[getContractGateStatus] unexpected:", err);
    return {
      status: null,
      error: err instanceof Error ? err.message : "Failed to load contracts.",
    };
  }
}
