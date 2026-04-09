"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  createTask,
  updateTask,
  getTasks,
} from "@/app/(dashboard)/dashboard/tasks/(services)/actions";
import { getContactsByFacility } from "@/app/(dashboard)/dashboard/(services)/contacts/actions";
import { useAppDispatch } from "@/store/hooks";
import { setTasks } from "@/app/(dashboard)/dashboard/tasks/(redux)/tasks-slice";
import { TaskFormFields } from "./TaskFormFields";
import type { ITask, ITaskFormState } from "@/utils/interfaces/tasks";
import type { IAccount } from "@/utils/interfaces/accounts";
import type { IRepProfile } from "@/utils/interfaces/accounts";
import type { IContact } from "@/utils/interfaces/contacts";

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
            className="size-14 rounded-full bg-[var(--navy)] shadow-lg flex items-center justify-center text-white"
            aria-label="New task"
          >
            <Plus className="w-6 h-6" />
          </button>
        ) : (
          <Button
            size="sm"
            className="gap-1.5 bg-[var(--navy)] hover:bg-[var(--navy)]/90 text-white"
          >
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto sm:rounded-2xl border border-[var(--border)] shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Task" : "New Task"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4 mt-2">
          <TaskFormFields
            task={task}
            accounts={accounts}
            salesReps={salesReps}
            isAdmin={isAdmin}
            isEdit={isEdit}
            selectedFacilityId={selectedFacilityId}
            onFacilityChange={setSelectedFacilityId}
            facilityContacts={facilityContacts}
            loadingContacts={loadingContacts}
            state={state}
            isPending={isPending}
            onCancel={() => setOpen(false)}
          />
        </form>
      </DialogContent>
    </Dialog>
  );
}
