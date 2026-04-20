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
