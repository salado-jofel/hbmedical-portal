// "use client";

// import { useRef, useState } from "react";
// import { X, Upload, FileText, Trash2, ChevronDown } from "lucide-react";

// // ── Types ─────────────────────────────────────────────────────────────────────
// export interface FileEntry {
//     file: File;
//     title: string;
//     tag: string;
//     description: string;
//     sortOrder: number;
// }

// interface Props {
//     open: boolean;
//     onClose: () => void;
//     onUpload: (entries: FileEntry[], category: string) => Promise<void>; // ← FIXED: add category
//     defaultCategory?: string;
// }


// const CATEGORIES = ["Marketing", "Training", "Contracts"];

// // ── Extract metadata from file ────────────────────────────────────────────────
// async function extractMetadata(
//     file: File,
// ): Promise<{ title: string; tag: string; description: string }> {
//     const title = file.name
//         .replace(/\.[^/.]+$/, "")
//         .replace(/[-_]+/g, " ")
//         .replace(/\b\w/g, (c) => c.toUpperCase())
//         .trim();

//     const tag = (file.name.split(".").pop() ?? "").toUpperCase();

//     let description = "";

//     if (file.type === "application/pdf") {
//         try {
//             const buffer = await file.arrayBuffer();
//             const raw = new TextDecoder("latin1").decode(buffer);

//             const subjectMatch = raw.match(/\/Subject\s*\(([^)]{1,200})\)/);
//             if (subjectMatch) {
//                 description = subjectMatch[1].replace(/\\n/g, " ").trim();
//             }

//             if (!description) {
//                 const descMatch = raw.match(/\/Description\s*\(([^)]{1,200})\)/);
//                 if (descMatch) description = descMatch[1].trim();
//             }

//             if (!description) {
//                 const xmpMatch = raw.match(
//                     /<dc:description[^>]*>[\s\S]*?<rdf:li[^>]*>([\s\S]*?)<\/rdf:li>/,
//                 );
//                 if (xmpMatch) description = xmpMatch[1].replace(/<[^>]+>/g, "").trim();
//             }
//         } catch {
//             // silently ignore
//         }
//     }

//     return { title, tag, description };
// }

// // ── File size formatter ───────────────────────────────────────────────────────
// function formatSize(bytes: number) {
//     if (bytes < 1024) return `${bytes} B`;
//     if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
//     return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
// }

// // ── Main modal ────────────────────────────────────────────────────────────────
// export default function UploadMaterialModal({
//     open,
//     onClose,
//     onUpload,
//     defaultCategory = "Marketing",
// }: Props) {
//     const inputRef = useRef<HTMLInputElement>(null);
//     const [category, setCategory] = useState(defaultCategory);
//     const [entries, setEntries] = useState<FileEntry[]>([]);
//     const [isUploading, setIsUploading] = useState(false);
//     const [isDragging, setIsDragging] = useState(false);

//     if (!open) return null;

//     async function processFiles(files: FileList | File[]) {
//         const arr = Array.from(files);
//         const newEntries = await Promise.all(
//             arr.map(async (file, i) => {
//                 const meta = await extractMetadata(file);
//                 return {
//                     file,
//                     title: meta.title,
//                     tag: meta.tag,
//                     description: meta.description,
//                     sortOrder: entries.length + i,
//                 };
//             }),
//         );
//         setEntries((prev) => [...prev, ...newEntries]);
//     }

//     function updateEntry(
//         idx: number,
//         field: keyof Omit<FileEntry, "file">,
//         value: string | number,
//     ) {
//         setEntries((prev) =>
//             prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)),
//         );
//     }

//     function removeEntry(idx: number) {
//         setEntries((prev) => prev.filter((_, i) => i !== idx));
//     }

//     async function handleUpload() {
//         if (!entries.length) return;
//         setIsUploading(true);
//         try {
//             await onUpload(entries.map((e) => ({ ...e })), category); // ← FIXED: pass category
//             setEntries([]);
//             onClose();
//         } finally {
//             setIsUploading(false);
//         }
//     }


//     function handleClose() {
//         if (isUploading) return;
//         setEntries([]);
//         onClose();
//     }

//     return (
//         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
//             <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
//                 {/* ── Header ── */}
//                 <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
//                     <h2 className="text-base font-semibold text-slate-800">
//                         Upload Material
//                     </h2>
//                     <button
//                         onClick={handleClose}
//                         disabled={isUploading}
//                         className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
//                     >
//                         <X className="w-4 h-4 text-slate-500" />
//                     </button>
//                 </div>

//                 {/* ── Scrollable body ── */}
//                 <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
//                     {/* Category */}
//                     <div className="space-y-1.5">
//                         <label className="text-sm font-medium text-slate-700">
//                             Category
//                         </label>
//                         <div className="relative">
//                             <select
//                                 value={category}
//                                 onChange={(e) => setCategory(e.target.value)}
//                                 className="w-full appearance-none h-10 pl-3 pr-8 border border-slate-200 rounded-lg text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
//                             >
//                                 {CATEGORIES.map((c) => (
//                                     <option key={c} value={c}>
//                                         {c}
//                                     </option>
//                                 ))}
//                             </select>
//                             <ChevronDown className="absolute right-2.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
//                         </div>
//                     </div>

