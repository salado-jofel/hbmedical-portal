"use client";

import { useState } from "react";
import { Copy, Check, Download, Printer, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * One-time display of backup recovery codes after MFA enrollment or
 * regeneration. The user MUST click the acknowledgement button before they
 * can leave this screen — the only friction stopping them from skipping past
 * the codes and getting locked out later.
 *
 * Used in two places:
 *   - /dashboard/settings → MfaTab (regenerate / first-time setup from settings)
 *   - /sign-in/mfa        → MfaEnrollForm (forced enrollment after sign-in)
 *
 * Codes are plaintext; treat them as sensitive. They've been displayed once
 * server-side, hashed in DB, and won't be retrievable after this view.
 */
export function BackupCodesPanel({
  codes,
  onAcknowledge,
}: {
  codes: string[];
  onAcknowledge: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function handleDownload() {
    const blob = new Blob(
      [
        "HB Medical Portal — Backup Codes\n",
        "================================\n\n",
        `Generated: ${new Date().toISOString()}\n\n`,
        "Each code can be used ONCE if you lose your authenticator.\n",
        "Store these somewhere safe (password manager / printed copy).\n\n",
        ...codes.map((c) => `  ${c}\n`),
      ],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hbmedical-backup-codes-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>HB Medical Backup Codes</title>
      <style>
        body { font-family: monospace; padding: 40px; }
        h1 { font-family: sans-serif; }
        .codes { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-top: 20px; }
        .code { padding: 8px 12px; border: 1px solid #ccc; border-radius: 4px; font-size: 16px; }
        .note { font-family: sans-serif; margin-top: 30px; color: #555; max-width: 540px; }
      </style></head><body>
      <h1>HB Medical Portal — Backup Codes</h1>
      <p>Generated: ${new Date().toISOString()}</p>
      <div class="codes">${codes.map((c) => `<div class="code">${c}</div>`).join("")}</div>
      <p class="note">Each code can be used once if you lose access to your authenticator. Keep these somewhere only you can find — anyone holding a code can sign in if they also know your password.</p>
      </body></html>
    `);
    w.document.close();
    w.focus();
    w.print();
  }

  function handleCopyAll() {
    navigator.clipboard.writeText(codes.join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[var(--gold)]/40 bg-[#fffbea] p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--gold)] mt-0.5" />
          <div>
            <h3 className="text-[14px] font-semibold text-[var(--navy)]">
              Save these recovery codes
            </h3>
            <p className="mt-1 text-[12px] text-[var(--text2)]">
              These codes let you sign in if you ever lose your authenticator.
              Each can be used only once.{" "}
              <strong>This is the only time we&apos;ll show them to you.</strong>{" "}
              Save them in a password manager, print them, or take a screenshot.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-[var(--border)] bg-[var(--bg)] p-4 font-mono text-[13px]">
        {codes.map((c, i) => (
          <div key={c} className="flex items-center gap-2 text-[var(--navy)]">
            <span className="text-[10px] text-[var(--text3)] w-4 text-right">
              {i + 1}.
            </span>
            <span className="tracking-wider">{c}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={handleDownload}>
          <Download className="h-3 w-3 mr-1" /> Download .txt
        </Button>
        <Button size="sm" variant="outline" onClick={handlePrint}>
          <Printer className="h-3 w-3 mr-1" /> Print
        </Button>
        <Button size="sm" variant="outline" onClick={handleCopyAll}>
          {copied ? (
            <>
              <Check className="h-3 w-3 mr-1" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3 mr-1" /> Copy all
            </>
          )}
        </Button>
        <div className="flex-1" />
        <Button
          onClick={onAcknowledge}
          className="bg-[var(--navy)] text-white hover:bg-[var(--navy)]/90"
        >
          I&apos;ve saved them — continue
        </Button>
      </div>
    </div>
  );
}
