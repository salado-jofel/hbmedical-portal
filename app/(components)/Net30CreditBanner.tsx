import { AlertTriangle } from "lucide-react";
import type { Net30CreditStatus } from "@/lib/billing/net30";

type Net30CreditBannerProps = {
    status: Net30CreditStatus;
};

function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
    }).format(amount);
}

export function Net30CreditBanner({ status }: Net30CreditBannerProps) {
    if (!status.blocked) return null;

    return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm">
            <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                    <p className="font-semibold">Ordering temporarily disabled</p>
                    <p className="text-sm leading-6">
                        {status.reason}
                    </p>
                    <p className="text-sm">
                        Outstanding Net 30 balance:{" "}
                        <span className="font-semibold">
                            {formatCurrency(status.outstandingBalance)}
                        </span>
                    </p>
                    {status.overdueBalance > 0 && (
                        <p className="text-sm">
                            Overdue balance:{" "}
                            <span className="font-semibold">
                                {formatCurrency(status.overdueBalance)}
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
