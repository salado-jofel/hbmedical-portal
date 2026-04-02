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

interface CreateUserModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLE_OPTIONS = [
  { value: "sales_representative", label: "Sales Rep" },
  { value: "support_staff", label: "Support Staff" },
];

export function CreateUserModal({ open, onClose }: CreateUserModalProps) {
  const dispatch = useAppDispatch();

  const [state, formAction, isPending] = useActionState<
    IUserFormState | null,
    FormData
  >(createUser, null);

  const [roleValue, setRoleValue] = useState("sales_representative");

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      if (state.user) dispatch(addUserToStore(state.user));
      toast.success("User created and invite sent.");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl border border-[#E2E8F0] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader className="flex items-center gap-2 pb-4 border-b border-[#F1F5F9] mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[#0F172A]">
            <UserPlus className="w-4 h-4 text-[#15689E]" />
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
                className="h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 rounded-lg transition-colors"
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
                className="h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 rounded-lg transition-colors"
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
              className="h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#15689E] focus:ring-2 focus:ring-[#15689E]/10 rounded-lg transition-colors"
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
              <SelectTrigger className="h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] rounded-lg">
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

          <p className="text-xs text-[#64748B] bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2">
            An invitation email will be sent to the user to set their password.
          </p>

          <div className="flex gap-2 pt-4 border-t border-[#F1F5F9] mt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9 border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] rounded-lg transition-colors"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-9 bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
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
