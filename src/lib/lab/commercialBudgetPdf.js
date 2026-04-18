import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawCommercialLabel,
  downloadFile,
  drawDocumentSectionBox,
  drawLegalDocStamp,
  drawRightAlignedPdfText,
  drawRoundedPdfBox,
  drawSummaryPanel,
  measurePdfTextBlock,
  presupuestoPdfFileName,
  wrapPdfText,
} from "./commercialPdfBase";

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
  const pageTint = hexToRgb("#eef3fb");
  const surface = hexToRgb("#f8fafc");
  const border = hexToRgb("#cbd5e1");
  const contact = (cliente?.contactos || [])[0];
  const margin = 38;
  const contentWidth = width - margin * 2;
  const subtotal = Number(pres.subtotal || 0);
  const ivaVal = Number(pres.ivaVal || 0);
  const total = Number(pres.total || 0);
  const subtotalOrigen = Number(pres.subtotalOrigen || 0);
  const totalOrigen = Number(pres.totalOrigen || 0);
  const usesFx = String(pres.moneda || "CLP").toUpperCase() !== "CLP";
  const legalRed = hexToRgb("#c1121f");
  const paymentInfo = companyPaymentInfoText(empresa, {
    dueDate: pres.fechaPago || "",
  });
  const items = (pres.items || []).length ? (pres.items || []) : [{ id: "empty", desc: "Sin ítems", qty: 0, precio: 0, recurrence: "once" }];
  const budgetTitle = String(pres.titulo || pres.correlativo || "Presupuesto comercial").trim();
  const budgetSubtitle = [
    cliente?.nom ? `Propuesta para ${cliente.nom}` : "",
    items.length ? `${items.length} ${items.length === 1 ? "ítem" : "ítems"}` : "",
  ].filter(Boolean).join(" · ");
  const heroHeight = 136;
  const heroY = height - margin - heroHeight;
  const metaCardWidth = 184;
  const heroContentWidth = contentWidth - metaCardWidth - 18;
  const heroTitleLines = wrapPdfText(budgetTitle, heroContentWidth - 12, bold, 17.8);
  const heroTitleLineHeight = 18.8;
  const titleStartY = heroY + heroHeight - 66;
  const issuerLines = [
    empresa?.rut,
    empresa?.dir,
    [empresa?.ema, empresa?.tel].filter(Boolean).join(" · "),
  ].filter(Boolean);
  const clientBodySize = layout.sectionBodySize || 8.6;
  const clientBodyGap = 2.2;
  const clientTitleSize = layout.sectionTitleSize || 9.4;

  page.drawRectangle({ x: 0, y: 0, width, height, color: pageTint });
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: accentColor });
  drawRoundedPdfBox(page, margin, heroY, contentWidth, heroHeight, white, border, 1.1);
  drawRoundedPdfBox(page, margin + 1, heroY + heroHeight - 5, contentWidth - 2, 4, accentColor, accentColor, 0);
  drawCommercialLabel(page, "Propuesta comercial", margin + 18, heroY + heroHeight - 36, 132, accentColor, bold, white, 9.4);
  heroTitleLines.forEach((line, index) => {
    page.drawText(line, {
      x: margin + 18,
      y: titleStartY - (index * heroTitleLineHeight),
      size: 17.8,
      font: bold,
      color: textColor,
      maxWidth: heroContentWidth - 10,
    });
  });
  if (budgetSubtitle) {
    page.drawText(budgetSubtitle, {
      x: margin + 18,
      y: titleStartY - (heroTitleLines.length * heroTitleLineHeight) - 6,
      size: 9.2,
      font,
      color: muted,
      maxWidth: heroContentWidth - 10,
    });
  }
  drawCommercialLabel(page, `Total ${fmtMoney(total, "CLP")}`, margin + 18, heroY + 14, 152, accentColor, bold, white, 8.8);
  page.drawText(empresa?.nombre || "", {
    x: margin + 18,
    y: heroY + 58,
    size: layout.companyTitleSize || 15.5,
    font: bold,
    color: textColor,
    maxWidth: heroContentWidth - 12,
  });
  let issuerY = heroY + 42;
  issuerLines.forEach((line) => {
    page.drawText(line, {
      x: margin + 18,
      y: issuerY,
      size: layout.metaSize || 9,
      font,
      color: muted,
      maxWidth: heroContentWidth - 12,
    });
    issuerY -= 12;
  });

  const metaCardX = width - margin - metaCardWidth - 14;
  const metaCardY = heroY + 14;
  drawRoundedPdfBox(page, metaCardX, metaCardY, metaCardWidth, heroHeight - 28, surface, border, 1);
  drawLegalDocStamp(page, {
    x: metaCardX + 12,
    y: metaCardY + 30,
    width: metaCardWidth - 24,
    height: 70,
    white,
    bold,
    font,
    rut: empresa?.rut || "",
    docType: "Presupuesto",
    docNumber: pres.correlativo || "",
  });
  const stampMetaX = metaCardX + 14;
  page.drawText(`Fecha: ${fmtD(pres.cr || today())}`, { x: stampMetaX, y: metaCardY + 10, size: layout.metaSize || 9, font, color: textColor });
  page.drawText(`Validez: ${pres.validez || 30} días`, { x: stampMetaX + 86, y: metaCardY + 10, size: layout.metaSize || 9, font, color: textColor });

  let y = heroY - 18;
  const clientText = [
    cliente?.nom || "—",
    cliente?.rut ? `RUT: ${cliente.rut}` : "",
    cliente?.dir || "",
    contact ? `Contacto: ${contact.nom}${contact.car ? ` · ${contact.car}` : ""}` : "",
    contact ? [contact.ema, contact.tel].filter(Boolean).join(" · ") : "",
  ].filter(Boolean).join("\n");
  const clientTextHeight = Math.max(clientBodySize + 2, measurePdfTextBlock(clientText || " ", contentWidth - 28, font, clientBodySize, clientBodyGap));
  const clientHeight = 14 + 16 + clientTextHeight + 12;
  const clientBoxY = y - clientHeight;
  drawDocumentSectionBox(page, {
    x: margin,
    y: clientBoxY,
    width: contentWidth,
    title: "Cliente",
    text: clientText,
    fillColor: surface,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    muted,
    titleSize: clientTitleSize,
    bodySize: clientBodySize,
    bodyGap: clientBodyGap,
  });
  const clientTopY = clientBoxY + clientHeight;
  const clientMetaY = clientTopY - 18;
  page.drawText(`Moneda: ${pres.moneda || "CLP"}`, {
    x: width - margin - 170,
    y: clientMetaY,
    size: layout.metaSize || 9,
    font: bold,
    color: textColor,
  });
  if (usesFx) {
    page.drawText(`Tipo cambio: ${Number(pres.tipoCambio || 1).toLocaleString("es-CL")} CLP`, {
      x: width - margin - 170,
      y: clientMetaY - 13,
      size: layout.metaSize || 9,
      font,
      color: muted,
    });
  }
  y = clientBoxY - 22;

  const columns = {
    detail: { label: "Detalle", x: margin + 14, width: layout.detailColWidth || 300 },
    recurrence: { label: "Recurrencia", x: margin + 28 + (layout.detailColWidth || 300), width: layout.recurrenceColWidth || 78 },
    qty: { label: "Cant.", x: margin + 36 + (layout.detailColWidth || 300) + (layout.recurrenceColWidth || 78), width: layout.qtyColWidth || 34 },
    unit: { label: "Valor Unit.", x: margin + 42 + (layout.detailColWidth || 300) + (layout.recurrenceColWidth || 78) + (layout.qtyColWidth || 34), width: layout.unitColWidth || 74 },
    total: { label: "Total", x: width - margin - (layout.totalColWidth || 42), width: layout.totalColWidth || 42 },
  };
  page.drawText("Detalle económico", { x: margin, y: y + 8, size: 10.5, font: bold, color: accentColor });
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
    drawRoundedPdfBox(page, margin, y - rowHeight + 6, contentWidth, rowHeight, idx % 2 === 0 ? white : pageTint, border, 0.8);
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
    drawRightAlignedPdfText(page, fmtMoney(Number(item.precioOrigen ?? item.precio ?? 0), pres.moneda || "CLP"), columns.unit.x, valueY, columns.unit.width, font, layout.detailBodySize || 7.1, textColor);
    drawRightAlignedPdfText(page, fmtMoney(Number(item.totalOrigen ?? (Number(item.qty || 0) * Number(item.precioOrigen ?? item.precio ?? 0))), pres.moneda || "CLP"), columns.total.x, valueY, columns.total.width, bold, Math.max((layout.detailBodySize || 7.1) + 0.2, 7.3), textColor);
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
      ...(usesFx ? [{ label: "SubTotal origen", value: fmtMoney(subtotalOrigen, pres.moneda || "CLP"), bold: true, valueSize: 9.4 }] : []),
      { label: "SubTotal CLP", value: fmtMoney(subtotal, "CLP"), bold: true, valueSize: 11 },
      { label: "Impuestos CLP", value: (pres.iva || pres.honorarios) ? fmtMoney(ivaVal, "CLP") : "0", bold: true, valueSize: 9.6 },
      { label: "TOTAL FINAL CLP", value: fmtMoney(total, "CLP"), bold: true, valueSize: 11, labelSize: 7.8, color: legalRed },
      ...(usesFx ? [{ label: "Referencia origen", value: fmtMoney(totalOrigen, pres.moneda || "CLP"), bold: false, valueSize: 8.6 }] : []),
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
  drawRightAlignedPdfText(page, "Gracias por confiar en Produ.", width - margin - 156, 24, 156, font, 8.5, muted);
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
