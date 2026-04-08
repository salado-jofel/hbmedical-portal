"use client";

import { motion } from "framer-motion";
import { cva } from "class-variance-authority";
import {
  CheckSquare,
  Square,
  Trash2,
  Calendar,
  Building2,
  User,
} from "lucide-react";
import { cn } from "@/utils/utils";
import { fadeUp } from "@/components/ui/animations";
import { TaskModal } from "./TaskModal";
import type { ITask, TaskPriority } from "@/utils/interfaces/tasks";
import type { IAccount, IRepProfile } from "@/utils/interfaces/accounts";

const priorityBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      priority: {
        high: "bg-red-50 text-red-600",
        medium: "bg-amber-50 text-amber-700",
        low: "bg-[#F1F5F9] text-[#64748B]",
      },
    },
    defaultVariants: { priority: "medium" },
  },
);

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface TaskCardProps {
  task: ITask;
  accounts: IAccount[];
  salesReps: IRepProfile[];
  isAdmin: boolean;
  togglingId: string | null;
  deletingId: string | null;
  onToggle: (task: ITask) => void;
  onDelete: (taskId: string) => void;
}

export function TaskCard({
  task,
  accounts,
  salesReps,
  isAdmin,
  togglingId,
  deletingId,
  onToggle,
  onDelete,
}: TaskCardProps) {
  const isDone = task.status === "done";
  const isToggling = togglingId === task.id;
  const isDeleting = deletingId === task.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue =
    !isDone &&
    !!task.due_date &&
    new Date(task.due_date + "T00:00:00") < today;

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "bg-white border rounded-xl p-4 space-y-2 transition-opacity shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        isDone ? "border-[#E2E8F0] opacity-60" : "border-[#E2E8F0]",
        isOverdue && "border-l-2 border-l-red-400 bg-red-50/20",
      )}
    >
      {/* Top row: checkbox + title + actions */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onToggle(task)}
          disabled={isToggling}
          className={cn(
            "mt-0.5 shrink-0 text-[#94A3B8] hover:text-[#15689E] transition-colors",
            isToggling && "pointer-events-none opacity-50",
          )}
          title={isDone ? "Mark open" : "Mark done"}
        >
          {isToggling ? (
            <div className="size-4 rounded-full border-2 border-[#15689E] border-t-transparent animate-spin" />
          ) : isDone ? (
            <CheckSquare className="w-4.5 h-4.5 text-[#15689E]" />
          ) : (
            <Square className="w-4.5 h-4.5" />
          )}
        </button>

        <p
          className={cn(
            "flex-1 text-sm font-medium leading-snug min-w-0",
            isDone ? "line-through text-[#94A3B8]" : "text-[#0F172A]",
          )}
        >
          {task.title}
        </p>

        <div className="flex items-center gap-0.5 shrink-0">
          <TaskModal
            task={task}
            accounts={accounts}
            salesReps={salesReps}
            isAdmin={isAdmin}
          />
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            disabled={isDeleting}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#94A3B8] hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete task"
          >
            {isDeleting ? (
              <div className="size-3.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 pl-7">
        <span className={cn(priorityBadgeVariants({ priority: task.priority }))}>
          {PRIORITY_LABELS[task.priority]}
        </span>

        {isOverdue && (
          <span className="text-[10px] font-medium bg-red-50 text-red-600 border border-red-200 px-1.5 py-0.5 rounded">
            Overdue
          </span>
        )}

        {task.due_date && (
          <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}

        {task.facility && (
          <span className="flex items-center gap-1 text-xs text-[#94A3B8] truncate max-w-36">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.facility.name}</span>
          </span>
        )}

        {task.contact && (
          <span className="flex items-center gap-1 text-xs text-[#94A3B8]">
            <User className="w-3 h-3 shrink-0" />
            {task.contact.first_name} {task.contact.last_name}
          </span>
        )}
      </div>

      {task.notes && (
        <p className="text-xs text-[#94A3B8] pl-7 line-clamp-2">{task.notes}</p>
      )}
    </motion.div>
  );
}
