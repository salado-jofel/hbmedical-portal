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
    .select("*")
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

    const raw = {
      credential: toNullable(formData.get("credential") as string),
      npi_number: toNullable(formData.get("npi_number") as string),
      ptan_number: toNullable(formData.get("ptan_number") as string),
      medical_license_number: toNullable(formData.get("medical_license_number") as string),
    };

    const parsed = saveCredentialsSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? "Invalid input.", success: false };
    }

    const { error } = await supabase
      .from(PROVIDER_CREDENTIALS_TABLE)
      .upsert(
        {
          user_id: user.id,
          credential: parsed.data.credential ?? null,
          npi_number: parsed.data.npi_number ?? null,
          ptan_number: parsed.data.ptan_number ?? null,
          medical_license_number: parsed.data.medical_license_number ?? null,
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
