"use server";

import { ContractMaterial } from "@/lib/interfaces/contracts";
import { getSupabaseClient } from "@/utils/supabase/db";

const CONTRACT_TABLE = "contracts_materials";

export async function getContractMaterials(): Promise<ContractMaterial[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from(CONTRACT_TABLE)
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[getContractMaterials] error:", error.message);
    return [];
  }
  return data ?? [];
}

export async function getSignedDownloadUrl(file_url: string): Promise<string> {
  const supabase = await getSupabaseClient();
  const filePath = file_url.split("/object/public/hbmedical-assets/")[1];
  const { data, error } = await supabase.storage
    .from("hbmedical-assets")
    .createSignedUrl(filePath, 300);

  if (error || !data) throw new Error("Failed to generate download URL");
  return data.signedUrl;
}
