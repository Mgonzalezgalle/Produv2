export function exportComentariosCSV(items, nombre = "comentarios") {
  const headers = ["Fecha", "Autor", "Tipo", "Importante", "Comentario", "Asignados", "Adjuntos"];
  const rows = (items || []).map(it => [
    it?.upd || it?.cr || "",
    String(it?.authorName || "—").replace(/,/g, " "),
    String(it?.kind || "note").replace(/,/g, " "),
    it?.important === true ? "Sí" : "No",
    String(it?.text || "").replace(/\n/g, " ").replace(/,/g, " "),
    String((it?.assignedIds || []).length || 0),
    String((it?.attachments || it?.photos || []).length || 0),
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre.replace(/\s+/g, "_").toLowerCase()}_comentarios.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

let simplePdfBlobRuntimePromise = null;
let modernPdfRuntimePromise = null;
let episodeStatusPdfRuntimePromise = null;

async function getSimplePdfBlobRuntime() {
  if (!simplePdfBlobRuntimePromise) {
    simplePdfBlobRuntimePromise = import("./pdf").then(module => module.buildSimplePdfBlob);
  }
  return simplePdfBlobRuntimePromise;
}

async function getModernPdfRuntime() {
  if (!modernPdfRuntimePromise) {
    modernPdfRuntimePromise = import("./pdf").then(module => module.buildModernPdf);
  }
  return modernPdfRuntimePromise;
}

async function getEpisodeStatusPdfRuntime() {
  if (!episodeStatusPdfRuntimePromise) {
    episodeStatusPdfRuntimePromise = import("./pdf").then(module => module.buildEpisodeStatusPdf);
  }
  return episodeStatusPdfRuntimePromise;
}

function downloadBlob(blob, fileName = "produ_export.pdf") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 1200);
}

