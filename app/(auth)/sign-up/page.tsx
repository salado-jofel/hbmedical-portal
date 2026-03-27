import { Suspense } from "react";
import SignUpForm from "./(sections)/SignUpForm";
import SignUpFormSkeleton from "./(sections)/SignUpSkeletonForm";
import { BackgroundDots } from "../../(components)/BackgroundDots";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up",
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
      {/* Dot field */}
      <BackgroundDots />

      {/* Subtle orange glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse, rgba(232,130,26,0.07) 0%, transparent 70%)",
        }}
      />

      {/* Form */}
      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={<SignUpFormSkeleton />}>
          <SignUpForm />
        </Suspense>
      </div>
    </main>
  );
}
