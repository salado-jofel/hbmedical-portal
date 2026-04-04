"use client";

import { useActionState, useEffect, useState } from "react";
import { Building2, MapPin, User } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import { HBLogo } from "@/app/(components)/HBLogo";
import { AuthField } from "@/app/(components)/AuthField";
import SubmitButton from "@/app/(components)/SubmitButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import { AuthCard } from "@/app/(components)/AuthCard";
import { completeRepSetup, type RepSetupState } from "../(services)/actions";

export default function RepSetupForm() {
  const [state, formAction, isPending] = useActionState<RepSetupState, FormData>(
    completeRepSetup,
    { error: null, success: false },
  );

  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (state.success) {
      window.location.href = "/dashboard";
    }
  }, [state.success]);

  return (
    <AuthCard>
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center">
        <HBLogo variant="light" size="lg" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] text-center">Set Up Your Practice</h2>
      <p className="text-sm text-[#64748B] text-center mt-1.5 mb-8">
        Tell us about your practice so you can start inviting your team.
      </p>

      <form action={formAction} className="space-y-4">
        {/* Name fields — sub-rep enters their real name here */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="setup_first_name" className="text-xs font-medium text-[#0F172A]">
              First Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="setup_first_name"
              name="first_name"
              placeholder="John"
              required
              className="h-9 text-sm"
            />
            {state.fieldErrors?.first_name && (
              <p className="text-xs text-red-500">{state.fieldErrors.first_name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="setup_last_name" className="text-xs font-medium text-[#0F172A]">
              Last Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="setup_last_name"
              name="last_name"
              placeholder="Doe"
              required
              className="h-9 text-sm"
            />
            {state.fieldErrors?.last_name && (
              <p className="text-xs text-red-500">{state.fieldErrors.last_name}</p>
            )}
          </div>
        </div>

        <AuthField
          id="practice_name"
          name="practice_name"
          label="Practice Name"
          icon={<Building2 className="w-4 h-4" />}
          type="text"
          placeholder="e.g. Sunrise Medical Group"
        />

        <PhoneInputField
          value={phone}
          onChange={(val) => setPhone(val)}
          label="Practice Phone"
          required
          theme="light"
        />
        <input type="hidden" name="phone" value={phone} />

        <AuthField
          id="address_line_1"
          name="address_line_1"
          label="Street Address"
          icon={<MapPin className="w-4 h-4" />}
          type="text"
          placeholder="123 Main St"
        />

        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="city"
            name="city"
            label="City"
            icon={<MapPin className="w-4 h-4" />}
            type="text"
            placeholder="Nashville"
          />
          <AuthField
            id="state"
            name="state"
            label="State"
            icon={<MapPin className="w-4 h-4" />}
            type="text"
            placeholder="TN"
          />
        </div>

        <AuthField
          id="postal_code"
          name="postal_code"
          label="ZIP Code"
          icon={<MapPin className="w-4 h-4" />}
          type="text"
          placeholder="37201"
        />

        {state.error && <ErrorAlert errorMessage={state.error} />}

        <div className="pt-2">
          <SubmitButton
            classname="h-9 w-full font-medium bg-[#15689E] hover:bg-[#125d8e] text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
            isPending={isPending}
            type="submit"
            cta="Save & Continue"
            variant="default"
            size="default"
            isPendingMesssage="Saving..."
          />
        </div>
      </form>
    </AuthCard>
  );
}
