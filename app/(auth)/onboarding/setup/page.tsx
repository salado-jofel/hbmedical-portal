import { Suspense } from "react";
import { BackgroundDots } from "../../../(components)/BackgroundDots";
import RepSetupForm from "./(sections)/RepSetupForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sales Rep Account",
};

export default function RepSetupPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense>
          <RepSetupForm />
        </Suspense>
      </div>
    </main>
  );
}
