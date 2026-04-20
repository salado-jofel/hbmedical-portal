-- ============================================================================
--  Add medicare_mac column to facility_enrollment
--
--  Stores the Medicare Administrative Contractor (MAC / "GMAC") selected on
--  the clinic enrollment form, e.g. 'palmetto_gba', 'novitas', 'noridian'.
--  Optional field — NULL is valid.
-- ============================================================================

ALTER TABLE public.facility_enrollment
  ADD COLUMN IF NOT EXISTS medicare_mac text;

COMMENT ON COLUMN public.facility_enrollment.medicare_mac IS
  'Medicare Administrative Contractor (MAC) that processes the clinic''s Original Medicare claims. Values are short codes (palmetto_gba, novitas, noridian, ngs, cgs, fcso, wps).';
