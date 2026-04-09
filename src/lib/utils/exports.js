export function exportComentariosCSV(items, nombre = "comentarios") {
  const headers = ["Fecha", "Autor", "Comentario", "Fotos"];
  const rows = (items || []).map(it => [
    it?.upd || it?.cr || "",
    String(it?.authorName || "—").replace(/,/g, " "),
    String(it?.text || "").replace(/\n/g, " ").replace(/,/g, " "),
    String((it?.photos || []).length || 0),
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

export function exportComentariosPDF(items, nombre = "comentarios", empresa = null, helpers = {}) {
  const { companyPrintColor } = helpers;
  const safeItems = Array.isArray(items) ? items : [];
  const ac = companyPrintColor ? companyPrintColor(empresa) : "#00d4e8";
  const htmlRows = safeItems.map(it => `
    <tr>
      <td>${it?.upd || it?.cr || "—"}</td>
      <td>${String(it?.authorName || "—").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
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
    ${safeItems.length ? `<table><thead><tr><th style="width:140px">Fecha</th><th style="width:180px">Autor</th><th>Comentario</th></tr></thead><tbody>${htmlRows}</tbody></table>` : `<div class="empty">No hay comentarios para exportar.</div>`}
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

export function exportActiveClientsPDF(items = [], helpers = {}) {
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
import { buildSimplePdfBlob } from "./pdf";
