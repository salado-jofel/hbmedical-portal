-- Standalone IVR: patient / physician / product metadata is optional.
--
-- Feedback from Dr. Ben (2026-07-07): all of this info is already inside
-- the uploaded IVR PDF — asking the uploader to re-type it is redundant
-- friction. The external approver reads the PDF to review; the portal
-- just needs the file and an approver assignment.
--
-- Product info also moves out of this stage — products are added later,
-- at order-creation time, per the same feedback.
--
-- Facility stays NOT NULL because RLS keys off it; the upload action now
-- auto-derives it from the caller's facility membership.

ALTER TABLE public.standalone_ivrs
  ALTER COLUMN patient_name DROP NOT NULL,
  ALTER COLUMN patient_dob DROP NOT NULL,
  ALTER COLUMN physician_name DROP NOT NULL,
  ALTER COLUMN product_summary DROP NOT NULL;
