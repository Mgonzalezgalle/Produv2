import React, { useEffect, useMemo, useRef, useState } from "react";
import { DBtn, FG, FI, FSl, FTA, GBtn, MFoot, Modal, R2 } from "../../lib/ui/components";
import { today, uid } from "../../lib/utils/helpers";
import { fmtM } from "../../lib/utils/helpers";
import { buildIssuedOrderPdfDataUrl, issuedOrderPdfFileName } from "../../lib/utils/treasuryIssuedOrderPdf";

function buildLocalDateTimeValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function lineSubtotal(item = {}) {
  const quantity = Math.max(0, Number(item?.quantity || 0));
  const unitPrice = Math.max(0, Number(item?.unitPrice || 0));
  const discount = Math.max(0, Number(item?.discount || 0));
  return Math.max(0, quantity * unitPrice - discount);
}

function emptyItem() {
  return {
    id: uid(),
    description: "",
    quantity: 1,
    unitPrice: "",
    discount: "",
  };
}

function buildInitialForm(data, providers = [], user = {}) {
  const primaryName = user?.name || user?.nom || user?.email || "";
  const primaryEmail = user?.email || user?.ema || "";
  if (data?.id) {
    return {
      items: Array.isArray(data.items) && data.items.length ? data.items.map(item => ({ ...emptyItem(), ...item })) : [emptyItem()],
      requesterName: primaryName,
      requesterEmail: primaryEmail,
      currency: "CLP",
      approvalStatus: "Aprobada",
      approvedBy: primaryName,
      approvedAt: buildLocalDateTimeValue(),
      pdfSource: data?.pdfSource || "",
      ...data,
    };
  }
  return {
    id: uid(),
    providerId: "",
    supplier: "",
    supplierLegalName: "",
    supplierRut: "",
    supplierAddress: "",
    supplierDistrict: "",
    supplierCity: "",
      supplierContactName: "",
      supplierContactEmail: "",
      supplierContactPhone: "",
      relatedEntityType: "",
      relatedEntityId: "",
      requesterName: primaryName,
      requesterEmail: primaryEmail,
    costCenter: "",
    category: "",
    productionName: "",
    currency: "CLP",
    number: "",
    issueDate: today(),
    paymentMethod: "",
    approvalStatus: "Aprobada",
    approvedBy: primaryName,
    approvedAt: buildLocalDateTimeValue(),
    amount: "",
    items: [emptyItem()],
    pdfName: "",
    pdfUrl: "",
    pdfSource: "",
    notes: "",
  };
}

function providerSnapshot(provider = {}) {
  const primaryContact = Array.isArray(provider?.contactos) ? provider.contactos[0] : null;
  return {
    providerId: provider?.id || "",
    supplier: provider?.name || provider?.razonSocial || "",
    supplierLegalName: provider?.razonSocial || provider?.name || "",
    supplierRut: provider?.rut || "",
    supplierAddress: provider?.direccion || "",
    supplierDistrict: provider?.comuna || "",
    supplierCity: provider?.ciudad || "",
    supplierContactName: primaryContact?.nombre || "",
    supplierContactEmail: primaryContact?.email || primaryContact?.ema || "",
    supplierContactPhone: primaryContact?.telefono || primaryContact?.tel || "",
  };
}

