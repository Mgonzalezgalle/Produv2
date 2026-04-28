import React, { useState } from "react";
import { DBtn, GBtn, Modal } from "../../lib/ui/components";
import { fmtD, fmtM } from "../../lib/utils/helpers";
import {
  ContactActionButton,
  DetailTable,
  fieldInputStyle,
  getInitials,
  makeId,
  MiniKpiCard,
  pendingTone,
  StatusBadge,
} from "./TreasuryShared";

export function PortfolioDetailModal({ open, item, onClose, onEditOrder, canManage = false }) {
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

export function ProviderDetailModal({ open, provider, paymentRows = [], canManage = false, onUpdatePayable, onSupplierEmail, onSupplierWhatsApp, onClose, onSave }) {
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
          <div style={{ display: "grid", gap: 12 }}>
            <DetailTable
              columns={[
                { key: "folio", label: "Número", render: row => <div><div style={{ fontWeight:700 }}>{row.folio || "—"}</div><div className="treasury-muted" style={{ fontSize:11 }}>{row.docType || "Documento"}</div></div> },
                { key: "issueDate", label: "Emisión", render: row => row.issueDate ? fmtD(row.issueDate) : "—" },
                { key: "dueDate", label: "Vencimiento", render: row => row.dueDate ? fmtD(row.dueDate) : "—" },
                { key: "total", label: "Monto", render: row => <span className="treasury-mono">{fmtM(row.total)}</span> },
                { key: "pending", label: "Monto a pagar", render: row => <span className={`treasury-mono ${pendingTone(row.pending, row.pending <= 0 ? "paid" : row.status === "Vencida" ? "overdue" : "pending")}`}>{fmtM(row.pending)}</span> },
                { key: "status", label: "Estado", render: row => <StatusBadge label={row.status} /> },
              ]}
              rows={provider.payables}
              emptyText="Sin documentos para este proveedor"
            />
            {(provider.payables || []).length ? (provider.payables || []).map(row => (
              <div key={row.id} className="treasury-detail">
                <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"flex-start", flexWrap:"wrap", marginBottom:12 }}>
                  <div>
                    <div className="treasury-detail-title">{row.folio || "Documento sin folio"}</div>
                    <div className="treasury-muted" style={{ fontSize: 12, marginBottom: 8 }}>{row.docType || "Documento"}</div>
                    <div className="treasury-muted" style={{ fontSize:12 }}>
                      {row.issueDate ? `Emitido ${fmtD(row.issueDate)}` : "Sin fecha de emisión"} · {row.dueDate ? `Vence ${fmtD(row.dueDate)}` : "Sin vencimiento"}
                    </div>
                  </div>
                  {canManage && onUpdatePayable ? (
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(2,minmax(180px,1fr))", gap:10, minWidth:"min(100%,420px)" }}>
                      <label>
                        <div className="treasury-section-sub" style={{ marginTop:0, marginBottom:6 }}>Estado del documento</div>
                        <select value={row.status || "Pendiente"} onChange={e => onUpdatePayable(row, { status: e.target.value })} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid var(--bdr2)", background:"var(--card)", color:"var(--wh)" }}>
                          {["Pendiente", "Parcial", "Pagada", "Vencida"].map(option => <option key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <label>
                        <div className="treasury-section-sub" style={{ marginTop:0, marginBottom:6 }}>Fecha estimada de pago</div>
                        <input type="date" value={row.paymentDate || ""} onChange={e => onUpdatePayable(row, { paymentDate: e.target.value })} style={{ width:"100%", padding:"10px 12px", borderRadius:10, border:"1px solid var(--bdr2)", background:"var(--card)", color:"var(--wh)" }} />
                      </label>
                    </div>
                  ) : null}
                </div>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {onSupplierEmail ? <ContactActionButton tone="mail" label="Correo" onClick={() => onSupplierEmail(row)} /> : null}
                  {onSupplierWhatsApp ? <ContactActionButton tone="wa" label="WhatsApp" onClick={() => onSupplierWhatsApp(row)} /> : null}
                </div>
              </div>
            )) : null}
          </div>
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
              <div><div className="treasury-detail-title">Historial de pagos</div><div className="treasury-muted" style={{ fontSize: 12 }}>Pagos realizados asociados a los documentos del proveedor.</div></div>
            </div>
            <DetailTable
              columns={[
                { key: "date", label: "Fecha", render: row => row.date ? fmtD(row.date) : "—" },
                { key: "targetLabel", label: "Documento" },
                { key: "method", label: "Método" },
                { key: "reference", label: "Referencia" },
                { key: "amount", label: "Monto", render: row => <span className="treasury-mono treasury-pending-paid">{fmtM(row.amount)}</span> },
              ]}
              rows={paymentRows}
              emptyText="Todavía no hay pagos registrados para este proveedor"
            />
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

export function IssuedOrderDetailModal({ open, order, provider = null, onClose, onEdit, onEmail }) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!order) return null;
  const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
  const effectiveContactName = order?.supplierContactName || primaryContact?.nombre || "";
  const effectiveContactEmail = order?.supplierContactEmail || primaryContact?.email || primaryContact?.ema || "";
  const effectiveContactPhone = order?.supplierContactPhone || primaryContact?.telefono || primaryContact?.tel || "";

  return (
    <Modal open={open} onClose={onClose} title="" sub="" wide>
      <div className="treasury-modal-shell">
        <div className="treasury-profile">
          <div className="treasury-avatar" style={{ width: 58, height: 58, fontSize: 18 }}>{getInitials(order?.supplier || order?.supplierLegalName)}</div>
          <div style={{ flex: 1 }}>
            <div className="treasury-profile-title">{order?.number || "Orden de compra"}</div>
            <div className="treasury-profile-sub">{order?.supplierLegalName || order?.supplier || "Proveedor"} · {order?.productionName || order?.costCenter || "Sin producción asociada"}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {order?.pdfUrl ? <GBtn onClick={() => window.open(order.pdfUrl, "_blank", "noopener,noreferrer")}>Ver PDF</GBtn> : null}
            {onEmail ? <GBtn onClick={() => onEmail(order)}>Correo</GBtn> : null}
            {onEdit ? <GBtn onClick={() => onEdit(order)}>Editar</GBtn> : null}
            <GBtn onClick={onClose}>Cerrar</GBtn>
          </div>
        </div>

        <div className="treasury-modal-summary">
          <MiniKpiCard color="var(--cy)" label="Monto total" value={fmtM(order?.amount || 0)} />
          <MiniKpiCard color="#a78bfa" label="Estado aprobación" value={order?.approvalStatus || "—"} />
          <MiniKpiCard color="#00e08a" label="Líneas" value={items.length || 0} />
        </div>

        <div className="treasury-detail-grid">
          <div className="treasury-detail">
            <div className="treasury-detail-title">Detalle interno</div>
            <div className="treasury-provider-meta" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
              <div><div className="meta-label">Solicitante</div><div className="meta-value">{order?.requesterName || "—"}</div></div>
              <div><div className="meta-label">Contacto</div><div className="meta-value">{order?.requesterEmail || "—"}</div></div>
              <div><div className="meta-label">Centro de costo</div><div className="meta-value">{order?.costCenter || "—"}</div></div>
              <div><div className="meta-label">Categoría</div><div className="meta-value">{order?.category || "—"}</div></div>
              <div><div className="meta-label">Producción</div><div className="meta-value">{order?.productionName || "—"}</div></div>
              <div><div className="meta-label">Forma de pago</div><div className="meta-value">{order?.paymentMethod || "—"}</div></div>
            </div>
          </div>

          <div className="treasury-detail">
            <div className="treasury-detail-title">Proveedor</div>
            <div className="treasury-provider-meta" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
              <div><div className="meta-label">Razón social</div><div className="meta-value">{order?.supplierLegalName || order?.supplier || "—"}</div></div>
              <div><div className="meta-label">RUT</div><div className="meta-value">{order?.supplierRut || provider?.rut || "—"}</div></div>
              <div><div className="meta-label">Dirección</div><div className="meta-value">{order?.supplierAddress || provider?.direccion || "—"}</div></div>
              <div><div className="meta-label">Comuna / Ciudad</div><div className="meta-value">{[order?.supplierDistrict, order?.supplierCity].filter(Boolean).join(" · ") || "—"}</div></div>
              <div><div className="meta-label">Contacto</div><div className="meta-value">{effectiveContactName || "—"}</div></div>
              <div><div className="meta-label">Correo</div><div className="meta-value">{effectiveContactEmail || "—"}</div></div>
              <div><div className="meta-label">Teléfono</div><div className="meta-value">{effectiveContactPhone || "—"}</div></div>
              <div><div className="meta-label">Moneda</div><div className="meta-value">{order?.currency || "CLP"}</div></div>
            </div>
          </div>
        </div>

        <div className="treasury-detail">
          <div className="treasury-detail-title">Detalle de la orden</div>
          <DetailTable
            columns={[
              { key: "description", label: "Descripción" },
              { key: "quantity", label: "Cantidad", render: row => <span className="treasury-mono">{row.quantity || 0}</span> },
              { key: "unitPrice", label: "Precio unitario", render: row => <span className="treasury-mono">{fmtM(row.unitPrice || 0)}</span> },
              { key: "discount", label: "Descuento", render: row => <span className="treasury-mono">{row.discount ? fmtM(row.discount) : "—"}</span> },
              { key: "subtotal", label: "Subtotal", render: row => <span className="treasury-mono treasury-pending-paid">{fmtM(row.subtotal || 0)}</span> },
            ]}
            rows={items}
            emptyText="Esta orden todavía no tiene líneas registradas."
          />
        </div>

        <div className="treasury-detail-grid">
          <div className="treasury-detail">
            <div className="treasury-detail-title">Observaciones</div>
            <div className="treasury-muted" style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{order?.notes || "Sin observaciones."}</div>
          </div>

          <div className="treasury-detail">
            <div className="treasury-detail-title">Aprobación y envío</div>
            <div className="treasury-provider-meta" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
              <div><div className="meta-label">Estado</div><div className="meta-value">{order?.approvalStatus || "—"}</div></div>
              <div><div className="meta-label">Aprobada por</div><div className="meta-value">{order?.approvedBy || "—"}</div></div>
              <div><div className="meta-label">Fecha aprobación</div><div className="meta-value">{order?.approvedAt ? fmtD(String(order.approvedAt).slice(0, 10)) : "—"}</div></div>
              <div><div className="meta-label">Último envío</div><div className="meta-value">{order?.lastSentAt ? fmtD(String(order.lastSentAt).slice(0, 10)) : "Sin enviar"}</div></div>
              <div><div className="meta-label">Destinatario</div><div className="meta-value">{order?.lastSentTo || effectiveContactEmail || "—"}</div></div>
              <div><div className="meta-label">Asunto</div><div className="meta-value">{order?.lastSentSubject || "—"}</div></div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
