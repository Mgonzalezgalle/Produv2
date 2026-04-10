import React, { useEffect, useMemo, useRef, useState } from "react";
import { FG, FI, FSl, FTA, MFoot, Modal, R2 } from "../../lib/ui/components";
import { today, uid } from "../../lib/utils/helpers";

export function TreasuryPayableModal({ open, data, providers = [], onClose, onSave }) {
  const [form, setForm] = useState({});
  const fileRef = useRef(null);
  const providerOptions = useMemo(
    () => (Array.isArray(providers) ? providers : [])
      .map(provider => String(provider?.name || "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b)),
    [providers],
  );

  useEffect(() => {
    setForm(data?.id ? { ...data } : {
      id: uid(),
      supplier: "",
      folio: "",
      category: "Servicio",
      issueDate: today(),
      dueDate: "",
      total: "",
      paid: 0,
      status: "Pendiente",
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
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar cuenta por pagar" : "Nueva cuenta por pagar"} sub="Registra un documento manual y adjunta su respaldo PDF">
      <R2>
        <FG label="Proveedor *">
          <FSl value={form.supplier || ""} onChange={e => setField("supplier", e.target.value)}>
            <option value="">Seleccionar proveedor...</option>
            {providerOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </FSl>
        </FG>
        <FG label="Folio / Documento"><FI value={form.folio || ""} onChange={e => setField("folio", e.target.value)} placeholder="OC-203 / Fact 8821" /></FG>
      </R2>
      <R2>
        <FG label="Categoría">
          <FSl value={form.category || "Servicio"} onChange={e => setField("category", e.target.value)}>
            {["Servicio", "Proveedor", "Arriendo", "Honorarios", "Impuestos", "Producción", "Otro"].map(option => <option key={option}>{option}</option>)}
          </FSl>
        </FG>
        <FG label="Estado">
          <FSl value={form.status || "Pendiente"} onChange={e => setField("status", e.target.value)}>
            {["Pendiente", "Pagada", "Parcial", "Vencida"].map(option => <option key={option}>{option}</option>)}
          </FSl>
        </FG>
      </R2>
      <R2>
        <FG label="Fecha emisión"><FI type="date" value={form.issueDate || ""} onChange={e => setField("issueDate", e.target.value)} /></FG>
        <FG label="Fecha vencimiento"><FI type="date" value={form.dueDate || ""} onChange={e => setField("dueDate", e.target.value)} /></FG>
      </R2>
      <R2>
        <FG label="Monto total *"><FI type="number" min="0" value={form.total || ""} onChange={e => setField("total", e.target.value)} placeholder="0" /></FG>
        <FG label="Monto pagado"><FI type="number" min="0" value={form.paid || 0} onChange={e => setField("paid", e.target.value)} placeholder="0" /></FG>
      </R2>
      <FG label="Adjuntar PDF">
        <input ref={fileRef} type="file" accept="application/pdf" onChange={onFileChange} style={{ ...{ width: "100%", color: "var(--gr3)" } }} />
        {!!form.pdfName && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 6 }}>Adjunto: {form.pdfName}</div>}
      </FG>
      <FG label="URL respaldo (opcional)">
        <FI value={form.pdfUrl?.startsWith("data:") ? "" : (form.pdfUrl || "")} onChange={e => setField("pdfUrl", e.target.value)} placeholder="https://..." />
      </FG>
      <FG label="Notas">
        <FTA value={form.notes || ""} onChange={e => setField("notes", e.target.value)} placeholder="Comentarios internos, compromiso de pago, etc." />
      </FG>
      <MFoot
        onClose={onClose}
        label="Guardar"
        onSave={() => {
          if (!String(form.supplier || "").trim()) return;
          if (!Number(form.total || 0)) return;
          onSave({
            ...form,
            total: Number(form.total || 0),
            paid: Number(form.paid || 0),
          });
        }}
      />
    </Modal>
  );
}
