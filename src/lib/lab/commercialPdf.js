import { rgb, PDFDocument, StandardFonts } from "pdf-lib";

export function hexToRgb(hex = "#000000") {
  const raw = String(hex || "#000000").replace("#", "");
  const normalized = raw.length === 3 ? raw.split("").map(ch => ch + ch).join("") : raw.padEnd(6, "0").slice(0, 6);
  const parts = normalized.match(/.{2}/g) || ["00", "00", "00"];
  const [r, g, b] = parts.map(p => parseInt(p, 16) / 255);
  return rgb(r, g, b);
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
  const prefix = fact.tipoDoc === "Invoice" ? "invoice" : "orden_factura";
  return `${prefix}_${String(fact.correlativo || "documento").replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase()}.pdf`;
}

function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

export async function buildBudgetPdfFile(pres, cliente, empresa, deps) {
  const {
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
    today,
  } = deps;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const printLayouts = normalizePrintLayouts((await dbGet("produ:printLayouts")) || DEFAULT_PRINT_LAYOUTS);
  const layout = printLayouts.budget;
  const accentColor = hexToRgb(layout.accent || "#1f2f5f");
  const textColor = hexToRgb("#111827");
  const muted = hexToRgb("#5b6474");
  const white = hexToRgb("#ffffff");
  const surface = hexToRgb("#f8fafc");
  const border = hexToRgb("#cbd5e1");
  const contact = (cliente?.contactos || [])[0];
  const margin = 38;
  const contentWidth = width - margin * 2;
  const subtotal = Number(pres.subtotal || 0);
  const ivaVal = Number(pres.ivaVal || 0);
  const total = Number(pres.total || 0);
  const legalRed = hexToRgb("#c1121f");
  const paymentInfo = companyPaymentInfoText(empresa, {
    dueDate: pres.fechaPago || "",
  });
  const items = (pres.items || []).length ? (pres.items || []) : [{ id: "empty", desc: "Sin ítems", qty: 0, precio: 0, recurrence: "once" }];

  page.drawRectangle({ x: 0, y: 0, width, height, color: white });

  const issuerTextX = margin;
  page.drawText(empresa?.nombre || "", { x: issuerTextX, y: height - 58, size: layout.companyTitleSize || 18, font: bold, color: textColor });
  const issuerLines = [empresa?.rut, empresa?.dir, [empresa?.ema, empresa?.tel].filter(Boolean).join(" · ")].filter(Boolean);
  let issuerY = height - 82;
  issuerLines.forEach((line) => {
    page.drawText(line, { x: issuerTextX, y: issuerY, size: layout.metaSize || 9, font, color: muted, maxWidth: 255 });
    issuerY -= 13;
  });
  drawLegalDocStamp(page, {
    x: width - margin - (layout.stampWidth || 158),
    y: height - 34 - (layout.stampHeight || 84),
    width: layout.stampWidth || 158,
    height: layout.stampHeight || 84,
    white,
    bold,
    font,
    rut: empresa?.rut || "",
    docType: "Presupuesto",
    docNumber: pres.correlativo || "",
  });
  const stampX = width - margin - (layout.stampWidth || 158);
  page.drawText(`Fecha: ${fmtD(pres.cr || today())}`, { x: stampX, y: height - 146, size: layout.metaSize || 9, font, color: textColor });
  page.drawText(`Validez: ${pres.validez || 30} días`, { x: stampX, y: height - 160, size: layout.metaSize || 9, font, color: textColor });
  page.drawText(`Moneda: ${pres.moneda || "CLP"}`, { x: stampX, y: height - 174, size: layout.metaSize || 9, font, color: textColor });

  let y = height - 196;
  const clientText = [
    cliente?.nom || "—",
    cliente?.rut ? `RUT: ${cliente.rut}` : "",
    cliente?.dir || "",
    contact ? `Contacto: ${contact.nom}${contact.car ? ` · ${contact.car}` : ""}` : "",
    contact ? [contact.ema, contact.tel].filter(Boolean).join(" · ") : "",
  ].filter(Boolean).join("\n");
  const clientHeight = drawDocumentSectionBox(page, {
    x: margin,
    y: y - 94,
    width: contentWidth,
    title: "Cliente",
    text: clientText,
    fillColor: white,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    muted,
    titleSize: layout.sectionTitleSize || 9.4,
    bodySize: layout.sectionBodySize || 8.6,
    bodyGap: 2.2,
  });
  y -= clientHeight + 20;

  const columns = {
    detail: { label: "Detalle", x: margin + 14, width: layout.detailColWidth || 300 },
    recurrence: { label: "Recurrencia", x: margin + 28 + (layout.detailColWidth || 300), width: layout.recurrenceColWidth || 78 },
    qty: { label: "Cant.", x: margin + 36 + (layout.detailColWidth || 300) + (layout.recurrenceColWidth || 78), width: layout.qtyColWidth || 34 },
    unit: { label: "Valor Unit.", x: margin + 42 + (layout.detailColWidth || 300) + (layout.recurrenceColWidth || 78) + (layout.qtyColWidth || 34), width: layout.unitColWidth || 74 },
    total: { label: "Total", x: width - margin - (layout.totalColWidth || 42), width: layout.totalColWidth || 42 },
  };
  drawRoundedPdfBox(page, margin, y - 30, contentWidth, 30, accentColor, accentColor, 1);
  page.drawText(columns.detail.label, { x: columns.detail.x, y: y - 20, size: layout.detailHeaderSize || 7.7, font: bold, color: white });
  page.drawText(columns.recurrence.label, { x: columns.recurrence.x, y: y - 20, size: layout.detailHeaderSize || 7.7, font: bold, color: white });
  page.drawText(columns.qty.label, { x: columns.qty.x, y: y - 20, size: layout.detailHeaderSize || 7.7, font: bold, color: white });
  page.drawText(columns.unit.label, { x: columns.unit.x, y: y - 20, size: layout.detailHeaderSize || 7.7, font: bold, color: white });
  page.drawText(columns.total.label, { x: columns.total.x, y: y - 20, size: layout.detailHeaderSize || 7.7, font: bold, color: white });
  y -= 42;

  items.forEach((item, idx) => {
    const detailLines = wrapPdfText(item.desc || "Ítem sin descripción", columns.detail.width, font, layout.detailBodySize || 7.1);
    const rowHeight = Math.max(24, detailLines.length * 9 + 12);
    drawRoundedPdfBox(page, margin, y - rowHeight + 6, contentWidth, rowHeight, idx % 2 === 0 ? white : surface, border, 0.8);
    let lineY = y - 8;
    detailLines.forEach((line) => {
      page.drawText(line || " ", {
        x: columns.detail.x,
        y: lineY,
        size: layout.detailBodySize || 7.1,
        font,
        color: textColor,
        maxWidth: columns.detail.width,
      });
      lineY -= 9;
    });
    const valueY = y - 11;
    page.drawText(item.recurrence === "monthly" ? "Mensual" : "Única vez", {
      x: columns.recurrence.x,
      y: valueY,
      size: layout.detailBodySize || 7.1,
      font,
      color: textColor,
      maxWidth: columns.recurrence.width,
    });
    drawRightAlignedPdfText(page, String(item.qty || 0), columns.qty.x, valueY, columns.qty.width, font, layout.detailBodySize || 7.1, textColor);
    drawRightAlignedPdfText(page, fmtMoney(item.precio || 0, pres.moneda || "CLP"), columns.unit.x, valueY, columns.unit.width, font, layout.detailBodySize || 7.1, textColor);
    drawRightAlignedPdfText(page, fmtMoney(Number(item.qty || 0) * Number(item.precio || 0), pres.moneda || "CLP"), columns.total.x, valueY, columns.total.width, bold, Math.max((layout.detailBodySize || 7.1) + 0.2, 7.3), textColor);
    y -= rowHeight + 4;
  });

  const paymentCardY = y - 148;
  const cardWidth = (contentWidth - 22) / 2;
  drawSummaryPanel(page, {
    x: margin,
    y: paymentCardY,
    width: cardWidth,
    rows: [
      { label: "Método de pago", value: budgetPaymentMethodValue(pres) || "Por definir", bold: true, valueSize: 9.4, labelSize: 7.8 },
      { label: "Fecha de pago", value: budgetPaymentDateValue(pres) ? fmtD(budgetPaymentDateValue(pres)) : "Al iniciar", bold: true, valueSize: 9.4, labelSize: 7.8 },
      { label: "Validez", value: `${pres.validez || 30} días`, bold: true, valueSize: 9.6, labelSize: 8.1 },
    ],
    labelWidth: 136,
    accentColor: legalRed,
    bold,
    font,
    white,
    textColor,
    fillColor: white,
    borderColor: border,
    labelSize: layout.summaryLabelSize || 7.5,
    valueSize: layout.summaryValueSize || 10,
  });
  const rightCardX = margin + cardWidth + 22;
  drawSummaryPanel(page, {
    x: rightCardX,
    y: paymentCardY,
    width: cardWidth,
    rows: [
      { label: "SubTotal", value: fmtMoney(subtotal, pres.moneda || "CLP"), bold: true, valueSize: 11 },
      { label: "Impuestos", value: (pres.iva || pres.honorarios) ? fmtMoney(ivaVal, pres.moneda || "CLP") : "0", bold: true, valueSize: 9.6 },
      { label: "TOTAL FINAL", value: fmtMoney(total, pres.moneda || "CLP"), bold: true, valueSize: 11, labelSize: 7.8, color: legalRed },
    ],
    labelWidth: 116,
    accentColor,
    bold,
    font,
    white,
    textColor,
    fillColor: white,
    borderColor: border,
    labelSize: layout.summaryLabelSize || 7.5,
    valueSize: layout.summaryValueSize || 10,
  });

  let sectionY = paymentCardY - 22;
  if (paymentInfo) {
    const paymentHeight = drawDocumentSectionBox(page, {
      x: margin,
      y: sectionY - Math.max(98, measurePdfTextBlock(paymentInfo, contentWidth - 28, font, 8.8, 2.2) + 34),
      width: contentWidth,
      title: "Datos de pago",
      text: paymentInfo,
      fillColor: white,
      borderColor: border,
      accentColor,
      font,
      bold,
      textColor,
      muted,
      titleSize: layout.sectionTitleSize || 9.2,
      bodySize: layout.sectionBodySize || 8.8,
      bodyGap: 2.2,
    });
    sectionY -= paymentHeight + 14;
  }
  const budgetNotes = [budgetPaymentNotesValue(pres), budgetObservationValue(pres)].filter(Boolean).join("\n\n");
  if (budgetNotes) {
    drawDocumentSectionBox(page, {
      x: margin,
      y: sectionY - Math.max(82, measurePdfTextBlock(budgetNotes, contentWidth - 28, font, 8.6, 2.2) + 34),
      width: contentWidth,
      title: "Observaciones",
      text: budgetNotes,
      fillColor: white,
      borderColor: border,
      accentColor,
      font,
      bold,
      textColor,
      muted,
      titleSize: layout.sectionTitleSize || 9.2,
      bodySize: layout.sectionBodySize || 8.6,
      bodyGap: 2.2,
    });
  }

  page.drawText("Documento generado desde Produ", { x: margin, y: 24, size: 8.5, font, color: muted });
  const bytes = await pdf.save();
  return new File([bytes], presupuestoPdfFileName(pres), { type: "application/pdf" });
}

