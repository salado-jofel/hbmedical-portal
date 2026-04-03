"use client";

import { useMemo, useState } from "react";
import toast from "react-hot-toast";
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
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  updateTaskInStore,
  removeTaskFromStore,
} from "@/app/(dashboard)/dashboard/(redux)/tasks-slice";
import {
  toggleTaskStatus,
  deleteTask,
} from "@/app/(dashboard)/dashboard/(services)/tasks/actions";
import { TaskModal } from "./TaskModal";
import { EmptyState } from "@/app/(components)/EmptyState";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { staggerContainer, fadeUp } from "@/components/ui/animations";
import { cn } from "@/utils/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  groupTasksByDue,
  type ITask,
  type TaskPriority,
  type TaskStatus,
} from "@/utils/interfaces/tasks";
import type { IAccount, IRepProfile } from "@/utils/interfaces/accounts";

/* -------------------------------------------------------------------------- */
/* CVA: Priority badge                                                       */
/* -------------------------------------------------------------------------- */

const priorityBadgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      priority: {
        high: "bg-red-50 text-red-600 border-red-200",
        medium: "bg-[#e8821a]/10 text-[#e8821a] border-[#e8821a]/20",
        low: "bg-zinc-100 text-zinc-500 border-zinc-200",
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

/* -------------------------------------------------------------------------- */
/* Group config                                                              */
/* -------------------------------------------------------------------------- */

const GROUP_CONFIG = {
  overdue: {
    label: "Overdue",
    dotClass: "bg-red-500",
    emptyLabel: "No overdue tasks",
  },
  today: {
    label: "Due Today",
    dotClass: "bg-[#e8821a]",
    emptyLabel: "Nothing due today",
  },
  upcoming: {
    label: "Upcoming",
    dotClass: "bg-[#15689E]",
    emptyLabel: "No upcoming tasks",
  },
  done: {
    label: "Completed",
    dotClass: "bg-slate-400",
    emptyLabel: "No completed tasks",
  },
} as const;

type GroupKey = keyof typeof GROUP_CONFIG;

/* -------------------------------------------------------------------------- */
/* TaskCard                                                                  */
/* -------------------------------------------------------------------------- */

function TaskCard({
  task,
  accounts,
  salesReps,
  isAdmin,
  togglingId,
  deletingId,
  onToggle,
  onDelete,
}: {
  task: ITask;
  accounts: IAccount[];
  salesReps: IRepProfile[];
  isAdmin: boolean;
  togglingId: string | null;
  deletingId: string | null;
  onToggle: (task: ITask) => void;
  onDelete: (taskId: string) => void;
}) {
  const isDone = task.status === "done";
  const isToggling = togglingId === task.id;
  const isDeleting = deletingId === task.id;

  return (
    <motion.div
      variants={fadeUp}
      className={cn(
        "bg-white border rounded-xl p-4 space-y-2 transition-opacity",
        isDone ? "border-slate-100 opacity-60" : "border-slate-200",
      )}
    >
      {/* Top row: checkbox + title + actions */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onToggle(task)}
          disabled={isToggling}
          className={cn(
            "mt-0.5 shrink-0 text-slate-400 hover:text-[#15689E] transition-colors",
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
            isDone ? "line-through text-slate-400" : "text-slate-800",
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
            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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

        {task.due_date && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Calendar className="w-3 h-3" />
            {new Date(task.due_date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        )}

        {task.facility && (
          <span className="flex items-center gap-1 text-xs text-slate-400 truncate max-w-36">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.facility.name}</span>
          </span>
        )}

        {task.contact && (
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <User className="w-3 h-3 shrink-0" />
            {task.contact.first_name} {task.contact.last_name}
          </span>
        )}
      </div>

      {task.notes && (
        <p className="text-xs text-slate-400 pl-7 line-clamp-2">{task.notes}</p>
      )}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* TasksBoard                                                                */
/* -------------------------------------------------------------------------- */

interface TasksBoardProps {
  accounts: IAccount[];
  salesReps: IRepProfile[];
  isAdmin: boolean;
}

export function TasksBoard({ accounts, salesReps, isAdmin }: TasksBoardProps) {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((s) => s.tasks.items);

  const [statusFilter, setStatusFilter] = useState<TaskStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    let result = tasks;
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all") result = result.filter((t) => t.priority === priorityFilter);
    return result;
  }, [tasks, statusFilter, priorityFilter]);

  const grouped = useMemo(() => groupTasksByDue(filtered), [filtered]);

  async function handleToggle(task: ITask) {
    setTogglingId(task.id);
    try {
      const updated = await toggleTaskStatus(task.id, task.status);
      dispatch(updateTaskInStore(updated));
      toast.success(updated.status === "done" ? "Task marked done." : "Task reopened.");
    } catch {
      toast.error("Failed to update task.");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deleteTask(deleteId);
      dispatch(removeTaskFromStore(deleteId));
      toast.success("Task deleted.");
      setConfirmOpen(false);
    } catch {
      toast.error("Failed to delete task.");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  }

  const totalOpen = tasks.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex overflow-x-auto gap-2 pb-1 flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}
          >
            <SelectTrigger className="h-8 w-36 text-xs shrink-0">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="done">Done</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={priorityFilter}
            onValueChange={(v) => setPriorityFilter(v as TaskPriority | "all")}
          >
            <SelectTrigger className="h-8 w-36 text-xs shrink-0">
              <SelectValue placeholder="All priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          {totalOpen > 0 && (
            <span className="flex items-center text-xs text-slate-500 self-center shrink-0">
              {totalOpen} open task{totalOpen !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Desktop New Task button */}
        <div className="hidden sm:flex">
          <TaskModal
            accounts={accounts}
            salesReps={salesReps}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      {/* ── Mobile FAB ── */}
      <div className="fixed bottom-20 right-4 z-40 sm:hidden">
        <TaskModal
          accounts={accounts}
          salesReps={salesReps}
          isAdmin={isAdmin}
          fab
        />
      </div>

      {/* ── Groups ── */}
      {tasks.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="w-10 h-10 stroke-1" />}
          message="No tasks yet"
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {(["overdue", "today", "upcoming", "done"] as GroupKey[]).map((groupKey) => {
            const config = GROUP_CONFIG[groupKey];
            const groupTasks = grouped[groupKey];

            return (
              <div key={groupKey} className="flex flex-col bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                {/* Group header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.dotClass)} />
                    <span className="text-sm font-semibold text-slate-700">{config.label}</span>
                  </div>
                  <span className="min-w-5 h-5 flex items-center justify-center rounded-full bg-[#15689E] text-white text-xs font-bold px-1.5">
                    {groupTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col gap-2 p-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]"
                >
                  {groupTasks.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">
                      {config.emptyLabel}
                    </p>
                  ) : (
                    groupTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        accounts={accounts}
                        salesReps={salesReps}
                        isAdmin={isAdmin}
                        togglingId={togglingId}
                        deletingId={isDeleting ? deleteId : null}
                        onToggle={handleToggle}
                        onDelete={(id) => { setDeleteId(id); setConfirmOpen(true); }}
                      />
                    ))
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(v) => { if (!isDeleting) setConfirmOpen(v); }}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        title="Delete Task"
        description="This task will be permanently removed."
      />
    </div>
  );
}
