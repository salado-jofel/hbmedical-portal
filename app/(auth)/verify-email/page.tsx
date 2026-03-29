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
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a7ab8 0%, #15689E 35%, #0d4a72 70%, #082d47 100%)",
      }}
    >
      <BackgroundDots />

      {/* Orange glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(232,130,26,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Form */}
      <div className="relative z-10 w-full max-w-md">
        <VerifyEmailForm />
      </div>
    </main>
  );
}
