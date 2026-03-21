import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { stripe } from "@/utils/stripe/server";

type Props = {
    searchParams: Promise<{
        session_id?: string;
    }>;
};

export default async function OrderSuccessPage({ searchParams }: Props) {
    const { session_id: sessionId } = await searchParams;

    if (!sessionId) {
        return (
            <div className="max-w-2xl mx-auto px-6 py-16">
                <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                    <h1 className="text-xl font-semibold text-slate-800">
                        Missing session
                    </h1>
                    <p className="mt-2 text-slate-600">
                        We couldn't find the Stripe session ID.
                    </p>
                    <Link
                        href="/dashboard/orders"
                        className="inline-block mt-6 text-[#15689E] font-medium"
                    >
                        Back to orders
                    </Link>
                </div>
            </div>
        );
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return (
        <div className="max-w-2xl mx-auto px-6 py-16">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="rounded-full bg-green-100 p-2">
                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-800">
                            Payment submitted
                        </h1>
                        <p className="text-slate-600">
                            Thank you. Your payment was submitted successfully.
                        </p>
                    </div>
                </div>

                <div className="mt-8 space-y-3 text-sm">
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Order</span>
                        <span className="font-medium text-slate-800">
                            {session.metadata?.order_doc_number ?? "—"}
                        </span>
                    </div>

                    <div className="flex justify-between border-b border-slate-100 pb-2">
                        <span className="text-slate-500">Session ID</span>
                        <span className="font-medium text-slate-800">{session.id}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
