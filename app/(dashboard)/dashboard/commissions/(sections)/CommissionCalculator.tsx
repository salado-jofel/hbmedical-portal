"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppSelector } from "@/store/hooks";
import { formatAmount } from "@/utils/helpers/formatter";

export default function CommissionCalculator({ lockedRepId }: { lockedRepId?: string }) {
  const summary = useAppSelector((s) => s.commissions.summary);

  const [saleAmount, setSaleAmount] = useState(25000);
  const [commRate, setCommRate] = useState(5);
  const [override, setOverride] = useState("2");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Sync rate slider with actual commission rate once Redux hydrates from Providers
  useEffect(() => {
    if (summary?.currentRate != null) setCommRate(summary.currentRate);
  }, [summary?.currentRate]);

  if (!mounted) return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-44 rounded bg-[var(--border2)]" />
        <div className="h-8 w-full rounded bg-[var(--border2)]" />
        <div className="h-8 w-full rounded bg-[var(--border2)]" />
        <div className="h-8 w-full rounded bg-[var(--border2)]" />
        <div className="h-20 w-full rounded-[9px] bg-[var(--teal-lt)]" />
      </div>
    </div>
  );

  const overridePct = parseFloat(override);
  const repComm = saleAmount * (commRate / 100);
  const overrideAmt = saleAmount * (overridePct / 100);
  const totalComm = repComm + overrideAmt;

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="mb-4 text-[13px] font-semibold text-[var(--navy)]">
        Commission Calculator
      </p>

      {/* Sale Amount slider */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] text-[var(--text2)]">Sale Amount</span>
          <strong className="text-[12px] font-semibold text-[var(--navy)]">
            {formatAmount(saleAmount)}
          </strong>
        </div>
        <input
          type="range"
          min={1000}
          max={200000}
          step={1000}
          value={saleAmount}
          onChange={(e) => setSaleAmount(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border2)] accent-[var(--teal)]"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-[var(--text3)]">
          <span>$1k</span>
          <span>$200k</span>
        </div>
      </div>

      {/* Commission Rate slider */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] text-[var(--text2)]">Commission Rate</span>
          <strong className="text-[12px] font-semibold text-[var(--navy)]">
            {commRate}%
          </strong>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={commRate}
          onChange={(e) => setCommRate(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[var(--border2)] accent-[var(--teal)]"
        />
        <div className="mt-0.5 flex justify-between text-[10px] text-[var(--text3)]">
          <span>0%</span>
          <span>20%</span>
        </div>
      </div>

      {/* Override select */}
      <div className="mb-4">
        <p className="mb-1.5 text-[11px] font-medium text-[var(--text2)]">
          Override — Master Distributor Cut
        </p>
        <Select value={override} onValueChange={setOverride}>
          <SelectTrigger className="h-8 w-full rounded-[7px] border-[var(--border2)] text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">None (0%)</SelectItem>
            <SelectItem value="1">1% override</SelectItem>
            <SelectItem value="2">2% override</SelectItem>
            <SelectItem value="3">3% override</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Result */}
      <div className="rounded-[9px] border-[1.5px] border-[var(--teal-mid)] bg-[var(--teal-lt)] p-4 text-center">
        <p className="text-[26px] font-semibold text-[var(--teal)]">
          {formatAmount(repComm)}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--teal)] opacity-80">
          Rep payout
        </p>
        <div className="mt-2 flex justify-center gap-6">
          <div className="text-center">
            <p className="text-[14px] font-semibold text-[var(--navy)]">
              {formatAmount(overrideAmt)}
            </p>
            <p className="text-[10px] text-[var(--text3)]">Your override</p>
          </div>
          <div className="text-center">
            <p className="text-[14px] font-semibold text-[var(--navy)]">
              {formatAmount(totalComm)}
            </p>
            <p className="text-[10px] text-[var(--text3)]">Total commission</p>
          </div>
        </div>
      </div>
    </div>
  );
}
