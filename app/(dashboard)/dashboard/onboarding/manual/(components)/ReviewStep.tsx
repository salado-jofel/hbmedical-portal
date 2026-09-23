"use client";

import { FileCheck, Info } from "lucide-react";
import type { RepWithFacility } from "@/utils/interfaces/onboarding";
import type { ManualOnboardingForm } from "@/utils/interfaces/manual-onboarding";
import { OFFLINE_CONTRACTS } from "@/utils/constants/manual-onboarding";
import { CREDENTIAL_OPTIONS } from "@/utils/constants/auth";
import { formatDateOnPaper } from "@/utils/helpers/manual-onboarding";
import { WizardStepHeading } from "./WizardField";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <dt className="text-xs text-[var(--text3)] shrink-0">{label}</dt>
      <dd className="text-sm text-[var(--text1)] text-right break-words">{value || "—"}</dd>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text3)] mb-2">{title}</h3>
      <dl className="divide-y divide-[var(--border)]/60">{children}</dl>
    </div>
  );
}

export function ReviewStep({
  form,
  isAdmin,
  reps,
}: {
  form: ManualOnboardingForm;
  isAdmin: boolean;
  reps: RepWithFacility[];
}) {
  const rep = reps.find((r) => r.id === form.repId);
  const credential = CREDENTIAL_OPTIONS.find((c) => c.value === form.credential)?.label ?? "";
  const filledEnrollment = Object.values(form.enrollment).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <WizardStepHeading
        title="Review and create"
        description="Double-check the details. The clinic account is created immediately and the provider is emailed a link to set their password."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Group title="Provider">
          {isAdmin && <Row label="Assigned rep" value={rep ? `${rep.name} — ${rep.facilityName}` : ""} />}
          <Row label="Name" value={`${form.first_name} ${form.last_name}`.trim()} />
          <Row label="Email" value={form.email} />
          <Row label="Mobile" value={form.phone} />
          <Row label="Credential" value={credential} />
          <Row label="NPI" value={form.npi_number} />
        </Group>
        <Group title="Practice">
          <Row label="Name" value={form.office_name} />
          <Row label="Phone" value={form.office_phone} />
          <Row label="Address" value={form.office_address} />
          <Row label="City / State / ZIP" value={[form.office_city, form.office_state, form.office_postal_code].filter(Boolean).join(", ")} />
          <Row label="Enrollment form" value={`${filledEnrollment} field${filledEnrollment === 1 ? "" : "s"} filled`} />
        </Group>
      </div>

      <div className="rounded-xl border border-[var(--border)] p-4 space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text3)]">Signed agreements</h3>
        {OFFLINE_CONTRACTS.map((def) => {
          const c = form.contracts[def.key];
          return (
            <div key={def.key} className="flex items-start gap-3 py-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text1)]">{def.label}</p>
                <p className="text-xs text-[var(--text3)] truncate">
                  {c.fileName} · signed {formatDateOnPaper(c.signedOn)} by {c.signerName}, {c.signerTitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-2.5 bg-[#EFF6FF] border border-[var(--navy)]/20 rounded-xl px-4 py-3">
        <Info className="w-4 h-4 text-[var(--navy)] mt-0.5 shrink-0" />
        <p className="text-sm text-[var(--navy)]">
          The provider will set their own password from the email, verify their mobile number, and
          create their signing PIN on first login. Nobody at Meridian ever sees the password or PIN.
        </p>
      </div>
    </div>
  );
}
