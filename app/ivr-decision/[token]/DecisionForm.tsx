"use client";

import { useState, useTransition } from "react";
import { submitIvrDecision } from "./actions";

interface DecisionFormProps {
  token: string;
  patientName: string;
}

/**
 * Client-side Approve/Deny form. Two-step for Deny — clicking "Deny" first
 * reveals a required reason textarea. Approver's name is required for both
 * decisions (Q5 audit trail — the DB also stamps IP + UA server-side).
 */
export function DecisionForm({ token, patientName }: DecisionFormProps) {
  const [approverName, setApproverName] = useState("");
  const [mode, setMode] = useState<"idle" | "denying">("idle");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<null | "approved" | "denied">(null);
  const [error, setError] = useState<string | null>(null);

  function submit(decision: "approve" | "deny") {
    setError(null);
    if (!approverName.trim()) {
      setError("Please enter your name so we can record the decision.");
      return;
    }
    if (decision === "deny" && !reason.trim()) {
      setError("Please enter a denial reason.");
      return;
    }
    startTransition(async () => {
      const res = await submitIvrDecision({
        token,
        decision,
        approverName,
        denialReason: decision === "deny" ? reason : undefined,
      });
      if (!res.success) {
        setError(res.error ?? "Failed to record decision.");
        return;
      }
      setDone(decision === "approve" ? "approved" : "denied");
    });
  }

  if (done) {
    return (
      <div className="px-6 py-8 border-t border-[#eee] bg-[#fafafa] text-center">
        <div
          className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center text-2xl ${
            done === "approved"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {done === "approved" ? "✓" : "✗"}
        </div>
        <h2 className="text-[16px] font-semibold text-[#111827]">
          {done === "approved" ? "IVR approved" : "IVR denied"}
        </h2>
        <p className="text-[13px] text-[#6b7280] mt-1">
          Thank you. The requesting team has been notified about {patientName}.
          You can close this tab.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 border-t border-[#eee] bg-[#fafafa] space-y-4">
      <div>
        <label className="text-[12px] font-semibold text-[#374151] block mb-1">
          Your Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={approverName}
          onChange={(e) => setApproverName(e.target.value)}
          disabled={pending}
          placeholder="e.g. Jane Smith"
          className="w-full h-10 px-3 border border-[#d1d5db] rounded-md text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#0f2d4a] focus:border-transparent"
        />
        <p className="text-[11px] text-[#6b7280] mt-1">
          Recorded with the decision for the audit trail.
        </p>
      </div>

      {mode === "denying" && (
        <div>
          <label className="text-[12px] font-semibold text-[#374151] block mb-1">
            Denial Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="What needs to be fixed for this IVR to be approved?"
            className="w-full px-3 py-2 border border-[#d1d5db] rounded-md text-[13.5px] focus:outline-none focus:ring-2 focus:ring-[#0f2d4a] focus:border-transparent"
          />
          <p className="text-[11px] text-[#6b7280] mt-1">
            Sent to the requesting team so they can edit and resubmit.
          </p>
        </div>
      )}

      {error && (
        <div className="text-[12.5px] text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        {mode === "idle" && (
          <>
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={pending}
              className="flex-1 h-11 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[14px] font-semibold disabled:opacity-60"
            >
              {pending ? "Recording…" : "✓ Approve IVR"}
            </button>
            <button
              type="button"
              onClick={() => setMode("denying")}
              disabled={pending}
              className="flex-1 h-11 rounded-lg border border-[#d1d5db] bg-white hover:bg-[#f3f4f6] text-[14px] font-semibold text-[#374151]"
            >
              ✗ Deny with reason
            </button>
          </>
        )}
        {mode === "denying" && (
          <>
            <button
              type="button"
              onClick={() => submit("deny")}
              disabled={pending}
              className="flex-1 h-11 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[14px] font-semibold disabled:opacity-60"
            >
              {pending ? "Recording…" : "Confirm Deny"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setReason("");
                setError(null);
              }}
              disabled={pending}
              className="flex-1 h-11 rounded-lg border border-[#d1d5db] bg-white hover:bg-[#f3f4f6] text-[14px] font-semibold text-[#374151]"
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
