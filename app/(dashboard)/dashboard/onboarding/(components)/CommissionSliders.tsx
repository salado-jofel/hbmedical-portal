"use client";

import { useState } from "react";

/**
 * Commission sliders with an editable % number input alongside.
 *   - `commission_rate`     — the invited rep's cut on their own sales.
 *   - `commission_override` — the inviter's override on this rep's sales.
 *
 * Slider and number input are two-way bound: dragging updates the number,
 * typing updates the slider. Values are submitted as form fields — the
 * enclosing <form action={…}> picks them up via FormData and the server
 * action re-validates the 0–100 range.
 */
export function CommissionSliders({
  defaultRate = 10,
  defaultOverride = 0,
  /** Show a helper note explaining the override row. Defaults on for sub-rep
   *  invites (where the override matters to the inviting main rep). */
  showOverrideHint = true,
  /** Hide the override slider entirely. Used when the inviter has no one
   *  above them to earn an override (admin inviting a main rep). A hidden
   *  input still submits `commission_override=0` so the server-side schema
   *  stays happy. */
  hideOverride = false,
}: {
  defaultRate?: number;
  defaultOverride?: number;
  showOverrideHint?: boolean;
  hideOverride?: boolean;
}) {
  const [rate, setRate] = useState(defaultRate);
  const [override, setOverride] = useState(defaultOverride);

  return (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--bg)] p-3">
      <SliderRow
        label="Commission rate"
        inputName="commission_rate"
        value={rate}
        onChange={setRate}
        hint="% this rep earns on their own sales."
      />

      {hideOverride ? (
        <input type="hidden" name="commission_override" value="0" />
      ) : (
        <SliderRow
          label="Override rate"
          inputName="commission_override"
          value={override}
          onChange={setOverride}
          hint={
            showOverrideHint
              ? "% you earn on this rep's sales. Set to 0% if none."
              : undefined
          }
        />
      )}
    </div>
  );
}

function clampPct(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n < 0) return 0;
  if (n > 100) return 100;
  // Snap to 2 decimals to stay within the DB's numeric(5,2).
  return Math.round(n * 100) / 100;
}

function SliderRow({
  label,
  inputName,
  value,
  onChange,
  hint,
}: {
  label: string;
  inputName: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
}) {
  const sliderId = `${inputName}_slider`;
  const numberId = `${inputName}_number`;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-3">
        <label htmlFor={sliderId} className="text-xs font-medium text-[var(--navy)]">
          {label} <span className="text-red-400">*</span>
        </label>
        <div className="flex items-center gap-1">
          <input
            id={numberId}
            type="number"
            min={0}
            max={100}
            step={0.25}
            value={value}
            onChange={(e) => onChange(clampPct(Number(e.target.value)))}
            onBlur={(e) => onChange(clampPct(Number(e.target.value)))}
            className="w-20 h-7 rounded-md border border-[var(--border)] bg-white px-2 text-xs font-semibold text-[var(--navy)] text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30 focus:border-[var(--navy)]"
          />
          <span className="text-xs font-semibold text-[var(--navy)]">%</span>
        </div>
      </div>
      <input
        id={sliderId}
        type="range"
        name={inputName}
        min={0}
        max={100}
        step={0.25}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--navy)] cursor-pointer"
      />
      {hint && <p className="mt-1 text-[11px] text-[var(--text3)]">{hint}</p>}
    </div>
  );
}
