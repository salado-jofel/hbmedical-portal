"use client";

import { useActionState, useState } from "react";
import { signUp } from "../(services)/actions";
import { Stethoscope, BriefcaseMedical } from "lucide-react";
import Link from "next/link";
import { AuthField } from "@/app/(components)/AuthField";
import { RoleButton } from "@/app/(components)/RoleButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import SubmitButton from "@/app/(components)/SubmitButton";
import { FormHeader } from "@/app/(components)/FormHeader";

type Role = "sales_representative" | "doctor";

const initialState = { error: "" };

const nameFields = [
  { label: "First Name", name: "first_name", placeholder: "John" },
  { label: "Last Name", name: "last_name", placeholder: "Doe" },
];

const facilityFields = [
  {
    label: "Facility Name",
    name: "facility_name",
    placeholder: "General Hospital",
    required: true,
  },
  {
    label: "Facility Location",
    name: "facility_location",
    placeholder: "New York, NY",
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

  return (
    <div className="w-full max-w-md select-none rounded-2xl border p-8 md:p-10 bg-white/5 backdrop-blur-2xl border-[#00d4c8]/15 shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]">
      <FormHeader subtitle="Create your account to get started" />

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="role" value={role} />

        <div className="space-y-2">
          <label
            className="text-sm font-medium"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            I am a
          </label>
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
        <AuthField
          id="phone"
          name="phone"
          label="Phone"
          type="tel"
          placeholder="+1 (555) 000-0000"
          height="h-11"
        />

        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 h-px bg-white/10" />
          <span
            className="text-xs font-medium"
            style={{ color: "rgba(255,255,255,0.35)" }}
          >
            Facility Information
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

        {/* ── Terms & Privacy Agreement ─────────────────────────────────── */}
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
              className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                hasAgreed
                  ? "border-[#00d4c8] bg-[#00d4c8]"
                  : "border-white/20 bg-white/5 group-hover:border-[#00d4c8]/50"
              }`}
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
          <span
            className="text-xs leading-relaxed"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            I have read and agree to the{" "}
            <Link
              href="/eula"
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline underline-offset-2 transition-colors"
              style={{ color: "#00d4c8" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#5ee8e2")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#00d4c8")}
            >
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy-policy"
              target="_blank"
              onClick={(e) => e.stopPropagation()}
              className="font-medium underline underline-offset-2 transition-colors"
              style={{ color: "#00d4c8" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#5ee8e2")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#00d4c8")}
            >
              Privacy Policy
            </Link>
          </span>
        </label>

        <SubmitButton
          classname="w-full h-12 font-bold text-white transition-all active:scale-95 mt-2"
          style={{
            background: "linear-gradient(135deg, #00d4c8, #00a89e)",
            boxShadow: "0 4px 15px rgba(0,212,200,0.3)",
            ...(!hasAgreed && { opacity: 0.5, cursor: "not-allowed" }),
          }}
          isPending={isPending}
          disabled={!hasAgreed}
          type="submit"
          cta="Create Account"
          variant="default"
          size="lg"
          isPendingMesssage="Creating account..."
        />
      </form>

      <p
        className="text-sm text-center mt-6"
        style={{ color: "rgba(255,255,255,0.4)" }}
      >
        Already have an account?{" "}
        <Link
          href="/sign-in"
          className="font-medium transition-colors"
          style={{ color: "#00d4c8" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#5ee8e2")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#00d4c8")}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
