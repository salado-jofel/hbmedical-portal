"use client";

import React, { useActionState, useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { signIn } from "../(services)/actions";
import SubmitButton from "@/app/(components)/SubmitButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import { useSearchParams } from "next/navigation";
import { AuthField } from "@/app/(components)/AuthField";
import { PasswordToggle } from "@/app/(components)/PasswordToggle";
import { HBLogo } from "@/app/(components)/HBLogo";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [state, formAction, isPending] = useActionState(signIn, null);
  const [formValues, setFormValues] = useState({ email: "", password: "" });

  // ── All fields must be non-empty to enable submit ──
  const isFormValid =
    formValues.email.trim() !== "" && formValues.password.trim() !== "";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  // Safety net: if an invite/recovery token lands on this page instead of
  // /set-password, forward it immediately so the token isn't lost.
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      window.location.replace(`/set-password${hash}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (state?.error) {
      setFormValues((prev) => ({ ...prev, password: "" }));
    }
  }, [state]);

  const searchParams = useSearchParams();
  const qbError = searchParams.get("error");
  const successMessage = searchParams.get("message") === "password_updated"
    ? "Password updated successfully. Please sign in."
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none">

      {/* Logo */}
      <div className="mb-6 flex items-center justify-center">
        <HBLogo variant="light" size="lg" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] text-center">Sign In</h2>
      <p className="text-sm text-[#64748B] text-center mt-1.5 mb-8">Welcome back. Sign in to your account.</p>

      <form action={formAction} className="space-y-5">
        <div className="space-y-4">

          <AuthField
            id="email"
            name="email"
            label="Email"
            icon={<Mail className="w-4 h-4" />}
            type="email"
            placeholder="Enter your email"
            value={formValues.email}
            onChange={handleChange}
          />

          <AuthField
            id="password"
            name="password"
            label="Password"
            icon={<Lock className="w-4 h-4" />}
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={formValues.password}
            onChange={handleChange}
            rightElement={
              <PasswordToggle
                show={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            }
          />

          {state?.error && <ErrorAlert errorMessage={state.error} />}
          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-medium animate-in fade-in zoom-in-95">
              {successMessage}
            </div>
          )}
        </div>

        {/* Forgot password */}
        <div className="flex justify-end -mt-1">
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-[#15689E] hover:text-[#125d8e] transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        {/* Remember me */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            name="remember"
            className="border-[#E2E8F0] data-[state=checked]:bg-[#15689E] data-[state=checked]:border-[#15689E]"
          />
          <label
            htmlFor="remember"
            className="text-sm font-medium text-[#64748B] cursor-pointer"
          >
            Remember me
          </label>
        </div>

        <div className="space-y-3 pt-1">

          {/* Primary CTA */}
          <SubmitButton
            classname="h-9 w-full font-medium bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            isPending={isPending}
            disabled={!isFormValid}
            type="submit"
            cta="Sign In"
            variant="default"
            size="default"
            isPendingMesssage="Signing in..."
          />

        </div>
      </form>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-[#64748B] hover:text-[#15689E] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Main Site
        </Link>
      </div>
    </div>
  );
}
