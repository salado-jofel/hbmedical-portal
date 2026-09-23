"use client";

import { Check } from "lucide-react";
import type { MANUAL_ONBOARDING_STEPS } from "@/utils/constants/manual-onboarding";

export function WizardStepper({
  steps,
  current,
}: {
  steps: typeof MANUAL_ONBOARDING_STEPS;
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const Icon = s.icon;
        return (
          <li key={s.key} className="flex items-center gap-2 shrink-0">
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                done
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : active
                    ? "bg-[#EFF6FF] text-[var(--navy)] border-[var(--navy)]/30"
                    : "bg-white text-[var(--text3)] border-[var(--border)]"
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-6 h-px ${done ? "bg-emerald-200" : "bg-[var(--border)]"}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
