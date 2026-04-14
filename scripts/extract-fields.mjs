import { PDFDocument, PDFName, PDFDict, PDFStream } from "pdf-lib";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pdfPath  = path.join(__dirname, "../public/cms-1500-fillable.pdf");
const outPath  = path.join(
  __dirname,
  "../app/(dashboard)/dashboard/orders/(components)/cms1500-fields.json"
);

const PW = 612.0, PH = 792.0;

const bytes  = fs.readFileSync(pdfPath);
const pdf    = await PDFDocument.load(bytes);
const form   = pdf.getForm();
const fields = form.getFields();

function rectPct(r) {
  return {
    left:   +((r.x                / PW) * 100).toFixed(3),
    top:    +(((PH - r.y - r.height) / PH) * 100).toFixed(3),
    width:  +((r.width            / PW) * 100).toFixed(3),
    height: +((r.height           / PH) * 100).toFixed(3),
  };
}

/** Read the ON-state key from a widget's AP/N dictionary */
function widgetOnValue(widget) {
  try {
    const ap = widget.dict.get(PDFName.of("AP"));
    if (!ap) return null;
    const apResolved = ap instanceof PDFDict ? ap : pdf.context.lookup(ap);
    if (!(apResolved instanceof PDFDict)) return null;
    const n = apResolved.get(PDFName.of("N"));
    if (!n) return null;
    const nResolved = n instanceof PDFDict ? n : pdf.context.lookup(n);
    if (!(nResolved instanceof PDFDict)) return null;
    for (const key of nResolved.keys()) {
      const kStr = key.decodeText ? key.decodeText() : key.toString().replace(/^\//, "");
      if (kStr !== "Off") return kStr;
    }
  } catch {}
  return null;
}

const textFields = [];
const radios     = {};

for (const field of fields) {
  const name = field.getName();
  const type = field.constructor.name;
  const widgets = field.acroField.getWidgets();
  if (!widgets.length) continue;

  if (type === "PDFTextField") {
    for (const widget of widgets) {
      const r = widget.getRectangle();
      if (r.width < 2 || r.height < 2) continue;
      textFields.push({ name, ...rectPct(r) });
    }
    continue;
  }

  if (type === "PDFRadioGroup" || type === "PDFCheckBox") {
    // Try pdf-lib's getOptions() first
    let options = [];
    try { options = field.getOptions?.() ?? []; } catch {}

    const opts = [];
    widgets.forEach((widget, i) => {
      const r = widget.getRectangle();
      if (r.width < 2 || r.height < 2) return;

      // 1) Use getOptions value at same index
      let value = options[i] ?? null;
      // 2) Fall back to reading AP/N key directly
      if (!value || value === "On") value = widgetOnValue(widget);
      // 3) Last resort: "On"
      if (!value) value = "On";

      opts.push({ value, ...rectPct(r) });
    });
    if (opts.length) radios[name] = opts;
  }
}

fs.writeFileSync(outPath, JSON.stringify({ text: textFields, radios }, null, 2));
console.log(
  `Wrote ${textFields.length} text fields, ${Object.keys(radios).length} radio groups`
);
// Print radio group summary for verification
for (const [k, v] of Object.entries(radios)) {
  console.log(`  ${k}: [${v.map(o => o.value).join(", ")}]`);
}
