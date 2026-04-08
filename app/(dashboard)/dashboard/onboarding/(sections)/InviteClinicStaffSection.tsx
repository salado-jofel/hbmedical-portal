"use client";

import { useState, useActionState, useEffect } from "react";
import { UserPlus, Loader2, CheckCircle, Send } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { generateClinicMemberInvite } from "../(services)/invite-actions";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";

interface InviteClinicStaffSectionProps {
  showSection: boolean;
}

export function InviteClinicStaffSection({
  showSection,
}: InviteClinicStaffSectionProps) {
  const [clinicInviteState, clinicInviteAction, isClinicInvitePending] =
    useActionState<IInviteTokenFormState | null, FormData>(
      generateClinicMemberInvite,
      null,
    );

  const [sentStaffEmail, setSentStaffEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicInviteState) return;
    if (clinicInviteState.success && clinicInviteState.invitedEmail) {
      setSentStaffEmail(clinicInviteState.invitedEmail);
    } else if (clinicInviteState.error) {
      toast.error(clinicInviteState.error);
    }
  }, [clinicInviteState]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!showSection) return null;

  return (
    <section className="bg-white rounded-xl border border-[#E2E8F0] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-[#15689E]" />
        <h2 className="text-base font-semibold text-[#0F172A]">
          Invite Clinic Staff
        </h2>
      </div>
      <p className="text-sm text-[#64748B]">
        Send an invite email to a Clinical Staff member to join your facility.
      </p>
      {sentStaffEmail ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm">
            <CheckCircle className="w-4 h-4 shrink-0" />
            Invite sent to <span className="font-medium">{sentStaffEmail}</span>
          </div>
          <button
            onClick={() => setSentStaffEmail(null)}
            className="text-sm text-[#64748B] underline underline-offset-2 hover:text-[#0F172A] transition-colors"
          >
            Send another invite
          </button>
        </div>
      ) : (
        <form action={clinicInviteAction} className="space-y-4">
          <input type="hidden" name="expires_in_days" value="30" />
          <div className="space-y-1.5">
            <label htmlFor="staff_invite_email" className="text-xs font-medium text-[#0F172A]">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="staff_invite_email"
              type="email"
              name="email"
              placeholder="staff@clinic.com"
              required
              className="w-full h-9 rounded-md border border-[#E2E8F0] bg-white px-3 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#15689E]/30 focus:border-[#15689E]"
            />
            {clinicInviteState?.fieldErrors?.email && (
              <p className="text-xs text-red-500">{clinicInviteState.fieldErrors.email}</p>
            )}
          </div>
          {clinicInviteState?.error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {clinicInviteState.error}
            </p>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isClinicInvitePending}
            className="h-9 bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
          >
            {isClinicInvitePending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Send invite
          </Button>
        </form>
      )}
    </section>
  );
}
