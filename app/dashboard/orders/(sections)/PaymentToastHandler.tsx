"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export default function PaymentToastHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const handledRef = useRef(false);

    useEffect(() => {
        if (handledRef.current) return;

        const payment = searchParams.get("payment");
        if (!payment) return;

        handledRef.current = true;

        if (payment === "success") {
            toast.success("Payment successful.");
        } else if (payment === "cancelled") {
            toast.error("Payment was cancelled.");
        }

        const params = new URLSearchParams(searchParams.toString());
        params.delete("payment");
        params.delete("session_id");

        const nextUrl = params.toString()
            ? `/dashboard/orders?${params.toString()}`
            : "/dashboard/orders";

        router.replace(nextUrl);
    }, [router, searchParams]);

    return null;
}
