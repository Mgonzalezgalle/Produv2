import { Btn, Card, FG, FI, GBtn, R2 } from "../../lib/ui/components";

export function ImpresosAdminPanel({
  activePrintDoc,
  setActivePrintDoc,
  printForm,
  defaultPrintLayouts,
  updatePrint,
  applyPrintPreset,
  resetPrintLayouts,
  persistPrintLayouts,
  renderPrintPreview,
}) {
  const activeDoc = activePrintDoc === "billing" ? "billing" : "budget";
  const cfg = printForm?.[activeDoc] || defaultPrintLayouts[activeDoc];
  const docLabel = activeDoc === "budget" ? "Presupuestos" : "Facturación";

  return <>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <GBtn sm onClick={() => setActivePrintDoc("budget")} style={activeDoc === "budget" ? { borderColor: "var(--cy)", background: "var(--cg)", color: "var(--cy)" } : undefined}>Presupuestos</GBtn>
      <GBtn sm onClick={() => setActivePrintDoc("billing")} style={activeDoc === "billing" ? { borderColor: "var(--cy)", background: "var(--cg)", color: "var(--cy)" } : undefined}>Facturación</GBtn>
      <span style={{ fontSize: 11, color: "var(--gr2)" }}>Editando: {docLabel}</span>
    </div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      <GBtn sm onClick={() => applyPrintPreset(activeDoc, "compact")}>Preset compacto</GBtn>
      <GBtn sm onClick={() => applyPrintPreset(activeDoc, "balanced")}>Preset base</GBtn>
      <GBtn sm onClick={() => applyPrintPreset(activeDoc, "airy")}>Preset aireado</GBtn>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(320px,.9fr)", gap: 16, alignItems: "start" }}>
      <Card title={`Controles de ${docLabel}`} sub="Ajusta jerarquía, sello legal, resumen y estructura visual.">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)", fontSize: 11, color: "var(--gr2)" }}>Jerarquía general</div>
          <R2>
            <FG label="Color acento"><FI type="color" value={cfg.accent || "#1f2f5f"} onChange={e => updatePrint(activeDoc, "accent", e.target.value)} /></FG>
            <FG label="Título empresa"><FI type="number" min="12" max="28" step="0.1" value={cfg.companyTitleSize || 0} onChange={e => updatePrint(activeDoc, "companyTitleSize", e.target.value)} /></FG>
          </R2>
          <R2>
            <FG label="Meta header"><FI type="number" min="7" max="14" step="0.1" value={cfg.metaSize || 0} onChange={e => updatePrint(activeDoc, "metaSize", e.target.value)} /></FG>
            <FG label="Título sección"><FI type="number" min="7" max="14" step="0.1" value={cfg.sectionTitleSize || 0} onChange={e => updatePrint(activeDoc, "sectionTitleSize", e.target.value)} /></FG>
          </R2>
          <R2>
            <FG label="Texto sección"><FI type="number" min="7" max="13" step="0.1" value={cfg.sectionBodySize || 0} onChange={e => updatePrint(activeDoc, "sectionBodySize", e.target.value)} /></FG>
            <FG label="Etiqueta resumen"><FI type="number" min="6.5" max="12" step="0.1" value={cfg.summaryLabelSize || 0} onChange={e => updatePrint(activeDoc, "summaryLabelSize", e.target.value)} /></FG>
          </R2>
          <R2>
            <FG label="Valor resumen"><FI type="number" min="8" max="16" step="0.1" value={cfg.summaryValueSize || 0} onChange={e => updatePrint(activeDoc, "summaryValueSize", e.target.value)} /></FG>
            <FG label="Ancho sello rojo"><FI type="number" min="130" max="220" step="1" value={cfg.stampWidth || 0} onChange={e => updatePrint(activeDoc, "stampWidth", e.target.value)} /></FG>
          </R2>
          <FG label="Altura sello rojo"><FI type="number" min="68" max="120" step="1" value={cfg.stampHeight || 0} onChange={e => updatePrint(activeDoc, "stampHeight", e.target.value)} /></FG>
          {activeDoc === "budget" && <>
            <div style={{ padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)", fontSize: 11, color: "var(--gr2)" }}>Detalle de servicios</div>
            <R2>
              <FG label="Título detalle"><FI type="number" min="7" max="13" step="0.1" value={cfg.detailTitleSize || 0} onChange={e => updatePrint(activeDoc, "detailTitleSize", e.target.value)} /></FG>
              <FG label="Header tabla"><FI type="number" min="6.5" max="11" step="0.1" value={cfg.detailHeaderSize || 0} onChange={e => updatePrint(activeDoc, "detailHeaderSize", e.target.value)} /></FG>
            </R2>
            <R2>
              <FG label="Texto ítems"><FI type="number" min="6.2" max="10" step="0.1" value={cfg.detailBodySize || 0} onChange={e => updatePrint(activeDoc, "detailBodySize", e.target.value)} /></FG>
              <FG label="Ancho detalle"><FI type="number" min="240" max="360" step="1" value={cfg.detailColWidth || 280} onChange={e => updatePrint(activeDoc, "detailColWidth", e.target.value)} /></FG>
            </R2>
            <R2>
              <FG label="Ancho recurrencia"><FI type="number" min="56" max="110" step="1" value={cfg.recurrenceColWidth || 78} onChange={e => updatePrint(activeDoc, "recurrenceColWidth", e.target.value)} /></FG>
              <FG label="Ancho cantidad"><FI type="number" min="28" max="64" step="1" value={cfg.qtyColWidth || 34} onChange={e => updatePrint(activeDoc, "qtyColWidth", e.target.value)} /></FG>
            </R2>
            <R2>
              <FG label="Ancho valor unitario"><FI type="number" min="56" max="110" step="1" value={cfg.unitColWidth || 74} onChange={e => updatePrint(activeDoc, "unitColWidth", e.target.value)} /></FG>
              <FG label="Ancho total"><FI type="number" min="32" max="80" step="1" value={cfg.totalColWidth || 48} onChange={e => updatePrint(activeDoc, "totalColWidth", e.target.value)} /></FG>
            </R2>
          </>}
        </div>
      </Card>
      <div style={{ display: "grid", gap: 16, position: "sticky", top: 12 }}>
        {renderPrintPreview(activeDoc, cfg)}
        <Card title="Acciones" sub="Guarda o vuelve a la composición base.">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn onClick={persistPrintLayouts}>Guardar composición</Btn>
            <GBtn onClick={() => applyPrintPreset(activeDoc, "balanced")}>Volver a preset base</GBtn>
            <GBtn onClick={resetPrintLayouts}>Restablecer defaults</GBtn>
          </div>
        </Card>
      </div>
    </div>
  </>;
}
