import React, { useEffect, useMemo, useState } from "react";
import {
  DBtn,
  Empty,
  FilterSel,
  GBtn,
  Modal,
  ModuleHeader,
  Paginator,
  SearchBar,
  ViewModeToggle,
} from "../../lib/ui/components";
import { fmtD, fmtM } from "../../lib/utils/helpers";
import { useLabTreasuryModule } from "../../hooks/useLabTreasuryModule";
import { useLabBillingTools } from "../../hooks/useLabBillingTools";
import { TreasuryIssuedOrderModal } from "./TreasuryIssuedOrderModal";
import { TreasuryPayableModal } from "./TreasuryPayableModal";
import { TreasuryPaymentModal } from "./TreasuryPaymentModal";
import { TreasuryPurchaseOrderModal } from "./TreasuryPurchaseOrderModal";

function TreasuryStyles() {
  return (
    <style>{`
      .treasury-shell{color:var(--wh)}
      .treasury-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}
      .treasury-kpi{position:relative;border-radius:14px;border:1px solid var(--bdr);background:linear-gradient(180deg,var(--card),var(--card2));box-shadow:0 10px 30px rgba(0,0,0,.12);padding:18px 18px 16px;overflow:hidden}
      .treasury-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:var(--kpi-color,var(--cy))}
      .treasury-kpi-label{color:var(--gr2);text-transform:uppercase;letter-spacing:1.5px;font-size:10px;font-weight:700;margin-bottom:12px}
      .treasury-kpi-value{color:var(--wh);font-family:var(--fm);font-size:28px;line-height:1}
      .treasury-kpi-sub{margin-top:10px;color:var(--gr3);font-size:11px}
      .treasury-tabs,.treasury-subtabs,.treasury-modal-tabs{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .treasury-tabs{margin-bottom:18px}
      .treasury-tab,.treasury-subtab{border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.03);color:var(--gr2);border-radius:999px;font-family:var(--fb);font-weight:700;cursor:pointer;transition:.15s ease;box-shadow:0 8px 24px rgba(0,0,0,.1)}
      .treasury-tab{padding:14px 22px 13px;font-size:14px}
      .treasury-subtab{padding:11px 16px;font-size:13px}
      .treasury-tab:hover,.treasury-subtab:hover{color:var(--wh);border-color:rgba(255,255,255,.2);transform:translateY(-1px)}
      .treasury-tab.active,.treasury-subtab.active{color:var(--cy);background:rgba(0,212,232,.08);border-color:rgba(0,212,232,.35);box-shadow:0 0 0 1px rgba(0,212,232,.12) inset}
      .treasury-section{border:1px solid var(--bdr);border-radius:16px;background:linear-gradient(180deg,var(--card),var(--card2));box-shadow:0 10px 30px rgba(0,0,0,.12);padding:18px;margin-bottom:18px}
      .treasury-section.emphasis{border-left:3px solid var(--cy)}
      .treasury-section.with-top-border{border-top:1px solid var(--bdr2)}
      .treasury-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
      .treasury-section-title{font-family:var(--fh);font-size:19px;font-weight:800;letter-spacing:.4px;color:var(--wh)}
      .treasury-section-sub{color:var(--gr2);font-size:12px;line-height:1.6;margin-top:3px}
      .treasury-table-wrap{overflow-x:auto}
      .treasury-table{width:100%;border-collapse:separate;border-spacing:0}
      .treasury-table thead th{text-align:left;padding:11px 12px;background:linear-gradient(180deg,var(--card2),transparent);text-transform:uppercase;font-size:10px;letter-spacing:1.7px;color:var(--gr2);border-bottom:1px solid var(--bdr);white-space:nowrap}
      .treasury-table tbody tr{transition:background .15s ease}
      .treasury-table tbody tr:hover{background:var(--sur)}
      .treasury-table tbody td{padding:13px 12px;border-bottom:1px solid var(--bdr);color:var(--wh);font-size:13px;vertical-align:top}
      .treasury-table tbody tr:last-child td{border-bottom:0}
      .treasury-mono{font-family:var(--fm)}
      .treasury-muted{color:var(--gr3)}
      .treasury-pending-paid{color:#00e08a}
      .treasury-pending-alert{color:#ffcc44}
      .treasury-pending-overdue{color:#ff5566}
      .treasury-pending-idle{color:var(--gr2)}
      .treasury-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.4px;border:1px solid var(--badge-border,var(--bdr2));background:var(--badge-bg,var(--card2));color:var(--badge-color,var(--wh));white-space:nowrap}
      .treasury-detail{margin-top:8px;border-radius:14px;border:1px solid var(--bdr2);background:var(--sur);padding:14px;transition:.15s ease}
      .treasury-detail-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:14px}
      .treasury-detail-title{font-size:12px;font-weight:700;color:var(--wh);margin-bottom:8px}
      .treasury-concentration{display:flex;flex-direction:column;gap:7px}
      .treasury-progress{height:8px;border-radius:999px;background:var(--bdr2);overflow:hidden}
      .treasury-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--cy),#35e7f7)}
      .treasury-compact-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:16px}
      .treasury-mini-kpi{position:relative;border-radius:14px;border:1px solid var(--bdr);background:linear-gradient(180deg,var(--card),var(--card2));padding:15px 16px 14px;overflow:hidden}
      .treasury-mini-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--mini-color,var(--cy))}
      .treasury-mini-kpi .label{color:var(--gr2);text-transform:uppercase;letter-spacing:1.4px;font-size:10px;font-weight:700;margin-bottom:10px}
      .treasury-mini-kpi .value{font-family:var(--fm);font-size:22px;color:var(--wh)}
      .treasury-provider-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      .treasury-provider-card{border:1px solid var(--bdr);border-radius:14px;background:linear-gradient(180deg,var(--card),var(--card2));padding:20px;cursor:pointer;transition:.15s ease}
      .treasury-provider-card:hover{transform:translateY(-2px);border-color:rgba(0,212,232,.22)}
      .treasury-avatar{width:46px;height:46px;border-radius:12px;background:rgba(0,212,232,.08);border:1px solid rgba(0,212,232,.2);display:flex;align-items:center;justify-content:center;font-family:var(--fh);font-size:15px;font-weight:800;color:var(--cy);flex-shrink:0}
      .treasury-provider-meta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:12px}
      .treasury-provider-meta .meta-label{color:var(--gr2);text-transform:uppercase;letter-spacing:1.2px;font-size:10px;margin-bottom:6px}
      .treasury-provider-meta .meta-value{color:var(--wh);font-family:var(--fm);font-size:13px}
      .treasury-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
      .treasury-list{border:1px solid var(--bdr);border-radius:14px;overflow:hidden;background:linear-gradient(180deg,var(--card),var(--card2))}
      .treasury-list-row{display:grid;grid-template-columns:minmax(220px,1.4fr) repeat(4,minmax(0,1fr)) auto;gap:14px;align-items:center;padding:16px 18px;border-bottom:1px solid var(--bdr);transition:.15s ease;cursor:pointer}
      .treasury-list-row:hover{background:var(--sur)}
      .treasury-list-row:last-child{border-bottom:0}
      .treasury-list-head{color:var(--gr2);text-transform:uppercase;font-size:10px;letter-spacing:1.5px;font-weight:700;background:linear-gradient(180deg,var(--card2),transparent)}
      .treasury-modal-shell{display:flex;flex-direction:column;gap:18px}
      .treasury-profile{display:flex;align-items:flex-start;gap:14px}
      .treasury-profile-title{font-family:var(--fh);font-size:28px;font-weight:800;color:var(--wh)}
      .treasury-profile-sub{color:var(--gr2);font-size:13px;margin-top:4px}
      .treasury-modal-tabs{border-bottom:1px solid var(--bdr)}
      .treasury-modal-tab{border:0;background:transparent;color:var(--gr2);padding:0 0 12px;font-size:13px;font-weight:700;cursor:pointer;border-bottom:2px solid transparent}
      .treasury-modal-tab.active{color:var(--cy);border-bottom-color:var(--cy)}
      .treasury-modal-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
      @media (max-width: 1100px){
        .treasury-kpis,.treasury-compact-grid,.treasury-provider-grid,.treasury-detail-grid,.treasury-modal-summary{grid-template-columns:1fr}
        .treasury-list-row{grid-template-columns:1fr;gap:8px}
      }
    `}</style>
  );
}

