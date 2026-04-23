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
  /** Additional scanned documents (e.g. I-9 List A/B/C) to merge as extra
   *  pages AFTER the stamped contract content. PDFs are copied page-by-page;
   *  PNG/JPG images are embedded as full-page images. */
  attachments?: Array<{ bytes: Uint8Array; mime: string; filename: string }>;
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
 * For every radio group, draw a crisp X inside the selected widget's rect, then
 * strip ALL radio widgets from both page /Annots and /AcroForm/Fields so
 * pdf-lib's flatten() doesn't re-render the Genspark widget appearances (which
 * don't align cleanly with the template's baked checkbox graphics). The manual
 * X gives us full control over the visual mark and guarantees alignment.
 */
function stampAndStripRadios(pdf: PDFDocument): void {
  const form = pdf.getForm();
  const radios = form
    .getFields()
    .filter((f) => f.constructor.name === "PDFRadioGroup");
  if (radios.length === 0) return;
  const pages = pdf.getPages();

  // Draw X at each selected widget's rect
  for (const rg of radios) {
    for (const w of rg.acroField.getWidgets()) {
      const asEntry = w.dict.get(PDFName.of("AS"));
      if (!asEntry) continue;
      const asName = pdf.context.lookup(asEntry);
      if (asName?.toString?.() === "/Off") continue;

      // Locate the widget's page by matching dict identity
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

      const r = w.getRectangle();
      const inset = Math.max(2, r.width * 0.2);
      const x1 = r.x + inset;
      const y1 = r.y + inset;
      const x2 = r.x + r.width - inset;
      const y2 = r.y + r.height - inset;
      widgetPage.drawLine({
        start: { x: x1, y: y1 },
        end: { x: x2, y: y2 },
        thickness: 1.5,
        color: rgb(0, 0, 0),
      });
      widgetPage.drawLine({
        start: { x: x1, y: y2 },
        end: { x: x2, y: y1 },
        thickness: 1.5,
        color: rgb(0, 0, 0),
      });
    }
  }

  // Strip every radio widget from /Annots and every radio field from /AcroForm/Fields
  const widgetDicts = new Set<PDFDict>();
  const fieldRefs = new Set<PDFRef>();
  for (const rg of radios) {
    fieldRefs.add(rg.ref);
    for (const w of rg.acroField.getWidgets()) widgetDicts.add(w.dict);
  }
  for (const page of pages) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      try {
        const resolved = pdf.context.lookup(annots.get(i));
        if (resolved instanceof PDFDict && widgetDicts.has(resolved)) {
          annots.remove(i);
        }
      } catch {
        /* ignore */
      }
    }
  }
  const acroEntry = pdf.catalog.get(PDFName.of("AcroForm"));
  if (acroEntry) {
    const acroDict = pdf.context.lookup(acroEntry);
    if (acroDict instanceof PDFDict) {
      const fe = acroDict.get(PDFName.of("Fields"));
      if (fe) {
        const fa = pdf.context.lookup(fe);
        if (fa instanceof PDFArray) {
          for (let i = fa.size() - 1; i >= 0; i--) {
            const e = fa.get(i);
            if (e instanceof PDFRef && fieldRefs.has(e)) fa.remove(i);
          }
        }
      }
    }
  }
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
  attachments,
}: SignContractInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourcePdf);
  const form = pdf.getForm();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  // ── 1) Fill every text + radio + checkbox field declared on the contract ──
  for (const field of contract.fields) {
    if (field.virtual) continue;
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

    if (field.type === "checkbox") {
      try {
        const cb = form.getCheckBox(field.key);
        if (value === "true") cb.check();
        else cb.uncheck();
      } catch (e) {
        console.error(`[sign-sales-rep] checkbox set failed for ${field.key}:`, e);
      }
      continue;
    }

    // File fields don't map to AcroForm; they're merged as extra pages later.
    if (field.type === "file") continue;

    // All other types render as text.
    if (!value) continue;
    try {
      const tf = form.getTextField(field.key);
      if (field.comb && field.comb > 0) {
        // Distribute digits one-per-cell across the widget. setMaxLength +
        // enableCombing are no-ops if the template already configured them,
        // but keep them as a safety net for templates Genspark didn't convert
        // as proper comb fields.
        const digits = value.replace(/\D/g, "").slice(0, field.comb);
        tf.setMaxLength(field.comb);
        tf.enableCombing();
        tf.setText(digits);
      } else {
        tf.setText(value);
      }
      // Apply explicit font size if the schema pinned one — this must come
      // BEFORE updateAppearances so the /AP stream is generated at that size.
      if (field.fontSize) tf.setFontSize(field.fontSize);
      // Keep the viewer-drawn appearance in sync with the value we just set —
      // belt-and-suspenders for viewers that ignore NeedAppearances.
      tf.updateAppearances(font);
    } catch (e) {
      console.error(`[sign-sales-rep] setText failed for ${field.key}:`, e);
    }
  }

  // ── 2) Auto-fill any templated date fields with today's date ──
  // `date`         — rep's signing date (existing for all contracts)
  // `employer_date` — I-9 Section 2 employer signing date (same value — the
  //                   rep self-attests on Kelsey's behalf since she's the
  //                   baked-in authorized employer representative).
  for (const dateKey of ["date", "employer_date"] as const) {
    try {
      const f = form.getTextField(dateKey);
      f.setText(formatDate(signedDate));
      f.updateAppearances(font);
    } catch {
      /* field not present on this contract */
    }
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
    stampAndStripRadios(pdf);
    removeSignatureFields(pdf);
    pdf.getForm().flatten();
  } catch (e) {
    console.error("[sign-sales-rep] flatten failed:", e);
  }

  // ── 5) Merge any uploaded attachments as additional pages ──
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      try {
        if (att.mime === "application/pdf") {
          const src = await PDFDocument.load(att.bytes);
          const copied = await pdf.copyPages(src, src.getPageIndices());
          for (const p of copied) pdf.addPage(p);
        } else if (att.mime === "image/png" || att.mime === "image/jpeg") {
          const img =
            att.mime === "image/png"
              ? await pdf.embedPng(att.bytes)
              : await pdf.embedJpg(att.bytes);
          // US Letter portrait canvas — fit image inside with 36pt margins.
          const pageWidth = 612;
          const pageHeight = 792;
          const margin = 36;
          const maxW = pageWidth - margin * 2;
          const maxH = pageHeight - margin * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const newPage = pdf.addPage([pageWidth, pageHeight]);
          newPage.drawImage(img, {
            x: (pageWidth - drawW) / 2,
            y: (pageHeight - drawH) / 2,
            width: drawW,
            height: drawH,
          });
        } else {
          console.warn(`[sign-sales-rep] skipping unsupported attachment mime: ${att.mime}`);
        }
      } catch (e) {
        console.error(`[sign-sales-rep] failed to merge attachment ${att.filename}:`, e);
      }
    }
  }

  void VALUE_COLOR;
  return await pdf.save();
}
