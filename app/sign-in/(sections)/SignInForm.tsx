"use client";

import React, { useActionState, useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, UserPlus, ArrowLeft } from "lucide-react";
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

  useEffect(() => {
    if (state?.error) {
      setFormValues((prev) => ({ ...prev, password: "" }));
    }
  }, [state]);

  const searchParams = useSearchParams();
  const qbError = searchParams.get("error");

  return (
    <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">

      {/* Logo */}
      <div className="relative z-10 mb-8 flex items-center justify-center py-10">
        <HBLogo variant="dark" size="lg" />
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-4">

          <AuthField
            id="email"
            name="email"
            label="Email"
            icon={<Mail className="w-4 h-4" style={{ color: "#f5a255" }} />}
            type="email"
            placeholder="Enter your email"
            value={formValues.email}
            onChange={handleChange}
          />

          <AuthField
            id="password"
            name="password"
            label="Password"
            icon={<Lock className="w-4 h-4" style={{ color: "#f5a255" }} />}
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
        </div>

        {/* Remember me */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="remember"
            name="remember"
            className="border-white/20 data-[state=checked]:bg-[#e8821a] data-[state=checked]:border-[#e8821a]"
          />
          <label
            htmlFor="remember"
            className="text-sm font-medium cursor-pointer"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            Remember me
          </label>
        </div>

        <div className="space-y-3 pt-1">

          {/* Primary CTA — disabled until both fields filled */}
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
            cta="Sign In"
            variant="default"
            size="lg"
            isPendingMesssage="Signing in..."
          />

          {/* Divider */}
          <div className="relative flex items-center justify-center py-1">
            <div className="absolute inset-0 flex items-center">
              <span
                className="w-full border-t"
                style={{ borderColor: "rgba(255,255,255,0.08)" }}
              />
            </div>
            <span
              className="relative px-4 text-xs uppercase tracking-widest"
              style={{ color: "rgba(255,255,255,0.3)", background: "transparent" }}
            >
              or
            </span>
          </div>

          {/* Secondary CTA — always enabled */}
          <SubmitButton
            classname="h-12 w-full cursor-pointer font-bold transition-all active:scale-95"
            style={{
              background: "rgba(232,130,26,0.08)",
              border: "1px solid rgba(232,130,26,0.35)",
              color: "#f5a255",
            }}
            type="button"
            cta={
              <Link
                href="/sign-up"
                className="flex gap-2 items-center justify-center w-full h-full"
              >
                <UserPlus className="w-5 h-5" /> Create New Account
              </Link>
            }
            variant="outline"
            size="lg"
          />
        </div>
      </form>

      {/* Back link */}
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium transition-colors"
          style={{ color: "rgba(255,255,255,0.35)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a255")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
        >
          <ArrowLeft className="w-4 h-4" /> Back to Main Site
        </Link>
      </div>
    </div>
  );
}
