"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStripeNet30Invoice } from "../dashboard/orders/(services)/create-stripe-net30-invoice";

type OrderPaymentChoiceProps = {
    orderId: string;
    onPayNow: () => Promise<void> | void;
};

export function OrderPaymentChoice({
    orderId,
    onPayNow,
}: OrderPaymentChoiceProps) {
    const router = useRouter();
    const [paymentMode, setPaymentMode] = useState<"pay_now" | "net_30">("pay_now");
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<string | null>(null);

    function handleContinue() {
        setMessage(null);

        startTransition(async () => {
            try {
                if (paymentMode === "pay_now") {
                    await onPayNow();
                    return;
                }

                const result = await createStripeNet30Invoice(orderId);

                setMessage("Net 30 invoice created successfully.");
                router.refresh();

                if (result.hostedInvoiceUrl) {
                    window.open(result.hostedInvoiceUrl, "_blank", "noopener,noreferrer");
                }
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Something went wrong.";
                setMessage(message);
            }
        });
    }

    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div>
                <h3 className="text-sm font-semibold text-slate-800">
                    Choose payment option
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                    Pay now with Stripe Checkout or create a Net 30 invoice.
                </p>
            </div>

            <div className="space-y-3">
                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
                    <input
                        type="radio"
                        name="payment_mode"
                        value="pay_now"
                        checked={paymentMode === "pay_now"}
                        onChange={() => setPaymentMode("pay_now")}
                        className="mt-1"
                    />
                    <div>
                        <div className="text-sm font-medium text-slate-800">Pay Now</div>
                        <div className="text-xs text-slate-500">
                            Redirect to Stripe Checkout and collect payment immediately.
                        </div>
                    </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 cursor-pointer">
                    <input
                        type="radio"
                        name="payment_mode"
                        value="net_30"
                        checked={paymentMode === "net_30"}
                        onChange={() => setPaymentMode("net_30")}
                        className="mt-1"
                    />
                    <div>
                        <div className="text-sm font-medium text-slate-800">
                            Pay Later (Net 30)
                        </div>
                        <div className="text-xs text-slate-500">
                            Create a Net 30 invoice and email the customer a branded payment link.
                        </div>
                    </div>
                </label>
            </div>

            {message && (
                <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
                    {message}
                </div>
            )}

            <button
                type="button"
                onClick={handleContinue}
                disabled={isPending}
                className="inline-flex items-center justify-center rounded-lg bg-[#15689E] px-4 py-2 text-sm font-medium text-white hover:bg-[#11557f] disabled:opacity-60"
            >
                {isPending ? "Processing..." : "Continue"}
            </button>
        </div>
    );
}
