"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, UserCheck, User, Lock, FileCheck, Building2, Loader2, AlertCircle, Check, ClipboardList } from "lucide-react";
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
import { inviteSignUp, getContractSignedUrls, getSalesRepContractUrls } from "../(services)/actions";
import { EnrollmentFormDocument } from "../(components)/EnrollmentFormDocument";
import { ContractSignModal } from "../(components)/ContractSignModal";
import { SalesRepContractSignModal } from "../(components)/SalesRepContractSignModal";
import type { InviteSignUpState } from "@/utils/interfaces/invite";
import { CREDENTIAL_OPTIONS } from "@/utils/constants/auth";
import type { InviteTokenRole } from "@/utils/interfaces/invite-tokens";
import { SALES_REP_CONTRACTS, type SalesRepContractKey } from "@/lib/pdf/sales-rep-contracts";

interface InviteSignUpFormProps {
  token: string;
  role: InviteTokenRole;
  facilityId: string | null;
  facilityName: string | null;
  invitedBy: string;
  invitedEmail: string | null;
  baaUrl: string | null;
  productServicesUrl: string | null;
  contractsError: string | null;
}

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
  invitedEmail,
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
  // Email is prefilled and locked when the invite token carries one — admin
  // already captured it when the invite was created. Only falls back to an
  // editable field when the token has no email (legacy / rep-generated invites).
  const emailLocked = Boolean(invitedEmail);
  const [email, setEmail] = useState(invitedEmail ?? "");
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
  // Contract signature state — clinical_provider only. Tracks whether each
  // contract has been signed via the DocuSign-style ContractSignModal.
  const [baaSignedUrl, setBaaSignedUrl] = useState<string | null>(null);
  const [psSignedUrl, setPsSignedUrl] = useState<string | null>(null);
  const [signingContract, setSigningContract] = useState<
    "baa" | "product_services" | null
  >(null);
  const baaAgreed = Boolean(baaSignedUrl);
  const termsAgreed = Boolean(psSignedUrl);
  // Sales-rep onboarding contracts: one signed URL per doc key.
  const [salesRepSigned, setSalesRepSigned] = useState<Record<SalesRepContractKey, string | null>>(
    () =>
      SALES_REP_CONTRACTS.reduce(
        (acc, def) => ({ ...acc, [def.key]: null }),
        {} as Record<SalesRepContractKey, string | null>,
      ),
  );
  const [signingSalesRep, setSigningSalesRep] = useState<SalesRepContractKey | null>(null);
  const [salesRepSourceUrls, setSalesRepSourceUrls] = useState<Record<SalesRepContractKey, string | null>>(
    () =>
      SALES_REP_CONTRACTS.reduce(
        (acc, def) => ({ ...acc, [def.key]: null }),
        {} as Record<SalesRepContractKey, string | null>,
      ),
  );
  const allSalesRepSigned = SALES_REP_CONTRACTS.every(
    (d) => Boolean(salesRepSigned[d.key]),
  );
  // Signed URL state — initialized from server props, refreshable via retry
  const [baaUrl, setBaaUrl] = useState<string | null>(initialBaaUrl);
  const [productServicesUrl, setProductServicesUrl] = useState<string | null>(initialProductServicesUrl);
  const [contractsError, setContractsError] = useState<string | null>(initialContractsError);
  const [isRetrying, setIsRetrying] = useState(false);
  const [clientError, setClientError] = useState("");

  // Enrollment state — clinical_provider only. All fields are optional; the
  // user may leave any of these blank and still advance to the terms step.
  const [facilityEin, setFacilityEin] = useState("");
  const [facilityNpi, setFacilityNpi] = useState("");
  const [facilityPtan, setFacilityPtan] = useState("");
  const [medicareMac, setMedicareMac] = useState("");
  const [apContactName, setApContactName] = useState("");
  const [apContactEmail, setApContactEmail] = useState("");
  const [dpaContact, setDpaContact] = useState("");
  const [dpaContactEmail, setDpaContactEmail] = useState("");
  const [additionalProvider1Name, setAdditionalProvider1Name] = useState("");
  const [additionalProvider1Npi, setAdditionalProvider1Npi] = useState("");
  const [additionalProvider2Name, setAdditionalProvider2Name] = useState("");
  const [additionalProvider2Npi, setAdditionalProvider2Npi] = useState("");
  const [shippingFacilityName, setShippingFacilityName] = useState("");
  const [shippingFacilityNpi, setShippingFacilityNpi] = useState("");
  const [shippingFacilityPtan, setShippingFacilityPtan] = useState("");
  const [shippingContactName, setShippingContactName] = useState("");
  const [shippingContactEmail, setShippingContactEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");

  // Pre-fill shipping fields from billing/office values when the user first
  // reaches the enrollment step. Runs once only; user can freely edit afterward
  // and their edits won't be overwritten by later billing changes.
  const shippingPrefilledRef = useRef(false);

  // Office step for clinical_provider (captures clinic details) AND
  // sales_representative (captures rep_office account details) — both need
  // to create their own facility on signup. clinical_staff never gets this
  // step; they join an existing facility.
  const needsOfficeStep =
    (role === "clinical_provider" || role === "sales_representative") &&
    !facilityId;

  // Step order: Enrollment comes before Terms so the user signs/agrees as the
  // very last action. Enrollment is optional — user can breeze through it.
  const STEPS = needsOfficeStep
    ? [
        { label: "Role", icon: UserCheck },
        { label: "Info", icon: User },
        { label: "Office", icon: Building2 },
        { label: "Security", icon: Lock },
        ...(role === "clinical_provider" ? [{ label: "Enroll", icon: ClipboardList }] : []),
        { label: "Agree", icon: FileCheck },
      ]
    : [
        { label: "Role", icon: UserCheck },
        { label: "Info", icon: User },
        { label: "Security", icon: Lock },
        ...(role === "clinical_provider" ? [{ label: "Enroll", icon: ClipboardList }] : []),
        { label: "Agree", icon: FileCheck },
      ];

  const officeStepIndex = needsOfficeStep ? 2 : null;
  const securityStepIndex = needsOfficeStep ? 3 : 2;
  const enrollStepIndex = role === "clinical_provider" ? securityStepIndex + 1 : null;
  const agreeStepIndex = enrollStepIndex !== null ? enrollStepIndex + 1 : securityStepIndex + 1;

  useEffect(() => {
    if (
      !shippingPrefilledRef.current &&
      enrollStepIndex !== null &&
      step === enrollStepIndex
    ) {
      shippingPrefilledRef.current = true;
      const billingFacility = officeName || facilityName || "";
      const providerNpiVal = npiNumber;
      const fullName = `${firstName} ${lastName}`.trim();
      const parts = [officeAddress, officeCity, officeState, officePostalCode].filter(Boolean);
      const fullAddress = parts.join(", ");
      setShippingFacilityName(billingFacility);
      setShippingFacilityNpi(providerNpiVal);
      setShippingContactName(fullName);
      setShippingContactEmail(email);
      setShippingAddress(fullAddress);
      setShippingPhone(officePhone);
    }
  }, [
    step,
    enrollStepIndex,
    officeName,
    facilityName,
    npiNumber,
    firstName,
    lastName,
    officeAddress,
    officeCity,
    officeState,
    officePostalCode,
    officePhone,
    email,
  ]);

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault();
    setIsRetrying(true);
    setContractsError(null);
    const result = await getContractSignedUrls(token);
    setBaaUrl(result.baaUrl);
    setProductServicesUrl(result.productServicesUrl);
    setContractsError(result.error);
    setIsRetrying(false);
  }

  // Supabase signed URLs have a 1-hour expiry. Refresh them whenever the user
  // lands on the agree step so a slow signup doesn't render Supabase's raw
  // "InvalidJWT: exp claim timestamp check failed" JSON in the iframe.
  useEffect(() => {
    if (step !== agreeStepIndex) return;
    if (role !== "clinical_provider") return;
    let cancelled = false;
    (async () => {
      const result = await getContractSignedUrls(token);
      if (cancelled) return;
      setBaaUrl(result.baaUrl);
      setProductServicesUrl(result.productServicesUrl);
      setContractsError(result.error);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, agreeStepIndex, role]);

  // Load signed URLs for all 6 sales-rep contract templates so the modal can
  // render each document inline next to the signing form.
  useEffect(() => {
    if (step !== agreeStepIndex) return;
    if (role !== "sales_representative") return;
    let cancelled = false;
    (async () => {
      const result = await getSalesRepContractUrls(token);
      if (cancelled) return;
      const urls = result.contracts.reduce(
        (acc, c) => ({ ...acc, [c.key]: c.sourceUrl }),
        {} as Record<SalesRepContractKey, string | null>,
      );
      setSalesRepSourceUrls(urls);
    })();
    return () => {
      cancelled = true;
    };
  }, [step, agreeStepIndex, role, token]);

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
      const nameLabel =
        role === "sales_representative" ? "Account name" : "Practice name";
      if (!officeName.trim()) {
        setClientError(`${nameLabel} is required.`);
        return;
      }
      if (!officePhone.trim()) {
        setClientError(
          role === "sales_representative"
            ? "Account phone is required."
            : "Office phone is required.",
        );
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
        if (!/^\d{4}$/.test(pin)) {
          setClientError("PIN must be exactly 4 digits.");
          return;
        }
        if (pin !== confirmPin) {
          setClientError("PINs do not match.");
          return;
        }
      }
    }

    // Reset agreement state on the way into the agree step so returning
    // users have to re-sign each contract after editing earlier fields.
    if (step + 1 === agreeStepIndex) {
      setBaaSignedUrl(null);
      setPsSignedUrl(null);
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

  // Enrollment step — full-page layout, renders BEFORE the AuthCard return.
  // All fields are optional. "Continue" advances to the terms step where the
  // account is actually submitted.
  if (enrollStepIndex !== null && step === enrollStepIndex) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] py-6 px-4">
        {/* Top bar: step indicator + Back button */}
        <div className="max-w-[900px] mx-auto mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    i < step
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : i === step
                        ? "bg-[#EFF6FF] text-[var(--navy)] border border-[var(--navy)]/30"
                        : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]"
                  }`}
                >
                  {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-6 h-px ${i < step ? "bg-emerald-200" : "bg-[#E2E8F0]"}`} />
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Enrollment document */}
        <EnrollmentFormDocument
          canEdit
          facilityName={officeName || facilityName || ""}
          providerName={`${firstName} ${lastName}`.trim()}
          providerNpi={npiNumber}
          billingAddress={officeAddress}
          billingCity={officeCity}
          billingState={officeState}
          billingZip={officePostalCode}
          billingPhone={officePhone}
          facilityEin={facilityEin} onFacilityEinChange={setFacilityEin}
          facilityNpi={facilityNpi} onFacilityNpiChange={setFacilityNpi}
          facilityPtan={facilityPtan} onFacilityPtanChange={setFacilityPtan}
          medicareMac={medicareMac} onMedicareMacChange={setMedicareMac}
          apContactName={apContactName} onApContactNameChange={setApContactName}
          apContactEmail={apContactEmail} onApContactEmailChange={setApContactEmail}
          dpaContact={dpaContact} onDpaContactChange={setDpaContact}
          dpaContactEmail={dpaContactEmail} onDpaContactEmailChange={setDpaContactEmail}
          additionalProvider1Name={additionalProvider1Name} onAdditionalProvider1NameChange={setAdditionalProvider1Name}
          additionalProvider1Npi={additionalProvider1Npi} onAdditionalProvider1NpiChange={setAdditionalProvider1Npi}
          additionalProvider2Name={additionalProvider2Name} onAdditionalProvider2NameChange={setAdditionalProvider2Name}
          additionalProvider2Npi={additionalProvider2Npi} onAdditionalProvider2NpiChange={setAdditionalProvider2Npi}
          shippingFacilityName={shippingFacilityName} onShippingFacilityNameChange={setShippingFacilityName}
          shippingFacilityNpi={shippingFacilityNpi} onShippingFacilityNpiChange={setShippingFacilityNpi}
          shippingFacilityPtan={shippingFacilityPtan} onShippingFacilityPtanChange={setShippingFacilityPtan}
          shippingContactName={shippingContactName} onShippingContactNameChange={setShippingContactName}
          shippingContactEmail={shippingContactEmail} onShippingContactEmailChange={setShippingContactEmail}
          shippingAddress={shippingAddress} onShippingAddressChange={setShippingAddress}
          shippingPhone={shippingPhone} onShippingPhoneChange={setShippingPhone}
        />

        {/* Bottom: Continue button — enrollment fields are optional */}
        <div className="max-w-[800px] mx-auto mt-6">
          <button
            type="button"
            onClick={goNext}
            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 text-white font-medium px-5 h-9 text-sm transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <AuthCard
      className={`space-y-6 ${
        step === agreeStepIndex &&
        (role === "clinical_provider" || role === "sales_representative")
          ? "!max-w-4xl lg:!max-w-6xl xl:!max-w-7xl"
          : ""
      }`}
    >
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
                    ? "bg-[#EFF6FF] text-[var(--navy)] border border-[var(--navy)]/30"
                    : "bg-[#F8FAFC] text-[#94A3B8] border border-[#E2E8F0]"
              }`}
            >
              {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
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
                  onChange={(e) => {
                    if (!emailLocked) setEmail(e.target.value);
                  }}
                  placeholder="jane@clinic.com"
                  readOnly={emailLocked}
                />
                {emailLocked && (
                  <p className="text-[11px] text-[#64748B] -mt-2">
                    Email is set from your invite and cannot be changed here.
                    Contact your administrator if it needs to be corrected.
                  </p>
                )}
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
                <h2 className="text-lg font-semibold text-[#0F172A] text-center">
                  {role === "sales_representative"
                    ? "Sales Rep Account"
                    : "Practice information"}
                </h2>
                <AuthField
                  id="office_name"
                  label={role === "sales_representative" ? "Account name" : "Practice name"}
                  name="office_name_display"
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="Sunrise Medical Group"
                />
                <PhoneInputField
                  value={officePhone}
                  onChange={(val) => setOfficePhone(val)}
                  label={role === "sales_representative" ? "Account phone" : "Office phone"}
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
                        Your 4-digit PIN is your digital signature for signing orders.
                      </p>
                    </div>
                    <PasswordInput
                      id="pin_display"
                      label="Create your PIN"
                      placeholder="4 digits"
                      value={pin}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 4);
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
                          const v = e.target.value.replace(/\D/g, "").slice(0, 4);
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
                        <div className="h-[380px] md:h-[620px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                          <iframe
                            src={baaSignedUrl || baaUrl}
                            className="w-full h-[380px] md:h-[620px]"
                            title="Business Associates Agreement"
                          />
                        </div>
                      )}

                      {(baaSignedUrl || baaUrl) && (
                        <a
                          href={baaSignedUrl || baaUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-[var(--navy)] underline"
                        >
                          Open in new tab ↗
                        </a>
                      )}

                      {baaSignedUrl ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5">
                          <span className="flex items-center gap-2 text-sm text-[#15803D] font-medium">
                            <Check className="w-4 h-4" /> Signed
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setBaaSignedUrl(null);
                              setSigningContract("baa");
                            }}
                            className="text-xs text-[#64748B] hover:text-[#0F172A] underline"
                          >
                            Clear &amp; re-sign
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSigningContract("baa")}
                          disabled={!baaUrl}
                          className="w-full rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
                        >
                          Review &amp; Sign Business Associates Agreement
                        </button>
                      )}
                    </div>

                    <div className="border-t border-[#E2E8F0]" />

                    {/* Product & Services Section */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-[#0F172A]">
                        Product &amp; Services Agreement <span className="text-red-400">*</span>
                      </h3>

                      {!productServicesUrl ? (
                        <div className="h-[380px] md:h-[620px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
                        </div>
                      ) : (
                        <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                          <iframe
                            src={psSignedUrl || productServicesUrl}
                            className="w-full h-[380px] md:h-[620px]"
                            title="Product and Services Agreement"
                          />
                        </div>
                      )}

                      {(psSignedUrl || productServicesUrl) && (
                        <a
                          href={psSignedUrl || productServicesUrl || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-xs text-[var(--navy)] underline"
                        >
                          Open in new tab ↗
                        </a>
                      )}

                      {psSignedUrl ? (
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5">
                          <span className="flex items-center gap-2 text-sm text-[#15803D] font-medium">
                            <Check className="w-4 h-4" /> Signed
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPsSignedUrl(null);
                              setSigningContract("product_services");
                            }}
                            className="text-xs text-[#64748B] hover:text-[#0F172A] underline"
                          >
                            Clear &amp; re-sign
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSigningContract("product_services")}
                          disabled={!productServicesUrl}
                          className="w-full rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
                        >
                          Review &amp; Sign Product &amp; Services Agreement
                        </button>
                      )}
                    </div>
                  </div>
                ) : role === "sales_representative" ? (
                  <div className="space-y-5">
                    <p className="text-xs text-[#64748B] leading-relaxed">
                      Please review and sign each of the following onboarding documents.
                      All are required to complete your account.
                    </p>
                    {SALES_REP_CONTRACTS.map((def, idx) => {
                      const signed = Boolean(salesRepSigned[def.key]);
                      const signedUrl = salesRepSigned[def.key];
                      const sourceUrl = salesRepSourceUrls[def.key];
                      const previewUrl = signedUrl || sourceUrl;
                      return (
                        <div key={def.key} className="space-y-3">
                          {idx > 0 && <div className="border-t border-[#E2E8F0]" />}
                          <h3 className="text-sm font-medium text-[#0F172A]">
                            {def.label} <span className="text-red-400">*</span>
                          </h3>

                          {!previewUrl ? (
                            <div className="h-[380px] md:h-[620px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-[#94A3B8]" />
                            </div>
                          ) : (
                            <div className="rounded-lg border border-[#E2E8F0] overflow-hidden">
                              <iframe
                                src={previewUrl}
                                className="w-full h-[380px] md:h-[620px]"
                                title={def.label}
                              />
                            </div>
                          )}

                          {previewUrl && (
                            <a
                              href={previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-xs text-[var(--navy)] underline"
                            >
                              Open in new tab ↗
                            </a>
                          )}

                          {signed ? (
                            <div className="flex items-center justify-between gap-3 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-2.5">
                              <span className="flex items-center gap-2 text-sm text-[#15803D] font-medium">
                                <Check className="w-4 h-4" /> Signed
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSalesRepSigned((p) => ({ ...p, [def.key]: null }));
                                  setSigningSalesRep(def.key);
                                }}
                                className="text-xs text-[#64748B] hover:text-[#0F172A] underline"
                              >
                                Clear &amp; re-sign
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setSigningSalesRep(def.key)}
                              disabled={!sourceUrl}
                              className="w-full rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium py-2.5 transition-colors"
                            >
                              Review &amp; Sign {def.label}
                            </button>
                          )}
                        </div>
                      );
                    })}
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
                          className="w-4 h-4 accent-[var(--navy)] cursor-pointer"
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

      {/* Submit form — lives on the agree step for every role.
          For clinical_provider, includes office + enrollment fields collected earlier. */}
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
                : role === "sales_representative"
                  ? allSalesRepSigned ? "true" : "false"
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
          {/* Enrollment hidden inputs — clinical_provider only */}
          {role === "clinical_provider" && (
            <>
              <input type="hidden" name="facility_ein" value={facilityEin} />
              <input type="hidden" name="facility_npi" value={facilityNpi} />
              <input type="hidden" name="facility_ptan" value={facilityPtan} />
              <input type="hidden" name="medicare_mac" value={medicareMac} />
              <input type="hidden" name="ap_contact_name" value={apContactName} />
              <input type="hidden" name="ap_contact_email" value={apContactEmail} />
              <input type="hidden" name="billing_address" value={officeAddress} />
              <input type="hidden" name="billing_city" value={officeCity} />
              <input type="hidden" name="billing_state" value={officeState} />
              <input type="hidden" name="billing_zip" value={officePostalCode} />
              <input type="hidden" name="billing_phone" value={officePhone} />
              <input type="hidden" name="dpa_contact" value={dpaContact} />
              <input type="hidden" name="dpa_contact_email" value={dpaContactEmail} />
              <input type="hidden" name="additional_provider_1_name" value={additionalProvider1Name} />
              <input type="hidden" name="additional_provider_1_npi" value={additionalProvider1Npi} />
              <input type="hidden" name="additional_provider_2_name" value={additionalProvider2Name} />
              <input type="hidden" name="additional_provider_2_npi" value={additionalProvider2Npi} />
              <input type="hidden" name="shipping_facility_name" value={shippingFacilityName} />
              <input type="hidden" name="shipping_facility_npi" value={shippingFacilityNpi} />
              <input type="hidden" name="shipping_facility_ptan" value={shippingFacilityPtan} />
              <input type="hidden" name="shipping_contact_name" value={shippingContactName} />
              <input type="hidden" name="shipping_contact_email" value={shippingContactEmail} />
              <input type="hidden" name="shipping_address" value={shippingAddress} />
              <input type="hidden" name="shipping_phone" value={shippingPhone} />
            </>
          )}

          <button
            type="submit"
            disabled={
              isPending ||
              (role === "clinical_provider"
                ? !baaAgreed || !termsAgreed
                : role === "sales_representative"
                  ? !allSalesRepSigned
                  : !agreed)
            }
            className="w-full rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium h-9 text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
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

        {/* Next button — only shown on steps BEFORE the final (agree) step.
            The agree step renders its own submit form above. */}
        {step < agreeStepIndex && (
          <button
            type="button"
            onClick={goNext}
            className="flex items-center gap-1.5 rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 h-9 text-sm transition-colors ml-auto shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* DocuSign-style contract sign modal (clinical_provider only) */}
      {role === "clinical_provider" && signingContract && (
        <ContractSignModal
          open={true}
          onClose={() => setSigningContract(null)}
          token={token}
          contractType={signingContract}
          contractLabel={
            signingContract === "baa"
              ? "Business Associates Agreement"
              : "Product & Services Agreement"
          }
          defaultName={`${firstName} ${lastName}`.trim()}
          defaultTitle={credential}
          onSigned={(signedUrl) => {
            if (signingContract === "baa") setBaaSignedUrl(signedUrl ?? "");
            else setPsSignedUrl(signedUrl ?? "");
          }}
        />
      )}
      {role === "sales_representative" && signingSalesRep && (() => {
        const def = SALES_REP_CONTRACTS.find((d) => d.key === signingSalesRep);
        if (!def) return null;
        const addressParts = [officeAddress, officeCity, officeState, officePostalCode]
          .filter(Boolean)
          .join(", ");
        const defaults: Record<string, string> = {
          staff_member: `${firstName} ${lastName}`.trim(),
          name: `${firstName} ${lastName}`.trim(),
          first_name: firstName,
          last_name: lastName,
          business_name: officeName,
          contact_address: addressParts,
          address: officeAddress,
          address_street: officeAddress,
          address_city: officeCity,
          address_state: officeState,
          address_zip: officePostalCode,
          city_state_zip: [officeCity, officeState, officePostalCode].filter(Boolean).join(", "),
          email,
          phone,
        };
        return (
          <SalesRepContractSignModal
            open={true}
            onClose={() => setSigningSalesRep(null)}
            token={token}
            contract={def}
            defaults={defaults}
            onSigned={(signedUrl) => {
              setSalesRepSigned((p) => ({ ...p, [def.key]: signedUrl ?? "" }));
            }}
          />
        );
      })()}
    </AuthCard>
  );
}
