import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  getProduBillingDocumentTypes,
  resolveProduBillingDocumentType,
  supportsProduDocumentVat,
} from "../integrations/billingDomain";

const BILLING_IMPORT_FIELDS = [
  "rut_cliente",
  "nombre_cliente",
  "folio",
  "tipo_documento",
  "fecha_emision",
  "fecha_vencimiento",
  "neto",
  "iva",
  "total",
  "estado",
  "estado_cobranza",
  "observacion",
  "detalle",
  "referencia_oc",
  "fecha_referencia",
];

const BILLING_STATUS_OPTIONS = ["Borrador", "Emitida", "Anulada"];
const COLLECTION_STATUS_OPTIONS = ["Pendiente de pago", "Pagado", "No pagado", "Retrasado de pago", "Anulado"];
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function normalizeImportKey(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
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

function resolveWorkbookTarget(target = "") {
  const clean = String(target || "").replace(/^\//, "");
  if (!clean) return "";
  if (clean.startsWith("xl/")) return clean;
  if (clean.startsWith("worksheets/") || clean.startsWith("chartsheets/") || clean.startsWith("sharedStrings")) return `xl/${clean}`;
  return `xl/${clean.replace(/^(\.\.\/)+/, "")}`;
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
    const target = relTarget ? resolveWorkbookTarget(relTarget) : `xl/worksheets/sheet${attrs.sheetId || 1}.xml`;
    return {
      name: attrs.name || `Hoja ${attrs.sheetId || ""}`.trim(),
      data: parseSheetXml(readEntry(target), sharedStrings),
    };
  });
  return { worksheets };
}

function sheetFromCsv(text = "", name = "Importador") {
  const rows = String(text || "")
    .split(/\r?\n/)
    .filter(line => line.trim())
    .map(line => {
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
    });
  return { worksheets: [{ name, data: rows }] };
}

