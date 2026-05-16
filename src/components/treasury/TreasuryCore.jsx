import React, { useEffect, useMemo, useState } from "react";

function sameSelection(a = [], b = []) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

export function TreasuryStyles() {
  return (
    <style>{`
      .treasury-shell{color:var(--wh)}
      .treasury-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:14px;margin-bottom:22px}
      .treasury-kpi{position:relative;border-radius:18px;border:1px solid var(--bdr);background:linear-gradient(180deg,#ffffff,var(--card2));box-shadow:0 16px 32px rgba(15,23,42,.08);padding:18px 18px 16px;overflow:hidden}
      .treasury-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;background:var(--kpi-color,var(--cy))}
      .treasury-kpi-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
      .treasury-kpi-label{color:var(--gr2);text-transform:uppercase;letter-spacing:1.5px;font-size:10px;font-weight:700}
      .treasury-kpi-scope{display:inline-flex;align-items:center;padding:4px 8px;border-radius:999px;border:1px solid var(--bdr2);background:var(--sur);color:var(--gr2);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;white-space:nowrap}
      .treasury-kpi-value{color:var(--wh);font-family:var(--fm);font-size:28px;line-height:1}
      .treasury-kpi-sub{margin-top:10px;color:var(--gr3);font-size:11px}
      .treasury-tabs,.treasury-subtabs,.treasury-modal-tabs{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .treasury-tabs{margin-bottom:18px}
      .treasury-tab,.treasury-subtab{appearance:none;border:1px solid var(--bdr2);background:#ffffff;color:var(--gr2);border-radius:999px;font-family:var(--fb);font-weight:700;cursor:pointer;transition:.15s ease;box-shadow:0 8px 20px rgba(15,23,42,.05)}
      .treasury-tab{padding:14px 22px 13px;font-size:14px}
      .treasury-subtab{padding:11px 16px;font-size:13px}
      .treasury-tab:hover,.treasury-subtab:hover{color:var(--gr3);border-color:var(--bdr2);transform:translateY(-1px)}
      .treasury-tab.active,.treasury-subtab.active{color:#ffffff!important;background:linear-gradient(180deg,var(--cy2),color-mix(in srgb,var(--cy2) 86%, #ffffff 14%))!important;border-color:rgba(43,109,246,.28)!important;box-shadow:0 12px 24px rgba(43,109,246,.18)!important}
      .treasury-section{border:1px solid var(--bdr);border-radius:20px;background:linear-gradient(180deg,#ffffff,var(--card2));box-shadow:0 16px 32px rgba(15,23,42,.08);padding:18px;margin-bottom:18px}
      .treasury-section.emphasis{border-left:3px solid var(--cy)}
      .treasury-section.with-top-border{border-top:1px solid var(--bdr2)}
      .treasury-section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px}
      .treasury-section-title{font-family:var(--fh);font-size:19px;font-weight:800;letter-spacing:.4px;color:var(--wh)}
      .treasury-section-sub{color:var(--gr2);font-size:12px;line-height:1.6;margin-top:3px}
      .treasury-table-wrap{overflow-x:auto}
      .treasury-table{width:100%;border-collapse:separate;border-spacing:0}
      .treasury-table thead th{text-align:left;padding:13px 12px;background:linear-gradient(180deg,#f8fbff,rgba(255,255,255,.98));text-transform:uppercase;font-size:10px;letter-spacing:1.7px;color:var(--gr2);border-bottom:1px solid var(--bdr);white-space:nowrap}
      .treasury-table tbody tr{transition:background .15s ease}
      .treasury-table tbody tr:hover{background:var(--sur)}
      .treasury-table tbody td{padding:12px 12px;border-bottom:1px solid var(--bdr);color:var(--wh);font-size:13px;vertical-align:top;background:#ffffff}
      .treasury-table tbody tr:last-child td{border-bottom:0}
      .treasury-mono{font-family:var(--fm)}
      .treasury-muted{color:var(--gr3)}
      .treasury-pending-paid{color:#00e08a}
      .treasury-pending-alert{color:#ffcc44}
      .treasury-pending-overdue{color:#ff5566}
      .treasury-pending-idle{color:var(--gr2)}
      .treasury-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.4px;border:1px solid var(--badge-border,var(--bdr2));background:var(--badge-bg,var(--card2));color:var(--badge-color,var(--wh));white-space:nowrap}
      .treasury-context-chips{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
      .treasury-context-chip{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 12px;border-radius:999px;border:1px solid var(--chip-border,var(--bdr2));background:var(--chip-bg,var(--card));color:var(--chip-color,var(--wh));font-size:12px;font-weight:700;letter-spacing:.2px}
      .treasury-context-chip.soft{--chip-bg:rgba(244,246,250,.78);--chip-border:rgba(203,213,225,.9);--chip-color:#475569}
      .treasury-context-chip.brand{--chip-bg:rgba(168,139,250,.12);--chip-border:rgba(196,181,253,.75);--chip-color:#9b87f5}
      .treasury-detail{margin-top:8px;border-radius:14px;border:1px solid var(--bdr2);background:var(--sur);padding:14px;transition:.15s ease}
      .treasury-detail-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:14px}
      .treasury-detail-title{font-size:12px;font-weight:700;color:var(--wh);margin-bottom:8px}
      .treasury-concentration{display:flex;flex-direction:column;gap:7px}
      .treasury-progress{height:8px;border-radius:999px;background:var(--bdr2);overflow:hidden}
      .treasury-progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--cy),#35e7f7)}
      .treasury-compact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:12px;margin-bottom:16px}
      .treasury-mini-kpi{position:relative;border-radius:16px;border:1px solid var(--bdr);background:linear-gradient(180deg,#ffffff,var(--card2));padding:15px 16px 14px;overflow:hidden}
      .treasury-mini-kpi::before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:var(--mini-color,var(--cy))}
      .treasury-mini-kpi .label{color:var(--gr2);text-transform:uppercase;letter-spacing:1.4px;font-size:10px;font-weight:700;margin-bottom:10px}
      .treasury-mini-kpi .value{font-family:var(--fm);font-size:22px;color:var(--wh)}
      .treasury-provider-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:14px}
      .treasury-provider-card{border:1px solid var(--bdr);border-radius:16px;background:linear-gradient(180deg,#ffffff,var(--card2));padding:20px;cursor:pointer;transition:.15s ease;box-shadow:0 12px 28px rgba(15,23,42,.06)}
      .treasury-provider-card:hover{transform:translateY(-2px);border-color:rgba(43,109,246,.22)}
      .treasury-avatar{width:46px;height:46px;border-radius:12px;background:rgba(43,109,246,.08);border:1px solid rgba(43,109,246,.2);display:flex;align-items:center;justify-content:center;font-family:var(--fh);font-size:15px;font-weight:800;color:var(--cy2);flex-shrink:0}
      .treasury-provider-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr));gap:10px;margin-top:12px}
      .treasury-provider-meta .meta-label{color:var(--gr2);text-transform:uppercase;letter-spacing:1.2px;font-size:10px;margin-bottom:6px}
      .treasury-provider-meta .meta-value{color:var(--wh);font-family:var(--fm);font-size:13px}
      .treasury-toolbar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:16px}
      .treasury-list{border:1px solid var(--bdr);border-radius:16px;overflow:hidden;background:linear-gradient(180deg,#ffffff,var(--card2))}
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
      .treasury-modal-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr));gap:14px}
      body.light .treasury-tab,
      body.light .treasury-subtab,
      body.light .treasury-section,
      body.light .treasury-provider-card,
      body.light .treasury-mini-kpi,
      body.light .treasury-list{
        box-shadow:0 12px 28px rgba(148,163,184,.12);
      }
      body.light .treasury-tab,
      body.light .treasury-subtab{
        background:#ffffff;
        border-color:#d7dee8;
        color:var(--gr2);
      }
      body.light .treasury-tab.active,
      body.light .treasury-subtab.active{
        color:#ffffff!important;
        background:linear-gradient(180deg,var(--cy2),color-mix(in srgb,var(--cy2) 86%, #ffffff 14%))!important;
      }
      body.light .treasury-section,
      body.light .treasury-provider-card,
      body.light .treasury-mini-kpi,
      body.light .treasury-list{
        background:linear-gradient(180deg,#ffffff 0%, #f8fbff 100%);
      }
      body.light .treasury-table thead th,
      body.light .treasury-list-head{
        background:linear-gradient(180deg,#f1f5f9 0%, rgba(241,245,249,.35) 100%);
      }
      @media (max-width: 1100px){
        .treasury-kpis,.treasury-compact-grid,.treasury-provider-grid,.treasury-detail-grid,.treasury-modal-summary{grid-template-columns:1fr}
        .treasury-list-row{grid-template-columns:1fr;gap:8px}
      }
    `}</style>
  );
}