//                     {/* Drop zone */}
//                     <div
//                         onDragOver={(e) => {
//                             e.preventDefault();
//                             setIsDragging(true);
//                         }}
//                         onDragLeave={() => setIsDragging(false)}
//                         onDrop={(e) => {
//                             e.preventDefault();
//                             setIsDragging(false);
//                             processFiles(e.dataTransfer.files);
//                         }}
//                         onClick={() => inputRef.current?.click()}
//                         className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${isDragging
//                             ? "border-slate-400 bg-slate-50"
//                             : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
//                             }`}
//                     >
//                         <Upload className="w-6 h-6 text-slate-400" />
//                         <p className="text-sm font-medium text-slate-600">
//                             Click or drag files here
//                         </p>
//                         <p className="text-xs text-slate-400">
//                             Multiple files accepted · Any file type
//                         </p>
//                         <input
//                             ref={inputRef}
//                             type="file"
//                             multiple
//                             className="hidden"
//                             onChange={(e) => e.target.files && processFiles(e.target.files)}
//                         />
//                     </div>

//                     {/* ── File cards ── */}
//                     {entries.length > 0 && (
//                         <div className="space-y-3">
//                             <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
//                                 {entries.length} file{entries.length > 1 ? "s" : ""} selected
//                             </p>

//                             {entries.map((entry, idx) => (
//                                 <div
//                                     key={idx}
//                                     className="border border-slate-200 rounded-xl p-4 space-y-3"
//                                 >
//                                     <div className="flex items-center justify-between gap-3">
//                                         <div className="flex items-center gap-2 min-w-0">
//                                             <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
//                                                 <FileText className="w-4 h-4 text-slate-500" />
//                                             </div>
//                                             <div className="min-w-0">
//                                                 <p className="text-xs font-medium text-slate-700 truncate">
//                                                     {entry.file.name}
//                                                 </p>
//                                                 <p className="text-xs text-slate-400">
//                                                     {formatSize(entry.file.size)}
//                                                 </p>
//                                             </div>
//                                         </div>
//                                         <button
//                                             onClick={() => removeEntry(idx)}
//                                             className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0"
//                                         >
//                                             <Trash2 className="w-3.5 h-3.5" />
//                                         </button>
//                                     </div>

//                                     <div className="grid grid-cols-2 gap-2">
//                                         <div className="space-y-1">
//                                             <label className="text-xs font-medium text-slate-500">
//                                                 Title <span className="text-red-400">*</span>
//                                             </label>
//                                             <input
//                                                 type="text"
//                                                 value={entry.title}
//                                                 onChange={(e) =>
//                                                     updateEntry(idx, "title", e.target.value)
//                                                 }
//                                                 className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
//                                                 placeholder="e.g. Product Brochure"
//                                                 required
//                                             />
//                                         </div>
//                                         <div className="space-y-1">
//                                             <label className="text-xs font-medium text-slate-500">
//                                                 Tag
//                                             </label>
//                                             <input
//                                                 type="text"
//                                                 value={entry.tag}
//                                                 onChange={(e) =>
//                                                     updateEntry(idx, "tag", e.target.value)
//                                                 }
//                                                 className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
//                                                 placeholder="e.g. PDF, Guide"
//                                             />
//                                         </div>
//                                     </div>

//                                     <div className="space-y-1">
//                                         <label className="text-xs font-medium text-slate-500">
//                                             Description
//                                         </label>
//                                         <textarea
//                                             value={entry.description}
//                                             onChange={(e) =>
//                                                 updateEntry(idx, "description", e.target.value)
//                                             }
//                                             rows={2}
//                                             className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-slate-300"
//                                             placeholder="Short description of this file..."
//                                         />
//                                     </div>

//                                     <div className="space-y-1 w-28">
//                                         <label className="text-xs font-medium text-slate-500">
//                                             Sort Order
//                                         </label>
//                                         <input
//                                             type="number"
//                                             value={entry.sortOrder}
//                                             onChange={(e) =>
//                                                 updateEntry(idx, "sortOrder", Number(e.target.value))
//                                             }
//                                             className="w-full h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
//                                             min={0}
//                                         />
//                                     </div>
//                                 </div>
//                             ))}
//                         </div>
//                     )}
//                 </div>

//                 {/* ── Footer ── */}
//                 <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
//                     <button
//                         onClick={handleClose}
//                         disabled={isUploading}
//                         className="h-10 px-5 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors disabled:opacity-50"
//                     >
//                         Cancel
//                     </button>
//                     <button
//                         onClick={handleUpload}
//                         disabled={!entries.length || isUploading}
//                         className="h-10 px-5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-40 flex items-center gap-2"
//                     >
//                         {isUploading ? (
//                             <>
//                                 <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
//                                 Uploading...
//                             </>
//                         ) : (
//                             <>
//                                 <Upload className="w-3.5 h-3.5" />
//                                 Upload {entries.length > 1 ? `${entries.length} Files` : "File"}
//                             </>
//                         )}
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );
// }
