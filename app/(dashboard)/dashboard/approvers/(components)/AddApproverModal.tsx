"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2 } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { addApproverToStore } from "../(redux)/approvers-slice";
import { createApprover } from "../(services)/actions";
import toast from "react-hot-toast";

export function AddApproverModal() {
  const dispatch = useAppDispatch();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setName("");
    setEmail("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createApprover({ name, email });
      if (!res.success) {
        toast.error(res.error);
        return;
      }
      dispatch(addApproverToStore(res.approver));
      toast.success("Approver added.");
      setOpen(false);
      reset();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) {
          setOpen(next);
          if (!next) reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Add Approver
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#eee]">
          <DialogTitle className="text-[15px] font-semibold">
            Add External Approver
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <p className="text-[12px] text-[var(--text3)] leading-snug">
            External approvers receive IVRs by email and click Approve or Deny
            in one-time links. They do not need portal accounts.
          </p>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-[#374151]">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Smith (Fortify)"
              disabled={pending}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-[#374151]">
              Email
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="approver@example.com"
              disabled={pending}
              required
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#eee]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {pending && <Loader2 className="w-4 h-4 animate-spin" />}
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
