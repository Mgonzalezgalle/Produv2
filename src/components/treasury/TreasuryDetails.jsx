import React, { useState } from "react";
import { DBtn, GBtn, Paginator, SearchBar, ViewModeToggle } from "../../lib/ui/components";
import { fmtM } from "../../lib/utils/helpers";
import { EmptyInsideCard, getInitials, pendingTone, StatusBadge } from "./TreasuryShared";

export function ProvidersPanel({
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
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} />Proveedor</div><div>Documentos</div><div>OC emitidas</div><div>Cartera Proveedor</div><div>Pendiente</div><div></div>
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
