"use client";

import { useState } from "react";
import {
  ShieldCheck, ShieldAlert,
  Eye, EyeOff, X, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/utils/utils";
import {
  deleteCredentials,
  verifyAndChangePin,
  resetPinWithPassword,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import type { IProviderCredentials } from "@/utils/interfaces/provider-credentials";
import ConfirmModal from "@/app/(components)/ConfirmModal";
import { CredentialsForm } from "./CredentialsForm";

interface CredentialsTabProps {
  credentials: IProviderCredentials | null;
}

/* ── Change PIN modal ── */

function ChangePinModal({
  hasPinSet,
  onClose,
  onSuccess,
}: {
  hasPinSet: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [currentPin, setCurrentPin] = useState("");
  const [password,   setPassword]   = useState("");
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrent,  setShowCurrent]  = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNew,      setShowNew]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);
  /** Forgot-PIN mode: swap the "Current PIN" field for "Account Password",
   *  which the server re-verifies before allowing the new PIN to be set. */
  const [forgotMode, setForgotMode] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (forgotMode) {
      if (!password.trim()) {
        setError("Please enter your account password.");
        return;
      }
    } else if (hasPinSet && !currentPin) {
      setError("Please enter your current PIN.");
      return;
    }
    if (!newPin) {
      setError("Please enter a new PIN.");
      return;
    }
    if (!/^\d{4}$/.test(newPin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("New PINs do not match.");
      return;
    }
    if (!forgotMode && hasPinSet && newPin === currentPin) {
      setError("New PIN must be different from current PIN.");
      return;
    }

    setSaving(true);
    const result = forgotMode
      ? await resetPinWithPassword(password, newPin)
      : await verifyAndChangePin(
          hasPinSet ? currentPin : "SKIP_VERIFY",
          newPin,
        );
    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Failed to update PIN.");
      return;
    }

    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {forgotMode ? "Reset PIN" : hasPinSet ? "Change PIN" : "Set PIN"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {forgotMode
                ? "Enter your account password to set a new PIN."
                : hasPinSet
                  ? "Enter your current PIN to set a new one."
                  : "Create a 4-digit PIN for signing orders."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">

          {/* Current PIN — only if PIN already set AND not in forgot-mode */}
          {hasPinSet && !forgotMode && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Current PIN
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(true);
                    setCurrentPin("");
                    setError(null);
                  }}
                  className="text-xs text-[var(--navy)] hover:underline font-medium"
                >
                  Forgot PIN?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)] tracking-widest"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Forgot-mode: Account Password instead of Current PIN */}
          {forgotMode && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Account password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotMode(false);
                    setPassword("");
                    setError(null);
                  }}
                  className="text-xs text-gray-500 hover:underline"
                >
                  Back to Change PIN
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your account password"
                  autoComplete="current-password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                We&apos;ll email you a notification after your PIN is reset.
              </p>
            </div>
          )}

          {/* New PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              New PIN
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)] tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Dot indicator */}
            <div className="flex gap-2 justify-center pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full border-2 transition-all duration-150",
                    newPin.length > i
                      ? "bg-[var(--navy)] border-[var(--navy)]"
                      : "border-gray-300",
                  )}
                />
              ))}
            </div>
          </div>

          {/* Confirm New PIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Confirm New PIN
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                inputMode="numeric"
                maxLength={4}
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--navy)]/20 focus:border-[var(--navy)] tracking-widest"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Dot indicator */}
            <div className="flex gap-2 justify-center pt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={cn(
                    "w-3 h-3 rounded-full border-2 transition-all duration-150",
                    confirmPin.length > i
                      ? "bg-[var(--navy)] border-[var(--navy)]"
                      : "border-gray-300",
                  )}
                />
              ))}
            </div>
            {/* Match indicator */}
            {confirmPin && newPin && (
              <p className={cn(
                "text-xs flex items-center gap-1",
                confirmPin === newPin ? "text-green-600" : "text-red-500",
              )}>
                {confirmPin === newPin
                  ? <><CheckCircle2 className="w-3 h-3" /> PINs match</>
                  : <><X className="w-3 h-3" /> PINs don&apos;t match</>}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--navy)] text-white text-sm font-semibold hover:bg-[var(--navy)]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {saving && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {saving ? "Saving..." : "Save new PIN"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */

export function CredentialsTab({ credentials }: CredentialsTabProps) {
  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [isDeleting,     setIsDeleting]     = useState(false);
  const [showChangePIN,  setShowChangePIN]  = useState(false);

  const hasPinSet = !!credentials?.pin_hash;

  async function handleDeleteConfirm() {
    setIsDeleting(true);
    try {
      await deleteCredentials();
      toast.success("Credentials removed.");
      setConfirmOpen(false);
    } catch {
      toast.error("Failed to remove credentials.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* PIN Section */}
      <div className="border border-gray-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
              hasPinSet ? "bg-green-100" : "bg-amber-100",
            )}>
              {hasPinSet
                ? <ShieldCheck className="w-4 h-4 text-green-600" />
                : <ShieldAlert className="w-4 h-4 text-amber-500" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Digital Signature PIN
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                {hasPinSet
                  ? "Your PIN is configured and active."
                  : "No PIN set. Configure one to sign orders."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowChangePIN(true)}
            className="text-sm font-semibold text-[var(--navy)] hover:underline shrink-0"
          >
            {hasPinSet ? "Change PIN" : "Set PIN"}
          </button>
        </div>
      </div>

      {/* Change PIN Modal */}
      {showChangePIN && (
        <ChangePinModal
          hasPinSet={hasPinSet}
          onClose={() => setShowChangePIN(false)}
          onSuccess={() => {
            setShowChangePIN(false);
            toast.success("PIN updated successfully.");
          }}
        />
      )}

      {/* Credentials form */}
      <CredentialsForm
        credentials={credentials}
        onDeleteClick={() => setConfirmOpen(true)}
      />

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={(v) => { if (!isDeleting) setConfirmOpen(v); }}
        onConfirm={handleDeleteConfirm}
        isLoading={isDeleting}
        title="Remove Credentials"
        description="All your credentials will be permanently removed."
      />
    </div>
  );
}
