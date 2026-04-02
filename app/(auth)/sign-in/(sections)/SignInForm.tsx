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
          {successMessage && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium animate-in fade-in zoom-in-95">
              {successMessage}
            </div>
          )}
        </div>

        {/* Forgot password */}
        <div className="flex justify-end -mt-1">
          <Link
            href="/forgot-password"
            className="text-xs font-medium transition-colors"
            style={{ color: "rgba(255,255,255,0.35)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f5a255")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.35)")
            }
          >
            Forgot password?
          </Link>
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
