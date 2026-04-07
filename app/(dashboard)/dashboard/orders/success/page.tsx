"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Legacy Stripe success/cancel redirect target.
 * Stripe sessions created before the returnUrl approach
 * still point here — just forward to orders.
 */
export default function OrderSuccessPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/orders");
  }, [router]);
  return null;
}
