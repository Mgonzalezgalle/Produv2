import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  downloadFile,
  drawDocumentSectionBox,
  drawLegalDocStamp,
  drawRoundedPdfBox,
  drawSummaryPanel,
  facturaPdfFileName,
  measurePdfTextBlock,
} from "./commercialPdfBase";

export async function buildFactPdfFile(fact, entidad, ref, empresa, deps) {
  const {
    dbGet,
    DEFAULT_PRINT_LAYOUTS,
    normalizePrintLayouts,
    companyPrintColor,
    hexToRgb,
    companyPaymentInfoText,
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
