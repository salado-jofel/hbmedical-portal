"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveCredentials } from "@/app/(dashboard)/dashboard/settings/(services)/actions";
import type { IProviderCredentials, IProviderCredentialsFormState } from "@/utils/interfaces/provider-credentials";

interface CredentialsFormProps {
  credentials: IProviderCredentials | null;
  onDeleteClick: () => void;
}

export function CredentialsForm({ credentials, onDeleteClick }: CredentialsFormProps) {
  const [state, formAction, isPending] = useActionState<
    IProviderCredentialsFormState | null,
    FormData
  >(saveCredentials, null);

  useEffect(() => {
    if (!state) return;
    if (state.success) toast.success("Credentials saved.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
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
            onClick={onDeleteClick}
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
  );
}
