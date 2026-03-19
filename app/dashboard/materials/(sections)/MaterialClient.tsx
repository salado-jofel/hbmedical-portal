// "use client";

// import { useState } from "react";
// import { FileText, Upload } from "lucide-react";
// import { createBrowserClient } from "@supabase/ssr";
// import MaterialCard from "./MaterialCard";
// import UploadModal from "./UploadModal";
// import type { FileEntry } from "./UploadModal";
// import { BUCKET_MAP } from "../(services)/constants";
// import { useAppDispatch, useAppSelector } from "@/store/hooks";
// import { setActiveTab } from "../(redux)/material-slice";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// interface Props {
//     materials: Record<MaterialType, Material[]>;
// }

// const TABS: { value: MaterialType; label: string }[] = [
//     { value: "marketing", label: "Marketing" },
//     { value: "contracts", label: "Contracts" },
//     { value: "training", label: "Training" },
// ];

// function EmptyState() {
//     return (
//         <div className="flex flex-col items-center justify-center py-24 text-gray-400">
//             <FileText className="w-10 h-10 mb-3 opacity-40" />
//             <p className="text-sm font-medium">No materials available</p>
//             <p className="text-xs mt-1">Materials will appear here once added</p>
//         </div>
//     );
// }

// export default function MaterialsClient({ materials }: Props) {
//     const dispatch = useAppDispatch();
//     const activeTab = useAppSelector((s) => s.materials.activeTab);
//     const [isModalOpen, setIsModalOpen] = useState(false);

//     // ── Upload: file → Supabase Storage (client), metadata → server action ──────
//     async function handleUpload(entries: FileEntry[], category: string) { // ← FIXED: accept category
//         const supabase = createBrowserClient(
//             process.env.NEXT_PUBLIC_SUPABASE_URL!,
//             process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
//         );

//         // Normalize to lowercase — modal passes "Contracts", MaterialType expects "contracts"
//         const type = category.toLowerCase() as MaterialType; // ← FIXED: use modal's category

//         const bucket = BUCKET_MAP[type]; // ← FIXED: was BUCKET_MAP[activeTab]

//         for (const entry of entries) {
//             // ── Step 1: Upload file directly to Supabase Storage ─────────────────
//             const safeName = entry.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
//             const fileName = `${Date.now()}_${safeName}`;

//             const { data: uploadData, error: uploadError } = await supabase.storage
//                 .from(bucket)
//                 .upload(fileName, entry.file, { cacheControl: "3600", upsert: false });

//             if (uploadError) {
//                 throw new Error(`Storage upload failed: ${uploadError.message}`);
//             }

//             const { data: urlData } = supabase.storage
//                 .from(bucket)
//                 .getPublicUrl(uploadData.path);

//             // ── Step 2: Save DB record via server action (no file, just URL) ──────
//             const result = await saveMaterialRecord(type, { // ← FIXED: was activeTab
//                 title: entry.title,
//                 tag: entry.tag || null,
//                 description: entry.description || null,
//                 sort_order: entry.sortOrder,
//                 file_url: urlData.publicUrl,
//             });

//             if (!result.success) {
//                 // Rollback: remove uploaded file if DB insert fails
//                 await supabase.storage.from(bucket).remove([uploadData.path]);
//                 throw new Error(result.error ?? "Failed to save material record.");
//             }
//         }
//     }

//     return (
//         <>
//             <Tabs
//                 value={activeTab}
//                 onValueChange={(v) => dispatch(setActiveTab(v as MaterialType))}
//             >
//                 <div className="flex items-center justify-between mb-6">
//                     <TabsList>
//                         {TABS.map((t) => (
//                             <TabsTrigger key={t.value} value={t.value}>
//                                 {t.label}
//                                 <span className="ml-2 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
//                                     {materials[t.value].length}
//                                 </span>
//                             </TabsTrigger>
//                         ))}
//                     </TabsList>

//                     <button
//                         onClick={() => setIsModalOpen(true)}
//                         className="flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
//                     >
//                         <Upload className="w-3.5 h-3.5" />
//                         Upload
//                     </button>
//                 </div>

//                 {TABS.map((t) => (
//                     <TabsContent key={t.value} value={t.value}>
//                         {materials[t.value].length === 0 ? (
//                             <EmptyState />
//                         ) : (
//                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//                                 {materials[t.value].map((m) => (
//                                     <MaterialCard key={m.id} material={m} type={t.value} />
//                                 ))}
//                             </div>
//                         )}
//                     </TabsContent>
//                 ))}
//             </Tabs>

//             <UploadModal
//                 open={isModalOpen}
//                 onClose={() => setIsModalOpen(false)}
//                 onUpload={handleUpload}
//                 defaultCategory={activeTab}
//             />
//         </>
//     );
// }
