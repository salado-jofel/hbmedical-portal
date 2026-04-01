"use client";

import { useActionState, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, UserCheck, User, Lock, FileCheck, Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { HBLogo } from "@/app/(components)/HBLogo";
import { AuthField } from "@/app/(components)/AuthField";
import { ROLE_LABELS } from "@/utils/helpers/role";
import { PhoneInput } from "react-international-phone";
import "react-international-phone/style.css";
import { inviteSignUp, type InviteSignUpState } from "../(services)/actions";
import type { InviteTokenRole } from "@/utils/interfaces/invite-tokens";

interface InviteSignUpFormProps {
  token: string;
  role: InviteTokenRole;
  facilityId: string | null;
  facilityName: string | null;
  invitedBy: string;
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
  // Office info state (only used when facilityId is null)
  const [officeName, setOfficeName] = useState("");
  const [officePhone, setOfficePhone] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [officeCity, setOfficeCity] = useState("");
  const [officeState, setOfficeState] = useState("");
  const [officePostalCode, setOfficePostalCode] = useState("");
  // Security state
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  // PIN state (clinical_provider only)
  const needsPin = role === "clinical_provider";
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  // Agreement state
  const [agreed, setAgreed] = useState(false);
  const [clientError, setClientError] = useState("");

  // Compute step layout based on whether we need the office step
  const STEPS = facilityId
    ? [
        { label: "Role", icon: UserCheck },
        { label: "Info", icon: User },
        { label: "Security", icon: Lock },
        { label: "Agree", icon: FileCheck },
      ]
    : [
        { label: "Role", icon: UserCheck },
        { label: "Info", icon: User },
        { label: "Office", icon: Building2 },
        { label: "Security", icon: Lock },
        { label: "Agree", icon: FileCheck },
      ];

  const officeStepIndex = facilityId ? null : 2;
  const securityStepIndex = facilityId ? 2 : 3;
  const agreeStepIndex = facilityId ? 3 : 4;

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

    setDir(1);
    setStep((s) => s + 1);
  }

  function goBack() {
    setClientError("");
    setDir(-1);
    setStep((s) => s - 1);
  }

  // On the security step, password errors render inline below the confirm field.
  // The global error block only shows server-side errors or non-password client errors.
  const inlinePasswordError = step === securityStepIndex;
  const error = (inlinePasswordError ? null : clientError) || state?.error;

  return (
    <div
      className="rounded-2xl border border-white/15 bg-white/8 p-8 backdrop-blur-2xl space-y-6"
      style={{
        boxShadow:
          "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="flex justify-center">
        <HBLogo variant="dark" size="sm" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step
                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                  : i === step
                    ? "bg-white/20 text-white border border-white/30"
                    : "bg-white/5 text-white/30 border border-white/10"
              }`}
            >
              {i < step ? "✓" : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-6 h-px ${i < step ? "bg-green-500/40" : "bg-white/10"}`}
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
                <h2 className="text-lg font-bold text-white">You&apos;re joining as</h2>
                <div className="bg-white/5 border border-white/10 rounded-xl px-6 py-4 space-y-1">
                  <p className="text-2xl font-bold text-white">{ROLE_LABELS[role]}</p>
                  {facilityName && (
                    <p className="text-sm text-white/60">at {facilityName}</p>
                  )}
                  <p className="text-xs text-white/40 mt-2">Invited by {invitedBy}</p>
                </div>
                <p className="text-sm text-white/60">
                  Your role will be set automatically based on your invite.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center">Your information</h2>
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
                <div className="space-y-1.5 phone-input-container">
                  <label className="text-xs text-white/70 font-medium">Phone</label>
                  <PhoneInput
                    defaultCountry="us"
                    value={phone}
                    onChange={setPhone}
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
              </div>
            )}

            {officeStepIndex !== null && step === officeStepIndex && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center">Practice information</h2>
                <AuthField
                  id="office_name"
                  label="Practice name"
                  name="office_name_display"
                  type="text"
                  value={officeName}
                  onChange={(e) => setOfficeName(e.target.value)}
                  placeholder="Sunrise Medical Group"
                />
                <AuthField
                  id="office_phone"
                  label="Office phone"
                  name="office_phone_display"
                  type="tel"
                  value={officePhone}
                  onChange={(e) => setOfficePhone(e.target.value)}
                  placeholder="+1 (555) 000-0000"
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
                <h2 className="text-lg font-bold text-white text-center">Create a password</h2>
                <AuthField
                  id="password"
                  label="Password"
                  name="password_display"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setClientError(""); }}
                  placeholder="Min. 8 characters"
                  rightElement={
                    <button
                      type="button"
                      onClick={() => setShowPassword((p) => !p)}
                      className="text-white/40 hover:text-white/70"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
                <div>
                  <AuthField
                    id="confirm_password"
                    label="Confirm password"
                    name="confirm_password_display"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setClientError(""); }}
                    placeholder="Repeat password"
                    rightElement={
                      <button
                        type="button"
                        onClick={() => setShowConfirm((p) => !p)}
                        className="text-white/40 hover:text-white/70"
                      >
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    }
                  />
                  {!needsPin && clientError && (
                    <p className="mt-1.5 text-sm text-red-400">{clientError}</p>
                  )}
                </div>

                {needsPin && (
                  <>
                    <div className="border-t border-white/10 pt-4 space-y-1">
                      <p className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                        Digital signature PIN
                      </p>
                      <p className="text-xs text-white/50">
                        Your 4–6 digit PIN is your digital signature for signing orders.
                      </p>
                    </div>
                    <AuthField
                      id="pin"
                      label="Create your PIN"
                      name="pin_display"
                      type={showPin ? "text" : "password"}
                      value={pin}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setPin(v);
                        setClientError("");
                      }}
                      placeholder="4–6 digits"
                      rightElement={
                        <button
                          type="button"
                          onClick={() => setShowPin((p) => !p)}
                          className="text-white/40 hover:text-white/70"
                        >
                          {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                    <div>
                      <AuthField
                        id="confirm_pin"
                        label="Confirm PIN"
                        name="confirm_pin_display"
                        type={showConfirmPin ? "text" : "password"}
                        value={confirmPin}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                          setConfirmPin(v);
                          setClientError("");
                        }}
                        placeholder="Repeat PIN"
                        rightElement={
                          <button
                            type="button"
                            onClick={() => setShowConfirmPin((p) => !p)}
                            className="text-white/40 hover:text-white/70"
                          >
                            {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        }
                      />
                      {clientError && (
                        <p className="mt-1.5 text-sm text-red-400">{clientError}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === agreeStepIndex && (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-white text-center">Terms &amp; Agreements</h2>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 max-h-36 overflow-y-auto text-xs text-white/50 leading-relaxed">
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
                      className="w-4 h-4 accent-[#e8821a] cursor-pointer"
                    />
                  </div>
                  <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
                    I agree to the Terms of Service and Privacy Policy
                  </span>
                </label>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-sm text-red-300">{error}</p>
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
          <input type="hidden" name="agreed" value={agreed ? "true" : "false"} />
          {needsPin && <input type="hidden" name="pin" value={pin} />}
          {!facilityId && (
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
            disabled={isPending || !agreed}
            className="w-full rounded-xl bg-[#e8821a] hover:bg-[#e8821a]/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
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
            className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors"
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
            className="flex items-center gap-1.5 rounded-xl bg-[#15689E] hover:bg-[#15689E]/90 text-white font-semibold px-5 py-2.5 text-sm transition-colors ml-auto"
          >
            {step === securityStepIndex ? "Review" : "Next"}
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
