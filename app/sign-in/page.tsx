import { Suspense } from "react";
import { BackgroundDots } from "../(components)/BackgroundDots";
import SignInForm from "./(sections)/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a7ab8 0%, #15689E 35%, #0d4a72 70%, #082d47 100%)",
      }}
    >
      {/* Dot field — same as hero */}
      <BackgroundDots />

      {/* Subtle orange glow behind form */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(232,130,26,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Form card */}
      <div className="relative z-10 w-full max-w-md">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
