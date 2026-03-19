// app/verify-email/(sections)/VerifyEmailForm.tsx

import { MailCheck } from "lucide-react";
import Link from "next/link";
import SubmitButton from "@/app/(components)/SubmitButton";
import { FormHeader } from "@/app/(components)/FormHeader";
import { HBLogo } from "@/app/(components)/HBLogo";

export default function VerifyEmailForm() {
  return (
    <div className="w-full max-w-md select-none rounded-2xl border p-8 text-center bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">

      {/* Logo above form */}
      <div className="relative z-10 mb-8 flex items-center justify-center py-10">
        <HBLogo variant="dark" size="lg" />
      </div>

      {/* Mail icon — orange ring */}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{
          background: "rgba(232,130,26,0.1)",
          border: "1px solid rgba(232,130,26,0.3)",
        }}
      >
        <MailCheck className="w-9 h-9" style={{ color: "#f5a255" }} />
      </div>

      <h2 className="text-xl font-bold text-white mb-3">
        Check your email
      </h2>

      <p className="text-sm mb-8 leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
        We've sent a verification link to your email address. Please click the
        link to activate your{" "}
        <span style={{ color: "#f5a255" }}>HB Medical</span> account.
      </p>

      <div className="space-y-4">
        {/* Back to login — outlined orange */}
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
          Didn't receive an email? Check your spam folder or try signing up again.
        </p>
      </div>
    </div>
  );
}
