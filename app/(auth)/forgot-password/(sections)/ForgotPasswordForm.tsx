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
      <div className="w-full max-w-md select-none rounded-2xl border p-8 text-center bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
        {/* Logo */}
        <div className="relative z-10 mb-8 flex items-center justify-center py-10">
          <HBLogo variant="dark" size="lg" />
        </div>

        {/* Mail icon */}
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: "rgba(232,130,26,0.1)",
            border: "1px solid rgba(232,130,26,0.3)",
          }}
        >
          <MailCheck className="w-9 h-9" style={{ color: "#f5a255" }} />
        </div>

        <h2 className="text-xl font-bold text-white mb-3">Check your email</h2>

        <p
          className="text-sm mb-8 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          We&apos;ve sent a password reset link to your email. Click the link to
          set a new password for your{" "}
          <span style={{ color: "#f5a255" }}>HB Medical</span> account.
        </p>

        <div className="space-y-4">
          <SubmitButton
            type="button"
            variant="outline"
            size="lg"
            cta={
              <Link
                href="/sign-in"
                className="flex gap-2 items-center justify-center w-full h-full"
              >
                Back to login
              </Link>
            }
            classname="h-12 w-full font-bold transition-all active:scale-95"
            style={{
              background: "rgba(232,130,26,0.08)",
              border: "1px solid rgba(232,130,26,0.35)",
              color: "#f5a255",
            }}
          />

          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Didn&apos;t receive an email? Check your spam folder or try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Logo */}
      <div className="relative z-10 mb-8 flex items-center justify-center py-10">
        <HBLogo variant="dark" size="lg" />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Forgot password?</h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <AuthField
          id="email"
          name="email"
          label="Email"
          icon={<Mail className="w-4 h-4" style={{ color: "#f5a255" }} />}
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
            classname="h-12 w-full font-bold transition-all active:scale-95 text-white"
            style={{
              background: "linear-gradient(135deg, #e8821a, #d4741a)",
              boxShadow: isFormValid
                ? "0 4px 15px rgba(232,130,26,0.35)"
                : "none",
              ...(!isFormValid && {
                opacity: 0.45,
                cursor: "not-allowed",
              }),
            }}
            isPending={isPending}
            disabled={!isFormValid}
            type="submit"
            cta="Send Reset Link"
            variant="default"
            size="lg"
            isPendingMesssage="Sending..."
          />
        </div>
      </form>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a255")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.color = "rgba(255,255,255,0.35)")
          }
        >
          <ArrowLeft className="w-4 h-4" /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}
