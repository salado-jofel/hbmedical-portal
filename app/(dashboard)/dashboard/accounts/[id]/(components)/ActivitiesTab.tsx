"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cva } from "class-variance-authority";
import {
  Trash2,
  Activity,
} from "lucide-react";
import {
  TYPE_ICONS,
  TYPE_LABELS,
  TYPE_COLORS,
  OUTCOME_LABELS,
  OUTCOME_DOTS,
  ACTIVITY_TYPE_FILTER_OPTIONS,
} from "@/utils/constants/activities";
import toast from "react-hot-toast";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { removeActivityFromStore } from "@/app/(dashboard)/dashboard/(redux)/activities-slice";
import { deleteActivity } from "@/app/(dashboard)/dashboard/(services)/activities/actions";
import { ActivityModal } from "./ActivityModal";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import { cn } from "@/utils/utils";
import type { ActivityType, ActivityOutcome, TypeFilter } from "@/utils/interfaces/activities";

/* -------------------------------------------------------------------------- */
/* Config                                                                    */
/* -------------------------------------------------------------------------- */

const outcomeBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      outcome: {
        positive: "bg-emerald-50 text-emerald-700",
        neutral: "bg-[var(--border)] text-[var(--text2)]",
        negative: "bg-red-50 text-red-600",
        no_response: "bg-amber-50 text-amber-700",
      },
    },
    defaultVariants: { outcome: "neutral" },
  },
);


/* -------------------------------------------------------------------------- */
/* Component                                                                 */
/* -------------------------------------------------------------------------- */

export function ActivitiesTab({
  facilityId,
  canEdit,
}: {
  facilityId: string;
  canEdit: boolean;
}) {
  const dispatch = useAppDispatch();
  const activities = useAppSelector((s) => s.activities.items);
  const canManage = canEdit;

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return activities;
    return activities.filter((a) => a.type === typeFilter);
  }, [activities, typeFilter]);

  async function handleDelete() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteActivity(deleteId, facilityId);
      dispatch(removeActivityFromStore(deleteId));
      toast.success("Activity deleted.");
      setConfirmOpen(false);
    } catch {
      toast.error("Failed to delete activity.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Type filter pills */}
        <div className="flex overflow-x-auto gap-1.5 pb-1 flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {ACTIVITY_TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                typeFilter === opt.value
                  ? "bg-[var(--navy)] text-white"
                  : "bg-[var(--border)] text-[var(--text2)] hover:bg-[var(--border)]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {canManage && <ActivityModal facilityId={facilityId} />}
      </div>

      {/* ── Activity feed ── */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Activity className="w-10 h-10 stroke-1" />}
          message={
            typeFilter === "all"
              ? "No activities logged yet"
              : `No ${TYPE_LABELS[typeFilter as ActivityType]} activities`
          }
        />
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {filtered.map((activity) => {
            const Icon = TYPE_ICONS[activity.type];
            return (
              <motion.div
                key={activity.id}
                variants={fadeUp}
                className="bg-white border border-[var(--border)] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-start gap-3">
                  {/* Type icon */}
                  <div
                    className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                      TYPE_COLORS[activity.type],
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-[var(--navy)]">
                        {TYPE_LABELS[activity.type]}
                      </span>
                      <span
                        className={cn(
                          outcomeBadgeVariants({
                            outcome: activity.outcome,
                          }),
                        )}
                      >
                        <span
                          className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            OUTCOME_DOTS[activity.outcome],
                          )}
                        />
                        {OUTCOME_LABELS[activity.outcome]}
                      </span>
                      {activity.contact && (
                        <span className="text-xs text-[var(--text3)]">
                          with{" "}
                          <span className="font-medium text-[var(--text2)]">
                            {activity.contact.first_name}{" "}
                            {activity.contact.last_name}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text3)]">
                      <span>
                        {new Date(activity.activity_date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </span>
                      {activity.logged_by_profile && (
                        <span>
                          Logged by{" "}
                          <span className="text-[var(--text2)]">
                            {activity.logged_by_profile.first_name}{" "}
                            {activity.logged_by_profile.last_name}
                          </span>
                        </span>
                      )}
                    </div>

                    {activity.notes && (
                      <p className="text-sm text-[var(--text2)] leading-relaxed border-t border-[var(--border)] pt-2 mt-2">
                        {activity.notes}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  {canManage && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <ActivityModal
                        facilityId={facilityId}
                        activity={activity}
                      />
                      <button
                        type="button"
                        onClick={() => { setDeleteId(activity.id); setConfirmOpen(true); }}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text3)] hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete activity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <p className="text-xs text-[var(--text3)] text-right">
        {filtered.length} of {activities.length} activit
        {activities.length !== 1 ? "ies" : "y"}
      </p>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(v) => { if (!isDeleting) setConfirmOpen(v); }}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete Activity"
        description="This activity log will be permanently deleted. This action cannot be undone."
      />
    </div>
  );
}
