"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";
import { getStandaloneIvrById } from "../../ivrs/(services)/actions";

interface IvrExternalApprovalBannerProps {
  standaloneIvrId: string;
}

/**
 * Green banner shown at the top of the order's IVR tab when the order
 * was created via "Create Order from Approved IVR" (i.e. order_ivr's
 * linked_standalone_ivr_id is set). Fetches the source standalone IVR
 * on mount to show WHO approved and when. Never blocks the tab render
 * — while loading we show a lightweight placeholder.
 */
export function IvrExternalApprovalBanner({
  standaloneIvrId,
}: IvrExternalApprovalBannerProps) {
  const [state, setState] = useState<{
    loading: boolean;
    approver: string | null;
    approvedAt: string | null;
  }>({ loading: true, approver: null, approvedAt: null });

  useEffect(() => {
    let cancelled = false;
    getStandaloneIvrById(standaloneIvrId).then((res) => {
      if (cancelled) return;
      if (!res) {
        setState({ loading: false, approver: null, approvedAt: null });
        return;
      }
      setState({
        loading: false,
        approver: res.approverDisplayName,
        approvedAt: res.approvedAt,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [standaloneIvrId]);

  return (
    <div className="mx-3 mb-3 mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 flex items-center gap-2 text-[12.5px] text-green-900">
      <CheckCircle2 className="w-4 h-4 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold">IVR approved externally</div>
        <div className="text-[11px] opacity-90 truncate">
          {state.loading ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading approval details…
            </span>
          ) : state.approver ? (
            <>
              Approved by <span className="font-medium">{state.approver}</span>
              {state.approvedAt
                ? ` on ${new Date(state.approvedAt).toLocaleString()}`
                : ""}
            </>
          ) : (
            "Approval details unavailable (source IVR was removed)."
          )}
        </div>
      </div>
      <a
        href={`/dashboard/ivrs`}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-medium hover:underline"
      >
        View original IVR
        <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