function slugFileName(value = "produ") {
  return String(value || "produ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "produ";
}

export function exportComentariosPDF(items, nombre = "comentarios", empresa = null, helpers = {}) {
  const { companyPrintColor } = helpers;
  const safeItems = Array.isArray(items) ? items : [];
  const ac = companyPrintColor ? companyPrintColor(empresa) : "#00d4e8";
  const htmlRows = safeItems.map(it => `
    <tr>
      <td>${it?.upd || it?.cr || "—"}</td>
      <td>${String(it?.authorName || "—").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
      <td>${String(it?.kind || "note").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
      <td>${it?.important === true ? "Sí" : "No"}</td>
      <td>${String(it?.text || "—").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</td>
    </tr>
  `).join("");
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
  <title>Comentarios - ${nombre}</title>
  <style>
    *{box-sizing:border-box}
    body{font-family:Arial,sans-serif;color:#111827;padding:32px}
    .head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid ${ac};padding-bottom:14px;margin-bottom:20px}
    .brand{font-size:28px;font-weight:800;color:${ac};letter-spacing:-1px}
    .title{font-size:20px;font-weight:700;margin-bottom:4px}
    .meta{font-size:11px;color:#6b7280}
    table{width:100%;border-collapse:collapse}
    thead tr{background:${ac}}
    thead th{padding:10px 12px;text-align:left;color:#fff;font-size:11px;text-transform:uppercase;letter-spacing:.6px}
    tbody td{padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:12px;vertical-align:top}
    tbody tr:nth-child(even){background:#f8fafc}
    .empty{padding:20px;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;color:#6b7280}
  </style></head><body>
    <div class="head">
      <div>
        <div class="brand">produ</div>
        <div class="title">${nombre}</div>
        <div class="meta">Comentarios exportados</div>
      </div>
      <div class="meta">Generado: ${new Date().toLocaleDateString("es-CL")}</div>
    </div>
    ${safeItems.length ? `<table><thead><tr><th style="width:140px">Fecha</th><th style="width:160px">Autor</th><th style="width:110px">Tipo</th><th style="width:90px">Importante</th><th>Comentario</th></tr></thead><tbody>${htmlRows}</tbody></table>` : `<div class="empty">No hay comentarios para exportar.</div>`}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
  </body></html>`;
  const w = window.open("", "_blank", "width=980,height=720");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}

export function exportActiveClientsCSV(items = [], helpers = {}) {
  const { companyBillingStatus, companyBillingBaseNet, companyBillingNet, companyReferralDiscountMonthsPending, today } = helpers;
  const headers = ["Empresa", "Tenant ID", "RUT", "Email", "Telefono", "Plan", "Estado", "Estado de pago", "Moneda", "Valor mensual base", "Valor mensual neto", "Meses gratis pendientes", "Contratado por", "Ultimo pago"];
  const rows = (items || []).map(it => [
    String(it?.nombre || "—").replace(/,/g, " "),
    String(it?.tenantCode || "—").replace(/,/g, " "),
    String(it?.rut || "—").replace(/,/g, " "),
    String(it?.ema || "—").replace(/,/g, " "),
    String(it?.tel || "—").replace(/,/g, " "),
    String(it?.plan || "starter").replace(/,/g, " "),
    it?.active !== false ? "Activa" : "Inactiva",
    String(companyBillingStatus(it) || "Pendiente").replace(/,/g, " "),
    String(it?.billingCurrency || "UF"),
    String(companyBillingBaseNet(it) || 0),
    String(companyBillingNet(it) || 0),
    String(companyReferralDiscountMonthsPending(it) || 0),
    String(it?.contractOwner || "—").replace(/,/g, " "),
    String(it?.billingLastPaidAt || "—"),
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `produ_clientes_activos_${today()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportActiveClientsPDF(items = [], helpers = {}) {
  const { companyBillingStatus, companyBillingBaseNet, companyBillingNet, companyReferralDiscountMonthsPending, fmtMoney, fmtD, today } = helpers;
  const activeItems = Array.isArray(items) ? items : [];
  const lines = [
    { text: "PRODU", size: 18, bold: true, color: "#00d4e8", gap: 20 },
    { text: "Clientes activos - cartera", size: 16, bold: true, color: "#e5e7eb", gap: 18 },
    { text: `Generado: ${fmtD(today())}`, size: 10, color: "#94a3b8", gap: 22 },
  ];
  if (!activeItems.length) {
    lines.push({ text: "No hay clientes activos para exportar.", size: 12, color: "#cbd5e1", gap: 18 });
  } else {
    activeItems.forEach((it, index) => {
      lines.push({ text: `${index + 1}. ${it?.nombre || "Empresa sin nombre"}`, size: 12, bold: true, color: "#f8fafc", gap: 16 });
      lines.push({ text: `Tenant: ${it?.tenantCode || "—"}  |  Plan: ${String(it?.plan || "starter").toUpperCase()}  |  Estado: ${it?.active !== false ? "Activa" : "Inactiva"}`, size: 10, color: "#cbd5e1", gap: 14 });
      lines.push({ text: `Contacto: ${it?.ema || "—"}  |  Tel: ${it?.tel || "—"}  |  RUT: ${it?.rut || "—"}`, size: 10, color: "#cbd5e1", gap: 14 });
      lines.push({ text: `Pago: ${companyBillingStatus(it)}  |  Base: ${fmtMoney(companyBillingBaseNet(it), it?.billingCurrency || "UF")}  |  Neto: ${fmtMoney(companyBillingNet(it), it?.billingCurrency || "UF")}`, size: 10, color: "#cbd5e1", gap: 14 });
      lines.push({ text: `Referidos pendientes: ${companyReferralDiscountMonthsPending(it)}  |  Último pago: ${it?.billingLastPaidAt ? fmtD(it.billingLastPaidAt) : "Sin registro"}  |  Contratado por: ${it?.contractOwner || "—"}`, size: 10, color: "#94a3b8", gap: 18 });
    });
  }
  const buildSimplePdfBlob = await getSimplePdfBlobRuntime();
  const blob = buildSimplePdfBlob(lines, "#00d4e8");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `produ_clientes_activos_${today()}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

const movFecha = m => m?.fec ?? m?.fecha ?? m?.fechaPago ?? m?.fechaEmision ?? m?.cr ?? "";
const movDesc = m => m?.des ?? m?.desc ?? m?.descripcion ?? m?.detalle ?? "";
const movMonto = m => {
  const raw = m?.mon ?? m?.monto ?? m?.m ?? 0;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  const clean = String(raw || "").replace(/[^0-9,-.]/g, "").replace(/\.(?=.*\.)/g, "").replace(",", ".");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
};

export function exportMovCSV(movs, nombre) {
  const headers = ["Fecha", "Tipo", "Categoría", "Descripción", "Monto"];
  const rows = (movs || []).map(m => [
    movFecha(m),
    m.tipo === "ingreso" ? "Ingreso" : "Gasto",
    m.cat || "—",
    movDesc(m).replace(/,/g, " "),
    movMonto(m),
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre.replace(/\s+/g, "_")}_movimientos.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportMovPDF(movs, nombre, empresa, tipo, helpers = {}) {
  const { companyPrintColor } = helpers;
  const ac = companyPrintColor ? companyPrintColor(empresa) : "#00d4e8";
  const total = (movs || []).reduce((s, m) => s + movMonto(m), 0);
  const logoHtml = empresa?.logo
    ? `<img src="${empresa.logo}" style="max-height:60px;object-fit:contain;display:block;margin-bottom:6px;">`
    : `<div style="font-size:22px;font-weight:900;color:${ac}">${empresa?.nombre || ""}</div>`;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${tipo} — ${nombre}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1a1a2e;padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid ${ac}}
.title{font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:${ac}}
thead th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;letter-spacing:.5px;text-transform:uppercase}
thead th.r{text-align:right}
tbody tr:nth-child(even){background:#f8f9fc}
tbody td{padding:9px 14px;font-size:12px;border-bottom:1px solid #eee}
tbody td.r{text-align:right;font-family:monospace}
.total-row{display:flex;justify-content:flex-end;margin-top:4px}
.total-box{background:${ac};color:#fff;padding:10px 20px;border-radius:8px;font-size:15px;font-weight:700}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:32px;padding-top:16px;border-top:1px solid #eee}
@media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div>${logoHtml}<div style="font-size:12px;color:#555;margin-top:4px">${empresa?.nombre || ""} · ${empresa?.rut || ""}</div></div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">${tipo}</div>
    <div style="font-size:11px;color:#666">Generado: ${new Date().toLocaleDateString("es-CL")}</div>
  </div>
</div>
<div class="title">${nombre}</div>
<table>
  <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="r">Monto</th></tr></thead>
  <tbody>
    ${(movs || []).map(m => {
      const fecha = movFecha(m);
      const desc = movDesc(m) || "—";
      const monto = movMonto(m);
      return `<tr>
      <td>${fecha ? new Date(fecha + "T12:00:00").toLocaleDateString("es-CL") : "—"}</td>
      <td>${m.cat || "—"}</td>
      <td>${desc}</td>
      <td class="r">${monto.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}</td>
    </tr>`;
    }).join("")}
  </tbody>
</table>
<div class="total-row">
  <div class="total-box">Total ${tipo}: ${total.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}</div>
</div>
<div class="footer">${empresa?.nombre || ""} · Generado con Produ</div>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

export async function exportEpisodiosPDF(episodios = [], programa = {}, empresa = null, helpers = {}) {
  const { companyPrintColor, fmtD, today } = helpers;
  const safeEpisodes = Array.isArray(episodios) ? episodios : [];
  const accent = companyPrintColor ? companyPrintColor(empresa) : "#1a1a2e";
  const formatDate = value => value ? (fmtD ? fmtD(value) : new Date(`${value}T12:00:00`).toLocaleDateString("es-CL")) : "Por confirmar";
  const buildEpisodeStatusPdf = await getEpisodeStatusPdfRuntime();
  const file = await buildEpisodeStatusPdf({
    fileName: `${slugFileName(programa?.nom || "produccion")}_estado_episodios.pdf`,
    title: "Estado de episodios",
    accent,
    empresa,
    programa,
    episodios: safeEpisodes,
    formatDate,
    generatedAt: formatDate(today ? today() : new Date().toISOString().slice(0, 10)),
    footerPrimary: "Hecho con amor por Produ.",
    footerSecondary: "",
  });
  downloadBlob(file, file.name || `${slugFileName(programa?.nom || "produccion")}_estado_episodios.pdf`);
}

export function exportTreasuryPayablesCSV(rows = [], nombre = "cuentas_por_pagar") {
  return exportTreasuryRowsCSV({
    rows,
    columns: [
      { label: "Proveedor", value: row => row?.supplier || "—" },
      { label: "Tipo documento", value: row => row?.docType || "—" },
      { label: "Folio", value: row => row?.folio || "—" },
      { label: "Categoria", value: row => row?.category || "—" },
      { label: "Fecha emision", value: row => row?.issueDate || "—" },
      { label: "Fecha vencimiento", value: row => row?.dueDate || "—" },
      { label: "Fecha estimada pago", value: row => row?.paymentDate || "—" },
      { label: "Estado", value: row => row?.status || "Pendiente" },
      { label: "Total", value: row => Number(row?.total || 0) },
      { label: "Pagado", value: row => Number(row?.paid || 0) },
      { label: "Pendiente", value: row => Number(row?.pending || 0) },
    ],
    fileName: nombre,
  });
}

function escapeDelimitedValue(value = "") {
  const raw = String(value ?? "");
  if (!/[",\n;]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function escapeHtmlCell(value = "") {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeExportFileName(fileName = "produ_export") {
  return slugFileName(fileName || "produ_export");
}

function resolveExportCell(column, row) {
  const raw = typeof column?.value === "function" ? column.value(row) : row?.[column?.key];
  return raw == null || raw === "" ? "—" : raw;
}

function exportDelimited({ rows = [], columns = [], fileName = "produ_export", separator = ",", extension = "csv" } = {}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const headers = safeColumns.map(column => escapeDelimitedValue(column.label || column.key || ""));
  const body = safeRows.map(row => safeColumns.map(column => escapeDelimitedValue(resolveExportCell(column, row))));
  const csv = [headers, ...body].map(line => line.join(separator)).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${normalizeExportFileName(fileName)}.${extension}`);
}

export function exportTreasuryRowsCSV({ rows = [], columns = [], fileName = "tesoreria" } = {}) {
  exportDelimited({ rows, columns, fileName, separator: ",", extension: "csv" });
}

export function exportTreasuryRowsXLS({ rows = [], columns = [], fileName = "tesoreria" } = {}) {
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];
  const html = `<!DOCTYPE html>
    <html><head><meta charset="UTF-8"></head><body>
      <table>
        <thead><tr>${safeColumns.map(column => `<th>${escapeHtmlCell(column.label || column.key || "")}</th>`).join("")}</tr></thead>
        <tbody>
          ${safeRows.map(row => `<tr>${safeColumns.map(column => `<td>${escapeHtmlCell(resolveExportCell(column, row))}</td>`).join("")}</tr>`).join("")}
        </tbody>
      </table>
    </body></html>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  downloadBlob(blob, `${normalizeExportFileName(fileName)}.xls`);
}

export async function exportTreasuryRowsPDF({
  rows = [],
  columns = [],
  fileName = "tesoreria",
  title = "Reporte de Tesorería",
  subtitle = "",
  empresa = null,
  accent = "#1a1a2e",
} = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const safeColumns = Array.isArray(columns) ? columns : [];
  const buildModernPdf = await getModernPdfRuntime();
  const bodySections = safeRows.length
    ? safeRows.map((row, index) => {
        const primary = safeColumns[0] ? resolveExportCell(safeColumns[0], row) : `Registro ${index + 1}`;
        const secondary = safeColumns[1] ? resolveExportCell(safeColumns[1], row) : "";
        return {
          title: `${String(primary || "Registro")} ${secondary && secondary !== "—" ? `· ${secondary}` : ""}`,
          rows: safeColumns.slice(2).map(column => ({
            label: column.label || column.key || "Dato",
            value: String(resolveExportCell(column, row)),
          })),
        };
      })
    : [{
        title: "Sin registros",
        text: "No hay datos para exportar en esta vista.",
      }];
  const file = await buildModernPdf({
    fileName: `${normalizeExportFileName(fileName)}.pdf`,
    title,
    accent,
    empresa,
    counterpartTitle: "Vista exportada",
    counterpartName: subtitle || "Tesorería",
    counterpartLines: [`Registros: ${safeRows.length}`],
    metaLines: [
      `Generado: ${new Date().toLocaleDateString("es-CL")}`,
      empresa?.nombre || empresa?.nom ? `Empresa: ${empresa?.nombre || empresa?.nom}` : "",
    ].filter(Boolean),
    bodySections,
    footerPrimary: "Hecho con amor por Produ.",
    footerSecondary: "Plataforma de Gestión de Empresas",
  });
  downloadBlob(file, file.name || `${normalizeExportFileName(fileName)}.pdf`);
}
