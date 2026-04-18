import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  downloadFile,
  drawDocumentSectionBox,
  drawLegalDocStamp,
  drawRightAlignedPdfText,
  drawRoundedPdfBox,
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
  const accentColor = hexToRgb("#344155");
  const textColor = hexToRgb("#111827");
  const muted = hexToRgb("#667085");
  const white = hexToRgb("#ffffff");
  const surface = hexToRgb("#f7f8fa");
  const border = hexToRgb("#d4d8df");
  const margin = 38;
  const contentWidth = width - margin * 2;
  const mn = Number(fact.montoNeto || 0);
  const ivaV = fact.iva ? Math.round(mn * 0.19) : 0;
  const total = Number(fact.total || (mn + ivaV));
  const docType = fact.tipoDoc || "Orden de Factura";
  const paymentInfo = companyPaymentInfoText(empresa, {
    dueDate: fact.fechaVencimiento || "",
  });
  const compactDocTitle = String(docType || "Documento").trim();
  const drawLedgerRow = ({ x, y, width, label, value, strong = false, accent = false }) => {
    page.drawText(label, {
      x,
      y,
      size: strong ? 9 : 8.6,
      font: strong ? bold : font,
      color: accent ? accentColor : muted,
    });
    drawRightAlignedPdfText(page, value, x + 120, y, width - 120, strong ? bold : font, strong ? 10 : 9, accent ? accentColor : textColor);
  };

  page.drawRectangle({ x: 0, y: 0, width, height, color: white });
  page.drawRectangle({ x: margin, y: height - 40, width: contentWidth, height: 2, color: accentColor });
  page.drawText(empresa?.nombre || "", {
    x: margin,
    y: height - 58,
    size: layout.companyTitleSize || 17,
    font: bold,
    color: textColor,
    maxWidth: 250,
  });
  page.drawText(compactDocTitle, {
    x: margin,
    y: height - 79,
    size: 10,
    font: bold,
    color: accentColor,
  });
  const issuerLines = [empresa?.rut, empresa?.dir, [empresa?.ema, empresa?.tel].filter(Boolean).join(" · ")].filter(Boolean);
  let issuerY = height - 96;
  issuerLines.forEach((line) => {
    page.drawText(line, {
      x: margin,
      y: issuerY,
      size: layout.metaSize || 8.7,
      font,
      color: muted,
      maxWidth: 260,
    });
    issuerY -= 11;
  });

  const metaCardWidth = 188;
  const metaCardX = width - margin - metaCardWidth;
  const metaCardY = height - 138;
  drawRoundedPdfBox(page, metaCardX, metaCardY, metaCardWidth, 96, surface, border, 1);
  drawLegalDocStamp(page, {
    x: metaCardX + 12,
    y: metaCardY + 20,
    width: metaCardWidth - 24,
    height: 62,
    white,
    bold,
    font,
    rut: empresa?.rut || "",
    docType,
    docNumber: fact.correlativo || "",
    docTypeOffsetY: 1,
  });
  const stampMetaX = metaCardX + 14;
  page.drawText(`Fecha: ${fmtD(fact.fechaEmision || today())}`, { x: stampMetaX, y: metaCardY + 8, size: layout.metaSize || 8.7, font, color: textColor });
  page.drawText(fact.fechaVencimiento ? `Vencimiento: ${fmtD(fact.fechaVencimiento)}` : "Sin vencimiento", { x: stampMetaX + 78, y: metaCardY + 8, size: layout.metaSize || 8.7, font, color: textColor });
  if (fact.recurring) {
    page.drawText(`Recurrencia: ${recurringSummary(fact, fact.fechaEmision || today())}`, {
      x: metaCardX,
      y: metaCardY - 14,
      size: layout.metaSize || 8.7,
      font,
      color: muted,
    });
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
    bodyOffsetY: 3,
  });
  y -= entityHeight + 18;

  const detailHeight = 92;
  drawRoundedPdfBox(page, margin, y - detailHeight, contentWidth, detailHeight, surface, border, 0.8);
  page.drawText("Detalle del documento", { x: margin + 14, y: y - 18, size: layout.sectionTitleSize || 9.3, font: bold, color: accentColor });
  const detailRows = [
    ["Tipo de documento", docType],
    ["Estado", fact.estado || "Emitida"],
    ["Referencia", ref ? `${ref.nom || "—"}` : "Sin referencia directa"],
    ["Cobranza", cobranzaState(fact)],
    ["Presupuesto", fact.presupuestoId || "—"],
    ["Contrato", fact.contratoId || "—"],
  ];
  const detailLeftRows = detailRows.slice(0, 3);
  const detailRightRows = detailRows.slice(3);
  const detailColumnGap = 24;
  const detailColumnWidth = (contentWidth - 28 - detailColumnGap) / 2;
  const detailLabelWidth = 104;
  const detailValueWidth = detailColumnWidth - detailLabelWidth - 6;
  let detailY = y - 42;
  detailLeftRows.forEach(([label, value], index) => {
    const rightLabel = detailRightRows[index]?.[0];
    const rightValue = detailRightRows[index]?.[1];
    page.drawText(`${label}:`, {
      x: margin + 14,
      y: detailY,
      size: layout.sectionBodySize || 8.8,
      font: bold,
      color: textColor,
    });
    page.drawText(String(value || "—"), {
      x: margin + 14 + detailLabelWidth,
      y: detailY,
      size: layout.sectionBodySize || 8.8,
      font,
      color: textColor,
      maxWidth: detailValueWidth,
    });
    if (rightLabel) {
      const rightColumnX = margin + 14 + detailColumnWidth + detailColumnGap;
      page.drawText(`${rightLabel}:`, {
        x: rightColumnX,
        y: detailY,
        size: layout.sectionBodySize || 8.8,
        font: bold,
        color: textColor,
      });
      page.drawText(String(rightValue || "—"), {
        x: rightColumnX + detailLabelWidth,
        y: detailY,
        size: layout.sectionBodySize || 8.8,
        font,
        color: textColor,
        maxWidth: detailValueWidth,
      });
    }
    detailY -= 16;
  });
  y -= detailHeight + 18;

  const summaryY = y - 126;
  drawRoundedPdfBox(page, margin, summaryY, contentWidth, 126, surface, border, 0.8);
  page.drawText("Resumen de facturación", {
    x: margin + 14,
    y: summaryY + 104,
    size: 9.6,
    font: bold,
    color: accentColor,
  });
  page.drawText("Documento interno para control comercial y seguimiento de cobranza.", {
    x: margin + 14,
    y: summaryY + 89,
    size: 8.4,
    font,
    color: muted,
  });
  page.drawRectangle({
    x: margin + 14,
    y: summaryY + 74,
    width: contentWidth - 28,
    height: 1,
    color: border,
  });
  const leftLedgerX = margin + 14;
  const rightLedgerX = margin + (contentWidth / 2) + 6;
  const ledgerWidth = (contentWidth - 34) / 2;
  drawLedgerRow({
    x: leftLedgerX,
    y: summaryY + 56,
    width: ledgerWidth,
    label: docType === "Invoice" ? "Pago esperado" : "Monto neto",
    value: fmtM(mn),
    strong: true,
  });
  drawLedgerRow({
    x: leftLedgerX,
    y: summaryY + 36,
    width: ledgerWidth,
    label: "Fecha de pago",
    value: fact.fechaPago ? fmtD(fact.fechaPago) : (fact.fechaVencimiento ? fmtD(fact.fechaVencimiento) : "Por definir"),
  });
  drawLedgerRow({
    x: leftLedgerX,
    y: summaryY + 16,
    width: ledgerWidth,
    label: "Cobranza",
    value: cobranzaState(fact),
  });
  drawLedgerRow({
    x: rightLedgerX,
    y: summaryY + 56,
    width: ledgerWidth,
    label: "SubTotal",
    value: fmtM(mn),
    strong: true,
  });
  drawLedgerRow({
    x: rightLedgerX,
    y: summaryY + 36,
    width: ledgerWidth,
    label: docType === "Invoice" ? "Impuestos" : "IVA",
    value: docType === "Invoice" ? "0" : (fact.iva ? fmtM(ivaV) : "0"),
  });
  drawLedgerRow({
    x: rightLedgerX,
    y: summaryY + 16,
    width: ledgerWidth,
    label: "TOTAL DOCUMENTO",
    value: fmtM(total),
    strong: true,
    accent: true,
  });

  let sectionY = summaryY - 18;
  if (paymentInfo) {
    const paymentHeight = drawDocumentSectionBox(page, {
      x: margin,
      y: sectionY - Math.max(98, measurePdfTextBlock(paymentInfo, contentWidth - 28, font, 8.8, 2.2) + 34),
      width: contentWidth,
      title: "Datos de pago",
      text: paymentInfo,
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
  const footerNote = docType === "Invoice" ? "Seguimiento comercial y cobranza centralizados en Produ." : "Documento interno de seguimiento comercial.";
  drawRightAlignedPdfText(page, footerNote, width - margin - 240, 24, 240, font, 8.5, muted);
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
