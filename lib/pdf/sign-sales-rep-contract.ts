import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
} from "pdf-lib";
import sharp from "sharp";
import type { ContractDef } from "@/lib/pdf/sales-rep-contracts";

/* ──────────────────────────────────────────────────────────────────────────
 *  Stamper for sales-rep onboarding contracts (AcroForm-native).
 *
 *  Contracts are shipped as AcroForm PDFs (Genspark conversion) with named
 *  fields that match the schema keys in `sales-rep-contracts.ts`:
 *    - Text    → form.getTextField(key).setText(value)
 *    - Radio   → form.getRadioGroup(key).select(value)
 *    - PDFSignature "signature" → embed PNG inside the widget's rectangle
 *                                  (auto-scales to the box — no more giant sigs)
 *    - "date"  → pre-formatted today string as text
 *
 *  After all fields are set, the form is flattened so the filled PDF renders
 *  identically in Adobe, Chrome, Preview, etc. — no AcroForm appearance-stream
 *  surprises.
 * ──────────────────────────────────────────────────────────────────────── */

const VALUE_COLOR = rgb(0.06, 0.18, 0.29);

export interface SignContractInput {
  contract: ContractDef;
  sourcePdf: Uint8Array;
  formData: Record<string, unknown>;
  signaturePng: Uint8Array;
  signedDate: Date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function trimSignature(input: Uint8Array): Promise<Uint8Array> {
  try {
    const out = await sharp(Buffer.from(input))
      .trim({ threshold: 15 })
      .png()
      .toBuffer();
    return new Uint8Array(out);
  } catch {
    return input;
  }
}

function coerceString(v: unknown): string {
  if (v == null) return "";
  return typeof v === "string" ? v : String(v);
}

/**
 * Remove PDFSignature fields from the form at the low PDF-dict level. We need
 * this because pdf-lib's form.flatten() throws "Unexpected N type: undefined"
 * on signature widgets that have no /AP appearance stream — which includes the
 * DocuSign envelope marker baked into Genspark's templates AND our own
 * "signature" widget (we draw the sig image onto the page directly, not into
 * the widget). Stripping these before flatten lets the remaining text + radio
 * fields flatten cleanly, producing a non-editable PDF while preserving the
 * drawn signature image (which lives on the page content stream).
 */
function removeSignatureFields(pdf: PDFDocument): number {
  const form = pdf.getForm();
  const sigs = form.getFields().filter((f) => f.constructor.name === "PDFSignature");
  if (sigs.length === 0) return 0;

  const sigFieldRefs = new Set<PDFRef>();
  const sigWidgetDicts = new Set<PDFDict>();
  for (const sig of sigs) {
    sigFieldRefs.add(sig.ref);
    for (const w of sig.acroField.getWidgets()) {
      sigWidgetDicts.add(w.dict);
    }
  }

  for (const page of pdf.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      const entry = annots.get(i);
      try {
        const resolved = pdf.context.lookup(entry);
        if (resolved instanceof PDFDict && sigWidgetDicts.has(resolved)) {
          annots.remove(i);
        }
      } catch {
        /* ignore lookup failures */
      }
    }
  }

  const acroFormEntry = pdf.catalog.get(PDFName.of("AcroForm"));
  if (acroFormEntry) {
    const acroFormDict = pdf.context.lookup(acroFormEntry);
    if (acroFormDict instanceof PDFDict) {
      const fieldsEntry = acroFormDict.get(PDFName.of("Fields"));
      if (fieldsEntry) {
        const fieldsArray = pdf.context.lookup(fieldsEntry);
        if (fieldsArray instanceof PDFArray) {
          for (let i = fieldsArray.size() - 1; i >= 0; i--) {
            const entry = fieldsArray.get(i);
            if (entry instanceof PDFRef && sigFieldRefs.has(entry)) {
              fieldsArray.remove(i);
            }
          }
        }
      }
    }
  }

  return sigs.length;
}

export async function stampSalesRepContract({
  contract,
  sourcePdf,
  formData,
  signaturePng,
  signedDate,
}: SignContractInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourcePdf);
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // ── 1) Fill every text + radio field declared on the contract ──
  for (const field of contract.fields) {
    const visible = !field.showIf || field.showIf(formData);
    if (!visible) continue;
    const value = coerceString(formData[field.key]);

    if (field.type === "radio") {
      if (!value) continue;
      try {
        form.getRadioGroup(field.key).select(value);
      } catch (e) {
        console.error(
          `[sign-sales-rep] radio select failed for ${field.key}=${value}:`,
          e,
        );
      }
      continue;
    }

    // All other types render as text.
    if (!value) continue;
    try {
      const tf = form.getTextField(field.key);
      tf.setText(value);
      // Keep the viewer-drawn appearance in sync with the value we just set —
      // belt-and-suspenders for viewers that ignore NeedAppearances.
      tf.updateAppearances(font);
    } catch (e) {
      console.error(`[sign-sales-rep] setText failed for ${field.key}:`, e);
    }
  }

  // ── 2) Date (auto-today) ──
  try {
    const dateField = form.getTextField("date");
    dateField.setText(formatDate(signedDate));
    dateField.updateAppearances(font);
  } catch {
    /* some contracts may not have a date field; ignore */
  }

  // ── 3) Signature — embed PNG inside the PDFSignature widget rectangle ──
  try {
    const trimmed = await trimSignature(signaturePng);
    const embedded = await pdf.embedPng(trimmed);

    // pdf-lib's getSignature() returns a PDFSignature field; its widget(s) own
    // the bounding box. Draw the signature image inside that rectangle so it
    // auto-fits (caps max size — no more giant overflow sigs).
    const sigField = form.getField("signature");
    const widgets = sigField.acroField.getWidgets();
    const pages = pdf.getPages();

    for (const w of widgets) {
      const r = w.getRectangle();
      // Locate the page this widget belongs to by scanning each page's Annots
      // and comparing dict identity (pdf-lib doesn't expose a direct API).
      let widgetPage = pages[0];
      for (const p of pages) {
        const annots = p.node.Annots();
        if (!annots) continue;
        const arr = annots.asArray();
        const match = arr.some((entry) => {
          try {
            return pdf.context.lookup(entry) === w.dict;
          } catch {
            return false;
          }
        });
        if (match) {
          widgetPage = p;
          break;
        }
      }

      const box = embedded.scaleToFit(r.width, r.height);
      // Center the scaled image inside the widget rect.
      const x = r.x + (r.width - box.width) / 2;
      const y = r.y + (r.height - box.height) / 2;
      widgetPage.drawImage(embedded, { x, y, width: box.width, height: box.height });
    }
  } catch (e) {
    console.error("[sign-sales-rep] signature embed failed:", e);
  }

  // ── 4) Lock the PDF — strip signature fields then flatten the rest.
  //       Signature widgets have no /AP stream (DocuSign envelope marker + our
  //       own "signature" widget where we drew the image directly onto the
  //       page), which makes form.flatten() throw. Removing them at the dict
  //       level first lets the remaining text + radio fields flatten into
  //       static page content — output is non-editable in any PDF viewer. ──
  try {
    removeSignatureFields(pdf);
    pdf.getForm().flatten();
  } catch (e) {
    console.error("[sign-sales-rep] flatten failed:", e);
  }

  void VALUE_COLOR;
  return await pdf.save();
}
