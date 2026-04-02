"use client";

import React, { useEffect, useState } from "react";
import { Lock, Loader2, LinkIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import SubmitButton from "@/app/(components)/SubmitButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import { AuthField } from "@/app/(components)/AuthField";
import { PasswordToggle } from "@/app/(components)/PasswordToggle";
import { HBLogo } from "@/app/(components)/HBLogo";
import { validatePasswordsMatch } from "@/utils/validators/signup";

type PageStatus = "loading" | "ready" | "error";

export default function SetPasswordForm() {
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

  // Read access_token + refresh_token from the URL hash that Supabase appends
  // after verifying the invite/recovery link, then establish the session.
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      setPageStatus("error");
      return;
    }

    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        setPageStatus(error ? "error" : "ready");
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

    // Hard navigation so middleware sees the freshly-set session cookie.
    window.location.href = "/dashboard";
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (pageStatus === "loading") {
    return (
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none flex flex-col items-center justify-center gap-4">
        <div className="mb-2 flex items-center justify-center">
          <HBLogo variant="light" size="lg" />
        </div>
        <Loader2 className="w-8 h-8 animate-spin text-[#15689E]" />
        <p className="text-sm text-[#64748B]">Loading...</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (pageStatus === "error") {
    return (
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none text-center">
        <div className="mb-6 flex items-center justify-center">
          <HBLogo variant="light" size="lg" />
        </div>

        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <LinkIcon className="w-8 h-8 text-red-500" />
        </div>

        <h2 className="text-2xl font-bold text-[#0F172A] mb-3">Link expired</h2>

        <p className="text-sm text-[#64748B] mb-8 leading-relaxed">
          This invite link is invalid or has expired. Please contact your
          administrator for a new invitation.
        </p>

        <SubmitButton
          type="button"
          variant="outline"
          size="default"
          cta={
            <Link
              href="/sign-in"
              className="flex gap-2 items-center justify-center w-full h-full"
            >
              Back to Sign In
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
        <HBLogo variant="light" size="lg" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] text-center">Set Your Password</h2>
      <p className="text-sm text-[#64748B] text-center mt-1.5 mb-8">
        Welcome to HB Medical Portal. Create your password to get started.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <AuthField
            id="password"
            name="password"
            label="Password"
            icon={<Lock className="w-4 h-4" />}
            type={showPassword ? "text" : "password"}
            placeholder="Create a password"
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
            placeholder="Confirm your password"
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
            classname="h-9 w-full font-medium bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            isPending={isSubmitting}
            disabled={!isFormValid}
            type="submit"
            cta="Set Password & Sign In"
            variant="default"
            size="default"
            isPendingMesssage="Setting password..."
          />
        </div>
      </form>
    </div>
  );
}
