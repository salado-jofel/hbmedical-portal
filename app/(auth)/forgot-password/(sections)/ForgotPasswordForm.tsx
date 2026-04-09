"use client";

import React, { useActionState, useState } from "react";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { forgotPassword } from "../(services)/actions";
import SubmitButton from "@/app/(components)/SubmitButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import { AuthField } from "@/app/(components)/AuthField";
import { HBLogo } from "@/app/(components)/HBLogo";
import { MailCheck } from "lucide-react";

export default function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(forgotPassword, null);
  const [email, setEmail] = useState("");

  const searchParams = useSearchParams();
  const linkError =
    searchParams.get("error") === "invalid_link"
      ? "That reset link is invalid or has expired. Please request a new one."
      : null;

  const isFormValid = email.trim() !== "";

  if (state?.success) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none text-center">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center">
          <HBLogo variant="light" size="lg" />
        </div>

        {/* Mail icon */}
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
          <MailCheck className="w-8 h-8 text-emerald-600" />
        </div>

        <h2 className="text-2xl font-bold text-[#0F172A] mb-3">Check your email</h2>

        <p className="text-sm text-[#64748B] mb-8 leading-relaxed">
          We&apos;ve sent a password reset link to your email. Click the link to
          set a new password for your{" "}
          <span className="text-[var(--navy)] font-medium">HB Medical</span> account.
        </p>

        <div className="space-y-4">
          <SubmitButton
            type="button"
            variant="outline"
            size="default"
            cta={
              <Link
                href="/sign-in"
                className="flex gap-2 items-center justify-center w-full h-full"
              >
                Back to login
              </Link>
            }
            classname="h-9 w-full font-medium border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] rounded-lg transition-colors"
          />

          <p className="text-xs text-[#94A3B8]">
            Didn&apos;t receive an email? Check your spam folder or try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none">
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center">
        <HBLogo variant="light" size="lg" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] text-center">Forgot password?</h2>
      <p className="text-sm text-[#64748B] text-center mt-1.5 mb-8">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form action={formAction} className="space-y-5">
        <AuthField
          id="email"
          name="email"
          label="Email"
          icon={<Mail className="w-4 h-4" />}
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {(linkError || state?.error) && (
          <ErrorAlert errorMessage={(linkError || state?.error)!} />
        )}

        <div className="space-y-3 pt-1">
          <SubmitButton
            classname="h-9 w-full font-medium bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            isPending={isPending}
            disabled={!isFormValid}
            type="submit"
            cta="Send Reset Link"
            variant="default"
            size="default"
            isPendingMesssage="Sending..."
          />
        </div>
      </form>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[var(--navy)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}
