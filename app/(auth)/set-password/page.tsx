import { Suspense } from "react";
import { BackgroundDots } from "../../(components)/BackgroundDots";
import SetPasswordForm from "./(sections)/SetPasswordForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Set Password",
};

export default function SetPasswordPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Suspense>
          <SetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
