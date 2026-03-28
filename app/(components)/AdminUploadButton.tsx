"use client";

import { useRef, useState } from "react";
import { Upload, X, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface AdminUploadButtonProps {
  onUpload: (formData: FormData) => Promise<void>;
}

export function AdminUploadButton({ onUpload }: AdminUploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [tag, setTag] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFile(null);
    setTitle("");
    setTag("");
    setSortOrder("0");
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    if (loading) return;
    setOpen(false);
    resetForm();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !title.trim() || !tag.trim()) {
      setError("File, title, and tag are required.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("tag", tag.trim());
    formData.append("sort_order", sortOrder);

    try {
      setLoading(true);
      setError(null);
      await onUpload(formData);
      setOpen(false);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-[#1f6da1] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155b8f]"
      >
        <Upload className="h-4 w-4" />
        Upload
      </button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Material</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            {/* File picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                PDF File <span className="text-red-500">*</span>
              </label>
              {file ? (
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0 text-[#1f6da1]" />
                  <span className="flex-1 truncate text-sm text-slate-700">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-lg border-2 border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500 transition hover:border-[#1f6da1] hover:text-[#1f6da1]"
                >
                  Click to choose a PDF file
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setFile(f);
                  if (f && !title) setTitle(f.name.replace(/\.pdf$/i, ""));
                }}
              />
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Product Brochure 2026"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1f6da1] focus:ring-1 focus:ring-[#1f6da1]"
              />
            </div>

            {/* Tag */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Tag <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="e.g. brochure"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1f6da1] focus:ring-1 focus:ring-[#1f6da1]"
              />
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Sort Order
              </label>
              <input
                type="number"
                min="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#1f6da1] focus:ring-1 focus:ring-[#1f6da1]"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-xl bg-[#1f6da1] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155b8f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
