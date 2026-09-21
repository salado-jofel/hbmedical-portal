"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { MeridianLogo } from "@/app/(components)/MeridianLogo";
import { PasswordInput } from "@/app/(components)/PasswordInput";
import { signOut } from "@/app/(dashboard)/dashboard/(services)/actions";
import { setInitialPin } from "../(services)/actions";

export function PinSetupForm({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const digitsOnly = (v: string) => v.replace(/\D/g, "").slice(0, 4);
  const canSubmit = pin.length === 4 && confirmPin.length === 4 && !isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    if (pin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }
    startTransition(async () => {
      const res = await setInitialPin(pin, confirmPin);
      if (!res.success) {
        setError(res.error);
        return;
      }
      toast.success("PIN created.");
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F0F7FF] to-[#F8FAFC] px-4">
      <div className="w-full max-w-md select-none rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_8px_40px_rgba(0,0,0,0.1)]">
        <div className="mb-6 flex items-center justify-center">
          <MeridianLogo variant="light" size="lg" />
        </div>

        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--navy)]/10">
            <KeyRound className="h-6 w-6 text-[var(--navy)]" />
          </div>
          <h2 className="text-2xl font-bold text-[#0F172A]">
            {firstName ? `Welcome, ${firstName}` : "One last step"}
          </h2>
          <p className="mt-1.5 text-sm text-[#64748B]">
            Create the 4-digit PIN you&apos;ll use as your digital signature when
            signing orders. Only you know this PIN &mdash; Meridian staff never see it.
          </p>
        </div>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            id="initial_pin"
            label="Create your PIN"
            placeholder="4 digits"
            value={pin}
            onChange={(e) => { setPin(digitsOnly(e.target.value)); setError(null); }}
          />
          <PasswordInput
            id="initial_pin_confirm"
            label="Confirm PIN"
            placeholder="Repeat PIN"
            value={confirmPin}
            onChange={(e) => { setConfirmPin(digitsOnly(e.target.value)); setError(null); }}
          />
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-9 w-full bg-[var(--navy)] font-medium text-white hover:bg-[var(--navy)]/90 disabled:opacity-50"
          >
            {isPending ? "Saving…" : "Save PIN and continue"}
          </Button>
          <button
            type="button"
            onClick={() => startTransition(() => signOut())}
            disabled={isPending}
            className="w-full text-center text-xs text-[var(--text3)] hover:text-[var(--navy)]"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
