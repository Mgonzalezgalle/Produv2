import React, { useMemo, useState } from "react";
import {
  Badge,
  Empty,
  FilterSel,
  FI,
  FSl,
  GBtn,
  ModuleHeader,
  Paginator,
  TD,
  TH,
} from "../../lib/ui/components";
import { fmtD, fmtM, fmtMonthPeriod, openWhatsApp } from "../../lib/utils/helpers";
import { useLabTreasuryModule } from "../../hooks/useLabTreasuryModule";
import { useLabBillingTools } from "../../hooks/useLabBillingTools";
import { resolveTransactionalEmailTemplate } from "../../lib/integrations/transactionalEmailTemplates";
import { fetchSimpleApiRcvReport } from "../../lib/integrations/simpleApiRcv";
import { TreasuryIssuedOrderModal } from "./TreasuryIssuedOrderModal";
import { ProvidersPanel } from "./TreasuryDetails";
import { IssuedOrderDetailModal, PortfolioDetailModal, ProviderDetailModal } from "./TreasuryDetailModals";
import { TreasuryPayableModal } from "./TreasuryPayableModal";
import { TreasuryPaymentModal } from "./TreasuryPaymentModal";
import { TreasuryPurchaseOrderModal } from "./TreasuryPurchaseOrderModal";
import { TreasuryPayablesSection, TreasuryReceivablesSection } from "./TreasurySections";
import { TreasuryStyles, SectionCard, useTableState } from "./TreasuryCore";
import { TransactionalEmailComposerModal } from "../shared/TransactionalEmailComposerModal";
import { ConfirmActionDialog } from "../shared/ConfirmActionDialog";
import { buildIssuedOrderPdfDataUrl, buildIssuedOrderPdfFile } from "../../lib/utils/treasuryIssuedOrderPdf";
import { formatTreasuryMoney, normalizeTreasuryCurrency, TREASURY_CURRENCIES } from "../../lib/utils/treasury";

function TreasurySurfaceMetric({ label, value, tone = "var(--cy)", hint = null, wide = false }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : "auto", padding: "14px 15px", borderRadius: 16, border: "1px solid var(--bdr2)", background: "linear-gradient(180deg,rgba(255,255,255,.78),rgba(241,245,249,.9))", boxShadow: "0 10px 24px rgba(148,163,184,.12)" }}>
      <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", color: tone, lineHeight: 1 }}>{value}</div>
      {!!hint && <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.45, marginTop: 8 }}>{hint}</div>}
    </div>
  );
}

function summarizeMovementLog(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  const currencies = TREASURY_CURRENCIES
    .map(currency => {
      const currencyRows = list.filter(item => normalizeTreasuryCurrency(item?.currency) === currency);
      return {
        currency,
        docs: currencyRows.length,
        total: currencyRows.reduce((sum, item) => sum + Number(item?.amount || 0), 0),
      };
    })
    .filter(item => item.docs > 0);
  const primary = currencies.find(item => item.currency === "CLP") || { currency: "CLP", docs: 0, total: 0 };
  return {
    docs: list.length,
    total: primary.total,
    currency: "CLP",
    currencies,
    otherCurrencies: currencies.filter(item => item.currency !== "CLP"),
  };
}

async function openPdfSourceInNewTab(src = "", fallbackName = "documento.pdf") {
  const trimmedSrc = String(src || "").trim();
  if (!trimmedSrc) return false;
  if (/^https?:\/\//i.test(trimmedSrc)) {
    window.open(trimmedSrc, "_blank", "noopener,noreferrer");
    return true;
  }
  const response = await fetch(trimmedSrc);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.download = fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  return true;
}

function escapeEmailHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanRcvText(value = "") {
  return String(value ?? "").trim();
}

function normalizeRcvRut(value = "") {
  return cleanRcvText(value).replace(/\./g, "").replace(/\s/g, "").toUpperCase();
}

function rcvFirst(row = {}, keys = []) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && cleanRcvText(value) !== "") return value;
  }
  return "";
}

