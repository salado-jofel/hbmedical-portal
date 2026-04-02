import { Suspense } from "react";
import { BackgroundDots } from "../../(components)/BackgroundDots";
import ResetPasswordForm from "./(sections)/ResetPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
