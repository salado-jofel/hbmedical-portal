// "use client";

// import { useState } from "react";
// import { FileText, Download, Trash2, Tag } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Badge } from "@/components/ui/badge";
// import type { Material, MaterialType } from "../(services)/actions";
// import { deleteMaterial } from "../(services)/actions";

// interface MaterialCardProps {
//     material: Material;
//     type: MaterialType;
// }

// export default function MaterialCard({ material, type }: MaterialCardProps) {
//     const [deleting, setDeleting] = useState(false);

//     async function handleDelete() {
//         if (!confirm(`Delete "${material.title}"? This cannot be undone.`)) return;
//         setDeleting(true);
//         const result = await deleteMaterial(type, material.id, material.file_url);
//         if (!result.success) {
//             alert(result.error ?? "Failed to delete.");
//             setDeleting(false);
//         }
//     }

//     return (
//         <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
//             {/* Icon + Title */}
//             <div className="flex items-start gap-3">
//                 <div className="p-2 bg-blue-50 rounded-lg shrink-0">
//                     <FileText className="w-5 h-5 text-[#1B2A4A]" />
//                 </div>
//                 <div className="min-w-0">
//                     <p className="font-medium text-gray-900 text-sm truncate">
//                         {material.title}
//                     </p>
//                     {material.tag && (
//                         <Badge variant="secondary" className="mt-1 text-xs">
//                             <Tag className="w-3 h-3 mr-1" />
//                             {material.tag}
//                         </Badge>
//                     )}
//                 </div>
//             </div>

//             {/* Description */}
//             {material.description && (
//                 <p className="text-xs text-gray-500 line-clamp-2">
//                     {material.description}
//                 </p>
//             )}

//             {/* Actions */}
//             <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-100">
//                 <a
//                     href={material.file_url}
//                     target="_blank"
//                     rel="noopener noreferrer"
//                     className="flex-1"
//                 >
//                     <Button variant="outline" size="sm" className="w-full text-xs">
//                         <Download className="w-3 h-3 mr-1" />
//                         Download
//                     </Button>
//                 </a>
//                 <Button
//                     variant="ghost"
//                     size="sm"
//                     onClick={handleDelete}
//                     disabled={deleting}
//                     className="text-red-500 hover:text-red-600 hover:bg-red-50"
//                 >
//                     <Trash2 className="w-4 h-4" />
//                 </Button>
//             </div>
//         </div>
//     );
// }