export async function generateBudgetPdf(pres, cliente, empresa, deps) {
  try {
    const file = await buildBudgetPdfFile(pres, cliente, empresa, deps);
    downloadFile(file);
    return file;
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el PDF del presupuesto.");
    return null;
  }
}

export async function sendBudgetToWhatsApp(pres, cliente, empresa, deps) {
  const contacto = (cliente?.contactos || [])[0];
  if (!contacto?.tel) {
    alert("El cliente no tiene teléfono de contacto registrado.");
    return;
  }
  let file;
  try {
    file = await buildBudgetPdfFile(pres, cliente, empresa, deps);
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el PDF del presupuesto.");
    return;
  }
  const msg = `Hola ${contacto.nom || ""}, te compartimos el presupuesto ${pres.correlativo || pres.titulo || ""}.`;
  const canShareFile = typeof navigator !== "undefined" && navigator.share && navigator.canShare && navigator.canShare({ files: [file] });
  if (canShareFile) {
    await navigator.share({ files: [file], title: pres.titulo || "Presupuesto", text: msg });
    return;
  }
  downloadFile(file);
  const num = String(contacto.tel || "").replace(/[^0-9]/g, "");
  const waNum = num.startsWith("56") ? num : `56${num}`;
  window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(`${msg} El PDF ya se descargó en tu dispositivo para adjuntarlo en este chat.`)}`, "_blank");
}

export async function buildFactPdfFile(fact, entidad, ref, empresa, deps) {
  const {
    dbGet,
    DEFAULT_PRINT_LAYOUTS,
    normalizePrintLayouts,
    companyPrintColor,
    hexToRgb,
    companyPaymentInfoText,
    drawLegalDocStamp,
    drawDocumentSectionBox,
    drawRoundedPdfBox,
    drawSummaryPanel,
    measurePdfTextBlock,
    recurringSummary,
    fmtD,
    fmtM,
    cobranzaState,
    today,
  } = deps;
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const printLayouts = normalizePrintLayouts((await dbGet("produ:printLayouts")) || DEFAULT_PRINT_LAYOUTS);
  const layout = printLayouts.billing;
  const accent = layout.accent || companyPrintColor(empresa);
  const accentColor = hexToRgb(accent);
  const textColor = hexToRgb("#111827");
  const muted = hexToRgb("#667085");
  const white = hexToRgb("#ffffff");
  const surface = hexToRgb("#f1f5f9");
  const border = hexToRgb("#94a3b8");
  const margin = 38;
  const contentWidth = width - margin * 2;
  const mn = Number(fact.montoNeto || 0);
  const ivaV = fact.iva ? Math.round(mn * 0.19) : 0;
  const total = Number(fact.total || (mn + ivaV));
  const docType = fact.tipoDoc || "Orden de Factura";
  const paymentInfo = companyPaymentInfoText(empresa, {
    dueDate: fact.fechaVencimiento || "",
  });

  page.drawRectangle({ x: 0, y: 0, width, height, color: white });
  page.drawText(empresa?.nombre || "", { x: margin, y: height - 58, size: layout.companyTitleSize || 17, font: bold, color: textColor });
  const issuerLines = [empresa?.dir, [empresa?.ema, empresa?.tel].filter(Boolean).join(" · ")].filter(Boolean);
  let issuerY = height - 82;
  issuerLines.forEach((line) => {
    page.drawText(line, { x: margin, y: issuerY, size: layout.metaSize || 8.7, font, color: muted });
    issuerY -= 11;
  });
  drawLegalDocStamp(page, {
    x: width - margin - (layout.stampWidth || 170),
    y: height - 24 - (layout.stampHeight || 82),
    width: layout.stampWidth || 170,
    height: layout.stampHeight || 82,
    white,
    bold,
    font,
    rut: empresa?.rut || "",
    docType,
    docNumber: fact.correlativo || "",
  });
  const stampX = width - margin - (layout.stampWidth || 170);
  page.drawText(`Fecha: ${fmtD(fact.fechaEmision || today())}`, { x: stampX, y: height - 120, size: layout.metaSize || 8.7, font, color: textColor });
  page.drawText(fact.fechaVencimiento ? `Vencimiento: ${fmtD(fact.fechaVencimiento)}` : "Sin vencimiento", { x: stampX, y: height - 132, size: layout.metaSize || 8.7, font, color: textColor });
  if (fact.recurring) {
    page.drawText(`Recurrencia: ${recurringSummary(fact, fact.fechaEmision || today())}`, { x: stampX, y: height - 144, size: layout.metaSize || 8.7, font, color: textColor });
  }

  let y = height - 170;
  const entityText = [
    entidad?.nom || "—",
    entidad?.rut ? `RUT: ${entidad.rut}` : "",
    entidad?.dir || "",
    entidad?.con ? `Contacto: ${entidad.con}` : "",
    [entidad?.ema, entidad?.tel].filter(Boolean).join(" · "),
  ].filter(Boolean).join("\n");
  const entityHeight = drawDocumentSectionBox(page, {
    x: margin,
    y: y - 86,
    width: contentWidth,
    title: fact.tipo === "auspiciador" ? "Auspiciador" : "Cliente",
    text: entityText,
    fillColor: surface,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    muted,
    titleSize: layout.sectionTitleSize || 9.2,
    bodySize: layout.sectionBodySize || 8.8,
    bodyGap: 1.8,
  });
  y -= entityHeight + 18;

  const detailHeight = 108;
  drawRoundedPdfBox(page, margin, y - detailHeight, contentWidth, detailHeight, white, border, 1.1);
  page.drawText("Detalle del documento", { x: margin + 14, y: y - 18, size: layout.sectionTitleSize || 9.2, font: bold, color: accentColor });
  const detailRows = [
    ["Tipo de documento", docType],
    ["Estado", fact.estado || "Emitida"],
    ["Referencia", ref ? `${ref.nom || "—"}` : "Sin referencia directa"],
    ["Cobranza", cobranzaState(fact)],
    ["Presupuesto", fact.presupuestoId || "—"],
    ["Contrato", fact.contratoId || "—"],
  ];
  let detailY = y - 42;
  detailRows.forEach(([label, value]) => {
    page.drawText(`${label}:`, { x: margin + 14, y: detailY, size: layout.sectionBodySize || 8.8, font: bold, color: textColor });
    page.drawText(String(value || "—"), { x: margin + 118, y: detailY, size: layout.sectionBodySize || 8.8, font, color: textColor, maxWidth: contentWidth - 144 });
    detailY -= 16;
  });
  y -= detailHeight + 18;

  const leftCardY = y - 150;
  const cardWidth = (contentWidth - 22) / 2;
  drawSummaryPanel(page, {
    x: margin,
    y: leftCardY,
    width: cardWidth,
    rows: [
      { label: docType === "Invoice" ? "Pago esperado" : "Monto neto", value: fmtM(mn), bold: true, valueSize: 11, labelSize: 7.8 },
      { label: "Fecha de pago", value: fact.fechaPago ? fmtD(fact.fechaPago) : (fact.fechaVencimiento ? fmtD(fact.fechaVencimiento) : "Por definir"), bold: true, valueSize: 9.4, labelSize: 7.9 },
    ],
    labelWidth: 140,
    accentColor,
    bold,
    font,
    white,
    textColor,
    fillColor: surface,
    borderColor: border,
    labelSize: layout.summaryLabelSize || 7.5,
    valueSize: layout.summaryValueSize || 10,
  });
  const factRightCardX = margin + cardWidth + 22;
  drawSummaryPanel(page, {
    x: factRightCardX,
    y: leftCardY,
    width: cardWidth,
    rows: [
      { label: "SubTotal", value: fmtM(mn), bold: true, valueSize: 11 },
      { label: docType === "Invoice" ? "Impuestos" : "IVA", value: docType === "Invoice" ? "0" : (fact.iva ? fmtM(ivaV) : "0"), bold: true, valueSize: 9.6, labelSize: 7.9 },
      { label: "Total", value: fmtM(total), bold: true, valueSize: 11 },
    ],
    labelWidth: 104,
    accentColor,
    bold,
    font,
    white,
    textColor,
    fillColor: surface,
    borderColor: border,
    labelSize: layout.summaryLabelSize || 7.5,
    valueSize: layout.summaryValueSize || 10,
  });

  let sectionY = leftCardY - 18;
  if (paymentInfo) {
    const paymentHeight = drawDocumentSectionBox(page, {
      x: margin,
      y: sectionY - Math.max(98, measurePdfTextBlock(paymentInfo, contentWidth - 28, font, 8.8, 2.2) + 34),
      width: contentWidth,
      title: "Datos de pago",
      text: paymentInfo,
      fillColor: white,
      borderColor: border,
      accentColor,
      font,
      bold,
      textColor,
      muted,
      titleSize: layout.sectionTitleSize || 9.2,
      bodySize: layout.sectionBodySize || 8.8,
      bodyGap: 2.2,
    });
    sectionY -= paymentHeight + 14;
  }
  const trailingNotes = [fact.obs || "", fact.obs2 || "", docType === "Invoice" ? "Este documento es un comprobante no tributario para servicios y mantiene el registro interno del movimiento en Produ." : ""].filter(Boolean).join("\n\n");
  if (trailingNotes) {
    drawDocumentSectionBox(page, {
      x: margin,
      y: sectionY - Math.max(84, measurePdfTextBlock(trailingNotes, contentWidth - 28, font, 8.6, 2.2) + 34),
      width: contentWidth,
      title: "Observaciones",
      text: trailingNotes,
      fillColor: surface,
      borderColor: border,
      accentColor,
      font,
      bold,
      textColor,
      muted,
      titleSize: layout.sectionTitleSize || 9.2,
      bodySize: layout.sectionBodySize || 8.8,
      bodyGap: 2.2,
    });
  }

  page.drawText("Documento generado desde Produ", { x: margin, y: 24, size: 8.5, font, color: muted });
  const bytes = await pdf.save();
  return new File([bytes], facturaPdfFileName(fact), { type: "application/pdf" });
}

export async function generateBillingPdf(fact, entidad, ref, empresa, deps) {
  try {
    const file = await buildFactPdfFile(fact, entidad, ref, empresa, deps);
    downloadFile(file);
    return file;
  } catch (err) {
    console.error(err);
    alert("No se pudo generar el PDF del documento.");
    return null;
  }
}
