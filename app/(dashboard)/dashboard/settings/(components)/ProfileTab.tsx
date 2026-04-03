"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import { PasswordInput } from "@/app/(components)/PasswordInput";
import {
  updateProfile,
  changePassword,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";
import { ROLE_LABELS } from "@/utils/helpers/role";
import type { Profile, IProfileFormState, IChangePasswordFormState } from "@/utils/interfaces/profiles";

interface ProfileTabProps {
  profile: Profile;
}

export function ProfileTab({ profile }: ProfileTabProps) {
  /* ── Profile form ── */
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [profileState, profileAction, isProfilePending] = useActionState<
    IProfileFormState | null,
    FormData
  >(updateProfile, null);

  useEffect(() => {
    if (!profileState) return;
    if (profileState.success) {
      toast.success("Profile updated.");
    } else if (profileState.error) {
      toast.error(profileState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState]);

  /* ── Change password form ── */
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwState, pwAction, isPwPending] = useActionState<
    IChangePasswordFormState | null,
    FormData
  >(changePassword, null);

  useEffect(() => {
    if (!pwState) return;
    if (pwState.success) {
      toast.success("Password changed. Signing you out…");
      // Sign out after toast — signOut redirects to /sign-in
      setTimeout(() => signOut(), 1200);
    } else if (pwState.error) {
      toast.error(pwState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pwState]);

  const pwMismatch =
    confirmPassword.length > 0 && newPassword !== confirmPassword;
  const pwTooShort = newPassword.length > 0 && newPassword.length < 8;

  return (
    <div className="space-y-8">
      {/* ── Profile form ── */}
      <form action={profileAction} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="first_name" className="text-xs">
              First name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="first_name"
              name="first_name"
              defaultValue={profile.first_name}
              required
              className="h-9 text-sm"
            />
            {profileState?.fieldErrors?.first_name && (
              <p className="text-xs text-red-500">{profileState.fieldErrors.first_name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="last_name" className="text-xs">
              Last name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="last_name"
              name="last_name"
              defaultValue={profile.last_name}
              required
              className="h-9 text-sm"
            />
            {profileState?.fieldErrors?.last_name && (
              <p className="text-xs text-red-500">{profileState.fieldErrors.last_name}</p>
            )}
          </div>
        </div>

        {/* Email — read only */}
        <div className="space-y-1.5">
          <Label className="text-xs text-[#64748B]">Email</Label>
          <p className="text-sm h-9 flex items-center px-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]">
            {profile.email}
          </p>
        </div>

        {/* Role — read only */}
        <div className="space-y-1.5">
          <Label className="text-xs text-[#64748B]">Role</Label>
          <p className="text-sm h-9 flex items-center px-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#64748B]">
            {ROLE_LABELS[profile.role] ?? profile.role}
          </p>
        </div>

        {/* Phone */}
        <PhoneInputField
          value={phone}
          onChange={(val) => setPhone(val)}
          label="Phone"
          theme="light"
          error={profileState?.fieldErrors?.phone}
        />
        {/* Only submit phone if it's a real number (more than just a country code) */}
        {phone && phone.length > 4 && (
          <input type="hidden" name="phone" value={phone} />
        )}

        {profileState?.error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {profileState.error}
          </p>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={isProfilePending}
            className="bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {isProfilePending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>

      {/* ── Divider ── */}
      <div className="border-t border-[#E2E8F0]" />

      {/* ── Change password ── */}
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">Change Password</p>
          <p className="text-xs text-[#64748B] mt-0.5">
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
              className="bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
            >
              {isPwPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Change password
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
