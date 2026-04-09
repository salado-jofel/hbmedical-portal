"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/app/(components)/PasswordInput";
import { changePassword } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";
import type { IChangePasswordFormState } from "@/utils/interfaces/profiles";

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwState, pwAction, isPwPending] = useActionState<
    IChangePasswordFormState | null,
    FormData
  >(changePassword, null);

  useEffect(() => {
    if (!pwState) return;
    if (pwState.success) {
      toast.success("Password changed. Signing you out…");
      setTimeout(() => signOut(), 1200);
    } else if (pwState.error) {
      toast.error(pwState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwState]);

  const pwMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const pwTooShort = newPassword.length > 0 && newPassword.length < 8;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-[var(--navy)]">Change Password</p>
        <p className="text-xs text-[var(--text2)] mt-0.5">
          You will be signed out after a successful change.
        </p>
      </div>

      <form action={pwAction} className="space-y-4">
        <PasswordInput
          id="new_password"
          name="new_password"
          label="New Password"
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          error={
            pwTooShort
              ? "Password must be at least 8 characters."
              : (pwState?.fieldErrors?.new_password ?? undefined)
          }
        />

        <PasswordInput
          id="confirm_password"
          name="confirm_password"
          label="Confirm Password"
          placeholder="••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          error={
            pwMismatch
              ? "Passwords do not match."
              : (pwState?.fieldErrors?.confirm_password ?? undefined)
          }
        />

        {pwState?.error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {pwState.error}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isPwPending || pwMismatch || pwTooShort || newPassword.length === 0}
            className="bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {isPwPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Change password
          </Button>
        </div>
      </form>
    </div>
  );
}
