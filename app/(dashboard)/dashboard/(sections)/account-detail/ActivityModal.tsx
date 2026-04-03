"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2, Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
  createActivity,
  updateActivity,
  getActivitiesByFacility,
} from "@/app/(dashboard)/dashboard/(services)/activities/actions";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActivities, addActivityToStore } from "@/app/(dashboard)/dashboard/(redux)/activities-slice";
import type { IActivity, IActivityFormState } from "@/utils/interfaces/activities";

const TYPE_OPTIONS = [
  { value: "visit", label: "Visit" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "demo", label: "Demo" },
];

const OUTCOME_OPTIONS = [
  { value: "positive", label: "Positive" },
  { value: "neutral", label: "Neutral" },
  { value: "negative", label: "Negative" },
  { value: "no_response", label: "No Response" },
];

interface ActivityModalProps {
  facilityId: string;
  activity?: IActivity;
}

export function ActivityModal({ facilityId, activity }: ActivityModalProps) {
  const dispatch = useAppDispatch();
  const contacts = useAppSelector((s) => s.contacts.items);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const isEdit = !!activity;
  const today = new Date().toISOString().split("T")[0];

  const action = isEdit
    ? updateActivity.bind(null, activity.id, facilityId)
    : createActivity.bind(null, facilityId);

  const [state, formAction, isPending] = useActionState<
    IActivityFormState | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success(isEdit ? "Activity updated." : "Activity logged.");
      setOpen(false);
      formRef.current?.reset();
      if (state.activity) {
        dispatch(addActivityToStore(state.activity));
      } else {
        getActivitiesByFacility(facilityId).then((fresh) => {
          dispatch(setActivities(fresh));
        });
      }
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="w-7 h-7">
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            className="gap-1.5 bg-[#15689E] hover:bg-[#15689E]/90 text-white"
          >
            <Plus className="w-4 h-4" />
            Log Activity
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Activity" : "Log Activity"}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} action={formAction} className="space-y-4 mt-2">
          {/* Type + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="type" className="text-xs">
                Type <span className="text-red-400">*</span>
              </Label>
              <Select name="type" defaultValue={activity?.type ?? "call"}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-sm">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="activity_date" className="text-xs">
                Date <span className="text-red-400">*</span>
              </Label>
              <input
                id="activity_date"
                name="activity_date"
                type="date"
                required
                defaultValue={activity?.activity_date ?? today}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-1.5">
            <Label htmlFor="contact_id" className="text-xs">
              Contact <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Select
              name="contact_id"
              defaultValue={activity?.contact_id ?? "none"}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="No contact linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="text-sm text-slate-400">
                  No contact linked
                </SelectItem>
                {contacts
                  .filter((c) => !!c.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-sm">
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outcome */}
          <div className="space-y-1.5">
            <Label htmlFor="outcome" className="text-xs">
              Outcome <span className="text-red-400">*</span>
            </Label>
            <Select name="outcome" defaultValue={activity?.outcome ?? "neutral"}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
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
              defaultValue={activity?.notes ?? ""}
              placeholder="What happened during this activity..."
              className="text-sm resize-none h-24"
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
              className="w-full sm:w-auto"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="w-full sm:w-auto bg-[#15689E] hover:bg-[#15689E]/90 text-white gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isEdit ? "Save changes" : "Log activity"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
