// app/verify-email/(sections)/VerifyEmailForm.tsx

import { MailCheck } from "lucide-react";
import Link from "next/link";
import SubmitButton from "@/app/(components)/SubmitButton";
import { FormHeader } from "@/app/(components)/FormHeader";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";

export default function VerifyEmailForm() {
  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none text-center">

      {/* Logo above form */}
      <div className="mb-6 flex items-center justify-center">
        <MeridianLogo variant="light" size="lg" />
      </div>

      {/* Mail icon */}
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
        <MailCheck className="w-8 h-8 text-emerald-600" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] mb-3">
        Check your email
      </h2>

      <p className="text-sm text-[#64748B] mb-8 leading-relaxed">
        We&apos;ve sent a verification link to your email address. Please click the
        link to activate your{" "}
        <span className="text-[var(--navy)] font-medium">Meridian Portal</span> account.
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
          Didn&apos;t receive an email? Check your spam folder or try signing up again.
        </p>
      </div>
    </div>
  );
}
