"use client";

import { ReactNode, useState } from "react";
import { Download } from "lucide-react";

interface MaterialCardProps {
  title: string;
  description?: string | null;
  tag?: string | null;
  fileUrl: string;
  onDownload: (fileUrl: string) => Promise<string>;
  icon?: ReactNode;
  tagSeparator?: string;
}

function splitTag(tag?: string | null, separator = " - ") {
  if (!tag) {
    return { prefix: "", label: "" };
  }

  if (!separator || !tag.includes(separator)) {
    return { prefix: "", label: tag };
  }

  const [prefix, ...rest] = tag.split(separator);
  return {
    prefix: prefix?.trim() ?? "",
    label: rest.join(separator).trim(),
  };
}

export function MaterialCard({
  title,
  description,
  tag,
  fileUrl,
  onDownload,
  icon,
  tagSeparator = " - ",
}: MaterialCardProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const { prefix, label } = splitTag(tag, tagSeparator);

  async function handleDownloadClick() {
    try {
      setIsDownloading(true);
      const signedUrl = await onDownload(fileUrl);

      if (!signedUrl) {
        throw new Error("Missing download URL");
      }

      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]">
      <div className="relative min-h-[144px] bg-gradient-to-br from-[#1f6da1] to-[#155b8f] px-5 pb-5 pt-5">
        <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[999px] bg-white/8" />
        <div className="absolute right-5 top-5 z-10 flex max-w-[65%] justify-end">
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
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/14 text-white shadow-inner shadow-white/10">
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
  );
}
