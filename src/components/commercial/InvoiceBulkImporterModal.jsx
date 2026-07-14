import React, { useRef, useState } from "react";
import { GBtn, MFoot, Modal } from "../../lib/ui/components";
import {
  downloadBillingImportTemplate,
  getBillingImportFieldOptions,
  inspectBillingImportFile,
  parseBillingImportFile,
} from "../../lib/utils/billingBulkImport";
import { fmtM } from "../../lib/utils/helpers";

function CountCard({ label, value }) {
  return (
    <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px", background: "linear-gradient(180deg,#ffffff,#f8fbff)" }}>
      <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--gr2)", fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 850, color: "var(--wh)", fontFamily: "var(--fh)" }}>{value}</div>
    </div>
  );
}

export function InvoiceBulkImporterModal({
  open,
  clientes = [],
  existingInvoices = [],
  onClose,
  onApply,
  applying = false,
}) {
  const fileRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [mapping, setMapping] = useState({});
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState("");
  const [downloadNotice, setDownloadNotice] = useState("");
  const fieldOptions = getBillingImportFieldOptions();

  const reset = () => {
    setSelectedFile(null);
    setInspection(null);
    setMapping({});
    setParsed(null);
    setError("");
    setDownloadNotice("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    if (applying) return;
    reset();
    onClose?.();
  };

  const parseWithMapping = async (file, nextMapping) => {
    const result = await parseBillingImportFile(file, nextMapping, { clientes, existingInvoices });
    setParsed(result);
  };

  const handleFile = async event => {
    const file = event.target.files?.[0];
    setError("");
    setParsed(null);
    if (!file) return;
    try {
      const nextInspection = await inspectBillingImportFile(file);
      setSelectedFile(file);
      setInspection(nextInspection);
      setMapping(nextInspection.mapping || {});
      await parseWithMapping(file, nextInspection.mapping || {});
    } catch (err) {
      console.warn("[billing-import] No pudimos leer la planilla", err);
      setError("No pudimos leer la planilla. Revisa que sea un archivo .xlsx o .csv válido.");
    }
  };

  const refreshParsedWithMapping = async (nextMapping = mapping) => {
    if (!selectedFile) return;
    setError("");
    try {
      await parseWithMapping(selectedFile, nextMapping);
    } catch (err) {
      console.warn("[billing-import] No pudimos aplicar el mapeo", err);
      setError("No pudimos aplicar el mapeo. Revisa las columnas seleccionadas.");
    }
  };

  const handleMappingChange = (header, field) => {
    const nextMapping = { ...mapping, [header]: field || "__skip" };
    setMapping(nextMapping);
    refreshParsedWithMapping(nextMapping);
  };

  const handleDownloadTemplate = () => {
    setError("");
    setDownloadNotice("");
    try {
      const result = downloadBillingImportTemplate();
      if (!result?.ok) {
        setError("No pudimos iniciar la descarga de la plantilla. Intenta nuevamente.");
        return;
      }
      setDownloadNotice(`Plantilla Excel generada: ${result.fileName}.`);
    } catch (err) {
      console.warn("[billing-import] No pudimos descargar la plantilla", err);
      setError("No pudimos generar la plantilla. Intenta nuevamente.");
    }
  };

  const documents = parsed?.documents || [];
  const issues = parsed?.issues || [];
  const totalAmount = documents.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const canApply = !!parsed && documents.length > 0 && !issues.length && !applying;
  const previewRows = documents.slice(0, 8);

  return (
    <Modal open={open} onClose={handleClose} title="Importar emisión masiva" sub="Carga una planilla y crea documentos en Facturación usando clientes ya existentes.">
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <GBtn onClick={handleDownloadTemplate}>Descargar plantilla Excel</GBtn>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", cursor: "pointer", fontWeight: 800 }}>
            Seleccionar archivo
            <input ref={fileRef} type="file" accept=".xlsx,.csv" onChange={handleFile} style={{ display: "none" }} />
          </label>
        </div>

        <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "rgba(43,109,246,.06)", color: "var(--gr3)", fontSize: 12, lineHeight: 1.55 }}>
          Produ relaciona cada fila con un cliente por RUT o nombre. Si un cliente no existe, la importación se bloquea para evitar documentos mal asociados. La emisión electrónica externa queda para revisión posterior por documento.
        </div>

        {error ? <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(255,85,102,.28)", background: "rgba(255,85,102,.08)", color: "var(--red)", fontSize: 12 }}>{error}</div> : null}
        {downloadNotice ? <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,224,138,.25)", background: "rgba(0,224,138,.08)", color: "#0f9f68", fontSize: 12, fontWeight: 800 }}>{downloadNotice}</div> : null}

        {inspection?.headers?.length ? (
          <div style={{ display: "grid", gap: 10, padding: 12, border: "1px solid var(--bdr2)", borderRadius: 16, background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 850, color: "var(--wh)" }}>Relaciona columnas antes de importar</div>
                <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 3 }}>
                  Hoja detectada: {inspection.sheetName}. Si una columna no corresponde, déjala como “No importar”.
                </div>
              </div>
              <GBtn sm onClick={() => refreshParsedWithMapping(mapping)}>Actualizar lectura</GBtn>
            </div>
            <div style={{ maxHeight: 240, overflow: "auto", border: "1px solid var(--bdr2)", borderRadius: 14 }}>
              {inspection.headers.map((header, index) => {
                const samples = (inspection.sampleRows || [])
                  .map(row => row[index])
                  .filter(value => String(value || "").trim())
                  .slice(0, 3)
                  .join(" · ");
                return (
                  <div key={`${header}-${index}`} style={{ display: "grid", gridTemplateColumns: "minmax(150px,.8fr) minmax(180px,1fr) minmax(160px,1fr)", gap: 10, alignItems: "center", padding: "10px 12px", borderBottom: index === inspection.headers.length - 1 ? 0 : "1px solid var(--bdr2)", fontSize: 12 }}>
                    <strong style={{ color: "var(--wh)" }}>{header || `Columna ${index + 1}`}</strong>
                    <select value={mapping[header] || "__skip"} onChange={event => handleMappingChange(header, event.target.value)} style={{ width: "100%", border: "1px solid var(--bdr2)", borderRadius: 10, padding: "8px 10px", background: "#f8fbff", color: "var(--wh)", fontWeight: 700 }}>
                      <option value="__skip">No importar</option>
                      {fieldOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <span style={{ color: "var(--gr2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{samples || "Sin muestra"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {parsed ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
              <CountCard label="documentos" value={documents.length} />
              <CountCard label="clientes" value={new Set(documents.map(row => row.client?.id).filter(Boolean)).size} />
              <CountCard label="monto total" value={fmtM(totalAmount)} />
              <CountCard label="alertas" value={issues.length} />
            </div>

            {issues.length ? (
              <div style={{ maxHeight: 150, overflow: "auto", padding: 12, borderRadius: 12, border: "1px solid rgba(255,204,68,.35)", background: "rgba(255,204,68,.09)", color: "var(--gr3)", fontSize: 12, lineHeight: 1.55 }}>
                {issues.slice(0, 14).map(issue => <div key={issue}>• {issue}</div>)}
                {issues.length > 14 ? <div>• Hay {issues.length - 14} alerta(s) adicionales.</div> : null}
              </div>
            ) : (
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid rgba(0,224,138,.25)", background: "rgba(0,224,138,.08)", color: "#0f9f68", fontSize: 12, fontWeight: 800 }}>
                La planilla está lista para emitir documentos en Produ.
              </div>
            )}

            {previewRows.length ? (
              <div style={{ border: "1px solid var(--bdr2)", borderRadius: 14, overflow: "hidden" }}>
                {previewRows.map((row, index) => (
                  <div key={`${row.folio}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px 120px", gap: 10, padding: "10px 12px", borderBottom: index === previewRows.length - 1 ? 0 : "1px solid var(--bdr2)", background: index % 2 ? "#ffffff" : "#f8fbff", fontSize: 12 }}>
                    <strong>{row.folio || "Sin folio"}</strong>
                    <span>{row.client?.nom || row.nombreCliente || row.rutCliente || "Cliente no encontrado"}</span>
                    <span>{row.documentType?.label || "Documento"}</span>
                    <span style={{ textAlign: "right", fontWeight: 800 }}>{fmtM(row.total || 0)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <MFoot
        onClose={handleClose}
        label={applying ? "Emitiendo..." : "Emitir documentos"}
        disabled={!canApply}
        onSave={() => {
          if (!canApply) return;
          onApply?.(parsed);
        }}
      />
    </Modal>
  );
}
