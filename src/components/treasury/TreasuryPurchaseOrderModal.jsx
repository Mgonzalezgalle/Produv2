import React, { useEffect, useRef, useState } from "react";
import { FG, FI, FTA, MFoot, Modal, MultiSelect, R2 } from "../../lib/ui/components";
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

  return (
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar orden de compra" : "Nueva orden de compra"} sub="Registra la OC del cliente y vincúlala manualmente a facturas emitidas">
      <R2>
        <FG label="Cliente *">
          <FSl value={form.clientId || ""} onChange={e => setField("clientId", e.target.value)}>
            <option value="">Seleccionar...</option>
            {(clientes || []).map(client => <option key={client.id} value={client.id}>{client.nom}</option>)}
          </FSl>
        </FG>
        <FG label="Número OC *"><FI value={form.number || ""} onChange={e => setField("number", e.target.value)} placeholder="OC-2026-14" /></FG>
      </R2>
      <R2>
        <FG label="Fecha OC"><FI type="date" value={form.issueDate || ""} onChange={e => setField("issueDate", e.target.value)} /></FG>
        <FG label="Monto total *"><FI type="number" min="0" value={form.amount || ""} onChange={e => setField("amount", e.target.value)} placeholder="0" /></FG>
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
      <MFoot
        onClose={onClose}
        label="Guardar"
        onSave={() => {
          if (!String(form.clientId || "").trim()) return;
          if (!String(form.number || "").trim()) return;
          if (!Number(form.amount || 0)) return;
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
