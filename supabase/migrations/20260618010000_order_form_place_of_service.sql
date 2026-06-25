-- Add place_of_service to order_form. The same concept already lives on
-- order_ivr.place_of_service; per Dr. Ben's spec the Order Form needs its
-- own independent copy so clinicians can capture POS on the order without
-- depending on the IVR being filled in first.
--
-- Two-sources-of-truth tradeoff is explicit: order_form.place_of_service
-- and order_ivr.place_of_service can diverge. This is acceptable per
-- product decision — they describe different stages of the workflow
-- (clinical order vs. insurance verification).
--
-- Nullable text, no CHECK — matches the shape of order_ivr.place_of_service.
-- Values are the 7 CMS POS codes used by the IVR form picker.

ALTER TABLE public.order_form
  ADD COLUMN place_of_service text;

COMMENT ON COLUMN public.order_form.place_of_service IS
  'CMS Place of Service code/label. One of: Office (11), Patient home (12), '
  'Assisted Living Facility (13), Off Campus Outpatient Hospital (19), '
  'Hospital outpatient (22), Ambulatory Surgical Center (24), '
  'Independent Clinic (49). Independent of order_ivr.place_of_service.';
