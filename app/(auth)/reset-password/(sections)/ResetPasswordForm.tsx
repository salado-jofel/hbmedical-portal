"use client";

import React, { useEffect, useState } from "react";
import { Lock, ArrowLeft, Loader2, LinkIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SubmitButton from "@/app/(components)/SubmitButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import { AuthField } from "@/app/(components)/AuthField";
import { PasswordToggle } from "@/app/(components)/PasswordToggle";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { validatePasswordsMatch } from "@/utils/validators/signup";

type PageStatus = "loading" | "ready" | "error";

export default function ResetPasswordForm() {
  const supabase = createClient();

  const [pageStatus, setPageStatus] = useState<PageStatus>("loading");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clientError, setClientError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formValues, setFormValues] = useState({
    password: "",
    confirmPassword: "",
  });

  // The /auth/callback route already exchanged the code server-side and set the
  // session cookie before redirecting here. We just need to confirm a session
  // actually exists before showing the form.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setPageStatus(session ? "ready" : "error");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isFormValid =
    formValues.password.trim() !== "" &&
    formValues.confirmPassword.trim() !== "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
    if (clientError) setClientError("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const mismatch = validatePasswordsMatch(
      formValues.password,
      formValues.confirmPassword,
    );
    if (mismatch) {
      setClientError(mismatch);
      return;
    }

    if (formValues.password.length < 8) {
      setClientError("Password must be at least 8 characters.");
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({
      password: formValues.password,
    });

    if (error) {
      setClientError(error.message);
      setIsSubmitting(false);
      return;
    }

    // Sign out to clear the recovery session so the middleware doesn't redirect
    // the user away from /sign-in back to the dashboard.
    await supabase.auth.signOut();

    // Use a full page reload instead of router.push. router.push fires a fetch
    // navigation immediately and on production the request can reach the
    // middleware before the browser's cookie jar reflects the signOut, causing
    // the recovery-session guard to redirect back to /reset-password. A hard
    // navigation guarantees the updated cookies are flushed first.
    window.location.href = "/sign-in?message=password_updated";
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (pageStatus === "loading") {
    return (
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none flex flex-col items-center justify-center gap-4">
        <div className="mb-2 flex items-center justify-center">
          <MeridianLogo variant="light" size="lg" />
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--navy)]" />
        <p className="text-sm text-[#64748B]">Loading...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (pageStatus === "error") {
    return (
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none text-center">
        <div className="mb-6 flex items-center justify-center">
          <MeridianLogo variant="light" size="lg" />
        </div>

        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-8 h-8 text-red-500" />
        </div>

        <h2 className="text-2xl font-bold text-[#0F172A] mb-3">Link expired</h2>

        <p className="text-sm text-[#64748B] mb-8 leading-relaxed">
          This reset link is invalid or has expired. Please request a new one.
        </p>

        <SubmitButton
          type="button"
          variant="outline"
          size="default"
          cta={
            <Link
              href="/forgot-password"
              className="flex gap-2 items-center justify-center w-full h-full"
            >
              Request a new link
            </Link>
          }
          classname="h-9 w-full font-medium border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] rounded-lg transition-colors"
        />
      </div>
    );
  }

  // ── Password form ──────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none">
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center">
        <MeridianLogo variant="light" size="lg" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] text-center">Set new password</h2>
      <p className="text-sm text-[#64748B] text-center mt-1.5 mb-8">
        Choose a strong password for your account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <AuthField
            id="password"
            name="password"
            label="New Password"
            icon={<Lock className="w-4 h-4" />}
            type={showPassword ? "text" : "password"}
            placeholder="Enter new password"
            value={formValues.password}
            onChange={handleChange}
            rightElement={
              <PasswordToggle
                show={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            }
          />

          <AuthField
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm Password"
            icon={<Lock className="w-4 h-4" />}
            type={showConfirm ? "text" : "password"}
            placeholder="Confirm new password"
            value={formValues.confirmPassword}
            onChange={handleChange}
            rightElement={
              <PasswordToggle
                show={showConfirm}
                onToggle={() => setShowConfirm((prev) => !prev)}
              />
            }
          />
        </div>

        {clientError && <ErrorAlert errorMessage={clientError} />}

        <div className="space-y-3 pt-1">
          <SubmitButton
            classname="h-9 w-full font-medium bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            isPending={isSubmitting}
            disabled={!isFormValid}
            type="submit"
            cta="Update Password"
            variant="default"
            size="default"
            isPendingMesssage="Updating..."
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
