import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { resolveProduBillingDocumentType } from "../integrations/billingDomain";
import { normalizeTreasuryCurrency, TREASURY_CURRENCIES } from "./treasury";

const SHEET_ALIASES = {
  clients: ["clientes", "cliente", "clients"],
  providers: ["proveedores", "proveedor", "providers"],
  documentsReceivable: ["documentos cxc", "cxc documentos", "documentos", "cuentas por cobrar"],
  paymentsReceivable: ["pagos cxc", "pagos recibidos", "receipts"],
  documentsPayable: ["documentos cxp", "cxp documentos", "cuentas por pagar", "template"],
  paymentsPayable: ["pagos cxp", "pagos realizados", "payments"],
};

const HEADER_ALIASES = {
  banco_destino: "banco",
  comentario: "notas",
  cuenta_destino: "numero_cuenta",
  email_destino: "email",
  fecha_de_emision: "fecha_emision",
  fecha_de_vencimiento: "fecha_vencimiento",
  folio: "folio",
  id_beneficiario: "rut_proveedor",
  moneda: "moneda",
  monto: "monto",
  nombre: "nombre_proveedor",
  tipo_cuenta_destino: "tipo_cuenta",
};

const RECEIVABLE_STATUS_OPTIONS = ["Pendiente de pago", "Pagado", "No pagado", "Retrasado de pago", "Anulado"];
const PAYABLE_STATUS_OPTIONS = ["Pendiente", "Parcial", "Pagada", "Vencida", "Anulada"];
const PAYMENT_METHOD_OPTIONS = ["Transferencia", "Depósito", "Tarjeta", "Cheque", "Efectivo", "Mercado Pago", "Otro"];
const DOCUMENT_TYPE_OPTIONS = ["Factura Afecta", "Factura Exenta", "Boleta", "Nota de cobro", "Honorarios", "Otro"];
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeSheetName(value = "") {
  return normalizeKey(value).replace(/_/g, " ");
}

function normalizeHeader(value = "") {
  const key = normalizeKey(value);
  return HEADER_ALIASES[key] || key;
}

function decodeXmlEntities(value = "") {
  return String(value || "")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function parseXmlAttributes(value = "") {
  const attrs = {};
  String(value || "").replace(/([\w:-]+)="([^"]*)"/g, (_match, key, attrValue) => {
    attrs[key] = decodeXmlEntities(attrValue);
    return "";
  });
  return attrs;
}

function columnIndexFromCellRef(ref = "") {
  const letters = String(ref || "").match(/^[A-Z]+/i)?.[0] || "A";
  return letters.toUpperCase().split("").reduce((sum, letter) => (sum * 26) + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseSharedStrings(xml = "") {
  return Array.from(String(xml || "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)).map(match => {
    const textParts = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)).map(part => decodeXmlEntities(part[1]));
    return textParts.join("");
  });
}

function parseSheetXml(xml = "", sharedStrings = []) {
  return Array.from(String(xml || "").matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)).map(rowMatch => {
    const row = [];
    Array.from(rowMatch[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)).forEach(cellMatch => {
      const attrs = parseXmlAttributes(cellMatch[1]);
      const cellBody = cellMatch[2] || "";
      const index = columnIndexFromCellRef(attrs.r);
      const rawValue = cellBody.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";
      const inlineValue = cellBody.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)?.[1] ?? "";
      if (attrs.t === "s") row[index] = sharedStrings[Number(rawValue)] || "";
      else if (attrs.t === "inlineStr") row[index] = decodeXmlEntities(inlineValue);
      else row[index] = decodeXmlEntities(rawValue);
    });
    return row;
  }).filter(row => row.some(value => String(value || "").trim()));
}