function parseTextSpreadsheet(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return { worksheets: [] };
  if (/<table[\s>]/i.test(raw)) {
    const rows = Array.from(raw.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map(rowMatch => (
      Array.from(rowMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)).map(cellMatch => (
        decodeXmlEntities(String(cellMatch[1] || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
      ))
    )).filter(row => row.some(value => String(value || "").trim()));
    return { worksheets: [{ name: "Importador", data: rows }] };
  }
  if (!/[,\t;\n\r]/.test(raw.slice(0, 4096))) return { worksheets: [] };
  return sheetFromCsv(raw);
}

async function parseWorkbookFromFile(file) {
  const buffer = await file.arrayBuffer();
  try {
    const workbook = parseXlsxWorkbook(buffer);
    if ((workbook.worksheets || []).length) return workbook;
  } catch (error) {
    const text = await file.text().catch(() => "");
    const fallback = parseTextSpreadsheet(text);
    if ((fallback.worksheets || []).some(sheet => (sheet.data || []).length)) return fallback;
    throw error;
  }
  const text = await file.text().catch(() => "");
  return parseTextSpreadsheet(text);
}

function normalizeImportDateValue(value = "") {
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
  const local = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (local) return `${local[3]}-${String(local[2]).padStart(2, "0")}-${String(local[1]).padStart(2, "0")}`;
  return raw;
}

function parseImportNumber(value = "") {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function objectRowsFromSheet(sheet, headerMapping = null) {
  if (!sheet) return [];
  const rows = Array.isArray(sheet?.data) ? sheet.data : Array.isArray(sheet) ? sheet : [];
  const [headers = [], ...body] = rows;
  const normalizedHeaders = headers.map(header => {
    const rawHeader = String(header || "").trim();
    const mapped = headerMapping?.[rawHeader];
    if (mapped === "__skip") return "";
    return mapped || normalizeHeader(rawHeader);
  });
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

function normalizeSheetName(value = "") {
  return normalizeImportKey(value).replace(/_/g, " ");
}

function findWorkbookSheet(workbook, aliases = []) {
  const wanted = aliases.map(normalizeSheetName);
  return (workbook.worksheets || workbook.sheets || []).find(sheet => {
    const normalized = normalizeSheetName(sheet?.name || sheet?.sheet);
    return wanted.some(alias => normalized === alias || normalized.includes(alias));
  }) || null;
}

function downloadImportBlob(blob, fileName) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return { ok: false, error: "browser_unavailable" };
  }
  if (!blob || !(blob instanceof Blob)) {
    return { ok: false, error: "invalid_blob" };
  }
  const safeName = String(fileName || "produ_importador_facturacion.xlsx").trim() || "produ_importador_facturacion.xlsx";
  try {
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
    return { ok: false, error: error?.message || "download_failed" };
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
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${worksheetDimension(safeRows)}"/><sheetData>${rowXml}</sheetData></worksheet>`;
}

function workbookXml(sheetNames = []) {
  const sheets = sheetNames.map((name, index) => `<sheet name="${xmlEscape(name).slice(0, 31)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelsXml(sheetNames = []) {
  const sheetRels = sheetNames.map((_name, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheetNames.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(sheetNames = []) {
  const sheetOverrides = sheetNames.map((_name, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`;
}

function packageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Inter"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function appPropsXml(sheetNames = []) {
  const headingPairs = sheetNames.map(name => `<vt:variant><vt:lpstr>${xmlEscape(name)}</vt:lpstr></vt:variant>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Produ</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheetNames.length}" baseType="variant">${headingPairs}</vt:vector></TitlesOfParts></Properties>`;
}

function corePropsXml() {
  const createdAt = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Plantilla de importación Facturación Produ</dc:title><dc:creator>Produ</dc:creator><cp:lastModifiedBy>Produ</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified></cp:coreProperties>`;
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


function normalizeRut(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^0-9k]/g, "");
}

function normalizeName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeHeader(value = "") {
  const key = normalizeImportKey(value);
  const aliases = {
    cliente: "nombre_cliente",
    customer: "nombre_cliente",
    rut: "rut_cliente",
    rut_receptor: "rut_cliente",
    razon_social: "nombre_cliente",
    nombre: "nombre_cliente",
    numero: "folio",
    numero_documento: "folio",
    folio_documento: "folio",
    documento: "folio",
    tipo: "tipo_documento",
    doc_type: "tipo_documento",
    tipo_doc: "tipo_documento",
    emision: "fecha_emision",
    fecha_de_emision: "fecha_emision",
    vencimiento: "fecha_vencimiento",
    fecha_de_vencimiento: "fecha_vencimiento",
    monto_neto: "neto",
    subtotal: "neto",
    monto: "total",
    bruto: "total",
    cobranza: "estado_cobranza",
    estado_pago: "estado_cobranza",
    notas: "observacion",
    comentario: "observacion",
    descripcion: "detalle",
    glosa: "detalle",
    oc: "referencia_oc",
    orden_compra: "referencia_oc",
  };
  return aliases[key] || key;
}

function getImportSheet(workbook) {
  return findWorkbookSheet(workbook, ["importador", "emision masiva", "facturacion", "template"])
    || (workbook.worksheets || workbook.sheets || [])[0]
    || null;
}

function guessBillingImportMapping(headers = []) {
  const allowed = new Set(BILLING_IMPORT_FIELDS);
  return (headers || []).reduce((acc, header) => {
    const rawHeader = String(header || "").trim();
    if (!rawHeader) return acc;
    const normalized = normalizeHeader(rawHeader);
    acc[rawHeader] = allowed.has(normalized) ? normalized : "__skip";
    return acc;
  }, {});
}

function parseBool(value = "") {
  if (typeof value === "boolean") return value;
  const key = normalizeImportKey(value);
  if (["si", "sí", "true", "1", "iva", "afecto", "afecta"].includes(key)) return true;
  if (["no", "false", "0", "exento", "exenta", "sin_iva"].includes(key)) return false;
  return false;
}

function canonicalOption(value = "", options = [], fallback = "") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const key = normalizeImportKey(raw);
  return options.find(option => normalizeImportKey(option) === key) || raw || fallback;
}

function buildClientIndex(clientes = []) {
  const byRut = new Map();
  const byName = new Map();
  (Array.isArray(clientes) ? clientes : []).forEach(client => {
    const rut = normalizeRut(client?.rut);
    const name = normalizeName(client?.nom || client?.nombre || client?.razonSocial);
    if (rut) byRut.set(rut, client);
    if (name) byName.set(name, client);
  });
  return { byRut, byName };
}

function resolveClient(row = {}, clientIndex) {
  const rutKey = normalizeRut(row.rutCliente);
  const nameKey = normalizeName(row.nombreCliente);
  return (rutKey && clientIndex.byRut.get(rutKey)) || (nameKey && clientIndex.byName.get(nameKey)) || null;
}

function billingTemplateRows() {
  return [
    ["rut_cliente", "nombre_cliente", "folio", "tipo_documento", "fecha_emision", "fecha_vencimiento", "neto", "iva", "total", "estado", "estado_cobranza", "detalle", "referencia_oc", "fecha_referencia", "observacion"],
    ["76.000.000-0", "Cliente Ejemplo SpA", "F-1001", "Factura Afecta", "2026-07-01", "2026-07-31", "1000000", "si", "", "Emitida", "Pendiente de pago", "Servicio mensual", "OC-2026-001", "2026-06-28", "Documento creado por importación masiva"],
    ["76.000.000-0", "Cliente Ejemplo SpA", "F-1002", "Factura Exenta", "2026-07-05", "2026-08-05", "350000", "no", "", "Borrador", "Pendiente de pago", "Servicio exento", "", "", ""],
    ["76.000.000-0", "Cliente Ejemplo SpA", "INV-3001", "Invoice", "2026-07-10", "2026-08-10", "1200", "no", "", "Emitida", "Pendiente de pago", "Servicio internacional", "", "", "Monto sin IVA"],
  ];
}

function catalogRows() {
  return [
    ["catalogo", "valor", "uso"],
    ...getProduBillingDocumentTypes().map(item => ["tipo_documento", item.label, item.requiresExternalProvider ? "Documento tributario" : "Documento comercial"]),
    ...BILLING_STATUS_OPTIONS.map(item => ["estado", item, "Estado interno del documento"]),
    ...COLLECTION_STATUS_OPTIONS.map(item => ["estado_cobranza", item, "Estado de cobranza inicial"]),
    ["iva", "si", "Calcula IVA 19% cuando el tipo de documento lo permite"],
    ["iva", "no", "No calcula IVA"],
  ];
}

function guideRows() {
  return [
    ["Produ", "Importador masivo de Facturación"],
    ["Cómo usar", "Completa la hoja Importador. Cada fila crea un documento en Facturación."],
    ["Clientes", "Produ hace match con clientes ya creados por RUT. Si falta el RUT, intenta por nombre exacto."],
    ["Fechas", "Usa formato AAAA-MM-DD. Ejemplo: 2026-07-31."],
    ["Montos", "Recomendado: completa neto e IVA. Si solo completas total, Produ calcula neto cuando corresponde."],
    ["Tipos", "Usa los tipos de documento de la hoja Catálogos."],
    ["Emisión", "El importador crea documentos en Produ. La emisión electrónica externa se revisa después por documento."],
    ["Seguridad", "Si hay errores, Produ bloquea la importación antes de crear documentos."],
  ];
}

export function buildBillingImportTemplateFile() {
  const sheets = [
    { name: "Guia", rows: guideRows() },
    { name: "Importador", rows: billingTemplateRows() },
    { name: "Catalogos", rows: catalogRows() },
  ];
  return {
    blob: xlsxBlobFromSheets(sheets),
    fileName: "produ_importador_facturacion.xlsx",
    sheets,
  };
}

export function downloadBillingImportTemplate() {
  const file = buildBillingImportTemplateFile();
  if (!file.blob || file.blob.type !== XLSX_MIME) return { ok: false, error: "invalid_template" };
  return downloadImportBlob(file.blob, file.fileName);
}

export async function inspectBillingImportFile(file) {
  const isCsv = String(file?.name || "").toLowerCase().endsWith(".csv");
  const workbook = isCsv ? sheetFromCsv(await file.text()) : await parseWorkbookFromFile(file);
  const importSheet = getImportSheet(workbook);
  const rows = Array.isArray(importSheet?.data) ? importSheet.data : [];
  const headers = (rows[0] || []).map(value => String(value || "").trim());
  const sampleRows = rows.slice(1, 6).map(row => headers.map((_header, index) => row[index] ?? ""));
  return {
    sheetName: importSheet?.name || "Importador",
    headers,
    sampleRows,
    mapping: guessBillingImportMapping(headers),
  };
}

export function getBillingImportFieldOptions() {
  return [
    { value: "rut_cliente", label: "RUT cliente" },
    { value: "nombre_cliente", label: "Nombre cliente" },
    { value: "folio", label: "Folio / número documento" },
    { value: "tipo_documento", label: "Tipo documento" },
    { value: "fecha_emision", label: "Fecha emisión" },
    { value: "fecha_vencimiento", label: "Fecha vencimiento" },
    { value: "neto", label: "Monto neto" },
    { value: "iva", label: "IVA sí/no" },
    { value: "total", label: "Total" },
    { value: "estado", label: "Estado documento" },
    { value: "estado_cobranza", label: "Estado cobranza" },
    { value: "detalle", label: "Detalle" },
    { value: "referencia_oc", label: "Referencia OC" },
    { value: "fecha_referencia", label: "Fecha referencia" },
    { value: "observacion", label: "Observación" },
  ];
}

export async function parseBillingImportFile(file, headerMapping = null, { clientes = [], existingInvoices = [] } = {}) {
  const isCsv = String(file?.name || "").toLowerCase().endsWith(".csv");
  const workbook = isCsv ? sheetFromCsv(await file.text()) : await parseWorkbookFromFile(file);
  const importSheet = getImportSheet(workbook);
  const rows = objectRowsFromSheet(importSheet, headerMapping);
  return normalizeBillingImportData(rows, { clientes, existingInvoices });
}

export function normalizeBillingImportData(rows = [], { clientes = [], existingInvoices = [] } = {}) {
  const clientIndex = buildClientIndex(clientes);
  const existingFolios = new Set((Array.isArray(existingInvoices) ? existingInvoices : []).map(item => [
    String(item?.correlativo || "").trim(),
    String(item?.entidadId || "").trim(),
    String(item?.documentTypeCode || item?.tipoDocumento || item?.tipoDoc || "").trim(),
  ].join("::")).filter(key => !key.startsWith("::")));
  const documents = (Array.isArray(rows) ? rows : []).map(row => {
    const documentType = resolveProduBillingDocumentType(row.tipo_documento || row.tipo || "factura_afecta");
    const issueDate = normalizeImportDateValue(row.fecha_emision || row.emision);
    const dueDate = normalizeImportDateValue(row.fecha_vencimiento || row.vencimiento);
    const referenceDate = normalizeImportDateValue(row.fecha_referencia || "");
    const totalInput = parseImportNumber(row.total || "");
    const rawNet = parseImportNumber(row.neto || row.monto_neto || "");
    const wantsVat = supportsProduDocumentVat(documentType?.code) && parseBool(row.iva || row.afecto || "");
    const net = rawNet > 0
      ? rawNet
      : totalInput > 0 && wantsVat
        ? Math.round(totalInput / 1.19)
        : totalInput;
    const ivaVal = wantsVat ? Math.round(net * 0.19) : 0;
    const total = totalInput > 0 ? totalInput : net + ivaVal;
    const normalized = {
      rowNumber: row.__rowNumber,
      rutCliente: String(row.rut_cliente || row.rut || "").trim(),
      nombreCliente: String(row.nombre_cliente || row.nombre || "").trim(),
      folio: String(row.folio || row.folio_documento || row.numero || "").trim(),
      documentType,
      issueDate,
      dueDate,
      net,
      iva: wantsVat,
      ivaVal,
      total,
      estado: canonicalOption(row.estado, BILLING_STATUS_OPTIONS, "Emitida"),
      cobranzaEstado: canonicalOption(row.estado_cobranza || row.cobranza, COLLECTION_STATUS_OPTIONS, "Pendiente de pago"),
      detail: String(row.detalle || row.descripcion || "Servicio").trim() || "Servicio",
      relatedDocumentFolio: String(row.referencia_oc || row.orden_compra || "").trim(),
      relatedDocumentDate: referenceDate,
      obs: String(row.observacion || row.notas || "").trim(),
      rawIssueDate: row.fecha_emision || row.emision || "",
      rawDueDate: row.fecha_vencimiento || row.vencimiento || "",
      rawReferenceDate: row.fecha_referencia || "",
    };
    return {
      ...normalized,
      client: resolveClient(normalized, clientIndex),
    };
  }).filter(row => row.folio || row.rutCliente || row.nombreCliente || row.total);

  const issues = [];
  const seenFolios = new Set();
  documents.forEach(row => {
    const folioKey = [
      row.folio,
      row.client?.id || "",
      row.documentType?.code || "",
    ].join("::");
    if (!row.client) issues.push(`Fila ${row.rowNumber}: no encontramos cliente por RUT o nombre (${row.rutCliente || row.nombreCliente || "sin dato"}).`);
    if (!row.folio) issues.push(`Fila ${row.rowNumber}: falta folio o número del documento.`);
    if (row.folio && seenFolios.has(folioKey)) issues.push(`Fila ${row.rowNumber}: folio duplicado para el mismo cliente y tipo de documento (${row.folio}).`);
    if (row.folio && existingFolios.has(folioKey)) issues.push(`Fila ${row.rowNumber}: ya existe un documento con folio ${row.folio} para este cliente y tipo.`);
    if (!row.documentType) issues.push(`Fila ${row.rowNumber}: tipo de documento no reconocido.`);
    if (!row.issueDate) issues.push(`Fila ${row.rowNumber}: falta fecha_emision.`);
    if (row.rawIssueDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.issueDate)) issues.push(`Fila ${row.rowNumber}: fecha_emision debe usar formato AAAA-MM-DD.`);
    if (row.rawDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)) issues.push(`Fila ${row.rowNumber}: fecha_vencimiento debe usar formato AAAA-MM-DD.`);
    if (row.rawReferenceDate && !/^\d{4}-\d{2}-\d{2}$/.test(row.relatedDocumentDate)) issues.push(`Fila ${row.rowNumber}: fecha_referencia debe usar formato AAAA-MM-DD.`);
    if (!row.total || row.total <= 0) issues.push(`Fila ${row.rowNumber}: el total debe ser mayor a cero.`);
    if (row.folio) seenFolios.add(folioKey);
  });

  return {
    documents,
    issues,
  };
}
