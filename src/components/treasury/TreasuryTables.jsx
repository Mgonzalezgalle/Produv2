import React, { useState } from "react";
import { DBtn, FilterSel, GBtn, SearchBar } from "../../lib/ui/components";
import { fmtD, fmtM } from "../../lib/utils/helpers";
import { ContactActionButton, DetailTable, EmptyInsideCard, pendingTone, StatusBadge } from "./TreasuryShared";

export function TableToolbar({
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

export function PortfolioTable({ rows = [], onOpen, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
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

function hasMercadoPagoData(row = {}) {
  const mercadoPago = row?.mercadoPago || {};
  return Boolean(
    String(mercadoPago.initPoint || "").trim() ||
    String(mercadoPago.preferenceId || "").trim() ||
    String(mercadoPago.externalReference || "").trim() ||
    String(mercadoPago.status || "").trim() ||
    (Array.isArray(mercadoPago.history) && mercadoPago.history.length)
  );
}

function canReviewMercadoPagoPayment(row = {}) {
  const mercadoPago = row?.mercadoPago || {};
  return Boolean(
    String(mercadoPago.preferenceId || "").trim() ||
    String(mercadoPago.externalReference || "").trim() ||
    String(mercadoPago.lastPaymentId || "").trim()
  );
}

export function ReceivablesTable({ rows = [], onAddPayment, onUpdateCobranza, onBillingEmail, onPaymentLinkEmail, onBillingWhatsApp, onPaymentLinkWhatsApp, onStatementEmail, onStatementWhatsApp, onGeneratePaymentLink, onCopyPaymentLink, onRefreshPaymentLink, canManage = false, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  const [openId, setOpenId] = useState("");
  const [actionGroupByRow, setActionGroupByRow] = useState({});
  if (!rows.length) return <EmptyInsideCard text="Sin cuentas por cobrar" sub="Emite facturas para comenzar a visualizar la cartera." />;
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} disabled={!pageIds.length} /></th><th>Documento</th><th>Entidad</th><th>Emisión</th><th>Vencimiento</th><th>Cobranza</th><th>Total</th><th>Pendiente</th><th></th></tr></thead>
        <tbody>
          {rows.map(row => {
            const open = openId === row.id;
            const pendingMode = row.cobranza === "Pagado" ? "paid" : row.bucket === "Vencido" ? "overdue" : "pending";
            const canRegisterPayment = canManage && onAddPayment && row.allowsManualReceipts !== false;
            const canEditCollection = canManage && onUpdateCobranza && row.collectionEditable !== false;
            const canSelectRow = row.allowsManualReceipts !== false || row.collectionEditable !== false;
          return (
              <React.Fragment key={row.id}>
                <tr>
                  <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} disabled={!canSelectRow} title={canSelectRow ? "Seleccionar documento" : "Documento no operable para acciones de cobranza"} /></td>
                  <td><div style={{ fontWeight: 700 }}>{row.correlativo}</div><div className="treasury-muted" style={{ fontSize: 11 }}>{row.tipoDoc || "Documento"}</div></td>
                  <td>{row.entidad}</td>
                  <td>{row.fechaEmision ? fmtD(row.fechaEmision) : "—"}</td>
                  <td>{row.fechaVencimiento ? fmtD(row.fechaVencimiento) : "—"}</td>
                  <td><StatusBadge label={row.cobranza} /></td>
                  <td className="treasury-mono">{fmtM(row.total)}</td>
                  <td className={`treasury-mono ${pendingTone(row.pending, pendingMode)}`}>{fmtM(row.pending)}</td>
                  <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>{canRegisterPayment ? <GBtn sm onClick={() => onAddPayment(row)}>Registrar pago</GBtn> : null}<GBtn sm onClick={() => setOpenId(open ? "" : row.id)}>{open ? "Ocultar" : "Ver detalle"}</GBtn></div></td>
                </tr>
                {open ? (
                  <tr>
                    <td colSpan={9} style={{ paddingTop: 0 }}>
                      <div className="treasury-detail">
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
                          <div>
                            <div className="treasury-detail-title">Gestion de cobranza</div>
                            <div className="treasury-muted" style={{ fontSize: 12 }}>
                              {row.isAdjustment ? "Este documento se comporta como ajuste financiero y no registra cobros manuales." : "Aqui se centraliza el seguimiento operativo del cobro para este documento."}
                            </div>
                          </div>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "grid", gap: 8, justifyItems: "start", paddingTop: 22 }}>
                              <div className="treasury-context-chips">
                                <span className="treasury-context-chip brand">{row.source || "Facturacion"}</span>
                                {row.sourceDetail ? <span className="treasury-context-chip soft">{row.sourceDetail}</span> : null}
                                {row.externalSync?.externalFolio ? <span className="treasury-context-chip soft">Folio {row.externalSync.externalFolio}</span> : null}
                                {row.mercadoPago?.status ? <span className="treasury-context-chip soft">MP {row.mercadoPago.status}</span> : null}
                              </div>
                            </div>
                            {canEditCollection ? (
                              <label style={{ minWidth: 220 }}>
                                <div className="treasury-section-sub" style={{ marginTop: 0, marginBottom: 6 }}>Estado de cobranza</div>
                                <select value={row.cobranza} onChange={e => onUpdateCobranza(row, e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--card)", color: "var(--wh)" }}>
                                  {collectionOptions(row.cobranza).map(option => <option key={option} value={option}>{option}</option>)}
                                </select>
                              </label>
                            ) : null}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                          {[
                            { key: "billing", label: "Cobranza", enabled: Boolean(onBillingWhatsApp || onBillingEmail) },
                            { key: "statement", label: "Estado de cta.", enabled: Boolean(onStatementEmail || onStatementWhatsApp) },
                            { key: "payment", label: "Pago online", enabled: Boolean(onPaymentLinkEmail || onGeneratePaymentLink || onCopyPaymentLink || onPaymentLinkWhatsApp || onRefreshPaymentLink) },
                          ].filter(item => item.enabled).map(item => (
                            <GBtn
                              key={item.key}
                              sm
                              onClick={() => setActionGroupByRow(current => ({
                                ...current,
                                [row.id]: current?.[row.id] === item.key ? "" : item.key,
                              }))}
                            >
                              {item.label}
                            </GBtn>
                          ))}
                        </div>

                        {actionGroupByRow?.[row.id] === "billing" ? (
                          <div style={{ display: "grid", gap: 8, marginBottom: 14, justifyItems: "start" }}>
                            {onBillingWhatsApp ? <ContactActionButton tone="wa" label="WhatsApp" onClick={() => onBillingWhatsApp(row)} /> : null}
                            {onBillingEmail ? <ContactActionButton tone="mail" label="Crear correo" onClick={() => onBillingEmail(row)} /> : null}
                          </div>
                        ) : null}

                        {actionGroupByRow?.[row.id] === "statement" ? (
                          <div style={{ display: "grid", gap: 8, marginBottom: 14, justifyItems: "start" }}>
                            {onStatementEmail ? <ContactActionButton tone="mail" label="Estado cta." onClick={() => onStatementEmail(row)} /> : null}
                            {onStatementWhatsApp ? <ContactActionButton tone="wa" label="Estado cta." onClick={() => onStatementWhatsApp(row)} /> : null}
                          </div>
                        ) : null}

                        {actionGroupByRow?.[row.id] === "payment" ? (
                          <div style={{ display: "grid", gap: 8, marginBottom: 14, justifyItems: "start" }}>
                            {onPaymentLinkEmail ? <ContactActionButton tone="mail" label="Enviar link por correo" onClick={() => onPaymentLinkEmail(row)} /> : null}
                            {hasMercadoPagoData(row) && onCopyPaymentLink ? (
                              <ContactActionButton
                                tone="pay"
                                label="Link de Pago"
                                onClick={() => onCopyPaymentLink(row)}
                              />
                            ) : null}
                            {onPaymentLinkWhatsApp ? <ContactActionButton tone="wa" label="Enviar link por WhatsApp" onClick={() => onPaymentLinkWhatsApp(row)} /> : null}
                            {canReviewMercadoPagoPayment(row) && onRefreshPaymentLink ? <ContactActionButton tone="pay" label="Revisar pago" onClick={() => onRefreshPaymentLink(row)} /> : null}
                          </div>
                        ) : null}

                        {hasMercadoPagoData(row) ? (
                          <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                            <div>
                              <div className="treasury-detail-title" style={{ marginBottom: 4 }}>Pago online</div>
                              <div className="treasury-muted" style={{ fontSize: 12 }}>
                                {row.mercadoPago?.status === "approved" ? "Pago aceptado correctamente." : "Pago todavia no aceptado."}
                              </div>
                            </div>
                            <StatusBadge label={row.mercadoPago?.status === "approved" ? "Aceptado" : "No aceptado"} />
                          </div>
                        ) : null}

                        <div className="treasury-detail-title">Historial de pagos</div>
                        <DetailTable
                          columns={[
                            { key: "date", label: "Fecha", render: item => item.date ? fmtD(item.date) : "—" },
                            { key: "method", label: "Metodo" },
                            { key: "reference", label: "Referencia" },
                            { key: "amount", label: "Monto", render: item => <span className="treasury-mono treasury-pending-paid">{fmtM(item.amount)}</span> },
                          ]}
                          rows={row.paymentHistory || []}
                          emptyText={row.isAdjustment ? "Los ajustes no registran pagos manuales en Tesoreria." : "Todavia no hay pagos manuales registrados para este documento"}
                        />
                      </div>
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PayablesTable({
  rows = [],
  providers = [],
  onEdit,
  onDelete,
  onAddPayment,
  onUpdatePayable,
  onSupplierEmail,
  onSupplierWhatsApp,
  canManage = false,
  selectedIds = [],
  toggleSelected,
  toggleAll,
  pageIds = [],
}) {
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
            const provider = (providers || []).find(item => item.name === row.supplier || item.id === row.providerId) || null;
            const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
            const supplierEmail = primaryContact?.email || primaryContact?.ema || provider?.email || "";
            const supplierPhone = primaryContact?.telefono || primaryContact?.tel || provider?.telefono || "";
            const canRegisterPayment = Number(row.pending || 0) > 0;
            return (
              <React.Fragment key={row.id}>
                <tr>
                  <td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td>
                  <td style={{ fontWeight: 700 }}>{row.supplier}</td>
                  <td><div style={{ fontWeight: 700 }}>{row.folio || "—"}</div><div className="treasury-muted" style={{ fontSize: 11 }}>{row.docType || "Documento"}</div></td>
                  <td>{row.dueDate ? fmtD(row.dueDate) : "—"}</td>
                  <td><StatusBadge label={row.status} /></td>
                  <td className="treasury-mono">{fmtM(row.total)}</td>
                  <td className="treasury-mono treasury-pending-paid">{fmtM(row.paid)}</td>
                  <td className={`treasury-mono ${pendingTone(row.pending, pendingMode)}`}>{fmtM(row.pending)}</td>
                  <td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>{canRegisterPayment ? <GBtn sm onClick={() => onAddPayment(row)}>Registrar pago</GBtn> : null}<GBtn sm onClick={() => onEdit(row)}>Editar</GBtn><DBtn sm onClick={() => onDelete(row.id)}>Eliminar</DBtn><GBtn sm onClick={() => setOpenId(open ? "" : row.id)}>{open ? "Ocultar" : "Ver detalle"}</GBtn></div></td>
                </tr>
                {open ? <tr><td colSpan={9} style={{ paddingTop: 0 }}><div className="treasury-detail"><div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start", flexWrap:"wrap", marginBottom:12 }}><div><div className="treasury-detail-title">Gestión de pago</div><div className="treasury-muted" style={{ fontSize:12 }}>Coordina desde aquí el pago comprometido del documento y el contacto con el proveedor.</div></div>{canManage && onUpdatePayable ? <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(180px,1fr))", gap:10, minWidth:"min(100%,420px)" }}><div><div className="treasury-section-sub" style={{ marginTop:0, marginBottom:6 }}>Estado del documento</div><div style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid var(--bdr2)", background:"var(--sur)", color:"var(--wh)", fontWeight:700 }}>{row.status || "Pendiente"}</div></div><label><div className="treasury-section-sub" style={{ marginTop:0, marginBottom:6 }}>Fecha estimada de pago</div><input type="date" value={row.paymentDate || ""} onChange={e => onUpdatePayable(row, { paymentDate: e.target.value })} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid var(--bdr2)", background:"var(--card)", color:"var(--wh)" }} /></label></div> : null}</div><div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:14 }}>{supplierEmail && onSupplierEmail ? <ContactActionButton tone="mail" label="Correo" onClick={() => onSupplierEmail(row)} /> : null}{supplierPhone && onSupplierWhatsApp ? <ContactActionButton tone="wa" label="WhatsApp" onClick={() => onSupplierWhatsApp(row)} /> : null}</div><div className="treasury-detail-title">Historial de pagos</div><DetailTable columns={[{ key: "date", label: "Fecha", render: item => item.date ? fmtD(item.date) : "—" }, { key: "method", label: "Método" }, { key: "reference", label: "Referencia" }, { key: "amount", label: "Monto", render: item => <span className="treasury-mono treasury-pending-paid">{fmtM(item.amount)}</span> }]} rows={row.paymentHistory || []} emptyText="Todavía no hay pagos manuales registrados para esta cuenta" /></div></td></tr> : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentLogTable({ rows = [], emptyText, targetLabel, counterpartyLabel = "Referencia", onEdit, onDelete, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
  if (!rows.length) return <EmptyInsideCard text={emptyText} sub="Cada registro queda trazado con fecha, monto, método y referencia." />;
  const showReceipt = rows.some(row => row?.receiptUrl);
  return (
    <div className="treasury-table-wrap">
      <table className="treasury-table">
        <thead><tr><th style={{ width: 36 }}><input type="checkbox" checked={pageIds.length > 0 && pageIds.every(id => selectedIds.includes(id))} onChange={e => toggleAll(e.target.checked)} /></th><th>Fecha</th><th>{targetLabel}</th><th>Método</th><th>{counterpartyLabel}</th>{showReceipt ? <th>Comprobante</th> : null}<th>Monto</th><th></th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.id}><td><input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelected(row.id)} /></td><td>{row.date ? fmtD(row.date) : "—"}</td><td>{row.targetLabel}</td><td>{row.method || "—"}</td><td>{row.counterpartyLabel || row.reference || "—"}</td>{showReceipt ? <td>{row.receiptUrl ? <a href={row.receiptUrl} target="_blank" rel="noreferrer" download={row.receiptName || true} style={{ color:"var(--cy)", textDecoration:"none", fontWeight:700 }}>{row.receiptName || "Ver archivo"}</a> : <span className="treasury-muted">—</span>}</td> : null}<td className="treasury-mono treasury-pending-paid">{fmtM(row.amount)}</td><td><div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>{onEdit ? <GBtn sm onClick={() => onEdit(row)}>Editar</GBtn> : null}{onDelete ? <DBtn sm onClick={() => onDelete(row.id)}>Eliminar</DBtn> : null}</div></td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function PurchaseOrdersTable({ rows = [], onEdit, onDelete, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
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

export function IssuedOrdersTable({ rows = [], onEdit, onDelete, selectedIds = [], toggleSelected, toggleAll, pageIds = [] }) {
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