function rcvNumber(value) {
  const normalized = Number(String(value ?? "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(normalized) ? normalized : 0;
}

function rcvDate(value) {
  const raw = cleanRcvText(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parts = raw.split(/[/-]/).map(part => part.padStart(2, "0"));
  if (parts.length === 3) {
    if (parts[0].length === 4) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return "";
}

function rcvDocTypeLabel(value = "") {
  const code = cleanRcvText(value);
  const map = {
    30: "Factura",
    33: "Factura Afecta",
    34: "Factura Exenta",
    39: "Boleta",
    41: "Boleta Exenta",
    46: "Factura de Compra",
    52: "Guía de Despacho",
    56: "Nota de Débito",
    61: "Nota de Crédito",
  };
  return map[code] || code || "Documento";
}

function findBestRcvArray(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const candidates = [
    value.data,
    value.detalle,
    value.Detalle,
    value.registros,
    value.Registros,
    value.documentos,
    value.Documentos,
    value.compras,
    value.ventas,
    value.RCV,
    value.rcv,
  ];
  for (const candidate of candidates) {
    const found = findBestRcvArray(candidate);
    if (found.length) return found;
  }
  const nestedArrays = Object.values(value).filter(Array.isArray);
  if (nestedArrays.length) return nestedArrays.sort((a, b) => b.length - a.length)[0];
  return [];
}

function stableRcvId(operation, row, periodLabel) {
  const base = [
    operation,
    rcvFirst(row, ["TipoDoc", "TipoDTE", "TipoDocumento", "Tipo"]),
    rcvFirst(row, ["Folio", "folio", "NroDoc", "NumeroDocumento", "NroDocumento"]),
    rcvFirst(row, ["RUTEmisor", "RutEmisor", "RutProveedor", "RUTRecep", "RutReceptor", "RutCliente"]),
    periodLabel,
  ].map(cleanRcvText).join("_");
  return `sii_rcv_${base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 90)}`;
}

function normalizeRcvRows(response, operation, periodLabel) {
  return findBestRcvArray(response?.data ?? response).map((row, index) => {
    const folio = cleanRcvText(rcvFirst(row, ["Folio", "folio", "NroDoc", "NumeroDocumento", "NroDocumento", "Numero"]));
    const docTypeCode = cleanRcvText(rcvFirst(row, ["TipoDoc", "TipoDTE", "TipoDocumento", "Tipo", "TpoDoc"]));
    const rut = operation === "compras"
      ? cleanRcvText(rcvFirst(row, ["RUTEmisor", "RutEmisor", "RutProveedor", "RUTProveedor", "RUTContraparte"]))
      : cleanRcvText(rcvFirst(row, ["RUTRecep", "RutReceptor", "RUTReceptor", "RutCliente", "RUTCliente", "RUTContraparte"]));
    const name = operation === "compras"
      ? cleanRcvText(rcvFirst(row, ["RazonSocialEmisor", "RznSoc", "RazonSocial", "NombreEmisor", "Proveedor", "RazonSocialProveedor"]))
      : cleanRcvText(rcvFirst(row, ["RazonSocialRecep", "RazonSocialReceptor", "RazonSocial", "NombreReceptor", "Cliente", "RazonSocialCliente"]));
    const issueDate = rcvDate(rcvFirst(row, ["FechaEmision", "FchEmis", "FchEmision", "FechaDocto", "Fecha"]));
    const total = rcvNumber(rcvFirst(row, ["MontoTotal", "MntTotal", "Total", "Monto", "MontoDocumento"]));
    const net = rcvNumber(rcvFirst(row, ["MontoNeto", "MntNeto", "Neto"]));
    const tax = rcvNumber(rcvFirst(row, ["IVA", "MontoIVA", "Iva", "IVARecuperable"]));
    return {
      id: stableRcvId(operation, row, periodLabel) || `sii_rcv_${operation}_${index}`,
      operation,
      folio,
      docTypeCode,
      docType: rcvDocTypeLabel(docTypeCode),
      rut,
      normalizedRut: normalizeRcvRut(rut),
      name: name || "Sin contraparte",
      issueDate,
      total,
      net,
      tax,
      status: cleanRcvText(rcvFirst(row, ["Estado", "EstadoDoc", "EstadoDocumento"])) || "RCV",
      raw: row,
    };
  }).filter(row => row.folio || row.total || row.rut || row.name);
}

function SiiRcvImportPanel({
  empresa,
  platformApi,
  clientes = [],
  facturas = [],
  payables = [],
  canManageTreasury,
  saveFacturaDoc,
  savePayable,
  ntf,
}) {
  const todayDate = new Date();
  const tenantConfig = empresa?.integrationConfigs?.simpleApiRcv?.tenant || {};
  const governanceMode = empresa?.integrationConfigs?.simpleApiRcv?.governance?.mode || "disabled";
  const [operation, setOperation] = React.useState("compras");
  const [month, setMonth] = React.useState(String(todayDate.getMonth() + 1).padStart(2, "0"));
  const [year, setYear] = React.useState(String(todayDate.getFullYear()));
  const [rows, setRows] = React.useState([]);
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [lastMessage, setLastMessage] = React.useState("");
  const periodLabel = `${year}-${month}`;
  const enabled = governanceMode !== "disabled";
  const hasPayloadSecrets = Boolean(
    (cleanRcvText(tenantConfig.password) || tenantConfig.passwordConfigured === true) &&
    (cleanRcvText(tenantConfig.certificateBase64) || tenantConfig.certificateConfigured === true)
  );
  const findClient = row => (clientes || []).find(client => normalizeRcvRut(client?.rut) === row.normalizedRut) || null;
  const importedRows = rows.map(row => {
    const client = operation === "ventas" ? findClient(row) : null;
    const duplicate = operation === "compras"
      ? (payables || []).some(item => item?.source === "sii_rcv" && item?.externalId === row.id)
      : (facturas || []).some(item => item?.externalSync?.provider === "sii_rcv" && item?.externalSync?.externalDocumentId === row.id);
    const blockedReason = operation === "ventas" && !client ? "Cliente no encontrado por RUT" : "";
    return { ...row, client, duplicate, blockedReason, importable: !duplicate && !blockedReason };
  });
  const selectedRows = importedRows.filter(row => selectedIds.includes(row.id) && row.importable);
  const toggleAll = checked => setSelectedIds(checked ? importedRows.filter(row => row.importable).map(row => row.id) : []);
  const queryRcv = async () => {
    if (!enabled) {
      ntf?.("RCV del SII debe habilitarse primero desde Torre de Control.", "warn");
      return;
    }
    if (!hasPayloadSecrets) {
      ntf?.("Falta password o certificado disponible para consultar RCV desde este panel.", "warn");
      setLastMessage("La configuración está habilitada, pero no hay password/certificado disponible en el tenant para enviar la consulta.");
      return;
    }
    setLoading(true);
    setLastMessage("");
    try {
      const result = await fetchSimpleApiRcvReport(platformApi, {
        tenantId: empresa?.id || "",
        operation,
        period: { month: Number(month), year: Number(year) },
        credentials: {
          rutCertificado: tenantConfig.rutCertificado,
          rutEmpresa: tenantConfig.rutEmpresa,
          password: tenantConfig.password,
          ambiente: tenantConfig.ambiente ?? (governanceMode === "certification" ? 0 : 1),
          procesaBoletas: tenantConfig.procesaBoletas === true,
        },
        certificate: {
          base64: tenantConfig.certificateBase64,
          fileName: tenantConfig.certificateFileName,
          mimeType: tenantConfig.certificateMimeType,
        },
      });
      if (!result?.ok) {
        setRows([]);
        setSelectedIds([]);
        setLastMessage(result?.message || "No pudimos consultar RCV.");
        ntf?.(result?.message || "No pudimos consultar RCV.", "warn");
        return;
      }
      const normalized = normalizeRcvRows(result, operation, periodLabel);
      setRows(normalized);
      setSelectedIds(normalized.map(row => row.id));
      setLastMessage(`${normalized.length} documento(s) encontrados en RCV.`);
      ntf?.("Consulta RCV completada ✓");
    } catch (error) {
      console.warn("[sii-rcv] Consulta fallida", error);
      setRows([]);
      setSelectedIds([]);
      setLastMessage("No pudimos consultar RCV en este momento.");
      ntf?.("No pudimos consultar RCV en este momento.", "warn");
    } finally {
      setLoading(false);
    }
  };
  const importSelected = async () => {
    if (!canManageTreasury || !selectedRows.length) return;
    let imported = 0;
    for (const row of selectedRows) {
      if (operation === "compras") {
        const saved = await savePayable?.({
          id: row.id,
          source: "sii_rcv",
          externalId: row.id,
          supplier: row.name,
          docType: row.docType,
          folio: row.folio,
          category: "RCV SII",
          currency: "CLP",
          issueDate: row.issueDate,
          dueDate: row.issueDate,
          total: row.total,
          status: "Pendiente",
          notes: `Importado desde SII RCV compras ${periodLabel}. RUT proveedor: ${row.rut}.`,
          rcv: { operation, period: periodLabel, raw: row.raw },
        });
        if (saved !== false) imported += 1;
      } else {
        const saved = await saveFacturaDoc?.({
          id: row.id,
          source: "sii_rcv",
          externalId: row.id,
          tipo: "cliente",
          entidadId: row.client?.id || "",
          entidadNombre: row.name,
          tipoDoc: row.docType,
          documentTypeCode: row.docTypeCode === "34" ? "factura_exenta" : "factura_afecta",
          tipoDocumento: row.docTypeCode === "34" ? "factura_exenta" : "factura_afecta",
          correlativo: row.folio,
          estado: "Emitida",
          cobranzaEstado: "Pendiente de pago",
          fechaEmision: row.issueDate,
          fechaVencimiento: row.issueDate,
          montoNeto: row.net || Math.max(0, row.total - row.tax),
          iva: row.tax > 0,
          ivaVal: row.tax,
          total: row.total,
          obs: `Importado desde SII RCV ventas ${periodLabel}. RUT receptor: ${row.rut}.`,
          externalSync: {
            provider: "sii_rcv",
            status: "imported",
            externalDocumentId: row.id,
            externalFolio: row.folio,
            providerMessage: "Documento importado desde Registro de Compras y Ventas SII.",
          },
          rcv: { operation, period: periodLabel, raw: row.raw },
        });
        if (saved !== false) imported += 1;
      }
    }
    ntf?.(`${imported} documento(s) importado(s) desde RCV ✓`);
    setSelectedIds([]);
  };
  return (
    <SectionCard title="SII · Registro de Compras y Ventas" subtitle="Consulta el RCV por período, revisa diferencias e importa documentos a Tesorería sin duplicar">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,150px),1fr))", gap: 10, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 6, fontWeight: 700 }}>Operación</div>
          <FSl value={operation} onChange={e => { setOperation(e.target.value); setRows([]); setSelectedIds([]); }}>
            <option value="compras">Compras → CxP</option>
            <option value="ventas">Ventas → CxC</option>
          </FSl>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 6, fontWeight: 700 }}>Mes</div>
          <FSl value={month} onChange={e => setMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, idx) => String(idx + 1).padStart(2, "0")).map(value => <option key={value} value={value}>{fmtMonthPeriod(`${year}-${value}-01`)}</option>)}
          </FSl>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 6, fontWeight: 700 }}>Año</div>
          <FI value={year} onChange={e => setYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} />
        </div>
        <div style={{ display: "flex", alignItems: "end", gap: 8, flexWrap: "wrap" }}>
          <GBtn onClick={queryRcv} disabled={loading || !canManageTreasury}>{loading ? "Consultando..." : "Consultar RCV"}</GBtn>
          <GBtn onClick={importSelected} disabled={!selectedRows.length || !canManageTreasury}>Importar seleccionados ({selectedRows.length})</GBtn>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <Badge label={enabled ? "Habilitado" : "No habilitado"} color={enabled ? "green" : "gray"} sm />
        <Badge label={hasPayloadSecrets ? "Credenciales disponibles" : "Faltan secretos de consulta"} color={hasPayloadSecrets ? "cyan" : "yellow"} sm />
        <Badge label={operation === "compras" ? "Importa a CxP" : "Importa a CxC"} color={operation === "compras" ? "purple" : "cyan"} sm />
      </div>
      {!!lastMessage && <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 12 }}>{lastMessage}</div>}
      {importedRows.length ? (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <TH style={{ width: 36 }}><input type="checkbox" checked={importedRows.some(row => row.importable) && importedRows.filter(row => row.importable).every(row => selectedIds.includes(row.id))} onChange={e => toggleAll(e.target.checked)} /></TH>
                <TH>Documento</TH>
                <TH>{operation === "compras" ? "Proveedor" : "Cliente"}</TH>
                <TH>RUT</TH>
                <TH>Emisión</TH>
                <TH>Monto</TH>
                <TH>Estado</TH>
              </tr>
            </thead>
            <tbody>
              {importedRows.map(row => (
                <tr key={row.id}>
                  <TD><input type="checkbox" disabled={!row.importable} checked={selectedIds.includes(row.id)} onChange={() => setSelectedIds(prev => prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id])} /></TD>
                  <TD><div style={{ fontWeight: 800 }}>{row.docType}</div><div style={{ fontSize: 11, color: "var(--gr2)" }}>Folio {row.folio || "—"}</div></TD>
                  <TD>{operation === "ventas" && row.client ? row.client.nom : row.name}</TD>
                  <TD mono>{row.rut || "—"}</TD>
                  <TD>{row.issueDate ? fmtD(row.issueDate) : "—"}</TD>
                  <TD mono>{fmtM(row.total || 0)}</TD>
                  <TD><Badge label={row.duplicate ? "Ya importado" : row.blockedReason || "Listo"} color={row.duplicate ? "gray" : row.blockedReason ? "yellow" : "green"} sm /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty text="Sin consulta RCV cargada" sub="Elige compras o ventas, selecciona período y consulta el RCV para previsualizar documentos." />}
    </SectionCard>
  );
}

export function TreasuryModule(props) {
  const [payablesTab, setPayablesTab] = useState("documentos");
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioItem, setPortfolioItem] = useState(null);
  const [issuedDetailOpen, setIssuedDetailOpen] = useState(false);
  const [issuedDetailItem, setIssuedDetailItem] = useState(null);
  const [receiptClientFilter, setReceiptClientFilter] = useState("");
  const [receiptPeriodFilter, setReceiptPeriodFilter] = useState("");
  const [payableSupplierFilter, setPayableSupplierFilter] = useState("");
  const [payablePeriodFilter, setPayablePeriodFilter] = useState("");
  const [issuedSupplierFilter, setIssuedSupplierFilter] = useState("");
  const [disbursementSupplierFilter, setDisbursementSupplierFilter] = useState("");
  const [disbursementPeriodFilter, setDisbursementPeriodFilter] = useState("");
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailComposerDraft, setEmailComposerDraft] = useState(null);
  const [emailComposerSending, setEmailComposerSending] = useState(false);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(null);
  const openPortfolioDetail = item => { setPortfolioItem(item); setPortfolioOpen(true); };
  const openIssuedOrderDetail = React.useCallback(item => {
    setIssuedDetailItem(item);
    setIssuedDetailOpen(true);
  }, []);
  const closeIssuedOrderDetail = React.useCallback(() => {
    setIssuedDetailOpen(false);
    setIssuedDetailItem(null);
  }, []);
  const {
    tab, setTab, filteredReceivables, receivableSummary, portfolio,
    providers, payables, payablesSummary, purchaseOrders, purchaseOrderSummary, issuedOrders, issuedOrderSummary,
    receiptLog, disbursementLog, canManageTreasury, payableOpen, payableDraft, poOpen, poDraft, issuedOpen, issuedDraft,
    receiptOpen, receiptDraft, disbursementOpen, disbursementDraft, providerOpen, providerDraft, savePayable, deletePayable,
    savePurchaseOrder, deletePurchaseOrder, saveIssuedOrder, deleteIssuedOrder, saveReceipt, saveDisbursement,
    saveProvider, deleteProvider, openPayableCreate, openPayableEdit, openPurchaseOrderCreate, openPurchaseOrderEdit, openIssuedOrderCreate,
    openIssuedOrderEdit, openReceiptCreate, openDisbursementCreate, openReceiptEdit, openDisbursementEdit, openProviderCreate, openProviderEdit,
    deleteReceipt, deleteDisbursement, closePayable, closePurchaseOrder, closeIssuedOrder, closeReceipt, closeDisbursement, closeProvider,
  } = useLabTreasuryModule({
    ...props,
    currentUser: props.user || null,
    platformServices: props.platformServices || null,
  });
  const { clientes = [], facturas = [] } = props;
  const saveFacturaDoc = props.saveFacturaDoc;
  const {
    createBillingEmailDraft,
    createPaymentLinkEmailDraft,
    createStatementEmailDraft,
    generateMercadoPagoPaymentLink,
    refreshMercadoPagoPaymentStatus,
    simulateMercadoPagoPayment,
    deliverEmailDraft,
    sendBillingWhatsApp,
    sendPaymentLinkWhatsApp,
    sendStatementWhatsApp,
  } = useLabBillingTools({
    allDocs: (facturas || []).filter(item => item.empId === props.empresa?.id),
    movimientos: props.movimientos || [],
    setFacturas: props.setFacturas || (() => {}),
    saveFacturaDoc,
    setMovimientos: props.setMovimientos || (() => {}),
    canEdit: canManageTreasury,
    ntf: props.ntf,
    empresa: props.empresa,
    clientes: props.clientes || [],
    auspiciadores: props.auspiciadores || [],
    invoiceEntityName: (doc, clientesArg, auspiciadoresArg) => {
      const entity = doc.tipo === "auspiciador"
        ? (auspiciadoresArg || []).find(item => item.id === doc.entidadId)
        : (clientesArg || []).find(item => item.id === doc.entidadId);
      return entity?.nom || "—";
    },
    cobranzaState: doc => doc.cobranzaEstado || "Pendiente de pago",
    fmtD,
    fmtM,
    fmtMonthPeriod: value => value,
    today: () => new Date().toISOString().slice(0,10),
    addMonths: (date, months) => {
      const base = new Date(`${date}T12:00:00`);
      base.setMonth(base.getMonth() + Number(months || 0));
      return base.toISOString().slice(0,10);
    },
    uid: () => `treasury_${Math.random().toString(36).slice(2,10)}`,
    platformApi: props.platformApi,
    senderReplyTo: props.user?.email || "",
    treasuryReceipts: props.treasury?.receipts || [],
    setTreasuryReceipts: props.treasury?.setReceipts || null,
  });
  const openEmailComposer = React.useCallback((builderResult) => {
    if (!builderResult?.ok || !builderResult?.draft) {
      window.alert(builderResult?.message || "No pudimos preparar el correo.");
      return;
    }
    setEmailComposerDraft(builderResult.draft);
    setEmailComposerOpen(true);
  }, []);
  const closeEmailComposer = React.useCallback(() => {
    if (emailComposerSending) return;
    setEmailComposerOpen(false);
    setEmailComposerDraft(null);
  }, [emailComposerSending]);
  const handleSendComposedEmail = React.useCallback(async (draft) => {
    setEmailComposerSending(true);
    try {
      const result = await deliverEmailDraft(draft);
      if (!result?.ok) {
        window.alert(result?.message || "No pudimos enviar el correo.");
        return;
      }
      if (draft?.entityType === "issued_purchase_order" && draft?.entityId) {
        const current = (issuedOrders || []).find(item => item.id === draft.entityId);
        if (current) {
          await saveIssuedOrder({
            ...current,
            lastSentAt: new Date().toISOString(),
            lastSentTo: String(draft?.to || "").trim(),
            lastSentSubject: String(draft?.subject || "").trim(),
            lastSentSource: result?.source || "remote",
          });
        }
      }
      setEmailComposerOpen(false);
      setEmailComposerDraft(null);
    } finally {
      setEmailComposerSending(false);
    }
  }, [deliverEmailDraft, issuedOrders, saveIssuedOrder]);
  const openBillingEmailComposer = React.useCallback((doc, entity) => {
    openEmailComposer(createBillingEmailDraft(doc, entity));
  }, [createBillingEmailDraft, openEmailComposer]);
  const openPaymentLinkEmailComposer = React.useCallback((doc, entity) => {
    openEmailComposer(createPaymentLinkEmailDraft(doc, entity));
  }, [createPaymentLinkEmailDraft, openEmailComposer]);
  const openStatementEmailComposer = React.useCallback((docs, entity, type) => {
    openEmailComposer(createStatementEmailDraft(docs, entity, type));
  }, [createStatementEmailDraft, openEmailComposer]);
  const receivableTable = useTableState(filteredReceivables, {
    searchFields: [row => row.correlativo, row => row.entidad],
    statusOptions: ["Pendiente de pago", "Retrasado de pago", "Pagado", "Por vencer", "Vencido", "Ajuste crédito"],
    getStatus: row => row.bucket === "Vencido" ? "Vencido" : row.cobranza,
    isSelectable: row => row?.allowsManualReceipts !== false || row?.collectionEditable !== false,
  });
  const portfolioTable = useTableState(portfolio, { searchFields: [row => row.entidad], getId: row => row.entidadId, pageSize: 6 });
  const poTable = useTableState(purchaseOrders, { searchFields: [row => row.clientName, row => row.number], statusOptions: ["Pendiente", "Facturada", "Completada", "Sin facturar", "Facturado parcial", "Facturado y pagado"], getStatus: row => row.billingStatus, pageSize: 6 });
  const filteredReceiptLog = useMemo(
    () => receiptLog.filter(row => {
      const rowPeriod = String(row.date || "").slice(0, 7);
      const matchesClient = !receiptClientFilter || row.counterpartyLabel === receiptClientFilter;
      const matchesPeriod = !receiptPeriodFilter || rowPeriod === receiptPeriodFilter;
      return matchesClient && matchesPeriod;
    }),
    [receiptLog, receiptClientFilter, receiptPeriodFilter],
  );
  const receiptClientOptions = useMemo(
    () => Array.from(new Set(receiptLog.map(row => row.counterpartyLabel).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [receiptLog],
  );
  const receiptPeriodOptions = useMemo(
    () => Array.from(new Set(receiptLog.map(row => String(row.date || "").slice(0, 7)).filter(Boolean))).sort().reverse().map(period => ({ value: period, label: fmtMonthPeriod(`${period}-01`) })),
    [receiptLog],
  );
  const receiptsSummary = useMemo(() => summarizeMovementLog(receiptLog), [receiptLog]);
  const receiptTable = useTableState(filteredReceiptLog, { searchFields: [row => row.targetLabel, row => row.counterpartyLabel, row => row.reference, row => row.method], pageSize: 6 });
  const filteredPayables = useMemo(
    () => payables.filter(row => {
      const rowPeriod = String(row.issueDate || row.dueDate || "").slice(0, 7);
      const matchesSupplier = !payableSupplierFilter || row.supplier === payableSupplierFilter;
      const matchesPeriod = !payablePeriodFilter || rowPeriod === payablePeriodFilter;
      return matchesSupplier && matchesPeriod;
    }),
    [payables, payableSupplierFilter, payablePeriodFilter],
  );
  const payableSupplierOptions = useMemo(
    () => Array.from(new Set(payables.map(row => row.supplier).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [payables],
  );
  const payablePeriodOptions = useMemo(
    () => Array.from(new Set(payables.map(row => String(row.issueDate || row.dueDate || "").slice(0, 7)).filter(Boolean))).sort().reverse().map(period => ({ value: period, label: fmtMonthPeriod(`${period}-01`) })),
    [payables],
  );
  const payableTable = useTableState(filteredPayables, { searchFields: [row => row.supplier, row => row.folio], statusOptions: ["Pendiente", "Parcial", "Pagada", "Vencida"], getStatus: row => row.status, pageSize: 6 });
  const filteredIssuedOrders = useMemo(
    () => issuedOrders.filter(row => !issuedSupplierFilter || row.supplier === issuedSupplierFilter),
    [issuedOrders, issuedSupplierFilter],
  );
  const issuedSupplierOptions = useMemo(
    () => Array.from(new Set(issuedOrders.map(row => row.supplier).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [issuedOrders],
  );
  const issuedTable = useTableState(filteredIssuedOrders, { searchFields: [row => row.supplier, row => row.number], pageSize: 6 });
  const filteredDisbursementLog = useMemo(
    () => disbursementLog.filter(row => {
      const rowPeriod = String(row.date || "").slice(0, 7);
      const matchesSupplier = !disbursementSupplierFilter || row.counterpartyLabel === disbursementSupplierFilter;
      const matchesPeriod = !disbursementPeriodFilter || rowPeriod === disbursementPeriodFilter;
      return matchesSupplier && matchesPeriod;
    }),
    [disbursementLog, disbursementSupplierFilter, disbursementPeriodFilter],
  );
  const disbursementSupplierOptions = useMemo(
    () => Array.from(new Set(disbursementLog.map(row => row.counterpartyLabel).filter(Boolean).filter(label => label !== "—"))).sort((a, b) => a.localeCompare(b)),
    [disbursementLog],
  );
  const disbursementPeriodOptions = useMemo(
    () => Array.from(new Set(disbursementLog.map(row => String(row.date || "").slice(0, 7)).filter(Boolean))).sort().reverse().map(period => ({ value: period, label: fmtMonthPeriod(`${period}-01`) })),
    [disbursementLog],
  );
  const disbursementSummary = useMemo(() => summarizeMovementLog(disbursementLog), [disbursementLog]);
  const disbursementTable = useTableState(filteredDisbursementLog, { searchFields: [row => row.targetLabel, row => row.counterpartyLabel, row => row.reference, row => row.method], pageSize: 6 });
  const providerTable = useTableState(providers, { searchFields: [row => row.name, row => row.razonSocial, row => row.rut], pageSize: 6 });
  const providerPaymentRows = useMemo(() => {
    if (!providerDraft?.name) return [];
    return (disbursementLog || []).filter(row => row.counterpartyLabel === providerDraft.name);
  }, [disbursementLog, providerDraft?.name]);
  const handlePayableUpdate = async (row, patch = {}) => {
    if (!canManageTreasury || !row?.id) return;
    const source = (payables || []).find(item => item.id === row.id) || row;
    await savePayable({ ...source, ...patch });
  };
  const buildSupplierEmailDraft = React.useCallback((row) => {
    const provider = providers.find(item => item.name === row?.supplier || item.id === row?.providerId);
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const email = primaryContact?.email || primaryContact?.ema || provider?.email || "";
    if (!email) {
      return { ok: false, message: "El proveedor no tiene email registrado." };
    }
    const paymentDateLabel = row?.paymentDate ? fmtD(row.paymentDate) : "por definir";
    const supplierName = row?.supplier || provider?.name || "este proveedor";
    const resolved = resolveTransactionalEmailTemplate(props.empresa, "payables_supplier_contact", {
      contactName: primaryContact?.nombre || supplierName,
      companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
      supplierName,
      documentNumber: row?.folio || "sin folio",
      paymentDate: paymentDateLabel,
      totalFormatted: fmtM(row?.pending || row?.total || 0),
    });
    return {
      ok: true,
      draft: {
        tenantId: props.empresa?.id || "",
        templateKey: "payables_supplier_contact",
        subject: resolved.subject,
        to: email,
        body: resolved.body,
        entityType: "payable",
        entityId: row?.id || "",
        metadata: {
          companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
          supplierName,
          contactName: primaryContact?.nombre || "",
          documentNumber: row?.folio || "",
        },
      },
    };
  }, [props.empresa, providers]);
  const buildSupplierStatementEmailDraft = React.useCallback((source) => {
    const provider = providers.find(item => item.id === source?.id || item.id === source?.providerId || item.name === source?.supplier || item.name === source?.name);
    if (!provider) {
      return { ok: false, message: "No encontramos el proveedor para preparar el estado de cuenta." };
    }
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const email = primaryContact?.email || primaryContact?.ema || provider?.email || "";
    if (!email) {
      return { ok: false, message: "El proveedor no tiene email registrado." };
    }
    const supplierName = provider?.name || source?.supplier || "este proveedor";
    const payableDocs = Array.isArray(provider?.payables) ? provider.payables : [];
    if (!payableDocs.length) {
      return { ok: false, message: "El proveedor no tiene documentos registrados para armar el estado de cuenta." };
    }
    const documentLines = payableDocs
      .map(doc => `- ${doc.folio || "Sin folio"} · ${doc.docType || "Documento"} · Total ${fmtM(doc.total || 0)} · Pagado ${fmtM(doc.paid || 0)} · Saldo ${fmtM(doc.pending || 0)} · ${doc.status || "Pendiente"}`)
      .join("\n");
    const totals = payableDocs.reduce((acc, doc) => ({
      total: acc.total + Number(doc.total || 0),
      paid: acc.paid + Number(doc.paid || 0),
      pending: acc.pending + Number(doc.pending || 0),
    }), { total: 0, paid: 0, pending: 0 });
    const resolved = resolveTransactionalEmailTemplate(props.empresa, "payables_supplier_statement", {
      contactName: primaryContact?.nombre || supplierName,
      companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
      supplierName,
      documentLines,
      documentTotalFormatted: fmtM(totals.total),
      paidTotalFormatted: fmtM(totals.paid),
      pendingTotalFormatted: fmtM(totals.pending),
    });
    const detailTableHtml = `
      <table style="width:100%;border-collapse:collapse;margin:18px 0 16px 0;font-size:13px">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Documento</th>
              <th style="text-align:left;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Tipo</th>
              <th style="text-align:right;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Total</th>
              <th style="text-align:right;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Pagado</th>
              <th style="text-align:right;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Saldo</th>
              <th style="text-align:left;padding:10px 12px;border:1px solid #d7deeb;background:#1e3a8a;color:#ffffff">Estado</th>
            </tr>
          </thead>
          <tbody>
            ${payableDocs.map((doc, index) => `
              <tr style="background:${index % 2 === 0 ? "#f8fbff" : "#ffffff"}">
                <td style="padding:10px 12px;border:1px solid #d7deeb">${escapeEmailHtml(doc.folio || "Sin folio")}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb">${escapeEmailHtml(doc.docType || "Documento")}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb;text-align:right">${escapeEmailHtml(fmtM(doc.total || 0))}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb;text-align:right">${escapeEmailHtml(fmtM(doc.paid || 0))}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb;text-align:right">${escapeEmailHtml(fmtM(doc.pending || 0))}</td>
                <td style="padding:10px 12px;border:1px solid #d7deeb">${escapeEmailHtml(doc.status || "Pendiente")}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
    `.trim();
    const detailSummaryHtml = `
      <div style="margin:14px 0 18px 0;padding:14px 16px;border:1px solid #d7deeb;background:#f8fbff;border-radius:10px">
        <div style="margin-bottom:6px"><strong>Total documental:</strong> ${escapeEmailHtml(fmtM(totals.total))}</div>
        <div style="margin-bottom:6px"><strong>Total pagado:</strong> ${escapeEmailHtml(fmtM(totals.paid))}</div>
        <div><strong>Saldo pendiente:</strong> ${escapeEmailHtml(fmtM(totals.pending))}</div>
      </div>
    `.trim();
    return {
      ok: true,
      draft: {
        tenantId: props.empresa?.id || "",
        templateKey: "payables_supplier_statement",
        subject: resolved.subject,
        to: email,
        body: resolved.body,
        fixedHtmlBlocks: [detailTableHtml, detailSummaryHtml],
        fixedHtmlInsertAfterBlocks: 3,
        entityType: "supplier_statement",
        entityId: provider?.id || "",
        metadata: {
          companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
          supplierName,
          contactName: primaryContact?.nombre || "",
          documentCount: payableDocs.length,
          pendingTotal: totals.pending,
        },
      },
    };
  }, [fmtM, props.empresa, providers]);
  const buildIssuedOrderEmailDraft = React.useCallback(async (row) => {
    const provider = providers.find(item => item.name === row?.supplier || item.id === row?.providerId);
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const email = primaryContact?.email || primaryContact?.ema || provider?.email || "";
    if (!email) {
      return { ok: false, message: "El proveedor no tiene email registrado." };
    }
    const supplierName = row?.supplier || provider?.name || "este proveedor";
    const issueDateLabel = row?.issueDate ? fmtD(row.issueDate) : "por definir";
    const resolved = resolveTransactionalEmailTemplate(props.empresa, "issued_purchase_order_supplier", {
      contactName: primaryContact?.nombre || supplierName,
      companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
      supplierName,
      documentNumber: row?.number || "sin número",
      issueDate: issueDateLabel,
      totalFormatted: fmtM(row?.amount || 0),
    });
    const attachments = [];
    if (row?.pdfUrl) {
      attachments.push({
        id: `issued-order-${row?.id || row?.number || "attachment"}`,
        type: "pdf",
        src: row.pdfUrl,
        name: row.pdfName || `${row?.number || "orden-compra"}.pdf`,
      });
    } else {
      try {
        const file = await buildIssuedOrderPdfFile(row, props.empresa);
        const src = await buildIssuedOrderPdfDataUrl(row, props.empresa);
        attachments.push({
          id: `issued-order-${row?.id || row?.number || "attachment"}`,
          type: "pdf",
          src,
          name: file.name,
        });
      } catch (error) {
        console.warn("[treasury-issued-order-email] No pudimos generar el PDF adjunto de la OC", error);
      }
    }
    return {
      ok: true,
      draft: {
        tenantId: props.empresa?.id || "",
        templateKey: "issued_purchase_order_supplier",
        subject: resolved.subject,
        to: email,
        body: resolved.body,
        attachments,
        entityType: "issued_purchase_order",
        entityId: row?.id || "",
        metadata: {
          companyName: props.empresa?.nombre || props.empresa?.nom || "Produ",
          supplierName,
          contactName: primaryContact?.nombre || "",
          documentNumber: row?.number || "",
          entityLabel: row?.number || row?.supplier || "OC emitida",
        },
      },
    };
  }, [props.empresa, providers]);
  const handleSupplierEmail = React.useCallback((row) => {
    openEmailComposer(buildSupplierEmailDraft(row));
  }, [buildSupplierEmailDraft, openEmailComposer]);
  const handleSupplierStatementEmail = React.useCallback((source) => {
    openEmailComposer(buildSupplierStatementEmailDraft(source));
  }, [buildSupplierStatementEmailDraft, openEmailComposer]);
  const handleIssuedOrderEmail = React.useCallback(async (row) => {
    openEmailComposer(await buildIssuedOrderEmailDraft(row));
  }, [buildIssuedOrderEmailDraft, openEmailComposer]);
  const handleOpenIssuedOrderPdf = React.useCallback(async (row) => {
    if (!row) return;
    try {
      const isManualPdf = String(row.pdfSource || "").startsWith("manual");
      if (isManualPdf && String(row.pdfUrl || "").trim()) {
        await openPdfSourceInNewTab(row.pdfUrl, row.pdfName || `${row.number || "orden-compra"}.pdf`);
        return;
      }
      const file = await buildIssuedOrderPdfFile(row, props.empresa);
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.download = file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      await saveIssuedOrder({
        ...row,
        pdfUrl: await buildIssuedOrderPdfDataUrl(row, props.empresa),
        pdfName: row.pdfName || file.name,
        pdfSource: isManualPdf ? row.pdfSource : "generated",
      });
    } catch (error) {
      console.warn("[treasury-issued-order-pdf] No pudimos abrir el PDF de la OC", error);
      window.alert("No pudimos abrir el PDF de la orden de compra.");
    }
  }, [props.empresa, saveIssuedOrder]);
  const handleSupplierWhatsApp = row => {
    const provider = providers.find(item => item.name === row?.supplier || item.id === row?.providerId);
    const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
    const phone = primaryContact?.telefono || primaryContact?.tel || provider?.telefono || "";
    if (!phone) return;
    const paymentDateLabel = row?.paymentDate ? fmtD(row.paymentDate) : "por definir";
    openWhatsApp(
      phone,
      `Hola${primaryContact?.nombre ? ` ${primaryContact.nombre}` : ""}, te escribimos por el documento ${row?.folio || "sin folio"} de ${row?.supplier || "tu empresa"}. Fecha estimada de pago: ${paymentDateLabel}.`
    );
  };

  const deleteMany = async (ids = [], deleter) => {
    if (!ids.length || !deleter) return;
    setPendingBulkDelete({ ids, deleter });
  };
  const otherCurrencyBalances = (payablesSummary.otherCurrencies || [])
    .map(item => formatTreasuryMoney(item.pending, item.currency))
    .join(" · ");
  const otherCurrencyPayments = (disbursementSummary.otherCurrencies || [])
    .map(item => formatTreasuryMoney(item.total, item.currency))
    .join(" · ");
  const otherCurrencyMetric = otherCurrencyBalances
    ? {
        label: "Otras monedas",
        value: otherCurrencyBalances,
        tone: "#2b6df6",
        wide: true,
        hint: otherCurrencyPayments
          ? `Pagos realizados: ${otherCurrencyPayments}. Montos sin convertir a CLP.`
          : "Saldos pendientes separados, sin convertir a CLP.",
      }
    : null;
  const otherCurrencyKpi = otherCurrencyBalances
    ? {
        color: "#2b6df6",
        label: "Otras monedas",
        value: otherCurrencyBalances,
        sub: "Saldos sin convertir a CLP",
        scope: "CxP",
      }
    : null;
  const treasuryHero = tab === 0
    ? {
        badge: { label: "Foco en cobranza", color: "cyan" },
        secondaryBadge: { label: `${receivableSummary.overdueDocs} docs vencidos`, color: receivableSummary.overdueDocs ? "yellow" : "green" },
        tertiaryBadge: { label: `${receiptsSummary.docs} pagos recibidos`, color: "gray" },
        metrics: [
          { label: "Cartera total", value: fmtM(receivableSummary.total), tone: "var(--cy2)", hint: "Lectura consolidada de cuentas por cobrar." },
          { label: "Pendiente", value: fmtM(receivableSummary.pending), tone: "#ffcc44", hint: "Monto abierto aún no conciliado." },
          { label: "Vencido", value: fmtM(receivableSummary.overdue), tone: "var(--red)", hint: `${receivableSummary.overdueDocs} documento(s) con atraso.` },
          { label: "Pagos recibidos", value: fmtM(receiptsSummary.total), tone: "#00e08a", hint: `${receiptsSummary.docs} registro(s) conciliados manualmente.` },
        ],
        kpis: [
          { color: "var(--cy2)", label: "Cartera total", value: fmtM(receivableSummary.total), scope: "CxC" },
          { color: "#ffcc44", label: "Pendiente", value: fmtM(receivableSummary.pending), scope: "CxC" },
          { color: "var(--red)", label: "Vencido", value: fmtM(receivableSummary.overdue), sub: `${receivableSummary.overdueDocs} docs con atraso`, scope: "CxC" },
          { color: "#00e08a", label: "Pagos recibidos", value: fmtM(receiptsSummary.total), sub: `${receiptsSummary.docs} conciliación(es)`, scope: "CxC" },
        ],
      }
    : {
        badge: { label: "Foco en egresos", color: "purple" },
        secondaryBadge: { label: `${payablesSummary.docs} cuentas por pagar`, color: "gray" },
        tertiaryBadge: { label: `${issuedOrderSummary.docs} OC emitidas`, color: "cyan" },
        metrics: [
          { label: "Documentos por pagar", value: fmtM(payablesSummary.total), tone: "#a78bfa", hint: `${payablesSummary.docs} documento(s) registrados en cuentas por pagar.` },
          { label: "Pendiente de pago", value: fmtM(payablesSummary.pending), tone: "#ffcc44", hint: "Saldo aún no desembolsado." },
          { label: "Vencido", value: fmtM(payablesSummary.overdue), tone: "var(--red)", hint: "Documentos atrasados dentro de la salida de caja." },
          { label: "Pagos realizados", value: fmtM(disbursementSummary.total), tone: "#00e08a", hint: `${disbursementSummary.docs} desembolso(s) registrados.` },
          ...(otherCurrencyMetric ? [otherCurrencyMetric] : []),
        ],
        kpis: [
          { color: "#a78bfa", label: "Documentos por pagar", value: fmtM(payablesSummary.total), sub: `${payablesSummary.docs} registrados`, scope: "CxP" },
          { color: "#ffcc44", label: "Pendiente", value: fmtM(payablesSummary.pending), scope: "CxP" },
          { color: "var(--red)", label: "Vencido", value: fmtM(payablesSummary.overdue), sub: "saldo con atraso", scope: "CxP" },
          { color: "#00e08a", label: "Pagos realizados", value: fmtM(disbursementSummary.total), sub: `${disbursementSummary.docs} desembolso(s)`, scope: "CxP" },
          ...(otherCurrencyKpi ? [otherCurrencyKpi] : []),
        ],
      };

  return (
    <div className="treasury-shell">
      <TreasuryStyles />
      <div style={{padding:"22px 22px 18px",border:"1px solid var(--bdr2)",borderRadius:24,background:"linear-gradient(180deg,#f7fbff 0%, #eef4fb 100%)",marginBottom:18,boxShadow:"0 14px 30px rgba(148,163,184,.18)"}}>
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1.45fr) minmax(320px,.95fr)",gap:16,alignItems:"stretch"}}>
          <div style={{display:"grid",gap:12}}>
            <ModuleHeader
              module="Tesorería"
              title="Tesorería"
              description="Controla cartera, deuda, cobranza operativa, conciliación documental y pagos realizados desde una misma superficie financiera."
            />
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {treasuryHero.metrics.map(metric => (
              <TreasurySurfaceMetric
                key={metric.label}
                label={metric.label}
                value={metric.value}
                tone={metric.tone}
                hint={metric.hint}
                wide={metric.wide}
              />
            ))}
          </div>
        </div>
      </div>
      <SiiRcvImportPanel
        empresa={props.empresa}
        platformApi={props.platformApi}
        clientes={clientes}
        facturas={facturas}
        payables={payables}
        canManageTreasury={canManageTreasury}
        saveFacturaDoc={saveFacturaDoc}
        savePayable={savePayable}
        ntf={props.ntf}
      />
      <div className="treasury-tabs">
        <button className={`treasury-tab ${tab === 0 ? "active" : ""}`} onClick={() => setTab(0)}>Cuentas por Cobrar</button>
        <button className={`treasury-tab ${tab === 1 ? "active" : ""}`} onClick={() => setTab(1)}>Cuentas por Pagar</button>
      </div>
      {tab === 0 ? (
        <>
          <TreasuryReceivablesSection
            canManageTreasury={canManageTreasury}
            clientes={clientes}
            closePortfolioDetail={() => setPortfolioOpen(false)}
            closePurchaseOrder={closePurchaseOrder}
            facturas={facturas}
            openPortfolioDetail={openPortfolioDetail}
            openPurchaseOrderEdit={openPurchaseOrderEdit}
            openReceiptCreate={openReceiptCreate}
            poDraft={poDraft}
            poOpen={poOpen}
            portfolioItem={portfolioItem}
            portfolioOpen={portfolioOpen}
            portfolioTable={portfolioTable}
            props={{
              ...props,
              poTable,
              openPurchaseOrderCreate,
              deletePurchaseOrder,
              deleteMany,
            }}
            purchaseOrderSummary={purchaseOrderSummary}
            deleteMany={deleteMany}
            deleteReceipt={deleteReceipt}
            receiptClientFilter={receiptClientFilter}
            receiptClientOptions={receiptClientOptions}
            receiptDraft={receiptDraft}
            receiptOpen={receiptOpen}
            receiptPeriodFilter={receiptPeriodFilter}
            receiptPeriodOptions={receiptPeriodOptions}
            receiptTable={receiptTable}
            receivableTable={receivableTable}
            openReceiptEdit={openReceiptEdit}
            saveFacturaDoc={saveFacturaDoc}
            savePurchaseOrder={savePurchaseOrder}
            saveReceipt={saveReceipt}
            sendBillingEmail={openBillingEmailComposer}
            sendBillingWhatsApp={sendBillingWhatsApp}
            sendPaymentLinkEmail={openPaymentLinkEmailComposer}
            sendPaymentLinkWhatsApp={sendPaymentLinkWhatsApp}
            generateMercadoPagoPaymentLink={generateMercadoPagoPaymentLink}
            refreshMercadoPagoPaymentStatus={refreshMercadoPagoPaymentStatus}
            simulateMercadoPagoPayment={simulateMercadoPagoPayment}
            sendStatementEmail={openStatementEmailComposer}
            sendStatementWhatsApp={sendStatementWhatsApp}
            closeReceipt={closeReceipt}
            setReceiptClientFilter={setReceiptClientFilter}
            setReceiptPeriodFilter={setReceiptPeriodFilter}
          />
          <TreasuryPurchaseOrderModal open={poOpen} data={poDraft} clientes={clientes} facturas={facturas} onClose={closePurchaseOrder} onSave={savePurchaseOrder} />
        </>
      ) : (
        <>
          <TreasuryPayablesSection
            canManageTreasury={canManageTreasury}
            deleteMany={deleteMany}
            deleteDisbursement={deleteDisbursement}
            deleteIssuedOrder={deleteIssuedOrder}
            deletePayable={deletePayable}
            deleteProvider={deleteProvider}
            disbursementPeriodFilter={disbursementPeriodFilter}
            disbursementPeriodOptions={disbursementPeriodOptions}
            disbursementSupplierFilter={disbursementSupplierFilter}
            disbursementSupplierOptions={disbursementSupplierOptions}
            disbursementTable={disbursementTable}
            handlePayableUpdate={handlePayableUpdate}
            handleSupplierEmail={handleSupplierEmail}
            handleSupplierStatementEmail={handleSupplierStatementEmail}
            handleSupplierWhatsApp={handleSupplierWhatsApp}
            issuedOrderSummary={issuedOrderSummary}
            sendIssuedOrderEmail={handleIssuedOrderEmail}
            openIssuedOrderPdf={handleOpenIssuedOrderPdf}
            openIssuedOrderDetail={openIssuedOrderDetail}
            issuedSupplierFilter={issuedSupplierFilter}
            issuedSupplierOptions={issuedSupplierOptions}
            issuedTable={issuedTable}
            openDisbursementCreate={openDisbursementCreate}
            openDisbursementEdit={openDisbursementEdit}
            openIssuedOrderCreate={openIssuedOrderCreate}
            openIssuedOrderEdit={openIssuedOrderEdit}
            openPayableCreate={openPayableCreate}
            openPayableEdit={openPayableEdit}
            openProviderCreate={openProviderCreate}
            openProviderEdit={openProviderEdit}
            payablePeriodFilter={payablePeriodFilter}
            payablePeriodOptions={payablePeriodOptions}
            payableSupplierFilter={payableSupplierFilter}
            payableSupplierOptions={payableSupplierOptions}
            payableTable={payableTable}
            payablesSummary={payablesSummary}
            payablesTab={payablesTab}
            providerTable={providerTable}
            providers={providers}
            setDisbursementPeriodFilter={setDisbursementPeriodFilter}
            setDisbursementSupplierFilter={setDisbursementSupplierFilter}
            setIssuedSupplierFilter={setIssuedSupplierFilter}
            setPayablePeriodFilter={setPayablePeriodFilter}
            setPayableSupplierFilter={setPayableSupplierFilter}
            setPayablesTab={setPayablesTab}
            isMobile={props.isMobile}
          />
          <TreasuryPayableModal open={payableOpen} data={payableDraft} providers={providers} listas={props.listas} onClose={closePayable} onSave={savePayable} />
          <TreasuryIssuedOrderModal open={issuedOpen} data={issuedDraft} providers={providers} empresa={props.empresa} user={props.user} producciones={props.producciones} programas={props.programas} piezas={props.piezas} onClose={closeIssuedOrder} onSave={saveIssuedOrder} />
          <TreasuryPaymentModal open={disbursementOpen} title="Registrar pago realizado" subtitle="Asocia el pago a la cuenta por pagar correspondiente" data={disbursementDraft} onClose={closeDisbursement} onSave={saveDisbursement} />
        </>
      )}
      <PortfolioDetailModal open={portfolioOpen} item={portfolioItem} onClose={() => setPortfolioOpen(false)} onEditOrder={canManageTreasury ? row => { setPortfolioOpen(false); openPurchaseOrderEdit(row); } : null} canManage={canManageTreasury} />
      <ProviderDetailModal open={providerOpen} provider={providerDraft} paymentRows={providerPaymentRows} canManage={canManageTreasury} onUpdatePayable={handlePayableUpdate} onSupplierEmail={handleSupplierEmail} onSupplierStatementEmail={handleSupplierStatementEmail} onSupplierWhatsApp={handleSupplierWhatsApp} onClose={closeProvider} onSave={saveProvider} empresa={props.empresa} platformApi={props.platformApi} currentUser={props.user} ntf={props.ntf} />
      <IssuedOrderDetailModal
        open={issuedDetailOpen}
        order={issuedDetailItem}
        provider={providers.find(item => item.id === issuedDetailItem?.providerId || item.name === issuedDetailItem?.supplier) || null}
        onClose={closeIssuedOrderDetail}
        onEdit={canManageTreasury ? row => {
          closeIssuedOrderDetail();
          openIssuedOrderEdit(row);
        } : null}
        onEmail={handleIssuedOrderEmail}
        onOpenPdf={handleOpenIssuedOrderPdf}
      />
      <TransactionalEmailComposerModal
        open={emailComposerOpen}
        draft={emailComposerDraft}
        sending={emailComposerSending}
        onClose={closeEmailComposer}
        onSend={handleSendComposedEmail}
      />
      <ConfirmActionDialog
        open={Boolean(pendingBulkDelete)}
        title="Eliminar registros"
        message={`¿Eliminar ${pendingBulkDelete?.ids?.length || 0} registro${(pendingBulkDelete?.ids?.length || 0) === 1 ? "" : "s"} seleccionado${(pendingBulkDelete?.ids?.length || 0) === 1 ? "" : "s"}?`}
        confirmLabel="Eliminar"
        onClose={() => setPendingBulkDelete(null)}
        onConfirm={() => {
          const current = pendingBulkDelete;
          setPendingBulkDelete(null);
          if (!current?.ids?.length || !current?.deleter) return;
          void (async () => {
            for (const id of current.ids) {
              // Keep sequential writes so the current store setters stay consistent.
              // This is slower than batching, but safer with the current module contract.
              await current.deleter(id);
            }
          })();
        }}
      />
    </div>
  );
}
