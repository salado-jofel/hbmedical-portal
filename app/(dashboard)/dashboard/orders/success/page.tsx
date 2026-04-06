"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const sessionId  = searchParams.get("session_id");
  const orderId    = searchParams.get("order_id");
  const cancelled  = searchParams.get("cancelled") === "true";

  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (orderId) {
      const tab = "overview";
      sessionStorage.setItem(
        "pending-order-open",
        JSON.stringify({ orderId, tab }),
      );
    }

    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          router.push("/dashboard/orders");
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [orderId, router]);

  if (cancelled) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-100 p-2">
              <XCircle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-800">Payment cancelled</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                No charge was made. You can try again from the order details.
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-400">
            Redirecting you back in {countdown}s…
          </p>

          <Link
            href="/dashboard/orders"
            className="inline-block text-sm text-[#15689E] font-medium hover:underline"
          >
            Go to Orders now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-green-100 p-2">
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Payment submitted!</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Your payment was received successfully.
            </p>
          </div>
        </div>

        {sessionId && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-500 font-mono break-all">
            {sessionId}
          </div>
        )}

        <p className="text-sm text-slate-400">
          Redirecting you back in {countdown}s…
        </p>

        <Link
          href="/dashboard/orders"
          className="inline-block text-sm text-[#15689E] font-medium hover:underline"
        >
          Go to Orders now
        </Link>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-slate-200 border-t-[#15689E] rounded-full animate-spin" /></div>}>
      <OrderSuccessContent />
    </Suspense>
  );
}
