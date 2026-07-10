import React, { useRef, useState } from "react";
import { GBtn, MFoot, Modal } from "../../lib/ui/components";
import {
  downloadTreasuryImportTemplate,
  parseTreasuryImportFile,
} from "../../lib/utils/treasuryBulkImport";

function modeCopy(mode = "payables") {
  return mode === "receivables"
    ? {
        title: "Importar cuentas por cobrar",
        subtitle: "Carga clientes, documentos emitidos y pagos recibidos desde una planilla.",
        templateLabel: "Descargar plantilla CxC",
        entityLabel: "clientes",
      }
    : {
        title: "Importar cuentas por pagar",
        subtitle: "Carga proveedores, documentos por pagar y pagos realizados desde una planilla.",
        templateLabel: "Descargar plantilla CxP",
        entityLabel: "proveedores",
      };
}

function CountCard({ label, value }) {
  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px", background: "linear-gradient(180deg,#ffffff,#f8fbff)" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--gr2)", fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 850, color: "var(--wh)", fontFamily: "var(--fh)" }}>{value}</div>
    </div>
  );
}

function countDocumentCounterparties(parsed, mode) {
  if (!parsed) return 0;
  if (mode === "receivables") {
    const keys = new Set([
      ...(parsed.clients || []).map(row => row.rut || row.name),
      ...(parsed.documents || []).map(row => row.clientRut || row.clientName),
    ].filter(Boolean));
    return keys.size;
  }
  const keys = new Set([
    ...(parsed.providers || []).map(row => row.rut || row.name),
    ...(parsed.documents || []).map(row => row.providerRut || row.providerName),
  ].filter(Boolean));
  return keys.size;
}

export function TreasuryBulkImporterModal({
  open,
  mode = "payables",
  onClose,
  onApply,
  applying = false,
}) {
  const fileRef = useRef(null);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const copy = modeCopy(mode);

  const reset = () => {
    setParsed(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };
  const handleClose = () => {
    if (applying) return;
    reset();
    onClose?.();
  };
  const handleFile = async event => {
    const file = event.target.files?.[0];
    setError("");
    setParsed(null);
    if (!file) return;
    try {
      const result = await parseTreasuryImportFile(file, mode);
      setParsed(result);
    } catch (err) {
      console.warn("[treasury-import] No pudimos leer la planilla", err);
      setError("No pudimos leer la planilla. Revisa que sea un archivo .xlsx o .csv válido.");
    }
  };
  const entityCount = countDocumentCounterparties(parsed, mode);
  const hasRows = !!parsed && (entityCount > 0 || parsed.documents.length > 0 || parsed.payments.length > 0);
  const canApply = !!parsed && hasRows && !applying && !parsed.issues?.length;
  const previewRows = [
    ...(parsed?.clients || []).slice(0, 3).map(row => ({ type: "Cliente", title: row.name || row.rut, meta: row.rut || "Sin RUT" })),
    ...(parsed?.providers || []).slice(0, 3).map(row => ({ type: "Proveedor", title: row.name || row.rut, meta: row.rut || "Sin RUT" })),
    ...(parsed?.documents || []).slice(0, 4).map(row => ({ type: "Documento", title: row.folio || "Sin folio", meta: row.clientName || row.providerName || row.clientRut || row.providerRut || "Sin contraparte" })),
    ...(parsed?.payments || []).slice(0, 4).map(row => ({ type: "Pago", title: row.folio || row.reference || "Sin folio", meta: row.amount ? String(row.amount) : "Sin monto" })),
  ].slice(0, 8);

  return (
    <Modal open={open} onClose={handleClose} title={copy.title} sub={copy.subtitle}>
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <GBtn onClick={() => { void downloadTreasuryImportTemplate(mode); }}>{copy.templateLabel}</GBtn>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", cursor: "pointer", fontWeight: 800 }}>
            Seleccionar archivo
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFile} style={{ display: "none" }} />
          </label>
        </div>

        <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "rgba(43,109,246,.06)", color: "var(--gr3)", fontSize: 12, lineHeight: 1.55 }}>
          La plantilla tiene hojas separadas para {copy.entityLabel}, documentos y pagos. Si hay errores, Produ te los mostrará antes de importar para evitar cargas incompletas.
        </div>

        {error ? <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,85,102,.28)", background: "rgba(255,85,102,.08)", color: "var(--red)", fontSize: 12 }}>{error}</div> : null}

        {parsed ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
              <CountCard label={copy.entityLabel} value={mode === "receivables" ? parsed.clients.length : parsed.providers.length} />
              <CountCard label={`${copy.entityLabel} únicos`} value={entityCount} />
              <CountCard label="documentos" value={parsed.documents.length} />
              <CountCard label="pagos" value={parsed.payments.length} />
              <CountCard label="alertas" value={parsed.issues.length} />
            </div>

            {parsed.issues.length ? (
              <div style={{ maxHeight: 150, overflow: "auto", padding: 12, borderRadius: 12, border: "1px solid rgba(255,204,68,.35)", background: "rgba(255,204,68,.09)", color: "var(--gr3)", fontSize: 12, lineHeight: 1.55 }}>
                {parsed.issues.slice(0, 12).map(issue => <div key={issue}>• {issue}</div>)}
                {parsed.issues.length > 12 ? <div>• Hay {parsed.issues.length - 12} alerta(s) adicionales.</div> : null}
              </div>
            ) : (
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,224,138,.25)", background: "rgba(0,224,138,.08)", color: "#0f9f68", fontSize: 12, fontWeight: 800 }}>
                La planilla está lista para importar.
              </div>
            )}

            {previewRows.length ? (
              <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, overflow: "hidden" }}>
                {previewRows.map((row, index) => (
                  <div key={`${row.type}-${row.title}-${index}`} style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr", gap: 10, padding: "10px 12px", borderBottom: index === previewRows.length - 1 ? 0 : "1px solid var(--bdr2)", background: index % 2 ? "#ffffff" : "#f8fbff", fontSize: 12 }}>
                    <strong>{row.type}</strong>
                    <span>{row.title}</span>
                    <span style={{ color: "var(--gr2)" }}>{row.meta}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <MFoot
        onClose={handleClose}
        label={applying ? "Importando..." : "Importar datos"}
        disabled={!canApply}
        onSave={() => {
          if (!canApply) return;
          onApply?.(parsed);
        }}
      />
    </Modal>
  );
}
