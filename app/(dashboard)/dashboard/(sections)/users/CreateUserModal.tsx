"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
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
import { createUser } from "@/app/(dashboard)/dashboard/(services)/users/actions";
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
  const [state, formAction, isPending] = useActionState<
    IUserFormState | null,
    FormData
  >(createUser, null);

  const [roleValue, setRoleValue] = useState("sales_representative");

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("User created and invite sent.");
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#15689E]" />
            Create User
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4 pt-2">
          <input type="hidden" name="role" value={roleValue} />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className="text-xs">
                First Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="first_name"
                name="first_name"
                placeholder="John"
                className="h-9 text-sm"
                required
              />
              {state?.fieldErrors?.first_name && (
                <p className="text-xs text-red-500">{state.fieldErrors.first_name}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="last_name" className="text-xs">
                Last Name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="last_name"
                name="last_name"
                placeholder="Doe"
                className="h-9 text-sm"
                required
              />
              {state?.fieldErrors?.last_name && (
                <p className="text-xs text-red-500">{state.fieldErrors.last_name}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              Email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              className="h-9 text-sm"
              required
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-red-500">{state.fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Role <span className="text-red-400">*</span>
            </Label>
            <Select value={roleValue} onValueChange={setRoleValue}>
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
            {state?.fieldErrors?.role && (
              <p className="text-xs text-red-500">{state.fieldErrors.role}</p>
            )}
          </div>

          <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
            An invitation email will be sent to the user to set their password.
          </p>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1 h-9"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 h-9 bg-[#15689E] hover:bg-[#15689E]/90 text-white"
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
