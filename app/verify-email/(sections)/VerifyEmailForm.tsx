import { MailCheck } from "lucide-react";
import Link from "next/link";
import SubmitButton from "@/app/(components)/SubmitButton";
import { FormHeader } from "@/app/(components)/FormHeader";

export default function VerifyEmailForm() {
  return (
    <div
      className="w-full max-w-md select-none rounded-2xl border p-8 text-center"
      style={{
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(16px)",
        borderColor: "rgba(0,212,200,0.15)",
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      <FormHeader className="mb-6" />

      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{
          background: "rgba(0,212,200,0.1)",
          border: "1px solid rgba(0,212,200,0.25)",
        }}
      >
        <MailCheck className="w-9 h-9" style={{ color: "#00d4c8" }} />
      </div>

      <h2 className="text-xl font-bold text-white mb-3">Check your email</h2>
      <p
        className="text-sm mb-8 leading-relaxed"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        We've sent a verification link to your email address. Please click the
        link to activate your{" "}
        <span style={{ color: "#00d4c8" }}>HB Medical</span> account.
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
            background: "rgba(0,212,200,0.08)",
            border: "1px solid rgba(0,212,200,0.35)",
            color: "#00d4c8",
          }}
        />

        <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
          Didn't receive an email? Check your spam folder or try signing up
          again.
        </p>
      </div>
    </div>
  );
}
