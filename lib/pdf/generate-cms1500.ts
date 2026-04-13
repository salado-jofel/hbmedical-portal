"use server";

import { PDFDocument, PDFButton, StandardFonts, rgb } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

/* ── Radio button position map (% of page, extracted from PDF AcroForm) ──── */
type RadioOpt = { value: string; left: number; top: number; width: number; height: number };
const RADIO_POSITIONS: Record<string, RadioOpt[]> = {
  insurance_type: [
    { value: "Medicare", left: 3.414,  top: 13.653, width: 1.65,  height: 1.275 },
    { value: "Medicaid", left: 11.317, top: 13.643, width: 1.65,  height: 1.275 },
    { value: "Tricare",  left: 19.599, top: 13.679, width: 1.65,  height: 1.275 },
    { value: "Champva",  left: 30.202, top: 13.643, width: 1.65,  height: 1.275 },
    { value: "Group",    left: 38.453, top: 13.643, width: 1.65,  height: 1.275 },
    { value: "Feca",     left: 47.825, top: 13.643, width: 1.65,  height: 1.275 },
    { value: "Other",    left: 54.907, top: 13.679, width: 1.65,  height: 1.275 },
  ],
  sex: [
    { value: "M", left: 51.378, top: 16.655, width: 1.653, height: 1.267 },
    { value: "F", left: 57.236, top: 16.655, width: 1.653, height: 1.267 },
  ],
  rel_to_ins: [
    { value: "S", left: 40.835, top: 19.761, width: 1.652, height: 1.276 },
    { value: "M", left: 46.736, top: 19.765, width: 1.652, height: 1.276 },
    { value: "C", left: 51.389, top: 19.786, width: 1.652, height: 1.277 },
    { value: "O", left: 57.304, top: 19.708, width: 1.652, height: 1.276 },
  ],
  ins_sex: [
    { value: "MALE",   left: 82.016, top: 31.859, width: 1.642, height: 1.267 },
    { value: "FEMALE", left: 90.384, top: 31.922, width: 1.644, height: 1.273 },
  ],
  employment: [
    { value: "YES", left: 43.157, top: 31.868, width: 1.652, height: 1.276 },
    { value: "NO",  left: 50.322, top: 31.913, width: 1.652, height: 1.276 },
  ],
  pt_auto_accident: [
    { value: "YES", left: 43.281, top: 34.889, width: 1.652, height: 1.276 },
    { value: "NO",  left: 50.446, top: 34.934, width: 1.652, height: 1.277 },
  ],
  other_accident: [
    { value: "YES", left: 43.197, top: 37.823, width: 1.652, height: 1.276 },
    { value: "NO",  left: 50.362, top: 37.868, width: 1.652, height: 1.276 },
  ],
  ins_benefit_plan: [
    { value: "YES", left: 63.098, top: 40.956, width: 1.652, height: 1.266 },
    { value: "NO",  left: 69.033, top: 40.987, width: 1.652, height: 1.266 },
  ],
  lab: [
    { value: "YES", left: 63.258, top: 56.122, width: 1.654, height: 1.264 },
    { value: "NO",  left: 69.181, top: 56.107, width: 1.647, height: 1.259 },
  ],
  ssn: [
    { value: "SSN", left: 22.258, top: 86.363, width: 1.655, height: 1.279 },
    { value: "EIN", left: 24.536, top: 86.399, width: 1.655, height: 1.275 },
  ],
  assignment: [
    { value: "YES", left: 46.912, top: 86.418, width: 1.652, height: 1.275 },
    { value: "NO",  left: 52.743, top: 86.43,  width: 1.659, height: 1.277 },
  ],
};

