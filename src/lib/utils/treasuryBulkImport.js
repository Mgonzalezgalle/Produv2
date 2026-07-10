import { strFromU8, unzipSync } from "fflate";
import { resolveProduBillingDocumentType } from "../integrations/billingDomain";
import { normalizeTreasuryCurrency } from "./treasury";

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
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function csvEscape(value = "") {
  const raw = String(value ?? "");
  return /[";\n\r]/.test(raw) ? `"${raw.replace(/"/g, "\"\"")}"` : raw;
}

function csvFromRows(rows = []) {
  return rows.map(row => row.map(csvEscape).join(";")).join("\n");
}

function unifiedTemplateRows(mode = "payables") {
  if (mode === "receivables") {
    return [
      ["tipo_registro", "rut_cliente", "nombre_cliente", "email", "telefono", "limite_credito", "folio_documento", "tipo_documento", "fecha_emision", "fecha_vencimiento", "total", "estado", "fecha_pago", "monto_pago", "metodo_pago", "referencia_pago", "notas"],
      ["cliente", "76.000.000-0", "Cliente Ejemplo SpA", "finanzas@cliente.cl", "+56 9 0000 0000", "5000000", "", "", "", "", "", "", "", "", "", "", "Alta o actualización del cliente"],
      ["documento", "76.000.000-0", "Cliente Ejemplo SpA", "", "", "", "F-1001", "Factura Afecta", "2026-07-01", "2026-07-31", "1250000", "Pendiente de pago", "", "", "", "", "Servicio mensual"],
      ["pago", "76.000.000-0", "", "", "", "", "F-1001", "", "", "", "", "", "2026-07-15", "500000", "Transferencia", "TRX-001", "Abono inicial"],
    ];
  }
  return [
    ["tipo_registro", "rut_proveedor", "nombre_proveedor", "email", "telefono", "banco", "tipo_cuenta", "numero_cuenta", "email_pago", "moneda", "folio_documento", "tipo_documento", "categoria", "fecha_emision", "fecha_vencimiento", "fecha_estimada_pago", "total", "estado", "fecha_pago", "monto_pago", "metodo_pago", "referencia_pago", "notas"],
    ["proveedor", "77.000.000-0", "Proveedor Ejemplo SpA", "cobranza@proveedor.cl", "+56 9 1111 1111", "Banco de Chile", "Corriente", "123456789", "pagos@proveedor.cl", "CLP", "", "", "", "", "", "", "", "", "", "", "", "", "Alta o actualización del proveedor"],
    ["documento", "77.000.000-0", "Proveedor Ejemplo SpA", "", "", "", "", "", "", "CLP", "P-2001", "Factura Afecta", "Servicio", "2026-07-01", "2026-07-30", "2026-07-28", "850000", "Pendiente", "", "", "", "", "Servicio externo"],
    ["pago", "77.000.000-0", "Proveedor Ejemplo SpA", "", "", "", "", "", "", "CLP", "P-2001", "", "", "", "", "", "", "", "2026-07-20", "300000", "Transferencia", "EG-001", "Abono proveedor"],
  ];
}

export function downloadTreasuryImportTemplate(mode = "payables") {
  const csv = csvFromRows(unifiedTemplateRows(mode));
  downloadBlob(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }), `produ_importador_${mode === "receivables" ? "cxc" : "cxp"}.csv`);
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

  const normalizedProviders = providers.map(row => ({
    rowNumber: row.__rowNumber,
    rut: String(row.rut_proveedor || row.rut || "").trim(),
    name: String(row.nombre_proveedor || row.nombre || "").trim(),
    email: String(row.email || row.email_pago || "").trim(),
    phone: String(row.telefono || row.phone || "").trim(),
    bank: String(row.banco || "").trim(),
    accountType: String(row.tipo_cuenta || "").trim(),
    accountNumber: String(row.numero_cuenta || "").trim(),
    paymentEmail: String(row.email_pago || row.email || "").trim(),
    currency: normalizeTreasuryCurrency(row.moneda || "CLP"),
  })).filter(row => row.rut || row.name);

  const normalizedDocuments = documents.map(row => {
    const documentType = resolveProduBillingDocumentType(row.tipo_documento || row.doc_type || row.tipo || row.docType || "Factura Afecta");
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
      currency: normalizeTreasuryCurrency(row.moneda || "CLP"),
      status: String(row.estado || row.estado_cobranza || (mode === "receivables" ? "Pendiente de pago" : "Pendiente")).trim(),
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
    amount: parseImportNumber(row.monto || row.total || 0),
    method: String(row.metodo || row.method || "Transferencia").trim() || "Transferencia",
    reference: String(row.referencia || row.reference || "").trim(),
    notes: String(row.notas || row.comentario || "").trim(),
  })).filter(row => row.folio || row.amount || row.reference);

  const issues = [];
  normalizedDocuments.forEach(row => {
    if (!row.folio) issues.push(`Fila ${row.rowNumber}: falta folio del documento.`);
    if (!row.total) issues.push(`Fila ${row.rowNumber}: falta monto total del documento.`);
    if (mode === "receivables" && !row.clientRut && !row.clientName) issues.push(`Fila ${row.rowNumber}: falta cliente.`);
    if (mode === "payables" && !row.providerRut && !row.providerName) issues.push(`Fila ${row.rowNumber}: falta proveedor.`);
  });
  normalizedPayments.forEach(row => {
    if (!row.folio) issues.push(`Pago fila ${row.rowNumber}: falta folio_documento.`);
    if (!row.amount) issues.push(`Pago fila ${row.rowNumber}: falta monto.`);
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
