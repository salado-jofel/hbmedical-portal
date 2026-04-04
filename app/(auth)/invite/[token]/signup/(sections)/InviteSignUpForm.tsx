"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, UserCheck, User, Lock, FileCheck, Building2, Loader2, AlertCircle } from "lucide-react";
import { HBLogo } from "@/app/(components)/HBLogo";
import { AuthField } from "@/app/(components)/AuthField";
import { AuthCard } from "@/app/(components)/AuthCard";
import { PasswordInput } from "@/app/(components)/PasswordInput";
import { ROLE_LABELS } from "@/utils/helpers/role";
import { PhoneInputField } from "@/app/(components)/PhoneInputField";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteSignUp, getContractSignedUrls, type InviteSignUpState } from "../(services)/actions";
import type { InviteTokenRole } from "@/utils/interfaces/invite-tokens";

interface InviteSignUpFormProps {
  token: string;
  role: InviteTokenRole;
  facilityId: string | null;
  facilityName: string | null;
  invitedBy: string;
  baaUrl: string | null;
  productServicesUrl: string | null;
  contractsError: string | null;
}

const CREDENTIAL_OPTIONS = [
  { value: "MD", label: "MD — Medical Doctor" },
  { value: "DO", label: "DO — Doctor of Osteopathic Medicine" },
  { value: "ARNP", label: "ARNP — Advanced Registered Nurse Practitioner" },
  { value: "PA", label: "PA — Physician Assistant" },
  { value: "RN", label: "RN — Registered Nurse" },
  { value: "CCA", label: "CCA — Certified Coding Associate" },
  { value: "LPN", label: "LPN — Licensed Practical Nurse" },
  { value: "Admin", label: "Admin" },
  { value: "Other", label: "Other" },
];

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({
    x: dir > 0 ? -40 : 40,
    opacity: 0,
  }),
};

