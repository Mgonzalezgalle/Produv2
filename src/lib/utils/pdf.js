import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawRightAlignedPdfText,
  drawRoundedPdfBox,
  hexToRgb,
  wrapPdfText,
} from "../lab/commercialPdf";

export function pdfEscape(text = "") {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function pdfHexColor(hex = "#000000") {
  const raw = String(hex || "#000000").replace("#", "");
  const normalized = raw.length === 3 ? raw.split("").map(ch => ch + ch).join("") : raw.padEnd(6, "0").slice(0, 6);
  const parts = normalized.match(/.{2}/g) || ["00", "00", "00"];
  return parts.map(p => (parseInt(p, 16) / 255).toFixed(3)).join(" ");
}

export async function loadPdfImage(doc, logoUrl = "") {
  if (!logoUrl) return null;
  try {
    const bytes = logoUrl.startsWith("data:")
      ? Uint8Array.from(atob(logoUrl.split(",")[1] || ""), c => c.charCodeAt(0))
      : new Uint8Array(await (await fetch(logoUrl)).arrayBuffer());
    if (logoUrl.includes("image/png") || logoUrl.toLowerCase().endsWith(".png")) return await doc.embedPng(bytes);
    return await doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

export function fitPdfImageDimensions(image, maxWidth, maxHeight) {
  if (!image) return null;
  const width = image.width || maxWidth;
  const height = image.height || maxHeight;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * scale, height: height * scale };
}

export function drawWrappedText(page, text, x, y, maxWidth, font, size, color, lineGap = 4) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return y;
  let line = "";
  let cursorY = y;
  words.forEach(word => {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      page.drawText(line, { x, y: cursorY, size, font, color });
      cursorY -= size + lineGap;
      line = word;
    } else {
      line = next;
    }
  });
  if (line) page.drawText(line, { x, y: cursorY, size, font, color });
  return cursorY - size - lineGap;
}

export function countWrappedTextLines(text, maxWidth, font, size) {
  const paragraphs = String(text || "").split("\n");
  let total = 0;
  paragraphs.forEach(paragraph => {
    const words = String(paragraph || "").split(/\s+/).filter(Boolean);
    if (!words.length) {
      total += 1;
      return;
    }
    let line = "";
    words.forEach(word => {
      const next = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
        total += 1;
        line = word;
      } else {
        line = next;
      }
    });
    if (line) total += 1;
  });
  return Math.max(total, 1);
}

export function drawCommercialValue(page, text, x, y, maxWidth, font, color, size = 12) {
  const safe = String(text || "—");
  page.drawText(safe, { x, y, size, font, color, maxWidth });
}

