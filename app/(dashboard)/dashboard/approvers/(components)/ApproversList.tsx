"use client";

import { useState, useTransition } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateApproverInStore } from "../(redux)/approvers-slice";
import { updateApprover } from "../(services)/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Save, X, Loader2, Power } from "lucide-react";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";

export function ApproversList() {
  const dispatch = useAppDispatch();
  const approvers = useAppSelector((s) => s.approvers.items);
  const [editing, setEditing] = useState<
    Record<string, { name: string; email: string }>
  >({});
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function startEdit(a: IExternalApprover) {
    setEditing((prev) => ({ ...prev, [a.id]: { name: a.name, email: a.email } }));
  }
  function cancelEdit(id: string) {
    setEditing((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }
  function saveEdit(id: string) {
    const patch = editing[id];
    if (!patch) return;
    setBusyId(id);
    startTransition(async () => {
      const res = await updateApprover(id, patch);
      setBusyId(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      dispatch(updateApproverInStore(res.approver));
      toast.success("Approver updated.");
      cancelEdit(id);
    });
  }
  function toggleActive(a: IExternalApprover) {
    setBusyId(a.id);
    startTransition(async () => {
      const res = await updateApprover(a.id, { isActive: !a.isActive });
      setBusyId(null);
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      dispatch(updateApproverInStore(res.approver));
      toast.success(
        res.approver.isActive ? "Approver activated." : "Approver deactivated.",
      );
    });
  }

  if (approvers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] px-6 py-12 text-center bg-white mt-4">
        <p className="text-[13px] text-[var(--text2)]">
          No external approvers yet.
        </p>
        <p className="text-[12px] text-[var(--text3)] mt-1">
          Add one to start dispatching IVRs for external approval.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-white overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--bg)] text-[10px] font-semibold uppercase tracking-wide text-[var(--text3)]">
          <tr>
            <th className="text-left px-4 py-2.5">Name</th>
            <th className="text-left px-4 py-2.5">Email</th>
            <th className="text-left px-4 py-2.5">Status</th>
            <th className="text-right px-4 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {approvers.map((a) => {
            const edit = editing[a.id];
            const isBusy = busyId === a.id && pending;
            return (
              <tr
                key={a.id}
                className={cn(!a.isActive && "opacity-60")}
              >
                <td className="px-4 py-2.5">
                  {edit ? (
                    <Input
                      value={edit.name}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [a.id]: { ...edit, name: e.target.value },
                        }))
                      }
                      disabled={isBusy}
                      className="h-8 text-[13px]"
                    />
                  ) : (
                    <span className="font-medium">{a.name}</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {edit ? (
                    <Input
                      type="email"
                      value={edit.email}
                      onChange={(e) =>
                        setEditing((prev) => ({
                          ...prev,
                          [a.id]: { ...edit, email: e.target.value },
                        }))
                      }
                      disabled={isBusy}
                      className="h-8 text-[13px]"
                    />
                  ) : (
                    a.email
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium",
                      a.isActive
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-gray-100 text-gray-600 border border-gray-200",
                    )}
                  >
                    {a.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1.5">
                    {edit ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancelEdit(a.id)}
                          disabled={isBusy}
                          className="h-7 gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => saveEdit(a.id)}
                          disabled={isBusy}
                          className="h-7 gap-1"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(a)}
                          disabled={isBusy}
                          className="h-7 gap-1"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleActive(a)}
                          disabled={isBusy}
                          className={cn(
                            "h-7 gap-1",
                            a.isActive && "text-red-600 hover:text-red-700",
                          )}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Power className="w-3.5 h-3.5" />
                          )}
                          {a.isActive ? "Deactivate" : "Activate"}
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
