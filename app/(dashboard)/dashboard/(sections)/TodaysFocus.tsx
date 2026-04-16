"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { formatDate } from "@/utils/helpers/formatter";
import { KANBAN_STATUS_CONFIG } from "@/app/(dashboard)/dashboard/orders/(components)/kanban-config";
import { cn } from "@/utils/utils";
import type { ITask } from "@/utils/interfaces/tasks";
import type { DashboardOrder, OrderStatus } from "@/utils/interfaces/orders";

const ATTENTION_STATUSES: OrderStatus[] = ["pending_signature", "additional_info_needed"];
const MS_DAY = 24 * 60 * 60 * 1000;

function daysFrom(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / MS_DAY);
}

function patientName(o: DashboardOrder): string {
  const p: any = (o as any).patients ?? (o as any).patient ?? null;
  if (!p) return "—";
  const row = Array.isArray(p) ? p[0] : p;
  return `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim() || "—";
}

export function TodaysFocus({
  tasks,
  orders,
  onOrderClick,
}: {
  tasks: ITask[];
  orders: DashboardOrder[];
  onOrderClick: (orderId: string) => void;
}) {
  const router = useRouter();

  const { overdue, dueThisWeek, attentionOrders } = useMemo(() => {
    const now = Date.now();
    const weekAhead = now + 7 * MS_DAY;
    const openTasks = tasks.filter((t) => t.status === "open");
    const overdue = openTasks
      .filter((t) => new Date(t.due_date).getTime() < now)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const dueThisWeek = openTasks
      .filter((t) => {
        const d = new Date(t.due_date).getTime();
        return d >= now && d < weekAhead;
      })
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    const attentionOrders = orders.filter((o) =>
      ATTENTION_STATUSES.includes(o.order_status as OrderStatus),
    );
    return { overdue, dueThisWeek, attentionOrders };
  }, [tasks, orders]);

  const isEmpty =
    overdue.length === 0 && dueThisWeek.length === 0 && attentionOrders.length === 0;

  function handleTaskClick(t: ITask) {
    const facilityId = t.facility_id ?? t.facility?.id ?? null;
    if (facilityId) router.push(`/dashboard/accounts/${facilityId}`);
    else router.push(`/dashboard/tasks`);
  }

  return (
    <div className="overflow-hidden rounded-[var(--r)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-4 py-[0.8rem]">
        <p className="text-[13px] font-semibold text-[var(--navy)]">Today&apos;s Focus</p>
        <p className="text-[11px] text-[var(--text3)]">Your action items right now</p>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-[var(--green)] mb-2 stroke-1" />
          <p className="text-sm font-medium text-[var(--navy)]">All clear</p>
          <p className="text-[11px] text-[var(--text3)]">Nothing urgent on your plate</p>
        </div>
      ) : (
        <>
          {overdue.length > 0 && (
            <FocusGroup dotClass="bg-red-500" title="Overdue Tasks" count={overdue.length}>
              {overdue.map((t) => {
                const d = daysFrom(t.due_date);
                return (
                  <li
                    key={t.id}
                    onClick={() => handleTaskClick(t)}
                    className="cursor-pointer hover:bg-[#f8fafc] px-4 py-2 border-t border-[var(--border)]"
                  >
                    <p className="text-sm text-[var(--navy)] truncate">{t.title}</p>
                    <p className="text-[11px] text-red-600">
                      Overdue by {d} day{d !== 1 ? "s" : ""} · {t.facility?.name ?? "—"}
                    </p>
                  </li>
                );
              })}
            </FocusGroup>
          )}

          {dueThisWeek.length > 0 && (
            <FocusGroup dotClass="bg-[var(--gold)]" title="Due This Week" count={dueThisWeek.length}>
              {dueThisWeek.map((t) => (
                <li
                  key={t.id}
                  onClick={() => handleTaskClick(t)}
                  className="cursor-pointer hover:bg-[#f8fafc] px-4 py-2 border-t border-[var(--border)]"
                >
                  <p className="text-sm text-[var(--navy)] truncate">{t.title}</p>
                  <p className="text-[11px] text-[var(--text3)]">
                    {formatDate(t.due_date)} · {t.facility?.name ?? "—"}
                  </p>
                </li>
              ))}
            </FocusGroup>
          )}

          {attentionOrders.length > 0 && (
            <FocusGroup dotClass="bg-[var(--navy)]" title="Orders Needing Attention" count={attentionOrders.length}>
              {attentionOrders.map((o) => {
                const cfg = KANBAN_STATUS_CONFIG[o.order_status as OrderStatus];
                return (
                  <li
                    key={o.id}
                    onClick={() => onOrderClick(o.id)}
                    className="cursor-pointer hover:bg-[#f8fafc] px-4 py-2 border-t border-[var(--border)] flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--navy)] truncate">
                        {o.order_number ?? o.id.slice(0, 8)} · {patientName(o)}
                      </p>
                    </div>
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0", cfg?.badge ?? "")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", cfg?.dot ?? "bg-gray-400")} />
                      {cfg?.label ?? o.order_status}
                    </span>
                  </li>
                );
              })}
            </FocusGroup>
          )}
        </>
      )}
    </div>
  );
}

function FocusGroup({
  dotClass,
  title,
  count,
  children,
}: {
  dotClass: string;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 bg-[#f8fafc]">
        <span className={cn("w-2 h-2 rounded-full", dotClass)} />
        <p className="text-[12px] font-semibold text-[var(--navy)]">{title}</p>
        <span className="ml-auto text-[10px] font-bold text-[var(--text3)]">{count}</span>
      </div>
      <ul>{children}</ul>
    </div>
  );
}
