"use client";

import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export default function QuickLogBanner() {
  return (
    <div className="mb-5 flex items-center gap-4 rounded-[var(--r)] border-[1.5px] border-[var(--teal-mid)] bg-[var(--teal-lt)] px-5 py-[1.1rem]">
      <Zap className="h-5 w-5 shrink-0 text-[var(--teal)]" strokeWidth={2} />
      <div className="flex-1">
        <p className="text-[14px] font-semibold text-[var(--teal)]">Log a Sale</p>
        <p className="mt-0.5 text-[12px] text-[var(--teal)] opacity-70">
          Record a new order quickly — commissions auto-calculate
        </p>
      </div>
      <Button
        className="shrink-0 bg-[var(--teal)] text-white hover:bg-[var(--teal)]/80"
        size="sm"
        onClick={() => toast("Coming soon", { icon: "⏳" })}
      >
        Log Sale Now →
      </Button>
    </div>
  );
}
