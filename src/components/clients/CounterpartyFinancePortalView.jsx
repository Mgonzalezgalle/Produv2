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
import { Badge, Btn, Card, Empty, GBtn, TH, TD } from "../../lib/ui/components";

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

function accessCodeSlots(code = "") {
  const clean = String(code || "").replace(/\D/g, "").slice(0, 6);
  return Array.from({ length: 6 }, (_, index) => clean[index] || "");
}

function PublicFinanceShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0f1f4a 0, #0f1f4a 112px, #eef4fc 112px, #f7faff 100%)", padding: "24px 20px 40px" }}>
      <div style={{ maxWidth: 1320, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function PortalMetricCard({ eyebrow = "", value = "—", tone = "blue" }) {
  const palette = {
    blue: { bg: "#eef5ff", border: "#d6e7ff", label: "#4b6590", value: "#2f6ea8" },
    red: { bg: "#fff3f0", border: "#ffd9cf", label: "#965b53", value: "#dd654c" },
    green: { bg: "#eefbf5", border: "#cdeedc", label: "#4e7b67", value: "#21a16b" },
    purple: { bg: "#f7f0ff", border: "#e8d5ff", label: "#735f93", value: "#8c5de8" },
  };
  const current = palette[tone] || palette.blue;
  return (
    <div style={{ background: current.bg, border: `1px solid ${current.border}`, borderRadius: 24, padding: "18px 18px 16px", minHeight: 116 }}>
      <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: current.label, fontWeight: 800, marginBottom: 12 }}>{eyebrow}</div>
      <div style={{ fontFamily: "var(--fh)", fontSize: 34, fontWeight: 900, lineHeight: 1, color: current.value }}>{value}</div>
    </div>
  );
}

