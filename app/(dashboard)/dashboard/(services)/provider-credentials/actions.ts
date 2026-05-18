"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserOrThrow } from "@/lib/supabase/auth";
import {
  saveCredentialsSchema,
  mapProviderCredential,
  mapProviderCredentials,
  type IProviderCredentials,
  type IProviderCredentialsFormState,
  type RawProviderCredentialRecord,
} from "@/utils/interfaces/provider-credentials";

const PROVIDER_CREDENTIALS_TABLE = "provider_credentials";

// Explicit column list — matches the column-level GRANT to `authenticated`
// in migration 20260429000000_rls_hardening.sql (plus medical_license_number
// added by the follow-up migration). `pin_hash` is intentionally NOT here:
// it stays REVOKEd from authenticated and is only readable via the service
// role in dedicated PIN-verification flows. Using `select("*")` here would
// trip permission_denied (42501) because Postgres requires SELECT on every
// column the projection expands to.
const PROVIDER_CREDENTIALS_READ_COLUMNS = [
  "id",
  "user_id",
  "credential",
  "npi_number",
  "ptan_number",
  "medical_license_number",
  "baa_signed_at",
  "terms_signed_at",
  "created_at",
  "updated_at",
].join(", ");

function toNullable(val: string | null | undefined): string | null {
  if (!val || val.trim() === "" || val.trim() === "none") return null;
  return val.trim();
}

/* -------------------------------------------------------------------------- */
/* getMyCredentials                                                           */
/* -------------------------------------------------------------------------- */

export async function getMyCredentials(): Promise<IProviderCredentials | null> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { data, error } = await supabase
    .from(PROVIDER_CREDENTIALS_TABLE)
    .select(PROVIDER_CREDENTIALS_READ_COLUMNS)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getMyCredentials] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to fetch credentials.");
  }

  if (!data) return null;
  return mapProviderCredential(data as unknown as RawProviderCredentialRecord);
}

/* -------------------------------------------------------------------------- */
/* saveCredentials                                                            */
/* -------------------------------------------------------------------------- */

export async function saveCredentials(
  _prevState: IProviderCredentialsFormState | null,
  formData: FormData,
): Promise<IProviderCredentialsFormState> {
  try {
    const supabase = await createClient();
    const user = await getCurrentUserOrThrow(supabase);

    // The settings UI was trimmed to only collect NPI. Other columns
    // (`credential`, `ptan_number`, `medical_license_number`) remain in the
    // DB schema but are no longer written from this form — an upsert that
    // omits them leaves any existing row's values untouched. If the client
    // ever wants those fields back, re-add them to CredentialsForm + this
    // action.
    const raw = {
      npi_number: toNullable(formData.get("npi_number") as string),
    };

    const parsed = saveCredentialsSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid input.", success: false };
    }

    const { error } = await supabase
      .from(PROVIDER_CREDENTIALS_TABLE)
      .upsert(
        {
          user_id: user.id,
          npi_number: parsed.data.npi_number ?? null,
        },
        { onConflict: "user_id" },
      );

    if (error) {
      console.error("[saveCredentials] Error:", JSON.stringify(error));
      return { error: error.message ?? error.code ?? "Failed to save credentials.", success: false };
    }

    revalidatePath("/dashboard/settings");
    return { error: null, success: true };
  } catch (err) {
    console.error("[saveCredentials] Unexpected error:", err);
    return { error: "An unexpected error occurred.", success: false };
  }
}

/* -------------------------------------------------------------------------- */
/* deleteCredentials                                                          */
/* -------------------------------------------------------------------------- */

export async function deleteCredentials(): Promise<void> {
  const supabase = await createClient();
  const user = await getCurrentUserOrThrow(supabase);

  const { error } = await supabase
    .from(PROVIDER_CREDENTIALS_TABLE)
    .delete()
    .eq("user_id", user.id);

  if (error) {
    console.error("[deleteCredentials] Error:", JSON.stringify(error));
    throw new Error(error.message ?? error.code ?? "Failed to delete credentials.");
  }

  revalidatePath("/dashboard/settings");
}