function parseXlsxWorkbook(buffer) {
  const zip = unzipSync(new Uint8Array(buffer));
  const readEntry = path => zip[path] ? strFromU8(zip[path]) : "";
  const workbookXml = readEntry("xl/workbook.xml");
  const relsXml = readEntry("xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(readEntry("xl/sharedStrings.xml"));
  const rels = new Map(Array.from(relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)).map(match => {
    const attrs = parseXmlAttributes(match[1]);
    return [attrs.Id, attrs.Target];
  }));
  const worksheets = Array.from(workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)).map(match => {
    const attrs = parseXmlAttributes(match[1]);
    const relTarget = rels.get(attrs["r:id"]);
    const target = relTarget
      ? `xl/${String(relTarget).replace(/^\//, "").replace(/^xl\//, "")}`
      : `xl/worksheets/sheet${attrs.sheetId || 1}.xml`;
    return {
      name: attrs.name || `Hoja ${attrs.sheetId || ""}`.trim(),
      data: parseSheetXml(readEntry(target), sharedStrings),
    };
  });
  return { worksheets };
}

function normalizeDateValue(value = "") {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || /^\d+(\.\d+)?$/.test(String(value || "").trim())) {
    const serial = Number(value);
    if (Number.isFinite(serial) && serial > 20000 && serial < 90000) {
      const date = new Date(Date.UTC(1899, 11, 30 + serial));
      return date.toISOString().slice(0, 10);
    }
  }
  const raw = String(value || "").trim();
  if (!raw) return "";
  const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const chilean = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (chilean) return `${chilean[3]}-${String(chilean[2]).padStart(2, "0")}-${String(chilean[1]).padStart(2, "0")}`;
  return raw;
}

export function parseImportNumber(value = "") {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectRowsFromSheet(sheet) {
  if (!sheet) return [];
  const rows = Array.isArray(sheet?.data) ? sheet.data : Array.isArray(sheet) ? sheet : [];
  const [headers = [], ...body] = rows;
  const normalizedHeaders = headers.map(normalizeHeader);
  return body
    .map((row, rowIndex) => {
      const item = { __rowNumber: rowIndex + 2 };
      normalizedHeaders.forEach((header, index) => {
        if (!header) return;
        item[header] = row[index] ?? "";
      });
      return item;
    })
    .filter(item => Object.entries(item).some(([key, value]) => key !== "__rowNumber" && String(value || "").trim()));
}

function findSheet(workbook, aliases = []) {
  const wanted = aliases.map(normalizeSheetName);
  return (workbook.worksheets || workbook.sheets || []).find(sheet => {
    const normalized = normalizeSheetName(sheet?.name || sheet?.sheet);
    return wanted.some(alias => normalized === alias || normalized.includes(alias));
  }) || null;
}

function downloadBlob(blob, fileName) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, error: "browser_unavailable" };
  }
  if (!blob || !(blob instanceof Blob)) {
    return { ok: false, error: "invalid_blob" };
  }
  const safeName = String(fileName || "produ_importador.xlsx").trim() || "produ_importador.xlsx";
  const nav = window.navigator || {};
  try {
    if (typeof nav.msSaveOrOpenBlob === "function") {
      nav.msSaveOrOpenBlob(blob, safeName);
      return { ok: true, fileName: safeName };
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return { ok: true, fileName: safeName };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "download_failed",
    };
  }
}

function xmlEscape(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index = 0) {
  let dividend = index + 1;
  let name = "";
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return name;
}

function worksheetDimension(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowCount = Math.max(safeRows.length, 1);
  const colCount = Math.max(...safeRows.map(row => Array.isArray(row) ? row.length : 0), 1);
  return `A1:${columnName(colCount - 1)}${rowCount}`;
}

