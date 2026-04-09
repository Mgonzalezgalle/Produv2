import React from "react";
import { Badge, Btn, Card, DBtn, Empty, FilterSel, FSl, GBtn, Paginator, SearchBar, Stat, TD, TH, ViewModeToggle } from "../../lib/ui/components";
import { exportCrmCsv } from "../../lib/utils/crm";

export function CrmBoard({
  scopedOpps,
  scopedStages,
  tenantUsers,
  q,
  setQ,
  tipo,
  setTipo,
  estado,
  setEstado,
  stageFilter,
  setStageFilter,
  nextActionFilter,
  setNextActionFilter,
  sortKey,
  setSortKey,
  openM,
  setLocalStages,
  setStagesChanged,
  setStagesOpen,
  exportTarget,
  selectedItems,
  tab,
  setTab,
  bulkTipoNegocio,
  setBulkTipoNegocio,
  bulkResponsible,
  setBulkResponsible,
  bulkAssignTipoNegocio,
  bulkAssignResponsible,
  bulkDeleteSelected,
  clearSelection,
  isMobile,
  activeMobileStageId,
  setMobileStageId,
  mobileStage,
  mobileStageItems,
  fmtM,
  setDetailId,
  crmEntityLabel,
  nextActionTone,
  fmtD,
  sorted,
  collapsedStages,
  toggleStageCollapsed,
  updateStage,
  paged,
  selectedIds,
  toggleAllVisible,
  toggleSelected,
  updateQuickField,
  CRM_STATUS_OPTIONS,
  pg,
  setPg,
  PP,
  crmStageMeta,
  canManageCrm,
}) {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <Stat label="Oportunidades" value={scopedOpps.length} accent="var(--cy)" vc="var(--cy)" />
        <Stat label="Pipeline activo" value={scopedOpps.filter(opp => !crmStageMeta(opp.stageId, scopedStages).closedWon && !crmStageMeta(opp.stageId, scopedStages).closedLost).length} />
        <Stat label="Ganadas" value={scopedOpps.filter(opp => crmStageMeta(opp.stageId, scopedStages).closedWon || opp.status === "Ganada").length} accent="#00e08a" vc="#00e08a" />
        <Stat label="Monto estimado" value={fmtM(scopedOpps.reduce((sum, opp) => sum + Number(opp.monto_estimado || 0), 0))} accent="#a855f7" vc="#a855f7" />
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar oportunidad, empresa o contacto..." />
        <FilterSel value={tipo} onChange={v => { setTipo(v); setPg(1); }} options={[{ value: "cliente", label: "Cliente" }, { value: "auspiciador", label: "Auspiciador" }]} placeholder="Todo tipo" />
        <FilterSel value={estado} onChange={v => { setEstado(v); setPg(1); }} options={CRM_STATUS_OPTIONS} placeholder="Todo estado" />
        <FilterSel value={stageFilter} onChange={v => { setStageFilter(v); setPg(1); }} options={scopedStages.map(stage => ({ value: stage.id, label: stage.name }))} placeholder="Todas etapas" />
        <FilterSel value={nextActionFilter} onChange={v => { setNextActionFilter(v); setPg(1); }} options={[{ value: "overdue", label: "Próximas vencidas" }, { value: "today", label: "Próximas hoy" }, { value: "week", label: "Próximas esta semana" }, { value: "scheduled", label: "Con fecha programada" }, { value: "none", label: "Sin fecha" }]} placeholder="Todas las próximas acciones" />
        <FilterSel value={sortKey} onChange={setSortKey} options={[{ value: "updated", label: "Más recientes" }, { value: "close", label: "Cierre estimado" }, { value: "amount", label: "Monto estimado" }, { value: "name", label: "Nombre" }]} placeholder="Ordenar" />
        {canManageCrm && <Btn onClick={() => openM("crm-opp", {})}>+ Nueva oportunidad</Btn>}
        <GBtn onClick={() => exportCrmCsv(exportTarget, scopedStages, tenantUsers)}>{selectedItems.length ? `⬇ ${selectedItems.length} seleccionadas` : "⬇ CSV / Excel"}</GBtn>
      </div>
      {!!selectedItems.length && tab === 1 && canManageCrm && (
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center", padding: "12px 14px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedItems.length} seleccionada{selectedItems.length === 1 ? "" : "s"}</div>
          <div style={{ minWidth: 180, flex: "0 1 220px" }}>
            <FSl value={bulkTipoNegocio || ""} onChange={e => setBulkTipoNegocio(e.target.value)}>
              <option value="">Asignar tipo…</option>
              <option value="cliente">Cliente</option>
              <option value="auspiciador">Auspiciador</option>
            </FSl>
          </div>
          <Btn onClick={bulkAssignTipoNegocio} disabled={!bulkTipoNegocio}>Actualizar tipo</Btn>
          <div style={{ minWidth: 220, flex: "0 1 280px" }}>
            <FSl value={bulkResponsible || ""} onChange={e => setBulkResponsible(e.target.value)}>
              <option value="">Asignar responsable…</option>
              {tenantUsers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </FSl>
          </div>
          <Btn onClick={bulkAssignResponsible} disabled={!bulkResponsible}>Reasignar responsable</Btn>
          <GBtn onClick={() => exportCrmCsv(selectedItems, scopedStages, tenantUsers)}>⬇ Exportar seleccionadas</GBtn>
          <DBtn onClick={bulkDeleteSelected}>Eliminar seleccionadas</DBtn>
          <GBtn onClick={clearSelection}>Limpiar selección</GBtn>
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 16 }}>
        <ViewModeToggle value={tab === 0 ? "cards" : "list"} onChange={mode => { setTab(mode === "cards" ? 0 : 1); setPg(1); }} />
      </div>

      {tab === 0 ? (isMobile ? (
        <>
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 14 }}>
            {scopedStages.map(stage => <button key={stage.id} onClick={() => setMobileStageId(stage.id)} style={{ padding: "9px 12px", borderRadius: 999, border: `1px solid ${activeMobileStageId === stage.id ? "var(--cy)" : "var(--bdr2)"}`, background: activeMobileStageId === stage.id ? "var(--cg)" : "var(--sur)", color: activeMobileStageId === stage.id ? "var(--cy)" : "var(--gr3)", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{stage.name} ({sorted.filter(opp => opp.stageId === stage.id).length})</button>)}
          </div>
          <Card title={mobileStage?.name || "Pipeline"} sub={`${mobileStageItems.length} oportunidad${mobileStageItems.length === 1 ? "" : "es"} · ${fmtM(mobileStageItems.reduce((sum, opp) => sum + Number(opp.monto_estimado || 0), 0))}`} action={canManageCrm ? { label: "+ Nuevo", fn: () => openM("crm-opp", { stageId: activeMobileStageId, status: mobileStage?.closedWon ? "Ganada" : mobileStage?.closedLost ? "Perdida" : "Activa" }) } : null}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mobileStageItems.map(opp => {
                const owner = tenantUsers.find(u => u.id === opp.responsable);
                return <div key={opp.id} onClick={() => setDetailId(opp.id)} style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => { const actionTone = nextActionTone(opp); return <>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{opp.nombre}</div>
                      <Badge label={crmEntityLabel(opp)} color={opp.tipo_negocio === "auspiciador" ? "yellow" : "cyan"} sm />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--gr2)" }}>{opp.empresaMarca}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--gr3)", gap: 8 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{owner?.name || "Sin responsable"}</span>
                      <span style={{ fontFamily: "var(--fm)", color: "var(--cy)", flexShrink: 0 }}>{fmtM(opp.monto_estimado || 0)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, gap: 8 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: actionTone.color }}>{opp.nextAction || "Sin próxima acción"}</span>
                      <span style={{ flexShrink: 0, color: actionTone.color, fontWeight: 700 }}>{opp.nextActionDate ? fmtD(opp.nextActionDate) : "—"}</span>
                    </div>
                  </>; })()}
                </div>;
              })}
              {!mobileStageItems.length && <Empty text="Sin oportunidades en esta etapa" sub="Cambia de etapa o crea una nueva oportunidad." />}
            </div>
          </Card>
        </>
      ) : (
        <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, alignItems: "stretch" }}>
          {scopedStages.map(stage => {
            const stageItems = sorted.filter(opp => opp.stageId === stage.id);
            const totalStage = stageItems.reduce((sum, opp) => sum + Number(opp.monto_estimado || 0), 0);
            const collapsed = collapsedStages.includes(stage.id);
            return <Card key={stage.id} title={collapsed ? <span style={{ writingMode: "vertical-rl", textOrientation: "mixed", display: "inline-block", minHeight: 120 }}>{stage.name}</span> : stage.name} sub={collapsed ? `${stageItems.length}` : `${stageItems.length} oportunidad${stageItems.length === 1 ? "" : "es"} · ${fmtM(totalStage)}`} style={{ padding: 14, minWidth: collapsed ? 86 : 240, width: collapsed ? 86 : 280, flexShrink: 0, transition: "width .2s ease" }} action={{ label: collapsed ? "›" : "‹", fn: () => toggleStageCollapsed(stage.id) }}>
              <div onDragOver={e => e.preventDefault()} onDrop={async e => { e.preventDefault(); const oppId = e.dataTransfer.getData("text/plain"); const opp = scopedOpps.find(item => item.id === oppId); if (opp && opp.stageId !== stage.id) await updateStage(opp, stage.id); }} style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 220, alignItems: collapsed ? "stretch" : "initial" }}>
                {!collapsed && canManageCrm && <GBtn sm onClick={() => openM("crm-opp", { stageId: stage.id, status: stage.closedWon ? "Ganada" : stage.closedLost ? "Perdida" : "Activa" })}>+ Nuevo</GBtn>}
                {collapsed && <div style={{ display: "grid", placeItems: "center", minHeight: 180, color: "var(--gr2)", fontSize: 28, fontWeight: 800 }}>{stageItems.length}</div>}
                {!collapsed && stageItems.map(opp => {
                  const owner = tenantUsers.find(u => u.id === opp.responsable);
                  const actionTone = nextActionTone(opp);
                  return <div key={opp.id} draggable onDragStart={e => e.dataTransfer.setData("text/plain", opp.id)} onClick={() => setDetailId(opp.id)} style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12, cursor: "pointer", display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, width: "100%" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{opp.nombre}</div>
                      <Badge label={crmEntityLabel(opp)} color={opp.tipo_negocio === "auspiciador" ? "yellow" : "cyan"} sm />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--gr2)" }}>{opp.empresaMarca}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--gr3)", width: "100%", gap: 8 }}>
                      <span>{owner?.name || "Sin responsable"}</span>
                      <span style={{ fontFamily: "var(--fm)", color: "var(--cy)" }}>{fmtM(opp.monto_estimado || 0)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, width: "100%", gap: 8, alignItems: "center" }}>
                      <span style={{ color: actionTone.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opp.nextAction || "Sin próxima acción"}</span>
                      <span style={{ flexShrink: 0, color: actionTone.color, fontWeight: 700 }}>{opp.nextActionDate ? fmtD(opp.nextActionDate) : "—"}</span>
                    </div>
                  </div>;
                })}
                {!collapsed && !stageItems.length && <Empty text="Sin oportunidades" sub="Arrastra aquí o crea una nueva." />}
              </div>
            </Card>;
          })}
        </div>
      )) : (
        <Card title="Oportunidades" sub={`${sorted.length} registro${sorted.length === 1 ? "" : "s"} según filtros`}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH style={{ width: 36 }}><input type="checkbox" checked={paged.length > 0 && paged.every(item => selectedIds.includes(item.id))} onChange={toggleAllVisible} /></TH>
                  <TH>Oportunidad</TH>
                  <TH>Empresa / Marca</TH>
                  <TH>Tipo</TH>
                  <TH>Etapa</TH>
                  <TH>Estado</TH>
                  <TH>Responsable</TH>
                  <TH>Monto</TH>
                  <TH>Próxima acción</TH>
                  <TH></TH>
                </tr>
              </thead>
              <tbody>
                {paged.map(opp => {
                  const owner = tenantUsers.find(u => u.id === opp.responsable);
                  const actionTone = nextActionTone(opp);
                  return <tr key={opp.id}>
                    <TD><input type="checkbox" checked={selectedIds.includes(opp.id)} onChange={() => toggleSelected(opp.id)} /></TD>
                    <TD bold style={{ fontSize: 12.5 }}>
                      <div style={{ fontWeight: 700, fontFamily: "var(--fb)" }}>{opp.nombre}</div>
                      <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 4 }}>{opp.contacto || "Sin contacto"}</div>
                    </TD>
                    <TD style={{ fontSize: 12.5 }}>{opp.empresaMarca}</TD>
                    <TD><Badge label={crmEntityLabel(opp)} color={opp.tipo_negocio === "auspiciador" ? "yellow" : "cyan"} sm /></TD>
                    <TD>{canManageCrm ? <FSl value={opp.stageId} onChange={e => updateStage(opp, e.target.value)}>{scopedStages.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</FSl> : (crmStageMeta(opp.stageId, scopedStages).name || "—")}</TD>
                    <TD>{canManageCrm ? <FSl value={opp.status} onChange={e => updateQuickField(opp, "status", e.target.value, "Estado")}>{CRM_STATUS_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}</FSl> : (opp.status || "—")}</TD>
                    <TD style={{ fontSize: 12.5 }}>{canManageCrm ? <FSl value={opp.responsable || ""} onChange={e => updateQuickField(opp, "responsable", e.target.value, "Responsable")}><option value="">—</option>{tenantUsers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</FSl> : ((tenantUsers.find(item => item.id === opp.responsable)?.name) || "—")}</TD>
                    <TD mono style={{ color: "var(--cy)", fontSize: 12 }}>{fmtM(opp.monto_estimado || 0)}</TD>
                    <TD style={{ color: actionTone.color }}>
                      <div style={{ fontSize: 12, fontWeight: 700, fontFamily: "var(--fb)" }}>{opp.nextActionDate ? fmtD(opp.nextActionDate) : "—"}</div>
                      <div style={{ fontSize: 10, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opp.nextAction || "Sin próxima acción"}</div>
                    </TD>
                    <TD><div style={{ display: "flex", gap: 4 }}><GBtn sm onClick={() => setDetailId(opp.id)}>Ver</GBtn>{canManageCrm && <GBtn sm onClick={() => openM("crm-opp", opp)}>✏</GBtn>}</div></TD>
                  </tr>;
                })}
                {!paged.length && <tr><td colSpan={10}><Empty text="Sin oportunidades" sub="Ajusta filtros o crea la primera desde el botón superior." /></td></tr>}
              </tbody>
            </table>
          </div>
          <Paginator page={pg} total={sorted.length} perPage={PP} onChange={setPg} />
        </Card>
      )}
    </>
  );
}
