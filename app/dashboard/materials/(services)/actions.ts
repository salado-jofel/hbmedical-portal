// "use server";

// import { createClient } from "@/utils/supabase/server";
// import { revalidatePath } from "next/cache";

// // Maps category name → { bucket, table }
// const CATEGORY_MAP: Record<string, { bucket: string; table: string }> = {
//   marketing: { bucket: "marketing", table: "marketing_materials" },
//   contracts: { bucket: "contracts", table: "contracts_materials" },
//   training: { bucket: "training", table: "training_materials" },
// };

// export interface UploadEntry {
//   file: File;
//   title: string;
//   tag: string;
//   description: string;
//   sortOrder: number;
// }

// export async function uploadMaterials(
//   entries: UploadEntry[],
//   category: string,
// ): Promise<void> {
//   const key = category.toLowerCase();
//   const mapping = CATEGORY_MAP[key];

//   if (!mapping) {
//     throw new Error(
//       `Unknown category: "${category}". Expected: Marketing, Contracts, or Training.`,
//     );
//   }

//   const supabase = await createClient();

//   for (const entry of entries) {
//     // ── 1. Upload file to the correct storage bucket ──────────────────────
//     const safeName = `${Date.now()}-${entry.file.name.replace(/\s+/g, "_")}`;

//     const { data: storageData, error: storageError } = await supabase.storage
//       .from(mapping.bucket)
//       .upload(safeName, entry.file, { upsert: false });

//     if (storageError) {
//       throw new Error(`Storage upload failed: ${storageError.message}`);
//     }

//     // ── 2. Get public URL ─────────────────────────────────────────────────
//     const { data: urlData } = supabase.storage
//       .from(mapping.bucket)
//       .getPublicUrl(storageData.path);

//     // ── 3. Insert row into the correct DB table ───────────────────────────
//     const { error: dbError } = await supabase.from(mapping.table).insert({
//       title: entry.title,
//       tag: entry.tag,
//       description: entry.description,
//       sort_order: entry.sortOrder,
//       file_url: urlData.publicUrl,
//     });

//     if (dbError) {
//       throw new Error(`DB insert failed: ${dbError.message}`);
//     }
//   }

//   // ── 4. Revalidate all three pages so they refresh ─────────────────────────
//   revalidatePath("/dashboard/marketing");
//   revalidatePath("/dashboard/contracts");
//   revalidatePath("/dashboard/trainings");
// }
