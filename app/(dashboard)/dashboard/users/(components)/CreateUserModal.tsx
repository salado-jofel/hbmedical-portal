"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createUser } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import { useAppDispatch } from "@/store/hooks";
import { addUserToStore } from "@/app/(dashboard)/dashboard/users/(redux)/users-slice";
import type { IUserFormState } from "@/utils/interfaces/users";
import { EXPIRY_OPTIONS } from "@/utils/constants/onboarding";

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "support_staff", label: "Support Staff" },
];

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const dispatch = useAppDispatch();

  const [state, formAction, isPending] = useActionState<
    IUserFormState | null,
    FormData
  >(createUser, null);

  const [roleValue, setRoleValue] = useState("admin");

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      if (state.user) {
        dispatch(addUserToStore(state.user));
        toast.success("User created and invite sent.");
      } else {
        // Sales rep invites go through the /invite/:token flow — no user row
        // is created until the invitee completes signup.
        toast.success("Invite sent. Rep will appear here once they sign up.");
      }
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader className="flex items-center gap-2 pb-4 border-b border-[var(--border)] mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
            <UserPlus className="w-4 h-4 text-[var(--navy)]" />
            Create User
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="role" value={roleValue} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className="text-xs font-medium text-[#374151] block mb-1.5">
                First Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="first_name"
                name="first_name"
                placeholder="John"
                className="h-9 text-sm border-[var(--border)] bg-white text-[var(--navy)] placeholder:text-[var(--text3)] focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10 rounded-lg transition-colors"
                required
              />
              {state?.fieldErrors?.first_name && (
                <p className="text-xs text-red-500">{state.fieldErrors.first_name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="last_name" className="text-xs font-medium text-[#374151] block mb-1.5">
                Last Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="last_name"
                name="last_name"
                placeholder="Doe"
                className="h-9 text-sm border-[var(--border)] bg-white text-[var(--navy)] placeholder:text-[var(--text3)] focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10 rounded-lg transition-colors"
                required
              />
              {state?.fieldErrors?.last_name && (
                <p className="text-xs text-red-500">{state.fieldErrors.last_name}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-medium text-[#374151] block mb-1.5">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              className="h-9 text-sm border-[var(--border)] bg-white text-[var(--navy)] placeholder:text-[var(--text3)] focus:border-[var(--navy)] focus:ring-2 focus:ring-[var(--navy)]/10 rounded-lg transition-colors"
              required
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-red-500">{state.fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#374151] block mb-1.5">
              Role <span className="text-red-500">*</span>
            </Label>
            <Select value={roleValue} onValueChange={setRoleValue}>
              <SelectTrigger className="h-9 text-sm border-[var(--border)] bg-white text-[var(--navy)] rounded-lg">
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
            {state?.fieldErrors?.role && (
              <p className="text-xs text-red-500">{state.fieldErrors.role}</p>
            )}
          </div>

          {/* Link expires in — mirrors the dropdown shown on the
              Onboarding-side Clinic / Sales Rep invite forms. The chosen
              value is enforced server-side via invite_tokens.expires_at. */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-[#374151] block mb-1.5">
              Link expires in
            </Label>
            <Select name="expires_in_days" defaultValue="30">
              <SelectTrigger className="h-9 text-sm border-[var(--border)] bg-white text-[var(--navy)] rounded-lg">
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

          <p className="text-xs text-[var(--text2)] bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2">
            An invitation email will be sent to the user to set their password
            and complete their account setup.
          </p>

          <div className="flex gap-2 pt-4 border-t border-[var(--border)] mt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9 border-[var(--border)] text-[#374151] hover:bg-[var(--bg)] rounded-lg transition-colors"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Send Invite"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