function worksheetXml(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const rowXml = safeRows.map((row, rowIndex) => {
    const cells = (Array.isArray(row) ? row : []).map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${worksheetDimension(safeRows)}"/>
  <sheetData>${rowXml}</sheetData>
</worksheet>`;
}

function workbookXml(sheetNames = []) {
  const sheets = sheetNames.map((name, index) => `<sheet name="${xmlEscape(name).slice(0, 31)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheets}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetNames = []) {
  const sheetRels = sheetNames.map((_name, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const stylesRelId = `rId${sheetNames.length + 1}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="${stylesRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function contentTypesXml(sheetNames = []) {
  const sheetOverrides = sheetNames.map((_name, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1"><font><sz val="11"/><name val="Inter"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function appPropsXml(sheetNames = []) {
  const headingPairs = sheetNames.map(name => `<vt:variant><vt:lpstr>${xmlEscape(name)}</vt:lpstr></vt:variant>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Produ</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs>
  <TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="variant">${headingPairs}</vt:vector></TitlesOfParts>
</Properties>`;
}

function corePropsXml() {
  const createdAt = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Plantilla de importación Produ</dc:title>
  <dc:creator>Produ</dc:creator>
  <cp:lastModifiedBy>Produ</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>
</cp:coreProperties>`;
}

function xlsxBlobFromSheets(sheets = []) {
  const sheetNames = sheets.map(sheet => sheet.name);
  const entries = {
    "[Content_Types].xml": strToU8(contentTypesXml(sheetNames)),
    "_rels/.rels": strToU8(packageRelsXml()),
    "docProps/app.xml": strToU8(appPropsXml(sheetNames)),
    "docProps/core.xml": strToU8(corePropsXml()),
    "xl/workbook.xml": strToU8(workbookXml(sheetNames)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml(sheetNames)),
    "xl/styles.xml": strToU8(stylesXml()),
  };
  sheets.forEach((sheet, index) => {
    entries[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(worksheetXml(sheet.rows));
  });
  return new Blob([zipSync(entries)], { type: XLSX_MIME });
}

function templateGuideRows(mode = "payables") {
  const isReceivables = mode === "receivables";
  return [
    ["Produ", isReceivables ? "Importador masivo Cuentas por Cobrar" : "Importador masivo Cuentas por Pagar"],
    ["Cómo usar", "Completa la hoja Importador. Cada fila debe indicar tipo_registro: cliente/proveedor, documento o pago."],
    ["Orden sugerido", isReceivables ? "1) clientes, 2) documentos, 3) pagos recibidos." : "1) proveedores, 2) documentos, 3) pagos realizados."],
    ["Fechas", "Usa formato AAAA-MM-DD. Ejemplo: 2026-07-31."],
    ["Montos", "Escribe números sin símbolos. Puedes usar 1250000 o 1.250.000."],
    ["Moneda", `Usa una de estas monedas: ${TREASURY_CURRENCIES.join(", ")}.`],
    ["Estados", isReceivables ? RECEIVABLE_STATUS_OPTIONS.join(", ") : PAYABLE_STATUS_OPTIONS.join(", ")],
    ["Pagos", "Para asociar un pago, el folio_documento debe coincidir exactamente con el folio del documento."],
    ["Anulados", "El estado Anulada mantiene trazabilidad, pero el monto no se considera en totales."],
    ["Validación", "Produ revisa folios, montos, fechas, moneda, estado y relación con contraparte antes de importar."],
  ];
}

function catalogRows(mode = "payables") {
  const statusOptions = mode === "receivables" ? RECEIVABLE_STATUS_OPTIONS : PAYABLE_STATUS_OPTIONS;
  return [
    ["catálogo", "valor", "uso"],
    ...TREASURY_CURRENCIES.map(value => ["moneda", value, "Campo moneda"]),
    ...statusOptions.map(value => ["estado", value, "Campo estado en documentos"]),
    ...DOCUMENT_TYPE_OPTIONS.map(value => ["tipo_documento", value, "Campo tipo_documento"]),
    ...PAYMENT_METHOD_OPTIONS.map(value => ["metodo_pago", value, "Campo metodo_pago"]),
    ...(mode === "payables"
      ? [["tipo_cuenta", "Corriente", "Datos bancarios proveedor"], ["tipo_cuenta", "Vista", "Datos bancarios proveedor"], ["tipo_cuenta", "Ahorro", "Datos bancarios proveedor"]]
      : []),
  ];
}

function unifiedTemplateRows(mode = "payables") {
  if (mode === "receivables") {
    return [
      ["tipo_registro", "rut_cliente", "nombre_cliente", "email", "telefono", "limite_credito", "folio_documento", "tipo_documento", "fecha_emision", "fecha_vencimiento", "total", "estado", "fecha_pago", "monto_pago", "metodo_pago", "referencia_pago", "notas"],
      ["cliente", "76.000.000-0", "Cliente Ejemplo SpA", "finanzas@cliente.cl", "+56 9 0000 0000", "5000000", "", "", "", "", "", "", "", "", "", "", "Alta o actualización del cliente"],
      ["documento", "76.000.000-0", "Cliente Ejemplo SpA", "", "", "", "F-1001", "Factura Afecta", "2026-07-01", "2026-07-31", "1250000", "Pendiente de pago", "", "", "", "", "Servicio mensual"],
      ["pago", "76.000.000-0", "", "", "", "", "F-1001", "", "", "", "", "", "2026-07-15", "500000", "Transferencia", "TRX-001", "Abono inicial"],
      ["documento", "76.000.000-0", "Cliente Ejemplo SpA", "", "", "", "F-1002", "Factura Exenta", "2026-07-10", "2026-08-10", "350000", "Anulado", "", "", "", "", "Documento anulado por error de emisión"],
    ];
  }
  return [
    ["tipo_registro", "rut_proveedor", "nombre_proveedor", "email", "telefono", "banco", "tipo_cuenta", "numero_cuenta", "email_pago", "moneda", "folio_documento", "tipo_documento", "categoria", "fecha_emision", "fecha_vencimiento", "fecha_estimada_pago", "total", "estado", "fecha_pago", "monto_pago", "metodo_pago", "referencia_pago", "notas"],
    ["proveedor", "77.000.000-0", "Proveedor Ejemplo SpA", "cobranza@proveedor.cl", "+56 9 1111 1111", "Banco de Chile", "Corriente", "123456789", "pagos@proveedor.cl", "CLP", "", "", "", "", "", "", "", "", "", "", "", "", "Alta o actualización del proveedor"],
    ["documento", "77.000.000-0", "Proveedor Ejemplo SpA", "", "", "", "", "", "", "CLP", "P-2001", "Factura Afecta", "Servicio", "2026-07-01", "2026-07-30", "2026-07-28", "850000", "Pendiente", "", "", "", "", "Servicio externo"],
    ["pago", "77.000.000-0", "Proveedor Ejemplo SpA", "", "", "", "", "", "", "CLP", "P-2001", "", "", "", "", "", "", "", "2026-07-20", "300000", "Transferencia", "EG-001", "Abono proveedor"],
    ["documento", "77.000.000-0", "Proveedor Ejemplo SpA", "", "", "", "", "", "", "PEN", "P-2002", "Factura Exenta", "Licencia", "2026-07-05", "2026-08-05", "2026-08-01", "1200", "Anulada", "", "", "", "", "Documento anulado por el emisor"],
  ];
}

export function buildTreasuryImportTemplateFile(mode = "payables") {
  const suffix = mode === "receivables" ? "cxc" : "cxp";
  const sheets = [
    { name: "Guia", rows: templateGuideRows(mode) },
    { name: "Importador", rows: unifiedTemplateRows(mode) },
    { name: "Catalogos", rows: catalogRows(mode) },
  ];
  return {
    blob: xlsxBlobFromSheets(sheets),
    fileName: `produ_importador_${suffix}.xlsx`,
    sheets,
  };
}

export function downloadTreasuryImportTemplate(mode = "payables") {
  const file = buildTreasuryImportTemplateFile(mode);
  return downloadBlob(file.blob, file.fileName);
}

function parseCsvLine(line = "") {
  const values = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === "\"" && line[index + 1] === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      quoted = !quoted;
      continue;
    }
    if ((char === "," || char === ";") && !quoted) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

function sheetFromCsv(text = "", name = "Template") {
  const data = String(text || "")
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => parseCsvLine(line));
  return { worksheets: [{ name, data }] };
}

function splitUnifiedRows(rows = [], mode = "payables") {
  const clients = [];
  const providers = [];
  const documents = [];
  const payments = [];
  rows.forEach(row => {
    const type = normalizeKey(row.tipo_registro || row.tipo || "");
    if (!type) return;
    if (mode === "receivables" && type === "cliente") clients.push(row);
    if (mode === "payables" && type === "proveedor") providers.push(row);
    if (type === "documento") {
      documents.push({
        ...row,
        folio: row.folio || row.folio_documento,
      });
    }
    if (type === "pago") {
      payments.push({
        ...row,
        folio_documento: row.folio_documento || row.folio,
        monto: row.monto_pago || row.monto,
        metodo: row.metodo_pago || row.metodo,
        referencia: row.referencia_pago || row.referencia,
      });
    }
  });
  return { clients, providers, documents, payments };
}

function rawCurrencyValue(row = {}) {
  return String(row.moneda || row.currency || "").trim().toUpperCase();
}

function isValidCurrencyValue(value = "") {
  return !value || TREASURY_CURRENCIES.includes(String(value || "").trim().toUpperCase());
}

function isValidStatusValue(status = "", mode = "payables") {
  if (!status) return true;
  const options = mode === "receivables" ? RECEIVABLE_STATUS_OPTIONS : PAYABLE_STATUS_OPTIONS;
  return !!canonicalStatusValue(status, mode) || options.some(option => normalizeKey(option) === normalizeKey(status));
}

function isValidPaymentMethodValue(method = "") {
  if (!method) return true;
  return PAYMENT_METHOD_OPTIONS.some(option => normalizeKey(option) === normalizeKey(method));
}

function isValidIsoDateValue(value = "") {
  if (!value) return true;
  const normalized = normalizeDateValue(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) && !Number.isNaN(new Date(`${normalized}T00:00:00Z`).getTime());
}

function canonicalStatusValue(status = "", mode = "payables") {
  const raw = String(status || "").trim();
  if (!raw) return "";
  const key = normalizeKey(raw);
  const options = mode === "receivables" ? RECEIVABLE_STATUS_OPTIONS : PAYABLE_STATUS_OPTIONS;
  const exact = options.find(option => normalizeKey(option) === key);
  if (exact) return exact;
  if (mode === "receivables" && key === normalizeKey("Anulada")) return "Anulado";
  if (mode === "payables" && key === normalizeKey("Anulado")) return "Anulada";
  if (mode === "payables" && key === normalizeKey("Pagado")) return "Pagada";
  return "";
}

export async function parseTreasuryImportFile(file, mode = "payables") {
  const isCsv = String(file?.name || "").toLowerCase().endsWith(".csv");
  const workbook = isCsv
    ? sheetFromCsv(await file.text())
    : parseXlsxWorkbook(await file.arrayBuffer());
  const unifiedRows = objectRowsFromSheet(findSheet(workbook, ["template", "importador", "carga masiva"]));
  const unified = splitUnifiedRows(unifiedRows, mode);
  const clients = unified.clients.length ? unified.clients : mode === "receivables"
    ? objectRowsFromSheet(findSheet(workbook, SHEET_ALIASES.clients))
    : [];
  const providers = unified.providers.length ? unified.providers : mode === "payables"
    ? objectRowsFromSheet(findSheet(workbook, SHEET_ALIASES.providers))
    : [];
  const documents = unified.documents.length ? unified.documents : mode === "receivables"
    ? objectRowsFromSheet(findSheet(workbook, SHEET_ALIASES.documentsReceivable))
    : objectRowsFromSheet(findSheet(workbook, SHEET_ALIASES.documentsPayable));
  const payments = unified.payments.length ? unified.payments : mode === "receivables"
    ? objectRowsFromSheet(findSheet(workbook, SHEET_ALIASES.paymentsReceivable))
    : objectRowsFromSheet(findSheet(workbook, SHEET_ALIASES.paymentsPayable));
  return normalizeTreasuryImportData({ mode, clients, providers, documents, payments });
}

export function normalizeTreasuryImportData({ mode, clients = [], providers = [], documents = [], payments = [] } = {}) {
  const normalizedClients = clients.map(row => ({
    rowNumber: row.__rowNumber,
    rut: String(row.rut_cliente || row.rut || "").trim(),
    name: String(row.nombre_cliente || row.nombre || "").trim(),
    email: String(row.email || "").trim(),
    phone: String(row.telefono || row.phone || "").trim(),
    creditLimit: parseImportNumber(row.limite_credito || row.credit_limit || 0),
  })).filter(row => row.rut || row.name);

  const normalizedProviders = providers.map(row => {
    const rawCurrency = rawCurrencyValue(row);
    return {
      rowNumber: row.__rowNumber,
      rut: String(row.rut_proveedor || row.rut || "").trim(),
      name: String(row.nombre_proveedor || row.nombre || "").trim(),
      email: String(row.email || row.email_pago || "").trim(),
      phone: String(row.telefono || row.phone || "").trim(),
      bank: String(row.banco || "").trim(),
      accountType: String(row.tipo_cuenta || "").trim(),
      accountNumber: String(row.numero_cuenta || "").trim(),
      paymentEmail: String(row.email_pago || row.email || "").trim(),
      rawCurrency,
      currency: normalizeTreasuryCurrency(rawCurrency || "CLP"),
    };
  }).filter(row => row.rut || row.name);

  const normalizedDocuments = documents.map(row => {
    const documentType = resolveProduBillingDocumentType(row.tipo_documento || row.doc_type || row.tipo || row.docType || "Factura Afecta");
    const rawCurrency = rawCurrencyValue(row);
    const rawStatus = String(row.estado || row.estado_cobranza || "").trim();
    const fallbackStatus = mode === "receivables" ? "Pendiente de pago" : "Pendiente";
    return {
      rowNumber: row.__rowNumber,
      clientRut: String(row.rut_cliente || row.rut || "").trim(),
      clientName: String(row.nombre_cliente || row.nombre || "").trim(),
      providerRut: String(row.rut_proveedor || row.rut || "").trim(),
      providerName: String(row.nombre_proveedor || row.nombre || "").trim(),
      providerEmail: String(row.email || row.email_pago || "").trim(),
      providerBank: String(row.banco || "").trim(),
      providerAccountType: String(row.tipo_cuenta || "").trim(),
      providerAccountNumber: String(row.numero_cuenta || "").trim(),
      providerPaymentEmail: String(row.email_pago || row.email || "").trim(),
      folio: String(row.folio || row.folio_documento || row.documento || "").trim(),
      docType: mode === "receivables" ? documentType.label : String(row.tipo_documento || row.doc_type || row.tipo || "Factura Afecta").trim(),
      documentTypeCode: documentType.code,
      category: String(row.categoria || row.category || "Servicio").trim() || "Servicio",
      issueDate: normalizeDateValue(row.fecha_emision || row.fecha_de_emision),
      dueDate: normalizeDateValue(row.fecha_vencimiento || row.fecha_de_vencimiento),
      paymentDate: normalizeDateValue(row.fecha_estimada_pago || row.fecha_pago_estimada),
      total: parseImportNumber(row.total || row.monto || 0),
      rawCurrency,
      currency: normalizeTreasuryCurrency(rawCurrency || "CLP"),
      rawStatus,
      status: canonicalStatusValue(rawStatus, mode) || rawStatus || fallbackStatus,
      rawIssueDate: row.fecha_emision || row.fecha_de_emision,
      rawDueDate: row.fecha_vencimiento || row.fecha_de_vencimiento,
      rawPaymentDate: row.fecha_estimada_pago || row.fecha_pago_estimada,
      notes: String(row.notas || row.comentario || "").trim(),
    };
  }).filter(row => row.folio || row.total || row.clientRut || row.providerRut || row.clientName || row.providerName);

  const normalizedPayments = payments.map(row => ({
    rowNumber: row.__rowNumber,
    folio: String(row.folio_documento || row.folio || row.documento || "").trim(),
    clientRut: String(row.rut_cliente || row.rut || "").trim(),
    providerRut: String(row.rut_proveedor || row.rut || "").trim(),
    providerName: String(row.nombre_proveedor || row.nombre || "").trim(),
    date: normalizeDateValue(row.fecha_pago || row.fecha || ""),
    rawDate: row.fecha_pago || row.fecha || "",
    amount: parseImportNumber(row.monto || row.total || 0),
    method: String(row.metodo || row.method || "Transferencia").trim() || "Transferencia",
    reference: String(row.referencia || row.reference || "").trim(),
    notes: String(row.notas || row.comentario || "").trim(),
  })).filter(row => row.folio || row.amount || row.reference);

  const issues = [];
  normalizedProviders.forEach(row => {
    if (row.rawCurrency && !isValidCurrencyValue(row.rawCurrency)) issues.push(`Proveedor fila ${row.rowNumber}: moneda no válida (${row.rawCurrency}). Usa ${TREASURY_CURRENCIES.join(", ")}.`);
  });
  normalizedDocuments.forEach(row => {
    if (!row.folio) issues.push(`Fila ${row.rowNumber}: falta folio del documento.`);
    if (!row.total || row.total <= 0) issues.push(`Fila ${row.rowNumber}: el monto total debe ser mayor a cero.`);
    if (mode === "receivables" && !row.clientRut && !row.clientName) issues.push(`Fila ${row.rowNumber}: falta cliente.`);
    if (mode === "payables" && !row.providerRut && !row.providerName) issues.push(`Fila ${row.rowNumber}: falta proveedor.`);
    if (row.rawCurrency && !isValidCurrencyValue(row.rawCurrency)) issues.push(`Fila ${row.rowNumber}: moneda no válida (${row.rawCurrency}). Usa ${TREASURY_CURRENCIES.join(", ")}.`);
    if (!isValidStatusValue(row.rawStatus || row.status, mode)) issues.push(`Fila ${row.rowNumber}: estado no válido (${row.status}). Revisa la hoja Catálogos.`);
    if (!isValidIsoDateValue(row.rawIssueDate)) issues.push(`Fila ${row.rowNumber}: fecha_emision debe usar formato AAAA-MM-DD.`);
    if (!isValidIsoDateValue(row.rawDueDate)) issues.push(`Fila ${row.rowNumber}: fecha_vencimiento debe usar formato AAAA-MM-DD.`);
    if (!isValidIsoDateValue(row.rawPaymentDate)) issues.push(`Fila ${row.rowNumber}: fecha_estimada_pago debe usar formato AAAA-MM-DD.`);
  });
  normalizedPayments.forEach(row => {
    if (!row.folio) issues.push(`Pago fila ${row.rowNumber}: falta folio_documento.`);
    if (!row.amount || row.amount <= 0) issues.push(`Pago fila ${row.rowNumber}: el monto debe ser mayor a cero.`);
    if (!isValidIsoDateValue(row.rawDate)) issues.push(`Pago fila ${row.rowNumber}: fecha_pago debe usar formato AAAA-MM-DD.`);
    if (!isValidPaymentMethodValue(row.method)) issues.push(`Pago fila ${row.rowNumber}: método de pago no reconocido. Revisa la hoja Catálogos.`);
  });

  return {
    mode,
    clients: normalizedClients,
    providers: normalizedProviders,
    documents: normalizedDocuments,
    payments: normalizedPayments,
    issues,
  };
}
