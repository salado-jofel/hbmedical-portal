/* Patient date of birth for the Order Form.
 *
 * This exists because the order form shipped without a date-of-birth column.
 * `order_form.patient_date` means "patient signature date" and is seeded from
 * `orders.date_of_service`; when the DFU and VLU layouts needed a DOB field
 * they were pointed at that column under a "Date of Birth" label. Every
 * DFU/VLU prescription then printed the date of service as the patient's
 * birth date, on a signed script, in production.
 *
 * The rule this encodes: a DOB resolves only from things that are actually a
 * date of birth. There is no date-of-service fallback and must never be one.
 * A blank DOB is a visible gap a human can fix; a plausible wrong DOB is a
 * billing and clinical defect that reads as complete.
 */

/** DOB sources, in the order they win. All optional — pass what you have. */
export type OrderFormDobSources = {
  /** `order_form.patient_dob` — what the clinician saved or corrected. */
  formPatientDob?: string | null;
  /** DOB parsed out of the uploaded facesheet / clinical docs. */
  extractedDob?: string | null;
  /** `patients.date_of_birth` on the linked patient record. */
  patientRecordDob?: string | null;
};

const blank = (value: string | null | undefined): boolean =>
  value === null || value === undefined || value.trim() === "";

/**
 * First non-blank DOB source, or null when none is known.
 *
 * Mirrors the fill-blanks precedence used across extraction: a value a human
 * already put on the form outranks anything derived later.
 */
export function resolveOrderFormDob(
  sources: OrderFormDobSources,
): string | null {
  for (const value of [
    sources.formPatientDob,
    sources.extractedDob,
    sources.patientRecordDob,
  ]) {
    if (!blank(value)) return (value as string).trim();
  }
  return null;
}
