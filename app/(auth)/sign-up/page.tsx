import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { BackgroundDots } from "../../(components)/BackgroundDots";
import { HBLogo } from "../../(components)/HBLogo";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Access",
};

export default function Page() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a7ab8 0%, #15689E 35%, #0d4a72 70%, #082d47 100%)",
      }}
    >
      <BackgroundDots />

      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(232,130,26,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
          {/* Logo */}
          <div className="relative z-10 mb-8 flex items-center justify-center py-6">
            <HBLogo variant="dark" size="lg" />
          </div>

          {/* Title */}
          <div className="text-center space-y-3 mb-8">
            <h1 className="text-xl font-bold text-white">
              Account Access by Invitation Only
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              HB Medical portal accounts are created by invitation only.
              If you are a clinic provider or staff member, please use the
              invitation link sent to you by your HB Medical representative.
              If you believe you should have access, contact your representative.
            </p>
          </div>

          {/* Back to Sign In */}
          <Link
            href="/sign-in"
            className="flex items-center justify-center gap-2 h-12 w-full rounded-xl font-bold transition-all active:scale-95 text-white"
            style={{
              background: "linear-gradient(135deg, #e8821a, #d4741a)",
              boxShadow: "0 4px 15px rgba(232,130,26,0.35)",
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Sign In
          </Link>

          {/* Contact note */}
          <div className="mt-6 text-center">
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Are you a rep?{" "}
              <span style={{ color: "#f5a255" }}>
                Contact admin@hbmedicalsupplies.io
              </span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