export function TreasuryIssuedOrderModal({ open, data, providers = [], empresa, user, producciones = [], programas = [], piezas = [], onClose, onSave }) {
  const [form, setForm] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(buildInitialForm(data, providers, user));
    if (fileRef.current) fileRef.current.value = "";
  }, [data, open, providers, user]);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setItemField = (id, key, value) => setForm(prev => ({
    ...prev,
    items: (prev.items || []).map(item => item.id === id ? { ...item, [key]: value } : item),
  }));
  const addItem = () => setForm(prev => ({ ...prev, items: [...(prev.items || []), emptyItem()] }));
  const removeItem = id => setForm(prev => ({
    ...prev,
    items: (prev.items || []).length <= 1 ? [emptyItem()] : (prev.items || []).filter(item => item.id !== id),
  }));

  const providerOptions = useMemo(
    () => (Array.isArray(providers) ? providers : []).slice().sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""))),
    [providers],
  );
  const relatedOptions = useMemo(() => {
    const build = (rows, entityType, groupLabel) => (Array.isArray(rows) ? rows : [])
      .map(row => ({
        value: `${entityType}:${row.id}`,
        entityType,
        entityId: row.id,
        groupLabel,
        label: row.nom || row.nombre || row.name || "Sin nombre",
      }))
      .filter(option => option.entityId && option.label);
    return [
      ...build(producciones, "produccion", "Producciones"),
      ...build(programas, "programa", "Programas"),
      ...build(piezas, "contenido", "Contenidos"),
    ].sort((a, b) => a.groupLabel.localeCompare(b.groupLabel) || a.label.localeCompare(b.label));
  }, [producciones, programas, piezas]);
  const relatedValue = form.relatedEntityType && form.relatedEntityId ? `${form.relatedEntityType}:${form.relatedEntityId}` : "";
  const computedTotal = useMemo(
    () => (form.items || []).reduce((sum, item) => sum + lineSubtotal(item), 0),
    [form.items],
  );

  const onFileChange = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({
        ...prev,
        pdfName: file.name,
        pdfUrl: typeof reader.result === "string" ? reader.result : "",
        pdfSource: "manual-upload",
      }));
    };
    reader.readAsDataURL(file);
  };

  const sectionTitleStyle = {
    fontSize: 12,
    fontWeight: 800,
    color: "var(--cy)",
    letterSpacing: ".04em",
    textTransform: "uppercase",
    margin: "8px 0 10px",
  };

  return (
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar OC emitida" : "Nueva OC emitida"} sub="Aquí defines todos los campos operativos y documentales de la orden de compra." extraWide>
      <div style={sectionTitleStyle}>Encabezado</div>
      <R2>
        <FG label="Proveedor *">
          <FSl
            value={form.providerId || ""}
            onChange={e => {
              const nextProvider = providerOptions.find(item => item.id === e.target.value);
              if (!nextProvider) {
                setForm(prev => ({ ...prev, providerId: "" }));
                return;
              }
              setForm(prev => ({ ...prev, ...providerSnapshot(nextProvider) }));
            }}
          >
            <option value="">Seleccionar...</option>
            {providerOptions.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </FSl>
        </FG>
        <FG label="Número OC *"><FI value={form.number || ""} onChange={e => setField("number", e.target.value)} placeholder="OC-PROV-2026-01" /></FG>
      </R2>
      <R2>
        <FG label="Fecha emisión"><FI type="date" value={form.issueDate || ""} onChange={e => setField("issueDate", e.target.value)} /></FG>
        <FG label="Moneda">
          <FSl value={form.currency || "CLP"} onChange={e => setField("currency", e.target.value)}>
            {["CLP", "USD", "EUR", "UF"].map(option => <option key={option} value={option}>{option}</option>)}
          </FSl>
        </FG>
      </R2>
      <div style={sectionTitleStyle}>Solicitante y contexto interno</div>
      <R2>
        <FG label="Solicitante"><FI value={form.requesterName || ""} onChange={e => setField("requesterName", e.target.value)} placeholder="Nombre solicitante" /></FG>
        <FG label="Contacto"><FI value={form.requesterEmail || ""} onChange={e => setField("requesterEmail", e.target.value)} placeholder="correo@empresa.cl" /></FG>
      </R2>
      <R2>
        <FG label="Centro de costo"><FI value={form.costCenter || ""} onChange={e => setField("costCenter", e.target.value)} placeholder="Operaciones, Producción..." /></FG>
        <FG label="Categoría"><FI value={form.category || ""} onChange={e => setField("category", e.target.value)} placeholder="Edición, Servicios..." /></FG>
      </R2>
      <FG label="Vincular a registro existente">
        <FSl
          value={relatedValue}
          onChange={e => {
            const selected = relatedOptions.find(option => option.value === e.target.value);
            if (!selected) {
              setForm(prev => ({ ...prev, relatedEntityType: "", relatedEntityId: "" }));
              return;
            }
            setForm(prev => ({
              ...prev,
              relatedEntityType: selected.entityType,
              relatedEntityId: selected.entityId,
              productionName: selected.label,
              category: prev.category || selected.groupLabel.slice(0, -1),
            }));
          }}
        >
          <option value="">Seleccionar...</option>
          {["Producciones", "Programas", "Contenidos"].map(group => {
            const groupItems = relatedOptions.filter(option => option.groupLabel === group);
            if (!groupItems.length) return null;
            return (
              <optgroup key={group} label={group}>
                {groupItems.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </optgroup>
            );
          })}
        </FSl>
      </FG>
      <FG label="Producción / proyecto"><FI value={form.productionName || ""} onChange={e => setField("productionName", e.target.value)} placeholder="Nombre de producción, proyecto o contenido" /></FG>
      <div style={sectionTitleStyle}>Proveedor</div>
      <R2>
        <FG label="Razón social proveedor"><FI value={form.supplierLegalName || ""} onChange={e => setField("supplierLegalName", e.target.value)} placeholder="Razón social" /></FG>
        <FG label="Nombre visible proveedor"><FI value={form.supplier || ""} onChange={e => setField("supplier", e.target.value)} placeholder="Nombre proveedor" /></FG>
      </R2>
      <R2>
        <FG label="RUT proveedor"><FI value={form.supplierRut || ""} onChange={e => setField("supplierRut", e.target.value)} placeholder="12.345.678-9" /></FG>
        <FG label="Forma de pago"><FI value={form.paymentMethod || ""} onChange={e => setField("paymentMethod", e.target.value)} placeholder="Transferencia, contra boleta..." /></FG>
      </R2>
      <FG label="Dirección proveedor"><FI value={form.supplierAddress || ""} onChange={e => setField("supplierAddress", e.target.value)} placeholder="Dirección" /></FG>
      <R2>
        <FG label="Comuna"><FI value={form.supplierDistrict || ""} onChange={e => setField("supplierDistrict", e.target.value)} placeholder="Comuna" /></FG>
        <FG label="Ciudad"><FI value={form.supplierCity || ""} onChange={e => setField("supplierCity", e.target.value)} placeholder="Ciudad" /></FG>
      </R2>
      <R2>
        <FG label="Contacto proveedor"><FI value={form.supplierContactName || ""} onChange={e => setField("supplierContactName", e.target.value)} placeholder="Nombre contacto" /></FG>
        <FG label="Correo proveedor"><FI value={form.supplierContactEmail || ""} onChange={e => setField("supplierContactEmail", e.target.value)} placeholder="email@proveedor.cl" /></FG>
      </R2>
      <R2>
        <FG label="Teléfono proveedor"><FI value={form.supplierContactPhone || ""} onChange={e => setField("supplierContactPhone", e.target.value)} placeholder="+56..." /></FG>
        <FG label="Aprobada por"><FI value={form.approvedBy || ""} onChange={e => setField("approvedBy", e.target.value)} placeholder="Nombre aprobador" /></FG>
      </R2>
      <div style={sectionTitleStyle}>Aprobación</div>
      <R2>
        <FG label="Estado aprobación">
          <FSl value={form.approvalStatus || "Aprobada"} onChange={e => setField("approvalStatus", e.target.value)}>
            {["Borrador", "Pendiente", "Aprobada", "Rechazada", "Emitida"].map(option => <option key={option} value={option}>{option}</option>)}
          </FSl>
        </FG>
        <FG label="Fecha aprobación"><FI type="datetime-local" value={form.approvedAt || ""} onChange={e => setField("approvedAt", e.target.value)} /></FG>
      </R2>
      <div style={sectionTitleStyle}>Detalle de la orden</div>
      <div style={{ marginTop: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--wh)" }}>Líneas de compra</div>
          <GBtn sm onClick={addItem}>+ Agregar línea</GBtn>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {(form.items || []).map(item => {
            const subtotal = lineSubtotal(item);
            return (
              <div key={item.id} style={{ border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12, background: "rgba(255,255,255,.02)" }}>
                <FG label="Descripción">
                  <FTA value={item.description || ""} onChange={e => setItemField(item.id, "description", e.target.value)} placeholder="Servicio, producto o detalle solicitado" />
                </FG>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 10 }}>
                  <FG label="Cantidad"><FI type="number" min="0" value={item.quantity ?? ""} onChange={e => setItemField(item.id, "quantity", e.target.value)} /></FG>
                  <FG label="Precio unitario"><FI type="number" min="0" value={item.unitPrice ?? ""} onChange={e => setItemField(item.id, "unitPrice", e.target.value)} /></FG>
                  <FG label="Descuento"><FI type="number" min="0" value={item.discount ?? ""} onChange={e => setItemField(item.id, "discount", e.target.value)} /></FG>
                  <FG label="Subtotal"><FI value={fmtM(subtotal)} readOnly /></FG>
                </div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <DBtn sm onClick={() => removeItem(item.id)}>Eliminar línea</DBtn>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={sectionTitleStyle}>Respaldo y observaciones</div>
      <R2>
        <FG label="Total calculado"><FI value={fmtM(computedTotal || Number(form.amount || 0))} readOnly /></FG>
        <FG label="PDF">
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--gr2)" }}>
              {form.pdfSource === "manual-upload" ? `Adjunto manual: ${form.pdfName || "PDF cargado"}` : form.pdfSource === "manual-url" ? "PDF externo por URL" : "Si no adjuntas uno, Produ generará el PDF automáticamente al guardar."}
            </div>
            {!!form.pdfUrl && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <GBtn sm onClick={() => window.open(form.pdfUrl, "_blank", "noopener,noreferrer")}>Ver PDF actual</GBtn>
                <GBtn sm onClick={() => setForm(prev => ({ ...prev, pdfUrl: "", pdfName: "", pdfSource: "" }))}>Usar PDF generado por Produ</GBtn>
              </div>
            )}
          </div>
        </FG>
      </R2>
      <FG label="Adjuntar PDF">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={onFileChange} style={{ width: "100%", color: "var(--gr3)" }} />
        {!!form.pdfName && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 6 }}>Adjunto: {form.pdfName}</div>}
      </FG>
      <FG label="URL respaldo (opcional)">
        <FI
          value={form.pdfUrl?.startsWith("data:") ? "" : (form.pdfUrl || "")}
          onChange={e => setForm(prev => ({
            ...prev,
            pdfUrl: e.target.value,
            pdfSource: String(e.target.value || "").trim() ? "manual-url" : "",
          }))}
          placeholder="https://..."
        />
      </FG>
      <FG label="Observaciones"><FTA value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Condiciones, referencias o glosa de la orden." /></FG>
      <MFoot
        onClose={onClose}
        label="Guardar"
        onSave={async () => {
          if (!String(form.supplier || form.supplierLegalName || "").trim()) return;
          if (!String(form.number || "").trim()) return;
          const normalizedItems = (form.items || [])
            .map(item => ({
              ...item,
              quantity: Math.max(0, Number(item.quantity || 0)),
              unitPrice: Math.max(0, Number(item.unitPrice || 0)),
              discount: Math.max(0, Number(item.discount || 0)),
              subtotal: lineSubtotal(item),
            }))
            .filter(item => item.description || item.quantity || item.unitPrice || item.discount || item.subtotal);
          const nextAmount = normalizedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
          if (!nextAmount) return;
          const payload = {
            ...form,
            amount: nextAmount,
            items: normalizedItems,
          };
          if (!String(payload.pdfSource || "").startsWith("manual") || !String(payload.pdfUrl || "").trim()) {
            try {
              payload.pdfUrl = await buildIssuedOrderPdfDataUrl(payload, empresa);
              payload.pdfName = issuedOrderPdfFileName(payload);
              payload.pdfSource = "generated";
            } catch (error) {
              console.warn("[treasury-issued-order] No pudimos generar el PDF de la OC", error);
            }
          }
          onSave(payload);
        }}
      />
    </Modal>
  );
}
