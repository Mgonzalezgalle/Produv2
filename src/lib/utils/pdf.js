import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  drawRightAlignedPdfText,
  drawRoundedPdfBox,
  hexToRgb,
  wrapPdfText,
} from "../lab/commercialPdfBase";

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

export async function buildModernPdf({
  fileName,
  title,
  accent = "#00d4e8",
  empresa,
  counterpartTitle,
  counterpartName,
  counterpartLines = [],
  metaLines = [],
  summaryRows = [],
  bodySections = [],
  summaryPlacement = "inline",
  footerPrimary = "Generado con Produ",
  footerSecondary = "",
}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const accentColor = hexToRgb(accent);
  const textColor = hexToRgb("#0f172a");
  const muted = hexToRgb("#64748b");
  const panel = hexToRgb("#f8fafc");
  const white = hexToRgb("#ffffff");
  const border = hexToRgb("#cbd5e1");
  const pageWidth = 612;
  const pageHeight = 792;
  let page = null;
  let width = pageWidth;
  let height = pageHeight;

  const drawRoundedBlock = (targetPage, x, y, w, h, color) => {
    const r = 12;
    targetPage.drawRectangle({ x: x + r, y, width: w - (r * 2), height: h, color });
    targetPage.drawRectangle({ x, y: y + r, width: w, height: h - (r * 2), color });
    targetPage.drawCircle({ x: x + r, y: y + r, size: r, color });
    targetPage.drawCircle({ x: x + w - r, y: y + r, size: r, color });
    targetPage.drawCircle({ x: x + r, y: y + h - r, size: r, color });
    targetPage.drawCircle({ x: x + w - r, y: y + h - r, size: r, color });
  };
  const drawCard = (targetPage, x, y, w, h, titleText, titleColor = white, headerFill = accentColor) => {
    drawRoundedBlock(targetPage, x, y, w, h, panel);
    drawRoundedBlock(targetPage, x, y + h - 28, w, 28, headerFill);
    targetPage.drawText(titleText, { x: x + 14, y: y + h - 18, size: 10, font: bold, color: titleColor });
  };
  const drawFooter = targetPage => {
    if (footerPrimary) {
      const primaryWidth = font.widthOfTextAtSize(footerPrimary, 9.2);
      targetPage.drawText(footerPrimary, {
        x: (pageWidth - primaryWidth) / 2,
        y: 28,
        size: 9.2,
        font,
        color: muted,
      });
    }
    if (footerSecondary) {
      const secondaryWidth = font.widthOfTextAtSize(footerSecondary, 8.5);
      targetPage.drawText(footerSecondary, {
        x: (pageWidth - secondaryWidth) / 2,
        y: 15,
        size: 8.5,
        font,
        color: muted,
      });
    }
  };

  const logo = await loadPdfImage(pdf, empresa?.logo || "");
  const drawPageHeader = targetPage => {
    targetPage.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: hexToRgb("#ffffff") });
    targetPage.drawRectangle({ x: 0, y: pageHeight - 96, width: pageWidth, height: 96, color: accentColor });
    if (logo) {
      const dims = fitPdfImageDimensions(logo, 108, 42);
      targetPage.drawImage(logo, { x: 36, y: pageHeight - 82, width: dims?.width || 84, height: dims?.height || 30 });
    } else {
      targetPage.drawText(empresa?.nombre || "produ", { x: 36, y: pageHeight - 56, size: 24, font: bold, color: white });
    }
    targetPage.drawText(title, { x: pageWidth - 300, y: pageHeight - 54, size: 22, font: bold, color: white });
  };
  const createPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    ({ width, height } = page.getSize());
    drawPageHeader(page);
    drawFooter(page);
    return page;
  };

  createPage();

  page.drawText(empresa?.nombre || "", { x: 36, y: height - 128, size: 18, font: bold, color: textColor });
  const emisorLines = [empresa?.rut, empresa?.dir, [empresa?.ema, empresa?.tel].filter(Boolean).join(" · ")].filter(Boolean);
  let emisorY = height - 150;
  emisorLines.forEach(line => {
    page.drawText(line, { x: 36, y: emisorY, size: 10, font, color: muted });
    emisorY -= 14;
  });

  drawCard(page, 36, height - 322, 258, 110, counterpartTitle);
  page.drawText(counterpartName || "—", { x: 50, y: height - 260, size: 16, font: bold, color: textColor });
  let cpY = height - 280;
  counterpartLines.filter(Boolean).forEach(line => {
    page.drawText(line, { x: 50, y: cpY, size: 10, font, color: muted });
    cpY -= 13;
  });

  drawCard(page, 318, height - 322, 258, 110, "Resumen");
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
    if (sectionY - sectionHeight < 72) {
      createPage();
      sectionY = height - 72;
    }
    drawCard(page, 36, sectionY - sectionHeight, 540, sectionHeight, section.title, white, accentColor);
    let innerY = sectionY - 46;
    if (section.rows) {
      section.rows.forEach(row => {
        drawRoundedBlock(page, 50, innerY - 8, 512, 22, white);
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
    drawCard(page, 318, 40, 258, 124, "Totales");
    let totalY = 126;
    summaryRows.forEach(row => {
      page.drawText(row.label, { x: 332, y: totalY, size: 10, font: row.highlight ? bold : font, color: row.highlight ? textColor : muted });
      page.drawText(row.value, { x: 468, y: totalY, size: 11, font: row.highlight ? bold : font, color: row.color || textColor });
      totalY -= 18;
    });
  }
  const bytes = await pdf.save();
  return new File([bytes], fileName, { type: "application/pdf" });
}

export async function buildEpisodeStatusPdf({
  fileName = "estado_episodios.pdf",
  title = "Estado de episodios",
  accent = "#1a1a2e",
  empresa = null,
  programa = null,
  episodios = [],
  formatDate = value => value || "—",
  generatedAt = "",
  footerPrimary = "Hecho con amor por Produ.",
  footerSecondary = "",
} = {}) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 842;
  const pageHeight = 595;
  const marginX = 34;
  const white = hexToRgb("#ffffff");
  const navy = hexToRgb("#1a1a2e");
  const text = hexToRgb("#0f172a");
  const muted = hexToRgb("#667085");
  const subtle = hexToRgb("#f6f9fd");
  const border = hexToRgb("#dbe7f5");
  const headerFill = hexToRgb("#f8fbff");
  const accentColor = hexToRgb(accent || "#1a1a2e");
  const rows = Array.isArray(episodios) ? episodios : [];
  const logo = await loadPdfImage(pdf, empresa?.logo || "");
  let page = null;
  let y = 0;

  const truncate = (value, maxWidth, targetFont = font, size = 9.5) => {
    const raw = String(value || "—");
    if (targetFont.widthOfTextAtSize(raw, size) <= maxWidth) return raw;
    let next = raw;
    while (next.length > 1 && targetFont.widthOfTextAtSize(`${next}...`, size) > maxWidth) {
      next = next.slice(0, -1);
    }
    return `${next.trimEnd()}...`;
  };
  const statusTone = status => {
    const normalized = String(status || "").trim().toLowerCase();
    if (normalized === "publicado" || normalized === "aprobado" || normalized === "grabado") return { bg: "#eafaf2", bd: "#bdf0d5", fg: "#35c879" };
    if (normalized === "programado" || normalized === "planificado") return { bg: "#f4edff", bd: "#dec8ff", fg: "#9b5cf6" };
    if (normalized.includes("edicion") || normalized.includes("edición")) return { bg: "#f3f4f6", bd: "#c6cad1", fg: "#1f2433" };
    if (normalized === "cancelado") return { bg: "#fff1f2", bd: "#fecdd3", fg: "#e5485d" };
    return { bg: "#eef5ff", bd: "#cfe0fb", fg: "#2b6df6" };
  };
  const drawFooter = targetPage => {
    const primaryWidth = font.widthOfTextAtSize(footerPrimary, 8.8);
    targetPage.drawText(footerPrimary, { x: (pageWidth - primaryWidth) / 2, y: 22, size: 8.8, font, color: muted });
    if (footerSecondary) {
      const secondaryWidth = font.widthOfTextAtSize(footerSecondary, 8);
      targetPage.drawText(footerSecondary, { x: (pageWidth - secondaryWidth) / 2, y: 10, size: 8, font, color: muted });
    }
  };
  const drawPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: white });
    page.drawRectangle({ x: 0, y: pageHeight - 82, width: pageWidth, height: 82, color: accentColor });
    if (logo) {
      const dims = fitPdfImageDimensions(logo, 118, 42);
      page.drawImage(logo, { x: marginX, y: pageHeight - 62, width: dims?.width || 92, height: dims?.height || 32 });
    } else {
      page.drawText(empresa?.nombre || "Produ", { x: marginX, y: pageHeight - 50, size: 20, font: bold, color: white });
    }
    page.drawText(title, { x: pageWidth - 300, y: pageHeight - 50, size: 19, font: bold, color: white });
    drawFooter(page);
    y = pageHeight - 112;
  };
  const drawTableHeader = () => {
    drawRoundedPdfBox(page, marginX, y - 28, pageWidth - marginX * 2, 32, headerFill, border, 0.8);
    const headers = [
      ["N°", marginX + 14],
      ["TITULO", marginX + 62],
      ["INVITADO", marginX + 464],
      ["GRABACION", marginX + 572],
      ["EMISION", marginX + 650],
      ["ESTADO", marginX + 736],
    ];
    headers.forEach(([label, x]) => page.drawText(label, { x, y: y - 10, size: 8.5, font: bold, color: muted }));
    y -= 42;
  };
  const ensureSpace = (needed = 44) => {
    if (y - needed < 48) {
      drawPage();
      drawTableHeader();
    }
  };

  drawPage();
  page.drawText(programa?.nom || "Producción", { x: marginX, y, size: 16, font: bold, color: text });
  page.drawText([programa?.tip, programa?.can, programa?.temporada ? `Temporada ${programa.temporada}` : ""].filter(Boolean).join(" · ") || "Estado de producción", { x: marginX, y: y - 18, size: 9.5, font, color: muted });
  const meta = [`Total episodios: ${rows.length}`, generatedAt ? `Generado: ${generatedAt}` : ""].filter(Boolean).join(" · ");
  page.drawText(meta, { x: pageWidth - marginX - bold.widthOfTextAtSize(meta, 9), y: y - 18, size: 9, font: bold, color: muted });
  y -= 48;
  drawTableHeader();

  if (!rows.length) {
    drawRoundedPdfBox(page, marginX, y - 42, pageWidth - marginX * 2, 48, subtle, border, 0.8);
    page.drawText("No hay episodios para exportar en esta producción.", { x: marginX + 16, y: y - 18, size: 10, font, color: muted });
  } else {
    rows.forEach(ep => {
      ensureSpace(38);
      page.drawLine({ start: { x: marginX, y: y - 20 }, end: { x: pageWidth - marginX, y: y - 20 }, thickness: 0.8, color: border });
      page.drawText(`#${String(ep?.num || "").padStart(2, "0")}`, { x: marginX + 14, y, size: 10, font: bold, color: navy });
      page.drawText(truncate(ep?.titulo || "Episodio", 365, bold, 9.6), { x: marginX + 62, y, size: 9.6, font: bold, color: text });
      page.drawText(truncate(ep?.invitado || "Por definir", 92, font, 9.4), { x: marginX + 464, y, size: 9.4, font, color: muted });
      page.drawText(formatDate(ep?.fechaGrab), { x: marginX + 572, y, size: 9.2, font, color: muted });
      page.drawText(formatDate(ep?.fechaEmision), { x: marginX + 650, y, size: 9.2, font, color: muted });
      const tone = statusTone(ep?.estado);
      drawRoundedPdfBox(page, marginX + 730, y - 8, 72, 20, hexToRgb(tone.bg), hexToRgb(tone.bd), 0.8);
      page.drawText(truncate(String(ep?.estado || "Sin estado").toUpperCase(), 58, bold, 7.6), { x: marginX + 740, y: y - 1, size: 7.6, font: bold, color: hexToRgb(tone.fg) });
      y -= 34;
    });
  }

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
