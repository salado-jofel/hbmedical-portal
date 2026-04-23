import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFName,
  PDFDict,
  PDFArray,
  PDFRef,
} from "pdf-lib";

/* ──────────────────────────────────────────────────────────────────────────
 *  Contract stamping — DocuSign-style inline signing.
 *
 *  Coordinates were extracted from the actual source PDFs using pdfjs-dist
 *  (tmp-calibrate/calibrate.mjs). BAA and Product & Services ship with
 *  DIFFERENT signature-block positions AND different target pages, so each
 *  contract has its own layout.
 *
 *  pdf-lib origin is bottom-left. All coordinates are in PDF points.
 *  Both contract PDFs are A4 (596 × 842).
 * ──────────────────────────────────────────────────────────────────────── */

export type ContractType = "baa" | "product_services";

export interface StampSignerInput {
  name: string;
  title: string;
  /** ISO date string (YYYY-MM-DD) or Date */
  date: string | Date;
  /** Signature PNG bytes, or null/undefined to leave signature line blank */
  signaturePng?: Uint8Array | null;
}

export interface SignContractInput {
  /** Raw source PDF bytes (the unsigned template) */
  sourcePdf: Uint8Array;
  /** Which contract — selects the layout + target page */
  contractType: ContractType;
  /** The provider filling in the CLIENT block. Omit for MERIDIAN-only previews. */
  client?: StampSignerInput;
  /** Today's date for the Meridian (baked-in) signature row. Pienkos's name,
   *  title, and signature image are now permanently baked into the template
   *  — only the date stays dynamic so it reflects the actual sign day. */
  meridianDate: Date | string;
  /** Opening-paragraph AcroForm field values. Both the BAA and PSA share the
   *  same 6-field shape now that Genspark added paragraph fields to both. */
  paragraph?: ContractParagraphFields;
}

/** Values for the 6 AcroForm fields in the BAA/PSA opening paragraph. Provider
 *  signup already captures most of these; entity type is entered in the sign
 *  modal. */
export interface ContractParagraphFields {
  /** e.g. "April 23" */
  contract_date_full: string;
  /** e.g. "2026" */
  contract_date_year: string;
  /** Client's legal business name — `officeName` from signup */
  client_legal_name: string;
  /** e.g. "a California professional corporation" — provider-typed */
  client_entity_type: string;
  /** Street number and name — `officeAddress` from signup */
  client_address_street: string;
  /** City, state, ZIP — combined from signup fields */
  client_address_city_state_zip: string;
}

/* ── Per-contract layout (measured from source PDFs) ── */

interface ContractLayout {
  /** 1-based page index where the signature block lives */
  pageNumber: number;
  /** X for typed values (Name / Title / Date) — lands inside the underscore line */
  meridianX: number;
  clientX: number;
  /** X for signature image — immediately right of "Signature:" label */
  meridianSigX: number;
  clientSigX: number;
  rowYName: number;
  rowYTitle: number;
  rowYDate: number;
  /** Baseline Y of the "Signature:" label (extracted from source PDF) */
  signatureLabelY: number;
}

const LAYOUTS: Record<ContractType, ContractLayout> = {
  // BAA: signature block on page 4. Labels at x=77.3 / 302.3, "Signature:" label
  // is 50.1pt wide, so sig image starts ~6pt after the colon.
  baa: {
    pageNumber: 4,
    meridianX: 112,
    clientX: 337,
    meridianSigX: 134,
    clientSigX: 359,
    rowYName: 377,
    rowYTitle: 352,
    rowYDate: 327,
    signatureLabelY: 301,
  },
  // P&S: signature block on page 3. Labels at x=60 / 285.
  product_services: {
    pageNumber: 3,
    meridianX: 95,
    clientX: 320,
    meridianSigX: 117,
    clientSigX: 342,
    rowYName: 170,
    rowYTitle: 145,
    rowYDate: 120,
    signatureLabelY: 94,
  },
};

const VALUE_FONT_SIZE = 11;
const VALUE_MAX_WIDTH = 210;
const VALUE_COLOR = rgb(0.06, 0.18, 0.29);
/** Signature image is sized to visually match the body text beside it. */
const SIGNATURE_BOX_WIDTH = 110;
const SIGNATURE_BOX_HEIGHT = 22;
/** Image BOTTOM sits this many pts below the "Signature:" label baseline — leaves
 *  room for cursive descenders while keeping the signature on the same line. */
const SIGNATURE_BOTTOM_BELOW_BASELINE = 4;

function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function embedSignature(
  pdf: PDFDocument,
  png: Uint8Array | null | undefined,
) {
  if (!png || png.length === 0) return null;
  try {
    return await pdf.embedPng(png);
  } catch {
    return null;
  }
}

