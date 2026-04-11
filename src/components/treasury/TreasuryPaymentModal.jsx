import React, { useEffect, useRef, useState } from "react";
import { FG, FI, FSl, FTA, MFoot, Modal, R2 } from "../../lib/ui/components";
import { today, uid } from "../../lib/utils/helpers";

export function TreasuryPaymentModal({ open, title, subtitle, data, onClose, onSave }) {
  const [form, setForm] = useState({});
  const fileRef = useRef(null);

  useEffect(() => {
    setForm({
      id: uid(),
      date: today(),
      amount: "",
      method: "Transferencia",
      reference: "",
      notes: "",
      receiptName: "",
      receiptUrl: "",
      ...(data || {}),
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
        receiptName: file.name,
        receiptUrl: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Modal open={open} onClose={onClose} title={title} sub={subtitle}>
      <R2>
        <FG label="Fecha pago"><FI type="date" value={form.date || ""} onChange={e => setField("date", e.target.value)} /></FG>
        <FG label="Monto *"><FI type="number" min="0" value={form.amount || ""} onChange={e => setField("amount", e.target.value)} placeholder="0" /></FG>
      </R2>
      <R2>
        <FG label="Método">
          <FSl value={form.method || "Transferencia"} onChange={e => setField("method", e.target.value)}>
            {["Transferencia", "Depósito", "Cheque", "Efectivo", "Tarjeta", "Otro"].map(option => <option key={option}>{option}</option>)}
          </FSl>
        </FG>
        <FG label="Referencia"><FI value={form.reference || ""} onChange={e => setField("reference", e.target.value)} placeholder="N° comprobante / banco" /></FG>
      </R2>
      <FG label="Adjuntar comprobante (PDF o PNG)">
        <input ref={fileRef} type="file" accept="application/pdf,image/png" onChange={onFileChange} style={{ width: "100%", color: "var(--gr3)" }} />
        {!!form.receiptName && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 6 }}>Adjunto: {form.receiptName}</div>}
      </FG>
      <FG label="Notas"><FTA value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Observaciones del pago." /></FG>
      <MFoot
        onClose={onClose}
        label="Guardar pago"
        onSave={() => {
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
