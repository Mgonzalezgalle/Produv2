import React, { useEffect, useRef, useState } from "react";
import { FG, FI, FSl, FTA, MFoot, Modal, R2 } from "../../lib/ui/components";
import { today, uid } from "../../lib/utils/helpers";

const FIELD_ERROR_STYLE = {
  borderColor: "color-mix(in srgb, var(--red) 72%, var(--bdr2) 28%)",
  boxShadow: "0 0 0 1px color-mix(in srgb, var(--red) 20%, transparent 80%)",
};

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
  const maxAmount = Number(form.maxAmount || 0);
  const currentAmount = Number(form.amount || 0);
  const amountExceeded = maxAmount > 0 && currentAmount > maxAmount;
  const validationIssue = !currentAmount
    ? {
      key: "amount",
      title: "Todavía falta definir el monto del pago.",
      detail: "Ingresa un monto mayor a cero antes de guardar este movimiento.",
      inline: "El pago no puede guardarse con monto cero.",
    }
    : amountExceeded
      ? {
        key: "amount",
        title: "El monto supera el máximo permitido para este pago.",
        detail: `Ajusta el monto para que no exceda ${maxAmount.toLocaleString("es-CL")}.`,
        inline: "Este pago supera el saldo disponible para registrar.",
      }
      : null;
  const canSubmit = !validationIssue;

  return (
    <Modal open={open} onClose={onClose} title={title} sub={subtitle}>
      <R2>
        <FG label="Fecha pago"><FI type="date" value={form.date || ""} onChange={e => setField("date", e.target.value)} /></FG>
        <FG label="Monto *">
          <FI type="number" min="0" max={maxAmount > 0 ? maxAmount : undefined} value={form.amount || ""} onChange={e => setField("amount", e.target.value)} placeholder="0" style={validationIssue?.key === "amount" ? FIELD_ERROR_STYLE : undefined} />
          {maxAmount > 0 && <div style={{ fontSize: 11, color: amountExceeded ? "var(--red)" : "var(--gr2)", marginTop: 6 }}>Máximo permitido: {maxAmount.toLocaleString("es-CL")}</div>}
          {validationIssue?.key === "amount" && <div style={{ fontSize: 11, color: "var(--red)", marginTop: 6, fontWeight: 600 }}>{validationIssue.inline}</div>}
        </FG>
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
      {validationIssue && (
        <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--red) 24%, var(--bdr2) 76%)", background: "color-mix(in srgb, var(--red) 10%, var(--card) 90%)" }}>
          <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, marginBottom: 4 }}>{validationIssue.title}</div>
          <div style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.5 }}>{validationIssue.detail}</div>
        </div>
      )}
      <MFoot
        onClose={onClose}
        label="Guardar pago"
        disabled={!canSubmit}
        onSave={() => {
          if (!canSubmit) return;
          onSave({
            ...form,
            amount: Number(form.amount || 0),
          });
        }}
      />
    </Modal>
  );
}
