import React, { useEffect, useRef, useState } from "react";
import { FG, FI, FSl, FTA, MFoot, Modal, R2, VALIDATION_FIELD_STYLE, ValidationBanner, ValidationHint } from "../../lib/ui/components";
import { DEFAULT_LISTAS, today, uid } from "../../lib/utils/helpers";

export function TreasuryPayableModal({ open, data, providers = [], listas = {}, onClose, onSave }) {
  const [form, setForm] = useState({});
  const fileRef = useRef(null);
  const docTypeOptions = Array.isArray(listas?.tiposDocPagar) && listas.tiposDocPagar.length
    ? listas.tiposDocPagar
    : DEFAULT_LISTAS.tiposDocPagar;
  const providerOptions = (Array.isArray(providers) ? providers : [])
    .map(provider => String(provider?.name || "").trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const validationIssue = !String(form.supplier || "").trim()
    ? {
      key: "supplier",
      title: "No has completado el proveedor del documento.",
      detail: "Selecciona el proveedor antes de guardar esta cuenta por pagar.",
      inline: "Falta indicar a qué proveedor corresponde este documento.",
    }
    : !Number(form.total || 0)
      ? {
        key: "total",
        title: "Todavía falta el monto total del documento.",
        detail: "Ingresa un monto mayor a cero para registrar esta cuenta por pagar.",
        inline: "El monto total no puede quedar en cero.",
      }
      : null;
  const canSubmit = !validationIssue;

  useEffect(() => {
    setForm(data?.id ? { ...data } : {
      id: uid(),
      supplier: "",
      docType: docTypeOptions[0] || "Factura Afecta",
      folio: "",
      category: "Servicio",
      issueDate: today(),
      dueDate: "",
      total: "",
      status: "Pendiente",
      pdfName: "",
      pdfUrl: "",
      notes: "",
    });
    if (fileRef.current) fileRef.current.value = "";
  }, [data, open, docTypeOptions]);

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
          <FSl value={form.supplier || ""} onChange={e => setField("supplier", e.target.value)} style={validationIssue?.key === "supplier" ? VALIDATION_FIELD_STYLE : undefined}>
            <option value="">Seleccionar proveedor...</option>
            {providerOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </FSl>
          <ValidationHint>{validationIssue?.key === "supplier" ? validationIssue.inline : ""}</ValidationHint>
        </FG>
        <FG label="Tipo de documento">
          <FSl value={form.docType || (docTypeOptions[0] || "Factura Afecta")} onChange={e => setField("docType", e.target.value)}>
            {docTypeOptions.map(option => <option key={option} value={option}>{option}</option>)}
          </FSl>
        </FG>
      </R2>
      <R2>
        <FG label="Folio / Documento"><FI value={form.folio || ""} onChange={e => setField("folio", e.target.value)} placeholder="OC-203 / Fact 8821" /></FG>
        <FG label="Categoría">
          <FSl value={form.category || "Servicio"} onChange={e => setField("category", e.target.value)}>
            {["Servicio", "Proveedor", "Arriendo", "Honorarios", "Impuestos", "Producción", "Otro"].map(option => <option key={option}>{option}</option>)}
          </FSl>
        </FG>
      </R2>
      <R2>
        <FG label="Fecha emisión"><FI type="date" value={form.issueDate || ""} onChange={e => setField("issueDate", e.target.value)} /></FG>
        <FG label="Fecha vencimiento"><FI type="date" value={form.dueDate || ""} onChange={e => setField("dueDate", e.target.value)} /></FG>
      </R2>
      <R2>
        <FG label="Monto total *">
          <FI type="number" min="0" value={form.total || ""} onChange={e => setField("total", e.target.value)} placeholder="0" style={validationIssue?.key === "total" ? VALIDATION_FIELD_STYLE : undefined} />
          <ValidationHint>{validationIssue?.key === "total" ? validationIssue.inline : ""}</ValidationHint>
        </FG>
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
      <ValidationBanner title={validationIssue?.title} detail={validationIssue?.detail} />
      <MFoot
        onClose={onClose}
        label="Guardar"
        disabled={!canSubmit}
        onSave={() => {
          if (!canSubmit) return;
          onSave({
            ...form,
            total: Number(form.total || 0),
            paid: 0,
            status: "Pendiente",
          });
        }}
      />
    </Modal>
  );
}
