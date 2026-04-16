"use client";

import { ReactNode, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/utils/utils";

export type MaterialCategory = "marketing" | "contracts" | "training" | "onboarding";

interface MaterialCardProps {
  title: string;
  description?: string | null;
  tag?: string | null;
  fileUrl: string;
  onDownload: (fileUrl: string) => Promise<string>;
  icon?: ReactNode;
  tagSeparator?: string;
  category?: MaterialCategory;
}

const CATEGORY_STYLES: Record<MaterialCategory, {
  headerBg: string;
  iconText: string;
  tagBg: string;
  tagBorder: string;
  tagText: string;
}> = {
  marketing: {
    headerBg:   "bg-[var(--blue-lt)]",
    iconText:   "text-[var(--blue)]",
    tagBg:      "bg-[var(--blue-lt)]",
    tagBorder:  "border-[var(--blue)]/30",
    tagText:    "text-[var(--blue)]",
  },
  contracts: {
    headerBg:   "bg-[var(--purple-lt)]",
    iconText:   "text-[var(--purple)]",
    tagBg:      "bg-[var(--purple-lt)]",
    tagBorder:  "border-[var(--purple)]/30",
    tagText:    "text-[var(--purple)]",
  },
  training: {
    headerBg:   "bg-[var(--gold-lt)]",
    iconText:   "text-[var(--gold)]",
    tagBg:      "bg-[var(--gold-lt)]",
    tagBorder:  "border-[var(--gold-border)]",
    tagText:    "text-[var(--gold)]",
  },
  onboarding: {
    headerBg:   "bg-[var(--teal-lt)]",
    iconText:   "text-[var(--teal)]",
    tagBg:      "bg-[var(--teal-lt)]",
    tagBorder:  "border-[var(--teal)]/30",
    tagText:    "text-[var(--teal)]",
  },
};

const NEUTRAL_STYLES = {
  headerBg:   "bg-slate-50",
  iconText:   "text-[var(--text2)]",
  tagBg:      "bg-slate-100",
  tagBorder:  "border-slate-200",
  tagText:    "text-[var(--text2)]",
};

function splitTag(tag?: string | null, separator = " - ") {
  if (!tag) return { prefix: "", label: "" };
  if (!separator || !tag.includes(separator)) return { prefix: "", label: tag };
  const [prefix, ...rest] = tag.split(separator);
  return { prefix: prefix?.trim() ?? "", label: rest.join(separator).trim() };
}

export function MaterialCard({
  title,
  description,
  tag,
  fileUrl,
  onDownload,
  icon,
  tagSeparator = " - ",
  category,
}: MaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { prefix, label } = splitTag(tag, tagSeparator);
  const styles = category ? CATEGORY_STYLES[category] : NEUTRAL_STYLES;

  async function handleDownloadClick() {
    try {
      setIsDownloading(true);
      const signedUrl = await onDownload(fileUrl);
      if (!signedUrl) throw new Error("Missing download URL");
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="group flex flex-col min-h-[280px] overflow-hidden rounded-2xl border border-slate-200 bg-[var(--surface)] shadow-sm transition-all duration-150 hover:shadow-md hover:border-slate-300">
      <div className={cn("relative flex items-start justify-between px-5 py-4", styles.headerBg)}>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm", styles.iconText)}>
          {icon}
        </div>
        {(prefix || label) && (
          <div className={cn(
            "inline-flex max-w-[60%] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            styles.tagBg,
            styles.tagBorder,
            styles.tagText,
          )}>
            {prefix ? <span className="shrink-0">{prefix}</span> : null}
            {label ? (
              <span className="truncate normal-case tracking-normal">{label}</span>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col px-5 pb-5 pt-4">
        <h3
          className="text-[15px] font-semibold leading-snug text-[var(--navy)] line-clamp-2"
          title={title}
        >
          {title}
        </h3>
        <p
          className="mt-2 text-[13px] leading-5 text-[var(--text2)] line-clamp-3 flex-1"
          title={description || "No description available."}
        >
          {description || "No description available."}
        </p>
        <button
          type="button"
          onClick={handleDownloadClick}
          disabled={isDownloading}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[7px] bg-[var(--navy)] px-4 h-9 text-sm font-medium text-white transition-colors hover:bg-[var(--navy)]/90 disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Download className="h-4 w-4" />
          <span>{isDownloading ? "Preparing..." : "Download"}</span>
        </button>
      </div>
    </div>
  );
}
