"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  consumeStaffInvite,
  type StaffInviteSignUpState,
} from "../(services)/staff-actions";

interface Props {
  token: string;
  email: string;
  defaultFirstName: string;
  defaultLastName: string;
  roleLabel: string;
  invitedBy: string;
}

/**
 * Slimmed-down signup form for admin / support_staff invites issued via
 * Create User modal. They don't need facility / clinic / contracts steps —
 * just confirm name and pick a password. Auth user + profile are created
 * server-side when this form submits (deferred-creation pattern).
 */
export function StaffInviteSignUpForm({
  token,
  email,
  defaultFirstName,
  defaultLastName,
  roleLabel,
  invitedBy,
}: Props) {
  const [state, formAction, isPending] = useActionState<
    StaffInviteSignUpState | null,
    FormData
  >(consumeStaffInvite, null);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="flex justify-center">
        <MeridianLogo variant="light" size="md" />
      </div>

      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 space-y-5">
        <div className="space-y-1.5 text-center">
          <h1 className="text-xl font-bold text-[#0F172A]">
            Welcome to Meridian Portal
          </h1>
          <p className="text-xs text-[#64748B] leading-relaxed">
            <strong>{invitedBy}</strong> invited you to join as{" "}
            <strong>{roleLabel}</strong>. Confirm your name and set a password
            to activate your account.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <Label className="text-xs text-[#475569]">Email</Label>
            <Input
              value={email}
              readOnly
              className="h-9 text-sm bg-[#F8FAFC] text-[#64748B] cursor-not-allowed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name" className="text-xs text-[#475569]">
                First name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="first_name"
                name="first_name"
                defaultValue={defaultFirstName}
                required
                className="h-9 text-sm"
              />
              {state?.fieldErrors?.first_name && (
                <p className="text-xs text-red-500">
                  {state.fieldErrors.first_name}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name" className="text-xs text-[#475569]">
                Last name <span className="text-red-400">*</span>
              </Label>
              <Input
                id="last_name"
                name="last_name"
                defaultValue={defaultLastName}
                required
                className="h-9 text-sm"
              />
              {state?.fieldErrors?.last_name && (
                <p className="text-xs text-red-500">
                  {state.fieldErrors.last_name}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs text-[#475569]">
              Password <span className="text-red-400">*</span>
            </Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-9 text-sm"
            />
            {state?.fieldErrors?.password && (
              <p className="text-xs text-red-500">
                {state.fieldErrors.password}
              </p>
            )}
            <p className="text-[11px] text-[#94A3B8]">
              At least 8 characters.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password" className="text-xs text-[#475569]">
              Confirm password <span className="text-red-400">*</span>
            </Label>
            <Input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="h-9 text-sm"
            />
            {state?.fieldErrors?.confirm_password && (
              <p className="text-xs text-red-500">
                {state.fieldErrors.confirm_password}
              </p>
            )}
          </div>

          {state?.error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg text-sm"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              "Activate account"
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
