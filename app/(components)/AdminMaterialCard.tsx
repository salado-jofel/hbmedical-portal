"use client";

import { ReactNode, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { cn } from "@/utils/utils";
import type { MaterialCategory } from "@/app/(components)/MaterialCard";

interface AdminMaterialCardProps {
  id: string;
  title: string;
  description?: string | null;
  tag?: string | null;
  fileUrl: string;
  onDownload: (fileUrl: string) => Promise<string>;
  onDelete: (id: string) => Promise<void>;
  icon?: ReactNode;
  tagSeparator?: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  isActive?: boolean;
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

export function AdminMaterialCard({
  id,
  title,
  description,
  tag,
  fileUrl,
  onDownload,
  onDelete,
  icon,
  tagSeparator = " - ",
  selected,
  onToggleSelect,
  isActive = true,
  category,
}: AdminMaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleConfirmDelete() {
    try {
      setDeleting(true);
      await onDelete(id);
      setConfirmOpen(false);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div
        className={cn(
          "group relative flex flex-col min-h-[280px] overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-sm transition-all duration-150 hover:shadow-md",
          selected
            ? "border-[var(--navy)] ring-2 ring-[var(--navy)]/20"
            : "border-slate-200 hover:border-slate-300",
          !isActive && "opacity-60",
        )}
      >
        <button
          type="button"
          onClick={() => onToggleSelect(id)}
          className={cn(
            "absolute left-3 top-3 z-20 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
            selected
              ? "border-[var(--navy)] bg-white"
              : "border-slate-300 bg-white hover:border-[var(--navy)]",
          )}
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="h-3 w-3">
              <path
                d="M1 4l3 3 5-6"
                stroke="var(--navy)"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="absolute right-0 top-0 z-20 flex h-6 w-6 items-center justify-center rounded-bl-lg bg-red-500/90 text-white transition hover:bg-red-600"
          aria-label="Delete material"
        >
          <Trash2 className="h-3 w-3" />
        </button>

        {!isActive && (
          <div className="absolute right-10 top-3 z-20 rounded-full bg-[var(--text3)]/70 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            Inactive
          </div>
        )}

        <div className={cn("relative flex items-start justify-between px-5 py-4 pl-10", styles.headerBg)}>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm", styles.iconText)}>
            {icon}
          </div>
          {(prefix || label) && (
            <div className={cn(
              "inline-flex max-w-[55%] items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide mt-8",
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

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(val) => {
          if (!deleting) setConfirmOpen(val);
        }}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
        title="Delete Material"
        description={`Are you sure you want to delete "${title}"? This will permanently remove the file from storage.`}
        confirmLabel="Delete"
      />
    </>
  );
}
