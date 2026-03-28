"use client";

import { ReactNode, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import ConfirmModal from "@/app/(components)/ConfirmModal";

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
}

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
}: AdminMaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { prefix, label } = splitTag(tag, tagSeparator);

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
        className={`relative overflow-hidden rounded-2xl border bg-white shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)] ${
          selected ? "border-[#1f6da1] ring-2 ring-[#1f6da1]/30" : "border-slate-200"
        } ${!isActive ? "opacity-60" : ""}`}
      >
        {/* Checkbox overlay */}
        <button
          type="button"
          onClick={() => onToggleSelect(id)}
          className={`absolute left-3 top-3 z-20 flex h-5 w-5 items-center justify-center rounded border-2 transition ${
            selected
              ? "border-white bg-white"
              : "border-white/70 bg-white/20 hover:bg-white/40"
          }`}
          aria-label={selected ? "Deselect" : "Select"}
        >
          {selected && (
            <svg viewBox="0 0 10 8" className="h-3 w-3 fill-[#1f6da1]">
              <path d="M1 4l3 3 5-6" stroke="#1f6da1" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Delete button */}
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/80 text-white transition hover:bg-red-600"
          aria-label="Delete material"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>

        {/* Inactive badge */}
        {!isActive && (
          <div className="absolute right-12 top-3 z-20 rounded-full bg-slate-500/70 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
            Inactive
          </div>
        )}

        <div className="relative min-h-[144px] bg-gradient-to-br from-[#1f6da1] to-[#155b8f] px-5 pb-5 pt-5">
          <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[999px] bg-white/8" />
          <div className="absolute right-5 top-5 z-10 flex max-w-[55%] justify-end">
            {(prefix || label) && (
              <div className="inline-flex max-w-full items-center gap-1 rounded-full bg-white/18 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.02em] text-white backdrop-blur-sm">
                {prefix ? <span className="shrink-0">{prefix}</span> : null}
                {label ? (
                  <span className="truncate normal-case text-[10px] font-semibold tracking-normal">
                    {label}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-4 mt-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14 text-white shadow-inner shadow-white/10">
              {icon}
            </div>
            <h3 className="pr-28 text-[18px] font-semibold leading-[1.25] text-white">
              {title}
            </h3>
          </div>
        </div>

        <div className="px-5 pb-5 pt-4">
          <p className="min-h-[72px] text-[14px] leading-6 text-slate-600">
            {description || "No description available."}
          </p>

          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f6da1] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155b8f] disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Download className="h-4 w-4" />
            <span>{isDownloading ? "Preparing..." : "Download"}</span>
          </button>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(val) => { if (!deleting) setConfirmOpen(val); }}
        onConfirm={handleConfirmDelete}
        isLoading={deleting}
        title="Delete Material"
        description={`Are you sure you want to delete "${title}"? This will permanently remove the file from storage.`}
        confirmLabel="Delete"
      />
    </>
  );
}
