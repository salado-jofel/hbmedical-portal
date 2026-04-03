"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cva } from "class-variance-authority";
import {
  MapPin,
  Phone,
  Mail,
  Video,
  Trash2,
  Activity,
} from "lucide-react";
import toast from "react-hot-toast";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { removeActivityFromStore } from "@/app/(dashboard)/dashboard/(redux)/activities-slice";
import { deleteActivity } from "@/app/(dashboard)/dashboard/(services)/activities/actions";
import { ActivityModal } from "./ActivityModal";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import { cn } from "@/utils/utils";
import type { ActivityType, ActivityOutcome } from "@/utils/interfaces/activities";

/* -------------------------------------------------------------------------- */
/* Config                                                                    */
/* -------------------------------------------------------------------------- */

const TYPE_ICONS: Record<ActivityType, React.ElementType> = {
  visit: MapPin,
  call: Phone,
  email: Mail,
  demo: Video,
};

const TYPE_LABELS: Record<ActivityType, string> = {
  visit: "Visit",
  call: "Call",
  email: "Email",
  demo: "Demo",
};

const TYPE_COLORS: Record<ActivityType, string> = {
  visit: "bg-emerald-50 text-emerald-700",
  call: "bg-blue-50 text-[#15689E]",
  email: "bg-violet-50 text-violet-700",
  demo: "bg-[#e8821a]/10 text-[#e8821a]",
};

const outcomeBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      outcome: {
        positive: "bg-emerald-50 text-emerald-700",
        neutral: "bg-[#F1F5F9] text-[#64748B]",
        negative: "bg-red-50 text-red-600",
        no_response: "bg-amber-50 text-amber-700",
      },
    },
    defaultVariants: { outcome: "neutral" },
  },
);

const OUTCOME_LABELS: Record<ActivityOutcome, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  no_response: "No Response",
};

const OUTCOME_DOTS: Record<ActivityOutcome, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-zinc-400",
  negative: "bg-red-500",
  no_response: "bg-yellow-400",
};

type TypeFilter = ActivityType | "all";

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "visit", label: "Visit" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "demo", label: "Demo" },
];

/* -------------------------------------------------------------------------- */
/* Component                                                                 */
/* -------------------------------------------------------------------------- */

interface ActivitiesTabProps {
  facilityId: string;
  canEdit: boolean;
}

export function ActivitiesTab({
  facilityId,
  canEdit,
}: ActivitiesTabProps) {
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
          {TYPE_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTypeFilter(opt.value)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                typeFilter === opt.value
                  ? "bg-[#15689E] text-white"
                  : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]",
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
                className="bg-white border border-[#E2E8F0] rounded-xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
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
                      <span className="text-sm font-semibold text-[#0F172A]">
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
                        <span className="text-xs text-[#94A3B8]">
                          with{" "}
                          <span className="font-medium text-[#64748B]">
                            {activity.contact.first_name}{" "}
                            {activity.contact.last_name}
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-[#94A3B8]">
                      <span>
                        {new Date(activity.activity_date + "T00:00:00").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
                      </span>
                      {activity.logged_by_profile && (
                        <span>
                          Logged by{" "}
                          <span className="text-[#64748B]">
                            {activity.logged_by_profile.first_name}{" "}
                            {activity.logged_by_profile.last_name}
                          </span>
                        </span>
                      )}
                    </div>

                    {activity.notes && (
                      <p className="text-sm text-[#64748B] leading-relaxed border-t border-[#F1F5F9] pt-2 mt-2">
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
                        className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors"
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

      <p className="text-xs text-[#94A3B8] text-right">
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
