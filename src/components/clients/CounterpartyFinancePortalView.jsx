import { useEffect, useMemo, useRef, useState } from "react";
import { dbGet, dbSet } from "../../hooks/useLabDataStore";
import {
  buildFinancePortalSessionKey,
  normalizeClientFinancePortal,
  normalizeProviderFinancePortal,
} from "../../lib/clients/financialPortal";
import {
  buildTreasuryDisbursementLog,
  buildTreasuryIssuedOrders,
  buildTreasuryPayables,
  buildTreasuryPortfolio,
  buildTreasuryPurchaseOrders,
  buildTreasuryReceiptLog,
  buildTreasuryReceivables,
  summarizeIssuedOrders,
  summarizePurchaseOrders,
  summarizeStoredPayables,
  summarizeTreasuryReceivables,
} from "../../lib/utils/treasury";
import { Badge, Btn, GBtn, Modal } from "../../lib/ui/components";
import { appendWorkflowEventEntry } from "../../lib/operations/workflowEvents";
import { appendOperationalAuditEntry } from "../../lib/operations/operationalAudit";

function fmtMoney(value = 0) {
  return "$" + Number(value || 0).toLocaleString("es-CL");
}

function fmtDate(value = "") {
  if (!value) return "—";
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return value;
  }
}

function safeText(value = "", fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeMatchKey(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesClientAccount(row = {}, client = {}) {
  const rowKeys = [
    row?.entidadId,
    row?.clientId,
    row?.entityId,
    row?.counterpartyId,
    row?.entidad,
    row?.clientName,
    row?.counterpartyLabel,
    row?.rut,
  ].map(normalizeMatchKey).filter(Boolean);
  const clientKeys = [
    client?.id,
    client?.nom,
    client?.razonSocial,
    client?.rut,
  ].map(normalizeMatchKey).filter(Boolean);
  return rowKeys.some(key => clientKeys.includes(key));
}

function matchesProviderAccount(row = {}, provider = {}) {
  const rowKeys = [
    row?.providerId,
    row?.supplier,
    row?.counterpartyLabel,
    row?.name,
    row?.razonSocial,
    row?.rut,
  ].map(normalizeMatchKey).filter(Boolean);
  const providerKeys = [
    provider?.id,
    provider?.name,
    provider?.razonSocial,
    provider?.rut,
  ].map(normalizeMatchKey).filter(Boolean);
  return rowKeys.some(key => providerKeys.includes(key));
}

function getInitials(value = "") {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "PR";
  return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join("");
}

function formatIdentity(value = "") {
  const normalized = String(value || "").trim();
  return normalized || "Sin identificación";
}

function openExternalLink(value = "") {
  const link = String(value || "").trim();
  if (!link) return;
  window.open(link, "_blank", "noopener,noreferrer");
}

function openBlobInNewTab(blob, fileName = "archivo.pdf") {
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.download = fileName;
    anchor.click();
  }
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

function downloadUrl(url = "", fileName = "archivo") {
  const link = String(url || "").trim();
  if (!link) return;
  const anchor = document.createElement("a");
  anchor.href = link;
  anchor.download = fileName || true;
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.click();
}

function escapeCsvCell(value = "") {
  const text = String(value ?? "");
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadCsvFile(headers = [], rows = [], fileName = "produ_export.csv") {
  const csv = [headers, ...(Array.isArray(rows) ? rows : [])]
    .map(row => (Array.isArray(row) ? row : []).map(cell => escapeCsvCell(cell)).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

let simplePdfBlobRuntimePromise = null;
async function getSimplePdfBlobRuntime() {
  if (!simplePdfBlobRuntimePromise) {
    simplePdfBlobRuntimePromise = import("../../lib/utils/pdf").then(module => module.buildSimplePdfBlob);
  }
  return simplePdfBlobRuntimePromise;
}

async function buildSectionPdfBlob({ title = "", subtitle = "", rows = [], accent = "#2f6ea8" } = {}) {
  const buildSimplePdfBlob = await getSimplePdfBlobRuntime();
  const lines = [
    { text: "PRODU", size: 18, bold: true, color: accent, gap: 18 },
    { text: title, size: 16, bold: true, color: "#0f172a", gap: 12 },
    { text: subtitle || "Resumen exportado desde portal financiero.", size: 11, color: "#64748b", gap: 18 },
    { text: `Generado: ${new Date().toLocaleDateString("es-CL")}`, size: 10, color: "#94a3b8", gap: 18 },
  ];
  if (!rows.length) {
    lines.push({ text: "No hay registros para exportar.", size: 12, color: "#475569", gap: 16 });
  } else {
    rows.forEach((row, index) => {
      lines.push({ text: `${index + 1}. ${row.title || "Registro"}`, size: 11, bold: true, color: "#0f172a", gap: 14 });
      (Array.isArray(row.lines) ? row.lines : []).forEach(item => {
        lines.push({ text: item, size: 10, color: "#475569", gap: 12 });
      });
      lines.push({ text: " ", size: 4, color: "#ffffff", gap: 6 });
    });
  }
  return buildSimplePdfBlob(lines, accent);
}

async function downloadSectionPdf({ title = "", subtitle = "", rows = [], accent = "#2f6ea8", fileName = "produ_portal.pdf" } = {}) {
  const blob = await buildSectionPdfBlob({ title, subtitle, rows, accent });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function openSectionPdf(options = {}) {
  const blob = await buildSectionPdfBlob(options);
  openBlobInNewTab(blob, options.fileName || "produ_portal.pdf");
}

function resolvePortalDocumentUrl(row = {}) {
  return String(
    row?.pdfUrl
    || row?.targetPdfUrl
    || row?.externalSync?.pdfUrl
    || row?.url
    || "",
  ).trim();
}

function resolvePortalDocumentName(row = {}, fallback = "documento.pdf") {
  return String(
    row?.pdfName
    || row?.targetPdfName
    || fallback,
  ).trim() || fallback;
}

function resolveReceivableState(row = {}) {
  if (Number(row.pending || 0) <= 0) return { label: "Pagado", color: "green" };
  if (Number(row.paid || 0) > 0) return { label: "Pago parcial", color: row.bucket === "Vencido" ? "orange" : "cyan" };
  if (row.bucket === "Vencido") return { label: "Vencido", color: "orange" };
  return { label: "Pendiente de pago", color: "cyan" };
}

function resolvePayableState(row = {}) {
  if (Number(row.pending || 0) <= 0) return { label: "Pagada", color: "green" };
  if (Number(row.paid || 0) > 0) return { label: "Pago parcial", color: row.status === "Vencida" ? "orange" : "cyan" };
  if (row.status === "Vencida") return { label: "Vencida", color: "orange" };
  return { label: "Pendiente de pago", color: "cyan" };
}

function resolveBudgetPortalState(row = {}) {
  const portalStatus = String(row?.clientPortalDecision?.status || "").toLowerCase();
  if (portalStatus === "approved") return { label: "Aprobado por cliente", color: "green" };
  if (portalStatus === "rejected" || portalStatus === "observed") return { label: "Observado por cliente", color: "orange" };
  const status = String(row?.estado || "").toLowerCase();
  if (status.includes("acept")) return { label: "Aceptado", color: "green" };
  if (status.includes("rechaz")) return { label: "Rechazado", color: "red" };
  return { label: "Pendiente de respuesta", color: "purple" };
}

function budgetDecisionLocked(row = {}) {
  const status = String(row?.estado || "").toLowerCase();
  return status.includes("acept");
}

function normalizeRecipientList(values = []) {
  const seen = new Set();
  return (Array.isArray(values) ? values : [])
    .map(item => String(item || "").trim().toLowerCase())
    .filter(item => item.includes("@") && !seen.has(item) && seen.add(item));
}

function pickRecordEmails(record = {}, keys = []) {
  return normalizeRecipientList(keys.map(key => record?.[key]));
}

function accessCodeSlots(code = "") {
  const clean = String(code || "").replace(/\D/g, "").slice(0, 6);
  return Array.from({ length: 6 }, (_, index) => clean[index] || "");
}

function useViewportFlags() {
  const [width, setWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1440);
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return {
    width,
    isMobile: width <= 760,
    isTablet: width <= 1080,
  };
}

function PublicFinanceShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(47,110,168,.14), transparent 28%), radial-gradient(circle at top right, rgba(47,110,168,.07), transparent 24%), linear-gradient(180deg, #f4f8fd 0%, #edf3fb 42%, #f8fbff 100%)", padding: "24px 16px 30px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "grid", gap: 22 }}>
        {children}
        <PortalBrandFooter />
      </div>
    </div>
  );
}

function PortalBrandFooter() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ background: "#ffffff", border: "1px solid #dbe6f3", borderRadius: 22, padding: "15px 22px", boxShadow: "0 16px 40px rgba(15,23,42,.06)" }}>
        <div style={{ fontSize: 12.5, color: "#6b7c93", textAlign: "center" }}>
          Portal creado con <span style={{ color: "#ff5566" }}>♥</span> por <span style={{ color: "#1f4ed8", fontWeight: 800 }}>Produ.</span>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 13, color: "#74859d" }}>
        Plataforma de gestión para productoras audiovisuales.
      </div>
    </div>
  );
}

function PortalSectionCard({ title = "", sub = "", children, actions = null, columns = 1, mobile = false }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #dbe6f3", borderRadius: 24, padding: mobile ? "16px 14px" : "18px 18px 16px", boxShadow: "0 18px 44px rgba(15,23,42,.06)" }}>
      {(title || sub || actions) ? (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #e6eef8" }}>
          <div>
            {!!title && <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 900, color: "#0f172a", lineHeight: 1.15 }}>{title}</div>}
            {!!sub && <div style={{ marginTop: 6, fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{sub}</div>}
          </div>
          {actions}
        </div>
      ) : null}
      <div style={{ display: "grid", gap: 14, gridTemplateColumns: columns > 1 && !mobile ? `repeat(${columns}, minmax(0, 1fr))` : "1fr" }}>
        {children}
      </div>
    </div>
  );
}

function PortalEmptyState({ text = "", sub = "" }) {
  return (
    <div style={{ textAlign: "center", padding: "28px 16px", color: "#64748b", background: "#f8fbff", border: "1px dashed #d9e5f6", borderRadius: 18 }}>
      <div style={{ fontSize: 20, marginBottom: 8, opacity: 0.32 }}>◻</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0f172a" }}>{text}</div>
      {sub ? <div style={{ fontSize: 12, color: "#64748b", marginTop: 7, lineHeight: 1.55 }}>{sub}</div> : null}
    </div>
  );
}

function PortalTH({ children, style = {} }) {
  return <th style={{ textAlign: "left", padding: "10px 11px", fontSize: 9, letterSpacing: 1.4, textTransform: "uppercase", color: "#7b8ca5", borderBottom: "1px solid #dbe6f3", fontWeight: 800, whiteSpace: "nowrap", background: "#f7fbff", ...style }}>{children}</th>;
}

