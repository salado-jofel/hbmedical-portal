"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RECIPIENT_CREDENTIALS,
  RECIPIENT_CREDENTIAL_LABELS,
  FORM_CATEGORIES,
  FORM_CATEGORY_LABELS,
  type RecipientCredential,
  type FormCategory,
} from "@/utils/constants/value-transfers";
import type {
  IValueTransferEntry,
  IValueTransferEntryFormState,
} from "@/utils/interfaces/value-transfers";

/**
 * Shared form fields for adding and editing a value transfer entry. Both
 * AddTransferModal and EditTransferModal render this inside their <form>.
 *
 * The Select components for credential and form_category use hidden inputs
 * for FormData submission — useState tracks the visible value.
 */
export function TransferEntryFields({
  initial,
  fieldErrors,
}: {
  initial?: IValueTransferEntry;
  fieldErrors?: IValueTransferEntryFormState["fieldErrors"];
}) {
  const [credential, setCredential] = useState<RecipientCredential>(
    initial?.recipientCredential ?? "MD",
  );
  const [formCategory, setFormCategory] = useState<FormCategory>(
    initial?.formCategory ?? "meal",
  );

  const isTeachingHospital = credential === "TEACHING_HOSPITAL";

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="transfer_date" className="text-xs">
            Transfer date <span className="text-red-400">*</span>
          </Label>
          <Input
            type="date"
            id="transfer_date"
            name="transfer_date"
            defaultValue={initial?.transferDate ?? ""}
            className="h-9 text-sm"
            required
          />
          {fieldErrors?.transfer_date && (
            <p className="text-xs text-red-500">{fieldErrors.transfer_date}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="form_category" className="text-xs">
            Form / category <span className="text-red-400">*</span>
          </Label>
          <input type="hidden" name="form_category" value={formCategory} />
          <Select
            value={formCategory}
            onValueChange={(v) => setFormCategory(v as FormCategory)}
          >
            <SelectTrigger id="form_category" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORM_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {FORM_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="recipient_name" className="text-xs">
            Recipient name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="recipient_name"
            name="recipient_name"
            defaultValue={initial?.recipientName ?? ""}
            placeholder={isTeachingHospital ? "Institution name" : "Full legal name"}
            className="h-9 text-sm"
            required
            maxLength={240}
          />
          {fieldErrors?.recipient_name && (
            <p className="text-xs text-red-500">{fieldErrors.recipient_name}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="recipient_credential" className="text-xs">
            Type <span className="text-red-400">*</span>
          </Label>
          <input
            type="hidden"
            name="recipient_credential"
            value={credential}
          />
          <Select
            value={credential}
            onValueChange={(v) => setCredential(v as RecipientCredential)}
          >
            <SelectTrigger id="recipient_credential" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RECIPIENT_CREDENTIALS.map((c) => (
                <SelectItem key={c} value={c}>
                  {RECIPIENT_CREDENTIAL_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isTeachingHospital ? (
        <div className="space-y-1.5">
          <Label htmlFor="recipient_address" className="text-xs">
            Institution address <span className="text-red-400">*</span>
          </Label>
          <Input
            id="recipient_address"
            name="recipient_address"
            defaultValue={initial?.recipientAddress ?? ""}
            placeholder="Street, City, State ZIP"
            className="h-9 text-sm"
            maxLength={500}
          />
          {/* keep an empty NPI in the form */}
          <input type="hidden" name="recipient_npi" value="" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="recipient_npi" className="text-xs">
            NPI (10-digit)
          </Label>
          <Input
            id="recipient_npi"
            name="recipient_npi"
            defaultValue={initial?.recipientNpi ?? ""}
            placeholder="1234567890"
            inputMode="numeric"
            maxLength={10}
            className="h-9 text-sm"
          />
          {fieldErrors?.recipient_npi && (
            <p className="text-xs text-red-500">{fieldErrors.recipient_npi}</p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="affiliation" className="text-xs">
          Affiliation (hospital, practice, institution)
        </Label>
        <Input
          id="affiliation"
          name="affiliation"
          defaultValue={initial?.affiliation ?? ""}
          className="h-9 text-sm"
          maxLength={240}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description" className="text-xs">
          Description
        </Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={initial?.description ?? ""}
          placeholder={'e.g. "lunch at clinic during in-service training"'}
          className="min-h-[72px] text-sm"
          maxLength={1000}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div className="space-y-1.5">
          <Label htmlFor="value_amount" className="text-xs">
            Value (USD) <span className="text-red-400">*</span>
          </Label>
          <Input
            type="number"
            id="value_amount"
            name="value_amount"
            defaultValue={initial ? String(initial.valueAmount) : ""}
            step="0.01"
            min="0"
            className="h-9 text-sm"
            required
          />
          {fieldErrors?.value_amount && (
            <p className="text-xs text-red-500">{fieldErrors.value_amount}</p>
          )}
        </div>

        <label className="inline-flex items-center gap-2 pb-2 cursor-pointer">
          <input
            type="checkbox"
            name="is_estimate"
            defaultChecked={initial?.isEstimate ?? false}
            className="w-4 h-4 rounded border-[#E8EFF5] text-[#15689E] focus:ring-[#15689E]"
          />
          <span className="text-xs text-[var(--text2)]">
            Value is an estimate (not actual cost)
          </span>
        </label>
      </div>
    </div>
  );
}
