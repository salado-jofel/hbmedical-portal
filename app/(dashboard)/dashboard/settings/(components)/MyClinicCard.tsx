"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import {
  updateMyClinic,
  type IMyClinic,
  type IMyClinicFormState,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";

interface MyClinicCardProps {
  clinic: IMyClinic | null;
}

export function MyClinicCard({ clinic }: MyClinicCardProps) {
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(clinic?.phone ?? "");

  const [state, formAction, isPending] = useActionState<IMyClinicFormState | null, FormData>(
    updateMyClinic,
    null,
  );

  useEffect(() => {
    if (!state) return;
    if (state.success) {
      toast.success("Clinic updated.");
      setEditing(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  // Non-providers or providers without a facility row: render nothing.
  if (!clinic) return null;

  const addressLine = [clinic.address_line_1, clinic.address_line_2]
    .filter(Boolean)
    .join(", ");
  const cityStateZip = `${clinic.city}, ${clinic.state} ${clinic.postal_code}`;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-[var(--navy)]">My Clinic</h3>
          <p className="text-xs text-[var(--text3)] mt-0.5">
            Keep your clinic contact info up to date.
          </p>
        </div>
        {!editing && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5 text-[12px]"
            onClick={() => {
              setPhone(clinic.phone);
              setEditing(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      {!editing ? (
        <div className="rounded-[var(--r)] border border-[var(--border)] bg-[var(--bg)] p-4 space-y-3">
          <ReadOnlyRow label="Clinic name" value={clinic.name} />
          <ReadOnlyRow label="Phone" value={clinic.phone} />
          <ReadOnlyRow label="Address" value={addressLine} />
          <ReadOnlyRow label="" value={cityStateZip} />
          <ReadOnlyRow label="Country" value={clinic.country} />
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          {/* Clinic name */}
          <div className="space-y-1.5">
            <Label htmlFor="clinic_name" className="text-xs">
              Clinic name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="clinic_name"
              name="name"
              defaultValue={clinic.name}
              required
              className="h-9 text-sm"
            />
            {state?.fieldErrors?.name && (
              <p className="text-xs text-red-500">{state.fieldErrors.name}</p>
            )}
          </div>

          {/* Phone */}
          <PhoneInputField
            value={phone}
            onChange={(val) => setPhone(val)}
            label="Clinic phone"
            theme="light"
            required
            error={state?.fieldErrors?.phone}
          />
          <input type="hidden" name="phone" value={phone} />

          {/* Address lines */}
          <div className="space-y-1.5">
            <Label htmlFor="address_line_1" className="text-xs">
              Street address <span className="text-red-400">*</span>
            </Label>
            <Input
              id="address_line_1"
              name="address_line_1"
              defaultValue={clinic.address_line_1}
              required
              className="h-9 text-sm"
            />
            {state?.fieldErrors?.address_line_1 && (
              <p className="text-xs text-red-500">{state.fieldErrors.address_line_1}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address_line_2" className="text-xs">
              Suite / unit (optional)
            </Label>
            <Input
              id="address_line_2"
              name="address_line_2"
              defaultValue={clinic.address_line_2 ?? ""}
              className="h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="city" className="text-xs">
                City <span className="text-red-400">*</span>
              </Label>
              <Input
                id="city"
                name="city"
                defaultValue={clinic.city}
                required
                className="h-9 text-sm"
              />
              {state?.fieldErrors?.city && (
                <p className="text-xs text-red-500">{state.fieldErrors.city}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="state" className="text-xs">
                State <span className="text-red-400">*</span>
              </Label>
              <Input
                id="state"
                name="state"
                defaultValue={clinic.state}
                required
                maxLength={2}
                className="h-9 text-sm uppercase"
              />
              {state?.fieldErrors?.state && (
                <p className="text-xs text-red-500">{state.fieldErrors.state}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="postal_code" className="text-xs">
                ZIP <span className="text-red-400">*</span>
              </Label>
              <Input
                id="postal_code"
                name="postal_code"
                defaultValue={clinic.postal_code}
                required
                className="h-9 text-sm"
              />
              {state?.fieldErrors?.postal_code && (
                <p className="text-xs text-red-500">{state.fieldErrors.postal_code}</p>
              )}
            </div>
          </div>

          {state?.error && (
            <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {state.error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white gap-1.5"
            >
              {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save clinic
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      {label && (
        <p className="text-xs text-[var(--text3)] w-28 shrink-0 pt-0.5">{label}</p>
      )}
      <p className="text-sm text-[var(--navy)] flex-1">{value || "—"}</p>
    </div>
  );
}
