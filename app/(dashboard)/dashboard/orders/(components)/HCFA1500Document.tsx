"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Trash2 } from "lucide-react";
import {
  upsertForm1500,
  getForm1500,
} from "../(services)/order-document-actions";
import { FormActionBar } from "./FormActionBar";
import { PdfBackground } from "./PdfBackground";
import { FormDeficiencyBanner } from "./FormDeficiencyBanner";
import { useFormCollaboration } from "./useFormCollaboration";
import { FormCollaborationStatus } from "./FormCollaborationStatus";
import type { IServiceLine, DashboardOrder } from "@/utils/interfaces/orders";
import { cn } from "@/utils/utils";
import toast from "react-hot-toast";
import fieldMap from "./cms1500-fields.json";

/*
 * ═══════════════════════════════════════════════════
 *  CMS-1500 FORM — PDF BACKGROUND + JSON FIELD MAP
 * ═══════════════════════════════════════════════════
 *
 *  public/cms-1500-fillable.pdf is rendered to canvas by pdfjs-dist.
 *  Field positions come from cms1500-fields.json — extracted directly
 *  from the PDF's AcroForm widget rectangles (already in %).
 *
 *  The same JSON positions used here are the same coordinates that
 *  pdf-lib uses when filling the PDF server-side.
 */

/* ══════════════════════════════════════════════════════════════════════ */
/*  FORM STATE TYPE                                                       */
/* ══════════════════════════════════════════════════════════════════════ */
type F = {
  insuranceType: string;
  insuredIdNumber: string;
  patientLastName: string;
  patientFirstName: string;
  patientMiddleInitial: string;
  patientDob: string;
  patientSex: string;
  insuredLastName: string;
  insuredFirstName: string;
  insuredMiddleInitial: string;
  patientAddress: string;
  patientCity: string;
  patientState: string;
  patientZip: string;
  patientPhone: string;
  patientRelationship: string;
  insuredAddress: string;
  insuredCity: string;
  insuredState: string;
  insuredZip: string;
  insuredPhone: string;
  otherInsuredName: string;
  otherInsuredPolicy: string;
  otherInsuredDob: string;
  otherInsuredSex: string;
  otherInsuredEmployer: string;
  otherInsuredPlan: string;
  conditionEmployment: boolean;
  conditionAutoAccident: boolean;
  conditionAutoState: string;
  conditionOtherAccident: boolean;
  insuredPolicyGroup: string;
  insuredDob: string;
  insuredSex: string;
  insuredEmployer: string;
  insuredPlanName: string;
  anotherHealthBenefit: boolean;
  patientSignature: string;
  patientSignatureDate: string;
  insuredSignature: string;
  illnessDate: string;
  illnessQualifier: string;
  otherDate: string;
  otherDateQualifier: string;
  unableWorkFrom: string;
  unableWorkTo: string;
  referringProviderName: string;
  referringProviderNpi: string;
  referringProviderQual: string;
  hospitalizationFrom: string;
  hospitalizationTo: string;
  additionalClaimInfo: string;
  outsideLab: boolean;
  outsideLabCharges: string;
  diagnosisA: string; diagnosisB: string; diagnosisC: string; diagnosisD: string;
  diagnosisE: string; diagnosisF: string; diagnosisG: string; diagnosisH: string;
  diagnosisI: string; diagnosisJ: string; diagnosisK: string; diagnosisL: string;
  resubmissionCode: string;
  originalRefNumber: string;
  priorAuthNumber: string;
  serviceLines: IServiceLine[];
  federalTaxId: string;
  taxIdSsn: boolean;
  patientAccountNumber: string;
  acceptAssignment: boolean;
  totalCharge: string;
  amountPaid: string;
  rsvdNucc: string;
  physicianSignature: string;
  physicianSignatureDate: string;
  physicianSignedAt: string | null;
  physicianSignedBy: string | null;
  serviceFacilityName: string;
  serviceFacilityAddress: string;
  serviceFacilityNpi: string;
  billingProviderName: string;
  billingProviderAddress: string;
  billingProviderPhone: string;
  billingProviderNpi: string;
  billingProviderTaxId: string;
  nuccUse: string;
  insuranceName: string;
  insuranceAddress: string;
  insuranceAddress2: string;
  insuranceCityStateZip: string;
  claimCodes: string;
  icdIndicator: string;
};

function emptyLine(idx: number): IServiceLine {
  return {
    id: `__empty_${idx}`,
    dos_from: "", dos_to: "", place_of_service: "", emg: false,
    cpt_code: "", modifier_1: "", modifier_2: "", modifier_3: "", modifier_4: "",
    diagnosis_pointer: "", charges: "", days_units: "", epsdt: "",
    id_qualifier: "", rendering_npi: "",
    suppl: "", service_type: "", family_plan: "",
  };
}