export function drawDocumentItemsTable(page, {
  x,
  y,
  width,
  items = [],
  title = "Detalle de los servicios",
  accentColor,
  white,
  surface,
  border,
  font,
  bold,
  textColor,
  moneyFormatter,
}) {
  const clampLines = (lines = [], maxLines = 2, maxWidth = 0, targetFont = font, size = 7.2) => {
    const safe = Array.isArray(lines) ? [...lines] : [String(lines || "")];
    if (safe.length <= maxLines) return safe;
    const trimmed = safe.slice(0, maxLines);
    let last = trimmed[maxLines - 1] || "";
    while (last && targetFont.widthOfTextAtSize(`${last}...`, size) > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    trimmed[maxLines - 1] = last ? `${last}...` : "...";
    return trimmed;
  };
  const columns = {
    detail: { label: "Detalle", x: x + 12, width: 340 },
    recurrence: { label: "Recurr.", x: x + 360, width: 46 },
    qty: { label: "Cant.", x: x + 412, width: 22 },
    unit: { label: "V. Unit.", x: x + 440, width: 54 },
    total: { label: "Total", x: x + 500, width: 62 },
  };
  page.drawText(title, {
    x,
    y: y + 6,
    size: 9,
    font: bold,
    color: accentColor,
  });
  drawRoundedPdfBox(page, x, y - 30, width, 30, accentColor, accentColor, 1);
  page.drawText(columns.detail.label, { x: columns.detail.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.recurrence.label, { x: columns.recurrence.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.qty.label, { x: columns.qty.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.unit.label, { x: columns.unit.x, y: y - 20, size: 7.7, font: bold, color: white });
  page.drawText(columns.total.label, { x: columns.total.x, y: y - 20, size: 7.7, font: bold, color: white });

  let cursorY = y - 36;
  const tableRows = (items || []).map(item => {
    const detailLines = clampLines(wrapPdfText(item.desc || "Ítem sin descripción", columns.detail.width, font, 7.1), 2, columns.detail.width, font, 7.1);
    const rowHeight = Math.max(22, detailLines.length * 8 + 10);
    return { item, detailLines, rowHeight };
  });
  const tableHeight = 30 + tableRows.reduce((sum, row) => sum + row.rowHeight + 4, 0) + 10;
  drawRoundedPdfBox(page, x, y - tableHeight + 6, width, tableHeight, white, border, 1.05);

  cursorY = y - 40;
  tableRows.forEach(({ item, detailLines, rowHeight }, idx) => {
    const rowY = cursorY - rowHeight + 6;
    page.drawRectangle({
      x,
      y: rowY,
      width,
      height: rowHeight,
      color: idx % 2 === 0 ? white : surface,
      borderColor: border,
      borderWidth: 0.6,
    });

    let lineY = rowY + rowHeight - 9;
    detailLines.forEach(line => {
      page.drawText(line || " ", {
        x: columns.detail.x,
        y: lineY,
        size: 7.1,
        font,
        color: textColor,
        maxWidth: columns.detail.width,
      });
      lineY -= 8;
    });

    const valueY = rowY + Math.max(6, (rowHeight - 7.2) / 2);
    page.drawText(item.recurrence === "monthly" ? "Mensual" : "Única vez", {
      x: columns.recurrence.x,
      y: valueY,
      size: 7.1,
      font,
      color: textColor,
      maxWidth: columns.recurrence.width,
    });
    drawRightAlignedPdfText(page, String(item.qty || 0), columns.qty.x, valueY, columns.qty.width, font, 7.1, textColor);
    drawRightAlignedPdfText(page, moneyFormatter(item.precio || 0), columns.unit.x, valueY, columns.unit.width, font, 7.1, textColor);
    drawRightAlignedPdfText(page, moneyFormatter(Number(item.qty || 0) * Number(item.precio || 0)), columns.total.x, valueY, columns.total.width, bold, 7.3, textColor);
    cursorY -= rowHeight + 4;
  });

  return cursorY - 2;
}

export async function buildModernPdf({ fileName, title, accent = "#00d4e8", empresa, counterpartTitle, counterpartName, counterpartLines = [], metaLines = [], summaryRows = [], bodySections = [], summaryPlacement = "inline" }) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accentColor = hexToRgb(accent);
  const textColor = hexToRgb("#0f172a");
  const muted = hexToRgb("#64748b");
  const panel = hexToRgb("#f8fafc");
  const white = hexToRgb("#ffffff");
  const border = hexToRgb("#cbd5e1");
  const drawRoundedBlock = (x, y, w, h, color) => {
    const r = 12;
    page.drawRectangle({ x: x + r, y, width: w - (r * 2), height: h, color });
    page.drawRectangle({ x, y: y + r, width: w, height: h - (r * 2), color });
    page.drawCircle({ x: x + r, y: y + r, size: r, color });
    page.drawCircle({ x: x + w - r, y: y + r, size: r, color });
    page.drawCircle({ x: x + r, y: y + h - r, size: r, color });
    page.drawCircle({ x: x + w - r, y: y + h - r, size: r, color });
  };
  const drawCard = (x, y, w, h, titleText, titleColor = white, headerFill = accentColor) => {
    drawRoundedBlock(x, y, w, h, panel);
    drawRoundedBlock(x, y + h - 28, w, 28, headerFill);
    page.drawText(titleText, { x: x + 14, y: y + h - 18, size: 10, font: bold, color: titleColor });
  };

  page.drawRectangle({ x: 0, y: 0, width, height, color: hexToRgb("#ffffff") });
  page.drawRectangle({ x: 0, y: height - 96, width, height: 96, color: accentColor });

  const logo = await loadPdfImage(pdf, empresa?.logo || "");
  if (logo) {
    const dims = logo.scale(0.3);
    page.drawImage(logo, { x: 36, y: height - 90, width: dims.width, height: dims.height });
  } else {
    page.drawText(empresa?.nombre || "produ", { x: 36, y: height - 56, size: 24, font: bold, color: white });
  }
  page.drawText(title, { x: width - 300, y: height - 54, size: 22, font: bold, color: white });

  page.drawText(empresa?.nombre || "", { x: 36, y: height - 128, size: 18, font: bold, color: textColor });
  const emisorLines = [empresa?.rut, empresa?.dir, [empresa?.ema, empresa?.tel].filter(Boolean).join(" · ")].filter(Boolean);
  let emisorY = height - 150;
  emisorLines.forEach(line => {
    page.drawText(line, { x: 36, y: emisorY, size: 10, font, color: muted });
    emisorY -= 14;
  });

  drawCard(36, height - 322, 258, 110, counterpartTitle);
  page.drawText(counterpartName || "—", { x: 50, y: height - 260, size: 16, font: bold, color: textColor });
  let cpY = height - 280;
  counterpartLines.filter(Boolean).forEach(line => {
    page.drawText(line, { x: 50, y: cpY, size: 10, font, color: muted });
    cpY -= 13;
  });

  drawCard(318, height - 322, 258, 110, "Resumen");
  let metaY = height - 250;
  metaLines.filter(Boolean).forEach(line => {
    page.drawText(line, { x: 332, y: metaY, size: 10, font, color: textColor });
    metaY -= 14;
  });

  let sectionY = height - 352;
  bodySections.forEach(section => {
    const sectionRows = section.rows || [];
    const textLines = section.text ? countWrappedTextLines(section.text, 500, font, 10) : 0;
    const textExtra = section.text ? 18 + textLines * 15 : 0;
    const sectionHeight = Math.max(70, 44 + sectionRows.length * 28 + textExtra);
    drawCard(36, sectionY - sectionHeight, 540, sectionHeight, section.title, white, accentColor);
    let innerY = sectionY - 46;
    if (section.rows) {
      section.rows.forEach(row => {
        drawRoundedBlock(50, innerY - 8, 512, 22, white);
        page.drawText(row.label, { x: 60, y: innerY - 1, size: 10, font: row.bold ? bold : font, color: textColor });
        page.drawText(row.value, { x: 350, y: innerY - 1, size: 10, font: row.valueBold ? bold : font, color: row.valueColor || textColor });
        innerY -= 28;
      });
    }
    if (section.text) {
      drawWrappedText(page, section.text, 54, innerY + 2, 500, font, 10, muted, 5);
    }
    sectionY -= sectionHeight + 14;
  });

  if (summaryPlacement === "fixed" && summaryRows.length) {
    drawCard(318, 40, 258, 124, "Totales");
    let totalY = 126;
    summaryRows.forEach(row => {
      page.drawText(row.label, { x: 332, y: totalY, size: 10, font: row.highlight ? bold : font, color: row.highlight ? textColor : muted });
      page.drawText(row.value, { x: 468, y: totalY, size: 11, font: row.highlight ? bold : font, color: row.color || textColor });
      totalY -= 18;
    });
  }
  page.drawText("Generado con Produ", { x: 36, y: 28, size: 9, font, color: muted });
  const bytes = await pdf.save();
  return new File([bytes], fileName, { type: "application/pdf" });
}

export function buildSimplePdfBlob(lines, accent = "#00d4e8") {
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 42;
  const marginY = 50;
  const defaultGap = 16;
  const pages = [];
  let current = [];
  let y = pageHeight - marginY;
  const pushPage = () => {
    pages.push(current);
    current = [];
    y = pageHeight - marginY;
  };
  const ensureGap = gap => {
    if (y - gap < marginY) pushPage();
  };

  (lines || []).forEach(line => {
    const text = String(line?.text ?? "");
    const chunks = text.split("\n");
    chunks.forEach((chunk, index) => {
      const size = line?.size || 12;
      const gap = index === chunks.length - 1 ? (line?.gap || defaultGap) : defaultGap;
      ensureGap(gap);
      current.push({
        x: line?.x ?? marginX,
        y,
        size,
        font: line?.bold ? "F2" : "F1",
        color: line?.color || "#1f2937",
        text: chunk,
      });
      y -= gap;
    });
  });
  if (current.length || !pages.length) pages.push(current);

  const objects = [];
  const addObject = value => {
    objects.push(value);
    return objects.length;
  };
  const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");

  const pageIds = [];
  const contentIds = [];
  pages.forEach(pageLines => {
    const commands = ["BT"];
    let lastFont = "";
    let lastSize = "";
    let lastColor = "";
    pageLines.forEach(line => {
      if (line.font !== lastFont || String(line.size) !== lastSize) {
        commands.push(`/${line.font} ${line.size} Tf`);
        lastFont = line.font;
        lastSize = String(line.size);
      }
      const color = pdfHexColor(line.color);
      if (color !== lastColor) {
        commands.push(`${color} rg`);
        lastColor = color;
      }
      commands.push(`1 0 0 1 ${line.x} ${line.y} Tm (${pdfEscape(line.text)}) Tj`);
    });
    commands.push("ET");
    const stream = commands.join("\n");
    const contentId = addObject(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    contentIds.push(contentId);
    pageIds.push(addObject(`<< /Type /Page /Parent PAGES_ID 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`));
  });

  const pagesId = addObject(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
  pageIds.forEach((id, index) => {
    objects[id - 1] = objects[id - 1].replace("PAGES_ID", String(pagesId));
    objects[contentIds[index] - 1] = objects[contentIds[index] - 1].replace("ACCENT_COLOR", pdfHexColor(accent));
  });
  const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(off => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}
