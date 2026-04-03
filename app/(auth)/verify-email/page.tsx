// app/verify-email/page.tsx

import type { Metadata } from "next";
import React from "react";
import VerifyEmailForm from "./(sections)/VerifyEmailForm";
import { BackgroundDots } from "@/app/(components)/BackgroundDots";
import { HBLogo } from "../../(components)/HBLogo";

export const metadata: Metadata = {
  title: "Verify Email", // renders → "Verify Email | HB Medical"
  description: "Verify your HB Medical account email address.",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <VerifyEmailForm />
      </div>
    </main>
  );
}
