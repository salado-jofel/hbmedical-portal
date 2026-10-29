-- Give the Order Form a real date-of-birth column.
--
-- Before: order_form had exactly one patient date column, patient_date,
-- documented as 'Patient signature date on the order form' and seeded
-- from orders.date_of_service. When the DFU and VLU Fortify-template
-- layouts were added they needed a date-of-birth field, and both the
-- form and the PDF were pointed at patient_date under a "Date of Birth"
-- label. So on every DFU/VLU order the printed prescription showed the
-- date of service as the patient's birth date -- in production, on a
-- signed script, next to "All required fields complete". The same value
-- also rendered as plain "Date" elsewhere in the same document, and any
-- clinician who corrected the "DOB" field silently overwrote the
-- signature date instead.
--
-- Now: patient_dob holds the date of birth and patient_date goes back to
-- meaning only what its comment always said. The form seeds patient_dob
-- from patients.date_of_birth (already joined on every order), AI
-- extraction fills it blanks-only like every other extracted column, and
-- the clinician can correct it.
--
-- Nullable with no backfill on purpose: patient_date cannot be migrated
-- into patient_dob because its stored value is a service date, not a
-- birth date. Existing DFU/VLU rows therefore show an empty DOB that
-- resolves from the patient record, which is correct, rather than a
-- confident wrong date, which is what shipped.

ALTER TABLE public.order_form
  ADD COLUMN IF NOT EXISTS patient_dob date;

COMMENT ON COLUMN public.order_form.patient_dob IS
  'Patient date of birth as printed on the order form. Seeded from patients.date_of_birth, fillable by AI extraction (blanks only), correctable by the clinician. Distinct from patient_date, which is the patient signature date.';
