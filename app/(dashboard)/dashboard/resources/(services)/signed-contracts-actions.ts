"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserRole } from "@/lib/supabase/auth";
import { isAdmin } from "@/utils/helpers/role";
import { SALES_REP_CONTRACTS } from "@/lib/pdf/sales-rep-contracts";

const BUCKET = "hbmedical-bucket-private";
const SIGNED_URL_TTL = 3600;

export type ContractKind = "rep" | "provider";

export interface SignedContractRow {
  id: string;
  /** "rep" for sales-rep onboarding contracts, "provider" for clinical-provider
   *  BAA / Product & Services. Lets the admin view show a Type badge per row. */
  kind: ContractKind;
  contractType: string;
  label: string;
  signedAt: string;
  signedUrl: string | null;
  typedName: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  facilityId: string | null;
  facilityName: string | null;
}

interface SignatureRow {
  id: string;
  user_id: string | null;
  contract_type: string;
  signed_path: string;
  typed_name: string;
  signed_at: string;
}

interface ProfileRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface FacilityRow {
  id: string;
  name: string | null;
  user_id: string | null;
}

const labelForRep = (contractType: string) =>
  SALES_REP_CONTRACTS.find((c) => c.key === contractType)?.label ?? contractType;

const PROVIDER_CONTRACT_LABELS: Record<string, string> = {
  baa: "Business Associate Agreement",
  product_services: "Product & Services Agreement",
};
const labelForProvider = (contractType: string) =>
  PROVIDER_CONTRACT_LABELS[contractType] ?? contractType;

const SIGNATURE_SELECT =
  "id, user_id, contract_type, signed_path, typed_name, signed_at";

async function enrichRows(
  admin: ReturnType<typeof createAdminClient>,
  rows: SignatureRow[],
  kind: ContractKind,
): Promise<SignedContractRow[]> {
  if (rows.length === 0) return [];

  // Batch-sign URLs
  const paths = rows.map((r) => r.signed_path);
  const { data: urlData } = await admin.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  const urlByPath = new Map<string, string>();
  for (const d of urlData ?? []) {
    if (d.path && d.signedUrl) urlByPath.set(d.path, d.signedUrl);
  }

  // Batch-load profiles + rep-office facilities (keyed by user_id — sales reps
  // own their rep_office via facilities.user_id, not a column on profiles).
  const userIds = Array.from(
    new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v)),
  );
  const profilesById = new Map<string, ProfileRow>();
  const facilityByUserId = new Map<string, FacilityRow>();
  if (userIds.length > 0) {
    const [{ data: profiles }, { data: facilities }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds),
      admin
        .from("facilities")
        .select("id, name, user_id")
        .eq("facility_type", "rep_office")
        .in("user_id", userIds),
    ]);
    for (const p of (profiles ?? []) as ProfileRow[]) profilesById.set(p.id, p);
    for (const f of (facilities ?? []) as FacilityRow[]) {
      if (f.user_id) facilityByUserId.set(f.user_id, f);
    }
  }

  return rows.map((r) => {
    const profile = r.user_id ? profilesById.get(r.user_id) ?? null : null;
    const facility = r.user_id ? facilityByUserId.get(r.user_id) ?? null : null;
    const fullName = profile
      ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || null
      : null;
    return {
      id: r.id,
      kind,
      contractType: r.contract_type,
      label:
        kind === "provider"
          ? labelForProvider(r.contract_type)
          : labelForRep(r.contract_type),
      signedAt: r.signed_at,
      signedUrl: urlByPath.get(r.signed_path) ?? null,
      typedName: r.typed_name,
      userId: r.user_id,
      userName: fullName,
      userEmail: profile?.email ?? null,
      facilityId: facility?.id ?? null,
      facilityName: facility?.name ?? null,
    };
  });
}