function PortalTD({ children, style = {} }) {
  return <td style={{ padding: "10px 11px", fontSize: 11.5, color: "#40556f", borderBottom: "1px solid #e8eef8", verticalAlign: "middle", lineHeight: 1.45, ...style }}>{children}</td>;
}

const Card = PortalSectionCard;
const TH = PortalTH;
const TD = PortalTD;
const Empty = PortalEmptyState;

function PortalMetricCard({ eyebrow = "", value = "—", tone = "blue" }) {
  const palette = {
    blue: { bg: "#eef5ff", border: "#d6e7ff", label: "#4b6590", value: "#2f6ea8" },
    red: { bg: "#fff3f0", border: "#ffd9cf", label: "#965b53", value: "#dd654c" },
    green: { bg: "#eefbf5", border: "#cdeedc", label: "#4e7b67", value: "#21a16b" },
    purple: { bg: "#f7f0ff", border: "#e8d5ff", label: "#735f93", value: "#8c5de8" },
  };
  const current = palette[tone] || palette.blue;
  return (
    <div style={{ background: current.bg, border: `1px solid ${current.border}`, borderRadius: 20, padding: "13px 14px 12px", minHeight: 86 }}>
      <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: current.label, fontWeight: 800, marginBottom: 8 }}>{eyebrow}</div>
      <div style={{ fontFamily: "var(--fh)", fontSize: 20, fontWeight: 900, lineHeight: 1.05, color: current.value }}>{value}</div>
    </div>
  );
}

