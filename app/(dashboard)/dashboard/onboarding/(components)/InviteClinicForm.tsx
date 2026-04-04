"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Send, Info, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateInviteToken } from "@/app/(dashboard)/dashboard/onboarding/(services)/actions";
import type { IInviteTokenFormState } from "@/utils/interfaces/invite-tokens";
import type { RepWithFacility } from "../(services)/actions";

const EXPIRY_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

interface InviteClinicFormProps {
  isAdmin?: boolean;
  repsWithFacilities?: RepWithFacility[];
}

export function InviteClinicForm({ isAdmin = false, repsWithFacilities = [] }: InviteClinicFormProps) {
  const [state, formAction, isPending] = useActionState<
    IInviteTokenFormState | null,
    FormData
  >(generateInviteToken, null);

  const [selectedFacilityId, setSelectedFacilityId] = useState<string>(
    repsWithFacilities[0]?.facilityId ?? ""
  );
  const [sentEmail, setSentEmail] = useState<string | null>(null);

  const hasNoReps = isAdmin && repsWithFacilities.length === 0;

  useEffect(() => {
    if (!state) return;
    if (state.success && state.invitedEmail) {
      setSentEmail(state.invitedEmail);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  function resetForm() {
    setSentEmail(null);
  }

  if (sentEmail) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-100 text-green-700 text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" />
          Invite sent to <span className="font-medium">{sentEmail}</span>
        </div>
        <button
          onClick={resetForm}
          className="text-sm text-[#64748B] underline underline-offset-2 hover:text-[#0F172A] transition-colors"
        >
          Send another invite
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin: no reps warning */}
      {hasNoReps && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            No reps have set up their office yet. Ask reps to complete their
            profile setup first.
          </p>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        {/* Admin: hidden facility_id input */}
        {isAdmin && (
          <input type="hidden" name="facility_id" value={selectedFacilityId} />
        )}

        {/* Admin: Assign to Rep dropdown */}
        {isAdmin && !hasNoReps && (
          <div className="space-y-1.5">
            <Label className="text-xs">
              Assign to Rep <span className="text-red-400">*</span>
            </Label>
            <Select
              value={selectedFacilityId}
              onValueChange={setSelectedFacilityId}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select a sales rep..." />
              </SelectTrigger>
              <SelectContent>
                {repsWithFacilities.map((rep) => (
                  <SelectItem key={rep.facilityId} value={rep.facilityId} className="text-sm">
                    {rep.name} — {rep.facilityName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Role — always Clinical Provider for admin and rep invites */}
        <input type="hidden" name="role_type" value="clinical_provider" />
        <div className="space-y-1.5">
          <Label className="text-xs text-[#64748B]">Inviting as</Label>
          <p className="text-sm h-9 flex items-center px-3 rounded-md bg-[#F8FAFC] border border-[#E2E8F0] text-[#0F172A] font-medium">
            Clinical Provider
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="clinic_invite_email" className="text-xs">
            Email <span className="text-red-400">*</span>
          </Label>
          <Input
            id="clinic_invite_email"
            type="email"
            name="email"
            placeholder="doctor@clinic.com"
            required
            className="h-9 text-sm"
          />
          {state?.fieldErrors?.email && (
            <p className="text-xs text-red-500">{state.fieldErrors.email}</p>
          )}
        </div>

        {/* Expiry */}
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

        {state?.error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          size="sm"
          disabled={isPending || hasNoReps || (isAdmin && !selectedFacilityId)}
          className="w-full h-9 bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Send invite
        </Button>
      </form>
    </div>
  );
}
