import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawCommercialLabel,
  drawDocumentSectionBox,
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
    total: { label: "Total", x: x + 492, width: 70 },
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

export async function buildIssuedOrderPdfFile(order = {}, empresa = {}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const accentColor = hexToRgb("#344155");
  const textColor = hexToRgb("#111827");
  const muted = hexToRgb("#667085");
  const white = hexToRgb("#ffffff");
  const surface = hexToRgb("#f7f8fa");
  const border = hexToRgb("#d4d8df");
  const margin = 38;
  const contentWidth = width - margin * 2;

  const items = normalizeItems(order?.items);
  const currency = String(order?.currency || "CLP").toUpperCase();
  const total = orderTotal(order);
  const issueDate = order?.issueDate || "";
  const title = "Orden de Compra";
  const docType = "OC Emitida";
  const compactTitle = String(order?.number || title).trim();

  page.drawRectangle({ x: 0, y: 0, width, height, color: white });
  page.drawRectangle({ x: margin, y: height - 40, width: contentWidth, height: 2, color: accentColor });
  page.drawText(empresa?.nombre || empresa?.nom || "Produ", {
    x: margin,
    y: height - 58,
    size: 17,
    font: bold,
    color: textColor,
    maxWidth: 250,
  });
  page.drawText(title, {
    x: margin,
    y: height - 79,
    size: 10,
    font: bold,
    color: accentColor,
  });
  const issuerLines = [
    empresa?.rut,
    empresa?.dir,
    [empresa?.ema, empresa?.tel].filter(Boolean).join(" · "),
  ].filter(Boolean);
  let issuerY = height - 96;
  issuerLines.forEach(line => {
    page.drawText(line, { x: margin, y: issuerY, size: 8.7, font, color: muted, maxWidth: 260 });
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
    docNumber: compactTitle || "S/C",
    docTypeOffsetY: 1,
  });
  const stampMetaX = metaCardX + 14;
  page.drawText(`Fecha: ${fmtD(issueDate)}`, { x: stampMetaX, y: metaCardY + 8, size: 8.7, font, color: textColor });
  page.drawText(`Estado: ${safe(order?.approvalStatus, "Emitida")}`, { x: stampMetaX + 82, y: metaCardY + 8, size: 8.7, font, color: textColor });

  let y = height - 170;
  const supplierText = [
    order?.supplierLegalName || order?.supplier || "—",
    order?.supplierRut ? `RUT: ${order.supplierRut}` : "",
    order?.supplierAddress || "",
    [order?.supplierDistrict, order?.supplierCity].filter(Boolean).join(" · "),
    order?.supplierContactName ? `Contacto: ${order.supplierContactName}` : "",
    [order?.supplierContactEmail, order?.supplierContactPhone].filter(Boolean).join(" · "),
  ].filter(Boolean).join("\n");
  const supplierHeight = drawDocumentSectionBox(page, {
    x: margin,
    y: y - 86,
    width: contentWidth,
    title: "Proveedor",
    text: supplierText,
    fillColor: surface,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    muted,
    titleSize: 9.2,
    bodySize: 8.8,
    bodyGap: 1.8,
    bodyOffsetY: 3,
  });
  const supplierTopY = y - 86 + supplierHeight;
  drawCommercialLabel(page, "Moneda", width - margin - 152, supplierTopY - 24, 74, accentColor, bold, white, 8.6);
  page.drawText(currency, { x: width - margin - 66, y: supplierTopY - 18, size: 9, font: bold, color: textColor });
  y -= supplierHeight + 18;

  const internalText = [
    `Solicitante: ${safe(order?.requesterName)}`,
    `Contacto: ${safe(order?.requesterEmail)}`,
    `Centro de costo: ${safe(order?.costCenter)}`,
    `Categoría: ${safe(order?.category)}`,
    `Producción / proyecto: ${safe(order?.productionName)}`,
    `Forma de pago: ${safe(order?.paymentMethod)}`,
  ].join("\n");
  const internalTextHeight = Math.max(8.8 + 2, measurePdfTextBlock(internalText, contentWidth - 28, font, 8.8, 1.8));
  const internalHeight = 14 + 16 + internalTextHeight + 12;
  drawDocumentSectionBox(page, {
    x: margin,
    y: y - internalHeight,
    width: contentWidth,
    title: "Contexto interno",
    text: internalText,
    fillColor: surface,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    muted,
    titleSize: 9.2,
    bodySize: 8.8,
    bodyGap: 1.8,
    bodyOffsetY: 3,
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
    y,
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

  const notesHeight = drawDocumentSectionBox(page, {
    x: margin,
    y: y - 80,
    width: contentWidth,
    title: "Observaciones",
    text: safe(order?.notes, "Sin observaciones."),
    fillColor: surface,
    borderColor: border,
    accentColor,
    font,
    bold,
    textColor,
    muted,
    titleSize: 9.2,
    bodySize: 8.8,
    bodyGap: 1.8,
    bodyOffsetY: 3,
  });
  y -= notesHeight + 18;

  drawSummaryPanel(page, {
    x: margin,
    y: y - 86,
    width: 250,
    rows: [
      { label: "Aprobada por", value: safe(order?.approvedBy || order?.requesterName), bold: true, valueSize: 9.4, labelSize: 7.8 },
      { label: "Fecha aprobación", value: fmtD(order?.approvedAt || issueDate), bold: true, valueSize: 9.4, labelSize: 7.8 },
      { label: "N° OC", value: safe(order?.number), bold: true, valueSize: 9.6, labelSize: 8.1 },
    ],
    labelWidth: 122,
    accentColor,
    bold,
    font,
    white,
    textColor,
    fillColor: white,
    borderColor: border,
    labelSize: 7.5,
    valueSize: 10,
  });
  drawSummaryPanel(page, {
    x: width - margin - 250,
    y: y - 86,
    width: 250,
    rows: [
      { label: "SubTotal", value: money(total, currency), bold: true, valueSize: 10.2 },
      { label: "Descuentos", value: money(safeItems.reduce((sum, item) => sum + Number(item.discount || 0), 0), currency), bold: false, valueSize: 9.2 },
      { label: "TOTAL FINAL", value: money(total, currency), bold: true, valueSize: 11, color: accentColor, labelSize: 7.8 },
    ],
    labelWidth: 118,
    accentColor,
    bold,
    font,
    white,
    textColor,
    fillColor: white,
    borderColor: border,
    labelSize: 7.5,
    valueSize: 10,
  });

  const bytes = await pdf.save();
  return new File([bytes], issuedOrderPdfFileName(order), { type: "application/pdf" });
}

export async function buildIssuedOrderPdfDataUrl(order = {}, empresa = {}) {
  const file = await buildIssuedOrderPdfFile(order, empresa);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:application/pdf;base64,${bytesToBase64(bytes)}`;
}
