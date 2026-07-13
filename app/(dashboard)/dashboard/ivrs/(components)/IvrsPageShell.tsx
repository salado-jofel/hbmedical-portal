"use client";

import { useState, useTransition, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Upload, Send, Loader2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/app/(components)/PageHeader";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { UploadIvrsModal } from "./UploadIvrsModal";
import { IvrsList } from "./IvrsList";
import { sendIvrsForApproval, getStandaloneIvrs } from "../(services)/actions";
import { setIvrs } from "../(redux)/ivrs-slice";
import type { IExternalApprover } from "@/utils/interfaces/standalone-ivrs";
import { ConfirmModal } from "@/app/(dashboard)/(components)/ConfirmModal";
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

  // Surface WHY the upload button is disabled so users don't have to
  // hover to figure it out. Two disable reasons — no approvers in the
  // directory (admin needs to add some) or the caller has no facility
  // to attach IVRs to.
  const noApprovers = approvers.length === 0;
  const noFacilities = facilities.length === 0;
  const uploadDisabled = noApprovers || noFacilities;
  const [confirmSendAll, setConfirmSendAll] = useState(false);

  function doSendAll() {
    if (draftIds.length === 0) return;
    setConfirmSendAll(false);
    startSendTransition(async () => {
      const res = await sendIvrsForApproval(draftIds);
      if (!res.success) {
        toast.error(res.error ?? "Failed to send.");
        return;
      }
      toast.success(`Sent ${res.sent ?? draftIds.length} IVR${(res.sent ?? draftIds.length) !== 1 ? "s" : ""} for approval.`);
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
                onClick={() => setConfirmSendAll(true)}
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
              disabled={uploadDisabled}
              title={
                noApprovers
                  ? "Ask an admin to add an external approver first."
                  : noFacilities
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

      {/* Inline callout explaining why Upload IVRs is disabled — otherwise
          the greyed button reads as a bug. Shown once, above the list. */}
      {uploadDisabled && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-2 text-[12.5px] text-amber-900">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              {noApprovers
                ? "No external approvers set up yet"
                : "No facilities available for you"}
            </p>
            <p className="text-[12px] mt-0.5 leading-snug">
              {noApprovers ? (
                <>
                  Uploading IVRs requires at least one external approver in
                  the directory. Ask an admin to add one at{" "}
                  <a
                    href="/dashboard/approvers"
                    className="underline font-medium hover:text-amber-800"
                  >
                    External Approvers
                  </a>
                  , then this page will unlock.
                </>
              ) : (
                <>
                  You need to be a member of at least one facility to upload
                  IVRs. Ask an admin to add you to a clinic on their side.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <IvrsList facilities={facilities} approvers={approvers} />
      <UploadIvrsModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        facilities={facilities}
        approvers={approvers}
      />
      <ConfirmModal
        open={confirmSendAll}
        onOpenChange={setConfirmSendAll}
        title={`Send ${draftIds.length} draft IVR${draftIds.length !== 1 ? "s" : ""} for approval?`}
        body={
          <>
            Each assigned approver will receive <span className="font-semibold">one summary email</span> listing every IVR assigned to
            them. Once sent, IVRs can't be edited until the approver responds.
          </>
        }
        confirmLabel={`Send ${draftIds.length}`}
        pending={sendPending}
        onConfirm={doSendAll}
      />
    </div>
  );
}
