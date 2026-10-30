// Medicare Administrative Contractors (MACs) — 7 companies CMS hires to
// administer Original Medicare fee-for-service across the U.S.
// Source: https://www.cms.gov/medicare/coding-billing/medicare-administrative-contractors-macs/who-are-macs

export const MEDICARE_MAC_OPTIONS = [
  { value: "palmetto_gba", label: "Palmetto GBA, LLC" },
  { value: "novitas", label: "Novitas Solutions, Inc." },
  { value: "noridian", label: "Noridian Healthcare Solutions, LLC" },
  { value: "ngs", label: "National Government Services, Inc." },
  { value: "cgs", label: "CGS Administrators, LLC" },
  { value: "fcso", label: "First Coast Service Options, Inc." },
  { value: "wps", label: "Wisconsin Physicians Service Government Health Administrators" },
] as const;

export type MedicareMacValue = (typeof MEDICARE_MAC_OPTIONS)[number]["value"];

/* facility_enrollment stores the slug ("palmetto_gba") while the IVR and the
   standalone IVR print the contractor's name, so anything copying enrollment
   onto a form has to translate. Returns null for an unknown or missing slug
   rather than printing the raw value — a slug on a payer form is worse than a
   blank the clinic can fill in. */
export function getMedicareMacLabel(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  return (
    MEDICARE_MAC_OPTIONS.find((option) => option.value === value)?.label ?? null
  );
}
