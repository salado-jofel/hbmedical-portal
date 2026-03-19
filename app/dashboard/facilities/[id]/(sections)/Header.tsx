"use client";

import { useState } from "react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Building2 } from "lucide-react";
import SubmitButton from "@/app/(components)/SubmitButton";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { deleteFacility } from "../(services)/actions";
import { clearFacility } from "../(redux)/facility-slice";
import { StatusBadge } from "../../../../(components)/StatusBadge";

export default function Header() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const item = useAppSelector((state) => state.facility.item);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!item?.id) return;
    setIsDeleting(true);
    try {
      await deleteFacility(item.id);
      dispatch(clearFacility());
      router.push("/dashboard/facilities");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Facility?"
        description={`"${item?.name}" and all its products will be permanently removed. This action cannot be undone.`}
        confirmLabel="Delete"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
      />

      <div className="space-y-6">
        <button
          type="button"
          onClick={() => router.push("/dashboard/facilities")}
          className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#2db0b0] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Facilities
        </button>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-[#2db0b0]/10 flex items-center justify-center shrink-0">
                <Building2 className="w-7 h-7 text-[#2db0b0]" />
              </div>
              <div className="space-y-1">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-800">
                  {item?.name ?? "—"}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {item?.type ?? "—"}
                  </span>
                  {item?.status && <StatusBadge status={item.status} />}
                </div>
              </div>
            </div>

            <SubmitButton
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              isPending={isDeleting}
              isPendingMesssage="Deleting..."
              classname="self-start sm:self-auto text-red-400 border-red-200 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all"
              cta={
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Facility
                </>
              }
              size="default"
            />
          </div>
        </div>
      </div>
    </>
  );
}
