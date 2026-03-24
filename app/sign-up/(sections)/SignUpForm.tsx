"use client";

import { useActionState, useState } from "react";
import { signUp } from "../(services)/actions";
import { Stethoscope, BriefcaseMedical } from "lucide-react";
import Link from "next/link";
import { AuthField } from "@/app/(components)/AuthField";
import { RoleButton } from "@/app/(components)/RoleButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import SubmitButton from "@/app/(components)/SubmitButton";
import { HBLogo } from "@/app/(components)/HBLogo";

// --- Phone Input Imports ---
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

type Role = "sales_representative" | "doctor";

const initialState = { error: "" };

const nameFields = [
  { label: "First Name", name: "first_name", placeholder: "John" },
  { label: "Last Name", name: "last_name", placeholder: "Doe" },
];

// Reorganized to match the new Supabase columns
const facilityFields = [
  {
    label: "Facility Name",
    name: "facility_name",
    placeholder: "General Hospital",
    required: true,
  },
  {
    label: "Address Line 1",
    name: "address_line_1",
    placeholder: "123 Medical Way",
    required: true,
  },
  {
    label: "Address Line 2 (Optional)",
    name: "address_line_2",
    placeholder: "Suite 400",
    required: false,
  },
];

const roles: { value: Role; icon: React.ReactNode; label: string }[] = [
  {
    value: "sales_representative",
    icon: <BriefcaseMedical className="w-6 h-6" />,
    label: "Sales Representative",
  },
  {
    value: "doctor",
    icon: <Stethoscope className="w-6 h-6" />,
    label: "Physician",
  },
];

export default function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);
  const [role, setRole] = useState<Role>("sales_representative");
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState("");

  return (
    <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/8 backdrop-blur-2xl border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <div className="relative z-10 mb-8 flex items-center justify-center py-6">
        <HBLogo variant="dark" size="lg" />
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="phone" value={phone} />

        {/* ── Role selector ── */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-white/70">I am a</label>
          <div className="grid grid-cols-2 gap-3">
            {roles.map((r) => (
              <RoleButton
                key={r.value}
                value={r.value}
                currentRole={role}
                onClick={() => setRole(r.value)}
                icon={r.icon}
                label={r.label}
              />
            ))}
          </div>
        </div>

        {/* ── Name fields ── */}
        <div className="grid grid-cols-2 gap-3">
          {nameFields.map((field) => (
            <AuthField
              key={field.name}
              id={field.name}
              name={field.name}
              label={field.label}
              placeholder={field.placeholder}
              height="h-11"
              required
            />
          ))}
        </div>

        <AuthField
          id="email"
          name="email"
          label="Email"
          type="email"
          placeholder="john@example.com"
          height="h-11"
          required
        />

        {/* ── International Phone Field ── */}
        <div className="space-y-1.5 phone-input-container">
          <label className="text-sm font-medium text-white/70">
            Phone Number
          </label>
          <PhoneInput
            defaultCountry="us"
            value={phone}
            onChange={(p) => setPhone(p)}
            inputClassName="!w-full !h-11 !bg-white/5 !border-white/10 !text-white !rounded-r-lg focus:!border-[#e8821a] !transition-all"
            countrySelectorStyleProps={{
              buttonClassName:
                "!h-11 !bg-transparent !border-white/10 !rounded-l-lg hover:!bg-white/10 !transition-all",
            }}
          />
        </div>

        {/* ── Facility Section ── */}
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-xs font-medium text-white/35">
            Facility & Shipping
          </span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {facilityFields.map((field) => (
          <AuthField
            key={field.name}
            id={field.name}
            name={field.name}
            label={field.label}
            placeholder={field.placeholder}
            height="h-11"
            required={field.required}
          />
        ))}

        {/* City, State, and Zip in a compact grid */}
        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="city"
            name="city"
            label="City"
            placeholder="Miami"
            height="h-11"
            required
          />
          <div className="grid grid-cols-2 gap-2">
            <AuthField
              id="state"
              name="state"
              label="State"
              placeholder="FL"
              height="h-11"
              required
            />
            <AuthField
              id="postal_code"
              name="postal_code"
              label="Zip"
              placeholder="33101"
              height="h-11"
              required
            />
          </div>
        </div>

        <AuthField
          id="password"
          name="password"
          label="Password"
          type="password"
          placeholder="••••••••"
          height="h-11"
          required
        />

        {state?.error && <ErrorAlert errorMessage={state.error} />}

        {/* ── Terms & Submit ── */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="peer sr-only"
              required
            />
            <div
              className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${hasAgreed ? "border-[#e8821a] bg-[#e8821a]" : "border-white/20 bg-white/5 group-hover:border-[#e8821a]/50"}`}
            >
              {hasAgreed && (
                <svg
                  className="w-2.5 h-2.5 text-white"
                  viewBox="0 0 10 8"
                  fill="none"
                >
                  <path
                    d="M1 4l3 3 5-6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </div>
          </div>
          <span className="text-xs leading-relaxed text-white/45">
            I agree to the{" "}
            <Link href="/eula" className="text-[#f5a255] underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="text-[#f5a255] underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <SubmitButton
          classname="w-full h-12 font-bold text-white transition-all active:scale-95 mt-2"
          style={{
            background: "linear-gradient(135deg, #e8821a, #d4741a)",
            boxShadow: "0 4px 15px rgba(232,130,26,0.35)",
            ...(!hasAgreed && { opacity: 0.5, cursor: "not-allowed" }),
          }}
          isPending={isPending}
          disabled={!hasAgreed}
          type="submit"
          cta="Create Account"
          isPendingMesssage="Creating account..."
          variant={undefined}
          size={undefined}
        />
      </form>
    </div>
  );
}
