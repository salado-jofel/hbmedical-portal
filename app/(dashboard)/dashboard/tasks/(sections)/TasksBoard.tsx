"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import toast from "react-hot-toast";
import { motion } from "framer-motion";
import { CheckSquare } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import {
  updateTaskInStore,
  removeTaskFromStore,
} from "@/app/(dashboard)/dashboard/tasks/(redux)/tasks-slice";
import {
  toggleTaskStatus,
  deleteTask,
} from "@/app/(dashboard)/dashboard/tasks/(services)/actions";
import { TaskModal } from "../(components)/TaskModal";
import { TaskCard } from "../(components)/TaskCard";
import { EmptyState } from "@/app/(components)/EmptyState";
import { KanbanColumn } from "@/app/(components)/KanbanColumn";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { staggerContainer } from "@/components/ui/animations";
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
import { GROUP_CONFIG } from "@/utils/constants/tasks";
import { useTableRealtimeRefresh } from "@/utils/hooks/useOrderRealtime";
import { useListParams } from "@/utils/hooks/useListParams";

type GroupKey = keyof typeof GROUP_CONFIG;

/* -------------------------------------------------------------------------- */
/* TasksBoard                                                                 */
/* -------------------------------------------------------------------------- */

export function TasksBoard({ accounts, salesReps, isAdmin }: {
  accounts: IAccount[];
  salesReps: IRepProfile[];
  isAdmin: boolean;
}) {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((s) => s.tasks.items);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const deepLinkId = searchParams?.get("id") ?? null;
  const deepLinkTask = useMemo(
    () => (deepLinkId ? tasks.find((t) => t.id === deepLinkId) ?? null : null),
    [deepLinkId, tasks],
  );

  function clearDeepLink() {
    router.replace(pathname);
  }

  // Due-date grouping (Overdue / This Week / Later) is the primary UX here;
  // pagination would fragment the semantic groups. So this list gets URL-
  // backed filters + search without pagination/sort — the grouping IS the
  // sort. Flagged as a design choice, not an oversight.
  const listParams = useListParams<
    readonly ["due_date"],
    readonly ["status", "priority"]
  >({
    defaultSort: "due_date",
    defaultDir: "asc",
    allowedSorts: ["due_date"] as const,
    filterKeys: ["status", "priority"] as const,
  });
  const statusFilter = (listParams.filters.status as TaskStatus | null) ?? "all";
  const priorityFilter =
    (listParams.filters.priority as TaskPriority | null) ?? "all";
  const setStatusFilter = (v: TaskStatus | "all") =>
    listParams.setFilter("status", v === "all" ? null : v);
  const setPriorityFilter = (v: TaskPriority | "all") =>
    listParams.setFilter("priority", v === "all" ? null : v);

  // Search is ephemeral — task titles can include patient / facility context.
  const [search, setSearch] = useState("");

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Keep the board live when another user assigns / completes / deletes a task.
  useTableRealtimeRefresh("tasks");

  useEffect(() => setMounted(true), []);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    let result = tasks;
    if (statusFilter !== "all") result = result.filter((t) => t.status === statusFilter);
    if (priorityFilter !== "all")
      result = result.filter((t) => t.priority === priorityFilter);
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      result = result.filter((t) =>
        (t.title ?? "").toLowerCase().includes(term),
      );
    }
    return result;
  }, [tasks, statusFilter, priorityFilter, search]);

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

  if (!mounted) return null;

  return (
    <div className="space-y-5">
      {/* ── Toolbar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex overflow-x-auto gap-2 pb-1 flex-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Search — not persisted to URL (task titles can reference patients). */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="h-8 w-48 shrink-0 rounded-md border border-[var(--border)] bg-white px-2 text-xs text-[var(--navy)] placeholder:text-[var(--text3)] outline-none focus:border-[var(--navy)]"
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as TaskStatus | "all")}
          >
            <SelectTrigger className="h-8 w-36 text-xs shrink-0 border-[var(--border)] text-[var(--navy)]">
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
            <SelectTrigger className="h-8 w-36 text-xs shrink-0 border-[var(--border)] text-[var(--navy)]">
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
            <span className="flex items-center text-xs text-[var(--text2)] self-center shrink-0">
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
              <KanbanColumn
                key={groupKey}
                label={config.label}
                count={groupTasks.length}
                dot={config.dotClass}
                labelClassName={groupKey === "overdue" ? "text-red-600" : undefined}
                countVariant={groupKey === "overdue" ? "overdue" : "default"}
                className="overflow-hidden"
                bodyClassName="p-0 gap-0 overflow-y-visible"
              >
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="flex flex-col gap-2 p-3 flex-1 overflow-y-auto max-h-[calc(100vh-300px)]"
                >
                  {groupTasks.length === 0 ? (
                    <p className="text-xs text-[var(--text3)] text-center py-4">
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
              </KanbanColumn>
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

      {deepLinkTask && (
        <TaskModal
          key={deepLinkTask.id}
          task={deepLinkTask}
          accounts={accounts}
          salesReps={salesReps}
          isAdmin={isAdmin}
          initialOpen
          hideTrigger
          onClosed={clearDeepLink}
        />
      )}
    </div>
  );
}
