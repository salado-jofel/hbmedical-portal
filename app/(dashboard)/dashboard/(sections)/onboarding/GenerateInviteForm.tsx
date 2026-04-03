"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Plus, Copy, Check } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateInviteToken } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";
import type { IAccount } from "@/utils/interfaces/accounts";

const ROLE_OPTIONS = [
  { value: "clinical_provider", label: "Clinical Provider" },
  { value: "clinical_staff", label: "Clinical Staff" },
];

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

interface GenerateInviteFormProps {
  accounts: IAccount[];
  baseUrl: string;
}

export function GenerateInviteForm({ accounts, baseUrl }: GenerateInviteFormProps) {
  const [state, formAction, isPending] = useActionState<
    IInviteTokenFormState | null,
    FormData
  >(generateInviteToken, null);

  const [copied, setCopied] = useState(false);

  const generatedUrl =
    state?.success && state.token ? `${baseUrl}/invite/${state.token}` : null;

  useEffect(() => {
    if (!state) return;
    if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  function handleCopy() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        {/* Account (optional) */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Account{" "}
            <span className="text-slate-400 font-normal">(optional)</span>
          </Label>
          <Select name="facility_id" defaultValue="none">
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="No account linked" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-sm text-slate-400">
                No account linked
              </SelectItem>
              {accounts
                .filter((a) => !!a.id)
                .map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-sm">
                    {a.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Role */}
        <div className="space-y-1.5">
          <Label className="text-xs">
            Role <span className="text-red-400">*</span>
          </Label>
          <Select name="role_type" defaultValue="clinical_staff">
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Expiry */}
        <div className="space-y-1.5">
          <Label className="text-xs">Link expires in</Label>
          <Select name="expires_in_days" defaultValue="30">
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPIRY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {state?.error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          className="w-full bg-[#15689E] hover:bg-[#15689E]/90 text-white gap-1.5"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          Generate invite link
        </Button>
      </form>

      {/* Show generated link immediately */}
      {generatedUrl && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium">Your invite link is ready:</p>
          <div
            className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 cursor-pointer group"
            onClick={handleCopy}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && handleCopy()}
          >
            <p className="text-xs text-green-700 font-mono truncate flex-1">{generatedUrl}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleCopy(); }}
              className="shrink-0"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-green-500 group-hover:text-green-700" />
              )}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            This link is now saved below. Share it with the clinic user to join the portal.
          </p>
        </div>
      )}
    </div>
  );
}
