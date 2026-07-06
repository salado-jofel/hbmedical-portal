"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Send, Loader2 } from "lucide-react";
import { PageHeader } from "@/app/(components)/PageHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { UploadIvrsModal } from "./UploadIvrsModal";
import { IvrsList } from "./IvrsList";
import { sendIvrsForApproval, getStandaloneIvrs } from "../(services)/actions";
import { setIvrs } from "../(redux)/ivrs-slice";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";
import toast from "react-hot-toast";

interface IvrsPageShellProps {
  facilities: Array<{ id: string; name: string }>;
  approvers: IExternalApprover[];
}

/**
 * Client-side shell for the IVRs page. Owns the Upload IVRs modal state
 * and passes the shared facilities/approvers dropdown data down to both
 * the upload modal and the detail modal (via IvrsList).
 */
export function IvrsPageShell({ facilities, approvers }: IvrsPageShellProps) {
  const dispatch = useAppDispatch();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sendPending, startSendTransition] = useTransition();
  const ivrs = useAppSelector((s) => s.ivrs.items);
  const draftIds = useMemo(
    () => ivrs.filter((i) => i.status === "draft").map((i) => i.id),
    [ivrs],
  );

  function handleSendAll() {
    if (draftIds.length === 0) return;
    if (
      !window.confirm(
        `Send ${draftIds.length} draft IVR${draftIds.length !== 1 ? "s" : ""} to their assigned approver${draftIds.length !== 1 ? "s" : ""}? Each approver receives one summary email listing all IVRs assigned to them.`,
      )
    ) {
      return;
    }
    startSendTransition(async () => {
      const res = await sendIvrsForApproval(draftIds);
      if (!res.success) {
        toast.error(res.error ?? "Failed to send.");
        return;
      }
      toast.success(`Sent ${res.sent ?? draftIds.length} IVR${(res.sent ?? draftIds.length) !== 1 ? "s" : ""} for approval.`);
      // Refresh the list so the newly-sent rows update their status.
      const fresh = await getStandaloneIvrs();
      dispatch(setIvrs(fresh));
    });
  }

  return (
    <div className="select-none">
      <PageHeader
        title="IVR Forms"
        subtitle={`${ivrs.length} IVR${ivrs.length !== 1 ? "s" : ""} · ${draftIds.length} draft${draftIds.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            {draftIds.length > 0 && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleSendAll}
                disabled={sendPending}
              >
                {sendPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Drafts ({draftIds.length})
              </Button>
            )}
            <Button
              className="gap-2"
              onClick={() => setUploadOpen(true)}
              disabled={approvers.length === 0 || facilities.length === 0}
              title={
                approvers.length === 0
                  ? "Ask an admin to add an external approver first."
                  : facilities.length === 0
                    ? "You don't have any facilities to upload IVRs for."
                    : undefined
              }
            >
              <Upload className="w-4 h-4" />
              Upload IVRs
            </Button>
          </div>
        }
      />
      <IvrsList facilities={facilities} approvers={approvers} />
      <UploadIvrsModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        facilities={facilities}
        approvers={approvers}
      />
    </div>
  );
}
