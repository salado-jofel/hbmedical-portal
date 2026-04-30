"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  PenLine,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { cn } from "@/utils/utils";
import type {
  DashboardOrder,
  IOrderDocument,
  IOrderForm,
  IOrderHistory,
  IOrderIVR,
} from "@/utils/interfaces/orders";

// Kept for type-compat with callers; the tab no longer edits draft items.
// The editable picker now lives in Order Form (see OrderFormDocument).
export type DraftOrderItem = {
  id: string;
  productId: string;
  productName: string;
  productSku: string;
  hcpcsCode?: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  totalAmount: number;
  isNew?: boolean;
};

interface OrderOverviewTabProps {
  isActive: boolean;
  order: DashboardOrder;
  liveOrder: DashboardOrder;
  documents: IOrderDocument[];
  orderForm: IOrderForm | null;
  ivrData: Partial<IOrderIVR> | null;
  history: IOrderHistory[];
}

/* ── Status pipeline ── */

type PipelineStep = {
  value: string;
  label: string;
};

const STATUS_PIPELINE: PipelineStep[] = [
  { value: "draft",                  label: "Draft" },
  { value: "pending_signature",      label: "Pending Sig" },
  { value: "manufacturer_review",    label: "Under Review" },
  { value: "additional_info_needed", label: "Needs Info" },
  { value: "approved",               label: "Approved" },
  { value: "shipped",                label: "Shipped" },
  { value: "delivered",              label: "Delivered" },
];

const STATUS_RANK: Record<string, number> = Object.fromEntries(
  STATUS_PIPELINE.map((s, i) => [s.value, i]),
);

/* ── Checklist helpers ──
   Forms are considered "completed" only once the physician has signed them —
   matches the provider workflow (fill → sign → submit). Partial content alone
   no longer counts. */

function isOrderFormSigned(form: IOrderForm | null): boolean {
  return !!form?.physicianSignedAt;
}

function isIvrSigned(ivr: Partial<IOrderIVR> | null): boolean {
  return !!ivr?.physicianSignedAt;
}

function fmtRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const delta = Date.now() - d.getTime();
  const mins = Math.floor(delta / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

/* ── Component ── */

export function OrderOverviewTab({
  isActive,
  order,
  liveOrder,
  documents,
  orderForm,
  ivrData,
  history,
}: OrderOverviewTabProps) {
  const status = liveOrder.order_status ?? "draft";
  const currentRank = STATUS_RANK[status] ?? 0;

  // Distinguish "needs info" and "canceled" from the linear pipeline —
  // both are off-track states. We'll render them inline in the bar but color
  // them as diversions, not forward progress.
  const isOffTrack = status === "additional_info_needed" || status === "canceled";
  const isCanceled = status === "canceled";

  const items = liveOrder.all_items ?? [];
  const itemCount = items.length;

  const checklist = useMemo(() => {
    const hasFacesheet = documents.some((d) => d.documentType === "facesheet");
    const hasClinicalDocs = documents.some((d) => d.documentType === "clinical_docs");
    const hasPatient =
      !!liveOrder.patient_full_name &&
      liveOrder.patient_full_name !== "Patient" &&
      liveOrder.patient_full_name.trim().length > 1;
    return [
      {
        id: "patient",
        label: "Patient info",
        icon: UserCheck,
        done: hasPatient,
        detail: liveOrder.patient_full_name ?? undefined,
      },
      {
        id: "facesheet",
        label: "Facesheet uploaded",
        icon: FileText,
        done: hasFacesheet,
      },
      {
        id: "clinical_docs",
        label: "Clinical docs uploaded",
        icon: FileText,
        done: hasClinicalDocs,
      },
      {
        // Products live inside the Order Form now, so the two checks fold
        // into a single row: Order Form is "completed" once it's signed AND
        // has at least one product.
        id: "order_form",
        label: "Order Form completed",
        icon: Stethoscope,
        done: isOrderFormSigned(orderForm) && itemCount > 0,
        detail: itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : undefined,
      },
      {
        id: "ivr",
        label: "IVR Form completed",
        icon: FileText,
        done: isIvrSigned(ivrData),
      },
      {
        id: "signed",
        label: "Signed by provider",
        icon: PenLine,
        done: !!liveOrder.signed_at,
      },
    ];
  }, [
    documents,
    liveOrder.patient_full_name,
    liveOrder.signed_at,
    itemCount,
    orderForm,
    ivrData,
  ]);

  const doneCount = checklist.filter((c) => c.done).length;
  const totalCount = checklist.length;
  const progressPct = Math.round((doneCount / totalCount) * 100);

  // Last 3 history entries for the activity strip.
  const recentHistory = useMemo(
    () => history.slice(0, 3),
    [history],
  );

  return (
    <div
      className={cn(
        "absolute inset-0 overflow-y-auto space-y-5 px-3 py-4",
        !isActive && "hidden",
      )}
    >
      {/* ── Status pipeline ── */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text3)]">
            Status
          </h3>
          {isCanceled ? (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-red-600 bg-red-50 rounded-full px-2.5 py-0.5">
              Canceled
            </span>
          ) : isOffTrack ? (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 bg-amber-50 rounded-full px-2.5 py-0.5">
              Needs more info
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {STATUS_PIPELINE.filter((s) => s.value !== "additional_info_needed").map(
            (step, idx, arr) => {
              const rank = STATUS_RANK[step.value];
              const reached = !isCanceled && currentRank >= rank;
              const current = !isCanceled && status === step.value;
              return (
                <div key={step.value} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors",
                        current
                          ? "bg-[var(--navy)] text-white ring-2 ring-[var(--navy)]/20 ring-offset-1"
                          : reached
                            ? "bg-[var(--teal)] text-white"
                            : "bg-[var(--border)] text-[var(--text3)]",
                      )}
                    >
                      {reached && !current ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={cn(
                        "mt-1.5 text-[10px] font-medium whitespace-nowrap",
                        current
                          ? "text-[var(--navy)]"
                          : reached
                            ? "text-[var(--teal)]"
                            : "text-[var(--text3)]",
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {idx < arr.length - 1 && (
                    <div
                      className={cn(
                        "h-[2px] flex-1 mb-[18px] -mx-1",
                        reached && currentRank > rank
                          ? "bg-[var(--teal)]"
                          : "bg-[var(--border)]",
                      )}
                    />
                  )}
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* ── Admin note (info request) — stays when set so provider sees why ── */}
      {liveOrder.admin_notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-700">
              Additional info requested
            </span>
          </div>
          <p className="text-sm text-amber-800 leading-relaxed">
            {liveOrder.admin_notes}
          </p>
        </div>
      )}

      {/* ── Checklist ── */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text3)]">
            What&apos;s Left
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text2)] font-medium">
              {doneCount} / {totalCount}
            </span>
            <div className="w-24 h-1.5 bg-[var(--border)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--teal)] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
        <ul className="space-y-1.5">
          {checklist.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.id}
                className={cn(
                  "flex items-center gap-3 py-2 px-3 rounded-lg transition-colors",
                  item.done ? "bg-[#f0fdf4]" : "bg-[var(--bg)]",
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-[var(--teal)] shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-[var(--text3)] shrink-0" />
                )}
                <Icon
                  className={cn(
                    "w-3.5 h-3.5 shrink-0",
                    item.done ? "text-[var(--teal)]" : "text-[var(--text3)]",
                  )}
                />
                <span
                  className={cn(
                    "text-sm flex-1",
                    item.done
                      ? "text-[var(--navy)] font-medium"
                      : "text-[var(--text2)]",
                  )}
                >
                  {item.label}
                </span>
                {item.detail && (
                  <span className="text-[11px] text-[var(--text3)]">
                    {item.detail}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* ── Recent activity ── */}
      {recentHistory.length > 0 && (
        <div className="bg-white border border-[var(--border)] rounded-xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text3)] mb-3">
            Recent Activity
          </h3>
          <ul className="space-y-2">
            {recentHistory.map((h) => (
              <li key={h.id} className="flex items-start gap-3 text-sm">
                <Clock className="w-3.5 h-3.5 text-[var(--text3)] mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--navy)] leading-snug">{h.action}</p>
                  <p className="text-[11px] text-[var(--text3)] mt-0.5">
                    {h.performedByName ?? "System"} · {fmtRelativeTime(h.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Quick facts card ── */}
      <div className="bg-white border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text3)] mb-3">
          Order Details
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-[var(--text3)]">Order #</dt>
          <dd className="text-[var(--navy)] font-mono font-medium">
            {order.order_number ?? "—"}
          </dd>
          <dt className="text-[var(--text3)]">Wound type</dt>
          <dd className="text-[var(--navy)] capitalize">
            {order.wound_type?.replace(/_/g, " ") ?? "—"}
          </dd>
          <dt className="text-[var(--text3)]">Date of service</dt>
          <dd className="text-[var(--navy)]">{order.date_of_service ?? "—"}</dd>
          <dt className="text-[var(--text3)]">Facility</dt>
          <dd className="text-[var(--navy)] truncate" title={order.facility_name ?? ""}>
            {order.facility_name ?? "—"}
          </dd>
        </dl>
      </div>
    </div>
  );
}
