import React, { useEffect, useRef, useState } from "react";
import { FG, FI, FSl, FTA, MFoot, Modal, MultiSelect, R2, VALIDATION_FIELD_STYLE, ValidationBanner, ValidationHint } from "../../lib/ui/components";
import { today, uid } from "../../lib/utils/helpers";

export function TreasuryPurchaseOrderModal({ open, data, clientes, facturas, onClose, onSave }) {
  const [form, setForm] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(data?.id ? { ...data } : {
      id: uid(),
      clientId: "",
      number: "",
      issueDate: today(),
      amount: "",
      status: "Pendiente",
      linkedInvoiceIds: [],
      pdfName: "",
      pdfUrl: "",
      notes: "",
    });
    if (fileRef.current) fileRef.current.value = "";
  }, [data, open]);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const onFileChange = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({
        ...prev,
        pdfName: file.name,
        pdfUrl: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const invoiceOptions = (Array.isArray(facturas) ? facturas : [])
    .filter(item => !form.clientId || item.entidadId === form.clientId)
    .map(item => ({
      value: item.id,
      label: `${item.correlativo || item.tipoDoc || "Documento"} · $${Number(item.total || 0).toLocaleString("es-CL")}`,
    }));
  const validationIssue = !String(form.clientId || "").trim()
    ? {
      key: "clientId",
      title: "No has completado el cliente de la orden de compra.",
      detail: "Selecciona el cliente antes de guardar esta orden.",
      inline: "Falta indicar el cliente asociado a esta OC.",
    }
    : !String(form.number || "").trim()
      ? {
        key: "number",
        title: "Todavía falta el número de la orden de compra.",
        detail: "Ingresa el número o identificador de la OC para poder registrarla.",
        inline: "Falta completar el número de la orden de compra.",
      }
      : !Number(form.amount || 0)
        ? {
          key: "amount",
          title: "Todavía falta el monto total de la orden de compra.",
          detail: "Ingresa un monto mayor a cero antes de guardar esta OC.",
          inline: "El monto total no puede quedar en cero.",
        }
        : null;
  const canSubmit = !validationIssue;

  return (
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar orden de compra" : "Nueva orden de compra"} sub="Registra la OC del cliente y vincúlala manualmente a facturas emitidas">
      <R2>
        <FG label="Cliente *">
          <FSl value={form.clientId || ""} onChange={e => setField("clientId", e.target.value)} style={validationIssue?.key === "clientId" ? VALIDATION_FIELD_STYLE : undefined}>
            <option value="">Seleccionar...</option>
            {(clientes || []).map(client => <option key={client.id} value={client.id}>{client.nom}</option>)}
          </FSl>
          <ValidationHint>{validationIssue?.key === "clientId" ? validationIssue.inline : ""}</ValidationHint>
        </FG>
        <FG label="Número OC *">
          <FI value={form.number || ""} onChange={e => setField("number", e.target.value)} placeholder="OC-2026-14" style={validationIssue?.key === "number" ? VALIDATION_FIELD_STYLE : undefined} />
          <ValidationHint>{validationIssue?.key === "number" ? validationIssue.inline : ""}</ValidationHint>
        </FG>
      </R2>
      <R2>
        <FG label="Fecha OC"><FI type="date" value={form.issueDate || ""} onChange={e => setField("issueDate", e.target.value)} /></FG>
        <FG label="Monto total *">
          <FI type="number" min="0" value={form.amount || ""} onChange={e => setField("amount", e.target.value)} placeholder="0" style={validationIssue?.key === "amount" ? VALIDATION_FIELD_STYLE : undefined} />
          <ValidationHint>{validationIssue?.key === "amount" ? validationIssue.inline : ""}</ValidationHint>
        </FG>
      </R2>
      <FG label="Facturas asociadas">
        <MultiSelect
          options={invoiceOptions}
          value={form.linkedInvoiceIds || []}
          onChange={value => setField("linkedInvoiceIds", value)}
          placeholder="Vincular facturas emitidas..."
        />
      </FG>
      <FG label="Adjuntar PDF">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={onFileChange} style={{ width: "100%", color: "var(--gr3)" }} />
        {!!form.pdfName && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 6 }}>Adjunto: {form.pdfName}</div>}
      </FG>
      <FG label="URL respaldo (opcional)">
        <FI value={form.pdfUrl?.startsWith("data:") ? "" : (form.pdfUrl || "")} onChange={e => setField("pdfUrl", e.target.value)} placeholder="https://..." />
      </FG>
      <FG label="Notas"><FTA value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Observaciones internas o condiciones comerciales." /></FG>
      <ValidationBanner title={validationIssue?.title} detail={validationIssue?.detail} />
      <MFoot
        onClose={onClose}
        label="Guardar"
        disabled={!canSubmit}
        onSave={() => {
          if (!canSubmit) return;
          onSave({
            ...form,
            status: data?.id ? (form.status || "Pendiente") : "Pendiente",
            amount: Number(form.amount || 0),
          });
        }}
      />
    </Modal>
  );
}
