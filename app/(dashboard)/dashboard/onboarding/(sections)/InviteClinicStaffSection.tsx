"use client";

import { useState, useActionState, useEffect } from "react";
import { UserPlus, Loader2, CheckCircle, Send } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateClinicMemberInvite } from "../(services)/invite-actions";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";
import { EXPIRY_OPTIONS } from "@/utils/constants/onboarding";

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
    <section className="bg-white rounded-xl border border-[var(--border)] p-5 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-[var(--navy)]" />
        <h2 className="text-base font-semibold text-[var(--navy)]">
          Invite Clinic Staff
        </h2>
      </div>
      <p className="text-sm text-[var(--text2)]">
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
            className="text-sm text-[var(--text2)] underline underline-offset-2 hover:text-[var(--navy)] transition-colors"
          >
            Send another invite
          </button>
        </div>
      ) : (
        <form action={clinicInviteAction} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="staff_invite_email" className="text-xs font-medium text-[var(--navy)]">
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="staff_invite_email"
              type="email"
              name="email"
              placeholder="staff@clinic.com"
              required
              className="w-full h-9 rounded-md border border-[var(--border)] bg-white px-3 text-sm text-[var(--navy)] placeholder:text-[var(--text3)] focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/30 focus:border-[var(--navy)]"
            />
            {clinicInviteState?.fieldErrors?.email && (
              <p className="text-xs text-red-500">{clinicInviteState.fieldErrors.email}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Link expires in</Label>
            <Select name="expires_in_days" defaultValue="30">
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-sm">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            className="w-full h-9 bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
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
