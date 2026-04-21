"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Send, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateInviteToken } from "@/app/(dashboard)/dashboard/onboarding/(services)/invite-actions";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";
import { EXPIRY_OPTIONS } from "@/utils/constants/onboarding";

export function InviteSalesRepForm() {
  const [state, formAction, isPending] = useActionState<
    IInviteTokenFormState | null,
    FormData
  >(generateInviteToken, null);

  const [sentEmail, setSentEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.success && state.invitedEmail) {
      setSentEmail(state.invitedEmail);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  function resetForm() {
    setSentEmail(null);
  }

  if (sentEmail) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Invite sent to <span className="font-medium">{sentEmail}</span>
        </div>
        <button
          onClick={resetForm}
          className="text-sm text-[var(--text2)] underline underline-offset-2 hover:text-[var(--navy)] transition-colors"
        >
          Send another invite
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="role_type" value="sales_representative" />

      <div className="space-y-1.5">
        <Label className="text-xs text-[var(--text2)]">Inviting as</Label>
        <p className="text-sm h-9 flex items-center px-3 rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--navy)] font-medium">
          Sales Rep
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sales_rep_invite_email" className="text-xs">
          Email <span className="text-red-400">*</span>
        </Label>
        <Input
          id="sales_rep_invite_email"
          type="email"
          name="email"
          placeholder="rep@company.com"
          required
          className="h-9 text-sm"
        />
        {state?.fieldErrors?.email && (
          <p className="text-xs text-red-500">{state.fieldErrors.email}</p>
        )}
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
        className="w-full h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Send className="w-3.5 h-3.5" />
        )}
        Send invite
      </Button>
    </form>
  );
}
