"use client";

import { useActionState, useState } from "react";
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
import { inviteSignUp, getContractSignedUrls } from "../(services)/actions";
import { EnrollmentFormDocument } from "../(components)/EnrollmentFormDocument";
import type { InviteSignUpState } from "@/utils/interfaces/invite";
import { CREDENTIAL_OPTIONS } from "@/utils/constants/auth";
import type { InviteTokenRole } from "@/utils/interfaces/invite-tokens";

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
  // PDF agreement state — clinical_provider only
  const [baaAgreed, setBaaAgreed] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  // Signed URL state — initialized from server props, refreshable via retry
  const [baaUrl, setBaaUrl] = useState<string | null>(initialBaaUrl);
  const [productServicesUrl, setProductServicesUrl] = useState<string | null>(initialProductServicesUrl);
  const [contractsError, setContractsError] = useState<string | null>(initialContractsError);
  const [isRetrying, setIsRetrying] = useState(false);
  const [clientError, setClientError] = useState("");

  // Enrollment state — clinical_provider only
  const [facilityEin, setFacilityEin] = useState("");
  const [facilityNpi, setFacilityNpi] = useState("");
  const [facilityTin, setFacilityTin] = useState("");
  const [facilityPtan, setFacilityPtan] = useState("");
  const [apContactName, setApContactName] = useState("");
  const [apContactEmail, setApContactEmail] = useState("");
  const [billingFax, setBillingFax] = useState("");
  const [dpaContact, setDpaContact] = useState("");
  const [dpaContactEmail, setDpaContactEmail] = useState("");
  const [additionalProvider1Name, setAdditionalProvider1Name] = useState("");
  const [additionalProvider1Npi, setAdditionalProvider1Npi] = useState("");
  const [additionalProvider2Name, setAdditionalProvider2Name] = useState("");
  const [additionalProvider2Npi, setAdditionalProvider2Npi] = useState("");
  const [shippingFacilityName, setShippingFacilityName] = useState("");
  const [shippingFacilityNpi, setShippingFacilityNpi] = useState("");
  const [shippingFacilityTin, setShippingFacilityTin] = useState("");
  const [shippingFacilityPtan, setShippingFacilityPtan] = useState("");
  const [shippingContactName, setShippingContactName] = useState("");
  const [shippingContactEmail, setShippingContactEmail] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingDaysTimes, setShippingDaysTimes] = useState("");
  const [shippingPhone, setShippingPhone] = useState("");
  const [shippingFax, setShippingFax] = useState("");
  const [shipping2FacilityName, setShipping2FacilityName] = useState("");
  const [shipping2FacilityNpi, setShipping2FacilityNpi] = useState("");
  const [shipping2FacilityTin, setShipping2FacilityTin] = useState("");
  const [shipping2FacilityPtan, setShipping2FacilityPtan] = useState("");
  const [shipping2ContactName, setShipping2ContactName] = useState("");
  const [shipping2ContactEmail, setShipping2ContactEmail] = useState("");
  const [shipping2Address, setShipping2Address] = useState("");
  const [shipping2DaysTimes, setShipping2DaysTimes] = useState("");
  const [shipping2Phone, setShipping2Phone] = useState("");
  const [shipping2Fax, setShipping2Fax] = useState("");
  const [claimsContactName, setClaimsContactName] = useState("");
  const [claimsContactPhone, setClaimsContactPhone] = useState("");
  const [claimsContactEmail, setClaimsContactEmail] = useState("");
  const [claimsThirdParty, setClaimsThirdParty] = useState("");
  const [missingEnrollFields, setMissingEnrollFields] = useState<Set<string>>(new Set());

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
        ...(role === "clinical_provider" ? [{ label: "Enroll", icon: ClipboardList }] : []),
      ]
    : [
        { label: "Role", icon: UserCheck },
        { label: "Info", icon: User },
        { label: "Security", icon: Lock },
        { label: "Agree", icon: FileCheck },
        ...(role === "clinical_provider" ? [{ label: "Enroll", icon: ClipboardList }] : []),
      ];

  const officeStepIndex = needsOfficeStep ? 2 : null;
  const securityStepIndex = needsOfficeStep ? 3 : 2;
  const agreeStepIndex = needsOfficeStep ? 4 : 3;
  const enrollStepIndex = role === "clinical_provider" ? agreeStepIndex + 1 : null;

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

    // Reset agreement checkboxes whenever entering the agree step
    if (step === securityStepIndex) {
      setBaaAgreed(false);
      setTermsAgreed(false);
      setAgreed(false);
    }

    // Validate agree step before advancing to enroll
    if (step === agreeStepIndex) {
      if (role === "clinical_provider") {
        if (!baaAgreed || !termsAgreed) {
          setClientError("You must agree to both the BAA and Product & Services Agreement.");
          return;
        }
      } else {
        if (!agreed) {
          setClientError("You must agree to the Terms of Service.");
          return;
        }
      }
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

  function handleEnrollSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (isPending) {
      e.preventDefault();
      return;
    }
    setClientError("");

    const checks: [string, string][] = [
      ["facilityEin", facilityEin],
      ["facilityNpi", facilityNpi],
      ["facilityTin", facilityTin],
      ["facilityPtan", facilityPtan],
      ["apContactName", apContactName],
      ["apContactEmail", apContactEmail],
      ["billingFax", billingFax],
      ["dpaContact", dpaContact],
      ["dpaContactEmail", dpaContactEmail],
      ["additionalProvider1Name", additionalProvider1Name],
      ["additionalProvider1Npi", additionalProvider1Npi],
      ["additionalProvider2Name", additionalProvider2Name],
      ["additionalProvider2Npi", additionalProvider2Npi],
      ["shippingFacilityName", shippingFacilityName],
      ["shippingFacilityNpi", shippingFacilityNpi],
      ["shippingFacilityTin", shippingFacilityTin],
      ["shippingFacilityPtan", shippingFacilityPtan],
      ["shippingContactName", shippingContactName],
      ["shippingContactEmail", shippingContactEmail],
      ["shippingAddress", shippingAddress],
      ["shippingDaysTimes", shippingDaysTimes],
      ["shippingPhone", shippingPhone],
      ["shippingFax", shippingFax],
      ["shipping2FacilityName", shipping2FacilityName],
      ["shipping2FacilityNpi", shipping2FacilityNpi],
      ["shipping2FacilityTin", shipping2FacilityTin],
      ["shipping2FacilityPtan", shipping2FacilityPtan],
      ["shipping2ContactName", shipping2ContactName],
      ["shipping2ContactEmail", shipping2ContactEmail],
      ["shipping2Address", shipping2Address],
      ["shipping2DaysTimes", shipping2DaysTimes],
      ["shipping2Phone", shipping2Phone],
      ["shipping2Fax", shipping2Fax],
      ["claimsContactName", claimsContactName],
      ["claimsContactPhone", claimsContactPhone],
      ["claimsContactEmail", claimsContactEmail],
      ["claimsThirdParty", claimsThirdParty],
    ];

    const emptyFields = new Set(
      checks.filter(([, v]) => !v.trim()).map(([k]) => k),
    );

    if (emptyFields.size > 0) {
      e.preventDefault();
      setMissingEnrollFields(emptyFields);
      setClientError("Please complete all highlighted fields before submitting.");
      return;
    }

    setMissingEnrollFields(new Set());
    // All valid — form submits naturally to formAction
  }

  // Enrollment step — full-page layout, renders BEFORE the AuthCard return
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
          facilityTin={facilityTin} onFacilityTinChange={setFacilityTin}
          facilityPtan={facilityPtan} onFacilityPtanChange={setFacilityPtan}
          apContactName={apContactName} onApContactNameChange={setApContactName}
          apContactEmail={apContactEmail} onApContactEmailChange={setApContactEmail}
          billingFax={billingFax} onBillingFaxChange={setBillingFax}
          dpaContact={dpaContact} onDpaContactChange={setDpaContact}
          dpaContactEmail={dpaContactEmail} onDpaContactEmailChange={setDpaContactEmail}
          additionalProvider1Name={additionalProvider1Name} onAdditionalProvider1NameChange={setAdditionalProvider1Name}
          additionalProvider1Npi={additionalProvider1Npi} onAdditionalProvider1NpiChange={setAdditionalProvider1Npi}
          additionalProvider2Name={additionalProvider2Name} onAdditionalProvider2NameChange={setAdditionalProvider2Name}
          additionalProvider2Npi={additionalProvider2Npi} onAdditionalProvider2NpiChange={setAdditionalProvider2Npi}
          shippingFacilityName={shippingFacilityName} onShippingFacilityNameChange={setShippingFacilityName}
          shippingFacilityNpi={shippingFacilityNpi} onShippingFacilityNpiChange={setShippingFacilityNpi}
          shippingFacilityTin={shippingFacilityTin} onShippingFacilityTinChange={setShippingFacilityTin}
          shippingFacilityPtan={shippingFacilityPtan} onShippingFacilityPtanChange={setShippingFacilityPtan}
          shippingContactName={shippingContactName} onShippingContactNameChange={setShippingContactName}
          shippingContactEmail={shippingContactEmail} onShippingContactEmailChange={setShippingContactEmail}
          shippingAddress={shippingAddress} onShippingAddressChange={setShippingAddress}
          shippingDaysTimes={shippingDaysTimes} onShippingDaysTimesChange={setShippingDaysTimes}
          shippingPhone={shippingPhone} onShippingPhoneChange={setShippingPhone}
          shippingFax={shippingFax} onShippingFaxChange={setShippingFax}
          shipping2FacilityName={shipping2FacilityName} onShipping2FacilityNameChange={setShipping2FacilityName}
          shipping2FacilityNpi={shipping2FacilityNpi} onShipping2FacilityNpiChange={setShipping2FacilityNpi}
          shipping2FacilityTin={shipping2FacilityTin} onShipping2FacilityTinChange={setShipping2FacilityTin}
          shipping2FacilityPtan={shipping2FacilityPtan} onShipping2FacilityPtanChange={setShipping2FacilityPtan}
          shipping2ContactName={shipping2ContactName} onShipping2ContactNameChange={setShipping2ContactName}
          shipping2ContactEmail={shipping2ContactEmail} onShipping2ContactEmailChange={setShipping2ContactEmail}
          shipping2Address={shipping2Address} onShipping2AddressChange={setShipping2Address}
          shipping2DaysTimes={shipping2DaysTimes} onShipping2DaysTimesChange={setShipping2DaysTimes}
          shipping2Phone={shipping2Phone} onShipping2PhoneChange={setShipping2Phone}
          shipping2Fax={shipping2Fax} onShipping2FaxChange={setShipping2Fax}
          claimsContactName={claimsContactName} onClaimsContactNameChange={setClaimsContactName}
          claimsContactPhone={claimsContactPhone} onClaimsContactPhoneChange={setClaimsContactPhone}
          claimsContactEmail={claimsContactEmail} onClaimsContactEmailChange={setClaimsContactEmail}
          claimsThirdParty={claimsThirdParty} onClaimsThirdPartyChange={setClaimsThirdParty}
          missingFields={missingEnrollFields}
          onClearMissing={(name) => setMissingEnrollFields((prev) => { const next = new Set(prev); next.delete(name); return next; })}
        />

        {/* Bottom: error + submit form */}
        <div className="max-w-[800px] mx-auto mt-6 space-y-3">
          {(clientError || state?.error) && (
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <p className="text-xs text-red-600">{clientError || state?.error}</p>
            </div>
          )}

          <form action={formAction} onSubmit={handleEnrollSubmit}>
            {/* All prior-step hidden inputs */}
            <input type="hidden" name="first_name" value={firstName} />
            <input type="hidden" name="last_name" value={lastName} />
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="phone" value={phone} />
            <input type="hidden" name="password" value={password} />
            <input type="hidden" name="agreed" value="true" />
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
            {/* Enrollment hidden inputs — names must match server action's formData.get() calls */}
            <input type="hidden" name="facility_ein" value={facilityEin} />
            <input type="hidden" name="facility_npi" value={facilityNpi} />
            <input type="hidden" name="facility_tin" value={facilityTin} />
            <input type="hidden" name="facility_ptan" value={facilityPtan} />
            <input type="hidden" name="ap_contact_name" value={apContactName} />
            <input type="hidden" name="ap_contact_email" value={apContactEmail} />
            <input type="hidden" name="billing_address" value={officeAddress} />
            <input type="hidden" name="billing_city" value={officeCity} />
            <input type="hidden" name="billing_state" value={officeState} />
            <input type="hidden" name="billing_zip" value={officePostalCode} />
            <input type="hidden" name="billing_phone" value={officePhone} />
            <input type="hidden" name="billing_fax" value={billingFax} />
            <input type="hidden" name="dpa_contact" value={dpaContact} />
            <input type="hidden" name="dpa_contact_email" value={dpaContactEmail} />
            <input type="hidden" name="additional_provider_1_name" value={additionalProvider1Name} />
            <input type="hidden" name="additional_provider_1_npi" value={additionalProvider1Npi} />
            <input type="hidden" name="additional_provider_2_name" value={additionalProvider2Name} />
            <input type="hidden" name="additional_provider_2_npi" value={additionalProvider2Npi} />
            <input type="hidden" name="shipping_facility_name" value={shippingFacilityName} />
            <input type="hidden" name="shipping_facility_npi" value={shippingFacilityNpi} />
            <input type="hidden" name="shipping_facility_tin" value={shippingFacilityTin} />
            <input type="hidden" name="shipping_facility_ptan" value={shippingFacilityPtan} />
            <input type="hidden" name="shipping_contact_name" value={shippingContactName} />
            <input type="hidden" name="shipping_contact_email" value={shippingContactEmail} />
            <input type="hidden" name="shipping_address" value={shippingAddress} />
            <input type="hidden" name="shipping_days_times" value={shippingDaysTimes} />
            <input type="hidden" name="shipping_phone" value={shippingPhone} />
            <input type="hidden" name="shipping_fax" value={shippingFax} />
            <input type="hidden" name="shipping2_facility_name" value={shipping2FacilityName} />
            <input type="hidden" name="shipping2_facility_npi" value={shipping2FacilityNpi} />
            <input type="hidden" name="shipping2_facility_tin" value={shipping2FacilityTin} />
            <input type="hidden" name="shipping2_facility_ptan" value={shipping2FacilityPtan} />
            <input type="hidden" name="shipping2_contact_name" value={shipping2ContactName} />
            <input type="hidden" name="shipping2_contact_email" value={shipping2ContactEmail} />
            <input type="hidden" name="shipping2_address" value={shipping2Address} />
            <input type="hidden" name="shipping2_days_times" value={shipping2DaysTimes} />
            <input type="hidden" name="shipping2_phone" value={shipping2Phone} />
            <input type="hidden" name="shipping2_fax" value={shipping2Fax} />
            <input type="hidden" name="claims_contact_name" value={claimsContactName} />
            <input type="hidden" name="claims_contact_phone" value={claimsContactPhone} />
            <input type="hidden" name="claims_contact_email" value={claimsContactEmail} />
            <input type="hidden" name="claims_third_party" value={claimsThirdParty} />

            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium h-9 text-sm transition-colors flex items-center justify-center gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Complete Enrollment
            </button>
          </form>
        </div>
      </div>
    );
  }

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
                          className="block text-xs text-[var(--navy)] underline"
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
                          className="mt-0.5 h-4 w-4 rounded border-[#E2E8F0] accent-[var(--navy)] disabled:opacity-40 cursor-pointer"
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
                          className="block text-xs text-[var(--navy)] underline"
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
                          className="mt-0.5 h-4 w-4 rounded border-[#E2E8F0] accent-[var(--navy)] disabled:opacity-40 cursor-pointer"
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

      {/* Submit form — non-clinical_provider only (clinical_provider submits from enrollment step) */}
      {step === agreeStepIndex && enrollStepIndex === null && (
        <form action={formAction}>
          <input type="hidden" name="first_name" value={firstName} />
          <input type="hidden" name="last_name" value={lastName} />
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="phone" value={phone} />
          <input type="hidden" name="password" value={password} />
          <input type="hidden" name="agreed" value={agreed ? "true" : "false"} />

          <button
            type="submit"
            disabled={isPending || !agreed}
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

        {step < (enrollStepIndex ?? agreeStepIndex) && (
          <button
            type="button"
            onClick={goNext}
            disabled={
              step === agreeStepIndex
                ? role === "clinical_provider"
                  ? !baaAgreed || !termsAgreed
                  : !agreed
                : false
            }
            className="flex items-center gap-1.5 rounded-lg bg-[var(--navy)] hover:bg-[var(--navy)]/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium px-5 h-9 text-sm transition-colors ml-auto shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {step === securityStepIndex ? "Review" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </AuthCard>
  );
}
