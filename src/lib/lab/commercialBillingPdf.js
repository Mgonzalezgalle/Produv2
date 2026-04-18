import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawCommercialLabel,
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
  const pageTint = hexToRgb("#eef3fb");
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
  const docTitle = String(fact.correlativo || docType || "Documento comercial").trim();
  const docSubtitle = [
    entidad?.nom ? `Documento para ${entidad.nom}` : "",
    fact.recurring ? recurringSummary(fact, fact.fechaEmision || today()) : "",
  ].filter(Boolean).join(" · ");
  const heroHeight = 118;
  const heroY = height - margin - heroHeight;
  const metaCardWidth = 188;
  const heroContentWidth = contentWidth - metaCardWidth - 18;

  page.drawRectangle({ x: 0, y: 0, width, height, color: pageTint });
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: accentColor });
  drawRoundedPdfBox(page, margin, heroY, contentWidth, heroHeight, white, border, 1.1);
  drawRoundedPdfBox(page, margin + 1, heroY + heroHeight - 5, contentWidth - 2, 4, accentColor, accentColor, 0);
  drawCommercialLabel(page, docType, margin + 18, heroY + heroHeight - 36, 146, accentColor, bold, white, 9.2);
  page.drawText(docTitle, {
    x: margin + 18,
    y: heroY + heroHeight - 66,
    size: 19,
    font: bold,
    color: textColor,
    maxWidth: heroContentWidth - 10,
  });
  if (docSubtitle) {
    page.drawText(docSubtitle, {
      x: margin + 18,
      y: heroY + heroHeight - 88,
      size: 9.4,
      font,
      color: muted,
      maxWidth: heroContentWidth - 10,
    });
  }
  drawCommercialLabel(page, `Total ${fmtM(total)}`, margin + 18, heroY + 22, 144, accentColor, bold, white, 8.8);
  page.drawText(empresa?.nombre || "", {
    x: margin + 18,
    y: heroY + 44,
    size: layout.companyTitleSize || 17,
    font: bold,
    color: textColor,
    maxWidth: heroContentWidth - 12,
  });
  const issuerLines = [empresa?.rut, empresa?.dir, [empresa?.ema, empresa?.tel].filter(Boolean).join(" · ")].filter(Boolean);
  let issuerY = heroY + 29;
  issuerLines.forEach((line) => {
    page.drawText(line, {
      x: margin + 18,
      y: issuerY,
      size: layout.metaSize || 8.7,
      font,
      color: muted,
      maxWidth: heroContentWidth - 10,
    });
    issuerY -= 12;
  });

  const metaCardX = width - margin - metaCardWidth - 14;
  const metaCardY = heroY + 14;
  drawRoundedPdfBox(page, metaCardX, metaCardY, metaCardWidth, heroHeight - 28, surface, border, 1);
  drawLegalDocStamp(page, {
    x: metaCardX + 12,
    y: metaCardY + 22,
    width: metaCardWidth - 24,
    height: 62,
    white,
    bold,
    font,
    rut: empresa?.rut || "",
    docType,
    docNumber: fact.correlativo || "",
  });
  const stampMetaX = metaCardX + 14;
  page.drawText(`Fecha: ${fmtD(fact.fechaEmision || today())}`, { x: stampMetaX, y: metaCardY + 10, size: layout.metaSize || 8.7, font, color: textColor });
  page.drawText(fact.fechaVencimiento ? `Vence: ${fmtD(fact.fechaVencimiento)}` : "Sin vencimiento", { x: stampMetaX + 90, y: metaCardY + 10, size: layout.metaSize || 8.7, font, color: textColor });

  let y = heroY - 18;
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
  const entityMetaY = y - 26;
  page.drawText(`Estado: ${fact.estado || "Emitida"}`, {
    x: width - margin - 184,
    y: entityMetaY,
    size: layout.metaSize || 8.8,
    font: bold,
    color: textColor,
  });
  page.drawText(`Cobranza: ${cobranzaState(fact)}`, {
    x: width - margin - 184,
    y: entityMetaY - 13,
    size: layout.metaSize || 8.8,
    font,
    color: muted,
  });
  y -= entityHeight + 18;

  const detailHeight = 108;
  drawRoundedPdfBox(page, margin, y - detailHeight, contentWidth, detailHeight, white, border, 1.1);
  page.drawText("Detalle del documento", { x: margin + 14, y: y - 18, size: layout.sectionTitleSize || 9.8, font: bold, color: accentColor });
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
    fillColor: white,
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
    fillColor: white,
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
