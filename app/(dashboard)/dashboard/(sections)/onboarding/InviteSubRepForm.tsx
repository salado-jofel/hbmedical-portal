"use client";

import { useActionState, useEffect } from "react";
import { Loader2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { inviteSubRep } from "@/app/(dashboard)/dashboard/(services)/invite-tokens/actions";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";

export function InviteSubRepForm() {
  const [state, formAction, isPending] = useActionState<
    IInviteTokenFormState | null,
    FormData
  >(inviteSubRep, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Invite sent successfully.");
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="subrep_first_name" className="text-xs">
            First Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="subrep_first_name"
            name="first_name"
            placeholder="John"
            className="h-9 text-sm"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="subrep_last_name" className="text-xs">
            Last Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="subrep_last_name"
            name="last_name"
            placeholder="Doe"
            className="h-9 text-sm"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="subrep_email" className="text-xs">
          Email <span className="text-red-400">*</span>
        </Label>
        <Input
          id="subrep_email"
          name="email"
          type="email"
          placeholder="john@example.com"
          className="h-9 text-sm"
          required
        />
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
        className="w-full bg-[#e8821a] hover:bg-[#e8821a]/90 text-white gap-1.5"
      >
        {isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <UserPlus className="w-3.5 h-3.5" />
        )}
        Send Invite
      </Button>

      <p className="text-xs text-slate-400">
        Sub-reps you invite will be linked to your account.
      </p>
    </form>
  );
}
