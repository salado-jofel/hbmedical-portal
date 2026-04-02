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
      <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] flex flex-col items-center justify-center gap-4">
        <div className="relative z-10 mb-2 flex items-center justify-center py-6">
          <HBLogo variant="dark" size="lg" />
        </div>
        <Loader2
          className="w-8 h-8 animate-spin"
          style={{ color: "#f5a255" }}
        />
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Loading...
        </p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (pageStatus === "error") {
    return (
      <div className="w-full max-w-md select-none rounded-2xl border p-8 text-center bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="relative z-10 mb-8 flex items-center justify-center py-10">
          <HBLogo variant="dark" size="lg" />
        </div>

        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
          }}
        >
          <LinkIcon className="w-9 h-9" style={{ color: "#f87171" }} />
        </div>

        <h2 className="text-xl font-bold text-white mb-3">Link expired</h2>

        <p
          className="text-sm mb-8 leading-relaxed"
          style={{ color: "rgba(255,255,255,0.5)" }}
        >
          This invite link is invalid or has expired. Please contact your
          administrator for a new invitation.
        </p>

        <SubmitButton
          type="button"
          variant="outline"
          size="lg"
          cta={
            <Link
              href="/sign-in"
              className="flex gap-2 items-center justify-center w-full h-full"
            >
              Back to Sign In
            </Link>
          }
          classname="h-12 w-full font-bold transition-all active:scale-95"
          style={{
            background: "rgba(232,130,26,0.08)",
            border: "1px solid rgba(232,130,26,0.35)",
            color: "#f5a255",
          }}
        />
      </div>
    );
  }

  // ── Password form ──────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Logo */}
      <div className="relative z-10 mb-8 flex items-center justify-center py-10">
        <HBLogo variant="dark" size="lg" />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Set Your Password</h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Welcome to HB Medical Portal. Create your password to get started.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-4">
          <AuthField
            id="password"
            name="password"
            label="Password"
            icon={<Lock className="w-4 h-4" style={{ color: "#f5a255" }} />}
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
            icon={<Lock className="w-4 h-4" style={{ color: "#f5a255" }} />}
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
            isPending={isSubmitting}
            disabled={!isFormValid}
            type="submit"
            cta="Set Password & Sign In"
            variant="default"
            size="lg"
            isPendingMesssage="Setting password..."
          />
        </div>
      </form>
    </div>
  );
}
