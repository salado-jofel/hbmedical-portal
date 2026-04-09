"use client";

import { Loader2 } from "lucide-react";
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
import type { ITask, ITaskFormState } from "@/utils/interfaces/tasks";
import type { IAccount, IRepProfile } from "@/utils/interfaces/accounts";
import type { IContact } from "@/utils/interfaces/contacts";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

interface TaskFormFieldsProps {
  task?: ITask;
  accounts: IAccount[];
  salesReps: IRepProfile[];
  isAdmin: boolean;
  isEdit: boolean;
  selectedFacilityId: string;
  onFacilityChange: (id: string) => void;
  facilityContacts: IContact[];
  loadingContacts: boolean;
  state: ITaskFormState | null;
  isPending: boolean;
  onCancel: () => void;
}

export function TaskFormFields({
  task,
  accounts,
  salesReps,
  isAdmin,
  isEdit,
  selectedFacilityId,
  onFacilityChange,
  facilityContacts,
  loadingContacts,
  state,
  isPending,
  onCancel,
}: TaskFormFieldsProps) {
  return (
    <>
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
            Due date <span className="text-red-400">*</span>
          </Label>
          <input
            id="due_date"
            name="due_date"
            type="date"
            required
            defaultValue={task?.due_date ?? ""}
            className="h-9 w-full rounded-md border border-[var(--border)] bg-white px-3 py-1 text-sm text-[var(--navy)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--navy)]/10 focus-visible:border-[var(--navy)]"
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
              <SelectItem value="none" className="text-sm text-[var(--text3)]">
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
          <span className="text-[var(--text3)] font-normal">(optional)</span>
        </Label>
        <Select
          name="facility_id"
          value={selectedFacilityId || "none"}
          onValueChange={(v) => onFacilityChange(v === "none" ? "" : v)}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="No account linked" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none" className="text-sm text-[var(--text3)]">
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
          <span className="text-[var(--text3)] font-normal">(optional)</span>
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
            <SelectItem value="none" className="text-sm text-[var(--text3)]">
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
          className="w-full sm:w-auto border-[var(--border)] text-[#374151] hover:bg-[var(--bg)]"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          className="w-full sm:w-auto bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
        >
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isEdit ? "Save changes" : "Create task"}
        </Button>
      </div>
    </>
  );
}
