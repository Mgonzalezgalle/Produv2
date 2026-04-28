import { PDFDocument, StandardFonts } from "pdf-lib";
import { drawRightAlignedPdfText, drawRoundedPdfBox, hexToRgb } from "../lab/commercialPdfBase";
import { drawWrappedText, fitPdfImageDimensions, loadPdfImage } from "./pdf";

function safe(value = "", fallback = "—") {
  const text = String(value || "").trim();
  return text || fallback;
}

function normalizeMoney(value = 0) {
  return Number(value || 0);
}

function money(value = 0, currency = "CLP") {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: String(currency || "CLP").toUpperCase(),
    maximumFractionDigits: 0,
  }).format(normalizeMoney(value));
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(i, i + chunkSize));
  }
  return btoa(binary);
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

export async function buildIssuedOrderPdfFile(order = {}, empresa = {}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accent = hexToRgb(empresa?.color || "#00d4e8");
  const white = hexToRgb("#ffffff");
  const text = hexToRgb("#0f172a");
  const muted = hexToRgb("#64748b");
  const panel = hexToRgb("#f8fafc");
  const border = hexToRgb("#cbd5e1");

  const currency = String(order?.currency || "CLP").toUpperCase();
  const items = normalizeItems(order?.items);
  const total = orderTotal(order);

  page.drawRectangle({ x: 0, y: 0, width, height, color: white });
  page.drawRectangle({ x: 0, y: height - 92, width, height: 92, color: accent });

  const logo = await loadPdfImage(pdf, empresa?.logo || "");
  if (logo) {
    const dims = fitPdfImageDimensions(logo, 94, 48);
    if (dims) {
      page.drawImage(logo, { x: 36, y: height - 70, width: dims.width, height: dims.height });
    }
  } else {
    page.drawText(safe(empresa?.nombre || empresa?.nom, "Produ"), {
      x: 36,
      y: height - 54,
      size: 24,
      font: bold,
      color: white,
    });
  }
  page.drawText("ORDEN DE COMPRA", {
    x: width - 250,
    y: height - 50,
    size: 22,
    font: bold,
    color: white,
  });

  drawRoundedPdfBox(page, 36, height - 206, 250, 96, white, border, 1.1);
  page.drawText(safe(empresa?.nombre || empresa?.nom), { x: 50, y: height - 132, size: 16, font: bold, color: text });
  const issuerLines = [
    empresa?.rut ? `RUT: ${empresa.rut}` : "",
    empresa?.giro ? `Giro: ${empresa.giro}` : "",
    empresa?.dir || "",
    [empresa?.ema, empresa?.tel].filter(Boolean).join(" · "),
  ].filter(Boolean);
  let issuerY = height - 152;
  issuerLines.forEach(line => {
    page.drawText(line, { x: 50, y: issuerY, size: 10, font, color: muted });
    issuerY -= 13;
  });

  drawRoundedPdfBox(page, 318, height - 206, 258, 96, panel, border, 1.1);
  page.drawText(`N° ${safe(order?.number, "S/N")}`, { x: 332, y: height - 142, size: 18, font: bold, color: text });
  page.drawText(`Fecha: ${safe(order?.issueDate, "—")}`, { x: 332, y: height - 164, size: 12, font, color: muted });
  if (order?.approvalStatus) {
    page.drawText(`Estado: ${safe(order.approvalStatus)}`, { x: 332, y: height - 184, size: 11, font, color: text });
  }

  const sectionTitle = (label, y) => {
    page.drawText(label, { x: 36, y, size: 11, font: bold, color: accent });
  };
  const drawLabelValue = (label, value, x, y, labelWidth, valueWidth) => {
    page.drawText(label, { x, y, size: 10, font: bold, color: text });
    const lines = String(value || "—").split("\n");
    let currentY = y;
    lines.forEach(line => {
      page.drawText(line, { x: x + labelWidth, y: currentY, size: 10, font, color: text, maxWidth: valueWidth });
      currentY -= 12;
    });
  };

  sectionTitle("DETALLE INTERNO", height - 236);
  drawRoundedPdfBox(page, 36, height - 336, 540, 86, white, border, 1.1);
  drawLabelValue("Solicitante:", safe(order?.requesterName), 52, height - 276, 110, 146);
  drawLabelValue("Contacto:", safe(order?.requesterEmail), 52, height - 300, 110, 146);
  drawLabelValue("Centro costo:", safe(order?.costCenter), 308, height - 276, 110, 146);
  drawLabelValue("Categoría:", safe(order?.category), 308, height - 300, 110, 146);
  drawLabelValue("Producción:", safe(order?.productionName), 308, height - 324, 110, 146);

  sectionTitle("INFORMACIÓN DEL PROVEEDOR", height - 366);
  drawRoundedPdfBox(page, 36, height - 512, 540, 132, white, border, 1.1);
  drawLabelValue("Razón social:", safe(order?.supplierLegalName || order?.supplier), 52, height - 410, 110, 160);
  drawLabelValue("RUT:", safe(order?.supplierRut), 52, height - 434, 110, 160);
  drawLabelValue("Dirección:", safe(order?.supplierAddress), 52, height - 458, 110, 160);
  drawLabelValue("Comuna:", safe(order?.supplierDistrict), 52, height - 482, 110, 160);
  drawLabelValue("Ciudad:", safe(order?.supplierCity), 52, height - 506, 110, 160);
  drawLabelValue("Moneda:", safe(currency), 308, height - 410, 110, 146);
  drawLabelValue("Contacto:", safe(order?.supplierContactName), 308, height - 434, 110, 146);
  drawLabelValue("Correo:", safe(order?.supplierContactEmail), 308, height - 458, 110, 146);
  drawLabelValue("Teléfono:", safe(order?.supplierContactPhone), 308, height - 482, 110, 146);
  drawLabelValue("Forma pago:", safe(order?.paymentMethod), 308, height - 506, 110, 146);

  const tableX = 36;
  const tableWidth = 540;
  const headerY = height - 560;
  const columns = {
    desc: { x: tableX + 12, width: 180, label: "DESCRIPCIÓN" },
    qty: { x: tableX + 208, width: 42, label: "CANTIDAD" },
    unit: { x: tableX + 266, width: 96, label: "PRECIO UNITARIO" },
    discount: { x: tableX + 378, width: 82, label: "DESCUENTO" },
    subtotal: { x: tableX + 476, width: 52, label: "SUBTOTAL" },
  };
  page.drawLine({ start: { x: tableX, y: headerY }, end: { x: tableX + tableWidth, y: headerY }, thickness: 1, color: text });
  Object.values(columns).forEach(col => {
    page.drawText(col.label, { x: col.x, y: headerY + 8, size: 8.7, font: bold, color: text });
  });

  let rowY = headerY - 18;
  const safeItems = items.length ? items : [{
    description: safe(order?.notes || "Sin detalle cargado."),
    quantity: 1,
    unitPrice: total,
    discount: 0,
    subtotal: total,
  }];
  safeItems.slice(0, 8).forEach(item => {
    const descriptionLines = [];
    const raw = String(item.description || "").trim() || "Ítem";
    const words = raw.split(/\s+/);
    let line = "";
    words.forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, 8.4) > columns.desc.width && line) {
        descriptionLines.push(line);
        line = word;
      } else {
        line = next;
      }
    });
    if (line) descriptionLines.push(line);
    const shownLines = descriptionLines.slice(0, 2);
    shownLines.forEach((lineText, index) => {
      page.drawText(lineText, { x: columns.desc.x, y: rowY - index * 12, size: 8.7, font, color: text });
    });
    drawRightAlignedPdfText(page, String(item.quantity || 0), columns.qty.x, rowY, columns.qty.width, font, 8.7, text);
    drawRightAlignedPdfText(page, money(item.unitPrice, currency), columns.unit.x, rowY, columns.unit.width, font, 8.7, text);
    drawRightAlignedPdfText(page, item.discount ? money(item.discount, currency) : "-", columns.discount.x, rowY, columns.discount.width, font, 8.7, text);
    drawRightAlignedPdfText(page, money(item.subtotal, currency), columns.subtotal.x, rowY, columns.subtotal.width, bold, 8.7, text);
    rowY -= shownLines.length > 1 ? 28 : 20;
  });

  const observationsY = 184;
  page.drawText("OBSERVACIONES:", { x: 36, y: observationsY, size: 10.5, font: bold, color: text });
  drawWrappedText(page, safe(order?.notes, "Sin observaciones."), 154, observationsY, 380, font, 10, muted, 4);

  const approvalBoxY = 72;
  drawRoundedPdfBox(page, 36, approvalBoxY, 260, 70, panel, border, 1.1);
  page.drawText("Aprobada por", { x: 50, y: approvalBoxY + 46, size: 10, font: bold, color: text });
  page.drawText(safe(order?.approvedBy || order?.requesterName), { x: 50, y: approvalBoxY + 26, size: 12, font, color: text });
  page.drawText(safe(order?.approvedAt || order?.issueDate), { x: 50, y: approvalBoxY + 8, size: 10, font, color: muted });

  drawRoundedPdfBox(page, 338, approvalBoxY, 238, 70, white, border, 1.1);
  page.drawText("TOTAL NETO", { x: 352, y: approvalBoxY + 40, size: 10, font, color: text });
  drawRightAlignedPdfText(page, money(total, currency), 474, approvalBoxY + 40, 88, font, 10, text);
  page.drawText("TOTAL", { x: 352, y: approvalBoxY + 18, size: 12, font: bold, color: text });
  drawRightAlignedPdfText(page, money(total, currency), 474, approvalBoxY + 18, 88, bold, 12, text);

  const bytes = await pdf.save();
  return new File([bytes], issuedOrderPdfFileName(order), { type: "application/pdf" });
}

export async function buildIssuedOrderPdfDataUrl(order = {}, empresa = {}) {
  const file = await buildIssuedOrderPdfFile(order, empresa);
  const bytes = new Uint8Array(await file.arrayBuffer());
  return `data:application/pdf;base64,${bytesToBase64(bytes)}`;
}