function buildFormState(d: Record<string, unknown> | null): F {
  const r = d ?? {};
  const sv = (k: string) => (r[k] as string) ?? "";
  const b  = (k: string) => !!(r[k] as boolean);
  return {
    insuranceType:         sv("insurance_type"),
    insuredIdNumber:       sv("insured_id_number"),
    patientLastName:       sv("patient_last_name"),
    patientFirstName:      sv("patient_first_name"),
    patientMiddleInitial:  sv("patient_middle_initial"),
    patientDob:            sv("patient_dob"),
    patientSex:            sv("patient_sex"),
    insuredLastName:       sv("insured_last_name"),
    insuredFirstName:      sv("insured_first_name"),
    insuredMiddleInitial:  sv("insured_middle_initial"),
    patientAddress:        sv("patient_address"),
    patientCity:           sv("patient_city"),
    patientState:          sv("patient_state"),
    patientZip:            sv("patient_zip"),
    patientPhone:          sv("patient_phone"),
    patientRelationship:   sv("patient_relationship"),
    insuredAddress:        sv("insured_address"),
    insuredCity:           sv("insured_city"),
    insuredState:          sv("insured_state"),
    insuredZip:            sv("insured_zip"),
    insuredPhone:          sv("insured_phone"),
    otherInsuredName:      sv("other_insured_name"),
    otherInsuredPolicy:    sv("other_insured_policy"),
    otherInsuredDob:       sv("other_insured_dob"),
    otherInsuredSex:       sv("other_insured_sex"),
    otherInsuredEmployer:  sv("other_insured_employer"),
    otherInsuredPlan:      sv("other_insured_plan"),
    conditionEmployment:   b("condition_employment"),
    conditionAutoAccident: b("condition_auto_accident"),
    conditionAutoState:    sv("condition_auto_state"),
    conditionOtherAccident: b("condition_other_accident"),
    insuredPolicyGroup:    sv("insured_policy_group"),
    insuredDob:            sv("insured_dob"),
    insuredSex:            sv("insured_sex"),
    insuredEmployer:       sv("insured_employer"),
    insuredPlanName:       sv("insured_plan_name"),
    anotherHealthBenefit:  b("another_health_benefit"),
    patientSignature:      sv("patient_signature"),
    patientSignatureDate:  sv("patient_signature_date"),
    insuredSignature:      sv("insured_signature"),
    illnessDate:           sv("illness_date"),
    illnessQualifier:      sv("illness_qualifier"),
    otherDate:             sv("other_date"),
    otherDateQualifier:    sv("other_date_qualifier"),
    unableWorkFrom:        sv("unable_work_from"),
    unableWorkTo:          sv("unable_work_to"),
    referringProviderName: sv("referring_provider_name"),
    referringProviderNpi:  sv("referring_provider_npi"),
    referringProviderQual: sv("referring_provider_qual"),
    hospitalizationFrom:   sv("hospitalization_from"),
    hospitalizationTo:     sv("hospitalization_to"),
    additionalClaimInfo:   sv("additional_claim_info"),
    outsideLab:            b("outside_lab"),
    outsideLabCharges:     sv("outside_lab_charges"),
    diagnosisA: sv("diagnosis_a"), diagnosisB: sv("diagnosis_b"),
    diagnosisC: sv("diagnosis_c"), diagnosisD: sv("diagnosis_d"),
    diagnosisE: sv("diagnosis_e"), diagnosisF: sv("diagnosis_f"),
    diagnosisG: sv("diagnosis_g"), diagnosisH: sv("diagnosis_h"),
    diagnosisI: sv("diagnosis_i"), diagnosisJ: sv("diagnosis_j"),
    diagnosisK: sv("diagnosis_k"), diagnosisL: sv("diagnosis_l"),
    resubmissionCode:      sv("resubmission_code"),
    originalRefNumber:     sv("original_ref_number"),
    priorAuthNumber:       sv("prior_auth_number"),
    serviceLines: (() => {
      const sl = [...((r["service_lines"] as IServiceLine[]) ?? [])];
      for (let i = sl.length; i < 6; i++) sl.push(emptyLine(i));
      return sl.slice(0, 6);
    })(),
    federalTaxId:          sv("federal_tax_id"),
    taxIdSsn:              b("tax_id_ssn"),
    patientAccountNumber:  sv("patient_account_number"),
    acceptAssignment:      b("accept_assignment"),
    totalCharge:           sv("total_charge"),
    amountPaid:            sv("amount_paid"),
    rsvdNucc:              sv("rsvd_nucc"),
    physicianSignature:    sv("physician_signature"),
    physicianSignatureDate: sv("physician_signature_date"),
    physicianSignedAt:     (r["physician_signed_at"] as string) ?? null,
    physicianSignedBy:     (r["physician_signed_by"] as string) ?? null,
    serviceFacilityName:   sv("service_facility_name"),
    serviceFacilityAddress: sv("service_facility_address"),
    serviceFacilityNpi:    sv("service_facility_npi"),
    billingProviderName:   sv("billing_provider_name"),
    billingProviderAddress: sv("billing_provider_address"),
    billingProviderPhone:  sv("billing_provider_phone"),
    billingProviderNpi:    sv("billing_provider_npi"),
    billingProviderTaxId:  sv("billing_provider_tax_id"),
    nuccUse:               sv("nucc_use"),
    insuranceName:         sv("insurance_name"),
    insuranceAddress:      sv("insurance_address"),
    insuranceAddress2:     sv("insurance_address2"),
    insuranceCityStateZip: sv("insurance_city_state_zip"),
    claimCodes:            sv("claim_codes"),
    icdIndicator:          sv("icd_indicator"),
  };
}

/* ══════════════════════════════════════════════════════════════════════ */
/*  PDF FIELD NAME ↔ FORM STATE MAPPINGS                                  */
/* ══════════════════════════════════════════════════════════════════════ */

