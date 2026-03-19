"use server";

import { dbSelect, getSupabaseClient } from "@/utils/supabase/db";
import type { MarketingMaterial } from "@/app/(interfaces)/marketing";

const MARKETING_TABLE = "marketing_materials";

export async function getMarketingMaterials(): Promise<MarketingMaterial[]> {
  const { data, error } = await dbSelect<MarketingMaterial>({
    table: MARKETING_TABLE,
    columns: "id, created_at, title, tag, description, file_url, sort_order",
    order: { column: "sort_order", ascending: true },
  });

  if (error) {
    console.error("[getMarketingMaterials] error:", error.message);
    return [];
  }

  return data ?? [];
}

export async function getSignedDownloadUrl(file_url: string): Promise<string> {
  const supabase = await getSupabaseClient();

  // Extract file path from full URL
  const filePath = file_url.split("/object/public/hbmedical-assets/")[1];

  const { data, error } = await supabase.storage
    .from("hbmedical-assets")
    .createSignedUrl(filePath, 300); // valid for 5 minutes

  if (error || !data) {
    console.error("[getSignedDownloadUrl] error:", error?.message);
    throw new Error("Failed to generate download URL");
  }

  return data.signedUrl;
}

