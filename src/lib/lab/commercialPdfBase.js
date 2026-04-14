import { resolveProduBillingDocumentType } from "../integrations/billingDomain";

export function hexToRgb(hex = "#000000") {
  const raw = String(hex || "#000000").replace("#", "");
  const normalized = raw.length === 3 ? raw.split("").map(ch => ch + ch).join("") : raw.padEnd(6, "0").slice(0, 6);
  const parts = normalized.match(/.{2}/g) || ["00", "00", "00"];
  const [r, g, b] = parts.map(p => parseInt(p, 16) / 255);
  return { type: "RGB", red: r, green: g, blue: b };
}

export function wrapPdfText(text, maxWidth, font, size) {
  const paragraphs = String(text || "").split("\n");
  const lines = [];
  paragraphs.forEach(paragraph => {
    const words = String(paragraph || "").split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }
    let line = "";
    words.forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) lines.push(line);
  });
  return lines.length ? lines : [""];
}

export function measurePdfTextBlock(text, maxWidth, font, size, lineGap = 4) {
  const lines = wrapPdfText(text, maxWidth, font, size);
  return Math.max(size + 2, lines.length * (size + lineGap));
}

export function drawPdfTextBlock(page, text, x, y, maxWidth, font, size, color, lineGap = 4) {
  const lines = wrapPdfText(text, maxWidth, font, size);
  let currentY = y;
  lines.forEach(line => {
    page.drawText(line || " ", { x, y: currentY, size, font, color });
    currentY -= size + lineGap;
  });
  return currentY;
}

export function drawRoundedPdfBox(page, x, y, width, height, fillColor, borderColor = null, borderWidth = 1.2) {
  const edge = borderColor || fillColor;
  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: fillColor,
    borderColor: edge,
    borderWidth: borderWidth || 0,
  });
}

export function drawCommercialLabel(page, text, x, y, width, accentColor, bold, white, size = 10.5) {
  drawRoundedPdfBox(page, x, y, width, 22, accentColor, accentColor, 1);
  const safe = String(text || "");
  const textWidth = bold.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: x + Math.max(8, (width - textWidth) / 2),
    y: y + 6,
    size,
    font: bold,
    color: white,
    maxWidth: Math.max(0, width - 16),
  });
}

export function drawRightAlignedPdfText(page, text, x, y, width, font, size, color) {
  const safe = String(text || "—");
  const textWidth = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: x + Math.max(0, width - textWidth),
    y,
    size,
    font,
    color,
    maxWidth: width,
  });
}

export function drawSummaryPanel(page, { x, y, width, rows = [], labelWidth = 124, accentColor, bold, font, white, textColor, fillColor, borderColor, labelSize = 7.5, valueSize = 10 }) {
  const paddingX = 14;
  const paddingTop = 14;
  const labelHeight = 22;
  const rowGap = 8;
  const valueOffset = 14;
  const rowBlock = labelHeight + rowGap;
  const height = paddingTop * 2 + rows.length * rowBlock - rowGap;
  drawRoundedPdfBox(page, x, y, width, height, fillColor, borderColor, 1.1);
  const valueX = x + paddingX + labelWidth + valueOffset;
  const valueWidth = width - (paddingX * 2) - labelWidth - valueOffset;
  let rowY = y + height - paddingTop - labelHeight;
  rows.forEach(row => {
    drawCommercialLabel(page, row.label, x + paddingX, rowY, labelWidth, accentColor, bold, white, row.labelSize || labelSize);
    drawRightAlignedPdfText(page, row.value, valueX, rowY + 6, valueWidth, row.bold ? bold : font, row.valueSize || valueSize, row.color || textColor);
    rowY -= rowBlock;
  });
  return height;
}

export function drawDocumentSectionBox(page, {
  x,
  y,
  width,
  title = "",
  text = "",
  fillColor,
  borderColor,
  accentColor,
  font,
  bold,
  textColor,
  muted,
  titleSize = 9.2,
  bodySize = 8.7,
  bodyGap = 2.5,
  padding = 14,
}) {
  const titleBlock = title ? 16 : 0;
  const bodyHeight = Math.max(bodySize + 2, measurePdfTextBlock(text || " ", width - padding * 2, font, bodySize, bodyGap));
  const height = padding + titleBlock + bodyHeight + 12;
  drawRoundedPdfBox(page, x, y, width, height, fillColor, borderColor, 1.1);
  let cursorY = y + height - padding - (title ? titleSize : 0);
  if (title) {
    page.drawText(title, { x: x + padding, y: cursorY, size: titleSize, font: bold, color: accentColor });
    cursorY -= titleSize + 10;
  }
  drawPdfTextBlock(page, text || " ", x + padding, cursorY, width - padding * 2, font, bodySize, textColor || muted, bodyGap);
  return height;
}

export function drawLegalDocStamp(page, { x, y, width = 160, height = 78, white, bold, font, rut = "", docType = "", docNumber = "" }) {
  const legalRed = hexToRgb("#c1121f");
  const centerText = (text, size, yy, color, useBold = false) => {
    const safe = String(text || "");
    const targetFont = useBold ? bold : font;
    const textWidth = targetFont.widthOfTextAtSize(safe, size);
    page.drawText(safe, {
      x: x + Math.max(10, (width - textWidth) / 2),
      y: yy,
      size,
      font: targetFont,
      color,
    });
  };
  drawRoundedPdfBox(page, x, y, width, height, white, legalRed, 1.6);
  centerText(rut || "RUT —", 8.8, y + height - 18, legalRed, true);
  centerText(String(docType || "DOCUMENTO").toUpperCase(), 11.8, y + height - 42, legalRed, true);
  centerText(`N° ${docNumber || "S/C"}`, 10.6, y + height - 64, legalRed, true);
}

export function createCommercialPdfDeps({
  dbGet,
  DEFAULT_PRINT_LAYOUTS,
  normalizePrintLayouts,
  hexToRgb,
  companyPaymentInfoText,
  budgetPaymentMethodValue,
  budgetPaymentDateValue,
  budgetPaymentNotesValue,
  budgetObservationValue,
  drawLegalDocStamp,
  drawDocumentSectionBox,
  drawRoundedPdfBox,
  drawRightAlignedPdfText,
  drawSummaryPanel,
  measurePdfTextBlock,
  wrapPdfText,
  recurringSummary,
  fmtD,
  fmtMoney,
  fmtM,
  today,
  companyPrintColor,
  cobranzaState,
}) {
  return {
    dbGet,
    DEFAULT_PRINT_LAYOUTS,
    normalizePrintLayouts,
    hexToRgb,
    companyPaymentInfoText,
    budgetPaymentMethodValue,
    budgetPaymentDateValue,
    budgetPaymentNotesValue,
    budgetObservationValue,
    drawLegalDocStamp,
    drawDocumentSectionBox,
    drawRoundedPdfBox,
    drawRightAlignedPdfText,
    drawSummaryPanel,
    measurePdfTextBlock,
    wrapPdfText,
    recurringSummary,
    fmtD,
    fmtMoney,
    fmtM,
    today,
    companyPrintColor,
    cobranzaState,
  };
}

export function presupuestoPdfFileName(pres = {}) {
  return `${(pres.correlativo || pres.titulo || "presupuesto").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "presupuesto"}.pdf`;
}

export function facturaPdfFileName(fact = {}) {
  const prefix = resolveProduBillingDocumentType(fact.documentTypeCode || fact.tipoDocumento || fact.tipoDoc)?.code || "documento";
  return `${prefix}_${String(fact.correlativo || "documento").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase()}.pdf`;
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
