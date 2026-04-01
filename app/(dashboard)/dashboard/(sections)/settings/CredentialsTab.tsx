"use client";

import { useActionState, useEffect } from "react";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveCredentials,
  deleteCredentials,
} from "@/app/(dashboard)/dashboard/(services)/provider-credentials/actions";
import type { IProviderCredentials, IProviderCredentialsFormState } from "@/utils/interfaces/provider-credentials";

interface CredentialsTabProps {
  credentials: IProviderCredentials | null;
}

export function CredentialsTab({ credentials }: CredentialsTabProps) {
  const [state, formAction, isPending] = useActionState<
    IProviderCredentialsFormState | null,
    FormData
  >(saveCredentials, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) toast.success("Credentials saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  async function handleDelete() {
    try {
      await deleteCredentials();
      toast.success("Credentials removed.");
    } catch {
      toast.error("Failed to remove credentials.");
    }
  }

  return (
    <div className="space-y-6">
      {/* PIN status */}
      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        {credentials?.pin_hash ? (
          <>
            <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">Digital signature PIN set</p>
              <p className="text-xs text-slate-500">Your PIN was configured during account setup.</p>
            </div>
          </>
        ) : (
          <>
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-slate-800">No PIN configured</p>
              <p className="text-xs text-slate-500">A PIN is required to sign orders. Contact your administrator.</p>
            </div>
          </>
        )}
      </div>

      {/* Credentials form */}
      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">NPI Number</Label>
          <Input
            name="npi_number"
            defaultValue={credentials?.npi_number ?? ""}
            placeholder="e.g. 1234567890"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">PTAN Number</Label>
          <Input
            name="ptan_number"
            defaultValue={credentials?.ptan_number ?? ""}
            placeholder="e.g. A12345"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">Medical License Number</Label>
          <Input
            name="medical_license_number"
            defaultValue={credentials?.medical_license_number ?? ""}
            placeholder="e.g. G12345"
            className="h-9 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-slate-600">Other Credential</Label>
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
              onClick={handleDelete}
              className="text-xs text-red-400 hover:text-red-600 transition-colors"
            >
              Remove all credentials
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="ml-auto bg-[#15689E] hover:bg-[#15689E]/90 text-white gap-1.5"
          >
            {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save credentials
          </Button>
        </div>
      </form>
    </div>
  );
}