function FinanceHero({ type = "client", companyName = "", counterpartyName = "", identity = "", subtitle = "", onClosePortal = null }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #d8e4f4", borderRadius: 32, overflow: "hidden", boxShadow: "0 24px 80px rgba(15,23,42,.10)" }}>
      <div style={{ background: "linear-gradient(135deg, #10204f 0%, #173a78 56%, #2f6ea8 100%)", color: "#ffffff", padding: "22px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 18, background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 }}>
              {getInitials(companyName)}
            </div>
            <div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 30, fontWeight: 900, lineHeight: 1.05 }}>{companyName || "Produ"}</div>
              <div style={{ fontSize: 14, opacity: 0.88 }}>{type === "provider" ? "Portal Proveedor" : "Portal Cliente"}</div>
            </div>
          </div>
          <GBtn onClick={onClosePortal}>Cerrar portal</GBtn>
        </div>
      </div>
      <div style={{ padding: "28px 28px 24px", display: "grid", gridTemplateColumns: "minmax(0,1.35fr) minmax(300px,.65fr)", gap: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ width: 76, height: 76, borderRadius: 999, background: "#0f1f4a", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900, flexShrink: 0 }}>
            {getInitials(counterpartyName)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 40, fontWeight: 900, lineHeight: 1.02, color: "#0f172a" }}>{counterpartyName || "Contraparte"}</div>
            <div style={{ marginTop: 10, fontSize: 16, color: "#61728b" }}>{identity} · Atiende {companyName || "Produ"}</div>
            <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.7, color: "#4c5f79", maxWidth: 720 }}>{subtitle}</div>
          </div>
        </div>
        <div style={{ background: "#f6f9fe", border: "1px solid #d9e5f6", borderRadius: 24, padding: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", color: "#6f7f98", fontWeight: 800, marginBottom: 10 }}>Qué puedes hacer aquí</div>
          <div style={{ display: "grid", gap: 12, fontSize: 14, color: "#465b78", lineHeight: 1.6 }}>
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
            {payload?.type === "provider" ? "Portal proveedores" : "Portal cuentas por cobrar"}
          </div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 30, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>{label || "Portal financiero"}</div>
          <div style={{ fontSize: 15, color: "#5b6b82", marginTop: 10 }}>
            Este espacio fue preparado por <b style={{ color: "#0f172a" }}>{company}</b> para revisar documentos, pagos, órdenes de compra y presupuestos relacionados.
          </div>
        </div>
        <div style={{ padding: 36, display: "grid", gap: 20 }}>
          <div style={{ background: "#f7faff", border: "1px solid #dbe7f5", borderRadius: 22, padding: 24 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Código de acceso</div>
            <div style={{ fontSize: 14, color: "#5b6b82", lineHeight: 1.6, marginBottom: 18 }}>
              Ingresa el código de 6 dígitos que te compartieron para entrar a este portal financiero.
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <button type="button" onClick={() => codeInputRef.current?.focus()} style={{ display: "flex", gap: 10, flexWrap: "wrap", background: "transparent", border: "none", padding: 0, cursor: "text" }}>
                {accessCodeSlots(code).map((digit, index) => (
                  <div key={index} style={{ width: 54, height: 66, borderRadius: 18, border: `1px solid ${digit ? "#7cb2ea" : "#dbe7f5"}`, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#2f6ea8", boxShadow: digit ? "0 0 0 3px rgba(47,110,168,.08)" : "none" }}>
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
                style={{ width: "100%", borderRadius: 14, border: "1px solid #cfe0fb", padding: "12px 14px", fontSize: 15, color: "#0f172a", background: "#ffffff" }}
              />
              {error ? <div style={{ color: "#c2410c", fontSize: 13 }}>{error}</div> : null}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Btn onClick={handleSubmit} disabled={!canSubmit}>Entrar al portal</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicFinanceShell>
  );
}

function SectionTabs({ type, tab, setTab }) {
  const tabs = type === "provider"
    ? [["resumen", "Resumen"], ["documentos", "Documentos"], ["ordenes", "OC emitidas"], ["pagos", "Pagos"], ["datos", "Información de pago"]]
    : [["resumen", "Resumen"], ["documentos", "Facturas"], ["ordenes", "OC recibidas"], ["presupuestos", "Presupuestos"], ["pagos", "Pagos"], ["datos", "Cuenta"]];
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ClientFinanceBody({ payload }) {
  const receivables = useMemo(
    () => buildTreasuryReceivables({
      facturas: payload.facturas,
      clientes: payload.clientes,
      auspiciadores: payload.auspiciadores,
      receipts: payload.receipts,
      empId: payload.empresa?.id,
    }).filter(row => row.entidadId === payload.client?.id),
    [payload],
  );
  const purchaseOrders = useMemo(
    () => buildTreasuryPurchaseOrders({
      orders: payload.purchaseOrders,
      facturas: payload.facturas,
      clientes: payload.clientes,
      receipts: payload.receipts,
      empId: payload.empresa?.id,
    }).filter(row => row.clientId === payload.client?.id),
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
    }).filter(row => row.counterpartyLabel === (payload.client?.nom || "")),
    [payload],
  );
  const budgets = useMemo(
    () => (Array.isArray(payload.presupuestos) ? payload.presupuestos : []).filter(item => item?.cliId === payload.client?.id),
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

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
        <PortalMetricCard eyebrow="Total por pagar" value={fmtMoney(receivableSummary.pending)} tone="blue" />
        <PortalMetricCard eyebrow="A tiempo" value={fmtMoney(onTimePending)} tone="green" />
        <PortalMetricCard eyebrow="Vencido" value={fmtMoney(overduePending)} tone="red" />
        <PortalMetricCard eyebrow="Línea disponible" value={portfolio?.availableCredit == null ? "—" : fmtMoney(portfolio.availableCredit)} tone="purple" />
      </div>
      <SectionTabs type="client" tab={tab} setTab={setTab} />
      {tab === "resumen" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 18 }}>
          <Card title="Resumen financiero" sub="Aquí puedes revisar el estado actual de tus documentos, pagos y compromisos abiertos.">
            <div style={{ display: "grid", gap: 10, fontSize: 14, color: "#53657e" }}>
              <div><b style={{ color: "#0f172a" }}>Total por pagar:</b> {fmtMoney(receivableSummary.pending)}</div>
              <div><b style={{ color: "#0f172a" }}>Documentos vencidos:</b> {receivableSummary.overdueDocs}</div>
              <div><b style={{ color: "#0f172a" }}>Órdenes de compra recibidas:</b> {purchaseOrderSummary.docs}</div>
              <div><b style={{ color: "#0f172a" }}>Presupuestos visibles:</b> {budgets.length}</div>
              <div><b style={{ color: "#0f172a" }}>Límite de crédito:</b> {portfolio?.creditLimit ? fmtMoney(portfolio.creditLimit) : "No definido"}</div>
            </div>
          </Card>
          <Card title="Lo más importante hoy" sub="Señales rápidas para saber qué revisar primero.">
            <div style={{ display: "grid", gap: 10, fontSize: 14, color: "#53657e" }}>
              <div>• {receivableSummary.overdueDocs} documento(s) están vencidos.</div>
              <div>• {purchaseOrders.filter(item => item.pendingAmount > 0).length} orden(es) de compra siguen parcialmente abiertas.</div>
              <div>• {pendingBudgets.length} presupuesto(s) siguen pendientes de cierre.</div>
            </div>
          </Card>
        </div>
      ) : null}
      {tab === "documentos" ? (
        <Card title="Facturas y documentos" sub="Revisa tus documentos, filtra por estado y paga en línea cuando el documento ya tenga un link activo en Produ.">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <input value={docSearch} onChange={event => setDocSearch(event.target.value)} placeholder="Buscar por número, tipo o estado" style={{ minWidth: 220, flex: "1 1 260px", borderRadius: 14, border: "1px solid #d7e4f5", background: "#f9fbff", padding: "12px 14px", fontSize: 14 }} />
            <select value={docStatus} onChange={event => setDocStatus(event.target.value)} style={{ minWidth: 180, borderRadius: 14, border: "1px solid #d7e4f5", background: "#ffffff", padding: "12px 14px", fontSize: 14 }}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidos</option>
              <option value="paid">Pagados</option>
            </select>
          </div>
          {visibleReceivables.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Número</TH><TH>Tipo de documento</TH><TH>Emisión</TH><TH>Vencimiento</TH><TH>Monto</TH><TH>Saldo</TH><TH>Estado</TH><TH>Acciones</TH></tr></thead>
            <tbody>{visibleReceivables.map(row => {
              const paymentLink = String(row?.mercadoPago?.initPoint || "").trim();
              return (
                <tr key={row.id}>
                  <TD>{row.correlativo || "—"}</TD>
                  <TD>{safeText(row.tipoDoc || row.documentTypeCode || "Documento")}</TD>
                  <TD>{fmtDate(row.fecha || row.fechaEmision)}</TD>
                  <TD>{fmtDate(row.fechaVencimiento)}</TD>
                  <TD>{fmtMoney(row.total)}</TD>
                  <TD>{fmtMoney(row.pending)}</TD>
                  <TD><Badge label={row.cobranza || row.bucket || "Pendiente"} color={Number(row.pending || 0) <= 0 ? "green" : row.bucket === "Vencido" ? "orange" : "cyan"} sm /></TD>
                  <TD>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {paymentLink ? <Btn onClick={() => openExternalLink(paymentLink)}>Pagar ahora</Btn> : <GBtn disabled>Sin link de pago</GBtn>}
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
          {purchaseOrders.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Número</TH><TH>Emisión</TH><TH>Monto</TH><TH>Facturación</TH><TH>Saldo OC</TH></tr></thead>
            <tbody>{purchaseOrders.map(row => <tr key={row.id}><TD>{row.number || "—"}</TD><TD>{fmtDate(row.issueDate)}</TD><TD>{fmtMoney(row.amount)}</TD><TD><Badge label={row.billingStatus || "Pendiente"} color={row.pendingAmount <= 0 ? "green" : "cyan"} sm /></TD><TD>{fmtMoney(row.pendingAmount)}</TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin órdenes de compra registradas" sub="Cuando se carguen OC para este cliente, aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "presupuestos" ? (
        <Card title="Presupuestos" sub="Propuestas y presupuestos relacionados a esta cuenta.">
          {budgets.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Título</TH><TH>Estado</TH><TH>Total</TH><TH>Forma de pago</TH><TH>Observación</TH></tr></thead>
            <tbody>{budgets.map(row => <tr key={row.id}><TD>{row.titulo || "Presupuesto"}</TD><TD><Badge label={row.estado || "Borrador"} color={/aceptado/i.test(String(row.estado || "")) ? "green" : /rechazado/i.test(String(row.estado || "")) ? "orange" : "cyan"} sm /></TD><TD>{fmtMoney(row.total || 0)}</TD><TD>{safeText(row.paymentMethod || row.formaPago)}</TD><TD>{safeText(row.observacion || row.portalClientComment || "", "Sin observación")}</TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin presupuestos visibles" sub="Cuando existan presupuestos asociados a este cliente, aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "pagos" ? (
        <Card title="Pagos registrados" sub="Aquí puedes revisar los pagos ya asociados a tus documentos.">
          {receiptLog.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Fecha</TH><TH>Documento</TH><TH>Método</TH><TH>Referencia</TH><TH>Monto</TH></tr></thead>
            <tbody>{receiptLog.map(row => <tr key={row.id}><TD>{fmtDate(row.date)}</TD><TD>{row.targetLabel || "—"}</TD><TD>{safeText(row.method)}</TD><TD>{safeText(row.reference)}</TD><TD>{fmtMoney(row.amount)}</TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin pagos registrados" sub="Los pagos conciliados aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "datos" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Card title="Datos de la cuenta" sub="Información general asociada a este cliente dentro de Produ.">
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
    </>
  );
}

function ProviderFinanceBody({ payload }) {
  const payables = useMemo(
    () => buildTreasuryPayables({
      payables: payload.payables,
      disbursements: payload.disbursements,
      empId: payload.empresa?.id,
    }).filter(row => row.supplier === payload.provider?.name),
    [payload],
  );
  const issuedOrders = useMemo(
    () => buildTreasuryIssuedOrders({
      orders: payload.issuedOrders,
      empId: payload.empresa?.id,
    }).filter(row => row.supplier === payload.provider?.name),
    [payload],
  );
  const disbursementLog = useMemo(
    () => buildTreasuryDisbursementLog({
      disbursements: payload.disbursements,
      payables: payload.payables,
      empId: payload.empresa?.id,
    }).filter(row => row.counterpartyLabel === payload.provider?.name),
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

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
        <PortalMetricCard eyebrow="Total por pagar" value={fmtMoney(payablesSummary.pending)} tone="blue" />
        <PortalMetricCard eyebrow="A tiempo" value={fmtMoney(Math.max(0, Number(payablesSummary.pending || 0) - Number(payablesSummary.overdue || 0)))} tone="green" />
        <PortalMetricCard eyebrow="Vencido" value={fmtMoney(payablesSummary.overdue)} tone="red" />
        <PortalMetricCard eyebrow="Línea disponible" value={availableCredit == null ? "—" : fmtMoney(availableCredit)} tone="purple" />
      </div>
      <SectionTabs type="provider" tab={tab} setTab={setTab} />
      {tab === "resumen" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 18 }}>
          <Card title="Resumen financiero" sub="Una vista simple del estado documental y de pagos de este proveedor.">
            <div style={{ display: "grid", gap: 10, fontSize: 14, color: "#53657e" }}>
              <div><b style={{ color: "#0f172a" }}>Documentos abiertos:</b> {payablesSummary.docs}</div>
              <div><b style={{ color: "#0f172a" }}>Monto por pagar:</b> {fmtMoney(payablesSummary.pending)}</div>
              <div><b style={{ color: "#0f172a" }}>Órdenes de compra emitidas:</b> {issuedOrderSummary.docs}</div>
              <div><b style={{ color: "#0f172a" }}>Límite de crédito:</b> {creditLimit ? fmtMoney(creditLimit) : "No definido"}</div>
            </div>
          </Card>
          <Card title="Lo más importante hoy" sub="Señales rápidas para saber qué revisar primero.">
            <div style={{ display: "grid", gap: 10, fontSize: 14, color: "#53657e" }}>
              <div>• {payables.filter(item => item.status === "Vencida").length} documento(s) están vencidos.</div>
              <div>• {disbursementLog.length} pago(s) ya fueron registrados.</div>
              <div>• {issuedOrders.length} orden(es) de compra emitidas están visibles en este portal.</div>
            </div>
          </Card>
        </div>
      ) : null}
      {tab === "documentos" ? (
        <Card title="Documentos por pagar" sub="Revisa folios, vencimientos y saldo de cada documento asociado a este proveedor.">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
            <input value={docSearch} onChange={event => setDocSearch(event.target.value)} placeholder="Buscar por folio, tipo o estado" style={{ minWidth: 220, flex: "1 1 260px", borderRadius: 14, border: "1px solid #d7e4f5", background: "#f9fbff", padding: "12px 14px", fontSize: 14 }} />
            <select value={docStatus} onChange={event => setDocStatus(event.target.value)} style={{ minWidth: 180, borderRadius: 14, border: "1px solid #d7e4f5", background: "#ffffff", padding: "12px 14px", fontSize: 14 }}>
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="overdue">Vencidos</option>
              <option value="paid">Pagados</option>
            </select>
          </div>
          {visiblePayables.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Número</TH><TH>Tipo</TH><TH>Emisión</TH><TH>Vencimiento</TH><TH>Monto</TH><TH>Saldo</TH><TH>Estado</TH></tr></thead>
            <tbody>{visiblePayables.map(row => <tr key={row.id}><TD>{row.folio || "—"}</TD><TD>{row.docType || "Documento"}</TD><TD>{fmtDate(row.issueDate)}</TD><TD>{fmtDate(row.dueDate)}</TD><TD>{fmtMoney(row.total)}</TD><TD>{fmtMoney(row.pending)}</TD><TD><Badge label={row.status || "Pendiente"} color={row.pending <= 0 ? "green" : row.status === "Vencida" ? "orange" : "cyan"} sm /></TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin documentos para este filtro" sub="Ajusta la búsqueda o vuelve a revisar más tarde." />}
        </Card>
      ) : null}
      {tab === "ordenes" ? (
        <Card title="Órdenes de compra emitidas" sub="Órdenes emitidas desde Produ para este proveedor.">
          {issuedOrders.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Número</TH><TH>Emisión</TH><TH>Monto</TH><TH>Ítems</TH><TH>Aprobación</TH></tr></thead>
            <tbody>{issuedOrders.map(row => <tr key={row.id}><TD>{row.number || "—"}</TD><TD>{fmtDate(row.issueDate)}</TD><TD>{fmtMoney(row.amount)}</TD><TD>{Array.isArray(row.items) ? row.items.length : 0}</TD><TD><Badge label={safeText(row.approvalStatus, "Pendiente")} color={/aprob/i.test(String(row.approvalStatus || "")) ? "green" : "cyan"} sm /></TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin órdenes emitidas" sub="Las órdenes emitidas desde Produ aparecerán aquí." />}
        </Card>
      ) : null}
      {tab === "pagos" ? (
        <Card title="Pagos registrados" sub="Pagos ya aplicados sobre documentos de este proveedor.">
          {disbursementLog.length ? <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><TH>Fecha</TH><TH>Documento</TH><TH>Método</TH><TH>Referencia</TH><TH>Monto</TH></tr></thead>
            <tbody>{disbursementLog.map(row => <tr key={row.id}><TD>{fmtDate(row.date)}</TD><TD>{row.targetLabel || "—"}</TD><TD>{safeText(row.method)}</TD><TD>{safeText(row.reference)}</TD><TD>{fmtMoney(row.amount)}</TD></tr>)}</tbody>
          </table></div> : <Empty text="Sin pagos registrados" sub="Los pagos realizados se verán aquí." />}
        </Card>
      ) : null}
      {tab === "datos" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <Card title="Datos del proveedor" sub="Información general asociada a este proveedor dentro de Produ.">
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

export function CounterpartyFinancePortalView({ empresas = [], descriptor = null }) {
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(false);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const sessionKey = useMemo(
    () => descriptor?.slug ? buildFinancePortalSessionKey(descriptor?.type, descriptor?.slug) : "",
    [descriptor?.slug, descriptor?.type],
  );

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
        {payload.type === "provider" ? <ProviderFinanceBody payload={payload} /> : <ClientFinanceBody payload={payload} />}
      </div>
    </PublicFinanceShell>
  );
}
