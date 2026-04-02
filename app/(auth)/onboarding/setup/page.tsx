import { Suspense } from "react";
import { BackgroundDots } from "../../../(components)/BackgroundDots";
import RepSetupForm from "./(sections)/RepSetupForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice Setup",
};

export default function RepSetupPage() {
  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16"
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
        <Suspense>
          <RepSetupForm />
        </Suspense>
      </div>
    </main>
  );
}