/** Sales-rep self-service: RLS restricts to own rows automatically. */
export async function getMySignedSalesRepContracts(): Promise<SignedContractRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("sales_rep_contract_signatures")
    .select(SIGNATURE_SELECT)
    .eq("user_id", user.id)
    .order("contract_type", { ascending: true });
  if (error) {
    console.error("[getMySignedSalesRepContracts]", error.message);
    return [];
  }

  const admin = createAdminClient();
  return enrichRows(admin, (data ?? []) as SignatureRow[], "rep");
}

/** Provider self-service: RLS on `provider_contract_signatures` restricts to
 *  the row owner (`user_id = auth.uid()`). Mirrors the sales-rep flow. */
export async function getMySignedProviderContracts(): Promise<SignedContractRow[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("provider_contract_signatures")
    .select(SIGNATURE_SELECT)
    .eq("user_id", user.id)
    .order("contract_type", { ascending: true });
  if (error) {
    console.error("[getMySignedProviderContracts]", error.message);
    return [];
  }

  const admin = createAdminClient();
  return enrichRows(admin, (data ?? []) as SignatureRow[], "provider");
}

/** Admin-only: every signed row across all reps + providers, for the
 *  combined "Onboarding Signatures" tab. Two parallel queries; results are
 *  enriched with the matching `kind` so the UI can render a Type badge. */
export async function getAllSignedOnboardingContracts(): Promise<SignedContractRow[]> {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role)) return [];

  const admin = createAdminClient();
  const [{ data: repRows, error: repErr }, { data: provRows, error: provErr }] =
    await Promise.all([
      admin
        .from("sales_rep_contract_signatures")
        .select(SIGNATURE_SELECT)
        .not("user_id", "is", null)
        .order("signed_at", { ascending: false }),
      admin
        .from("provider_contract_signatures")
        .select(SIGNATURE_SELECT)
        .not("user_id", "is", null)
        .order("signed_at", { ascending: false }),
    ]);
  if (repErr) console.error("[getAllSignedOnboardingContracts] rep", repErr.message);
  if (provErr) console.error("[getAllSignedOnboardingContracts] provider", provErr.message);

  const [enrichedRep, enrichedProv] = await Promise.all([
    enrichRows(admin, (repRows ?? []) as SignatureRow[], "rep"),
    enrichRows(admin, (provRows ?? []) as SignatureRow[], "provider"),
  ]);

  // Merge, sort by signed_at desc — most recent activity first regardless of kind.
  return [...enrichedRep, ...enrichedProv].sort((a, b) =>
    b.signedAt.localeCompare(a.signedAt),
  );
}

export interface RepOfficeOption {
  id: string;
  name: string;
}

export interface SalesRepOption {
  id: string;
  name: string;
  facilityId: string | null;
}

/** Rep-office facilities, for the admin Account filter dropdown. */
export async function getRepOfficesForFilter(): Promise<RepOfficeOption[]> {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role)) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("facilities")
    .select("id, name")
    .eq("facility_type", "rep_office")
    .order("name", { ascending: true });
  if (error) {
    console.error("[getRepOfficesForFilter]", error.message);
    return [];
  }
  return (data ?? []).map((f) => ({ id: f.id, name: f.name ?? "(Unnamed)" }));
}

/** Sales-rep users, for the admin Sales Rep filter dropdown. */
export async function getSalesRepsForFilter(): Promise<SalesRepOption[]> {
  const supabase = await createClient();
  const role = await getUserRole(supabase);
  if (!isAdmin(role)) return [];

  const admin = createAdminClient();
  const [{ data: profiles, error }, { data: facilities }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("role", "sales_representative")
      .order("last_name", { ascending: true }),
    admin
      .from("facilities")
      .select("id, user_id")
      .eq("facility_type", "rep_office"),
  ]);
  if (error) {
    console.error("[getSalesRepsForFilter]", error.message);
    return [];
  }
  const facilityByUserId = new Map<string, string>();
  for (const f of facilities ?? []) {
    if (f.user_id) facilityByUserId.set(f.user_id, f.id);
  }
  return (profiles ?? []).map((p) => ({
    id: p.id,
    name:
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() ||
      p.email ||
      "(Unknown)",
    facilityId: facilityByUserId.get(p.id) ?? null,
  }));
}