export async function generateFilledCMS1500(
  data: Record<string, unknown>
): Promise<Uint8Array> {
  const templatePath = path.join(process.cwd(), "public", "cms-1500-fillable.pdf");
  const templateBytes = await fs.readFile(templatePath);
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  /* Track each radio selection so we can draw X marks after flatten */
  const selectedRadios = new Map<string, string>();

  // ── Helpers ──────────────────────────────────────────────────────────────

  function t(fieldName: string, value: unknown) {
    if (!value) return;
    try {
      form.getTextField(fieldName).setText(String(value).toUpperCase());
    } catch {}
  }

  function radio(groupName: string, value: string | null | undefined) {
    if (!value) return;
    // Record for direct drawing regardless of AcroForm success
    selectedRadios.set(groupName, value);
    try {
      form.getRadioGroup(groupName).select(value);
    } catch (err) {
      console.error(`[CMS1500] radio "${groupName}" select("${value}") failed:`, err);
    }
  }

  function splitDate(dateStr: unknown): [string, string, string] {
    const s = String(dateStr ?? "");
    if (!s) return ["", "", ""];
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return [iso[2], iso[3], iso[1].slice(-2)];
    const us = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (us) return [us[1], us[2], us[3].slice(-2)];
    return ["", "", ""];
  }

  function splitPhone(phone: unknown): [string, string] {
    const s = String(phone ?? "").replace(/\D/g, "");
    if (s.length >= 10) {
      const start = s.length === 11 ? 1 : 0;
      return [s.slice(start, start + 3), s.slice(start + 3)];
    }
    return ["", s];
  }

  const d = data;
  const sv = (k: string) => String(d[k] ?? "");

  // ═══ Carrier block (top of form) ════════════════════════════════════════
  t("insurance_name",           d.insurance_name);
  t("insurance_address",        d.insurance_address);
  t("insurance_address2",       d.insurance_address2);
  t("insurance_city_state_zip", d.insurance_city_state_zip);

  // ═══ BOX 8: Reserved for NUCC Use ════════════════════════════════════════
  t("NUCC USE", d.nucc_use);

  // ═══ BOX 1: Insurance Type ═══════════════════════════════════════════════
  const insMap: Record<string, string> = {
    medicare:          "Medicare",
    medicaid:          "Medicaid",
    tricare:           "Tricare",
    champva:           "Champva",
    group_health_plan: "Group",
    feca_blk_lung:     "Feca",
    other:             "Other",
  };
  const insType = sv("insurance_type");
  if (insType && insMap[insType]) radio("insurance_type", insMap[insType]);

  // ═══ BOX 1a: Insured ID ══════════════════════════════════════════════════
  t("insurance_id", d.insured_id_number);

  // ═══ BOX 2: Patient Name ═════════════════════════════════════════════════
  const ptName = [sv("patient_last_name"), sv("patient_first_name"), sv("patient_middle_initial")]
    .filter(Boolean).join(", ");
  t("pt_name", ptName || null);

  // ═══ BOX 3: Patient DOB + Sex ════════════════════════════════════════════
  const [ptMM, ptDD, ptYY] = splitDate(d.patient_dob);
  t("birth_mm", ptMM); t("birth_dd", ptDD); t("birth_yy", ptYY);
  if (sv("patient_sex") === "male")   radio("sex", "M");
  if (sv("patient_sex") === "female") radio("sex", "F");

  // ═══ BOX 4: Insured Name ═════════════════════════════════════════════════
  const insName = [sv("insured_last_name"), sv("insured_first_name"), sv("insured_middle_initial")]
    .filter(Boolean).join(", ");
  t("ins_name", insName || null);

  // ═══ BOX 5: Patient Address ══════════════════════════════════════════════
  t("pt_street",   d.patient_address);
  t("pt_city",     d.patient_city);
  t("pt_state",    d.patient_state);
  t("pt_zip",      d.patient_zip);
  const [ptAC, ptPh] = splitPhone(d.patient_phone);
  t("pt_AreaCode", ptAC); t("pt_phone", ptPh);

  // ═══ BOX 6: Patient Relationship ════════════════════════════════════════
  const relMap: Record<string, string> = {
    self: "S", spouse: "M", child: "C", other: "O",
  };
  const rel = sv("patient_relationship");
  if (rel && relMap[rel]) radio("rel_to_ins", relMap[rel]);

  // ═══ BOX 7: Insured Address ══════════════════════════════════════════════
  t("ins_street",  d.insured_address);
  t("ins_city",    d.insured_city);
  t("ins_state",   d.insured_state);
  t("ins_zip",     d.insured_zip);
  const [insAC, insPh] = splitPhone(d.insured_phone);
  t("ins_phone area", insAC); t("ins_phone", insPh);

  // ═══ BOX 9: Other Insured ════════════════════════════════════════════════
  t("other_ins_name",   d.other_insured_name);
  t("other_ins_policy", d.other_insured_policy);

  // ═══ BOX 10a: Employment ════════════════════════════════════════════════
  radio("employment",       d.condition_employment    ? "YES" : "NO");

  // ═══ BOX 10b: Auto Accident ══════════════════════════════════════════════
  radio("pt_auto_accident", d.condition_auto_accident ? "YES" : "NO");
  t("accident_place", d.condition_auto_state);

  // ═══ BOX 10c: Other Accident ════════════════════════════════════════════
  radio("other_accident",   d.condition_other_accident ? "YES" : "NO");

  // ═══ BOX 11: Insured Policy Group ═══════════════════════════════════════
  t("ins_policy", d.insured_policy_group);

  // ═══ BOX 11a: Insured DOB + Sex ══════════════════════════════════════════
  const [iMM, iDD, iYY] = splitDate(d.insured_dob);
  t("ins_dob_mm", iMM); t("ins_dob_dd", iDD); t("ins_dob_yy", iYY);
  if (sv("insured_sex") === "male")   radio("ins_sex", "MALE");
  if (sv("insured_sex") === "female") radio("ins_sex", "FEMALE");

  // ═══ BOX 11b: Employer ═══════════════════════════════════════════════════
  t("58", d.insured_employer);

  // ═══ BOX 11c: Insurance Plan Name ═══════════════════════════════════════
  t("ins_plan_name", d.insured_plan_name);

  // ═══ BOX 11d: Another Health Benefit ════════════════════════════════════
  radio("ins_benefit_plan", d.another_health_benefit ? "YES" : "NO");

  // ═══ BOX 9d: Other Insurance Plan ═══════════════════════════════════════
  t("other_ins_plan_name", d.other_insured_plan);

  // ═══ BOX 12: Patient Signature + Date ═══════════════════════════════════
  t("pt_signature", d.patient_signature);
  t("pt_date",      d.patient_signature_date);

  // ═══ BOX 13: Insured Signature ══════════════════════════════════════════
  t("ins_signature", d.insured_signature);

  // ═══ BOX 14: Illness Date ════════════════════════════════════════════════
  const [ilMM, ilDD, ilYY] = splitDate(d.illness_date);
  t("cur_ill_mm", ilMM); t("cur_ill_dd", ilDD); t("cur_ill_yy", ilYY);
  t("73", d.illness_qualifier);

  // ═══ BOX 15: Other Date ══════════════════════════════════════════════════
  const [oMM, oDD, oYY] = splitDate(d.other_date);
  t("sim_ill_mm", oMM); t("sim_ill_dd", oDD); t("sim_ill_yy", oYY);

  // ═══ BOX 16: Unable to Work ══════════════════════════════════════════════
  const [wfMM, wfDD, wfYY] = splitDate(d.unable_work_from);
  t("work_mm_from", wfMM); t("work_dd_from", wfDD); t("work_yy_from", wfYY);
  const [weMM, weDD, weYY] = splitDate(d.unable_work_to);
  t("work_mm_end", weMM); t("work_dd_end", weDD); t("work_yy_end", weYY);

  // ═══ BOX 17: Referring Provider ══════════════════════════════════════════
  t("ref_physician",         d.referring_provider_name);
  t("physician number 17a1", d.referring_provider_qual);
  t("physician number 17a",  d.referring_provider_npi);
  t("id_physician",          d.referring_provider_npi);

  // ═══ BOX 18: Hospitalization ═════════════════════════════════════════════
  const [hfMM, hfDD, hfYY] = splitDate(d.hospitalization_from);
  t("hosp_mm_from", hfMM); t("hosp_dd_from", hfDD); t("hosp_yy_from", hfYY);
  const [heMM, heDD, heYY] = splitDate(d.hospitalization_to);
  t("hosp_mm_end", heMM); t("hosp_dd_end", heDD); t("hosp_yy_end", heYY);

  // ═══ BOX 19: Additional Claim Info ══════════════════════════════════════
  t("96", d.additional_claim_info);

  // ═══ BOX 20: Outside Lab ═════════════════════════════════════════════════
  radio("lab", d.outside_lab ? "YES" : "NO");
  t("charge", d.outside_lab_charges);

  // ═══ BOX 10d: Claim Codes ════════════════════════════════════════════════
  t("50", d.claim_codes);

  // ═══ BOX 21: Diagnosis Codes A–L + ICD indicator ════════════════════════
  t("diagnosis1",  d.diagnosis_a);  t("diagnosis2",  d.diagnosis_b);
  t("diagnosis3",  d.diagnosis_c);  t("diagnosis4",  d.diagnosis_d);
  t("diagnosis5",  d.diagnosis_e);  t("diagnosis6",  d.diagnosis_f);
  t("diagnosis7",  d.diagnosis_g);  t("diagnosis8",  d.diagnosis_h);
  t("diagnosis9",  d.diagnosis_i);  t("diagnosis10", d.diagnosis_j);
  t("diagnosis11", d.diagnosis_k);  t("diagnosis12", d.diagnosis_l);
  t("99icd", d.icd_indicator ?? "0");

  // ═══ BOX 22: Resubmission ════════════════════════════════════════════════
  t("medicaid_resub", d.resubmission_code);
  t("original_ref",   d.original_ref_number);

  // ═══ BOX 23: Prior Auth ══════════════════════════════════════════════════
  t("prior_auth", d.prior_auth_number);

  // ═══ BOX 24: Service Lines 1–6 ══════════════════════════════════════════
  const lines = (d.service_lines as Array<Record<string, unknown>>) ?? [];
  lines.slice(0, 6).forEach((line, i) => {
    const n = i + 1;
    const [fMM, fDD, fYY] = splitDate(line.dos_from);
    t(`sv${n}_mm_from`, fMM); t(`sv${n}_dd_from`, fDD); t(`sv${n}_yy_from`, fYY);
    const [tMM, tDD, tYY] = splitDate(line.dos_to);
    t(`sv${n}_mm_end`, tMM); t(`sv${n}_dd_end`, tDD); t(`sv${n}_yy_end`, tYY);
    t(`place${n}`,  line.place_of_service);
    t(`cpt${n}`,    line.cpt_code);
    t(`mod${n}`,    line.modifier_1);
    t(`mod${n}a`,   line.modifier_2);
    t(`mod${n}b`,   line.modifier_3);
    t(`mod${n}c`,   line.modifier_4);
    t(`diag${n}`,   line.diagnosis_pointer);
    t(`ch${n}`,     line.charges);
    t(`day${n}`,    line.days_units);
    t(`emg${n}`,    line.emg ? "Y" : "");
    t(`epsdt${n}`,  line.epsdt);
    t(`local${n}`,  line.rendering_npi);
    t(`local${n}a`, line.id_qualifier);
    t(n === 1 ? "Suppl" : `Suppl${String.fromCharCode(96 + n)}`, line.suppl);
    t(`type${n}`,   line.service_type);
    t(`plan${n}`,   line.family_plan);
  });

  // ═══ BOX 25: Federal Tax ID ══════════════════════════════════════════════
  t("tax_id", d.federal_tax_id);
  radio("ssn", d.tax_id_ssn ? "SSN" : "EIN");

  // ═══ BOX 26: Patient Account ═════════════════════════════════════════════
  t("pt_account", d.patient_account_number);

  // ═══ BOX 27: Accept Assignment ══════════════════════════════════════════
  radio("assignment", d.accept_assignment ? "YES" : "NO");

  // ═══ BOX 28: Total Charge ════════════════════════════════════════════════
  t("t_charge", d.total_charge);

  // ═══ BOX 29: Amount Paid ═════════════════════════════════════════════════
  t("amt_paid", d.amount_paid);

  // ═══ BOX 31: Physician Signature + Date ═════════════════════════════════
  t("physician_signature", d.physician_signature);
  t("physician_date",      d.physician_signature_date);

  // ═══ BOX 32: Service Facility ════════════════════════════════════════════
  t("fac_name",   d.service_facility_name);
  t("fac_street", d.service_facility_address);
  t("pin1",       d.service_facility_npi);

  // ═══ BOX 33: Billing Provider ════════════════════════════════════════════
  const [bpAC, bpPh] = splitPhone(d.billing_provider_phone);
  t("doc_phone area", bpAC);
  t("doc_phone",      bpPh);
  t("doc_name",   d.billing_provider_name);
  t("doc_street", d.billing_provider_address);
  t("pin",        d.billing_provider_npi);
  t("grp",        d.billing_provider_tax_id);

  // ── Remove push-button fields (e.g. "Clear Form") ───────────────────────
  for (const field of form.getFields()) {
    if (field instanceof PDFButton) {
      try { form.removeField(field); } catch {}
    }
  }

  // ── Flatten text fields (radio/checkbox appearances are unreliable) ──────
  const helvetica = await pdf.embedFont(StandardFonts.Helvetica);
  try { form.updateFieldAppearances(helvetica); } catch {}
  form.flatten();

  // ── Draw X marks for radio selections directly on the page ───────────────
  // This runs AFTER flatten so the X marks layer on top of anything flatten
  // rendered — guaranteeing visibility regardless of the PDF's appearance streams.
  const page = pdf.getPage(0);
  const { width: W, height: H } = page.getSize();

  for (const [group, selectedValue] of selectedRadios) {
    const opts = RADIO_POSITIONS[group];
    if (!opts) continue;
    const opt = opts.find(o => o.value === selectedValue);
    if (!opt) continue;

    // Center the "X" within the checkbox widget bounds
    const boxW = (opt.width  / 100) * W;
    const boxH = (opt.height / 100) * H;
    const x = (opt.left / 100) * W + boxW / 2 - 2.5;
    const y = H - (opt.top / 100) * H - boxH / 2 - 2.5;

    page.drawText("X", { x, y, size: 7, font: helvetica, color: rgb(0, 0, 0) });
  }

  return pdf.save();
}
