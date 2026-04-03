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
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center">
          <HBLogo variant="light" size="lg" />
        </div>

        {/* Title */}
        <div className="text-center space-y-3 mb-8">
          <h1 className="text-2xl font-bold text-[#0F172A]">
            Account Access by Invitation Only
          </h1>
          <p className="text-sm text-[#64748B] leading-relaxed">
            HB Medical portal accounts are created by invitation only.
            If you are a clinic provider or staff member, please use the
            invitation link sent to you by your HB Medical representative.
            If you believe you should have access, contact your representative.
          </p>
        </div>

        {/* Back to Sign In */}
        <Link
          href="/sign-in"
          className="flex items-center justify-center gap-2 h-9 w-full rounded-lg font-medium transition-colors bg-[#15689E] hover:bg-[#125d8e] text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sign In
        </Link>

        {/* Contact note */}
        <div className="mt-6 text-center">
          <p className="text-xs text-[#94A3B8]">
            Are you a rep?{" "}
            <span className="text-[#15689E] font-medium">
              Contact admin@hbmedicalsupplies.io
            </span>
          </p>
        </div>
      </div>
    </main>
  );
}
