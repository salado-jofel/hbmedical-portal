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
    <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
      {/* Logo */}
      <div className="relative z-10 mb-6 flex items-center justify-center py-6">
        <HBLogo variant="dark" size="lg" />
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-bold text-white mb-2">Set Up Your Practice</h2>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Tell us about your practice so you can start inviting your team.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <AuthField
          id="practice_name"
          name="practice_name"
          label="Practice Name"
          icon={<Building2 className="w-4 h-4" style={{ color: "#f5a255" }} />}
          type="text"
          placeholder="e.g. Sunrise Medical Group"
        />

        {/* Phone */}
        <div className="space-y-1.5">
          <label
            htmlFor="phone-display"
            className="block text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.8)" }}
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
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "0.5rem",
              color: "white",
              fontSize: "0.875rem",
              padding: "0.625rem 0.75rem",
            }}
            countrySelectorStyleProps={{
              buttonStyle: {
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: "0.5rem 0 0 0.5rem",
                padding: "0 0.5rem",
              },
            }}
          />
          <input type="hidden" name="phone" value={phone} />
        </div>

        <AuthField
          id="address_line_1"
          name="address_line_1"
          label="Street Address"
          icon={<MapPin className="w-4 h-4" style={{ color: "#f5a255" }} />}
          type="text"
          placeholder="123 Main St"
        />

        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="city"
            name="city"
            label="City"
            icon={<MapPin className="w-4 h-4" style={{ color: "#f5a255" }} />}
            type="text"
            placeholder="Nashville"
          />
          <AuthField
            id="state"
            name="state"
            label="State"
            icon={<MapPin className="w-4 h-4" style={{ color: "#f5a255" }} />}
            type="text"
            placeholder="TN"
          />
        </div>

        <AuthField
          id="postal_code"
          name="postal_code"
          label="ZIP Code"
          icon={<MapPin className="w-4 h-4" style={{ color: "#f5a255" }} />}
          type="text"
          placeholder="37201"
        />

        {state.error && <ErrorAlert errorMessage={state.error} />}

        <div className="pt-2">
          <SubmitButton
            classname="h-12 w-full font-bold transition-all active:scale-95 text-white"
            style={{
              background: "linear-gradient(135deg, #e8821a, #d4741a)",
              boxShadow: "0 4px 15px rgba(232,130,26,0.35)",
            }}
            isPending={isPending}
            type="submit"
            cta="Save & Continue"
            variant="default"
            size="lg"
            isPendingMesssage="Saving..."
          />
        </div>
      </form>
    </div>
  );
}
