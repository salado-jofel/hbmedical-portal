import { Suspense } from "react";
import { BackgroundDots } from "../../(components)/BackgroundDots";
import SignInForm from "./(sections)/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
};

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
