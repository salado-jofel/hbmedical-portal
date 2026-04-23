"use client";

import { useState, useTransition, useEffect } from "react";
import { Building2, MapPin } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import { HBLogo } from "@/app/(components)/HBLogo";
import { AuthField } from "@/app/(components)/AuthField";
import SubmitButton from "@/app/(components)/SubmitButton";
import { AuthCard } from "@/app/(components)/AuthCard";
import { completeRepSetup } from "../(services)/actions";

type FieldKey =
  | "first_name"
  | "last_name"
  | "practice_name"
  | "phone"
  | "address_line_1"
  | "city"
  | "state"
  | "postal_code";

type FieldErrors = Partial<Record<FieldKey, string>>;

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export default function RepSetupForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [stateVal, setStateVal] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (!firstName.trim()) e.first_name = "First name is required.";
    if (!lastName.trim()) e.last_name = "Last name is required.";
    // Company name + Company number are OPTIONAL for sales reps — only
    // validate the phone format if they DID type something.
    if (phone.trim() && !E164_REGEX.test(phone.trim()))
      e.phone = "Enter a valid phone number.";
    if (!addressLine1.trim()) e.address_line_1 = "Street address is required.";
    if (!city.trim()) e.city = "City is required.";
    if (!stateVal.trim() || stateVal.trim().length < 2)
      e.state = "State is required.";
    if (!postalCode.trim()) e.postal_code = "ZIP code is required.";
    return e;
  }

  // Clear the inline error for a field as soon as the user starts typing in it.
  useEffect(() => {
    if (errors.first_name && firstName.trim()) clearField("first_name");
  }, [firstName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errors.last_name && lastName.trim()) clearField("last_name");
  }, [lastName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errors.practice_name && practiceName.trim()) clearField("practice_name");
  }, [practiceName]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errors.phone && phone.trim()) clearField("phone");
  }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errors.address_line_1 && addressLine1.trim()) clearField("address_line_1");
  }, [addressLine1]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errors.city && city.trim()) clearField("city");
  }, [city]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errors.state && stateVal.trim()) clearField("state");
  }, [stateVal]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (errors.postal_code && postalCode.trim()) clearField("postal_code");
  }, [postalCode]); // eslint-disable-line react-hooks/exhaustive-deps

  function clearField(key: FieldKey) {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const fd = new FormData();
    fd.set("first_name", firstName.trim());
    fd.set("last_name", lastName.trim());
    fd.set("practice_name", practiceName.trim());
    fd.set("phone", phone.trim());
    fd.set("address_line_1", addressLine1.trim());
    fd.set("city", city.trim());
    fd.set("state", stateVal.trim());
    fd.set("postal_code", postalCode.trim());

    startTransition(async () => {
      const result = await completeRepSetup(
        { error: null, success: false },
        fd,
      );
      if (result.success) {
        window.location.href = "/dashboard";
        return;
      }
      // Server-side failure (usually a DB / auth issue, not a validation miss
      // since the client already validated). Show at the bottom; keep fields.
      if (result.fieldErrors) {
        setErrors((prev) => ({ ...prev, ...result.fieldErrors }));
      }
      setServerError(result.error ?? null);
    });
  }

  return (
    <AuthCard>
      <div className="mb-6 flex items-center justify-center">
        <HBLogo variant="light" size="lg" />
      </div>

      <h2 className="text-2xl font-bold text-[#0F172A] text-center">Sales Rep Account</h2>
      <p className="text-sm text-[#64748B] text-center mt-1.5 mb-8">
        Tell us about yourself so you can start inviting your team.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label
              htmlFor="setup_first_name"
              className={`text-xs font-medium ${errors.first_name ? "text-[var(--red)]" : "text-[#0F172A]"}`}
            >
              First Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="setup_first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
              aria-invalid={errors.first_name ? true : undefined}
              className={`h-9 text-sm ${errors.first_name ? "border-[var(--red)] focus-visible:ring-[var(--red)]/20 focus-visible:border-[var(--red)]" : ""}`}
            />
            {errors.first_name && (
              <p className="text-xs text-[var(--red)]">{errors.first_name}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label
              htmlFor="setup_last_name"
              className={`text-xs font-medium ${errors.last_name ? "text-[var(--red)]" : "text-[#0F172A]"}`}
            >
              Last Name <span className="text-red-400">*</span>
            </Label>
            <Input
              id="setup_last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
              aria-invalid={errors.last_name ? true : undefined}
              className={`h-9 text-sm ${errors.last_name ? "border-[var(--red)] focus-visible:ring-[var(--red)]/20 focus-visible:border-[var(--red)]" : ""}`}
            />
            {errors.last_name && (
              <p className="text-xs text-[var(--red)]">{errors.last_name}</p>
            )}
          </div>
        </div>

        <AuthField
          id="practice_name"
          name="practice_name"
          label="Company name"
          icon={<Building2 className="w-4 h-4" />}
          type="text"
          placeholder="Your company (leave blank if none)"
          value={practiceName}
          onChange={(e) => setPracticeName(e.target.value)}
          error={errors.practice_name ?? null}
        />

        <div>
          <PhoneInputField
            value={phone}
            onChange={(val) => setPhone(val)}
            label="Company number"
            theme="light"
          />
          {errors.phone && (
            <p className="mt-1 text-xs text-[var(--red)]">{errors.phone}</p>
          )}
        </div>

        <AuthField
          id="address_line_1"
          name="address_line_1"
          label="Street Address"
          icon={<MapPin className="w-4 h-4" />}
          type="text"
          placeholder="123 Main St"
          value={addressLine1}
          onChange={(e) => setAddressLine1(e.target.value)}
          required
          error={errors.address_line_1 ?? null}
        />

        <div className="grid grid-cols-2 gap-3">
          <AuthField
            id="city"
            name="city"
            label="City"
            icon={<MapPin className="w-4 h-4" />}
            type="text"
            placeholder="Nashville"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
            error={errors.city ?? null}
          />
          <AuthField
            id="state"
            name="state"
            label="State"
            icon={<MapPin className="w-4 h-4" />}
            type="text"
            placeholder="TN"
            value={stateVal}
            onChange={(e) => setStateVal(e.target.value)}
            required
            error={errors.state ?? null}
          />
        </div>

        <AuthField
          id="postal_code"
          name="postal_code"
          label="ZIP Code"
          icon={<MapPin className="w-4 h-4" />}
          type="text"
          placeholder="37201"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          required
          error={errors.postal_code ?? null}
        />

        {serverError && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {serverError}
          </p>
        )}

        <div className="pt-2">
          <SubmitButton
            classname="h-9 w-full font-medium bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-colors"
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
