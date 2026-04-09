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
        high: "bg-[var(--red-lt)] text-[var(--red)]",
        medium: "bg-[var(--gold-lt)] text-[var(--gold)]",
        low: "bg-[var(--blue-lt)] text-[var(--blue)]",
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
        "bg-[var(--surface)] border rounded-[var(--r)] p-4 space-y-2 transition-opacity",
        isDone ? "border-[var(--border)] opacity-60" : "border-[var(--border)]",
        isOverdue && "border-l-2 border-l-[var(--red)] bg-[var(--red-lt)]/20",
      )}
    >
      {/* Top row: checkbox + title + actions */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onToggle(task)}
          disabled={isToggling}
          className={cn(
            "mt-0.5 shrink-0 text-[var(--text3)] hover:text-[var(--navy)] transition-colors",
            isToggling && "pointer-events-none opacity-50",
          )}
          title={isDone ? "Mark open" : "Mark done"}
        >
          {isToggling ? (
            <div className="size-4 rounded-full border-2 border-[var(--navy)] border-t-transparent animate-spin" />
          ) : isDone ? (
            <CheckSquare className="w-4.5 h-4.5 text-[var(--navy)]" />
          ) : (
            <Square className="w-4.5 h-4.5" />
          )}
        </button>

        <p
          className={cn(
            "flex-1 text-sm font-medium leading-snug min-w-0",
            isDone ? "line-through text-[var(--text3)]" : "text-[var(--navy)]",
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
            className="w-7 h-7 flex items-center justify-center rounded-md text-[var(--text3)] hover:text-red-600 hover:bg-red-50 transition-colors"
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
          <span className="text-[10px] font-medium bg-[var(--red-lt)] text-[var(--red)] border border-[var(--red)]/20 px-1.5 py-0.5 rounded">
            Overdue
          </span>
        )}

        {task.due_date && (
          <span className="flex items-center gap-1 text-xs text-[var(--text3)]">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}

        {task.facility && (
          <span className="flex items-center gap-1 text-xs text-[var(--text3)] truncate max-w-36">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.facility.name}</span>
          </span>
        )}

        {task.contact && (
          <span className="flex items-center gap-1 text-xs text-[var(--text3)]">
            <User className="w-3 h-3 shrink-0" />
            {task.contact.first_name} {task.contact.last_name}
          </span>
        )}
      </div>

      {task.notes && (
        <p className="text-xs text-[var(--text3)] pl-7 line-clamp-2">{task.notes}</p>
      )}
    </motion.div>
  );
}