function FinanceHero({ type = "client", companyName = "", counterpartyName = "", identity = "", subtitle = "", onClosePortal = null }) {
  const { isMobile, isTablet } = useViewportFlags();
  return (
    <div style={{ background: "#ffffff", border: "1px solid #d8e4f4", borderRadius: 28, overflow: "hidden", boxShadow: "0 24px 80px rgba(15,23,42,.10)" }}>
      <div style={{ background: "linear-gradient(135deg, #10204f 0%, #173a78 56%, #2f6ea8 100%)", color: "#ffffff", padding: "14px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13 }}>
              {getInitials(companyName)}
            </div>
            <div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 19, fontWeight: 900, lineHeight: 1.05 }}>{companyName || "Produ"}</div>
              <div style={{ fontSize: 11.5, opacity: 0.88 }}>{type === "provider" ? "Portal Proveedor" : "Portal Cliente"}</div>
            </div>
          </div>
          <GBtn onClick={onClosePortal} s={{ borderRadius: 999, padding: "7px 13px", fontSize: 11.5, fontWeight: 700, borderColor: "rgba(255,255,255,.42)", color: "#ffffff", background: "rgba(255,255,255,.08)" }}>Cerrar portal</GBtn>
        </div>
      </div>
      <div style={{ padding: isMobile ? "14px 14px 12px" : "18px 18px 16px", display: "grid", gridTemplateColumns: isTablet ? "1fr" : "minmax(0,1.45fr) minmax(280px,.55fr)", gap: 14 }}>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: isMobile ? 50 : 54, height: isMobile ? 50 : 54, borderRadius: 999, background: "#0f1f4a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 18 : 19, fontWeight: 900, flexShrink: 0 }}>
            {getInitials(counterpartyName)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: isMobile ? 22 : 24, fontWeight: 900, lineHeight: 1.04, color: "#0f172a" }}>{counterpartyName || "Contraparte"}</div>
            <div style={{ marginTop: 5, fontSize: 12.5, color: "#61728b" }}>{identity} · Atiende {companyName || "Produ"}</div>
            <div style={{ marginTop: 10, fontSize: 12.5, lineHeight: 1.62, color: "#4c5f79", maxWidth: 680 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ background: "#f6f9fe", border: "1px solid #d9e5f6", borderRadius: 18, padding: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: "#6f7f98", fontWeight: 800, marginBottom: 7 }}>Qué puedes hacer aquí</div>
          <div style={{ display: "grid", gap: 7, fontSize: 12, color: "#465b78", lineHeight: 1.52 }}>
            <div>• Revisar documentos, vencimientos y pagos asociados a tu cuenta.</div>
            <div>• Ver órdenes de compra y el estado de cada documento.</div>
            <div>• Consultar línea de crédito, saldos pendientes y documentos cerrados.</div>
            {type === "client" ? <div>• Pagar en línea cuando el documento ya tenga un link de pago disponible.</div> : <div>• Revisar información bancaria y pagos registrados por tu equipo.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionActionBar({ onCsv = null, onPdf = null, right = null }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {onCsv ? <GBtn onClick={onCsv} s={{ borderRadius: 999, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, borderColor: "#d7e4f5", color: "#35506d", background: "#ffffff" }}>Descargar CSV</GBtn> : null}
        {onPdf ? <GBtn onClick={onPdf} s={{ borderRadius: 999, padding: "7px 12px", fontSize: 11.5, fontWeight: 700, borderColor: "#d7e4f5", color: "#35506d", background: "#ffffff" }}>Descargar PDF</GBtn> : null}
      </div>
      {right ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{right}</div> : null}
    </div>
  );
}

async function resolveFinancePortalPayload(empresas = [], descriptor = null) {
  const type = descriptor?.type;
  const slug = String(descriptor?.slug || "").trim();
  if (!type || !slug) return { error: "missing_route" };
  for (const empresa of Array.isArray(empresas) ? empresas : []) {
    const empId = empresa?.id;
    if (!empId) continue;
    const [
      clientes,
      presupuestos,
      facturas,
      purchaseOrders,
      receipts,
      treasuryProviders,
      payables,
      issuedOrders,
      disbursements,
      auspiciadores,
    ] = await Promise.all([
      dbGet(`produ:${empId}:clientes`),
      dbGet(`produ:${empId}:presupuestos`),
      dbGet(`produ:${empId}:facturas`),
      dbGet(`produ:${empId}:treasuryPurchaseOrders`),
      dbGet(`produ:${empId}:treasuryReceipts`),
      dbGet(`produ:${empId}:treasuryProviders`),
      dbGet(`produ:${empId}:treasuryPayables`),
      dbGet(`produ:${empId}:treasuryIssuedOrders`),
      dbGet(`produ:${empId}:treasuryDisbursements`),
      dbGet(`produ:${empId}:auspiciadores`),
    ]);
    if (type === "client") {
      const client = (Array.isArray(clientes) ? clientes : []).find(item => {
        const portal = normalizeClientFinancePortal(item?.financialPortal, item);
        return portal.enabled && portal.slug === slug;
      });
      if (!client) continue;
      return {
        type,
        empresa,
        client,
        portal: normalizeClientFinancePortal(client?.financialPortal, client),
        clientes: Array.isArray(clientes) ? clientes : [],
        presupuestos: Array.isArray(presupuestos) ? presupuestos : [],
        facturas: Array.isArray(facturas) ? facturas : [],
        purchaseOrders: Array.isArray(purchaseOrders) ? purchaseOrders : [],
        receipts: Array.isArray(receipts) ? receipts : [],
        auspiciadores: Array.isArray(auspiciadores) ? auspiciadores : [],
      };
    }
    const providers = Array.isArray(treasuryProviders) ? treasuryProviders : [];
    const provider = providers.find(item => {
      const portal = normalizeProviderFinancePortal(item?.financialPortal, item);
      return portal.enabled && portal.slug === slug;
    });
    if (!provider) continue;
    return {
      type,
      empresa,
      provider,
      portal: normalizeProviderFinancePortal(provider?.financialPortal, provider),
      payables: Array.isArray(payables) ? payables : [],
      issuedOrders: Array.isArray(issuedOrders) ? issuedOrders : [],
      disbursements: Array.isArray(disbursements) ? disbursements : [],
      treasuryProviders: providers,
    };
  }
  return { error: "not_found" };
}

function PortalGate({ payload, onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const codeInputRef = useRef(null);
  const label = payload?.type === "provider" ? payload?.provider?.name : payload?.client?.nom;
  const company = payload?.empresa?.nombre || payload?.empresa?.nom || "Produ";
  const canSubmit = code.trim().length === 6;

  const handleSubmit = () => {
    if (String(code).trim() !== String(payload?.portal?.accessCode || "").trim()) {
      setError("El código no coincide. Revisa el enlace o el mensaje que te compartieron.");
      return;
    }
    setError("");
    onUnlock();
  };

  return (
    <PublicFinanceShell>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#ffffff", border: "1px solid #dbe6f3", boxShadow: "0 28px 80px rgba(15,23,42,.10)", borderRadius: 28, overflow: "hidden" }}>
        <div style={{ padding: "34px 36px 20px", borderBottom: "1px solid #e8eef8", background: "linear-gradient(135deg, rgba(47,110,168,.10), rgba(255,255,255,.96) 48%, rgba(47,110,168,.04))" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: "#2f6ea8", marginBottom: 12 }}>
            {payload?.type === "provider" ? "Portal Proveedor" : "Portal Cliente"}
          </div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 22, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>{label || "Portal financiero"}</div>
          <div style={{ fontSize: 14, color: "#5b6b82", marginTop: 10 }}>
            Este espacio fue preparado por <b style={{ color: "#0f172a" }}>{company}</b> para revisar documentos, pagos, órdenes de compra y presupuestos relacionados.
          </div>
        </div>
        <div style={{ padding: 36, display: "grid", gap: 20 }}>
          <div style={{ background: "#f7faff", border: "1px solid #dbe7f5", borderRadius: 22, padding: 24 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 15, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Código de acceso</div>
            <div style={{ fontSize: 12.5, color: "#5b6b82", lineHeight: 1.6, marginBottom: 18 }}>
              Ingresa el código de 6 dígitos que te compartieron para entrar a este portal financiero.
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <button type="button" onClick={() => codeInputRef.current?.focus()} style={{ display: "flex", gap: 10, flexWrap: "wrap", background: "transparent", border: "none", padding: 0, cursor: "text" }}>
                {accessCodeSlots(code).map((digit, index) => (
                  <div key={index} style={{ width: 48, height: 58, borderRadius: 16, border: `1px solid ${digit ? "#7cb2ea" : "#dbe7f5"}`, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#2f6ea8", boxShadow: digit ? "0 0 0 3px rgba(47,110,168,.08)" : "none" }}>
                    {digit}
                  </div>
                ))}
              </button>
              <input
                ref={codeInputRef}
                value={code}
                onChange={event => setCode(String(event.target.value || "").replace(/\D/g, "").slice(0, 6))}
                onKeyDown={event => { if (event.key === "Enter" && canSubmit) handleSubmit(); }}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Ingresa tu código"
                style={{ width: "100%", borderRadius: 14, border: "1px solid #cfe0fb", padding: "11px 13px", fontSize: 13.5, color: "#0f172a", background: "#ffffff" }}
              />
              {error ? <div style={{ color: "#c2410c", fontSize: 13 }}>{error}</div> : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Btn onClick={handleSubmit} disabled={!canSubmit} s={{ borderRadius: 999, padding: "10px 16px", fontSize: 12, fontWeight: 800 }}>Entrar al portal</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicFinanceShell>
  );
}

function SectionTabs({ type, tab, setTab }) {
  const { isMobile } = useViewportFlags();
  const tabs = type === "provider"
    ? [["resumen", "Resumen"], ["documentos", "Documentos"], ["ordenes", "OC emitidas"], ["pagos", "Pagos"], ["datos", "Cuenta"]]
    : [["resumen", "Resumen"], ["documentos", "Facturas"], ["ordenes", "OC recibidas"], ["presupuestos", "Presupuestos"], ["pagos", "Pagos"], ["datos", "Cuenta"]];
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: isMobile ? "nowrap" : "wrap", overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? 4 : 0 }}>
      {tabs.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => setTab(key)}
          style={{
            borderRadius: 999,
            border: `1px solid ${tab === key ? "#7cb2ea" : "#dbe7f5"}`,
            background: tab === key ? "#2f6ea8" : "#ffffff",
            color: tab === key ? "#ffffff" : "#35506d",
            padding: "9px 14px",
            fontSize: 11.5,
            fontWeight: 800,
            cursor: "pointer",
            whiteSpace: "nowrap",
            flex: isMobile ? "0 0 auto" : "0 0 auto",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const portalFieldStyle = {
  minWidth: 180,
  borderRadius: 12,
  border: "1px solid #d7e4f5",
  background: "#ffffff",
  padding: "9px 12px",
  fontSize: 12.5,
  color: "#35506d",
};

const portalTableWrapStyle = {
  overflowX: "auto",
  border: "1px solid #dbe6f3",
  borderRadius: 18,
  background: "#fbfdff",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.8)",
};

const portalTableStyle = {
  width: "100%",
  minWidth: 860,
  borderCollapse: "separate",
  borderSpacing: 0,
};

const portalThStyle = {
  padding: "10px 11px",
  fontSize: 9,
  letterSpacing: 1.5,
};

const portalTdStyle = {
  padding: "10px 11px",
  fontSize: 11.5,
  lineHeight: 1.4,
};

const portalSecondaryBtnStyle = {
  borderRadius: 999,
  padding: "6px 11px",
  fontSize: 11,
  fontWeight: 700,
  borderColor: "#d7e4f5",
  color: "#35506d",
  background: "#ffffff",
};

const portalPrimaryBtnStyle = {
  borderRadius: 999,
  padding: "7px 12px",
  fontSize: 11,
  fontWeight: 800,
  boxShadow: "0 10px 24px rgba(47,110,168,.16)",
};

function buildPortalActor(payload = null) {
  const type = payload?.type === "provider" ? "supplier_finance_portal" : "client_finance_portal";
  const name = payload?.type === "provider" ? payload?.provider?.name : payload?.client?.nom;
  const authorizedEmail = Array.isArray(payload?.portal?.authorizedEmails) ? payload.portal.authorizedEmails[0] || "" : "";
  return {
    id: payload?.portal?.slug || "",
    name: safeText(name, "Portal financiero"),
    email: String(authorizedEmail || "").trim().toLowerCase(),
    role: type,
  };
}

async function appendFinancePortalAlert(payload = null, { title = "", body = "", severity = "info", action = "" } = {}) {
  if (!payload?.empresa?.id) return;
  const empresasKey = "produ:empresas";
  const currentEmpresas = await dbGet(empresasKey);
  const portalAlert = {
    id: `fportal_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    tipo: severity,
    area: "finanzas",
    icon: severity === "urgente" ? "💳" : "📄",
    titulo: title,
    sub: action,
    body,
    createdAt: new Date().toISOString(),
    source: "finance_portal",
    counterpartyId: payload?.type === "provider" ? payload?.provider?.id : payload?.client?.id,
  };
  const nextEmpresas = (Array.isArray(currentEmpresas) ? currentEmpresas : []).map(item => item.id === payload.empresa.id
    ? { ...item, portalAlerts: [portalAlert, ...(Array.isArray(item.portalAlerts) ? item.portalAlerts : [])].slice(0, 50) }
    : item);
  await dbSet(empresasKey, nextEmpresas);
}

function ClientFinanceBody({ payload, onPortalAction, onPortalSignal, onBudgetDecision }) {
  const { isMobile, isTablet } = useViewportFlags();
  const receivables = useMemo(
    () => buildTreasuryReceivables({
      facturas: payload.facturas,
      clientes: payload.clientes,
      auspiciadores: payload.auspiciadores,
      receipts: payload.receipts,
      empId: payload.empresa?.id,
    }).filter(row => matchesClientAccount(row, payload.client)),
    [payload],
  );
  const purchaseOrders = useMemo(
    () => buildTreasuryPurchaseOrders({
      orders: payload.purchaseOrders,
      facturas: payload.facturas,
      clientes: payload.clientes,
      receipts: payload.receipts,
      empId: payload.empresa?.id,
    }).filter(row => matchesClientAccount(row, payload.client)),
    [payload],
  );
  const portfolio = useMemo(
    () => buildTreasuryPortfolio({ rows: receivables, clientes: [payload.client], purchaseOrders }),
    [receivables, payload.client, purchaseOrders],
  )[0] || null;
  const receiptLog = useMemo(
    () => buildTreasuryReceiptLog({
      receipts: payload.receipts,
      facturas: payload.facturas,
      clientes: payload.clientes,
      auspiciadores: payload.auspiciadores,
      empId: payload.empresa?.id,
    }).filter(row => matchesClientAccount(row, payload.client)),
    [payload],
  );
  const budgets = useMemo(
    () => (Array.isArray(payload.presupuestos) ? payload.presupuestos : []).filter(item => matchesClientAccount(item, payload.client)),
    [payload],
  );
  const receivableSummary = useMemo(() => summarizeTreasuryReceivables(receivables), [receivables]);
  const purchaseOrderSummary = useMemo(() => summarizePurchaseOrders(purchaseOrders), [purchaseOrders]);
  const onTimePending = useMemo(
    () => receivables.filter(row => Number(row.pending || 0) > 0 && row.bucket !== "Vencido").reduce((sum, row) => sum + Number(row.pending || 0), 0),
    [receivables],
  );
  const overduePending = useMemo(
    () => receivables.filter(row => row.bucket === "Vencido").reduce((sum, row) => sum + Number(row.pending || 0), 0),
    [receivables],
  );
  const pendingBudgets = budgets.filter(item => !/aceptado|rechazado/i.test(String(item.estado || "")));
  const clientContacts = Array.isArray(payload.client?.contactos) ? payload.client.contactos : [];
  const [docSearch, setDocSearch] = useState("");
  const [docStatus, setDocStatus] = useState("all");
  const [tab, setTab] = useState("resumen");
  const [budgetDecision, setBudgetDecision] = useState(null);
  const [budgetDecisionNote, setBudgetDecisionNote] = useState("");
  const [budgetDecisionSaving, setBudgetDecisionSaving] = useState(false);

  const visibleReceivables = useMemo(() => {
    return receivables.filter(row => {
      const matchesSearch = !docSearch.trim() || [
        row.correlativo,
        row.tipoDoc,
        row.cobranza,
      ].some(value => String(value || "").toLowerCase().includes(docSearch.trim().toLowerCase()));
      const matchesStatus = docStatus === "all"
        || (docStatus === "paid" && Number(row.pending || 0) <= 0)
        || (docStatus === "overdue" && row.bucket === "Vencido")
        || (docStatus === "pending" && Number(row.pending || 0) > 0 && row.bucket !== "Vencido");
      return matchesSearch && matchesStatus;
    });
  }, [receivables, docSearch, docStatus]);

  const exportReceivablesCsv = async () => {
    downloadCsvFile(
      ["Numero", "Tipo", "Emision", "Vencimiento", "Monto", "Saldo", "Estado", "Pagos asociados"],
      visibleReceivables.map(row => [
      row.correlativo || "—",
      row.tipoDoc || "Documento",
      row.fechaEmision || "",
      row.fechaVencimiento || "",
      Number(row.total || 0),
      Number(row.pending || 0),
      row.cobranza || row.bucket || "Pendiente",
      `${Array.isArray(row.paymentHistory) ? row.paymentHistory.length : 0} pago(s) / ${fmtMoney(row.paid || 0)}`,
      ]),
      `portal_cliente_documentos_${payload.client?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_receivables_csv", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó CSV de documentos (${visibleReceivables.length})` });
  };
  const exportReceivablesPdf = async () => {
    await downloadSectionPdf({
      title: `Documentos · ${payload.client?.nom || "Cliente"}`,
      subtitle: "Resumen de documentos visibles en el portal financiero.",
      fileName: `portal_cliente_documentos_${payload.client?.id || "cuenta"}.pdf`,
      rows: visibleReceivables.map(row => ({
        title: `${row.correlativo || "Documento"} · ${row.tipoDoc || "Documento"}`,
        lines: [
          `Emisión: ${fmtDate(row.fechaEmision)} · Vencimiento: ${fmtDate(row.fechaVencimiento)}`,
          `Monto: ${fmtMoney(row.total)} · Saldo: ${fmtMoney(row.pending)} · Estado: ${row.cobranza || row.bucket || "Pendiente"}`,
          `Pagos asociados: ${(row.paymentHistory || []).length} · Pagado: ${fmtMoney(row.paid || 0)}`,
        ],
      })),
    });
    await onPortalSignal?.({ eventName: "export_receivables_pdf", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó PDF de documentos (${visibleReceivables.length})` });
  };
  const exportPurchaseOrdersCsv = async () => {
    downloadCsvFile(
    ["Numero", "Emision", "Monto", "Facturacion", "Saldo OC"],
    purchaseOrders.map(row => [row.number || "—", row.issueDate || "", Number(row.amount || 0), row.billingStatus || "Pendiente", Number(row.pendingAmount || 0)]),
    `portal_cliente_oc_${payload.client?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_purchase_orders_csv", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó CSV de OC (${purchaseOrders.length})` });
  };
  const exportPurchaseOrdersPdf = async () => {
    await downloadSectionPdf({
      title: `OC recibidas · ${payload.client?.nom || "Cliente"}`,
      subtitle: "Ordenes de compra recibidas visibles en el portal financiero.",
      fileName: `portal_cliente_oc_${payload.client?.id || "cuenta"}.pdf`,
      rows: purchaseOrders.map(row => ({
        title: row.number || "OC",
        lines: [
          `Emisión: ${fmtDate(row.issueDate)} · Monto: ${fmtMoney(row.amount)}`,
          `Estado facturación: ${row.billingStatus || "Pendiente"} · Saldo OC: ${fmtMoney(row.pendingAmount || 0)}`,
        ],
      })),
    });
    await onPortalSignal?.({ eventName: "export_purchase_orders_pdf", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó PDF de OC (${purchaseOrders.length})` });
  };
  const exportBudgetsCsv = async () => {
    downloadCsvFile(
    ["Titulo", "Estado", "Total", "Forma de pago", "Observacion"],
    budgets.map(row => [row.titulo || "Presupuesto", row.estado || "Borrador", Number(row.total || 0), row.paymentMethod || row.formaPago || "", row.observacion || row.portalClientComment || ""]),
    `portal_cliente_presupuestos_${payload.client?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_budgets_csv", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó CSV de presupuestos (${budgets.length})` });
  };
  const exportBudgetsPdf = async () => {
    await downloadSectionPdf({
      title: `Presupuestos · ${payload.client?.nom || "Cliente"}`,
      subtitle: "Propuestas visibles en el portal financiero.",
      fileName: `portal_cliente_presupuestos_${payload.client?.id || "cuenta"}.pdf`,
      rows: budgets.map(row => ({
        title: row.titulo || "Presupuesto",
        lines: [
          `Estado: ${row.estado || "Borrador"} · Total: ${fmtMoney(row.total || 0)}`,
          `Forma de pago: ${safeText(row.paymentMethod || row.formaPago, "Sin definir")}`,
          `Observación: ${safeText(row.observacion || row.portalClientComment || "", "Sin observación")}`,
        ],
      })),
    });
    await onPortalSignal?.({ eventName: "export_budgets_pdf", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó PDF de presupuestos (${budgets.length})` });
  };
  const previewBudgetRow = async (row = {}) => {
    await openSectionPdf({
      title: `${row.titulo || "Presupuesto"} · ${payload.client?.nom || "Cliente"}`,
      subtitle: "Resumen de la propuesta visible desde el portal financiero.",
      fileName: `${String(row.correlativo || row.titulo || "presupuesto").replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "presupuesto"}.pdf`,
      rows: [{
        title: row.titulo || "Presupuesto",
        lines: [
          `Estado: ${(resolveBudgetPortalState(row)).label}`,
          `Total: ${fmtMoney(row.total || 0)} · Forma de pago: ${safeText(row.paymentMethod || row.formaPago, "Sin definir")}`,
          `Observación: ${safeText(row.observacion || row.portalClientComment || row.clientPortalDecision?.note || "", "Sin observación")}`,
        ],
      }],
    });
    await onPortalSignal?.({ eventName: "preview_budget_pdf", entityType: "budget", entityId: row.id, summary: `Vista de presupuesto ${row.titulo || row.correlativo || row.id}` });
  };
  const downloadBudgetRow = async (row = {}) => {
    await downloadSectionPdf({
      title: `${row.titulo || "Presupuesto"} · ${payload.client?.nom || "Cliente"}`,
      subtitle: "Resumen de la propuesta visible desde el portal financiero.",
      fileName: `${String(row.correlativo || row.titulo || "presupuesto").replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "presupuesto"}.pdf`,
      rows: [{
        title: row.titulo || "Presupuesto",
        lines: [
          `Estado: ${(resolveBudgetPortalState(row)).label}`,
          `Total: ${fmtMoney(row.total || 0)} · Forma de pago: ${safeText(row.paymentMethod || row.formaPago, "Sin definir")}`,
          `Observación: ${safeText(row.observacion || row.portalClientComment || row.clientPortalDecision?.note || "", "Sin observación")}`,
        ],
      }],
    });
    await onPortalSignal?.({ eventName: "download_budget_pdf", entityType: "budget", entityId: row.id, summary: `Descarga de presupuesto ${row.titulo || row.correlativo || row.id}` });
  };
  const submitBudgetDecision = async () => {
    if (!budgetDecision?.id || !budgetDecision?.status) return;
    setBudgetDecisionSaving(true);
    const ok = await onBudgetDecision?.({
      budgetId: budgetDecision.id,
      status: budgetDecision.status,
      note: budgetDecisionNote,
    });
    setBudgetDecisionSaving(false);
    if (ok) {
      setBudgetDecision(null);
      setBudgetDecisionNote("");
    }
  };
  const exportPaymentsCsv = async () => {
    downloadCsvFile(
    ["Fecha", "Documento", "Metodo", "Referencia", "Monto"],
    receiptLog.map(row => [row.date || "", row.targetLabel || "—", row.method || "", row.reference || "", Number(row.amount || 0)]),
    `portal_cliente_pagos_${payload.client?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_receipts_csv", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó CSV de pagos (${receiptLog.length})` });
  };
  const exportPaymentsPdf = async () => {
    await downloadSectionPdf({
      title: `Pagos · ${payload.client?.nom || "Cliente"}`,
      subtitle: "Pagos asociados a documentos visibles en el portal financiero.",
      fileName: `portal_cliente_pagos_${payload.client?.id || "cuenta"}.pdf`,
      rows: receiptLog.map(row => ({
        title: row.targetLabel || "Pago",
        lines: [
          `Fecha: ${fmtDate(row.date)} · Método: ${safeText(row.method)}`,
          `Referencia: ${safeText(row.reference)} · Monto: ${fmtMoney(row.amount || 0)}`,
        ],
      })),
    });
    await onPortalSignal?.({ eventName: "export_receipts_pdf", entityType: "client_finance_portal", entityId: payload.client?.id, summary: `Exportó PDF de pagos (${receiptLog.length})` });
  };
  const exportAccountCsv = async () => {
    downloadCsvFile(
    ["Cliente", "RUT", "Limite de credito", "Cupo disponible", "Presupuestos pendientes"],
    [[payload.client?.nom || "Cliente", payload.client?.rut || "", Number(payload.client?.creditLimit || 0), portfolio?.availableCredit == null ? "" : Number(portfolio.availableCredit || 0), pendingBudgets.length]],
    `portal_cliente_cuenta_${payload.client?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_account_csv", entityType: "client_finance_portal", entityId: payload.client?.id, summary: "Exportó CSV de cuenta" });
  };
  const exportAccountPdf = async () => {
    await downloadSectionPdf({
      title: `Cuenta · ${payload.client?.nom || "Cliente"}`,
      subtitle: "Información general y contactos visibles en el portal financiero.",
      fileName: `portal_cliente_cuenta_${payload.client?.id || "cuenta"}.pdf`,
      rows: [
        {
          title: payload.client?.nom || "Cliente",
          lines: [
            `RUT: ${formatIdentity(payload.client?.rut)}`,
            `Límite de crédito: ${payload.client?.creditLimit ? fmtMoney(payload.client.creditLimit) : "No definido"} · Cupo disponible: ${portfolio?.availableCredit == null ? "—" : fmtMoney(portfolio.availableCredit)}`,
            `Presupuestos pendientes: ${pendingBudgets.length}`,
          ],
        },
        ...clientContacts.map(contact => ({
          title: safeText(contact.nom || contact.nombre, "Contacto"),
          lines: [
            `Cargo: ${safeText(contact.car || contact.cargo, "Sin cargo")}`,
            `Correo: ${safeText(contact.ema || contact.email, "Sin correo")}`,
          ],
        })),
      ],
    });
    await onPortalSignal?.({ eventName: "export_account_pdf", entityType: "client_finance_portal", entityId: payload.client?.id, summary: "Exportó PDF de cuenta" });
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12 }}>
        <PortalMetricCard eyebrow="Total por pagar" value={fmtMoney(receivableSummary.pending)} tone="blue" />
        <PortalMetricCard eyebrow="A tiempo" value={fmtMoney(onTimePending)} tone="green" />
        <PortalMetricCard eyebrow="Vencido" value={fmtMoney(overduePending)} tone="red" />
        <PortalMetricCard eyebrow="Línea disponible" value={portfolio?.availableCredit == null ? "—" : fmtMoney(portfolio.availableCredit)} tone="purple" />
      </div>
      <SectionTabs type="client" tab={tab} setTab={setTab} />
      {tab === "resumen" ? (
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1.2fr .8fr", gap: 16 }}>
          <Card title="Resumen financiero" sub="Aquí puedes revisar el estado actual de tus documentos, pagos y compromisos abiertos.">
            <div style={{ display: "grid", gap: 9, fontSize: 13, color: "#53657e" }}>
              <div><b style={{ color: "#0f172a" }}>Total por pagar:</b> {fmtMoney(receivableSummary.pending)}</div>
              <div><b style={{ color: "#0f172a" }}>Documentos vencidos:</b> {receivableSummary.overdueDocs}</div>
              <div><b style={{ color: "#0f172a" }}>Órdenes de compra recibidas:</b> {purchaseOrderSummary.docs}</div>
              <div><b style={{ color: "#0f172a" }}>Presupuestos visibles:</b> {budgets.length}</div>
              <div><b style={{ color: "#0f172a" }}>Límite de crédito:</b> {portfolio?.creditLimit ? fmtMoney(portfolio.creditLimit) : "No definido"}</div>
            </div>
          </Card>
          <Card title="Lo más importante hoy" sub="Señales rápidas para saber qué revisar primero.">
            <div style={{ display: "grid", gap: 9, fontSize: 13, color: "#53657e" }}>
              <div>• {receivableSummary.overdueDocs} documento(s) están vencidos.</div>
              <div>• {purchaseOrders.filter(item => item.pendingAmount > 0).length} orden(es) de compra siguen parcialmente abiertas.</div>
              <div>• {pendingBudgets.length} presupuesto(s) siguen pendientes de cierre.</div>
            </div>
          </Card>
        </div>
      ) : null}
      {tab === "documentos" ? (
        <Card title="Facturas y documentos" sub="Revisa tus documentos, filtra por estado y paga en línea cuando el documento ya tenga un link activo en Produ.">
          <SectionActionBar onCsv={exportReceivablesCsv} onPdf={exportReceivablesPdf} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <input value={docSearch} onChange={event => setDocSearch(event.target.value)} placeholder="Buscar por número, tipo o estado" style={{ ...portalFieldStyle, minWidth: 220, flex: "1 1 260px", background: "#f9fbff" }} />
            <select value={docStatus} onChange={event => setDocStatus(event.target.value)} style={portalFieldStyle}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidos</option>
              <option value="paid">Pagados</option>
            </select>
          </div>
          {visibleReceivables.length ? <div style={portalTableWrapStyle}><table style={portalTableStyle}>
            <thead><tr><TH style={portalThStyle}>Número</TH><TH style={portalThStyle}>Tipo de documento</TH><TH style={portalThStyle}>Emisión</TH><TH style={portalThStyle}>Vencimiento</TH><TH style={portalThStyle}>Monto</TH><TH style={portalThStyle}>Saldo</TH><TH style={portalThStyle}>Pagos</TH><TH style={portalThStyle}>Estado</TH><TH style={portalThStyle}>Acciones</TH></tr></thead>
            <tbody>{visibleReceivables.map(row => {
              const paymentLink = String(row?.mercadoPago?.initPoint || "").trim();
              return (
                <tr key={row.id}>
                  <TD style={portalTdStyle}>{row.correlativo || "—"}</TD>
                  <TD style={portalTdStyle}>{safeText(row.tipoDoc || row.documentTypeCode || "Documento")}</TD>
                  <TD style={portalTdStyle}>{fmtDate(row.fecha || row.fechaEmision)}</TD>
                  <TD style={portalTdStyle}>{fmtDate(row.fechaVencimiento)}</TD>
                  <TD style={portalTdStyle}>{fmtMoney(row.total)}</TD>
                  <TD style={portalTdStyle}>{fmtMoney(row.pending)}</TD>
                  <TD style={portalTdStyle}>{`${Array.isArray(row.paymentHistory) ? row.paymentHistory.length : 0} · ${fmtMoney(row.paid || 0)}`}</TD>
                  <TD style={portalTdStyle}><Badge label={resolveReceivableState(row).label} color={resolveReceivableState(row).color} sm /></TD>
                  <TD style={portalTdStyle}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {row.pdfUrl ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "preview_document", url: row.pdfUrl, fileName: row.pdfName, entityType: "invoice", entityId: row.id, summary: `Vista de documento ${row.correlativo || row.id}` })}>Ver</GBtn> : null}
                      {row.pdfUrl ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "download_document", url: row.pdfUrl, fileName: row.pdfName, entityType: "invoice", entityId: row.id, summary: `Descarga de documento ${row.correlativo || row.id}`, mode: "download" })}>Descargar</GBtn> : null}
                      {paymentLink ? <Btn s={portalPrimaryBtnStyle} onClick={() => onPortalAction?.({ type: "open_payment_link", url: paymentLink, entityType: "invoice", entityId: row.id, summary: `Intento de pago para ${row.correlativo || row.id}`, notify: true, email: true })}>Pagar ahora</Btn> : <GBtn s={portalSecondaryBtnStyle}>Sin link de pago</GBtn>}
                    </div>
                  </TD>
                </tr>
              );
            })}</tbody>
          </table></div> : <Empty text="Sin documentos para este filtro" sub="Ajusta la búsqueda o vuelve a revisar más tarde." />}
        </Card>
      ) : null}
      {tab === "ordenes" ? (
        <Card title="Órdenes de compra recibidas" sub="Aquí puedes revisar las OC recibidas y su avance dentro de Produ.">
          <SectionActionBar onCsv={exportPurchaseOrdersCsv} onPdf={exportPurchaseOrdersPdf} />
          {purchaseOrders.length ? <div style={portalTableWrapStyle}><table style={portalTableStyle}>
            <thead><tr><TH style={portalThStyle}>Número</TH><TH style={portalThStyle}>Emisión</TH><TH style={portalThStyle}>Monto</TH><TH style={portalThStyle}>Facturación</TH><TH style={portalThStyle}>Saldo OC</TH><TH style={portalThStyle}>Acciones</TH></tr></thead>
            <tbody>{purchaseOrders.map(row => <tr key={row.id}><TD style={portalTdStyle}>{row.number || "—"}</TD><TD style={portalTdStyle}>{fmtDate(row.issueDate)}</TD><TD style={portalTdStyle}>{fmtMoney(row.amount)}</TD><TD style={portalTdStyle}><Badge label={row.billingStatus || "Pendiente"} color={row.pendingAmount <= 0 ? "green" : "cyan"} sm /></TD><TD style={portalTdStyle}>{fmtMoney(row.pendingAmount)}</TD><TD style={portalTdStyle}><div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{row.pdfUrl ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "preview_purchase_order", url: row.pdfUrl, fileName: row.pdfName || `${row.number || "orden_compra"}.pdf`, entityType: "purchase_order", entityId: row.id, summary: `Vista de OC ${row.number || row.id}` })}>Ver</GBtn> : null}{row.pdfUrl ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "download_purchase_order", url: row.pdfUrl, fileName: row.pdfName || `${row.number || "orden_compra"}.pdf`, entityType: "purchase_order", entityId: row.id, summary: `Descarga de OC ${row.number || row.id}`, mode: "download" })}>Descargar</GBtn> : null}</div></TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin órdenes de compra registradas" sub="Cuando se carguen OC para este cliente, aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "presupuestos" ? (
        <Card title="Presupuestos" sub="Propuestas y presupuestos relacionados a esta cuenta.">
          <SectionActionBar onCsv={exportBudgetsCsv} onPdf={exportBudgetsPdf} />
          {budgets.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Título</TH><TH>Estado</TH><TH>Total</TH><TH>Forma de pago</TH><TH>Observación</TH><TH>Acciones</TH></tr></thead>
            <tbody>{budgets.map(row => {
              const state = resolveBudgetPortalState(row);
              const decisionLocked = budgetDecisionLocked(row);
              return (
                <tr key={row.id}>
                  <TD>{row.titulo || "Presupuesto"}</TD>
                  <TD><Badge label={state.label} color={state.color} sm /></TD>
                  <TD>{fmtMoney(row.total || 0)}</TD>
                  <TD>{safeText(row.paymentMethod || row.formaPago)}</TD>
                  <TD>{safeText(row.observacion || row.portalClientComment || row.clientPortalDecision?.note || "", "Sin observación")}</TD>
                  <TD>
                    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                      <GBtn s={portalSecondaryBtnStyle} onClick={() => void previewBudgetRow(row)}>Ver</GBtn>
                      <GBtn s={portalSecondaryBtnStyle} onClick={() => void downloadBudgetRow(row)}>Descargar</GBtn>
                      {!decisionLocked ? <Btn s={portalPrimaryBtnStyle} onClick={() => { setBudgetDecision({ id: row.id, status: "approved", title: row.titulo || "Presupuesto" }); setBudgetDecisionNote(row.clientPortalDecision?.note || ""); }}>Aprobar</Btn> : null}
                      {!decisionLocked ? <GBtn s={portalSecondaryBtnStyle} onClick={() => { setBudgetDecision({ id: row.id, status: "observed", title: row.titulo || "Presupuesto" }); setBudgetDecisionNote(row.clientPortalDecision?.note || ""); }}>Observar</GBtn> : null}
                    </div>
                  </TD>
                </tr>
              );
            })}</tbody>
          </table></div> : <Empty text="Sin presupuestos visibles" sub="Cuando existan presupuestos asociados a este cliente, aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "pagos" ? (
        <Card title="Pagos registrados" sub="Aquí puedes revisar los pagos ya asociados a tus documentos.">
          <SectionActionBar onCsv={exportPaymentsCsv} onPdf={exportPaymentsPdf} />
          {receiptLog.length ? <div style={portalTableWrapStyle}><table style={portalTableStyle}>
            <thead><tr><TH style={portalThStyle}>Fecha</TH><TH style={portalThStyle}>Documento</TH><TH style={portalThStyle}>Estado documento</TH><TH style={portalThStyle}>Saldo documento</TH><TH style={portalThStyle}>Método</TH><TH style={portalThStyle}>Referencia</TH><TH style={portalThStyle}>Monto</TH><TH style={portalThStyle}>Acciones</TH></tr></thead>
            <tbody>{receiptLog.map(row => <tr key={row.id}><TD style={portalTdStyle}>{fmtDate(row.date)}</TD><TD style={portalTdStyle}>{row.targetLabel || "—"}</TD><TD style={portalTdStyle}><Badge label={safeText(row.targetStatus, "Documento")} color={String(row.targetStatus || "").toLowerCase().includes("pag") ? "green" : String(row.targetStatus || "").toLowerCase().includes("venc") ? "orange" : "cyan"} sm /></TD><TD style={portalTdStyle}>{fmtMoney(row.targetPending || 0)}</TD><TD style={portalTdStyle}>{safeText(row.method)}</TD><TD style={portalTdStyle}>{safeText(row.reference)}</TD><TD style={portalTdStyle}>{fmtMoney(row.amount)}</TD><TD style={portalTdStyle}><div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "preview_receipt_target", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row), entityType: "invoice", entityId: row.targetId, summary: `Vista de documento ${row.targetLabel || row.targetId}` })}>Ver doc.</GBtn> : null}{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "download_receipt_target", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row), entityType: "invoice", entityId: row.targetId, summary: `Descarga de documento ${row.targetLabel || row.targetId}`, mode: "download" })}>Descargar</GBtn> : null}</div></TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin pagos registrados" sub="Los pagos conciliados aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "datos" ? (
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap: 16 }}>
          <Card title="Datos de la cuenta" sub="Información general asociada a este cliente dentro de Produ.">
            <SectionActionBar onCsv={exportAccountCsv} onPdf={exportAccountPdf} />
            <div style={{ display: "grid", gap: 12, fontSize: 14, color: "#53657e" }}>
              <div><b style={{ color: "#0f172a" }}>Cliente:</b> {safeText(payload.client?.nom)}</div>
              <div><b style={{ color: "#0f172a" }}>RUT:</b> {formatIdentity(payload.client?.rut)}</div>
              <div><b style={{ color: "#0f172a" }}>Límite de crédito:</b> {payload.client?.creditLimit ? fmtMoney(payload.client.creditLimit) : "No definido"}</div>
              <div><b style={{ color: "#0f172a" }}>Cupo disponible:</b> {portfolio?.availableCredit == null ? "—" : fmtMoney(portfolio.availableCredit)}</div>
              <div><b style={{ color: "#0f172a" }}>Presupuestos pendientes:</b> {pendingBudgets.length}</div>
            </div>
          </Card>
          <Card title="Contactos visibles" sub="Correos o responsables asociados a esta cuenta.">
            {clientContacts.length ? (
              <div style={{ display: "grid", gap: 12 }}>
                {clientContacts.map(contact => (
                  <div key={contact.id || contact.ema || contact.nom} style={{ border: "1px solid #dbe6f3", borderRadius: 16, padding: "14px 16px", background: "#fbfdff" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{safeText(contact.nom || contact.nombre)}</div>
                    <div style={{ fontSize: 13, color: "#607189", marginTop: 4 }}>{safeText(contact.car || contact.cargo, "Sin cargo")}</div>
                    <div style={{ fontSize: 13, color: "#607189", marginTop: 8 }}>{safeText(contact.ema || contact.email, "Sin correo")}</div>
                  </div>
                ))}
              </div>
            ) : <Empty text="Sin contactos visibles" sub="Todavía no hay contactos cargados para esta cuenta." />}
          </Card>
        </div>
      ) : null}
      <Modal
        open={!!budgetDecision}
        onClose={() => { if (budgetDecisionSaving) return; setBudgetDecision(null); setBudgetDecisionNote(""); }}
        title={budgetDecision?.status === "approved" ? "Aprobar presupuesto" : "Observar presupuesto"}
        sub={budgetDecision?.status === "approved" ? "Confirma esta propuesta comercial y, si quieres, deja una nota breve para el equipo." : "Explica qué necesitas ajustar antes de seguir con este presupuesto."}
      >
        <div style={{ display:"grid", gap:14 }}>
          <div style={{ padding:16, borderRadius:16, border:"1px solid #dbe6f3", background:"#f8fbff", color:"#53657e", lineHeight:1.6 }}>
            {budgetDecision?.status === "approved"
              ? "La aprobación quedará registrada de inmediato en Produ para que el equipo continúe con el siguiente paso comercial."
              : "La observación quedará registrada dentro de Produ para que el equipo revise el presupuesto y vuelva contigo con una nueva versión."}
          </div>
          <div>
            <div style={{ fontSize:12, letterSpacing:1.1, textTransform:"uppercase", fontWeight:800, color:"#6b7c93", marginBottom:8 }}>Comentario</div>
            <textarea
              value={budgetDecisionNote}
              onChange={event => setBudgetDecisionNote(event.target.value)}
              placeholder={budgetDecision?.status === "approved" ? "Ej: Podemos avanzar con esta propuesta." : "Ej: Ajustar plazo, forma de pago o alcance."}
              style={{ width:"100%", minHeight:140, borderRadius:16, border:"1px solid #d7e4f5", background:"#ffffff", padding:"14px 16px", fontSize:14, color:"#0f172a", resize:"vertical" }}
            />
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:10, flexWrap:"wrap" }}>
            <GBtn onClick={() => { if (budgetDecisionSaving) return; setBudgetDecision(null); setBudgetDecisionNote(""); }}>Cancelar</GBtn>
            <Btn onClick={() => { void submitBudgetDecision(); }} disabled={budgetDecisionSaving}>{budgetDecisionSaving ? "Guardando..." : budgetDecision?.status === "approved" ? "Aprobar presupuesto" : "Guardar observación"}</Btn>
          </div>
        </div>
      </Modal>
    </>
  );
}

function ProviderFinanceBody({ payload, onPortalAction, onPortalSignal }) {
  const { isMobile, isTablet } = useViewportFlags();
  const payables = useMemo(
    () => buildTreasuryPayables({
      payables: payload.payables,
      disbursements: payload.disbursements,
      empId: payload.empresa?.id,
    }).filter(row => matchesProviderAccount(row, payload.provider)),
    [payload],
  );
  const issuedOrders = useMemo(
    () => buildTreasuryIssuedOrders({
      orders: payload.issuedOrders,
      empId: payload.empresa?.id,
    }).filter(row => matchesProviderAccount(row, payload.provider)),
    [payload],
  );
  const disbursementLog = useMemo(
    () => buildTreasuryDisbursementLog({
      disbursements: payload.disbursements,
      payables: payload.payables,
      empId: payload.empresa?.id,
    }).filter(row => matchesProviderAccount(row, payload.provider)),
    [payload],
  );
  const payablesSummary = useMemo(() => summarizeStoredPayables(payables), [payables]);
  const issuedOrderSummary = useMemo(() => summarizeIssuedOrders(issuedOrders), [issuedOrders]);
  const creditLimit = Number(payload.provider?.creditLimit || 0);
  const availableCredit = creditLimit ? creditLimit - Number(payablesSummary.pending || 0) : null;
  const bankAccounts = Array.isArray(payload.provider?.bankAccounts) ? payload.provider.bankAccounts : [];
  const contacts = Array.isArray(payload.provider?.contactos) ? payload.provider.contactos : [];
  const [docSearch, setDocSearch] = useState("");
  const [docStatus, setDocStatus] = useState("all");
  const [tab, setTab] = useState("resumen");

  const visiblePayables = useMemo(() => {
    return payables.filter(row => {
      const matchesSearch = !docSearch.trim() || [
        row.folio,
        row.docType,
        row.status,
      ].some(value => String(value || "").toLowerCase().includes(docSearch.trim().toLowerCase()));
      const matchesStatus = docStatus === "all"
        || (docStatus === "paid" && Number(row.pending || 0) <= 0)
        || (docStatus === "overdue" && row.status === "Vencida")
        || (docStatus === "pending" && Number(row.pending || 0) > 0 && row.status !== "Vencida");
      return matchesSearch && matchesStatus;
    });
  }, [payables, docSearch, docStatus]);

  const exportPayablesCsv = async () => {
    downloadCsvFile(
      ["Numero", "Tipo", "Emision", "Vencimiento", "Monto", "Saldo", "Estado", "Pagos asociados"],
      visiblePayables.map(row => [
      row.folio || "—",
      row.docType || "Documento",
      row.issueDate || "",
      row.dueDate || "",
      Number(row.total || 0),
      Number(row.pending || 0),
      row.status || "Pendiente",
      `${Array.isArray(row.paymentHistory) ? row.paymentHistory.length : 0} pago(s) / ${fmtMoney(row.paid || 0)}`,
      ]),
      `portal_proveedor_documentos_${payload.provider?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_payables_csv", entityType: "provider_finance_portal", entityId: payload.provider?.id, summary: `Exportó CSV de documentos (${visiblePayables.length})` });
  };
  const exportPayablesPdf = async () => {
    await downloadSectionPdf({
      title: `Documentos · ${payload.provider?.name || "Proveedor"}`,
      subtitle: "Documentos por pagar visibles en el portal financiero.",
      fileName: `portal_proveedor_documentos_${payload.provider?.id || "cuenta"}.pdf`,
      rows: visiblePayables.map(row => ({
        title: `${row.folio || "Documento"} · ${row.docType || "Documento"}`,
        lines: [
          `Emisión: ${fmtDate(row.issueDate)} · Vencimiento: ${fmtDate(row.dueDate)}`,
          `Monto: ${fmtMoney(row.total)} · Saldo: ${fmtMoney(row.pending)} · Estado: ${row.status || "Pendiente"}`,
          `Pagos asociados: ${(row.paymentHistory || []).length} · Pagado: ${fmtMoney(row.paid || 0)}`,
        ],
      })),
    });
    await onPortalSignal?.({ eventName: "export_payables_pdf", entityType: "provider_finance_portal", entityId: payload.provider?.id, summary: `Exportó PDF de documentos (${visiblePayables.length})` });
  };
  const exportIssuedOrdersCsv = async () => {
    downloadCsvFile(
      ["Numero", "Emision", "Monto", "Items", "Aprobacion"],
      issuedOrders.map(row => [row.number || "—", row.issueDate || "", Number(row.amount || 0), Array.isArray(row.items) ? row.items.length : 0, row.approvalStatus || "Pendiente"]),
      `portal_proveedor_oc_${payload.provider?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_issued_orders_csv", entityType: "provider_finance_portal", entityId: payload.provider?.id, summary: `Exportó CSV de OC (${issuedOrders.length})` });
  };
  const exportIssuedOrdersPdf = async () => {
    await downloadSectionPdf({
      title: `OC emitidas · ${payload.provider?.name || "Proveedor"}`,
      subtitle: "Órdenes emitidas visibles en el portal financiero.",
      fileName: `portal_proveedor_oc_${payload.provider?.id || "cuenta"}.pdf`,
      rows: issuedOrders.map(row => ({
        title: row.number || "OC",
        lines: [
          `Emisión: ${fmtDate(row.issueDate)} · Monto: ${fmtMoney(row.amount)}`,
          `Ítems: ${Array.isArray(row.items) ? row.items.length : 0} · Aprobación: ${safeText(row.approvalStatus, "Pendiente")}`,
        ],
      })),
    });
    await onPortalSignal?.({ eventName: "export_issued_orders_pdf", entityType: "provider_finance_portal", entityId: payload.provider?.id, summary: `Exportó PDF de OC (${issuedOrders.length})` });
  };
  const exportDisbursementsCsv = async () => {
    downloadCsvFile(
      ["Fecha", "Documento", "Metodo", "Referencia", "Monto"],
      disbursementLog.map(row => [row.date || "", row.targetLabel || "—", row.method || "", row.reference || "", Number(row.amount || 0)]),
      `portal_proveedor_pagos_${payload.provider?.id || "cuenta"}.csv`,
    );
    await onPortalSignal?.({ eventName: "export_disbursements_csv", entityType: "provider_finance_portal", entityId: payload.provider?.id, summary: `Exportó CSV de pagos (${disbursementLog.length})` });
  };
  const exportDisbursementsPdf = async () => {
    await downloadSectionPdf({
      title: `Pagos · ${payload.provider?.name || "Proveedor"}`,
      subtitle: "Pagos registrados visibles en el portal financiero.",
      fileName: `portal_proveedor_pagos_${payload.provider?.id || "cuenta"}.pdf`,
      rows: disbursementLog.map(row => ({
        title: row.targetLabel || "Pago",
        lines: [
          `Fecha: ${fmtDate(row.date)} · Método: ${safeText(row.method)}`,
          `Referencia: ${safeText(row.reference)} · Monto: ${fmtMoney(row.amount || 0)}`,
        ],
      })),
    });
    await onPortalSignal?.({ eventName: "export_disbursements_pdf", entityType: "provider_finance_portal", entityId: payload.provider?.id, summary: `Exportó PDF de pagos (${disbursementLog.length})` });
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(2,minmax(0,1fr))" : "repeat(4,minmax(0,1fr))", gap: 12 }}>
        <PortalMetricCard eyebrow="Total por pagar" value={fmtMoney(payablesSummary.pending)} tone="blue" />
        <PortalMetricCard eyebrow="A tiempo" value={fmtMoney(Math.max(0, Number(payablesSummary.pending || 0) - Number(payablesSummary.overdue || 0)))} tone="green" />
        <PortalMetricCard eyebrow="Vencido" value={fmtMoney(payablesSummary.overdue)} tone="red" />
        <PortalMetricCard eyebrow="Línea disponible" value={availableCredit == null ? "—" : fmtMoney(availableCredit)} tone="purple" />
      </div>
      <SectionTabs type="provider" tab={tab} setTab={setTab} />
      {tab === "resumen" ? (
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1.2fr .8fr", gap: 16 }}>
          <Card title="Resumen financiero" sub="Una vista simple del estado documental y de pagos de este proveedor.">
            <div style={{ display: "grid", gap: 9, fontSize: 13, color: "#53657e" }}>
              <div><b style={{ color: "#0f172a" }}>Documentos abiertos:</b> {payablesSummary.docs}</div>
              <div><b style={{ color: "#0f172a" }}>Monto por pagar:</b> {fmtMoney(payablesSummary.pending)}</div>
              <div><b style={{ color: "#0f172a" }}>Órdenes de compra emitidas:</b> {issuedOrderSummary.docs}</div>
              <div><b style={{ color: "#0f172a" }}>Límite de crédito:</b> {creditLimit ? fmtMoney(creditLimit) : "No definido"}</div>
            </div>
          </Card>
          <Card title="Lo más importante hoy" sub="Señales rápidas para saber qué revisar primero.">
            <div style={{ display: "grid", gap: 9, fontSize: 13, color: "#53657e" }}>
              <div>• {payables.filter(item => item.status === "Vencida").length} documento(s) están vencidos.</div>
              <div>• {disbursementLog.length} pago(s) ya fueron registrados.</div>
              <div>• {issuedOrders.length} orden(es) de compra emitidas están visibles en este portal.</div>
            </div>
          </Card>
        </div>
      ) : null}
      {tab === "documentos" ? (
        <Card title="Documentos por pagar" sub="Revisa folios, vencimientos y saldo de cada documento asociado a este proveedor.">
          <SectionActionBar onCsv={exportPayablesCsv} onPdf={exportPayablesPdf} />
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            <input value={docSearch} onChange={event => setDocSearch(event.target.value)} placeholder="Buscar por folio, tipo o estado" style={{ ...portalFieldStyle, minWidth: 220, flex: "1 1 260px", background: "#f9fbff" }} />
            <select value={docStatus} onChange={event => setDocStatus(event.target.value)} style={portalFieldStyle}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidos</option>
              <option value="paid">Pagados</option>
            </select>
          </div>
          {visiblePayables.length ? <div style={portalTableWrapStyle}><table style={portalTableStyle}>
            <thead><tr><TH style={portalThStyle}>Número</TH><TH style={portalThStyle}>Tipo</TH><TH style={portalThStyle}>Emisión</TH><TH style={portalThStyle}>Vencimiento</TH><TH style={portalThStyle}>Monto</TH><TH style={portalThStyle}>Saldo</TH><TH style={portalThStyle}>Pagos</TH><TH style={portalThStyle}>Estado</TH><TH style={portalThStyle}>Acciones</TH></tr></thead>
            <tbody>{visiblePayables.map(row => { const state = resolvePayableState(row); return <tr key={row.id}><TD style={portalTdStyle}>{row.folio || "—"}</TD><TD style={portalTdStyle}>{row.docType || "Documento"}</TD><TD style={portalTdStyle}>{fmtDate(row.issueDate)}</TD><TD style={portalTdStyle}>{fmtDate(row.dueDate)}</TD><TD style={portalTdStyle}>{fmtMoney(row.total)}</TD><TD style={portalTdStyle}>{fmtMoney(row.pending)}</TD><TD style={portalTdStyle}>{`${Array.isArray(row.paymentHistory) ? row.paymentHistory.length : 0} · ${fmtMoney(row.paid || 0)}`}</TD><TD style={portalTdStyle}><Badge label={state.label} color={state.color} sm /></TD><TD style={portalTdStyle}><div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "preview_payable", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row, `${row.folio || "documento"}.pdf`), entityType: "payable", entityId: row.id, summary: `Vista de documento ${row.folio || row.id}` })}>Ver</GBtn> : null}{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "download_payable", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row, `${row.folio || "documento"}.pdf`), entityType: "payable", entityId: row.id, summary: `Descarga de documento ${row.folio || row.id}`, mode: "download" })}>Descargar</GBtn> : null}</div></TD></tr>; })}</tbody>
          </table></div> : <Empty text="Sin documentos para este filtro" sub="Ajusta la búsqueda o vuelve a revisar más tarde." />}
        </Card>
      ) : null}
      {tab === "ordenes" ? (
        <Card title="Órdenes de compra emitidas" sub="Órdenes emitidas desde Produ para este proveedor.">
          <SectionActionBar onCsv={exportIssuedOrdersCsv} onPdf={exportIssuedOrdersPdf} />
          {issuedOrders.length ? <div style={portalTableWrapStyle}><table style={portalTableStyle}>
            <thead><tr><TH style={portalThStyle}>Número</TH><TH style={portalThStyle}>Emisión</TH><TH style={portalThStyle}>Monto</TH><TH style={portalThStyle}>Ítems</TH><TH style={portalThStyle}>Aprobación</TH><TH style={portalThStyle}>Acciones</TH></tr></thead>
            <tbody>{issuedOrders.map(row => <tr key={row.id}><TD style={portalTdStyle}>{row.number || "—"}</TD><TD style={portalTdStyle}>{fmtDate(row.issueDate)}</TD><TD style={portalTdStyle}>{fmtMoney(row.amount)}</TD><TD style={portalTdStyle}>{Array.isArray(row.items) ? row.items.length : 0}</TD><TD style={portalTdStyle}><Badge label={safeText(row.approvalStatus, "Pendiente")} color={/aprob/i.test(String(row.approvalStatus || "")) ? "green" : "cyan"} sm /></TD><TD style={portalTdStyle}><div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "preview_issued_order", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row, `${row.number || "orden_compra"}.pdf`), entityType: "issued_order", entityId: row.id, summary: `Vista de OC emitida ${row.number || row.id}` })}>Ver</GBtn> : null}{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "download_issued_order", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row, `${row.number || "orden_compra"}.pdf`), entityType: "issued_order", entityId: row.id, summary: `Descarga de OC emitida ${row.number || row.id}`, mode: "download" })}>Descargar</GBtn> : null}</div></TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin órdenes emitidas" sub="Las órdenes emitidas desde Produ aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "pagos" ? (
        <Card title="Pagos registrados" sub="Pagos ya aplicados sobre documentos de este proveedor.">
          <SectionActionBar onCsv={exportDisbursementsCsv} onPdf={exportDisbursementsPdf} />
          {disbursementLog.length ? <div style={portalTableWrapStyle}><table style={portalTableStyle}>
            <thead><tr><TH style={portalThStyle}>Fecha</TH><TH style={portalThStyle}>Documento</TH><TH style={portalThStyle}>Estado documento</TH><TH style={portalThStyle}>Saldo documento</TH><TH style={portalThStyle}>Método</TH><TH style={portalThStyle}>Referencia</TH><TH style={portalThStyle}>Monto</TH><TH style={portalThStyle}>Acciones</TH></tr></thead>
            <tbody>{disbursementLog.map(row => <tr key={row.id}><TD style={portalTdStyle}>{fmtDate(row.date)}</TD><TD style={portalTdStyle}>{row.targetLabel || "—"}</TD><TD style={portalTdStyle}><Badge label={safeText(row.targetStatus, "Documento")} color={String(row.targetStatus || "").toLowerCase().includes("pag") ? "green" : String(row.targetStatus || "").toLowerCase().includes("venc") ? "orange" : "cyan"} sm /></TD><TD style={portalTdStyle}>{fmtMoney(row.targetPending || 0)}</TD><TD style={portalTdStyle}>{safeText(row.method)}</TD><TD style={portalTdStyle}>{safeText(row.reference)}</TD><TD style={portalTdStyle}>{fmtMoney(row.amount)}</TD><TD style={portalTdStyle}><div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "preview_disbursement_target", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row), entityType: "payable", entityId: row.targetId, summary: `Vista de documento ${row.targetLabel || row.targetId}` })}>Ver doc.</GBtn> : null}{resolvePortalDocumentUrl(row) ? <GBtn s={portalSecondaryBtnStyle} onClick={() => onPortalAction?.({ type: "download_disbursement_target", url: resolvePortalDocumentUrl(row), fileName: resolvePortalDocumentName(row), entityType: "payable", entityId: row.targetId, summary: `Descarga de documento ${row.targetLabel || row.targetId}`, mode: "download" })}>Descargar</GBtn> : null}</div></TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin pagos registrados" sub="Los pagos realizados se verán aquí." />}
        </Card>
      ) : null}
      {tab === "datos" ? (
        <div style={{ display: "grid", gridTemplateColumns: isTablet ? "1fr" : "1fr 1fr", gap: 16 }}>
          <Card title="Datos de la cuenta" sub="Información general asociada a este proveedor dentro de Produ.">
            <div style={{ display: "grid", gap: 12, fontSize: 14, color: "#53657e" }}>
              <div><b style={{ color: "#0f172a" }}>Proveedor:</b> {safeText(payload.provider?.name || payload.provider?.razonSocial)}</div>
              <div><b style={{ color: "#0f172a" }}>RUT:</b> {formatIdentity(payload.provider?.rut)}</div>
              <div><b style={{ color: "#0f172a" }}>Línea de crédito:</b> {creditLimit ? fmtMoney(creditLimit) : "No definida"}</div>
              <div><b style={{ color: "#0f172a" }}>Cupo disponible:</b> {availableCredit == null ? "—" : fmtMoney(availableCredit)}</div>
              <div><b style={{ color: "#0f172a" }}>Órdenes emitidas visibles:</b> {issuedOrderSummary.docs}</div>
            </div>
          </Card>
          <Card title="Información de pago" sub="Datos bancarios y contactos visibles para esta contraparte.">
            {bankAccounts.length ? (
              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                {bankAccounts.map(account => (
                  <div key={account.id || account.numeroCuenta} style={{ border: "1px solid #dbe6f3", borderRadius: 16, padding: "14px 16px", background: "#fbfdff" }}>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>{safeText(account.banco)}</div>
                    <div style={{ fontSize: 13, color: "#607189", marginTop: 6 }}>{safeText(account.tipoCuenta, "Cuenta bancaria")} · {safeText(account.numeroCuenta, "Sin número")}</div>
                    <div style={{ fontSize: 13, color: "#607189", marginTop: 6 }}>Titular: {safeText(account.titular)}</div>
                    <div style={{ fontSize: 13, color: "#607189", marginTop: 6 }}>Correo pago: {safeText(account.emailPago, "Sin correo")}</div>
                  </div>
                ))}
              </div>
            ) : <Empty text="Sin cuentas bancarias visibles" sub="Todavía no hay cuentas cargadas para este proveedor." />}
            {contacts.length ? (
              <div style={{ display: "grid", gap: 10 }}>
                {contacts.map(contact => (
                  <div key={contact.id || contact.email || contact.nombre} style={{ fontSize: 13, color: "#53657e" }}>
                    <b style={{ color: "#0f172a" }}>{safeText(contact.nombre)}</b> · {safeText(contact.email, "Sin correo")}
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        </div>
      ) : null}
    </>
  );
}

export function CounterpartyFinancePortalView({ empresas = [], descriptor = null, platformServices = null, platformApi = null }) {
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const sessionKey = useMemo(
    () => descriptor?.slug ? buildFinancePortalSessionKey(descriptor?.type, descriptor?.slug) : "",
    [descriptor?.slug, descriptor?.type],
  );
  const companyName = payload?.empresa?.nombre || payload?.empresa?.nom || "Produ";

  const resolveBudgetRecipients = (budgetId = "") => {
    const budget = (Array.isArray(payload?.presupuestos) ? payload.presupuestos : []).find(item => item.id === budgetId);
    return normalizeRecipientList([
      payload?.empresa?.ema,
      ...(budget ? pickRecordEmails(budget, [
        "ownerEmail",
        "responsableEmail",
        "commercialOwnerEmail",
        "accountManagerEmail",
        "createdByEmail",
        "updatedByEmail",
        "userEmail",
      ]) : []),
    ]);
  };

  const resolveInvoiceRecipients = (invoiceId = "") => {
    const invoice = (Array.isArray(payload?.facturas) ? payload.facturas : []).find(item => item.id === invoiceId);
    return normalizeRecipientList([
      payload?.empresa?.ema,
      ...(invoice ? pickRecordEmails(invoice, [
        "ownerEmail",
        "responsableEmail",
        "billingOwnerEmail",
        "collectorEmail",
        "createdByEmail",
        "updatedByEmail",
      ]) : []),
    ]);
  };

  const resolveClientOrderRecipients = (orderId = "") => {
    const order = (Array.isArray(payload?.purchaseOrders) ? payload.purchaseOrders : []).find(item => item.id === orderId);
    const linkedInvoices = (Array.isArray(order?.linkedInvoiceIds) ? order.linkedInvoiceIds : [])
      .map(invoiceId => (Array.isArray(payload?.facturas) ? payload.facturas : []).find(item => item.id === invoiceId))
      .filter(Boolean);
    return normalizeRecipientList([
      payload?.empresa?.ema,
      ...linkedInvoices.flatMap(invoice => pickRecordEmails(invoice, [
        "ownerEmail",
        "responsableEmail",
        "billingOwnerEmail",
        "collectorEmail",
        "createdByEmail",
      ])),
    ]);
  };

  const resolveProviderRecipients = (entityType = "", entityId = "") => {
    if (entityType === "issued_order") {
      const order = (Array.isArray(payload?.issuedOrders) ? payload.issuedOrders : []).find(item => item.id === entityId);
      return normalizeRecipientList([
        payload?.empresa?.ema,
        ...(order ? pickRecordEmails(order, ["requesterEmail", "approvedByEmail", "ownerEmail", "updatedByEmail"]) : []),
      ]);
    }
    return normalizeRecipientList([payload?.empresa?.ema]);
  };

  const resolveActionRecipients = ({ entityType = "", entityId = "" } = {}) => {
    if (payload?.type === "client") {
      if (entityType === "budget") return resolveBudgetRecipients(entityId);
      if (entityType === "invoice") return resolveInvoiceRecipients(entityId);
      if (entityType === "purchase_order") return resolveClientOrderRecipients(entityId);
      return normalizeRecipientList([payload?.empresa?.ema]);
    }
    return resolveProviderRecipients(entityType, entityId);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError("");
      const nextPayload = await resolveFinancePortalPayload(empresas, descriptor);
      if (!alive) return;
      if (nextPayload?.error) {
        setPayload(null);
        setError(nextPayload.error);
      } else {
        setPayload(nextPayload);
      }
      setLoading(false);
    };
    load();
    return () => {
      alive = false;
    };
  }, [empresas, descriptor]);

  useEffect(() => {
    if (!sessionKey) return;
    try {
      const raw = localStorage.getItem(sessionKey);
      if (raw === "granted") setUnlocked(true);
    } catch {}
  }, [sessionKey]);

  const unlockPortal = async () => {
    setUnlocked(true);
    if (sessionKey) {
      try {
        localStorage.setItem(sessionKey, "granted");
      } catch {}
    }
    if (!payload) return;
    const now = new Date().toISOString();
    const empId = payload.empresa?.id;
    if (payload.type === "client") {
      const clients = Array.isArray(payload.clientes) ? payload.clientes : [];
      const nextClients = clients.map(item => item.id === payload.client?.id ? {
        ...item,
        financialPortal: {
          ...normalizeClientFinancePortal(item.financialPortal, item),
          lastAccessAt: now,
          updatedAt: now,
        },
      } : item);
      await dbSet(`produ:${empId}:clientes`, nextClients);
      setPayload(current => current ? { ...current, clientes: nextClients, client: nextClients.find(item => item.id === current.client?.id), portal: { ...current.portal, lastAccessAt: now, updatedAt: now } } : current);
      return;
    }
    const providers = Array.isArray(payload.treasuryProviders) ? payload.treasuryProviders : [];
    const nextProviders = providers.map(item => item.id === payload.provider?.id ? {
      ...item,
      financialPortal: {
        ...normalizeProviderFinancePortal(item.financialPortal, item),
        lastAccessAt: now,
        updatedAt: now,
      },
    } : item);
    await dbSet(`produ:${empId}:treasuryProviders`, nextProviders);
    setPayload(current => current ? { ...current, treasuryProviders: nextProviders, provider: nextProviders.find(item => item.id === current.provider?.id), portal: { ...current.portal, lastAccessAt: now, updatedAt: now } } : current);
  };

  const logPortalAction = async ({
    eventName = "",
    entityType = "",
    entityId = "",
    signalPayload = {},
    notify = false,
    notifySeverity = "info",
    notifyHeadline = "",
    email = false,
    recipients = [],
  } = {}) => {
    if (!payload?.empresa?.id || !eventName) return;
    const actor = buildPortalActor(payload);
    await appendWorkflowEventEntry({
      empId: payload.empresa.id,
      stream: "finance_portal",
      eventName,
      entityType,
      entityId,
      actor,
      payload: {
        counterpartyType: payload.type,
        counterpartyId: payload.type === "provider" ? payload.provider?.id || "" : payload.client?.id || "",
        counterpartyName: payload.type === "provider" ? payload.provider?.name || "" : payload.client?.nom || "",
        portalSlug: payload.portal?.slug || "",
        ...((signalPayload && typeof signalPayload === "object") ? signalPayload : {}),
      },
      platformServices,
    });
    await appendOperationalAuditEntry({
      empId: payload.empresa.id,
      area: "portal_financiero",
      action: eventName,
      entityType,
      entityId,
      actor,
      payload: signalPayload,
      platformServices,
    });
    if (notify) {
      await appendFinancePortalAlert(payload, {
        title: notifyHeadline || `Portal financiero · ${payload.type === "provider" ? payload.provider?.name : payload.client?.nom}`,
        body: `${notifyHeadline || eventName}${signalPayload?.summary ? `\n\n${signalPayload.summary}` : ""}`,
        severity: notifySeverity,
        action: eventName,
      });
    }
    const emailRecipients = normalizeRecipientList(Array.isArray(recipients) ? recipients : []);
    if (email && platformApi?.notifications?.sendTransactionalEmail && emailRecipients.length) {
      try {
        await platformApi.notifications.sendTransactionalEmail({
          tenantId: payload.empresa.id,
          to: emailRecipients,
          templateKey: "client_portal_signal",
          variables: {
            companyName,
            clientName: payload.type === "provider" ? payload.provider?.name || "Proveedor" : payload.client?.nom || "Cliente",
            actionLabel: notifyHeadline || eventName,
            detail: `${signalPayload?.summary || ""}\n\nHecho con Produ`.trim(),
          },
          text: [
            `${companyName}`,
            notifyHeadline || eventName,
            signalPayload?.summary || "",
            "",
            "Hecho con Produ",
          ].join("\n").trim(),
          html: `<div style="font-family:Inter,Arial,sans-serif"><p><strong>${companyName}</strong></p><p>${notifyHeadline || eventName}</p><p>${String(signalPayload?.summary || "").replace(/\n/g, "<br />")}</p><p style="color:#64748b;font-size:12px;margin-top:24px">Hecho con Produ</p></div>`,
        });
      } catch (error) {
        console.error("[finance-portal] No pudimos enviar correo interno", error);
      }
    }
  };

  const handleExternalAction = async ({
    url = "",
    fileName = "",
    eventName = "",
    entityType = "",
    entityId = "",
    summary = "",
    mode = "open",
    notify = false,
    email = false,
  } = {}) => {
    const link = String(url || "").trim();
    if (!link) return;
    if (mode === "download") {
      downloadUrl(link, fileName || "documento");
    } else {
      openExternalLink(link);
    }
    await logPortalAction({
      eventName,
      entityType,
      entityId,
      signalPayload: { fileName, urlType: link.startsWith("data:") ? "embedded" : "external", summary },
      notify,
      email,
      recipients: resolveActionRecipients({ entityType, entityId }),
      notifyHeadline: summary,
      notifySeverity: eventName.includes("payment") ? "urgente" : "info",
    });
  };

  const handlePortalSignal = async ({
    eventName = "",
    entityType = "",
    entityId = "",
    summary = "",
    notify = false,
    email = false,
  } = {}) => {
    await logPortalAction({
      eventName,
      entityType,
      entityId,
      signalPayload: { summary },
      notify,
      email,
      recipients: resolveActionRecipients({ entityType, entityId }),
      notifyHeadline: summary,
    });
  };

  const handleBudgetDecision = async ({ budgetId = "", status = "", note = "" } = {}) => {
    if (!payload?.empresa?.id || !budgetId || payload?.type !== "client") return false;
    const now = new Date().toISOString();
    const nextBudgets = (Array.isArray(payload.presupuestos) ? payload.presupuestos : []).map(item => item.id === budgetId ? {
      ...item,
      estado: status === "approved" ? "Aceptado" : "Observado",
      clientPortalDecision: {
        status,
        note: String(note || "").trim(),
        decidedAt: now,
        source: "finance_portal",
      },
      portalClientComment: String(note || "").trim() || item.portalClientComment || "",
    } : item);
    await dbSet(`produ:${payload.empresa.id}:presupuestos`, nextBudgets);
    setPayload(current => current ? { ...current, presupuestos: nextBudgets } : current);
    const summary = status === "approved"
      ? `${payload.client?.nom || "Cliente"} aprobó un presupuesto desde el portal financiero.`
      : `${payload.client?.nom || "Cliente"} dejó observaciones sobre un presupuesto desde el portal financiero.`;
    await logPortalAction({
      eventName: status === "approved" ? "client_finance_budget_approved" : "client_finance_budget_observed",
      entityType: "budget",
      entityId: budgetId,
      signalPayload: {
        summary: note ? `${summary}\n\nComentario:\n${note}` : summary,
        decision: status,
      },
      notify: true,
      email: true,
      recipients: resolveBudgetRecipients(budgetId),
      notifyHeadline: status === "approved" ? "Presupuesto aprobado desde portal financiero" : "Presupuesto observado desde portal financiero",
      notifySeverity: "urgente",
    });
    return true;
  };

  if (loading) {
    return <PublicFinanceShell><Card title="Cargando portal financiero" sub="Estamos preparando la información más reciente desde Produ." /></PublicFinanceShell>;
  }

  if (error || !payload) {
    return <PublicFinanceShell><Card title="Portal no disponible" sub="No encontramos un acceso financiero válido con este enlace."><Empty text="Revisa el enlace o pide uno nuevo a tu equipo de Produ." /></Card></PublicFinanceShell>;
  }

  if (!unlocked) {
    return <PortalGate payload={payload} onUnlock={unlockPortal} />;
  }

  const title = payload.type === "provider" ? (payload.provider?.name || "Proveedor") : (payload.client?.nom || "Cliente");
  const identity = payload.type === "provider"
    ? formatIdentity(payload.provider?.rut)
    : formatIdentity(payload.client?.rut);
  const subtitle = payload.type === "provider"
    ? "Revisa documentos por pagar, pagos registrados, órdenes emitidas e información bancaria visible en tu relación con esta empresa."
    : "Revisa facturas, pagos, órdenes de compra recibidas, presupuestos y paga en línea cuando tu documento ya tenga un link activo.";

  return (
    <PublicFinanceShell>
      <div style={{ display: "grid", gap: 18 }}>
        <FinanceHero
          type={payload.type}
          companyName={payload.empresa?.nombre || payload.empresa?.nom || "Produ"}
          counterpartyName={title}
          identity={identity}
          subtitle={subtitle}
          onClosePortal={() => { try { localStorage.removeItem(sessionKey); } catch {} window.location.reload(); }}
        />
        {payload.type === "provider"
          ? <ProviderFinanceBody payload={payload} onPortalAction={handleExternalAction} onPortalSignal={handlePortalSignal} />
          : <ClientFinanceBody payload={payload} onPortalAction={handleExternalAction} onPortalSignal={handlePortalSignal} onBudgetDecision={handleBudgetDecision} />}
      </div>
    </PublicFinanceShell>
  );
}