/** 1-to-1 text field mappings: PDF field name → F key */
const SIMPLE: Record<string, keyof F> = {
  insurance_id:              "insuredIdNumber",
  pt_street:                 "patientAddress",
  pt_city:                   "patientCity",
  pt_state:                  "patientState",
  pt_zip:                    "patientZip",
  ins_street:                "insuredAddress",
  ins_city:                  "insuredCity",
  ins_state:                 "insuredState",
  ins_zip:                   "insuredZip",
  ins_policy:                "insuredPolicyGroup",
  other_ins_name:            "otherInsuredName",
  other_ins_policy:          "otherInsuredPolicy",
  other_ins_plan_name:       "otherInsuredPlan",
  ins_plan_name:             "insuredPlanName",
  pt_signature:              "patientSignature",
  pt_date:                   "patientSignatureDate",
  ins_signature:             "insuredSignature",
  accident_place:            "conditionAutoState",
  charge:                    "outsideLabCharges",
  medicaid_resub:            "resubmissionCode",
  original_ref:              "originalRefNumber",
  prior_auth:                "priorAuthNumber",
  tax_id:                    "federalTaxId",
  pt_account:                "patientAccountNumber",
  t_charge:                  "totalCharge",
  amt_paid:                  "amountPaid",
  physician_signature:       "physicianSignature",
  physician_date:            "physicianSignatureDate",
  fac_name:                  "serviceFacilityName",
  fac_street:                "serviceFacilityAddress",
  fac_location:              "serviceFacilityAddress",
  doc_name:                  "billingProviderName",
  doc_street:                "billingProviderAddress",
  doc_location:              "billingProviderAddress",
  pin:                       "billingProviderNpi",
  pin1:                      "serviceFacilityNpi",
  grp:                       "billingProviderTaxId",
  grp1:                      "serviceFacilityNpi",
  ref_physician:             "referringProviderName",
  "physician number 17a1":   "referringProviderQual",
  "physician number 17a":    "referringProviderNpi",
  id_physician:              "referringProviderNpi",
  "96":                      "additionalClaimInfo",
  "40":                      "otherInsuredDob",
  "41":                      "otherInsuredPlan",
  "57":                      "insuredEmployer",
  "58":                      "insuredEmployer",
  "73":                      "illnessQualifier",
  "74":                      "otherDateQualifier",
  "85":                      "referringProviderQual",
  diagnosis1: "diagnosisA",  diagnosis2:  "diagnosisB",
  diagnosis3: "diagnosisC",  diagnosis4:  "diagnosisD",
  diagnosis5: "diagnosisE",  diagnosis6:  "diagnosisF",
  diagnosis7: "diagnosisG",  diagnosis8:  "diagnosisH",
  diagnosis9: "diagnosisI",  diagnosis10: "diagnosisJ",
  diagnosis11:"diagnosisK",  diagnosis12: "diagnosisL",
  // Formerly local-only form-level fields
  "NUCC USE":                 "nuccUse",
  insurance_name:             "insuranceName",
  insurance_address:          "insuranceAddress",
  insurance_address2:         "insuranceAddress2",
  insurance_city_state_zip:   "insuranceCityStateZip",
  "50":                       "claimCodes",
  "99icd":                    "icdIndicator",
};

/** Date field splits: PDF field name → [F key, part] where part 0=MM, 1=DD, 2=YY */
const DATE_SPLITS: Record<string, [keyof F, 0 | 1 | 2]> = {
  birth_mm:     ["patientDob",        0], birth_dd:     ["patientDob",        1], birth_yy:     ["patientDob",        2],
  ins_dob_mm:   ["insuredDob",        0], ins_dob_dd:   ["insuredDob",        1], ins_dob_yy:   ["insuredDob",        2],
  cur_ill_mm:   ["illnessDate",       0], cur_ill_dd:   ["illnessDate",       1], cur_ill_yy:   ["illnessDate",       2],
  sim_ill_mm:   ["otherDate",         0], sim_ill_dd:   ["otherDate",         1], sim_ill_yy:   ["otherDate",         2],
  work_mm_from: ["unableWorkFrom",    0], work_dd_from: ["unableWorkFrom",    1], work_yy_from: ["unableWorkFrom",    2],
  work_mm_end:  ["unableWorkTo",      0], work_dd_end:  ["unableWorkTo",      1], work_yy_end:  ["unableWorkTo",      2],
  hosp_mm_from: ["hospitalizationFrom",0],hosp_dd_from: ["hospitalizationFrom",1],hosp_yy_from: ["hospitalizationFrom",2],
  hosp_mm_end:  ["hospitalizationTo", 0], hosp_dd_end:  ["hospitalizationTo", 1], hosp_yy_end:  ["hospitalizationTo", 2],
};

function getDatePart(iso: string, part: 0 | 1 | 2): string {
  const p = iso.split("-"); // [YYYY, MM, DD]
  if (p.length < 3) return "";
  if (part === 0) return p[1] ?? "";   // MM
  if (part === 1) return p[2] ?? "";   // DD
  return (p[0] ?? "").slice(-2);       // YY
}

function setDatePart(iso: string, part: 0 | 1 | 2, val: string): string {
  const p = iso ? iso.split("-") : ["", "", ""];
  while (p.length < 3) p.push("");
  if (part === 0) p[1] = val.padStart(2, "0");
  if (part === 1) p[2] = val.padStart(2, "0");
  if (part === 2) p[0] = val.length === 2 ? "20" + val : val;
  return p.join("-");
}

/** service line pattern: sv1_mm_from, cpt2, mod3a, diag4, ch5, day6, local1a, etc. */
const SL_RE = /^(sv|place|type|plan|cpt|mod|diag|ch|day|emg|epsdt|local)(\d+)(.*)?$/i;

/** Maps supplemental-info PDF field names to 0-based service line indices */
const SUPPL_MAP: Record<string, number> = {
  Suppl: 0, Suppla: 1, Supplb: 2, Supplc: 3, Suppld: 4, Supple: 5,
};

/**
 * Genuinely reserved/internal fields with no user-editable purpose.
 * NOTE: "Clear Form", "276", "135"–"245" are NOT in fieldMap.text at all
 * (276 is a radio group; the rest are PDF-internal buttons/markers).
 * SKIP_FIELDS is kept as an explicit allowlist for future additions.
 */
const SKIP_FIELDS = new Set<string>([]);

const PHONE_FIELDS = new Set(["pt_AreaCode","pt_phone","ins_phone area","ins_phone","doc_phone area","doc_phone"]);

