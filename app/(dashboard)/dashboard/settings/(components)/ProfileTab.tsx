"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Smartphone, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import { ROLE_LABELS } from "@/utils/helpers/role";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { MyClinicCard } from "./MyClinicCard";
import type { Profile, IProfileFormState } from "@/utils/interfaces/profiles";
import type { IMyClinic } from "@/app/(dashboard)/dashboard/settings/(services)/actions";

interface ProfileTabProps {
  profile: Profile;
  clinic?: IMyClinic | null;
}

export function ProfileTab({ profile, clinic = null }: ProfileTabProps) {
  /* ── Profile form ── */
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
          <Label className="text-xs text-[var(--text2)]">Email</Label>
          <p className="text-sm h-9 flex items-center px-3 rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)]">
            {profile.email}
          </p>
        </div>

        {/* Role — read only */}
        <div className="space-y-1.5">
          <Label className="text-xs text-[var(--text2)]">Role</Label>
          <p className="text-sm h-9 flex items-center px-3 rounded-md bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)]">
            {ROLE_LABELS[profile.role] ?? profile.role}
          </p>
        </div>

        {/* Phone — display-only. The phone is an MFA credential; changing it
            requires a fresh SMS verification, so all edits go through the
            Security tab → "Update phone" flow. The hidden input below
            preserves the existing value on submit so updateProfile doesn't
            blank it. */}
        <div className="space-y-1.5">
          <Label className="text-xs">Phone</Label>
          <div className="flex items-center justify-between gap-3 h-9 px-3 rounded-md bg-[var(--bg)] border border-[var(--border)]">
            <span className="flex items-center gap-2 text-sm text-[var(--text2)] min-w-0">
              <Smartphone className="w-3.5 h-3.5 shrink-0 text-[var(--text3)]" />
              <span className="font-mono truncate">
                {profile.phone || "Not set"}
              </span>
            </span>
            {profile.phone && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700">
                <ShieldCheck className="w-3 h-3" />
                Verified
              </span>
            )}
          </div>
          <p className="text-[11px] text-[var(--text3)]">
            To change your phone, go to the{" "}
            <span className="font-medium text-[var(--navy)]">Security</span>{" "}
            tab — we&apos;ll text a code to confirm the new number.
          </p>
        </div>
        {profile.phone && (
          <input type="hidden" name="phone" value={profile.phone} />
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
            className="bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {isProfilePending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save changes
          </Button>
        </div>
      </form>

      {/* ── My Clinic (providers only) ── */}
      {clinic && (
        <>
          <div className="border-t border-[var(--border)]" />
          <MyClinicCard clinic={clinic} />
        </>
      )}

      {/* ── Divider ── */}
      <div className="border-t border-[var(--border)]" />

      {/* ── Change password ── */}
      <ChangePasswordForm />
    </div>
  );
}
