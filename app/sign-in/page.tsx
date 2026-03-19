import { Suspense } from "react";
import SignInForm from "./(sections)/SignInForm";
import SignInFormSkeleton from "./(sections)/SignInFormSkeleton";
import { BackgroundDots } from "../(components)/BackgroundDots";

export default function Page() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden bg-[linear-gradient(135deg,#0a1f2e_0%,#0d2d35_50%,#0a2420_100%)]">
      <BackgroundDots />

      <Suspense fallback={<SignInFormSkeleton />}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