export default function InviteSignUpForm({
  token,
  role,
  facilityId,
  facilityName,
  invitedBy,
  baaUrl: initialBaaUrl,
  productServicesUrl: initialProductServicesUrl,
  contractsError: initialContractsError,
}: InviteSignUpFormProps) {
  const boundAction = inviteSignUp.bind(null, token);
  const [state, formAction, isPending] = useActionState<InviteSignUpState, FormData>(
    boundAction,
    { error: null },
  );

  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  // Personal info state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // Office info state — only used for clinical_provider (never for sales_rep or clinical_staff)
  const [officeName, setOfficeName] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeState, setOfficeState] = useState("");
  const [officePostalCode, setOfficePostalCode] = useState("");
  // Security state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // PIN + NPI + credential state (clinical_provider only)
  const needsPin = role === "clinical_provider";
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [npiNumber, setNpiNumber] = useState("");
  const [credential, setCredential] = useState("");
  // Agreement state
  const [agreed, setAgreed] = useState(false);
  // PDF agreement state — clinical_provider only
  const [baaAgreed, setBaaAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  // Signed URL state — initialized from server props, refreshable via retry
  const [baaUrl, setBaaUrl] = useState<string | null>(initialBaaUrl);
  const [productServicesUrl, setProductServicesUrl] = useState<string | null>(initialProductServicesUrl);
  const [contractsError, setContractsError] = useState<string | null>(initialContractsError);
  const [isRetrying, setIsRetrying] = useState(false);
  const [clientError, setClientError] = useState("");

  // Office step only for clinical_provider WITHOUT a pre-assigned facility
  // (sales_rep and clinical_staff never get an office step here)
  const needsOfficeStep = role === "clinical_provider" && !facilityId;

  const STEPS = needsOfficeStep
    ? [
        { label: "Role", icon: UserCheck },
        { label: "Info", icon: User },
        { label: "Office", icon: Building2 },
        { label: "Security", icon: Lock },
        { label: "Agree", icon: FileCheck },
      ]
    : [
        { label: "Role", icon: UserCheck },
        { label: "Info", icon: User },
        { label: "Security", icon: Lock },
        { label: "Agree", icon: FileCheck },
      ];

  const officeStepIndex = needsOfficeStep ? 2 : null;
  const securityStepIndex = needsOfficeStep ? 3 : 2;
  const agreeStepIndex = needsOfficeStep ? 4 : 3;

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault();
    setIsRetrying(true);
    setContractsError(null);
    const result = await getContractSignedUrls();
    setBaaUrl(result.baaUrl);
    setProductServicesUrl(result.productServicesUrl);
    setContractsError(result.error);
    setIsRetrying(false);
  }

  function goNext() {
    setClientError("");

    if (step === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        setClientError("First and last name are required.");
        return;
      }
      if (!email.trim()) {
        setClientError("Email is required.");
        return;
      }
    }

    if (officeStepIndex !== null && step === officeStepIndex) {
      if (!officeName.trim()) {
        setClientError("Practice name is required.");
        return;
      }
      if (!officeAddress.trim() || !officeCity.trim() || !officeState.trim() || !officePostalCode.trim()) {
        setClientError("Address, city, state, and ZIP code are required.");
        return;
      }
    }

    if (step === securityStepIndex) {
      if (password.length < 8) {
        setClientError("Password must be at least 8 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setClientError("Passwords do not match.");
        return;
      }
      if (needsPin) {
        if (!/^\d{10}$/.test(npiNumber)) {
          setClientError("NPI must be exactly 10 digits.");
          return;
        }
        if (!/^\d{4,6}$/.test(pin)) {
          setClientError("PIN must be 4–6 digits.");
          return;
        }
        if (pin !== confirmPin) {
          setClientError("PINs do not match.");
          return;
        }
      }
    }

    // Reset agreement checkboxes whenever entering the agree step
    if (step === securityStepIndex) {
      setBaaAgreed(false);
      setTermsAgreed(false);
      setAgreed(false);
    }

    setDir(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setClientError("");
    setDir(-1);
    setStep((s) => s - 1);
  }

  // On the security step, password errors render inline below the confirm field.
  const inlinePasswordError = step === securityStepIndex;
  const error = (inlinePasswordError ? null : clientError) || state?.error;

  return (
    <AuthCard className="space-y-6">
      {/* Logo */}
      <div className="flex justify-center">
        <HBLogo variant="light" size="sm" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : i === step
                    ? "bg-[#EFF6FF] text-[#15689E] border border-[#15689E]/30"
                    : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 h-px ${i < step ? "bg-emerald-200" : "bg-[#E2E8F0]"}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="overflow-hidden" style={{ minHeight: 220 }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {step === 0 && (
              <div className="space-y-4 text-center">
                <h2 className="text-lg font-semibold text-[#0F172A]">You&apos;re joining as</h2>
                <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-6 py-4 space-y-1">
                  <p className="text-2xl font-bold text-[#0F172A]">{ROLE_LABELS[role]}</p>
                  {facilityName && (
                    <p className="text-sm text-[#64748B]">at {facilityName}</p>
                  )}
                  <p className="text-xs text-[#94A3B8] mt-2">Invited by {invitedBy}</p>
                </div>
                <p className="text-sm text-[#64748B]">
                  Your role will be set automatically based on your invite.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F172A] text-center">Your information</h2>
                <div className="grid grid-cols-2 gap-3">
                  <AuthField
                    id="first_name"
                    label="First name"
                    name="first_name_display"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jane"
                  />
                  <AuthField
                    id="last_name"
                    label="Last name"
                    name="last_name_display"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Smith"
                  />
                </div>
                <AuthField
                  id="email"
                  label="Email"
                  name="email_display"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@clinic.com"
                />
                <PhoneInputField
                  value={phone}
                  onChange={(val) => setPhone(val)}
                  label="Phone"
                  theme="light"
                />
              </div>
            )}

            {officeStepIndex !== null && step === officeStepIndex && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F172A] text-center">Practice information</h2>
                <AuthField
                  id="office_name"
                  label="Practice name"
                  name="office_name_display"
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="Sunrise Medical Group"
                />
                <PhoneInputField
                  value={officePhone}
                  onChange={(val) => setOfficePhone(val)}
                  label="Office phone"
                  required
                  theme="light"
                />
                <AuthField
                  id="office_address"
                  label="Address"
                  name="office_address_display"
                  type="text"
                  value={officeAddress}
                  onChange={(e) => setOfficeAddress(e.target.value)}
                  placeholder="123 Main St"
                />
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-1">
                    <AuthField
                      id="office_city"
                      label="City"
                      name="office_city_display"
                      type="text"
                      value={officeCity}
                      onChange={(e) => setOfficeCity(e.target.value)}
                      placeholder="Dallas"
                    />
                  </div>
                  <div className="col-span-1">
                    <AuthField
                      id="office_state"
                      label="State"
                      name="office_state_display"
                      type="text"
                      value={officeState}
                      onChange={(e) => setOfficeState(e.target.value)}
                      placeholder="TX"
                    />
                  </div>
                  <div className="col-span-1">
                    <AuthField
                      id="office_postal_code"
                      label="ZIP code"
                      name="office_postal_code_display"
                      type="text"
                      value={officePostalCode}
                      onChange={(e) => setOfficePostalCode(e.target.value)}
                      placeholder="75001"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === securityStepIndex && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F172A] text-center">Create a password</h2>
                <PasswordInput
                  id="password_display"
                  label="Password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setClientError(""); }}
                />
                <div>
                  <PasswordInput
                    id="confirm_password_display"
                    label="Confirm password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setClientError(""); }}
                  />
                  {!needsPin && clientError && (
                    <p className="mt-1.5 text-xs text-red-500">{clientError}</p>
                  )}
                </div>

                {needsPin && (
                  <>
                    <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">
                          Credential Type
                        </p>
                        <p className="text-xs text-[#94A3B8]">
                          Select your professional credential.
                        </p>
                      </div>
                      <Select value={credential} onValueChange={setCredential}>
                        <SelectTrigger className="h-9 text-sm border-[#E2E8F0] bg-white text-[#0F172A] rounded-lg">
                          <SelectValue placeholder="Select credential..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CREDENTIAL_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value} className="text-sm">
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="border-t border-[#E2E8F0] pt-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">
                          NPI Number
                        </p>
                        <p className="text-xs text-[#94A3B8]">
                          Your 10-digit National Provider Identifier.
                        </p>
                      </div>
                      <AuthField
                        id="npi_number"
                        label="NPI Number"
                        name="npi_number_display"
                        type="text"
                        value={npiNumber}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                          setNpiNumber(v);
                          setClientError("");
                        }}
                        placeholder="10 digits"
                      />
                    </div>
                    <div className="border-t border-[#E2E8F0] pt-4 space-y-1">
                      <p className="text-xs font-semibold text-[#374151] uppercase tracking-wide">
                        Digital signature PIN
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        Your 4–6 digit PIN is your digital signature for signing orders.
                      </p>
                    </div>
                    <PasswordInput
                      id="pin_display"
                      label="Create your PIN"
                      placeholder="4–6 digits"
                      value={pin}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPin(v);
                        setClientError("");
                      }}
                    />
                    <div>
                      <PasswordInput
                        id="confirm_pin_display"
                        label="Confirm PIN"
                        placeholder="Repeat PIN"
                        value={confirmPin}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setConfirmPin(v);
                          setClientError("");
                        }}
                      />
                      {clientError && (
                        <p className="mt-1.5 text-xs text-red-500">{clientError}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === agreeStepIndex && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-[#0F172A] text-center">Terms &amp; Agreements</h2>

                {role === "clinical_provider" ? (
                  <div className="space-y-5">
                    {/* BAA Section */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-[#0F172A]">
                        Business Associates Agreement (BAA) <span className="text-red-400">*</span>
                      </h3>

                      {contractsError ? (
                        <div className="flex items-center gap-2 p-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          {contractsError}
                          <a
                            href="#"
                            onClick={handleRetry}
                            className="underline ml-1 flex items-center gap-1"
                          >
                            {isRetrying && <Loader2 className="w-3 h-3 animate-spin" />}
                            Retry
                          </a>
                        </div>
                      ) : !baaUrl ? (
                        <div className="h-[280px] md:h-[340px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                          <iframe
                            src={baaUrl}
                            className="w-full h-[280px] md:h-[340px]"
                            title="Business Associates Agreement"
                          />
                        </div>
                      )}

                      {baaUrl && (
                        <a
                          href={baaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-[#15689E] underline"
                        >
                          Open in new tab ↗
                        </a>
                      )}

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={baaAgreed}
                          onChange={(e) => setBaaAgreed(e.target.checked)}
                          disabled={!baaUrl}
                          className="mt-0.5 h-4 w-4 rounded border-[#E2E8F0] accent-[#15689E] disabled:opacity-40 cursor-pointer"
                        />
                        <span className="text-sm text-[#64748B]">
                          I have read and agree to the <strong>Business Associates Agreement</strong>
                        </span>
                      </label>
                    </div>

                    <div className="border-t border-[#E2E8F0]" />

                    {/* Product & Services Section */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-[#0F172A]">
                        Product &amp; Services Agreement <span className="text-red-400">*</span>
                      </h3>

                      {!productServicesUrl ? (
                        <div className="h-[280px] md:h-[340px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                          <iframe
                            src={productServicesUrl}
                            className="w-full h-[280px] md:h-[340px]"
                            title="Product and Services Agreement"
                          />
                        </div>
                      )}

                      {productServicesUrl && (
                        <a
                          href={productServicesUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-[#15689E] underline"
                        >
                          Open in new tab ↗
                        </a>
                      )}

                      <label className="flex items-start gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={termsAgreed}
                          onChange={(e) => setTermsAgreed(e.target.checked)}
                          disabled={!productServicesUrl}
                          className="mt-0.5 h-4 w-4 rounded border-[#E2E8F0] accent-[#15689E] disabled:opacity-40 cursor-pointer"
                        />
                        <span className="text-sm text-[#64748B]">
                          I have read and agree to the <strong>Product &amp; Services Agreement</strong>
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-4 max-h-36 overflow-y-auto text-xs text-[#64748B] leading-relaxed">
                      By creating an account, you agree to HB Medical&apos;s Terms of Service
                      and Privacy Policy. You confirm that the information provided is accurate
                      and that you are authorized to access the HB Medical portal on behalf of
                      your organization. Unauthorized use of this platform is strictly prohibited.
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <div className="mt-0.5">
                        <input
                          type="checkbox"
                          checked={agreed}
                          onChange={(e) => setAgreed(e.target.checked)}
                          className="w-4 h-4 accent-[#15689E] cursor-pointer"
                        />
                      </div>
                      <span className="text-sm text-[#64748B] group-hover:text-[#0F172A] transition-colors">
                        I agree to the Terms of Service and Privacy Policy
                      </span>
                    </label>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Form (hidden fields for final submission) */}
      {step === agreeStepIndex && (
        <form action={formAction}>
          <input type="hidden" name="first_name" value={firstName} />
          <input type="hidden" name="last_name" value={lastName} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="password" value={password} />
          <input
            type="hidden"
            name="agreed"
            value={
              role === "clinical_provider"
                ? baaAgreed && termsAgreed ? "true" : "false"
                : agreed ? "true" : "false"
            }
          />
          {needsPin && <input type="hidden" name="pin" value={pin} />}
          {needsPin && <input type="hidden" name="npi_number" value={npiNumber} />}
          {needsPin && <input type="hidden" name="credential" value={credential} />}
          {needsOfficeStep && (
            <>
              <input type="hidden" name="office_name" value={officeName} />
              <input type="hidden" name="office_phone" value={officePhone} />
              <input type="hidden" name="office_address" value={officeAddress} />
              <input type="hidden" name="office_city" value={officeCity} />
              <input type="hidden" name="office_state" value={officeState} />
              <input type="hidden" name="office_postal_code" value={officePostalCode} />
            </>
          )}

          <button
            type="submit"
            disabled={
              isPending ||
              (role === "clinical_provider" ? !baaAgreed || !termsAgreed : !agreed)
            }
            className="w-full rounded-lg bg-[#15689E] hover:bg-[#125d8e] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium h-9 text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        ) : (
          <div />
        )}

        {step < agreeStepIndex && (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-lg bg-[#15689E] hover:bg-[#125d8e] text-white font-medium px-5 h-9 text-sm transition-colors ml-auto shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {step === securityStepIndex ? "Review" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </AuthCard>
  );
}
