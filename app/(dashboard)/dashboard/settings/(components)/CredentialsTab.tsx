"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Loader2, ShieldCheck, ShieldAlert,
  Eye, EyeOff, X, CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/utils/utils";
import {
  saveCredentials,
  deleteCredentials,
  verifyAndChangePin,
} from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import type { IProviderCredentials, IProviderCredentialsFormState } from "@/utils/interfaces/provider-credentials";
import ConfirmModal from "@/app/(components)/ConfirmModal";

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
  const [newPin,     setNewPin]     = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);

    if (hasPinSet && !currentPin) {
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
    if (hasPinSet && newPin === currentPin) {
      setError("New PIN must be different from current PIN.");
      return;
    }

    setSaving(true);
    const result = await verifyAndChangePin(
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
              {hasPinSet ? "Change PIN" : "Set PIN"}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {hasPinSet
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

          {/* Current PIN — only if PIN already set */}
          {hasPinSet && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Current PIN
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  inputMode="numeric"
                  maxLength={4}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#15689E]/20 focus:border-[#15689E] tracking-widest"
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
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#15689E]/20 focus:border-[#15689E] tracking-widest"
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
                      ? "bg-[#15689E] border-[#15689E]"
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
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#15689E]/20 focus:border-[#15689E] tracking-widest"
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
                      ? "bg-[#15689E] border-[#15689E]"
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
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#15689E] text-white text-sm font-semibold hover:bg-[#15689E]/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
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
  const [state, formAction, isPending] = useActionState<
    IProviderCredentialsFormState | null,
    FormData
  >(saveCredentials, null);

  const [confirmOpen,    setConfirmOpen]    = useState(false);
  const [isDeleting,     setIsDeleting]     = useState(false);
  const [showChangePIN,  setShowChangePIN]  = useState(false);

  const hasPinSet = !!credentials?.pin_hash;

  useEffect(() => {
    if (!state) return;
    if (state.success) toast.success("Credentials saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);

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
            className="text-sm font-semibold text-[#15689E] hover:underline shrink-0"
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
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#374151]">NPI Number</Label>
          <Input
            name="npi_number"
            defaultValue={credentials?.npi_number ?? ""}
            placeholder="e.g. 1234567890"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[#374151]">PTAN Number</Label>
          <Input
            name="ptan_number"
            defaultValue={credentials?.ptan_number ?? ""}
            placeholder="e.g. A12345"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[#374151]">Medical License Number</Label>
          <Input
            name="medical_license_number"
            defaultValue={credentials?.medical_license_number ?? ""}
            placeholder="e.g. G12345"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-[#374151]">Other Credential</Label>
          <Input
            name="credential"
            defaultValue={credentials?.credential ?? ""}
            placeholder="DEA number, board cert, etc."
            className="h-9 text-sm"
          />
        </div>

        {state?.error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {state.error}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          {credentials && (
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Remove all credentials
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="ml-auto bg-[#15689E] hover:bg-[#125d8e] text-white gap-1.5 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.1)]"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save credentials
          </Button>
        </div>
      </form>

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
