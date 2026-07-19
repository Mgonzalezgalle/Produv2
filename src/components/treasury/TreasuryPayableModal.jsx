import React, { useEffect, useRef, useState } from "react";
import { FG, FI, FSl, FTA, MFoot, Modal, R2, VALIDATION_FIELD_STYLE, ValidationBanner, ValidationHint } from "../../lib/ui/components";
import { DEFAULT_LISTAS, today, uid } from "../../lib/utils/helpers";
import { TREASURY_CURRENCIES, TREASURY_DETRACTION_STATUSES, buildTreasuryDetraction, formatTreasuryMoney, normalizeTreasuryCurrency } from "../../lib/utils/treasury";

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
      currency: "CLP",
      issueDate: today(),
      dueDate: "",
      total: "",
      status: "Pendiente",
      detractionEnabled: false,
      detractionRate: "",
      detractionAmount: "",
      detractionStatus: "Pendiente",
      detractionCode: "",
      detractionDate: "",
      detractionNotes: "",
      pdfName: "",
      pdfUrl: "",
      notes: "",
    });
    if (fileRef.current) fileRef.current.value = "";
  }, [data, open, docTypeOptions]);

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const setSupplier = value => {
    const provider = providers.find(item => String(item?.name || "").trim() === value);
    setForm(prev => ({
      ...prev,
      supplier: value,
      currency: normalizeTreasuryCurrency(provider?.currency || prev.currency || "CLP"),
    }));
  };

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
  const detraction = buildTreasuryDetraction(form, Number(form.total || 0), form.currency || "CLP");
  const showDetractionFields = normalizeTreasuryCurrency(form.currency || "CLP") === "PEN" || detraction.enabled;

  return (
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar cuenta por pagar" : "Nueva cuenta por pagar"} sub="Registra un documento manual y adjunta su respaldo PDF">
      <R2>
        <FG label="Proveedor *">
          <FSl value={form.supplier || ""} onChange={e => setSupplier(e.target.value)} style={validationIssue?.key === "supplier" ? VALIDATION_FIELD_STYLE : undefined}>
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
        <FG label="Moneda">
          <FSl value={form.currency || "CLP"} onChange={e => setField("currency", e.target.value)}>
            {TREASURY_CURRENCIES.map(option => <option key={option} value={option}>{option}</option>)}
          </FSl>
        </FG>
      </R2>
      {showDetractionFields && (
        <div style={{ background:"#f8fbff", border:"1px solid var(--bdr2)", borderRadius:12, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:detraction.enabled ? 12 : 0, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:12, fontWeight:800, color:"#1a1a2e" }}>Detracción Perú</div>
              <div style={{ fontSize:11, color:"var(--gr2)", marginTop:4 }}>Registra el monto depositado por detracción y separa el neto que se pagará al proveedor.</div>
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--gr3)", fontWeight:700 }}>
              <input
                type="checkbox"
                checked={!!detraction.enabled}
                onChange={e => setForm(prev => ({
                  ...prev,
                  detractionEnabled: e.target.checked,
                  detractionRate: e.target.checked ? (prev.detractionRate || 12) : "",
                  detractionAmount: e.target.checked ? prev.detractionAmount : "",
                  detractionStatus: e.target.checked ? (prev.detractionStatus || "Pendiente") : "No aplica",
                }))}
              />
              Aplica detracción
            </label>
          </div>
          {detraction.enabled ? (
            <>
              <R2>
                <FG label="% detracción">
                  <FI type="number" min="0" max="100" step="0.01" value={form.detractionRate || ""} onChange={e => setForm(prev => ({ ...prev, detractionRate:e.target.value, detractionAmount:"" }))} placeholder="12" />
                </FG>
                <FG label="Monto detracción">
                  <FI type="number" min="0" step="0.01" value={form.detractionAmount || ""} onChange={e => setField("detractionAmount", e.target.value)} placeholder="Calculado automáticamente" />
                </FG>
              </R2>
              <R2>
                <FG label="Estado detracción">
                  <FSl value={detraction.status} onChange={e => setField("detractionStatus", e.target.value)}>
                    {TREASURY_DETRACTION_STATUSES.map(option => <option key={option} value={option}>{option}</option>)}
                  </FSl>
                </FG>
                <FG label="Constancia">
                  <FI value={form.detractionCode || ""} onChange={e => setField("detractionCode", e.target.value)} placeholder="Número de constancia" />
                </FG>
              </R2>
              <R2>
                <FG label="Fecha depósito"><FI type="date" value={form.detractionDate || ""} onChange={e => setField("detractionDate", e.target.value)} /></FG>
                <FG label="Neto a pagar"><FI value={formatTreasuryMoney(detraction.netDirectAmount, form.currency || "CLP")} disabled /></FG>
              </R2>
            </>
          ) : null}
        </div>
      )}
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
      <FG label="Estado">
        <FSl value={form.status || "Pendiente"} onChange={e => setField("status", e.target.value)}>
          {["Pendiente", "Parcial", "Pagada", "Vencida", "Anulada"].map(option => <option key={option} value={option}>{option}</option>)}
        </FSl>
      </FG>
      <ValidationBanner title={validationIssue?.title} detail={validationIssue?.detail} />
      <MFoot
        onClose={onClose}
        label="Guardar"
        disabled={!canSubmit}
        onSave={() => {
          if (!canSubmit) return;
          const finalCurrency = normalizeTreasuryCurrency(form.currency || "CLP");
          const finalDetraction = buildTreasuryDetraction(form, Number(form.total || 0), finalCurrency);
          onSave({
            ...form,
            total: Number(form.total || 0),
            currency: finalCurrency,
            detractionEnabled: !!finalDetraction.enabled,
            detractionRate: finalDetraction.rate,
            detractionAmount: finalDetraction.amount,
            detractionStatus: finalDetraction.status,
            detractionCode: finalDetraction.code,
            detractionDate: finalDetraction.date,
            detractionNotes: finalDetraction.notes,
            detraccionEnabled: !!finalDetraction.enabled,
            detraccionRate: finalDetraction.rate,
            detraccionAmount: finalDetraction.amount,
            detraccionStatus: finalDetraction.status,
            constanciaDetraccion: finalDetraction.code,
            fechaDetraccion: finalDetraction.date,
            directAmount: finalDetraction.netDirectAmount,
            netDirectAmount: finalDetraction.netDirectAmount,
            paid: 0,
            status: form.status || "Pendiente",
          });
        }}
      />
    </Modal>
  );
}
