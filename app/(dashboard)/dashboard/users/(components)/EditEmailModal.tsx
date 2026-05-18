"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Mail, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateUserEmail } from "@/app/(dashboard)/dashboard/users/(services)/actions";
import { useAppDispatch } from "@/store/hooks";
import { updateUserInStore } from "@/app/(dashboard)/dashboard/users/(redux)/users-slice";
import type { IUser, IUserFormState } from "@/utils/interfaces/users";

interface EditEmailModalProps {
  open: boolean;
  onClose: () => void;
  /** The user being edited. `null` while modal is closed. */
  user: IUser | null;
}

/**
 * Admin-only modal to change a user's login email. Hits the
 * `updateUserEmail` server action which:
 *   - validates uniqueness against other profiles + active invite_tokens
 *   - flips auth.users.email via the admin SDK (no Supabase confirmation)
 *   - syncs profiles.email
 *   - revokes the target user's SMS MFA sessions (force re-MFA on next req)
 *   - emails both old + new addresses
 *   - logs to phi_access_log (HIPAA §164.312(b))
 *
 * On success the user must sign in again with the new email; their next
 * sign-in also re-challenges SMS MFA.
 */
export function EditEmailModal({ open, onClose, user }: EditEmailModalProps) {
  const dispatch = useAppDispatch();
  const [state, formAction, isPending] = useActionState<
    IUserFormState | null,
    FormData
  >(updateUserEmail, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      if (state.user) dispatch(updateUserInStore(state.user));
      if (state.warning) {
        toast(state.warning, { icon: "⚠️" });
      } else {
        toast.success("Email updated. The user must sign in with the new address.");
      }
      onClose();
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md sm:rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader className="flex items-center gap-2 pb-4 border-b border-[var(--border)] mb-4">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-[var(--navy)]">
            <Mail className="w-4 h-4 text-[var(--navy)]" />
            Change user email
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="user_id" value={user.id} />

          {/* Current email — read-only context */}
          <div className="space-y-1">
            <Label className="text-xs">Current email</Label>
            <p className="text-sm h-9 flex items-center px-3 rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)]">
              {user.email}
            </p>
          </div>

          {/* New email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs">
              New email <span className="text-red-400">*</span>
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoFocus
              placeholder="new.address@example.com"
              defaultValue=""
              className="h-9 text-sm"
            />
            {state?.fieldErrors?.email && (
              <p className="text-xs text-red-500">{state.fieldErrors.email}</p>
            )}
          </div>

          {/* Heads-up box — admin should know the side effects before clicking
              Update so they can warn the user out-of-band. */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <div className="space-y-1">
              <p className="font-semibold">What happens next</p>
              <ul className="list-disc list-outside ml-4 space-y-0.5">
                <li>The user signs in with the new email going forward.</li>
                <li>SMS MFA is reset — the user is re-challenged on next sign-in.</li>
                <li>Both old and new addresses receive a notification email.</li>
                <li>Action is logged to the audit trail.</li>
              </ul>
            </div>
          </div>

          {state?.error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

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
              className="flex-1 h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-sm"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                "Update email"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
