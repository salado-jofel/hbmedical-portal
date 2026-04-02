import { Suspense } from "react";
import { BackgroundDots } from "../../(components)/BackgroundDots";
import ForgotPasswordForm from "./(sections)/ForgotPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
