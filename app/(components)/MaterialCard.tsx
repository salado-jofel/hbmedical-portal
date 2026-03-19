"use client";

import { useState } from "react";
import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ScrollText,
  FileCheck2,
  Receipt,
  ArrowDownToLine,
  Loader2,
} from "lucide-react";

function getDefaultIcon(tag?: string | null) {
  const t = tag?.toLowerCase() ?? "";
  if (t.includes("agreement") || t.includes("contract"))
    return <ScrollText className="w-6 h-6 text-white" />;
  if (t.includes("tax") || t.includes("w-9"))
    return <Receipt className="w-6 h-6 text-white" />;
  if (t.includes("i-9") || t.includes("verification"))
    return <FileCheck2 className="w-6 h-6 text-white" />;
  return <FileText className="w-6 h-6 text-white" />;
}

interface MaterialCardProps {
  title: string;
  description?: string | null;
  tag?: string | null;
  category?: string | null;
  fileUrl: string;
  onDownload: (fileUrl: string) => Promise<string>;
  icon?: ReactNode;
  tagSeparator?: string;
}

export function MaterialCard({
  title,
  description,
  tag,
  category,
  fileUrl,
  onDownload,
  icon,
  tagSeparator = "•",
}: MaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const signedUrl = await onDownload(fileUrl);
      const link = document.createElement("a");
      link.href = signedUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("[MaterialCard handleDownload]", err);
    } finally {
      setIsDownloading(false);
    }
  }

  const badgeLabel = tag?.split(tagSeparator)[0]?.trim() ?? "PDF";
  const tagSubtitle = tag?.includes(tagSeparator)
    ? tag.split(tagSeparator)[1]?.trim()
    : null;

  return (
    <div className="group bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col w-full">
      <div className="bg-linear-to-br from-[#2db0b0] to-[#1a8f8f] p-5 relative overflow-hidden">
        <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="absolute -bottom-6 -left-4 w-20 h-20 rounded-full bg-white/10" />

        <div className="relative z-10 flex items-start justify-between">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-sm">
            {icon ?? getDefaultIcon(tag)}
          </div>
          <span className="text-xs font-semibold bg-white/20 text-white px-2.5 py-1 rounded-full backdrop-blur-sm">
            {badgeLabel}
          </span>
        </div>

        <div className="relative z-10 mt-4">
          <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
            {title}
          </h3>
          {(tagSubtitle || category) && (
            <p className="text-xs text-white/70 mt-1">
              {tagSubtitle ?? category}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-4">
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-3">
          {description}
        </p>
        <Button
          type="button"
          onClick={handleDownload}
          disabled={isDownloading}
          className="w-full bg-[#2db0b0] hover:bg-[#249191] text-white text-sm font-medium cursor-pointer shadow-sm transition-all duration-200 disabled:opacity-70"
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <ArrowDownToLine className="w-4 h-4 mr-2" />
              Download
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
