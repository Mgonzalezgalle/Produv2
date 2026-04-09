import React, { useEffect, useRef, useState } from "react";
import { FG, FI, FTA, MFoot, Modal, R2 } from "../../lib/ui/components";
import { today, uid } from "../../lib/utils/helpers";

export function TreasuryIssuedOrderModal({ open, data, onClose, onSave }) {
  const [form, setForm] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    setForm(data?.id ? { ...data } : {
      id: uid(),
      supplier: "",
      number: "",
      issueDate: today(),
      amount: "",
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

  return (
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar OC emitida" : "Nueva OC emitida"} sub="Registra órdenes de compra emitidas a proveedores desde Tesorería">
      <R2>
        <FG label="Proveedor *"><FI value={form.supplier || ""} onChange={e => setField("supplier", e.target.value)} placeholder="Proveedor / servicio" /></FG>
        <FG label="Número OC *"><FI value={form.number || ""} onChange={e => setField("number", e.target.value)} placeholder="OC-PROV-2026-01" /></FG>
      </R2>
      <R2>
        <FG label="Fecha emisión"><FI type="date" value={form.issueDate || ""} onChange={e => setField("issueDate", e.target.value)} /></FG>
        <FG label="Monto total *"><FI type="number" min="0" value={form.amount || ""} onChange={e => setField("amount", e.target.value)} placeholder="0" /></FG>
      </R2>
      <FG label="Adjuntar PDF">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={onFileChange} style={{ width: "100%", color: "var(--gr3)" }} />
        {!!form.pdfName && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 6 }}>Adjunto: {form.pdfName}</div>}
      </FG>
      <FG label="URL respaldo (opcional)">
        <FI value={form.pdfUrl?.startsWith("data:") ? "" : (form.pdfUrl || "")} onChange={e => setField("pdfUrl", e.target.value)} placeholder="https://..." />
      </FG>
      <FG label="Notas"><FTA value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Condiciones o referencia del pedido." /></FG>
      <MFoot
        onClose={onClose}
        label="Guardar"
        onSave={() => {
          if (!String(form.supplier || "").trim()) return;
          if (!String(form.number || "").trim()) return;
          if (!Number(form.amount || 0)) return;
          onSave({
            ...form,
            amount: Number(form.amount || 0),
          });
        }}
      />
    </Modal>
  );
}
