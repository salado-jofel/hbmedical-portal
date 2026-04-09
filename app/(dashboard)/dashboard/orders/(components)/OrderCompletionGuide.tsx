"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DashboardOrder, IOrderDocument } from "@/utils/interfaces/orders";

interface CompletionItem {
  label: string;
  done: boolean;
  tab?: string;
}

interface OrderCompletionGuideProps {
  open: boolean;
  onClose: () => void;
  onGoToTab: (tab: string) => void;
  order: DashboardOrder;
  documents: IOrderDocument[];
}

export function OrderCompletionGuide({
  open,
  onClose,
  onGoToTab,
  order,
  documents,
}: OrderCompletionGuideProps) {
  const items: CompletionItem[] = [
    {
      label: "Wound type selected",
      done: !!order.wound_type,
    },
    {
      label: "Date of service set",
      done: !!order.date_of_service,
    },
    {
      label: "Patient facesheet uploaded",
      done: documents.some((d) => d.documentType === "facesheet"),
      tab: "documents",
    },
    {
      label: "At least one product added",
      done: (order.all_items?.length ?? 0) > 0,
      tab: "overview",
    },
  ];

  const completed = items.filter((i) => i.done);
  const incomplete = items.filter((i) => !i.done);
  const allDone = incomplete.length === 0;

  function handleNextIncomplete() {
    const first = incomplete.find((i) => i.tab);
    if (first?.tab) {
      onGoToTab(first.tab);
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="max-w-sm w-[calc(100%-2rem)] rounded-2xl p-0 border-[var(--border)] shadow-2xl">
        <div className="p-6 space-y-4">
          <div>
            <h3 className="font-semibold text-sm text-slate-800">
              Order Completion Guide
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Complete the following to submit for signature:
            </p>
            <p className="text-xs font-semibold text-slate-700 mt-2">
              {completed.length} of {items.length} completed
            </p>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div
                  className={
                    item.done
                      ? "w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0"
                      : "w-4 h-4 rounded-full border-2 border-amber-400 shrink-0"
                  }
                >
                  {item.done && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      fill="none"
                      viewBox="0 0 12 12"
                    >
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    item.done
                      ? "text-slate-400 line-through"
                      : "text-slate-700"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {allDone && (
            <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              All requirements met. You can submit this order for signature.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="flex-1 border-[var(--border)]"
            >
              Close
            </Button>
            {!allDone && (
              <Button
                size="sm"
                onClick={handleNextIncomplete}
                className="flex-1 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white"
              >
                Next Incomplete
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
