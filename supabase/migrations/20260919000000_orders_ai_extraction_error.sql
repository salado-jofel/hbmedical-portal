-- Record why AI extraction failed so the order modal can stop waiting.
--
-- Before: the extractor ran fire-and-forget and the only completion
-- signal was orders.ai_extracted flipping true. When extraction failed
-- (auth hop 401, Bedrock 503, timeout…) nothing was written, so the
-- modal spun for its full 5-minute poll budget and then showed a
-- generic "timed out" with no way to retry short of re-uploading.
--
-- Now: triggerCombinedExtraction clears this column when it starts and
-- writes the failure message on any non-success. getOrderAiStatus
-- returns it; the modal shows the reason immediately with a Retry
-- button. Cleared again on retry / success. Nullable, no backfill.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ai_extraction_error text;

COMMENT ON COLUMN public.orders.ai_extraction_error IS
  'Last AI extraction failure message (null when none / after success). Set by triggerCombinedExtraction; surfaced by getOrderAiStatus for the Retry UI.';
