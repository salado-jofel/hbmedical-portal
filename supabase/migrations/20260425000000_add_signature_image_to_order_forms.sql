-- Persist the provider's specimen signature (PNG data URL) alongside the
-- signed flag so it survives page reloads and can be re-embedded in PDFs
-- on every regen without re-capturing. ~10–30 KB of base64 per row.

ALTER TABLE "public"."order_form"
  ADD COLUMN IF NOT EXISTS "physician_signature_image" text;

ALTER TABLE "public"."order_ivr"
  ADD COLUMN IF NOT EXISTS "physician_signature_image" text;

COMMENT ON COLUMN "public"."order_form"."physician_signature_image" IS
  'data:image/png;base64,... of the specimen signature captured at Sign. Cleared by Unsign.';
COMMENT ON COLUMN "public"."order_ivr"."physician_signature_image" IS
  'data:image/png;base64,... of the specimen signature captured at Sign. Cleared by Unsign.';
