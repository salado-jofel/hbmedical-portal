"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createTask,
  updateTask,
  getTasks,
} from "@/app/(dashboard)/dashboard/tasks/(services)/actions";
import { getContactsByFacility } from "@/app/(dashboard)/dashboard/(services)/contacts/actions";
import { useAppDispatch } from "@/store/hooks";
import { setTasks } from "@/app/(dashboard)/dashboard/tasks/(redux)/tasks-slice";
import type { ITask, ITaskFormState } from "@/utils/interfaces/tasks";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { IRepProfile } from "@/utils/interfaces/accounts";
import type { IContact } from "@/utils/interfaces/contacts";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface TaskModalProps {
  task?: ITask;
  accounts: IAccount[];
  salesReps: IRepProfile[];
  isAdmin: boolean;
  /** When opened from account detail, pre-select this facility */
  defaultFacilityId?: string;
  /** Render trigger as mobile FAB (circular + button) */
  fab?: boolean;
}

export function TaskModal({
  task,
  accounts,
  salesReps,
  isAdmin,
  defaultFacilityId,
  fab,
}: TaskModalProps) {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isEdit = !!task;

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    task?.facility_id ?? defaultFacilityId ?? "",
  );
  const [facilityContacts, setFacilityContacts] = useState<IContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);

  const action = isEdit
    ? updateTask.bind(null, task.id)
    : createTask;

  const [state, formAction, isPending] = useActionState<
    ITaskFormState | null,
    FormData
  >(action, null);

  // Fetch contacts when facility changes
  useEffect(() => {
    if (!selectedFacilityId) {
      setFacilityContacts([]);
      return;
    }
    setLoadingContacts(true);
    getContactsByFacility(selectedFacilityId)
      .then(setFacilityContacts)
      .catch(() => setFacilityContacts([]))
      .finally(() => setLoadingContacts(false));
  }, [selectedFacilityId]);

  // On success: close, reset, refresh Redux
  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Task created successfully.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="w-7 h-7">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : fab ? (
          <button
            type="button"
            className="size-14 rounded-full bg-[#15689E] shadow-lg flex items-center justify-center text-white"
            aria-label="New task"
          >
            <Plus className="w-6 h-6" />
          </button>
        ) : (
          <Button
            size="sm"
            className="gap-1.5 bg-[#15689E] hover:bg-[#15689E]/90 text-white"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto sm:rounded-2xl border border-[#E2E8F0] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4 mt-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title" className="text-xs">
              Title <span className="text-red-400">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              required
              defaultValue={task?.title ?? ""}
              placeholder="Follow up with director..."
              className="h-9 text-sm"
            />
          </div>

          {/* Due date + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due_date" className="text-xs">
                Due date
              </Label>
              <input
                id="due_date"
                name="due_date"
                type="date"
                defaultValue={task?.due_date ?? ""}
                className="h-9 w-full rounded-md border border-[#E2E8F0] bg-white px-3 py-1 text-sm text-[#0F172A] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15689E]/10 focus-visible:border-[#15689E]"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="priority" className="text-xs">
                Priority
              </Label>
              <Select name="priority" defaultValue={task?.priority ?? "medium"}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-sm">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assigned to (admin only) */}
          {isAdmin && (
            <div className="space-y-1.5">
              <Label htmlFor="assigned_to" className="text-xs">
                Assign to
              </Label>
              <Select
                name="assigned_to"
                defaultValue={task?.assigned_to ?? "none"}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select rep" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-sm text-[#94A3B8]">
                    Unassigned
                  </SelectItem>
                  {salesReps
                    .filter((rep) => !!rep.id)
                    .map((rep) => (
                      <SelectItem key={rep.id} value={rep.id} className="text-sm">
                        {rep.first_name} {rep.last_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Account (facility) */}
          <div className="space-y-1.5">
            <Label htmlFor="facility_id" className="text-xs">
              Account{" "}
              <span className="text-[#94A3B8] font-normal">(optional)</span>
            </Label>
            <Select
              name="facility_id"
              value={selectedFacilityId || "none"}
              onValueChange={(v) => {
                setSelectedFacilityId(v === "none" ? "" : v);
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="No account linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm text-[#94A3B8]">
                  No account linked
                </SelectItem>
                {accounts
                  .filter((a) => !!a.id)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-sm">
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact (depends on facility) */}
          <div className="space-y-1.5">
            <Label htmlFor="contact_id" className="text-xs">
              Contact{" "}
              <span className="text-[#94A3B8] font-normal">(optional)</span>
            </Label>
            <Select
              name="contact_id"
              defaultValue={task?.contact_id ?? "none"}
              disabled={!selectedFacilityId || loadingContacts}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue
                  placeholder={
                    !selectedFacilityId
                      ? "Select an account first"
                      : loadingContacts
                        ? "Loading..."
                        : "No contact linked"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm text-[#94A3B8]">
                  No contact linked
                </SelectItem>
                {facilityContacts
                  .filter((c) => !!c.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-sm">
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              Notes
            </Label>
            <Textarea
              id="notes"
              name="notes"
              defaultValue={task?.notes ?? ""}
              placeholder="Additional context..."
              className="text-sm resize-none h-20"
            />
          </div>

          {/* Error */}
          {state?.error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="w-full sm:w-auto bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Create task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