function statusTone(label = "") {
  const value = String(label || "").toLowerCase();
  if (value.includes("pagad")) return "#00e08a";
  if (value.includes("vencid")) return "#ff5566";
  if (value.includes("pend") || value.includes("parcial") || value.includes("retras")) return "#ffcc44";
  if (value.includes("concili")) return "#00d4e8";
  if (value.includes("sin fact")) return "#7c7c8a";
  return "#a78bfa";
}

function StatusBadge({ label }) {
  const color = statusTone(label);
  return <span className="treasury-badge" style={{ "--badge-color": color, "--badge-bg": `${color}22`, "--badge-border": `${color}40` }}>{label}</span>;
}

function pendingTone(value, mode = "pending") {
  if (mode === "paid") return "treasury-pending-paid";
  if (mode === "overdue") return "treasury-pending-overdue";
  if (mode === "idle") return "treasury-pending-idle";
  return value > 0 ? "treasury-pending-alert" : "treasury-pending-paid";
}

function getInitials(value = "") {
  return String(value || "").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "PR";
}

function ContactActionButton({ tone = "mail", label, onClick }) {
  const isWhatsApp = tone === "wa";
  return (
    <button onClick={onClick} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 12px", borderRadius:10, border:isWhatsApp ? "1px solid #25D36640" : "1px solid var(--cm)", background:isWhatsApp ? "#25D36618" : "var(--cg)", color:isWhatsApp ? "#25D366" : "var(--cy)", cursor:"pointer", fontSize:12, fontWeight:700 }}>
      {isWhatsApp ? (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
      ) : (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      )}
      {label}
    </button>
  );
}

