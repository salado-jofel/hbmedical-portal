import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

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
  /** Counter-signatory (Dr John Pienkos / CEO). Signature image is optional. */
  meridian: StampSignerInput;
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
/** Meridian (counter-signatory) signature. The source PNG is auto-trimmed of
 *  any white/near-white border via sharp before embedding, so the box height
 *  can stay tight against the "Date:" row above (~25pt gap) while still
 *  rendering the ink at a readable size. */
const MERIDIAN_SIGNATURE_BOX_WIDTH = 170;
const MERIDIAN_SIGNATURE_BOX_HEIGHT = 22;
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

/** Trim near-white border from a signature PNG so the ink fills its bounding
 *  box. Returns the original bytes unchanged on any sharp error so a bad image
 *  never breaks the contract stamping flow. */
async function trimSignaturePng(input: Uint8Array): Promise<Uint8Array> {
  try {
    const trimmed = await sharp(Buffer.from(input))
      .trim({ threshold: 15 })
      .png()
      .toBuffer();
    return new Uint8Array(trimmed);
  } catch (err) {
    console.error("[trimSignaturePng]", err);
    return input;
  }
}

export async function stampContractPdf({
  sourcePdf,
  contractType,
  client,
  meridian,
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
  // Meridian signature is typically a scan/export with white padding — trim it
  // so scaleToFit maxes out the visible ink in the target box.
  const meridianPng = meridian.signaturePng
    ? await trimSignaturePng(meridian.signaturePng)
    : null;
  const meridianSig = await embedSignature(pdf, meridianPng);

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

  // ── MERIDIAN block (left column) ──
  drawValue(meridian.name, layout.meridianX, layout.rowYName);
  drawValue(meridian.title, layout.meridianX, layout.rowYTitle);
  drawValue(formatDate(meridian.date), layout.meridianX, layout.rowYDate);
  drawSig(meridianSig, layout.meridianSigX, {
    boxW: MERIDIAN_SIGNATURE_BOX_WIDTH,
    boxH: MERIDIAN_SIGNATURE_BOX_HEIGHT,
    whiteBackground: true,
  });

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

  return await pdf.save();
}

/* ── Static counter-signatory metadata ── */

export const MERIDIAN_SIGNER = {
  name: "Dr John Pienkos",
  title: "CEO",
  /** Fixed storage path where the Pienkos signature image will live when supplied. */
  signaturePath: "signatures/john-pienkos-white.png",
} as const;

/* ── Source contract metadata ── */

export const CONTRACT_SOURCES: Record<ContractType, { path: string; label: string }> = {
  baa: {
    path: "provider-contracts/Business Associates Agreement.pdf",
    label: "Business Associates Agreement",
  },
  product_services: {
    path: "provider-contracts/Product and Services.pdf",
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
