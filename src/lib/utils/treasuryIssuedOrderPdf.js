import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawCommercialLabel,
  drawDocumentSectionBox,
  drawPdfTextBlock,
  drawLegalDocStamp,
  drawRightAlignedPdfText,
  drawRoundedPdfBox,
  drawSummaryPanel,
  hexToRgb,
  measurePdfTextBlock,
  wrapPdfText,
} from "../lab/commercialPdfBase";

function safe(value = "", fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
}

function money(value = 0, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: String(currency || "CLP").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function fmtD(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const slice = raw.slice(0, 10);
  const parts = slice.split("-");
  if (parts.length !== 3) return raw;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function normalizeItems(items = []) {
  return (Array.isArray(items) ? items : [])
    .map(item => {
      const quantity = Math.max(0, Number(item?.quantity || 0));
      const unitPrice = Math.max(0, Number(item?.unitPrice || 0));
      const discount = Math.max(0, Number(item?.discount || 0));
      const subtotal = Math.max(0, quantity * unitPrice - discount);
      return {
        id: item?.id || `line-${Math.random().toString(36).slice(2, 10)}`,
        description: String(item?.description || "").trim(),
        quantity,
        unitPrice,
        discount,
        subtotal,
      };
    })
    .filter(item => item.description || item.quantity || item.unitPrice || item.discount || item.subtotal);
}

function orderTotal(order = {}) {
  const items = normalizeItems(order?.items);
  if (items.length) return items.reduce((sum, item) => sum + item.subtotal, 0);
  return Math.max(0, Number(order?.amount || 0));
}

export function issuedOrderPdfFileName(order = {}) {
  const base = String(order?.number || order?.supplier || "orden-compra")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${base || "orden_compra"}.pdf`;
}

function buildItemTable(page, {
  x,
  y,
  width,
  items,
  font,
  bold,
  accentColor,
  textColor,
  white,
  surface,
  border,
  currency,
}) {
  const columns = {
    detail: { label: "Detalle", x: x + 14, width: 248 },
    qty: { label: "Cant.", x: x + 272, width: 36 },
    unit: { label: "Valor Unit.", x: x + 320, width: 92 },
    discount: { label: "Desc.", x: x + 420, width: 64 },
    total: { label: "Total", x: x + 470, width: 56 },
  };

  page.drawText("Detalle económico", { x, y: y + 8, size: 10.5, font: bold, color: accentColor });
  drawRoundedPdfBox(page, x, y - 30, width, 30, accentColor, accentColor, 1);
  page.drawText(columns.detail.label, { x: columns.detail.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.qty.label, { x: columns.qty.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.unit.label, { x: columns.unit.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.discount.label, { x: columns.discount.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.total.label, { x: columns.total.x, y: y - 20, size: 7.7, font: bold, color: white });

  let cursorY = y - 42;
  items.forEach((item, idx) => {
    const detailLines = wrapPdfText(item.description || "Ítem sin descripción", columns.detail.width, font, 7.1);
    const rowHeight = Math.max(24, detailLines.length * 9 + 12);
    drawRoundedPdfBox(page, x, cursorY - rowHeight + 6, width, rowHeight, idx % 2 === 0 ? white : surface, border, 0.8);
    let lineY = cursorY - 8;
    detailLines.forEach(line => {
      page.drawText(line || " ", { x: columns.detail.x, y: lineY, size: 7.1, font, color: textColor, maxWidth: columns.detail.width });
      lineY -= 9;
    });
    const valueY = cursorY - 11;
    drawRightAlignedPdfText(page, String(item.quantity || 0), columns.qty.x, valueY, columns.qty.width, font, 7.1, textColor);
    drawRightAlignedPdfText(page, money(item.unitPrice, currency), columns.unit.x, valueY, columns.unit.width, font, 7.1, textColor);
    drawRightAlignedPdfText(page, item.discount ? money(item.discount, currency) : "—", columns.discount.x, valueY, columns.discount.width, font, 7.1, textColor);
    drawRightAlignedPdfText(page, money(item.subtotal, currency), columns.total.x, valueY, columns.total.width, bold, 7.3, textColor);
    cursorY -= rowHeight + 4;
  });
  return cursorY;
}

function drawColorInfoPanel(page, {
  x,
  y,
  width,
  rows = [],
  labelWidth = 136,
  labelColor,
  valueColor,
  valueAccentColor = null,
  fillColor,
  borderColor,
  bold,
  font,
  white,
}) {
  const paddingX = 14;
  const paddingTop = 14;
  const labelHeight = 22;
  const rowGap = 8;
  const rowBlock = labelHeight + rowGap;
  const height = paddingTop * 2 + rows.length * rowBlock - rowGap;
  drawRoundedPdfBox(page, x, y, width, height, fillColor, borderColor, 1.1);
  const valueX = x + paddingX + labelWidth + 16;
  const valueWidth = width - (paddingX * 2) - labelWidth - 16;
  let rowY = y + height - paddingTop - labelHeight;
  rows.forEach((row, index) => {
    drawRoundedPdfBox(page, x + paddingX, rowY, labelWidth, labelHeight, labelColor, labelColor, 1);
    const labelText = String(row.label || "");
    const labelWidthText = bold.widthOfTextAtSize(labelText, 8.5);
    page.drawText(labelText, {
      x: x + paddingX + Math.max(10, (labelWidth - labelWidthText) / 2),
      y: rowY + 6.5,
      size: 8.5,
      font: bold,
      color: white,
      maxWidth: labelWidth - 20,
    });
    drawRightAlignedPdfText(
      page,
      row.value,
      valueX,
      rowY + 5.5,
      valueWidth,
      row.bold ? bold : font,
      row.valueSize || 9.8,
      row.color || (valueAccentColor && index === rows.length - 1 ? valueAccentColor : valueColor),
    );
    rowY -= rowBlock;
  });
  return height;
}

function drawFixedInfoCard(page, {
  x,
  y,
  width,
  height,
  title = "",
  text = "",
  fillColor,
  borderColor,
  accentColor,
  font,
  bold,
  textColor,
  lineGap = 2.2,
  bodySize = 8.8,
  bodyOffsetY = 0,
}) {
  const padding = 14;
  drawRoundedPdfBox(page, x, y, width, height, fillColor, borderColor, 1.1);
  const titleY = y + height - padding - 1;
  page.drawText(title, {
    x: x + padding,
    y: titleY,
    size: 9.2,
    font: bold,
    color: accentColor,
  });
  drawPdfTextBlock(
    page,
    text,
    x + padding,
    titleY - 18 + bodyOffsetY,
    width - padding * 2,
    font,
    bodySize,
    textColor,
    lineGap,
  );
}

function drawTwoColumnInfoCard(page, {
  x,
  y,
  width,
  title = "",
  leftLines = [],
  rightLines = [],
  fillColor,
  borderColor,
  accentColor,
  font,
  bold,
  textColor,
  bodySize = 8.6,
  bodyGap = 1.8,
}) {
  const padding = 14;
  const titleSize = 9.2;
  const colGap = 18;
  const colWidth = (width - padding * 2 - colGap) / 2;
  const leftText = leftLines.filter(Boolean).join("\n") || "—";
  const rightText = rightLines.filter(Boolean).join("\n") || "—";
  const leftHeight = measurePdfTextBlock(leftText, colWidth, font, bodySize, bodyGap);
  const rightHeight = measurePdfTextBlock(rightText, colWidth, font, bodySize, bodyGap);
  const bodyHeight = Math.max(leftHeight, rightHeight);
  const height = padding + titleSize + 10 + bodyHeight + 12;
  drawRoundedPdfBox(page, x, y, width, height, fillColor, borderColor, 1.1);
  const titleY = y + height - padding - 1;
  page.drawText(title, {
    x: x + padding,
    y: titleY,
    size: titleSize,
    font: bold,
    color: accentColor,
  });
  const bodyY = titleY - 18;
  drawPdfTextBlock(page, leftText, x + padding, bodyY, colWidth, font, bodySize, textColor, bodyGap);
  drawPdfTextBlock(page, rightText, x + padding + colWidth + colGap, bodyY, colWidth, font, bodySize, textColor, bodyGap);
  return height;
}

export async function buildIssuedOrderPdfFile(order = {}, empresa = {}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const accentColor = hexToRgb("#28386b");
  const textColor = hexToRgb("#1b2232");
  const muted = hexToRgb("#5f6b84");
  const white = hexToRgb("#ffffff");
  const surface = hexToRgb("#f5f8ff");
  const border = hexToRgb("#cad4e5");
  const alertColor = hexToRgb("#cf1124");
  const pageTint = hexToRgb("#edf3ff");
  const margin = 38;
  const contentWidth = width - margin * 2;

  const items = normalizeItems(order?.items);
  const currency = String(order?.currency || "CLP").toUpperCase();
  const total = orderTotal(order);
  const issueDate = order?.issueDate || "";
  const title = "Orden de Compra";
  const docType = "OC Emitida";
  const compactTitle = String(order?.number || title).trim();

  page.drawRectangle({ x: 0, y: 0, width, height, color: pageTint });
  page.drawRectangle({ x: 0, y: height - 112, width, height: 112, color: accentColor });
  drawRoundedPdfBox(page, margin, height - 196, contentWidth, 156, white, border, 1.1);
  page.drawText(empresa?.nombre || empresa?.nom || "Produ", {
    x: margin + 16,
    y: height - 110,
    size: 20,
    font: bold,
    color: textColor,
    maxWidth: 250,
  });
  page.drawText(title, {
    x: margin + 16,
    y: height - 133,
    size: 11.5,
    font: bold,
    color: textColor,
  });
  const issuerLines = [
    empresa?.rut,
    empresa?.dir,
    [empresa?.ema, empresa?.tel].filter(Boolean).join(" · "),
  ].filter(Boolean);
  let issuerY = height - 151;
  issuerLines.forEach(line => {
    page.drawText(line, { x: margin + 16, y: issuerY, size: 8.9, font, color: muted, maxWidth: 290 });
    issuerY -= 11;
  });

  const metaCardWidth = 188;
  const metaCardX = width - margin - metaCardWidth - 16;
  const metaCardY = height - 170;
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
    docNumber: compactTitle || "S/C",
    docTypeOffsetY: 1,
  });
  const stampMetaX = metaCardX + 14;
  page.drawText(`Fecha: ${fmtD(issueDate)}`, { x: stampMetaX, y: metaCardY + 8, size: 8.7, font, color: textColor });
  page.drawText(`Estado: ${safe(order?.approvalStatus, "Emitida")}`, { x: stampMetaX + 82, y: metaCardY + 8, size: 8.7, font, color: textColor });

  let y = height - 222;
  const supplierLeftLines = [
    order?.supplierLegalName || order?.supplier || "—",
    order?.supplierRut ? `RUT: ${order.supplierRut}` : "",
    order?.supplierAddress || "",
  ];
  const supplierRightLines = [
    [order?.supplierDistrict, order?.supplierCity].filter(Boolean).join(" · "),
    order?.supplierContactName ? `Contacto: ${order.supplierContactName}` : "",
    [order?.supplierContactEmail, order?.supplierContactPhone].filter(Boolean).join(" · "),
  ];
  const supplierHeight = drawTwoColumnInfoCard(page, {
    x: margin,
    y: y - 88,
    width: contentWidth,
    title: "Proveedor",
    leftLines: supplierLeftLines,
    rightLines: supplierRightLines,
    fillColor: white,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    bodySize: 8.8,
    bodyGap: 1.8,
  });
  y -= supplierHeight + 18;

  const internalLeftLines = [
    `Solicitante: ${safe(order?.requesterName)}`,
    `Contacto: ${safe(order?.requesterEmail)}`,
    `Centro de costo: ${safe(order?.costCenter)}`,
  ];
  const internalRightLines = [
    `Categoría: ${safe(order?.category)}`,
    `Producción / proyecto: ${safe(order?.productionName)}`,
    `Forma de pago: ${safe(order?.paymentMethod)}`,
  ];
  const internalHeight = drawTwoColumnInfoCard(page, {
    x: margin,
    y: y - 92,
    width: contentWidth,
    title: "Contexto interno",
    leftLines: internalLeftLines,
    rightLines: internalRightLines,
    fillColor: white,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    bodySize: 8.8,
    bodyGap: 1.8,
  });
  y -= internalHeight + 22;

  const safeItems = items.length ? items : [{
    description: safe(order?.notes || "Sin detalle cargado."),
    quantity: 1,
    unitPrice: total,
    discount: 0,
    subtotal: total,
  }];
  y = buildItemTable(page, {
    x: margin,
    y: y - 20,
    width: contentWidth,
    items: safeItems,
    font,
    bold,
    accentColor,
    textColor,
    white,
    surface,
    border,
    currency,
  }) - 10;

  const closingCardWidth = 250;
  const leftCardHeight = 52;
  const closingGap = 6;
  const notesY = y - leftCardHeight;
  const summaryY = notesY - closingGap - leftCardHeight;
  const totalY = summaryY;

  drawFixedInfoCard(page, {
    x: margin,
    y: notesY,
    width: closingCardWidth,
    height: leftCardHeight,
    title: "Observaciones",
    text: safe(order?.notes, "Sin observaciones."),
    fillColor: white,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    lineGap: 1.4,
    bodySize: 7.7,
  });

  drawFixedInfoCard(page, {
    x: margin,
    y: summaryY,
    width: closingCardWidth,
    height: leftCardHeight,
    title: "Resumen OC",
    text: [
      `Fecha: ${fmtD(issueDate)}`,
      `Estado: ${safe(order?.approvalStatus, "Emitida")}`,
      `Pago: ${safe(order?.paymentMethod, "Por definir")}`,
    ].join("\n"),
    fillColor: white,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    lineGap: 1.2,
    bodySize: 7.1,
    bodyOffsetY: 4,
  });

  drawColorInfoPanel(page, {
    x: width - margin - 250,
    y: totalY,
    width: 250,
    rows: [
      { label: "SubTotal", value: money(total, currency), bold: true, valueSize: 10.2 },
      { label: "Descuentos", value: money(safeItems.reduce((sum, item) => sum + Number(item.discount || 0), 0), currency), bold: false, valueSize: 9.2 },
      { label: "TOTAL FINAL", value: money(total, currency), bold: true, valueSize: 11, color: alertColor },
    ],
    labelWidth: 128,
    labelColor: accentColor,
    valueColor: textColor,
    valueAccentColor: alertColor,
    fillColor: white,
    borderColor: border,
    bold,
    font,
    white,
  });

  page.drawText("Documento generado desde Produ", {
    x: margin,
    y: 26,
    size: 7.5,
    font,
    color: muted,
  });
  const closing = "Gracias por confiar en Produ.";
  const closingWidth = font.widthOfTextAtSize(closing, 7.5);
  page.drawText(closing, {
    x: width - margin - closingWidth,
    y: 26,
    size: 7.5,
    font,
    color: muted,
  });

  const bytes = await pdf.save();
  return new File([bytes], issuedOrderPdfFileName(order), { type: "application/pdf" });
}

export async function buildIssuedOrderPdfDataUrl(order = {}, empresa = {}) {
  const file = await buildIssuedOrderPdfFile(order, empresa);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:application/pdf;base64,${bytesToBase64(bytes)}`;
}