/** Returns true if a PDF field name maps to persistent DB state */
function isPdfFieldMapped(name: string): boolean {
  if (SKIP_FIELDS.has(name)) return false;
  if (SIMPLE[name]) return true;
  if (name === "pt_name" || name === "ins_name") return true;
  if (DATE_SPLITS[name]) return true;
  if (PHONE_FIELDS.has(name)) return true;
  if (name in SUPPL_MAP) return true;
  if (SL_RE.test(name)) return true;
  return false;
}

type RadioOpt = { value: string; left: number; top: number; width: number; height: number };

/* ══════════════════════════════════════════════════════════════════════ */
/*  COMPONENT                                                              */
/* ══════════════════════════════════════════════════════════════════════ */
export function HCFA1500Document({
  order,
  canEdit,
  canSign,
  currentUserName,
  initialData,
  onDirtyChange,
  onSave,
}: {
  order: DashboardOrder;
  canEdit: boolean;
  canSign: boolean;
  currentUserName: string | null;
  initialData: Record<string, unknown> | null;
  onDirtyChange?: (dirty: boolean) => void;
  onSave?: (data: Record<string, unknown>) => void;
}) {
  const orderId = order.id;
  const [fd, setFd] = useState<F>(() => buildFormState(initialData));
  const [bl, setBl] = useState<F>(() => buildFormState(initialData));
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);
  // Tracks the `updated_at` the form was loaded with so we can detect remote
  // edits and submit it as `ifMatch` on save. Updated whenever we successfully
  // save or pull a fresh copy from the server.
  const [localUpdatedAt, setLocalUpdatedAt] = useState<string | null>(
    (initialData?.updated_at as string | null | undefined) ?? null,
  );

  const dirty = useMemo(() => JSON.stringify(fd) !== JSON.stringify(bl), [fd, bl]);
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty]); // eslint-disable-line

  // Realtime + presence — subscribes to UPDATEs on this order's row and
  // tracks who else has the form open.
  const collab = useFormCollaboration({
    table: "order_form_1500",
    channelKey: "hcfa",
    orderId,
    userName: currentUserName,
    localUpdatedAt,
  });

  const s = useCallback(<K extends keyof F>(k: K, v: F[K]) => {
    setFd((p) => ({ ...p, [k]: v }));
  }, []);
  const dis = !canEdit;

  const aiEx = !!(fd.patientFirstName || fd.patientLastName || fd.insuredIdNumber || fd.federalTaxId || fd.billingProviderName);

  /* ── Service line helpers ── */
  function rmLn(id: string) {
    s("serviceLines", fd.serviceLines.map((l, i) => (l.id === id ? emptyLine(i) : l)));
  }
  function upLnIdx(idx: number, f: keyof IServiceLine, v: string | boolean) {
    s("serviceLines", fd.serviceLines.map((l, i) => (i === idx ? { ...l, [f]: v } : l)));
  }

  /* ── PDF regeneration helper ── shared by save and reload so the
     "Generating…" blue badge on the document card lights up consistently
     in both flows. Dispatches the same `pdf-regenerating` events the
     OrderDetailModal listens for. Errors are returned, not thrown — the
     caller decides whether to surface a toast. */
  const regenerateHcfaPdf = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    window.dispatchEvent(
      new CustomEvent("pdf-regenerating", {
        detail: { type: "form_1500", status: "start" },
      }),
    );
    try {
      const pdfRes = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, formType: "hcfa_1500" }),
      });
      if (!pdfRes.ok) {
        return { ok: false, error: `PDF generation failed (${pdfRes.status})` };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Unknown" };
    } finally {
      window.dispatchEvent(
        new CustomEvent("pdf-regenerating", {
          detail: { type: "form_1500", status: "done" },
        }),
      );
    }
  }, [orderId]);

  /* ── Reload from server ── used by both the conflict banner and the
     silent auto-refresh when no local edits are in flight. The `reloading`
     flag drives the spinner on the conflict banner's Reload button. We
     also kick off a fresh PDF regen so the document card on the right
     side shows the "Generating…" blue state and ends up holding the
     latest rendered file. */
  const handleReload = useCallback(async () => {
    setReloading(true);
    try {
      const fresh = await getForm1500(orderId);
      const next = buildFormState(fresh as Record<string, unknown> | null);
      setFd(next);
      setBl(next);
      setLocalUpdatedAt(
        ((fresh as { updated_at?: string } | null | undefined)?.updated_at) ??
          null,
      );
      collab.acknowledgeRemoteChange();
      // Fire and forget — the document card listens for the regen events
      // independently. We don't need to block the form on PDF render.
      void regenerateHcfaPdf();
    } finally {
      setReloading(false);
    }
  }, [orderId, collab, regenerateHcfaPdf]);

  // Silent auto-refresh: when someone else saves and we have nothing
  // unsaved, just pull the latest. Banner is reserved for the dirty case
  // where blowing away local edits needs explicit confirmation.
  useEffect(() => {
    if (collab.remoteChangedSinceLoad && !dirty) {
      void handleReload();
    }
  }, [collab.remoteChangedSinceLoad, dirty, handleReload]);

  /* ── Save ── */
  async function save() {
    setSaving(true);
    const n = (v: string) => v.trim() || null;
    const p: Record<string, unknown> = {
      insurance_type: n(fd.insuranceType),
      insured_id_number: n(fd.insuredIdNumber),
      patient_last_name: n(fd.patientLastName),
      patient_first_name: n(fd.patientFirstName),
      patient_middle_initial: n(fd.patientMiddleInitial),
      patient_dob: n(fd.patientDob),
      patient_sex: n(fd.patientSex),
      insured_last_name: n(fd.insuredLastName),
      insured_first_name: n(fd.insuredFirstName),
      insured_middle_initial: n(fd.insuredMiddleInitial),
      patient_address: n(fd.patientAddress),
      patient_city: n(fd.patientCity),
      patient_state: n(fd.patientState),
      patient_zip: n(fd.patientZip),
      patient_phone: n(fd.patientPhone),
      patient_relationship: n(fd.patientRelationship),
      insured_address: n(fd.insuredAddress),
      insured_city: n(fd.insuredCity),
      insured_state: n(fd.insuredState),
      insured_zip: n(fd.insuredZip),
      insured_phone: n(fd.insuredPhone),
      other_insured_name: n(fd.otherInsuredName),
      other_insured_policy: n(fd.otherInsuredPolicy),
      other_insured_dob: n(fd.otherInsuredDob),
      other_insured_sex: n(fd.otherInsuredSex),
      other_insured_employer: n(fd.otherInsuredEmployer),
      other_insured_plan: n(fd.otherInsuredPlan),
      condition_employment: fd.conditionEmployment,
      condition_auto_accident: fd.conditionAutoAccident,
      condition_auto_state: n(fd.conditionAutoState),
      condition_other_accident: fd.conditionOtherAccident,
      insured_policy_group: n(fd.insuredPolicyGroup),
      insured_dob: n(fd.insuredDob),
      insured_sex: n(fd.insuredSex),
      insured_employer: n(fd.insuredEmployer),
      insured_plan_name: n(fd.insuredPlanName),
      another_health_benefit: fd.anotherHealthBenefit,
      patient_signature: n(fd.patientSignature),
      patient_signature_date: n(fd.patientSignatureDate),
      insured_signature: n(fd.insuredSignature),
      illness_date: n(fd.illnessDate),
      illness_qualifier: n(fd.illnessQualifier),
      other_date: n(fd.otherDate),
      other_date_qualifier: n(fd.otherDateQualifier),
      unable_work_from: n(fd.unableWorkFrom),
      unable_work_to: n(fd.unableWorkTo),
      referring_provider_name: n(fd.referringProviderName),
      referring_provider_npi: n(fd.referringProviderNpi),
      referring_provider_qual: n(fd.referringProviderQual),
      hospitalization_from: n(fd.hospitalizationFrom),
      hospitalization_to: n(fd.hospitalizationTo),
      additional_claim_info: n(fd.additionalClaimInfo),
      outside_lab: fd.outsideLab,
      outside_lab_charges: n(fd.outsideLabCharges),
      diagnosis_a: n(fd.diagnosisA), diagnosis_b: n(fd.diagnosisB),
      diagnosis_c: n(fd.diagnosisC), diagnosis_d: n(fd.diagnosisD),
      diagnosis_e: n(fd.diagnosisE), diagnosis_f: n(fd.diagnosisF),
      diagnosis_g: n(fd.diagnosisG), diagnosis_h: n(fd.diagnosisH),
      diagnosis_i: n(fd.diagnosisI), diagnosis_j: n(fd.diagnosisJ),
      diagnosis_k: n(fd.diagnosisK), diagnosis_l: n(fd.diagnosisL),
      resubmission_code: n(fd.resubmissionCode),
      original_ref_number: n(fd.originalRefNumber),
      prior_auth_number: n(fd.priorAuthNumber),
      service_lines: fd.serviceLines.filter(
        (l) => l.cpt_code.trim() || l.dos_from.trim() || String(l.charges ?? "").trim()
      ),
      federal_tax_id: n(fd.federalTaxId),
      tax_id_ssn: fd.taxIdSsn,
      patient_account_number: n(fd.patientAccountNumber),
      accept_assignment: fd.acceptAssignment,
      total_charge: n(fd.totalCharge),
      amount_paid: n(fd.amountPaid),
      rsvd_nucc: n(fd.rsvdNucc),
      physician_signature: n(fd.physicianSignature),
      physician_signature_date: n(fd.physicianSignatureDate),
      physician_signed_at: fd.physicianSignedAt ?? null,
      physician_signed_by: fd.physicianSignedBy ?? null,
      service_facility_name: n(fd.serviceFacilityName),
      service_facility_address: n(fd.serviceFacilityAddress),
      service_facility_npi: n(fd.serviceFacilityNpi),
      billing_provider_name: n(fd.billingProviderName),
      billing_provider_address: n(fd.billingProviderAddress),
      billing_provider_phone: n(fd.billingProviderPhone),
      billing_provider_npi: n(fd.billingProviderNpi),
      billing_provider_tax_id: n(fd.billingProviderTaxId),
      nucc_use: n(fd.nuccUse),
      insurance_name: n(fd.insuranceName),
      insurance_address: n(fd.insuranceAddress),
      insurance_address2: n(fd.insuranceAddress2),
      insurance_city_state_zip: n(fd.insuranceCityStateZip),
      claim_codes: n(fd.claimCodes),
      icd_indicator: n(fd.icdIndicator),
    };
    const res = await upsertForm1500(orderId, p, localUpdatedAt);
    if (!res.success) {
      setSaving(false);
      if (res.conflict) {
        // Someone else saved while we were editing. Tell the user; keep
        // their local edits intact so they can choose to reload manually.
        toast.error(
          res.error ?? "Someone else just saved this form. Reload to see their changes.",
        );
      } else {
        toast.error(res.error ?? "Failed to save.");
      }
      return;
    }

    setBl({ ...fd });
    if (res.updatedAt) setLocalUpdatedAt(res.updatedAt);
    onSave?.(p);

    // Regenerate PDF — awaited so the document is ready before setSaving(false).
    const pdf = await regenerateHcfaPdf();
    if (pdf.ok) {
      toast.success("HCFA-1500 saved.");
    } else {
      // Form data IS saved; only the PDF render failed. Tell the user both.
      console.error("[HCFA1500] PDF gen failed:", pdf.error);
      toast.success("HCFA-1500 saved.");
      toast.error("PDF could not be regenerated — try again.");
    }
    setSaving(false);
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  /*  PDF FIELD ↔ STATE BRIDGE                                             */
  /* ══════════════════════════════════════════════════════════════════════ */

  function getValueForPdfField(name: string): string {
    // 1. Direct mapping
    if (SIMPLE[name]) return (fd[SIMPLE[name]] as string) ?? "";

    // 2. Composite name fields
    if (name === "pt_name")
      return [fd.patientLastName, fd.patientFirstName, fd.patientMiddleInitial].filter(Boolean).join(", ");
    if (name === "ins_name")
      return [fd.insuredLastName, fd.insuredFirstName, fd.insuredMiddleInitial].filter(Boolean).join(", ");

    // 3. Date splits
    if (DATE_SPLITS[name]) {
      const [field, part] = DATE_SPLITS[name];
      return getDatePart((fd[field] as string) ?? "", part);
    }

    // 4. Phone splits
    const digits = (v: string) => v.replace(/\D/g, "");
    if (name === "pt_AreaCode")    return digits(fd.patientPhone).slice(0, 3);
    if (name === "pt_phone")       return digits(fd.patientPhone).slice(3);
    if (name === "ins_phone area") return digits(fd.insuredPhone).slice(0, 3);
    if (name === "ins_phone")      return digits(fd.insuredPhone).slice(3);
    if (name === "doc_phone area") return digits(fd.billingProviderPhone).slice(0, 3);
    if (name === "doc_phone")      return digits(fd.billingProviderPhone).slice(3);

    // 5. Supplemental info fields (Suppl, Suppla–Supple → service line suppl)
    if (name in SUPPL_MAP) return fd.serviceLines[SUPPL_MAP[name]]?.suppl ?? "";

    // 6. Service line fields
    const m = name.match(SL_RE);
    if (m) {
      const idx    = parseInt(m[2]) - 1;
      const prefix = m[1].toLowerCase();
      const suffix = (m[3] ?? "").toLowerCase();
      const line   = fd.serviceLines[idx];
      if (!line) return "";
      if (prefix === "sv") {
        const isEnd  = suffix.includes("_end") || suffix.includes("mm_end") || suffix.includes("dd_end") || suffix.includes("yy_end");
        const field  = isEnd ? line.dos_to : line.dos_from;
        if (suffix.includes("mm")) return getDatePart(field, 0);
        if (suffix.includes("dd")) return getDatePart(field, 1);
        if (suffix.includes("yy")) return getDatePart(field, 2);
        return "";
      }
      if (prefix === "place")  return line.place_of_service ?? "";
      if (prefix === "cpt")    return line.cpt_code ?? "";
      if (prefix === "mod") {
        if (!suffix)       return line.modifier_1 ?? "";
        if (suffix === "a") return line.modifier_2 ?? "";
        if (suffix === "b") return line.modifier_3 ?? "";
        if (suffix === "c") return line.modifier_4 ?? "";
      }
      if (prefix === "diag")   return line.diagnosis_pointer ?? "";
      if (prefix === "ch")     return String(line.charges ?? "");
      if (prefix === "day")    return String(line.days_units ?? "");
      if (prefix === "emg")    return line.emg ? "Y" : "";
      if (prefix === "epsdt")  return line.epsdt ?? "";
      if (prefix === "type")   return line.service_type ?? "";
      if (prefix === "plan")   return line.family_plan ?? "";
      if (prefix === "local")  {
        if (suffix === "a") return line.id_qualifier ?? "";
        return line.rendering_npi ?? "";
      }
    }

    return "";
  }

  /* Count empty active text widgets — matches the yellow highlight count exactly */
  const defCt = !aiEx ? 0 : (fieldMap.text as Array<{ name: string; width: number }>)
    .filter((f) => f.width > 0.3 && isPdfFieldMapped(f.name) && !getValueForPdfField(f.name).trim())
    .length;

  function setValueForPdfField(name: string, val: string) {
    // 1. Direct mapping
    if (SIMPLE[name]) { s(SIMPLE[name], val as never); return; }

    // 2. Composite name fields
    if (name === "pt_name") {
      const p = val.split(",").map((x) => x.trim());
      s("patientLastName", p[0] ?? "");
      s("patientFirstName", p[1] ?? "");
      s("patientMiddleInitial", p[2] ?? "");
      return;
    }
    if (name === "ins_name") {
      const p = val.split(",").map((x) => x.trim());
      s("insuredLastName", p[0] ?? "");
      s("insuredFirstName", p[1] ?? "");
      s("insuredMiddleInitial", p[2] ?? "");
      return;
    }

    // 3. Date splits
    if (DATE_SPLITS[name]) {
      const [field, part] = DATE_SPLITS[name];
      s(field, setDatePart((fd[field] as string) ?? "", part, val) as never);
      return;
    }

    // 4. Phone splits
    if (name === "pt_AreaCode" || name === "pt_phone") {
      const d = fd.patientPhone.replace(/\D/g, "");
      const ac = name === "pt_AreaCode" ? val.replace(/\D/g, "") : d.slice(0, 3);
      const ph = name === "pt_phone"    ? val.replace(/\D/g, "") : d.slice(3);
      s("patientPhone", ac + ph);
      return;
    }
    if (name === "ins_phone area" || name === "ins_phone") {
      const d = fd.insuredPhone.replace(/\D/g, "");
      const ac = name === "ins_phone area" ? val.replace(/\D/g, "") : d.slice(0, 3);
      const ph = name === "ins_phone"      ? val.replace(/\D/g, "") : d.slice(3);
      s("insuredPhone", ac + ph);
      return;
    }
    if (name === "doc_phone area" || name === "doc_phone") {
      const d = fd.billingProviderPhone.replace(/\D/g, "");
      const ac = name === "doc_phone area" ? val.replace(/\D/g, "") : d.slice(0, 3);
      const ph = name === "doc_phone"      ? val.replace(/\D/g, "") : d.slice(3);
      s("billingProviderPhone", ac + ph);
      return;
    }

    // 5. Supplemental info fields
    if (name in SUPPL_MAP) { upLnIdx(SUPPL_MAP[name], "suppl", val); return; }

    // 6. Service line fields
    const m = name.match(SL_RE);
    if (m) {
      const idx    = parseInt(m[2]) - 1;
      const prefix = m[1].toLowerCase();
      const suffix = (m[3] ?? "").toLowerCase();
      if (idx < 0 || idx > 5) return;

      if (prefix === "sv") {
        const isEnd  = suffix.includes("_end") || suffix.includes("mm_end") || suffix.includes("dd_end") || suffix.includes("yy_end");
        const fld    = isEnd ? "dos_to" : "dos_from";
        const current = (fd.serviceLines[idx]?.[fld] as string) ?? "";
        let part: 0|1|2 = 0;
        if (suffix.includes("mm")) part = 0;
        else if (suffix.includes("dd")) part = 1;
        else if (suffix.includes("yy")) part = 2;
        upLnIdx(idx, fld, setDatePart(current, part, val));
        return;
      }
      if (prefix === "place")  { upLnIdx(idx, "place_of_service",  val); return; }
      if (prefix === "cpt")    { upLnIdx(idx, "cpt_code",          val); return; }
      if (prefix === "mod") {
        if (!suffix)       { upLnIdx(idx, "modifier_1", val); return; }
        if (suffix === "a") { upLnIdx(idx, "modifier_2", val); return; }
        if (suffix === "b") { upLnIdx(idx, "modifier_3", val); return; }
        if (suffix === "c") { upLnIdx(idx, "modifier_4", val); return; }
      }
      if (prefix === "diag")   { upLnIdx(idx, "diagnosis_pointer", val); return; }
      if (prefix === "ch")     { upLnIdx(idx, "charges",           val); return; }
      if (prefix === "day")    { upLnIdx(idx, "days_units",        val); return; }
      if (prefix === "emg")    { upLnIdx(idx, "emg",           val === "Y"); return; }
      if (prefix === "epsdt")  { upLnIdx(idx, "epsdt",             val); return; }
      if (prefix === "type")   { upLnIdx(idx, "service_type",      val); return; }
      if (prefix === "plan")   { upLnIdx(idx, "family_plan",       val); return; }
      if (prefix === "local")  {
        if (suffix === "a") { upLnIdx(idx, "id_qualifier",  val); return; }
        upLnIdx(idx, "rendering_npi", val);
        return;
      }
    }
  }

  function isRadioChecked(group: string, optVal: string): boolean {
    switch (group) {
      case "insurance_type": {
        const m: Record<string, string> = {
          Medicare: "medicare", Medicaid: "medicaid", Tricare: "tricare",
          Champva: "champva", Group: "group_health_plan", Feca: "feca_blk_lung", Other: "other",
        };
        return fd.insuranceType === (m[optVal] ?? "");
      }
      case "sex":
        return (optVal === "M" && fd.patientSex === "male") || (optVal === "F" && fd.patientSex === "female");
      case "rel_to_ins": {
        const m: Record<string, string> = { S: "self", M: "spouse", C: "child", O: "other" };
        return fd.patientRelationship === (m[optVal] ?? "");
      }
      case "ins_sex":
        return (optVal === "MALE" && fd.insuredSex === "male") || (optVal === "FEMALE" && fd.insuredSex === "female");
      case "employment":      return (optVal === "YES") === fd.conditionEmployment;
      case "pt_auto_accident":return (optVal === "YES") === fd.conditionAutoAccident;
      case "other_accident":  return (optVal === "YES") === fd.conditionOtherAccident;
      case "ins_benefit_plan":return (optVal === "YES") === fd.anotherHealthBenefit;
      case "lab":             return (optVal === "YES") === fd.outsideLab;
      case "assignment":      return (optVal === "YES") === fd.acceptAssignment;
      case "ssn":             return (optVal === "SSN") === fd.taxIdSsn;
      default:                return false;
    }
  }

  function handleRadioClick(group: string, optVal: string) {
    switch (group) {
      case "insurance_type": {
        const m: Record<string, string> = {
          Medicare: "medicare", Medicaid: "medicaid", Tricare: "tricare",
          Champva: "champva", Group: "group_health_plan", Feca: "feca_blk_lung", Other: "other",
        };
        s("insuranceType", m[optVal] ?? optVal.toLowerCase());
        break;
      }
      case "sex":            s("patientSex",          optVal === "M" ? "male" : "female"); break;
      case "rel_to_ins": {
        const m: Record<string, string> = { S: "self", M: "spouse", C: "child", O: "other" };
        s("patientRelationship", m[optVal] ?? "");
        break;
      }
      case "ins_sex":        s("insuredSex",          optVal === "MALE" ? "male" : "female"); break;
      case "employment":     s("conditionEmployment",  optVal === "YES"); break;
      case "pt_auto_accident":s("conditionAutoAccident",optVal === "YES"); break;
      case "other_accident": s("conditionOtherAccident",optVal === "YES"); break;
      case "ins_benefit_plan":s("anotherHealthBenefit", optVal === "YES"); break;
      case "lab":            s("outsideLab",           optVal === "YES"); break;
      case "assignment":     s("acceptAssignment",     optVal === "YES"); break;
      case "ssn":            s("taxIdSsn",             optVal === "SSN"); break;
    }
  }

  /* ── Find the right-edge of the last field in each service line row ── */
  function lineDeletePos(lineNum: number) {
    const local = fieldMap.text.find((f) => f.name === `local${lineNum}`);
    return local ? { top: local.top, left: local.left + local.width + 0.3 } : null;
  }

  /* ══════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                */
  /* ══════════════════════════════════════════════════════════════════════ */
  return (
    <div className="relative">
      <style>{`
        .hcfa-filled:hover { background: rgba(191, 219, 254, 0.6) !important; }
        .hcfa-filled:focus { background: rgba(191, 219, 254, 0.7) !important; outline: 1px solid rgba(59, 130, 246, 0.4); }
        .hcfa-empty:hover  { background: rgba(252, 211, 77,  0.7) !important; }
        .hcfa-empty:focus  { background: rgba(252, 211, 77,  0.8) !important; outline: 1px solid rgba(217, 119, 6, 0.5); }
      `}</style>
      <FormActionBar
        label="HCFA/1500"
        isDirty={dirty && canEdit}
        isPending={saving}
        onSave={save}
        onDiscard={() => setFd({ ...bl })}
      />

      <FormCollaborationStatus
        viewers={collab.viewers}
        conflict={collab.remoteChangedSinceLoad && dirty}
        reloading={reloading}
        onReload={handleReload}
      />
      <FormDeficiencyBanner aiExtracted={aiEx} deficiencyCount={defCt} />

      {/* PDF skeleton shown until the canvas finishes rendering */}
      {!pdfReady && (
        <div className="mx-auto animate-pulse" style={{ maxWidth: 1400 }}>
          <div className="bg-gray-100 rounded" style={{ aspectRatio: "612 / 792", width: "100%" }}>
            <div className="p-6 space-y-3 h-full">
              {Array.from({ length: 28 }).map((_, i) => (
                <div key={i} className="h-3 bg-gray-200 rounded" style={{ width: `${60 + (i % 5) * 8}%` }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto" style={{ maxWidth: 1400, display: pdfReady ? undefined : "none" }}>
        <div className="relative inline-block w-full">
          <PdfBackground pdfUrl="/cms-1500-fillable.pdf" onReady={() => setPdfReady(true)} />

          <div className="absolute inset-0" style={{ zIndex: 2 }}>

            {/* ── TEXT FIELDS (from JSON, all 233 AcroForm text widgets) ── */}
            {(fieldMap.text as Array<{ name: string; left: number; top: number; width: number; height: number }>)
              .filter((f) => f.width > 0.3)
              .map((f) => {
                const isActive = isPdfFieldMapped(f.name);
                const val      = getValueForPdfField(f.name);
                const isEmpty  = isActive && !val.trim();
                const bg = !isActive ? "transparent"
                         : isEmpty   ? "rgba(254, 243, 199, 0.55)"
                         :             "rgba(219, 234, 254, 0.45)";
                const title = !isActive ? "This field is not used on this form" : undefined;
                return (
                  <input
                    key={f.name}
                    value={val}
                    onChange={(e) => setValueForPdfField(f.name, e.target.value)}
                    disabled={dis || !isActive}
                    title={title}
                    className={cn(
                      "absolute outline-none",
                      isActive && (isEmpty ? "hcfa-empty" : "hcfa-filled"),
                    )}
                    style={{
                      left:       `${f.left}%`,
                      top:        `${f.top}%`,
                      width:      `${f.width}%`,
                      height:     `${f.height}%`,
                      fontSize:   f.height > 2 ? 10 : 8,
                      fontFamily: "'Courier New', Courier, monospace",
                      color:      "#000",
                      background: bg,
                      border:     "none",
                      padding:    "0 1px",
                      boxSizing:  "border-box",
                      zIndex:     2,
                      opacity:    isActive ? 1 : 0.3,
                      cursor:     isActive && canEdit ? "text" : "default",
                    }}
                  />
                );
              })}

            {/* ── RADIO / CHECKBOX GROUPS (from JSON, 12 groups) ── */}
            {(Object.entries(fieldMap.radios) as [string, RadioOpt[]][]).map(([group, opts]) =>
              opts.map((opt) => {
                const checked = isRadioChecked(group, opt.value);
                return (
                  <div
                    key={`${group}-${opt.value}`}
                    onClick={() => !dis && handleRadioClick(group, opt.value)}
                    className={cn(
                      "absolute flex items-center justify-center select-none",
                      dis ? "cursor-default" : "cursor-pointer",
                    )}
                    style={{
                      left:       `${opt.left}%`,
                      top:        `${opt.top}%`,
                      width:      `${opt.width}%`,
                      height:     `${opt.height}%`,
                      fontFamily: "monospace",
                      fontWeight: 900,
                      fontSize:   10,
                      color:      "#000",
                      zIndex:     3,
                      background: canEdit ? "rgba(219, 234, 254, 0.45)" : "transparent",
                    }}
                  >
                    {checked ? "X" : ""}
                  </div>
                );
              })
            )}

            {/* ── SERVICE LINE CLEAR BUTTONS ── */}
            {fd.serviceLines.map((line, i) => {
              const pos = lineDeletePos(i + 1);
              if (!pos || !canEdit) return null;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => rmLn(line.id)}
                  className="absolute text-red-400 hover:text-red-600"
                  style={{
                    top:    `${pos.top}%`,
                    left:   `${pos.left}%`,
                    zIndex: 5,
                  }}
                >
                  <Trash2 style={{ width: 12, height: 12 }} />
                </button>
              );
            })}

          </div>
        </div>
      </div>

      {/* Box 31 (physician signature) is intentionally not surfaced here.
          The biller handles signing in their billing software (signature on
          file or wet signature on print) — we never collect a per-claim
          signature in the portal. */}
    </div>
  );
}
