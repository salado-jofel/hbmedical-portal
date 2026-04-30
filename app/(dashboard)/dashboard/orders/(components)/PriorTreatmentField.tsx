"use client";

import { useEffect, useState } from "react";
import {
  PRIOR_TREATMENTS,
  composePriorTreatmentLabel,
  decomposePriorTreatment,
} from "@/utils/constants/prior-treatments";

interface PriorTreatmentFieldProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

/**
 * Treatment cell for the "Prior Treatments Tried" table. Shows a parent
 * dropdown (7 standardized treatments + Other), a conditional sub-dropdown
 * for treatments that have sub-options, and a free-text fallback for Other.
 *
 * The persisted value is a composite string ("Wound cleansing — Saline
 * solution") for backwards compatibility with the existing JSONB column
 * and PDF rendering. Local state tracks the dropdown selections so the
 * picker stays in the right mode even when value is briefly empty.
 */
export function PriorTreatmentField({
  value,
  onChange,
  disabled,
}: PriorTreatmentFieldProps) {
  const [parentChoice, setParentChoice] = useState<string>(
    () => decomposePriorTreatment(value).parentId,
  );
  const [subChoice, setSubChoice] = useState<string>(
    () => decomposePriorTreatment(value).subId,
  );

  // Re-sync if the persisted value changes from outside (AI extraction,
  // parent re-render with new row data, etc).
  useEffect(() => {
    const { parentId, subId } = decomposePriorTreatment(value);
    setParentChoice(parentId);
    setSubChoice(subId);
  }, [value]);

  const parentOpt = PRIOR_TREATMENTS.find((t) => t.id === parentChoice);
  const showSubDropdown = !!parentOpt?.subOptions?.length;
  const showOtherInput = parentChoice === "other";

  const selectClass =
    "border-0 border-b border-[#333] text-[12px] bg-transparent outline-none px-1 py-0.5 w-full leading-tight";

  return (
    <div className="flex flex-col gap-1">
      <select
        value={parentChoice}
        onChange={(e) => {
          const newParent = e.target.value;
          setParentChoice(newParent);
          setSubChoice("");
          if (newParent === "") {
            onChange("");
          } else if (newParent === "other") {
            // Switching INTO Other from a canonical pick: clear so the
            // free-text input starts blank. Preserve if already on Other
            // (e.g., legacy row or AI-extracted free text).
            const wasCanonical =
              parentChoice && parentChoice !== "other" && parentChoice !== "";
            if (wasCanonical) onChange("");
          } else {
            const opt = PRIOR_TREATMENTS.find((t) => t.id === newParent);
            // Save parent label as a partial answer; user can refine via sub.
            if (opt) onChange(opt.label);
          }
        }}
        disabled={disabled}
        className={selectClass}
      >
        <option value="">— Select treatment —</option>
        {PRIOR_TREATMENTS.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
        <option value="other">Other (specify)</option>
      </select>

      {showSubDropdown && parentOpt?.subOptions && (
        <select
          value={subChoice}
          onChange={(e) => {
            const newSub = e.target.value;
            setSubChoice(newSub);
            if (newSub === "") {
              onChange(parentOpt.label);
            } else {
              const sub = parentOpt.subOptions!.find((s) => s.id === newSub);
              if (sub) {
                onChange(
                  composePriorTreatmentLabel(parentOpt.label, sub.label),
                );
              }
            }
          }}
          disabled={disabled}
          className={selectClass}
        >
          <option value="">— Sub-type —</option>
          {parentOpt.subOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      )}

      {showOtherInput && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Specify treatment"
          className={selectClass}
        />
      )}
    </div>
  );
}
