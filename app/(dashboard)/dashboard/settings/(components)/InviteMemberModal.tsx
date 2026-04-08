"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Copy, Check, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateMemberInviteToken } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";
import { EXPIRY_OPTIONS } from "@/utils/constants/onboarding";
import { MEMBER_ROLE_OPTIONS } from "@/utils/constants/settings";

export function InviteMemberModal({ baseUrl }: { baseUrl: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const [state, formAction, isPending] = useActionState<
    IInviteTokenFormState | null,
    FormData
  >(generateMemberInviteToken, null);

  const generatedUrl =
    state?.success && state.token ? `${baseUrl}/invite/${state.token}` : null;

  useEffect(() => {
    if (!state) return;
    if (state.error) toast.error(state.error);
  }, [state]);

  function handleCopy() {
    if (!generatedUrl) return;
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
        >
          <UserPlus className="w-4 h-4" />
          Invite Member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md sm:rounded-2xl border border-[#E2E8F0] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Role <span className="text-red-400">*</span>
              </Label>
              <Select name="role_type" defaultValue="clinical_staff">
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEMBER_ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-sm">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              className="w-full bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Generate invite link"
              )}
            </Button>
          </form>

          {generatedUrl && (
            <div className="space-y-2">
              <p className="text-xs text-[#64748B] font-medium">Invite link ready:</p>
              <div
                className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 cursor-pointer group"
                onClick={handleCopy}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && handleCopy()}
              >
                <p className="text-xs text-emerald-700 font-mono truncate flex-1">{generatedUrl}</p>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-emerald-500 group-hover:text-emerald-700" />
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
