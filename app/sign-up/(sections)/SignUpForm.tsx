"use client";

import { useActionState, useState } from "react";
import { signUp } from "../(services)/actions";
import { Stethoscope, BriefcaseMedical, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { AuthField } from "@/app/(components)/AuthField";
import { RoleButton } from "@/app/(components)/RoleButton";
import ErrorAlert from "@/app/(components)/ErrorAlert";
import SubmitButton from "@/app/(components)/SubmitButton";
import { HBLogo } from "@/app/(components)/HBLogo";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

type Role = "sales_representative" | "doctor";

const initialState = { error: "" };

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
  const [clientError, setClientError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("us");

  const [facilityName, setFacilityName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [regionState, setRegionState] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsDoNotMatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (password !== confirmPassword) {
      event.preventDefault();
      setClientError("Passwords do not match.");
      return;
    }

    setClientError("");
  };

  const showError = clientError || state?.error;
  const isSubmitDisabled = !hasAgreed || passwordsDoNotMatch || isPending;

  return (
    <div className="w-full max-w-md select-none rounded-2xl border border-white/15 bg-white/8 p-8 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)] md:p-10">
      <div className="relative z-10 mb-8 flex items-center justify-center py-6">
        <HBLogo variant="dark" size="lg" />
      </div>

      <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="role" value={role} />
        <input type="hidden" name="phone" value={phone} />
        <input
          type="hidden"
          name="facility_country"
          value={country.toUpperCase()}
        />

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

        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="first_name"
            name="first_name"
            label="First Name"
            placeholder="John"
            height="h-11"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />

          <AuthField
            id="last_name"
            name="last_name"
            label="Last Name"
            placeholder="Doe"
            height="h-11"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <AuthField
          id="email"
          name="email"
          label="Email"
          type="email"
          placeholder="john@example.com"
          height="h-11"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="space-y-1.5 phone-input-container">
          <label className="text-sm font-medium text-white/70">
            Phone Number
          </label>

          <PhoneInput
            defaultCountry="us"
            value={phone}
            onChange={(value, meta) => {
              setPhone(value);
              setCountry(meta.country.iso2);
            }}
            inputClassName="!w-full !h-11 !bg-white/5 !border-white/10 !text-white !rounded-r-lg focus:!border-[#e8821a] !transition-all"
            countrySelectorStyleProps={{
              buttonClassName:
                "!h-11 !w-[52px] !min-w-[52px] !justify-center !px-0 !bg-transparent !border-white/10 !rounded-l-lg hover:!bg-white/10 !transition-all",
              buttonContentWrapperClassName:
                "!w-full !justify-center !items-center !gap-0",
              flagClassName: "!m-0",
              dropdownArrowClassName: "!hidden",
            }}
          />
        </div>

        <div className="flex items-center gap-3 py-1">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-medium text-white/35">Facility</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <AuthField
          id="facility_name"
          name="facility_name"
          label="Facility Name"
          placeholder="General Hospital"
          height="h-11"
          required
          value={facilityName}
          onChange={(e) => setFacilityName(e.target.value)}
        />

        <AuthField
          id="address_line_1"
          name="address_line_1"
          label="Address Line 1"
          placeholder="123 Medical Way"
          height="h-11"
          required
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
        />

        <AuthField
          id="address_line_2"
          name="address_line_2"
          label="Address Line 2 (Optional)"
          placeholder="Suite 400"
          height="h-11"
          required={false}
          value={addressLine2}
          onChange={(e) => setAddressLine2(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="city"
            name="city"
            label="City"
            placeholder="Miami"
            height="h-11"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-2">
            <AuthField
              id="state"
              name="state"
              label="State"
              placeholder="FL"
              height="h-11"
              required
              value={regionState}
              onChange={(e) => setRegionState(e.target.value)}
            />

            <AuthField
              id="postal_code"
              name="postal_code"
              label="Zip"
              placeholder="33101"
              height="h-11"
              required
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="text-sm font-medium text-white/70"
          >
            Password
          </label>

          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (clientError) setClientError("");
              }}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 pr-11 text-sm text-white placeholder:text-white/35 outline-none transition-all focus:border-[#e8821a]"
            />

            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/55 transition hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm_password"
            className="text-sm font-medium text-white/70"
          >
            Confirm Password
          </label>

          <div className="relative">
            <input
              id="confirm_password"
              name="confirm_password"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (clientError) setClientError("");
              }}
              className={`h-11 w-full rounded-xl border bg-white/5 px-3 pr-11 text-sm text-white placeholder:text-white/35 outline-none transition-all ${
                passwordsDoNotMatch
                  ? "border-red-400/60 focus:border-red-400"
                  : "border-white/10 focus:border-[#e8821a]"
              }`}
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/55 transition hover:text-white"
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {passwordsDoNotMatch && (
            <p className="text-xs text-red-300">Passwords do not match.</p>
          )}
        </div>

        {showError && <ErrorAlert errorMessage={showError} />}

        <label className="group flex cursor-pointer items-start gap-3">
          <div className="relative mt-0.5 shrink-0">
            <input
              type="checkbox"
              checked={hasAgreed}
              onChange={(e) => setHasAgreed(e.target.checked)}
              className="peer sr-only"
              required
            />
            <div
              className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                hasAgreed
                  ? "border-[#e8821a] bg-[#e8821a]"
                  : "border-white/20 bg-white/5 group-hover:border-[#e8821a]/50"
              }`}
            >
              {hasAgreed && (
                <svg
                  className="h-2.5 w-2.5 text-white"
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
          classname="mt-2 h-12 w-full font-bold text-white transition-all active:scale-95"
          style={{
            background: "linear-gradient(135deg, #e8821a, #d4741a)",
            boxShadow: "0 4px 15px rgba(232,130,26,0.35)",
            ...(isSubmitDisabled && { opacity: 0.5, cursor: "not-allowed" }),
          }}
          isPending={isPending}
          disabled={isSubmitDisabled}
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