export async function stampContractPdf({
  sourcePdf,
  contractType,
  client,
  meridianDate,
  paragraph,
}: SignContractInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(sourcePdf);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const layout = LAYOUTS[contractType];
  const pages = pdf.getPages();
  const page = pages[layout.pageNumber - 1];
  if (!page) {
    throw new Error(
      `Contract ${contractType} is missing page ${layout.pageNumber}.`,
    );
  }

  const clientSig = client ? await embedSignature(pdf, client.signaturePng) : null;

  const drawValue = (text: string, x: number, y: number) => {
    page.drawText(text, {
      x,
      y,
      size: VALUE_FONT_SIZE,
      font,
      color: VALUE_COLOR,
      maxWidth: VALUE_MAX_WIDTH,
    });
  };

  const drawSig = (
    png: Awaited<ReturnType<typeof embedSignature>>,
    x: number,
    opts: { boxW: number; boxH: number; whiteBackground?: boolean },
  ) => {
    if (!png) return;
    const scaled = png.scaleToFit(opts.boxW, opts.boxH);
    // Anchor bottom of image just below the "Signature:" label baseline so the
    // signature appears on the same line as the label, to its right.
    const imageBottom = layout.signatureLabelY - SIGNATURE_BOTTOM_BELOW_BASELINE;
    if (opts.whiteBackground) {
      page.drawRectangle({
        x,
        y: imageBottom,
        width: scaled.width,
        height: scaled.height,
        color: rgb(1, 1, 1),
      });
    }
    page.drawImage(png, {
      x,
      y: imageBottom,
      width: scaled.width,
      height: scaled.height,
    });
  };

  // ── MERIDIAN block — only DATE is stamped at sign time; name/title/signature
  //    are permanently baked into the template (see tmp-calibrate/bake-pienkos-
  //    into-templates.mjs) ──
  drawValue(formatDate(meridianDate), layout.meridianX, layout.rowYDate);

  // ── CLIENT block (right column) — skipped for MERIDIAN-only previews ──
  if (client) {
    drawValue(client.name, layout.clientX, layout.rowYName);
    drawValue(client.title, layout.clientX, layout.rowYTitle);
    drawValue(formatDate(client.date), layout.clientX, layout.rowYDate);
    drawSig(clientSig, layout.clientSigX, {
      boxW: SIGNATURE_BOX_WIDTH,
      boxH: SIGNATURE_BOX_HEIGHT,
    });
  }

  // ── Fill the 6 opening-paragraph AcroForm fields. Both BAA and PSA carry
  //    the same shape now, so this branches purely on whether the caller
  //    supplied values. ──
  if (paragraph) {
    const form = pdf.getForm();
    for (const [key, value] of Object.entries(paragraph)) {
      if (!value) continue;
      try {
        const tf = form.getTextField(key);
        tf.setText(value);
        tf.updateAppearances(font);
      } catch (err) {
        console.error(`[stampContractPdf] setText failed for ${key}:`, err);
      }
    }
    // Flatten so the output is non-editable in viewers. Safe here — the new
    // paragraph fields are plain text widgets with /AP streams. The DocuSign
    // envelope PDFSignature artifact is stripped first to avoid the familiar
    // "Unexpected N type: undefined" flatten error.
    try {
      removeSignatureFields(pdf);
      pdf.getForm().flatten();
    } catch (err) {
      console.error("[stampContractPdf] flatten failed:", err);
    }
  }

  return await pdf.save();
}

/** Strip every PDFSignature field (DocuSign envelope + any leftover sig
 *  widgets) at the dict level so pdf-lib's form.flatten() doesn't choke on
 *  their missing /AP streams. */
function removeSignatureFields(pdf: PDFDocument): void {
  const form = pdf.getForm();
  const sigs = form.getFields().filter((f) => f.constructor.name === "PDFSignature");
  if (sigs.length === 0) return;
  const sigFieldRefs = new Set<PDFRef>();
  const sigWidgetDicts = new Set<PDFDict>();
  for (const sig of sigs) {
    sigFieldRefs.add(sig.ref);
    for (const w of sig.acroField.getWidgets()) sigWidgetDicts.add(w.dict);
  }
  for (const page of pdf.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (let i = annots.size() - 1; i >= 0; i--) {
      try {
        const r = pdf.context.lookup(annots.get(i));
        if (r instanceof PDFDict && sigWidgetDicts.has(r)) annots.remove(i);
      } catch {
        /* ignore */
      }
    }
  }
  const acroEntry = pdf.catalog.get(PDFName.of("AcroForm"));
  if (!acroEntry) return;
  const acroDict = pdf.context.lookup(acroEntry);
  if (!(acroDict instanceof PDFDict)) return;
  const fe = acroDict.get(PDFName.of("Fields"));
  if (!fe) return;
  const fa = pdf.context.lookup(fe);
  if (!(fa instanceof PDFArray)) return;
  for (let i = fa.size() - 1; i >= 0; i--) {
    const e = fa.get(i);
    if (e instanceof PDFRef && sigFieldRefs.has(e)) fa.remove(i);
  }
}

/* ── Static counter-signatory metadata — kept for historical reference.
 *  Pienkos's name, title, and signature are now baked into the template PDFs
 *  at `lib/pdf/templates/baa.pdf` and `psa.pdf` (see
 *  `tmp-calibrate/bake-pienkos-into-templates.mjs`). Nothing is fetched from
 *  Supabase for Meridian at sign time anymore. ── */

export const MERIDIAN_SIGNER = {
  name: "Dr John Pienkos",
  title: "CEO",
} as const;

/* ── Source contract metadata ── */

export const CONTRACT_SOURCES: Record<
  ContractType,
  { templateFile: string; label: string }
> = {
  baa: {
    templateFile: "baa.pdf",
    label: "Business Associates Agreement",
  },
  product_services: {
    templateFile: "psa.pdf",
    label: "Product & Services Agreement",
  },
};

export function signedContractPath(
  inviteToken: string,
  contractType: ContractType,
): string {
  return `provider-contracts-signed/${inviteToken}/${contractType}.pdf`;
}

export function previewContractPath(
  inviteToken: string,
  contractType: ContractType,
): string {
  return `provider-contracts-previews/${inviteToken}/${contractType}.pdf`;
}
