"use client";

import { useActionState, useEffect, useState } from "react";
import { Building2, MapPin, Phone } from "lucide-react";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { HBLogo } from "@/app/(components)/HBLogo";
import { AuthField } from "@/app/(components)/AuthField";
import SubmitButton from "@/app/(components)/SubmitButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import { completeRepSetup, type RepSetupState } from "../(services)/actions";

export default function RepSetupForm() {
  const [state, formAction, isPending] = useActionState<RepSetupState, FormData>(
    completeRepSetup,
    { error: null, success: false },
  );

  const [phone, setPhone] = useState("");
  const [rawPhone, setRawPhone] = useState("");

  useEffect(() => {
    if (state.success) {
      window.location.href = "/dashboard";
    }
  }, [state.success]);

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.1)] border border-[#E2E8F0] p-8 w-full max-w-md select-none">
      {/* Logo */}
      <div className="mb-6 flex items-center justify-center">
        <HBLogo variant="light" size="lg" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] text-center">Set Up Your Practice</h2>
      <p className="text-sm text-[#64748B] text-center mt-1.5 mb-8">
        Tell us about your practice so you can start inviting your team.
      </p>

      <form action={formAction} className="space-y-4">
        <AuthField
          id="practice_name"
          name="practice_name"
          label="Practice Name"
          icon={<Building2 className="w-4 h-4" />}
          type="text"
          placeholder="e.g. Sunrise Medical Group"
        />

        {/* Phone */}
        <div className="space-y-1.5">
          <label
            htmlFor="phone-display"
            className="block text-xs font-medium text-[#374151] mb-1.5"
          >
            Practice Phone
          </label>
          <PhoneInput
            defaultCountry="us"
            value={phone}
            onChange={(value, meta) => {
              setPhone(value);
              setRawPhone((meta as any)?.inputValue ?? value);
            }}
            inputProps={{ id: "phone-display", autoComplete: "tel" }}
            style={{ width: "100%" }}
            inputStyle={{
              width: "100%",
              background: "white",
              border: "1px solid #E2E8F0",
              borderRadius: "0 0.5rem 0.5rem 0",
              color: "#0F172A",
              fontSize: "0.875rem",
              height: "2.25rem",
              padding: "0 0.75rem",
            }}
            countrySelectorStyleProps={{
              buttonStyle: {
                background: "white",
                border: "1px solid #E2E8F0",
                borderRadius: "0.5rem 0 0 0.5rem",
                padding: "0 0.5rem",
                height: "2.25rem",
              },
            }}
          />
          <input type="hidden" name="phone" value={phone} />
        </div>

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
    </div>
  );
}