export function SectionCard({ title, subtitle, action, children, emphasis = false, withTopBorder = false }) {
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

export function KpiCard({ color, label, value, sub, scope }) {
  return (
    <div className="treasury-kpi" style={{ "--kpi-color": color }}>
      <div className="treasury-kpi-head">
        <div className="treasury-kpi-label">{label}</div>
        {scope ? <div className="treasury-kpi-scope" title={scope === "CxC" ? "Cuentas por Cobrar" : "Cuentas por Pagar"}>{scope}</div> : null}
      </div>
      <div className="treasury-kpi-value">{value}</div>
      {sub ? <div className="treasury-kpi-sub">{sub}</div> : null}
    </div>
  );
}

export function useTableState(rows = [], { searchFields = [], statusOptions = [], getStatus = null, getId = row => row?.id, isSelectable = () => true, pageSize = 8 } = {}) {
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
  const pageIds = useMemo(() => pageRows.filter(row => isSelectable(row)).map(row => getId(row)).filter(Boolean), [pageRows, getId, isSelectable]);
  useEffect(() => {
    setPage(1);
  }, [query, status]);
  useEffect(() => {
    setSelectedIds(prev => {
      const next = prev.filter(id => filteredRows.some(row => getId(row) === id && isSelectable(row)));
      return sameSelection(prev, next) ? prev : next;
    });
    const maxPage = Math.max(1, Math.ceil(filteredRows.length / pageSize));
    if (page > maxPage) setPage(maxPage);
  }, [filteredRows, page, pageSize, getId, isSelectable]);
  const toggleSelected = id => {
    const row = filteredRows.find(item => getId(item) === id);
    if (!row || !isSelectable(row)) return;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
  };
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

export function deriveProviders(payables = [], issuedOrders = []) {
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