function makeId(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function fieldInputStyle() {
  return {
    width: "100%",
    borderRadius: 10,
    border: "1px solid var(--bdr2)",
    background: "var(--sur)",
    color: "var(--wh)",
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  };
}

function SectionCard({ title, subtitle, action, children, emphasis = false, withTopBorder = false }) {
  return (
    <section className={`treasury-section${emphasis ? " emphasis" : ""}${withTopBorder ? " with-top-border" : ""}`}>
      <div className="treasury-section-head">
        <div>
          <div className="treasury-section-title">{title}</div>
          {subtitle ? <div className="treasury-section-sub">{subtitle}</div> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function KpiCard({ color, label, value, sub }) {
  return <div className="treasury-kpi" style={{ "--kpi-color": color }}><div className="treasury-kpi-label">{label}</div><div className="treasury-kpi-value">{value}</div>{sub ? <div className="treasury-kpi-sub">{sub}</div> : null}</div>;
}

function MiniKpiCard({ color, label, value, sub }) {
  return <div className="treasury-mini-kpi" style={{ "--mini-color": color }}><div className="label">{label}</div><div className="value">{value}</div>{sub ? <div className="treasury-kpi-sub">{sub}</div> : null}</div>;
}

function EmptyInsideCard({ text, sub }) {
  return <div style={{ padding: "8px 0" }}><Empty text={text} sub={sub} /></div>;
}

function DetailTable({ columns = [], rows = [], emptyText = "Sin registros" }) {
  if (!rows.length) return <div className="treasury-muted" style={{ fontSize: 12 }}>{emptyText}</div>;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr>{columns.map(col => <th key={col.key}>{col.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((row, idx) => <tr key={row.id || row.key || idx}>{columns.map(col => <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

function useTableState(rows = [], { searchFields = [], statusOptions = [], getStatus = null, getId = row => row?.id, pageSize = 8 } = {}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const filteredRows = useMemo(() => {
    const term = String(query || "").trim().toLowerCase();
    return (Array.isArray(rows) ? rows : []).filter(row => {
      const matchesQuery = !term || searchFields.some(field => {
        const value = typeof field === "function" ? field(row) : row?.[field];
        return String(value || "").toLowerCase().includes(term);
      });
      const currentStatus = getStatus ? getStatus(row) : "";
      const matchesStatus = !status || currentStatus === status;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, searchFields, status, getStatus]);
  const pageRows = useMemo(() => filteredRows.slice((page - 1) * pageSize, page * pageSize), [filteredRows, page, pageSize]);
  const pageIds = useMemo(() => pageRows.map(row => getId(row)).filter(Boolean), [pageRows, getId]);
  useEffect(() => {
    setPage(1);
  }, [query, status]);
  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => filteredRows.some(row => getId(row) === id)));
    const maxPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [filteredRows, page, pageSize, getId]);
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? pageIds : []);
  const clearSelection = () => setSelectedIds([]);
  return {
    query,
    setQuery,
    status,
    setStatus,
    page,
    setPage,
    pageSize,
    filteredRows,
    pageRows,
    pageIds,
    selectedIds,
    toggleSelected,
    toggleAll,
    clearSelection,
    statusOptions,
  };
}

function TableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  statusValue,
  onStatusChange,
  statusOptions = [],
  selectedCount = 0,
  onDeleteSelected,
  onClearSelection,
  createAction,
  canManage = false,
}) {
  return (
    <>
      <div className="treasury-toolbar">
        <SearchBar value={searchValue} onChange={onSearchChange} placeholder={searchPlaceholder} />
        {statusOptions.length ? <FilterSel value={statusValue} onChange={onStatusChange} options={statusOptions} placeholder="Todo estados" /> : null}
        {createAction || null}
      </div>
      {selectedCount ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}</div>
          {canManage && onDeleteSelected ? <DBtn sm onClick={onDeleteSelected}>Eliminar seleccionados</DBtn> : null}
          <GBtn sm onClick={onClearSelection}>Limpiar selección</GBtn>
        </div>
      ) : null}
    </>
  );
}

function PortfolioTable({ rows = [], onOpen, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  if (!rows.length) return <EmptyInsideCard text="Sin cartera registrada" sub="Cuando existan facturas emitidas, aquí verás el resumen por cliente." />;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead>
          <tr>
            <th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} /></th>
            <th>Cliente</th>
            <th>Documentos</th>
            <th>Pendiente</th>
            <th>Vencido</th>
            <th>Concentración</th>
            <th>Límite crédito</th>
            <th>Cupo disponible</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const concentration = Number(row.concentrationPct || 0);
            const availableClass = row.availableCredit == null ? "treasury-pending-idle" : row.availableCredit < 0 ? "treasury-pending-overdue" : row.availableCredit < Number(row.creditLimit || 0) * 0.2 ? "treasury-pending-alert" : "treasury-pending-paid";
            return (
              <tr key={row.entidadId}>
                <td><input type="checkbox" checked={selectedIds.includes(row.entidadId)} onChange={() => toggleSelected(row.entidadId)} /></td>
                <td style={{ fontWeight: 700 }}>{row.entidad || "Sin entidad"}</td>
                <td className="treasury-mono">{row.docs}</td>
                <td className="treasury-mono treasury-pending-alert">{fmtM(row.pending)}</td>
                <td className={`treasury-mono ${row.overdue > 0 ? "treasury-pending-overdue" : "treasury-pending-idle"}`}>{fmtM(row.overdue)}</td>
                <td style={{ minWidth: 160 }}>
                  <div className="treasury-concentration">
                    <div className="treasury-mono">{`${concentration.toFixed(1)}%`}</div>
                    <div className="treasury-progress"><div className="treasury-progress-fill" style={{ width: `${Math.max(6, Math.min(concentration, 100))}%` }} /></div>
                  </div>
                </td>
                <td className={`treasury-mono ${row.creditLimit ? "treasury-pending-paid" : "treasury-pending-idle"}`}>{row.creditLimit ? fmtM(row.creditLimit) : "No definido"}</td>
                <td className={`treasury-mono ${availableClass}`}>{row.availableCredit == null ? "—" : fmtM(row.availableCredit)}</td>
                <td><GBtn sm onClick={() => onOpen(row)}>Ver detalle</GBtn></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function collectionOptions(current = "") {
  const base = ["Pendiente de pago", "Pagado", "No pagado", "Retrasado de pago"];
  return current && !base.includes(current) ? [current, ...base] : base;
}

function ReceivablesTable({ rows = [], onAddPayment, onUpdateCobranza, onBillingEmail, onBillingWhatsApp, onStatementEmail, onStatementWhatsApp, canManage = false, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  const [openId, setOpenId] = useState("");
  if (!rows.length) return <EmptyInsideCard text="Sin cuentas por cobrar" sub="Emite facturas para comenzar a visualizar la cartera." />;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} /></th><th>Documento</th><th>Entidad</th><th>Emisión</th><th>Vencimiento</th><th>Cobranza</th><th>Total</th><th>Pendiente</th><th></th></tr></thead>
        <tbody>
          {rows.map(row => {
            const open = openId === row.id;
            const pendingMode = row.cobranza === "Pagado" ? "paid" : row.bucket === "Vencido" ? "overdue" : "pending";
            return (
              <React.Fragment key={row.id}>
                <tr>
                  <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                  <td style={{ fontWeight: 700 }}>{row.correlativo}</td>
                  <td>{row.entidad}</td>
                  <td>{row.fechaEmision ? fmtD(row.fechaEmision) : "—"}</td>
                  <td>{row.fechaVencimiento ? fmtD(row.fechaVencimiento) : "—"}</td>
                  <td><StatusBadge label={row.cobranza} /></td>
                  <td className="treasury-mono">{fmtM(row.total)}</td>
                  <td className={`treasury-mono ${pendingTone(row.pending, pendingMode)}`}>{fmtM(row.pending)}</td>
                  <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><GBtn sm onClick={() => onAddPayment(row)}>Registrar pago</GBtn><GBtn sm onClick={() => setOpenId(open ? "" : row.id)}>{open ? "Ocultar" : "Ver detalle"}</GBtn></div></td>
                </tr>
                {open ? <tr><td colSpan={9} style={{ paddingTop: 0 }}><div className="treasury-detail"><div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start", flexWrap:"wrap", marginBottom:12 }}><div><div className="treasury-detail-title">Gestión de cobranza</div><div className="treasury-muted" style={{ fontSize:12 }}>Aquí se centraliza el seguimiento operativo del cobro para este documento.</div></div>{canManage && onUpdateCobranza ? <label style={{ minWidth:220 }}><div className="treasury-section-sub" style={{ marginTop:0, marginBottom:6 }}>Estado de cobranza</div><select value={row.cobranza} onChange={e => onUpdateCobranza(row, e.target.value)} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid var(--bdr2)", background:"var(--card)", color:"var(--wh)" }}>{collectionOptions(row.cobranza).map(option => <option key={option} value={option}>{option}</option>)}</select></label> : null}</div><div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>{onBillingEmail ? <ContactActionButton tone="mail" label="Correo" onClick={() => onBillingEmail(row)} /> : null}{onBillingWhatsApp ? <ContactActionButton tone="wa" label="WhatsApp" onClick={() => onBillingWhatsApp(row)} /> : null}{onStatementEmail ? <ContactActionButton tone="mail" label="Estado cta." onClick={() => onStatementEmail(row)} /> : null}{onStatementWhatsApp ? <ContactActionButton tone="wa" label="Estado cta." onClick={() => onStatementWhatsApp(row)} /> : null}</div><div className="treasury-detail-title">Historial de pagos</div><DetailTable columns={[{ key: "date", label: "Fecha", render: item => item.date ? fmtD(item.date) : "—" }, { key: "method", label: "Método" }, { key: "reference", label: "Referencia" }, { key: "amount", label: "Monto", render: item => <span className="treasury-mono treasury-pending-paid">{fmtM(item.amount)}</span> }]} rows={row.paymentHistory || []} emptyText="Todavía no hay pagos manuales registrados para este documento" /></div></td></tr> : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PayablesTable({ rows = [], onEdit, onDelete, onAddPayment, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  const [openId, setOpenId] = useState("");
  if (!rows.length) return <EmptyInsideCard text="Sin cuentas por pagar registradas" sub="Registra documentos manuales del módulo Tesorería para controlar pagos y vencimientos." />;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} /></th><th>Proveedor</th><th>Documento</th><th>Vencimiento</th><th>Estado</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th></th></tr></thead>
        <tbody>
          {rows.map(row => {
            const open = openId === row.id;
            const pendingMode = row.status === "Pagada" ? "paid" : row.status === "Vencida" ? "overdue" : row.pending > 0 ? "pending" : "idle";
            return (
              <React.Fragment key={row.id}>
                <tr>
                  <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                  <td style={{ fontWeight: 700 }}>{row.supplier}</td>
                  <td>{row.folio || "—"}</td>
                  <td>{row.dueDate ? fmtD(row.dueDate) : "—"}</td>
                  <td><StatusBadge label={row.status} /></td>
                  <td className="treasury-mono">{fmtM(row.total)}</td>
                  <td className="treasury-mono treasury-pending-paid">{fmtM(row.paid)}</td>
                  <td className={`treasury-mono ${pendingTone(row.pending, pendingMode)}`}>{fmtM(row.pending)}</td>
                  <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><GBtn sm onClick={() => onAddPayment(row)}>Registrar pago</GBtn><GBtn sm onClick={() => onEdit(row)}>Editar</GBtn><DBtn sm onClick={() => onDelete(row.id)}>Eliminar</DBtn><GBtn sm onClick={() => setOpenId(open ? "" : row.id)}>{open ? "Ocultar" : "Ver detalle"}</GBtn></div></td>
                </tr>
                {open ? <tr><td colSpan={9} style={{ paddingTop: 0 }}><div className="treasury-detail"><div className="treasury-detail-title">Historial de pagos</div><DetailTable columns={[{ key: "date", label: "Fecha", render: item => item.date ? fmtD(item.date) : "—" }, { key: "method", label: "Método" }, { key: "reference", label: "Referencia" }, { key: "amount", label: "Monto", render: item => <span className="treasury-mono treasury-pending-paid">{fmtM(item.amount)}</span> }]} rows={row.paymentHistory || []} emptyText="Todavía no hay pagos manuales registrados para esta cuenta" /></div></td></tr> : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaymentLogTable({ rows = [], emptyText, targetLabel, onEdit, onDelete, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  if (!rows.length) return <EmptyInsideCard text={emptyText} sub="Cada registro queda trazado con fecha, monto, método y referencia." />;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} /></th><th>Fecha</th><th>{targetLabel}</th><th>Método</th><th>Referencia</th><th>Monto</th><th></th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td><td>{row.date ? fmtD(row.date) : "—"}</td><td>{row.targetLabel}</td><td>{row.method || "—"}</td><td>{row.reference || "—"}</td><td className="treasury-mono treasury-pending-paid">{fmtM(row.amount)}</td><td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>{onEdit ? <GBtn sm onClick={() => onEdit(row)}>Editar</GBtn> : null}{onDelete ? <DBtn sm onClick={() => onDelete(row.id)}>Eliminar</DBtn> : null}</div></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function PurchaseOrdersTable({ rows = [], onEdit, onDelete, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  const [openId, setOpenId] = useState("");
  if (!rows.length) return <EmptyInsideCard text="Sin órdenes de compra registradas" sub="Registra una OC y vincúlala manualmente a las facturas emitidas del cliente." />;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} /></th><th>Cliente</th><th>OC</th><th>Fecha</th><th>Estado OC</th><th>Estado factura</th><th>Monto</th><th>Pendiente OC</th><th></th></tr></thead>
        <tbody>
          {rows.map(row => {
            const open = openId === row.id;
            const pendingMode = row.billingStatus === "Facturado y pagado" ? "paid" : row.billingStatus === "Sin facturar" ? "idle" : row.pendingAmount > 0 ? "pending" : "paid";
            return (
              <React.Fragment key={row.id}>
                <tr>
                  <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                  <td style={{ fontWeight: 700 }}>{row.clientName}</td>
                  <td>{row.number}</td>
                  <td>{row.issueDate ? fmtD(row.issueDate) : "—"}</td>
                  <td><StatusBadge label={row.status} /></td>
                  <td><StatusBadge label={row.billingStatus} /></td>
                  <td className="treasury-mono">{fmtM(row.amount)}</td>
                  <td className={`treasury-mono ${pendingTone(row.pendingAmount, pendingMode)}`}>{fmtM(row.pendingAmount)}</td>
                  <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><GBtn sm onClick={() => onEdit(row)}>Editar</GBtn><DBtn sm onClick={() => onDelete(row.id)}>Eliminar</DBtn><GBtn sm onClick={() => setOpenId(open ? "" : row.id)}>{open ? "Ocultar" : "Ver detalle"}</GBtn></div></td>
                </tr>
                {open ? <tr><td colSpan={9} style={{ paddingTop: 0 }}><div className="treasury-detail"><div className="treasury-detail-title">Facturas vinculadas a la OC</div><DetailTable columns={[{ key: "correlativo", label: "Factura" }, { key: "fecha", label: "Emisión", render: item => item.fecha ? fmtD(item.fecha) : "—" }, { key: "cobranza", label: "Cobranza", render: item => <StatusBadge label={item.cobranza} /> }, { key: "total", label: "Total", render: item => <span className="treasury-mono">{fmtM(item.total)}</span> }, { key: "paid", label: "Pagado", render: item => <span className="treasury-mono treasury-pending-paid">{fmtM(item.paid)}</span> }, { key: "pending", label: "Pendiente", render: item => <span className={`treasury-mono ${pendingTone(item.pending, item.pending <= 0 ? "paid" : item.cobranza === "Pagado" ? "paid" : "pending")}`}>{fmtM(item.pending)}</span> }]} rows={row.linkedInvoices || []} emptyText="Esta orden todavía no tiene facturas asociadas" /></div></td></tr> : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IssuedOrdersTable({ rows = [], onEdit, onDelete, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  if (!rows.length) return <EmptyInsideCard text="Sin órdenes de compra emitidas" sub="Carga aquí las OC emitidas a proveedores para dejar trazabilidad dentro de cuentas por pagar." />;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} /></th><th>Proveedor</th><th>OC</th><th>Fecha</th><th>Monto</th><th></th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td><td style={{ fontWeight: 700 }}>{row.supplier}</td><td>{row.number}</td><td>{row.issueDate ? fmtD(row.issueDate) : "—"}</td><td className="treasury-mono">{fmtM(row.amount)}</td><td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}><GBtn sm onClick={() => onEdit(row)}>Editar</GBtn><DBtn sm onClick={() => onDelete(row.id)}>Eliminar</DBtn></div></td></tr>)}</tbody>
      </table>
    </div>
  );
}

function deriveProviders(payables = [], issuedOrders = []) {
  const map = new Map();
  const ensure = name => {
    if (!map.has(name)) map.set(name, { id: name, name, payables: [], issuedOrders: [], totalDebt: 0, paid: 0, pending: 0 });
    return map.get(name);
  };
  (payables || []).forEach(item => {
    const key = item.supplier || "Proveedor sin nombre";
    const entry = ensure(key);
    entry.payables.push(item);
    entry.totalDebt += Number(item.total || 0);
    entry.paid += Number(item.paid || 0);
    entry.pending += Number(item.pending || 0);
  });
  (issuedOrders || []).forEach(item => {
    const key = item.supplier || "Proveedor sin nombre";
    ensure(key).issuedOrders.push(item);
  });
  return Array.from(map.values()).sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name));
}

function ProvidersPanel({
  providers = [],
  pageRows = [],
  totalRows = 0,
  query,
  setQuery,
  page,
  setPage,
  pageSize = 6,
  onOpen,
  onCreate,
  onDelete,
  canManage = false,
  selectedIds = [],
  toggleSelected,
  toggleAll,
  pageIds = [],
}) {
  const [vista, setVista] = useState("cards");
  if (!(Array.isArray(providers) ? providers : []).length) {
    return (
      <>
        <div className="treasury-toolbar">
          <SearchBar value={query} onChange={value => { setQuery(value); setPage(1); }} placeholder="Buscar proveedor..." />
          <ViewModeToggle value={vista} onChange={setVista} />
          {canManage ? <GBtn onClick={onCreate}>+ Nuevo proveedor</GBtn> : null}
        </div>
        <EmptyInsideCard text="Sin proveedores registrados" sub="Crea el primero y luego podrás asociarlo a documentos y órdenes emitidas." />
      </>
    );
  }
  return (
    <>
      <div className="treasury-toolbar">
        <SearchBar value={query} onChange={value => { setQuery(value); setPage(1); }} placeholder="Buscar proveedor..." />
        <ViewModeToggle value={vista} onChange={setVista} />
        {canManage ? <GBtn onClick={onCreate}>+ Nuevo proveedor</GBtn> : null}
      </div>
      {selectedIds.length ? <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}><div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}</div>{canManage ? <DBtn sm onClick={onDelete}>Eliminar seleccionados</DBtn> : null}</div> : null}
      {vista === "cards" ? (
        <>
          <div className="treasury-provider-grid">
            {pageRows.map(provider => (
              <div key={provider.id} className="treasury-provider-card" onClick={() => onOpen(provider)} style={{ position: "relative" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(provider.id)}
                  onChange={e => { e.stopPropagation(); toggleSelected(provider.id); }}
                  onClick={e => e.stopPropagation()}
                  style={{ position: "absolute", top: 14, right: 14 }}
                />
                <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div className="treasury-avatar">{getInitials(provider.name)}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--wh)" }}>{provider.name}</div>
                    <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>Gestión consolidada del proveedor dentro de Cuentas por Pagar</div>
                    <div className="treasury-provider-meta">
                      <div><div className="meta-label">Documentos</div><div className="meta-value">{provider.payables.length}</div></div>
                      <div><div className="meta-label">OC emitidas</div><div className="meta-value">{provider.issuedOrders.length}</div></div>
                      <div><div className="meta-label">Pendiente</div><div className={`meta-value ${pendingTone(provider.pending, provider.pending > 0 ? "pending" : "paid")}`}>{fmtM(provider.pending)}</div></div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
                  <StatusBadge label={provider.pending > 0 ? "Con saldo pendiente" : "Sin saldo"} />
                  <GBtn sm onClick={() => onOpen(provider)}>Ver proveedor</GBtn>
                </div>
              </div>
            ))}
          </div>
          <Paginator page={page} total={totalRows} perPage={pageSize} onChange={setPage} />
        </>
      ) : (
        <>
          <div className="treasury-list">
            <div className="treasury-list-row treasury-list-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} />Proveedor</div><div>Documentos</div><div>OC emitidas</div><div>Total deuda</div><div>Pendiente</div><div></div>
            </div>
            {pageRows.map(provider => (
              <div key={provider.id} className="treasury-list-row" onClick={() => onOpen(provider)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}><input type="checkbox" checked={selectedIds.includes(provider.id)} onChange={e => { e.stopPropagation(); toggleSelected(provider.id); }} onClick={e => e.stopPropagation()} /><div className="treasury-avatar">{getInitials(provider.name)}</div><div><div style={{ fontWeight: 700 }}>{provider.name}</div><div className="treasury-muted" style={{ fontSize: 11 }}>Flujo de pagos y documentos</div></div></div>
                <div className="treasury-mono">{provider.payables.length}</div>
                <div className="treasury-mono">{provider.issuedOrders.length}</div>
                <div className="treasury-mono">{fmtM(provider.totalDebt)}</div>
                <div className={`treasury-mono ${pendingTone(provider.pending, provider.pending > 0 ? "pending" : "paid")}`}>{fmtM(provider.pending)}</div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}><GBtn sm onClick={() => onOpen(provider)}>Ver →</GBtn></div>
              </div>
            ))}
          </div>
          <Paginator page={page} total={totalRows} perPage={pageSize} onChange={setPage} />
        </>
      )}
    </>
  );
}

function PortfolioDetailModal({ open, item, onClose, onEditOrder, canManage = false }) {
  const [tab, setTab] = useState("documentos");
  if (!item) return null;
  return (
    <Modal open={open} onClose={onClose} title="" sub="" wide>
      <div className="treasury-modal-shell">
        <div className="treasury-profile">
          <div className="treasury-avatar" style={{ width: 58, height: 58, fontSize: 18 }}>{getInitials(item.entidad)}</div>
          <div style={{ flex: 1 }}><div className="treasury-profile-title">{item.entidad || "Cliente sin nombre"}</div><div className="treasury-profile-sub">Detalle de cartera, documentos y órdenes de compra vinculadas al cliente.</div></div>
          <GBtn onClick={onClose}>Cerrar</GBtn>
        </div>
        <div className="treasury-modal-tabs">
          <button className={`treasury-modal-tab ${tab === "documentos" ? "active" : ""}`} onClick={() => setTab("documentos")}>Documentos</button>
          <button className={`treasury-modal-tab ${tab === "ordenes" ? "active" : ""}`} onClick={() => setTab("ordenes")}>Órdenes de compra</button>
          <button className={`treasury-modal-tab ${tab === "resumen" ? "active" : ""}`} onClick={() => setTab("resumen")}>Resumen</button>
        </div>
        <div className="treasury-modal-summary">
          <MiniKpiCard color="#4f7cff" label="Documentos por paga" value={item.docs || 0} />
          <MiniKpiCard color="#ffcc44" label="Monto por cobrar" value={fmtM(item.pending || 0)} />
          <MiniKpiCard color="var(--red)" label="Monto atrasado" value={fmtM(item.overdue || 0)} />
        </div>
        {tab === "documentos" ? <DetailTable columns={[{ key: "correlativo", label: "Número" }, { key: "fecha", label: "Emisión", render: row => row.fecha ? fmtD(row.fecha) : "—" }, { key: "fechaVencimiento", label: "Vencimiento", render: row => row.fechaVencimiento ? fmtD(row.fechaVencimiento) : "—" }, { key: "total", label: "Monto", render: row => <span className="treasury-mono">{fmtM(row.total)}</span> }, { key: "pending", label: "Monto a pagar", render: row => <span className={`treasury-mono ${pendingTone(row.pending, row.pending <= 0 ? "paid" : row.bucket === "Vencido" ? "overdue" : "pending")}`}>{fmtM(row.pending)}</span> }, { key: "cobranza", label: "Estado", render: row => <StatusBadge label={row.cobranza} /> }]} rows={item.documents || []} emptyText="Sin documentos asociados" /> : null}
        {tab === "ordenes" ? <DetailTable columns={[{ key: "number", label: "Número" }, { key: "issueDate", label: "Emisión", render: row => row.issueDate ? fmtD(row.issueDate) : "—" }, { key: "linkedInvoices", label: "Factura asociada", render: row => row.linkedInvoices?.length ? <div style={{ display:"grid", gap:4 }}>{row.linkedInvoices.map(invoice => <div key={invoice.id} style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}><span style={{ fontWeight:700 }}>{invoice.correlativo}</span><StatusBadge label={invoice.cobranza} /></div>)}</div> : <span className="treasury-muted">Sin factura asociada</span> }, { key: "billingStatus", label: "Estado flujo", render: row => <StatusBadge label={row.billingStatus} /> }, { key: "amount", label: "Monto", render: row => <span className="treasury-mono">{fmtM(row.amount)}</span> }, { key: "pendingAmount", label: "Pendiente OC", render: row => <span className={`treasury-mono ${pendingTone(row.pendingAmount, row.pendingAmount <= 0 ? "paid" : "pending")}`}>{fmtM(row.pendingAmount)}</span> }, { key: "edit", label: "", render: row => canManage && onEditOrder ? <GBtn sm onClick={() => onEditOrder(row)}>Asociar factura</GBtn> : null }]} rows={item.purchaseOrders || []} emptyText="Sin órdenes de compra registradas" /> : null}
        {tab === "resumen" ? <div className="treasury-detail"><div className="treasury-detail-grid"><div><div className="treasury-detail-title">Resumen financiero</div><div className="treasury-provider-meta" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}><div><div className="meta-label">Concentración</div><div className="meta-value">{Number(item.concentrationPct || 0).toFixed(1)}%</div></div><div><div className="meta-label">Límite crédito</div><div className="meta-value">{item.creditLimit ? fmtM(item.creditLimit) : "No definido"}</div></div><div><div className="meta-label">Cupo disponible</div><div className={`meta-value ${item.availableCredit != null && item.availableCredit < 0 ? "treasury-pending-overdue" : "treasury-pending-paid"}`}>{item.availableCredit == null ? "—" : fmtM(item.availableCredit)}</div></div><div><div className="meta-label">Monto vencido</div><div className={`meta-value ${item.overdue > 0 ? "treasury-pending-overdue" : "treasury-pending-idle"}`}>{fmtM(item.overdue || 0)}</div></div></div></div><div><div className="treasury-detail-title">Concentración de deuda</div><div className="treasury-progress" style={{ marginTop: 14 }}><div className="treasury-progress-fill" style={{ width: `${Math.max(6, Math.min(Number(item.concentrationPct || 0), 100))}%` }} /></div><div className="treasury-muted" style={{ marginTop: 10, fontSize: 12 }}>La barra representa qué porcentaje de la cartera total está concentrada en este cliente.</div></div></div></div> : null}
      </div>
    </Modal>
  );
}

function ProviderDetailModal({ open, provider, onClose, onSave }) {
  const [tab, setTab] = useState("documentos");
  const [draft, setDraft] = useState(null);

  React.useEffect(() => {
    if (!open) return;
    setDraft({
      id: provider?.id || makeId("prov"),
      empId: provider?.empId || "",
      name: provider?.name || "",
      razonSocial: provider?.razonSocial || "",
      rut: provider?.rut || "",
      direccion: provider?.direccion || "",
      tipoProveedor: provider?.tipoProveedor || "",
      contactos: Array.isArray(provider?.contactos) ? provider.contactos : [],
      bankAccounts: Array.isArray(provider?.bankAccounts) ? provider.bankAccounts : [],
    });
    setTab("documentos");
  }, [open, provider]);

  if (!provider || !draft) return null;

  const updateContact = (id, field, value) => setDraft(current => ({
    ...current,
    contactos: (current.contactos || []).map(item => item.id === id ? { ...item, [field]: value } : item),
  }));
  const updateBank = (id, field, value) => setDraft(current => ({
    ...current,
    bankAccounts: (current.bankAccounts || []).map(item => item.id === id ? { ...item, [field]: value } : item),
  }));
  const addContact = () => setDraft(current => ({
    ...current,
    contactos: [...(current.contactos || []), { id: makeId("contact"), nombre: "", cargo: "", email: "", telefono: "" }],
  }));
  const addBank = () => setDraft(current => ({
    ...current,
    bankAccounts: [...(current.bankAccounts || []), { id: makeId("bank"), banco: "", titular: "", rut: "", tipoCuenta: "", numeroCuenta: "", emailPago: "" }],
  }));
  const removeContact = id => setDraft(current => ({ ...current, contactos: (current.contactos || []).filter(item => item.id !== id) }));
  const removeBank = id => setDraft(current => ({ ...current, bankAccounts: (current.bankAccounts || []).filter(item => item.id !== id) }));
  const submit = async () => {
    await onSave?.({
      ...provider,
      ...draft,
      name: draft.name || draft.razonSocial || provider.name,
    });
    onClose?.();
  };

  return (
    <Modal open={open} onClose={onClose} title="" sub="" wide>
      <div className="treasury-modal-shell">
        <div className="treasury-profile">
          <div className="treasury-avatar" style={{ width: 58, height: 58, fontSize: 18 }}>{getInitials(draft.name || provider.name)}</div>
          <div style={{ flex: 1 }}>
            <div className="treasury-profile-title">{draft.name || provider.name}</div>
            <div className="treasury-profile-sub">Vista consolidada del proveedor, sus documentos pendientes y su ficha administrativa.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <GBtn onClick={onClose}>Cerrar</GBtn>
            <GBtn onClick={submit}>Guardar</GBtn>
          </div>
        </div>
        <div className="treasury-modal-tabs">
          <button className={`treasury-modal-tab ${tab === "documentos" ? "active" : ""}`} onClick={() => setTab("documentos")}>Documentos</button>
          <button className={`treasury-modal-tab ${tab === "datos" ? "active" : ""}`} onClick={() => setTab("datos")}>Datos del proveedor</button>
          <button className={`treasury-modal-tab ${tab === "pagos" ? "active" : ""}`} onClick={() => setTab("pagos")}>Información de pago</button>
        </div>
        <div className="treasury-modal-summary">
          <MiniKpiCard color="#4f7cff" label="Documentos por pagar" value={provider.payables.length} />
          <MiniKpiCard color="#ffcc44" label="Monto por pagar" value={fmtM(provider.pending)} />
          <MiniKpiCard color="var(--red)" label="Monto atrasado" value={fmtM(provider.payables.filter(item => item.status === "Vencida").reduce((acc, item) => acc + Number(item.pending || 0), 0))} />
        </div>
        {tab === "documentos" ? (
          <DetailTable
            columns={[
              { key: "folio", label: "Número" },
              { key: "issueDate", label: "Emisión", render: row => row.issueDate ? fmtD(row.issueDate) : "—" },
              { key: "dueDate", label: "Vencimiento", render: row => row.dueDate ? fmtD(row.dueDate) : "—" },
              { key: "total", label: "Monto", render: row => <span className="treasury-mono">{fmtM(row.total)}</span> },
              { key: "pending", label: "Monto a pagar", render: row => <span className={`treasury-mono ${pendingTone(row.pending, row.pending <= 0 ? "paid" : row.status === "Vencida" ? "overdue" : "pending")}`}>{fmtM(row.pending)}</span> },
              { key: "status", label: "Estado", render: row => <StatusBadge label={row.status} /> },
            ]}
            rows={provider.payables}
            emptyText="Sin documentos para este proveedor"
          />
        ) : null}
        {tab === "datos" ? (
          <div className="treasury-detail">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
              <label><div className="treasury-section-sub">Nombre visible</div><input style={fieldInputStyle()} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
              <label><div className="treasury-section-sub">Razón social</div><input style={fieldInputStyle()} value={draft.razonSocial} onChange={e => setDraft({ ...draft, razonSocial: e.target.value })} /></label>
              <label><div className="treasury-section-sub">RUT</div><input style={fieldInputStyle()} value={draft.rut} onChange={e => setDraft({ ...draft, rut: e.target.value })} /></label>
              <label><div className="treasury-section-sub">Tipo de proveedor</div><input style={fieldInputStyle()} value={draft.tipoProveedor} onChange={e => setDraft({ ...draft, tipoProveedor: e.target.value })} /></label>
            </div>
            <label style={{ display: "block", marginTop: 12 }}><div className="treasury-section-sub">Dirección</div><input style={fieldInputStyle()} value={draft.direccion} onChange={e => setDraft({ ...draft, direccion: e.target.value })} /></label>
            <div className="treasury-section-head" style={{ marginTop: 18, marginBottom: 10 }}>
              <div><div className="treasury-detail-title">Contactos</div><div className="treasury-muted" style={{ fontSize: 12 }}>Puedes registrar más de un contacto por proveedor.</div></div>
              <GBtn sm onClick={addContact}>+ Agregar contacto</GBtn>
            </div>
            {(draft.contactos || []).length ? (draft.contactos || []).map(contact => (
              <div key={contact.id} style={{ border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12, marginBottom: 10, background: "rgba(255,255,255,.02)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
                  <input style={fieldInputStyle()} placeholder="Nombre" value={contact.nombre || ""} onChange={e => updateContact(contact.id, "nombre", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="Cargo" value={contact.cargo || ""} onChange={e => updateContact(contact.id, "cargo", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="Email" value={contact.email || ""} onChange={e => updateContact(contact.id, "email", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="Teléfono" value={contact.telefono || ""} onChange={e => updateContact(contact.id, "telefono", e.target.value)} />
                </div>
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}><DBtn sm onClick={() => removeContact(contact.id)}>Eliminar contacto</DBtn></div>
              </div>
            )) : <div className="treasury-muted" style={{ fontSize: 12 }}>Todavía no hay contactos para este proveedor.</div>}
          </div>
        ) : null}
        {tab === "pagos" ? (
          <div className="treasury-detail">
            <div className="treasury-section-head" style={{ marginBottom: 10 }}>
              <div><div className="treasury-detail-title">Datos bancarios</div><div className="treasury-muted" style={{ fontSize: 12 }}>Aquí dejas solo la información bancaria del proveedor. Puedes guardar más de una cuenta.</div></div>
              <GBtn sm onClick={addBank}>+ Agregar cuenta</GBtn>
            </div>
            {(draft.bankAccounts || []).length ? (draft.bankAccounts || []).map(account => (
              <div key={account.id} style={{ border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12, marginBottom: 10, background: "rgba(255,255,255,.02)" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
                  <input style={fieldInputStyle()} placeholder="Banco" value={account.banco || ""} onChange={e => updateBank(account.id, "banco", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="Titular" value={account.titular || ""} onChange={e => updateBank(account.id, "titular", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="RUT titular" value={account.rut || ""} onChange={e => updateBank(account.id, "rut", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="Tipo de cuenta" value={account.tipoCuenta || ""} onChange={e => updateBank(account.id, "tipoCuenta", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="Número de cuenta" value={account.numeroCuenta || ""} onChange={e => updateBank(account.id, "numeroCuenta", e.target.value)} />
                  <input style={fieldInputStyle()} placeholder="Email de pago" value={account.emailPago || ""} onChange={e => updateBank(account.id, "emailPago", e.target.value)} />
                </div>
                <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}><DBtn sm onClick={() => removeBank(account.id)}>Eliminar cuenta</DBtn></div>
              </div>
            )) : <div className="treasury-muted" style={{ fontSize: 12 }}>Todavía no hay cuentas bancarias registradas para este proveedor.</div>}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

export function TreasuryModule(props) {
  const [payablesTab, setPayablesTab] = useState("documentos");
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioItem, setPortfolioItem] = useState(null);
  const openPortfolioDetail = item => { setPortfolioItem(item); setPortfolioOpen(true); };
  const {
    tab, setTab, q, setQ, statusFilter, setStatusFilter, filteredReceivables, receivableSummary, portfolio,
    providers, payables, payablesSummary, purchaseOrders, purchaseOrderSummary, issuedOrders, issuedOrderSummary,
    receiptLog, disbursementLog, canManageTreasury, payableOpen, payableDraft, poOpen, poDraft, issuedOpen, issuedDraft,
    receiptOpen, receiptDraft, disbursementOpen, disbursementDraft, providerOpen, providerDraft, savePayable, deletePayable,
    savePurchaseOrder, deletePurchaseOrder, saveIssuedOrder, deleteIssuedOrder, saveReceipt, saveDisbursement,
    saveProvider, deleteProvider, openPayableCreate, openPayableEdit, openPurchaseOrderCreate, openPurchaseOrderEdit, openIssuedOrderCreate,
    openIssuedOrderEdit, openReceiptCreate, openDisbursementCreate, openReceiptEdit, openDisbursementEdit, openProviderCreate, openProviderEdit,
    deleteReceipt, deleteDisbursement, closePayable, closePurchaseOrder, closeIssuedOrder, closeReceipt, closeDisbursement, closeProvider,
  } = useLabTreasuryModule(props);
  const { clientes = [], facturas = [] } = props;
  const saveFacturaDoc = props.saveFacturaDoc;
  const {
    sendBillingEmail,
    sendBillingWhatsApp,
    sendStatementEmail,
    sendStatementWhatsApp,
  } = useLabBillingTools({
    allDocs: (facturas || []).filter(item => item.empId === props.empresa?.id),
    movimientos: props.movimientos || [],
    setFacturas: props.setFacturas || (() => {}),
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
  });
  const receivableTable = useTableState(filteredReceivables, { searchFields: [row => row.correlativo, row => row.entidad], statusOptions: ["Pendiente de pago", "Retrasado de pago", "Pagado", "Por vencer", "Vencido"], getStatus: row => row.bucket === "Vencido" ? "Vencido" : row.cobranza });
  const portfolioTable = useTableState(portfolio, { searchFields: [row => row.entidad], getId: row => row.entidadId, pageSize: 6 });
  const poTable = useTableState(purchaseOrders, { searchFields: [row => row.clientName, row => row.number], statusOptions: ["Pendiente", "Facturada", "Completada", "Sin facturar", "Facturado parcial", "Facturado y pagado"], getStatus: row => row.billingStatus, pageSize: 6 });
  const receiptTable = useTableState(receiptLog, { searchFields: [row => row.targetLabel, row => row.reference, row => row.method], pageSize: 6 });
  const payableTable = useTableState(payables, { searchFields: [row => row.supplier, row => row.folio], statusOptions: ["Pendiente", "Parcial", "Pagada", "Vencida"], getStatus: row => row.status, pageSize: 6 });
  const issuedTable = useTableState(issuedOrders, { searchFields: [row => row.supplier, row => row.number], pageSize: 6 });
  const disbursementTable = useTableState(disbursementLog, { searchFields: [row => row.targetLabel, row => row.reference, row => row.method], pageSize: 6 });
  const providerTable = useTableState(providers, { searchFields: [row => row.name, row => row.razonSocial, row => row.rut], pageSize: 6 });

  const deleteMany = async (ids = [], deleter) => {
    if (!ids.length || !deleter) return;
    if (!confirm(`¿Eliminar ${ids.length} registro${ids.length === 1 ? "" : "s"} seleccionado${ids.length === 1 ? "" : "s"}?`)) return;
    for (const id of ids) {
      // Keep sequential writes so the current store setters stay consistent.
      // This is slower than batching, but safer with the current module contract.
      // eslint-disable-next-line no-await-in-loop
      await deleter(id);
    }
  };

  return (
    <div className="treasury-shell">
      <TreasuryStyles />
      <ModuleHeader
        module="Tesorería"
        title="Tesorería"
        description="Controla la cartera, revisa concentración de deuda, gestiona la cobranza operativa, concilia órdenes de compra con facturas y registra pagos manuales recibidos o realizados."
      />
      <div className="treasury-kpis">
        <KpiCard color="var(--cy)" label="Cartera total" value={fmtM(receivableSummary.total)} />
        <KpiCard color="#ffcc44" label="Pendiente" value={fmtM(receivableSummary.pending)} />
        <KpiCard color="var(--red)" label="Vencido" value={fmtM(receivableSummary.overdue)} sub={`${receivableSummary.overdueDocs} docs con atraso`} />
        <KpiCard color="#a78bfa" label="Egresos" value={fmtM(payablesSummary.total)} sub={`${payablesSummary.docs} documentos registrados`} />
      </div>
      <div className="treasury-tabs">
        <button className={`treasury-tab ${tab === 0 ? "active" : ""}`} onClick={() => setTab(0)}>Cuentas por Cobrar</button>
        <button className={`treasury-tab ${tab === 1 ? "active" : ""}`} onClick={() => setTab(1)}>Cuentas por Pagar</button>
      </div>
      {tab === 0 ? (
        <>
          <SectionCard title="Cuentas por Cobrar" subtitle="Gestiona documentos, cobranza, pagos manuales y estado real del cobro desde una sola vista">
            <TableToolbar
              searchValue={receivableTable.query}
              onSearchChange={receivableTable.setQuery}
              searchPlaceholder="Buscar documento o cliente..."
              statusValue={receivableTable.status}
              onStatusChange={receivableTable.setStatus}
              statusOptions={receivableTable.statusOptions}
              selectedCount={receivableTable.selectedIds.length}
              onDeleteSelected={null}
              onClearSelection={receivableTable.clearSelection}
              canManage={false}
            />
            <ReceivablesTable rows={receivableTable.pageRows} onAddPayment={canManageTreasury ? openReceiptCreate : () => {}} onUpdateCobranza={canManageTreasury && saveFacturaDoc ? (row, nextState) => saveFacturaDoc({ ...((facturas || []).find(doc => doc.id === row.id) || row), cobranzaEstado: nextState, fechaPago: nextState === "Pagado" ? (((facturas || []).find(doc => doc.id === row.id) || row).fechaPago || new Date().toISOString().slice(0,10)) : "" }) : null} onBillingEmail={row => { const doc = (facturas || []).find(item => item.id === row.id); const entity = doc?.tipo === "auspiciador" ? (props.auspiciadores || []).find(item => item.id === doc.entidadId) : (props.clientes || []).find(item => item.id === doc?.entidadId); if (doc) sendBillingEmail(doc, entity); }} onBillingWhatsApp={row => { const doc = (facturas || []).find(item => item.id === row.id); const entity = doc?.tipo === "auspiciador" ? (props.auspiciadores || []).find(item => item.id === doc.entidadId) : (props.clientes || []).find(item => item.id === doc?.entidadId); if (doc) sendBillingWhatsApp(doc, entity); }} onStatementEmail={row => { const doc = (facturas || []).find(item => item.id === row.id); if (!doc) return; const entity = doc.tipo === "auspiciador" ? (props.auspiciadores || []).find(item => item.id === doc.entidadId) : (props.clientes || []).find(item => item.id === doc.entidadId); const entityDocs = (facturas || []).filter(item => item.empId === props.empresa?.id && item.tipo === doc.tipo && item.entidadId === doc.entidadId); sendStatementEmail(entityDocs, entity, doc.tipo); }} onStatementWhatsApp={row => { const doc = (facturas || []).find(item => item.id === row.id); if (!doc) return; const entity = doc.tipo === "auspiciador" ? (props.auspiciadores || []).find(item => item.id === doc.entidadId) : (props.clientes || []).find(item => item.id === doc.entidadId); const entityDocs = (facturas || []).filter(item => item.empId === props.empresa?.id && item.tipo === doc.tipo && item.entidadId === doc.entidadId); sendStatementWhatsApp(entityDocs, entity, doc.tipo); }} canManage={canManageTreasury} selectedIds={receivableTable.selectedIds} toggleSelected={receivableTable.toggleSelected} toggleAll={receivableTable.toggleAll} pageIds={receivableTable.pageIds} />
            <Paginator page={receivableTable.page} total={receivableTable.filteredRows.length} perPage={receivableTable.pageSize} onChange={receivableTable.setPage} />
          </SectionCard>
          <SectionCard title="Cartera por Cliente" subtitle="Ahora el detalle abre en un modal independiente para revisar deuda, concentración y documentos" emphasis>
            <TableToolbar searchValue={portfolioTable.query} onSearchChange={portfolioTable.setQuery} searchPlaceholder="Buscar cliente..." selectedCount={portfolioTable.selectedIds.length} onClearSelection={portfolioTable.clearSelection} />
            <PortfolioTable rows={portfolioTable.pageRows} onOpen={openPortfolioDetail} selectedIds={portfolioTable.selectedIds} toggleSelected={portfolioTable.toggleSelected} toggleAll={portfolioTable.toggleAll} pageIds={portfolioTable.pageIds} />
            <Paginator page={portfolioTable.page} total={portfolioTable.filteredRows.length} perPage={portfolioTable.pageSize} onChange={portfolioTable.setPage} />
          </SectionCard>
          <SectionCard title="Órdenes de Compra Recibidas" subtitle="Aquí ves si la OC fue facturada, qué factura quedó ligada y si esa factura ya fue pagada" action={canManageTreasury ? <GBtn onClick={openPurchaseOrderCreate}>+ Nueva OC</GBtn> : null} withTopBorder>
            <div className="treasury-compact-grid">
              <MiniKpiCard color="var(--cy)" label="OC recibidas" value={purchaseOrderSummary.docs} />
              <MiniKpiCard color="#00e08a" label="Monto OC" value={fmtM(purchaseOrderSummary.total)} />
              <MiniKpiCard color="#ffcc44" label="Pendiente Match ⚠" value={fmtM(purchaseOrderSummary.pending)} />
            </div>
            <TableToolbar
              searchValue={poTable.query}
              onSearchChange={poTable.setQuery}
              searchPlaceholder="Buscar OC o cliente..."
              statusValue={poTable.status}
              onStatusChange={poTable.setStatus}
              statusOptions={poTable.statusOptions}
              selectedCount={poTable.selectedIds.length}
              onDeleteSelected={canManageTreasury ? async () => { await deleteMany(poTable.selectedIds, deletePurchaseOrder); poTable.clearSelection(); } : null}
              onClearSelection={poTable.clearSelection}
              canManage={canManageTreasury}
            />
            <PurchaseOrdersTable rows={poTable.pageRows} onEdit={canManageTreasury ? openPurchaseOrderEdit : () => {}} onDelete={canManageTreasury ? deletePurchaseOrder : () => {}} selectedIds={poTable.selectedIds} toggleSelected={poTable.toggleSelected} toggleAll={poTable.toggleAll} pageIds={poTable.pageIds} />
            <Paginator page={poTable.page} total={poTable.filteredRows.length} perPage={poTable.pageSize} onChange={poTable.setPage} />
          </SectionCard>
          <SectionCard title="Pagos recibidos" subtitle="Registro manual y editable de pagos efectivos en cuentas por cobrar">
            <TableToolbar searchValue={receiptTable.query} onSearchChange={receiptTable.setQuery} searchPlaceholder="Buscar pago, referencia o método..." selectedCount={receiptTable.selectedIds.length} onDeleteSelected={canManageTreasury ? async () => { await deleteMany(receiptTable.selectedIds, deleteReceipt); receiptTable.clearSelection(); } : null} onClearSelection={receiptTable.clearSelection} canManage={canManageTreasury} />
            <PaymentLogTable rows={receiptTable.pageRows} emptyText="Sin pagos recibidos registrados" targetLabel="Documento" onEdit={canManageTreasury ? openReceiptEdit : null} onDelete={canManageTreasury ? deleteReceipt : null} selectedIds={receiptTable.selectedIds} toggleSelected={receiptTable.toggleSelected} toggleAll={receiptTable.toggleAll} pageIds={receiptTable.pageIds} />
            <Paginator page={receiptTable.page} total={receiptTable.filteredRows.length} perPage={receiptTable.pageSize} onChange={receiptTable.setPage} />
          </SectionCard>
          <TreasuryPurchaseOrderModal open={poOpen} data={poDraft} clientes={clientes} facturas={facturas} onClose={closePurchaseOrder} onSave={savePurchaseOrder} />
          <TreasuryPaymentModal open={receiptOpen} title="Registrar pago recibido" subtitle="Asocia el pago al documento de cuentas por cobrar" data={receiptDraft} onClose={closeReceipt} onSave={saveReceipt} />
        </>
      ) : (
        <>
          <SectionCard title="Cuentas por Pagar" subtitle="Gestiona tus deudas, tus proveedores y los pagos realizados en un mismo contexto">
            <div className="treasury-subtabs">
              <button className={`treasury-subtab ${payablesTab === "documentos" ? "active" : ""}`} onClick={() => setPayablesTab("documentos")}>Documentos</button>
              <button className={`treasury-subtab ${payablesTab === "proveedores" ? "active" : ""}`} onClick={() => setPayablesTab("proveedores")}>Proveedores</button>
            </div>
            {payablesTab === "documentos" ? (
              <>
                <div className="treasury-compact-grid">
                  <MiniKpiCard color="#a78bfa" label="Documentos" value={payablesSummary.docs} />
                  <MiniKpiCard color="#ffcc44" label="Pendiente" value={fmtM(payablesSummary.pending)} />
                  <MiniKpiCard color="var(--red)" label="Vencido" value={fmtM(payablesSummary.overdue)} />
                </div>
                <TableToolbar
                  searchValue={payableTable.query}
                  onSearchChange={payableTable.setQuery}
                  searchPlaceholder="Buscar proveedor o documento..."
                  statusValue={payableTable.status}
                  onStatusChange={payableTable.setStatus}
                  statusOptions={payableTable.statusOptions}
                  selectedCount={payableTable.selectedIds.length}
                  onDeleteSelected={canManageTreasury ? async () => { await deleteMany(payableTable.selectedIds, deletePayable); payableTable.clearSelection(); } : null}
                  onClearSelection={payableTable.clearSelection}
                  createAction={canManageTreasury ? <GBtn onClick={openPayableCreate}>+ Nuevo documento</GBtn> : null}
                  canManage={canManageTreasury}
                />
                <PayablesTable rows={payableTable.pageRows} onAddPayment={canManageTreasury ? openDisbursementCreate : () => {}} onEdit={canManageTreasury ? openPayableEdit : () => {}} onDelete={canManageTreasury ? deletePayable : () => {}} selectedIds={payableTable.selectedIds} toggleSelected={payableTable.toggleSelected} toggleAll={payableTable.toggleAll} pageIds={payableTable.pageIds} />
                <Paginator page={payableTable.page} total={payableTable.filteredRows.length} perPage={payableTable.pageSize} onChange={payableTable.setPage} />
              </>
            ) : (
              <ProvidersPanel providers={providers} pageRows={providerTable.pageRows} totalRows={providerTable.filteredRows.length} query={providerTable.query} setQuery={providerTable.setQuery} page={providerTable.page} setPage={providerTable.setPage} pageSize={providerTable.pageSize} onOpen={canManageTreasury ? openProviderEdit : () => {}} onCreate={canManageTreasury ? openProviderCreate : () => {}} onDelete={canManageTreasury ? async () => { await deleteMany(providerTable.selectedIds, deleteProvider); providerTable.clearSelection(); } : null} canManage={canManageTreasury} selectedIds={providerTable.selectedIds} toggleSelected={providerTable.toggleSelected} toggleAll={providerTable.toggleAll} pageIds={providerTable.pageIds} />
            )}
          </SectionCard>
          <SectionCard title="Órdenes de Compra Emitidas" subtitle="Trazabilidad de OC emitidas a proveedores" action={canManageTreasury ? <GBtn onClick={openIssuedOrderCreate}>+ Nueva OC emitida</GBtn> : null} withTopBorder>
            <div className="treasury-compact-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
              <MiniKpiCard color="var(--cy)" label="OC emitidas" value={issuedOrderSummary.docs} />
              <MiniKpiCard color="#00e08a" label="Monto emitido" value={fmtM(issuedOrderSummary.total)} />
            </div>
            <TableToolbar searchValue={issuedTable.query} onSearchChange={issuedTable.setQuery} searchPlaceholder="Buscar OC emitida o proveedor..." selectedCount={issuedTable.selectedIds.length} onDeleteSelected={canManageTreasury ? async () => { await deleteMany(issuedTable.selectedIds, deleteIssuedOrder); issuedTable.clearSelection(); } : null} onClearSelection={issuedTable.clearSelection} canManage={canManageTreasury} />
            <IssuedOrdersTable rows={issuedTable.pageRows} onEdit={canManageTreasury ? openIssuedOrderEdit : () => {}} onDelete={canManageTreasury ? deleteIssuedOrder : () => {}} selectedIds={issuedTable.selectedIds} toggleSelected={issuedTable.toggleSelected} toggleAll={issuedTable.toggleAll} pageIds={issuedTable.pageIds} />
            <Paginator page={issuedTable.page} total={issuedTable.filteredRows.length} perPage={issuedTable.pageSize} onChange={issuedTable.setPage} />
          </SectionCard>
          <SectionCard title="Pagos realizados" subtitle="Registro manual, editable y trazable de egresos y abonos hechos a proveedores">
            <TableToolbar searchValue={disbursementTable.query} onSearchChange={disbursementTable.setQuery} searchPlaceholder="Buscar pago, referencia o método..." selectedCount={disbursementTable.selectedIds.length} onDeleteSelected={canManageTreasury ? async () => { await deleteMany(disbursementTable.selectedIds, deleteDisbursement); disbursementTable.clearSelection(); } : null} onClearSelection={disbursementTable.clearSelection} canManage={canManageTreasury} />
            <PaymentLogTable rows={disbursementTable.pageRows} emptyText="Sin pagos realizados registrados" targetLabel="Cuenta" onEdit={canManageTreasury ? openDisbursementEdit : null} onDelete={canManageTreasury ? deleteDisbursement : null} selectedIds={disbursementTable.selectedIds} toggleSelected={disbursementTable.toggleSelected} toggleAll={disbursementTable.toggleAll} pageIds={disbursementTable.pageIds} />
            <Paginator page={disbursementTable.page} total={disbursementTable.filteredRows.length} perPage={disbursementTable.pageSize} onChange={disbursementTable.setPage} />
          </SectionCard>
          <TreasuryPayableModal open={payableOpen} data={payableDraft} onClose={closePayable} onSave={savePayable} />
          <TreasuryIssuedOrderModal open={issuedOpen} data={issuedDraft} onClose={closeIssuedOrder} onSave={saveIssuedOrder} />
          <TreasuryPaymentModal open={disbursementOpen} title="Registrar pago realizado" subtitle="Asocia el pago a la cuenta por pagar correspondiente" data={disbursementDraft} onClose={closeDisbursement} onSave={saveDisbursement} />
        </>
      )}
      <PortfolioDetailModal open={portfolioOpen} item={portfolioItem} onClose={() => setPortfolioOpen(false)} onEditOrder={canManageTreasury ? row => { setPortfolioOpen(false); openPurchaseOrderEdit(row); } : null} canManage={canManageTreasury} />
      <ProviderDetailModal open={providerOpen} provider={providerDraft} onClose={closeProvider} onSave={saveProvider} />
    </div>
  );
}
