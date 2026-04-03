"use client";

import { useState } from "react";
import { Copy, Check, Trash2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/utils";
import { deleteInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { IInviteToken } from "@/utils/interfaces/invite-tokens";

interface InviteTokenCardProps {
  token: IInviteToken;
  baseUrl: string;
}

export function InviteTokenCard({ token, baseUrl }: InviteTokenCardProps) {
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const inviteUrl = `${baseUrl}/invite/${token.token}`;
  const isUsed = token.used_at !== null;
  const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteInviteToken(token.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className={cn(
        "bg-white border rounded-xl p-4 space-y-3",
        isUsed || isExpired ? "border-slate-100 opacity-60" : "border-slate-200",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-slate-800">
              {token.facility?.name ?? "No account linked"}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#15689E]/10 text-[#15689E] font-medium">
              {ROLE_LABELS[token.role_type]}
            </span>
            {isUsed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                Used
              </span>
            )}
            {isExpired && !isUsed && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                Expired
              </span>
            )}
          </div>

          {token.expires_at && !isUsed && !isExpired && (
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expires{" "}
              {new Date(token.expires_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isUsed && !isExpired && (
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={handleCopy}
              title="Copy invite link"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Delete token"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {!isUsed && !isExpired && (
        <div
          className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 cursor-pointer group"
          onClick={handleCopy}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && handleCopy()}
          title="Click to copy"
        >
          <p className="text-xs text-slate-500 font-mono truncate flex-1">{inviteUrl}</p>
          <Copy className="w-3 h-3 text-slate-400 group-hover:text-[#15689E] shrink-0 transition-colors" />
        </div>
      )}
    </div>
  );
}
