"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReferralLinkBoxProps {
  url: string;
}

export function ReferralLinkBox({ url }: ReferralLinkBoxProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
      <p className="text-sm text-slate-600 font-mono truncate flex-1">{url}</p>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 shrink-0 gap-1.5"
        onClick={handleCopy}
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-green-600">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5" />
            <span className="text-xs">Copy</span>
          </>
        )}
      </Button>
    </div>
  );
}
