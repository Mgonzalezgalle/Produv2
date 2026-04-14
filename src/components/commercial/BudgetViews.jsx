import React from "react";
import {
  Badge,
  Btn,
  Card,
  DBtn,
  DetHeader,
  Empty,
  FG,
  FI,
  FSl,
  FTA,
  GBtn,
  KV,
  ModuleHeader,
  MFoot,
  Modal,
  Paginator,
  R2,
  R3,
  SearchBar,
  FilterSel,
  Sep,
  Stat,
  TD,
  TH,
  XBtn,
  ViewModeToggle,
} from "../../lib/ui/components";
import {
  DEFAULT_LISTAS,
  DEFAULT_PRINT_LAYOUTS,
  budgetObservationValue,
  budgetPaymentDateValue,
  budgetPaymentMethodValue,
  budgetPaymentNotesValue,
  budgetRefLabel,
  cobranzaState,
  companyPaymentInfoText,
  companyPrintColor,
  contractVisualState,
  fmtD,
  fmtM,
  fmtMoney,
  hasAddon,
  normalizePrintLayouts,
  recurringSummary,
  today,
  uid,
} from "../../lib/utils/helpers";
import { useLabBudgetDetail } from "../../hooks/useLabBudgetDetail";
import { useLabBudgetForm } from "../../hooks/useLabBudgetForm";
import { useLabBudgetList } from "../../hooks/useLabBudgetList";
import { dbGet } from "../../hooks/useLabDataStore";
let commercialPdfRuntimePromise = null;

async function getCommercialPdfRuntime() {
  if (!commercialPdfRuntimePromise) {
    commercialPdfRuntimePromise = Promise.all([
      import("../../lib/lab/commercialPdfBase"),
      import("../../lib/lab/commercialBudgetPdf"),
    ]).then(([baseModule, budgetModule]) => ({
      generateBudgetPdf: budgetModule.generateBudgetPdf,
      sendBudgetToWhatsApp: budgetModule.sendBudgetToWhatsApp,
      commercialPdfDeps: baseModule.createCommercialPdfDeps({
        dbGet,
        DEFAULT_PRINT_LAYOUTS,
        normalizePrintLayouts,
        hexToRgb: baseModule.hexToRgb,
        companyPaymentInfoText,
        budgetPaymentMethodValue,
        budgetPaymentDateValue,
        budgetPaymentNotesValue,
        budgetObservationValue,
        drawLegalDocStamp: baseModule.drawLegalDocStamp,
        drawDocumentSectionBox: baseModule.drawDocumentSectionBox,
        drawRoundedPdfBox: baseModule.drawRoundedPdfBox,
        drawRightAlignedPdfText: baseModule.drawRightAlignedPdfText,
        drawSummaryPanel: baseModule.drawSummaryPanel,
        measurePdfTextBlock: baseModule.measurePdfTextBlock,
        wrapPdfText: baseModule.wrapPdfText,
        recurringSummary,
        fmtD,
        fmtMoney,
        fmtM,
        today,
        companyPrintColor,
        cobranzaState,
      }),
    }));
  }
  return commercialPdfRuntimePromise;
}

export function BudgetListSection({
  q, setQ, fe, setFe, sortMode, setSortMode, openM, canEdit,
  selectedIds, setSelectedIds, bulkEstado, setBulkEstado, applyBulkEstado, deleteSelected,
  currentPage, toggleAll, toggleSelected, fd, pg, PP, setPg,
  total, aceptados, acceptedCount, clientes, producciones, programas, piezas, contratos,
  recurringSummary, budgetRefLabel, today, fmtM, fmtMoney,
  setEstadoRapido, navTo, onOpenPdf, onSendWhatsApp, onDelete,
  Stat, SearchBar, FilterSel, Btn, FSl, GBtn, DBtn, Card, TH, TD, Badge, Empty, Paginator, XBtn,
}) {
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Total" value={fd.length} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Aceptados" value={acceptedCount} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Monto Total" value={fmtM(total)} sub="todos" accent="var(--cy)"/>
      <Stat label="Monto Aceptado" value={fmtM(aceptados)} sub="aceptados" accent="#00e08a" vc="#00e08a"/>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar presupuesto..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Borrador","Enviado","En Revisión","Aceptado","Rechazado"]} placeholder="Todo estados"/>
      <FilterSel value={sortMode} onChange={v=>{setSortMode(v);setPg(1);}} options={[{value:"recent",label:"Más reciente"},{value:"oldest",label:"Más antiguo"},{value:"az",label:"A-Z"},{value:"za",label:"Z-A"}]} placeholder="Ordenar"/>
      {canEdit&&<Btn onClick={()=>openM("pres",{})}>+ Nuevo Presupuesto</Btn>}
    </div>
    {!!selectedIds.length&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:14,padding:"10px 12px",border:"1px solid var(--bdr2)",borderRadius:12,background:"var(--sur)"}}>
      <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{selectedIds.length} seleccionado{selectedIds.length===1?"":"s"}</div>
      <FSl value={bulkEstado} onChange={e=>setBulkEstado(e.target.value)} style={{maxWidth:200}}>
        <option value="">Cambiar estado...</option>
        {["Borrador","Enviado","En Revisión","Aceptado","Rechazado"].map(opt=><option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={applyBulkEstado}>Aplicar estado</GBtn>
      <DBtn sm onClick={deleteSelected}>Eliminar seleccionados</DBtn>
      <GBtn sm onClick={()=>setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH style={{width:36}}><input type="checkbox" checked={currentPage.length>0 && currentPage.every(item=>selectedIds.includes(item.id))} onChange={e=>toggleAll(e.target.checked)}/></TH><TH onClick={()=>setSortMode(sortMode==="az"?"za":"az")} active={sortMode==="az"||sortMode==="za"} dir={sortMode==="za"?"desc":"asc"}>Título</TH><TH>Cliente</TH><TH>Referencia</TH><TH>Estado</TH><TH>Ítems</TH><TH onClick={()=>setSortMode(sortMode==="oldest"?"recent":"oldest")} active={sortMode==="recent"||sortMode==="oldest"} dir={sortMode==="recent"?"desc":"asc"}>Total</TH><TH>Contrato</TH><TH></TH></tr></thead>
        <tbody>
          {currentPage.map(p=>{
            const c=(clientes||[]).find(x=>x.id===p.cliId);
            return <tr key={p.id} onClick={()=>navTo("pres-det",p.id)}>
              <TD onClick={e=>e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(p.id)} onChange={()=>toggleSelected(p.id)}/></TD>
              <TD><div style={{fontWeight:700}}>{p.titulo}</div><div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{recurringSummary(p, p.cr || today())}</div></TD>
              <TD>{c?c.nom:"—"}</TD>
              <TD style={{fontSize:11}}>{budgetRefLabel(p,producciones,programas,piezas)}</TD>
              <TD><Badge label={p.estado||"Borrador"}/></TD>
              <TD mono style={{fontSize:11}}>{(p.items||[]).length}{p.recurring && <div style={{fontSize:10,color:"#00e08a",marginTop:4}}>{p.recMonths || 1} mes(es)</div>}</TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtMoney(p.total||0,p.moneda||"CLP")}</TD>
              <TD style={{fontSize:11,color:"var(--gr2)"}}>{(contratos||[]).find(ct=>ct.id===p.contratoId)?.nom||"—"}</TD>
              <TD><div style={{display:"flex",gap:4}}>
                <GBtn sm onClick={e=>{e.stopPropagation();navTo("pres-det",p.id);}}>Ver</GBtn>
                <GBtn sm onClick={e=>{e.stopPropagation();onOpenPdf(p,c);}} title="Descargar PDF">⬇</GBtn>
                <GBtn sm onClick={async e=>{e.stopPropagation();await onSendWhatsApp(p,c);}} title="Enviar por WhatsApp">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                </GBtn>
                {canEdit&&<GBtn sm onClick={e=>setEstadoRapido(e,p,"Pendiente")} title="Marcar pendiente">⌛</GBtn>}
                {canEdit&&<GBtn sm onClick={e=>setEstadoRapido(e,p,"Aceptado")} title="Marcar aceptado">✓</GBtn>}
                {canEdit&&<GBtn sm onClick={e=>setEstadoRapido(e,p,"Rechazado")} title="Marcar rechazado">✕</GBtn>}
                {canEdit&&<XBtn onClick={e=>{e.stopPropagation();onDelete(p.id);}}/>}
              </div></TD>
            </tr>;
          })}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin presupuestos" sub={canEdit?"Crea el primero con el botón superior":""}/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </div>;
}

export function ViewPres({ empresa, presupuestos, clientes, producciones, programas, piezas, contratos, navTo, openM, canDo, cSave, cDel, setPresupuestos }) {
  const {
    q,
    setQ,
    fe,
    setFe,
    sortMode,
    setSortMode,
    selectedIds,
    setSelectedIds,
    bulkEstado,
    setBulkEstado,
    pg,
    setPg,
    PP,
    filtered: fd,
    total,
    aceptados,
    acceptedCount,
    setEstadoRapido,
    toggleSelected,
    toggleAll,
    currentPage,
    applyBulkEstado,
    deleteSelected,
  } = useLabBudgetList({
    empresa,
    presupuestos,
    setPresupuestos,
    cSave,
    canEdit: canDo && canDo("presupuestos"),
  });

  return <div>
    <ModuleHeader
      module="Presupuestos"
      title="Presupuestos"
      description="Prepara propuestas comerciales, controla su avance y conecta cada presupuesto con contratos, proyectos y facturación."
      actions={canDo && canDo("presupuestos") ? <Btn onClick={() => openM("pres", {})}>+ Nuevo Presupuesto</Btn> : null}
    />
    <BudgetListSection
      q={q} setQ={setQ}
      fe={fe} setFe={setFe}
      sortMode={sortMode} setSortMode={setSortMode}
      openM={openM} canEdit={canDo && canDo("presupuestos")}
      selectedIds={selectedIds} setSelectedIds={setSelectedIds}
      bulkEstado={bulkEstado} setBulkEstado={setBulkEstado}
      applyBulkEstado={applyBulkEstado} deleteSelected={deleteSelected}
      currentPage={currentPage} toggleAll={toggleAll} toggleSelected={toggleSelected}
      fd={fd} pg={pg} PP={PP} setPg={setPg}
      total={total} aceptados={aceptados} acceptedCount={acceptedCount}
      clientes={clientes} producciones={producciones} programas={programas} piezas={piezas} contratos={contratos}
      recurringSummary={recurringSummary} budgetRefLabel={budgetRefLabel} today={today} fmtM={fmtM} fmtMoney={fmtMoney}
      setEstadoRapido={setEstadoRapido} navTo={navTo}
      onOpenPdf={async (p, c) => {
        const { generateBudgetPdf, commercialPdfDeps } = await getCommercialPdfRuntime();
        return generateBudgetPdf(p, c, empresa, commercialPdfDeps);
      }}
      onSendWhatsApp={async (p, c) => {
        const { sendBudgetToWhatsApp, commercialPdfDeps } = await getCommercialPdfRuntime();
        return sendBudgetToWhatsApp(p, c, empresa, commercialPdfDeps);
      }}
      onDelete={(id) => cDel(presupuestos, setPresupuestos, id, null, "Presupuesto eliminado")}
      Stat={Stat} SearchBar={SearchBar} FilterSel={FilterSel} Btn={Btn} FSl={FSl} GBtn={GBtn} DBtn={DBtn}
      Card={Card} TH={TH} TD={TD} Badge={Badge} Empty={Empty} Paginator={Paginator} XBtn={XBtn}
    />
  </div>;
}

export function ViewCts({ empresa, contratos, clientes, presupuestos, facturas, openM, canDo, cDel, setContratos }) {
  const empId = empresa?.id;
  const [q, setQ] = React.useState("");
  const [fe, setFe] = React.useState("");
  const [sortMode, setSortMode] = React.useState("recent");
  const [selectedIds, setSelectedIds] = React.useState([]);
  const [bulkEstado, setBulkEstado] = React.useState("");
  const [vista, setVista] = React.useState("list");
  const [pg, setPg] = React.useState(1);
  const PP = 10;
  const fd = (contratos || []).filter(x => x.empId === empId).filter(c => c.nom.toLowerCase().includes(q.toLowerCase()) && (!fe || contractVisualState(c) === fe || c.est === fe)).sort((a, b) => {
    if (sortMode === "az") return String(a.nom || "").localeCompare(String(b.nom || ""));
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "amount-desc") return Number(b.mon || 0) - Number(a.mon || 0);
    if (sortMode === "amount-asc") return Number(a.mon || 0) - Number(b.mon || 0);
    if (sortMode === "oldest") return String(a.cr || a.vig || "").localeCompare(String(b.cr || b.vig || ""));
    return String(b.cr || b.vig || "").localeCompare(String(a.cr || a.vig || ""));
  });
  const vigentes = fd.filter(ct => contractVisualState(ct) === "Vigente").length;
  const porVencer = fd.filter(ct => contractVisualState(ct) === "Por vencer").length;
  const vencidos = fd.filter(ct => contractVisualState(ct) === "Vencido").length;
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  return <div>
    <ModuleHeader
      module="Contratos"
      title="Contratos"
      description="Centraliza acuerdos comerciales, vigencias y vínculos con presupuestos y facturas desde una sola vista."
      actions={canDo && canDo("contratos") ? <Btn onClick={() => openM("ct", {})}>+ Nuevo Contrato</Btn> : null}
    />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Total Contratos" value={fd.length} accent="var(--cy)" vc="var(--cy)" />
      <Stat label="Vigentes" value={vigentes} accent="#00e08a" vc="#00e08a" />
      <Stat label="Por vencer" value={porVencer} accent="#ffcc44" vc="#ffcc44" />
      <Stat label="Vencidos" value={vencidos} accent="#ff5566" vc="#ff5566" />
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar contrato..." />
      <FilterSel value={fe} onChange={v => { setFe(v); setPg(1); }} options={["Borrador", "En Revisión", "Firmado", "Vigente", "Vencido"]} placeholder="Todo estados" />
      <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }, { value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }, { value: "amount-desc", label: "Mayor monto" }, { value: "amount-asc", label: "Menor monto" }]} placeholder="Ordenar" />
      <ViewModeToggle value={vista} onChange={setVista} />
    </div>
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}</div>
      <FSl value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} style={{ maxWidth: 190 }}>
        <option value="">Cambiar estado...</option>
        {["Borrador", "En Revisión", "Firmado", "Vigente", "Vencido"].map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={() => {
        if (!bulkEstado) return;
        setContratos((contratos || []).map(item => selectedIds.includes(item.id) ? { ...item, est: bulkEstado } : item));
        setSelectedIds([]);
      }}>Aplicar estado</GBtn>
      {canDo && canDo("contratos") && <DBtn sm onClick={() => {
        if (!confirm(`¿Eliminar ${selectedIds.length} contrato${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`)) return;
        setContratos((contratos || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}>Eliminar seleccionados</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(ct => {
          const c = (clientes || []).find(x => x.id === ct.cliId);
          const vinculos = [(ct.pids || []).length && `${(ct.pids || []).length} vínculo${(ct.pids || []).length === 1 ? "" : "s"}`, ct.presupuestoId && `${(presupuestos || []).filter(p => p.id === ct.presupuestoId).length} presupuesto`, (ct.facturaIds || []).length && `${(ct.facturaIds || []).length} factura${(ct.facturaIds || []).length === 1 ? "" : "s"}`].filter(Boolean).join(" · ");
          return <div key={ct.id} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{ct.nom}</div>
                <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{c?.nom || "Sin cliente"}</div>
              </div>
              <Badge label={contractVisualState(ct)} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Badge label={ct.tip || "Sin tipo"} color="gray" sm />
              {ct.vig && <Badge label={`Vig. ${fmtD(ct.vig)}`} color="cyan" sm />}
            </div>
            <div style={{ fontSize: 11, color: "var(--gr2)" }}>{vinculos || "Sin vínculos"}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--bdr)" }}>
              <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--cy)" }}>{ct.mon ? fmtM(ct.mon) : "—"}</span>
              <div style={{ display: "flex", gap: 4 }}>{canDo && canDo("contratos") && <><GBtn sm onClick={() => openM("ct", ct)}>✏</GBtn><XBtn onClick={() => cDel(contratos, setContratos, ct.id, null, "Contrato eliminado")} /></>}</div>
            </div>
          </div>;
        })}
      </div>
      {!fd.length && <Empty text="Sin contratos" />}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    </> :
      <Card>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onChange={e => toggleAll(e.target.checked)} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Contrato</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Estado</TH><TH onClick={() => setSortMode(sortMode === "amount-desc" ? "amount-asc" : "amount-desc")} active={sortMode === "amount-desc" || sortMode === "amount-asc"} dir={sortMode === "amount-desc" ? "desc" : "asc"}>Monto</TH><TH onClick={() => setSortMode(sortMode === "oldest" ? "recent" : "oldest")} active={sortMode === "recent" || sortMode === "oldest"} dir={sortMode === "recent" ? "desc" : "asc"}>Vigencia</TH><TH>Conexiones</TH><TH></TH></tr></thead>
          <tbody>
            {fd.slice((pg - 1) * PP, pg * PP).map(ct => { const c = (clientes || []).find(x => x.id === ct.cliId); return <tr key={ct.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(ct.id)} onChange={() => toggleSelected(ct.id)} /></TD>
              <TD bold>{ct.nom}</TD><TD>{c ? c.nom : "—"}</TD><TD><Badge label={ct.tip} color="gray" sm /></TD><TD><Badge label={contractVisualState(ct)} /></TD>
              <TD mono style={{ fontSize: 12 }}>{ct.mon ? fmtM(ct.mon) : "—"}</TD>
              <TD mono style={{ fontSize: 11 }}>{ct.vig ? fmtD(ct.vig) : "—"}</TD>
              <TD style={{ fontSize: 11, color: "var(--gr2)" }}>
                {[(ct.pids || []).length && `${(ct.pids || []).length} vinc.`, ct.presupuestoId && `${(presupuestos || []).filter(p => p.id === ct.presupuestoId).length} pres.`, (ct.facturaIds || []).length && `${(ct.facturaIds || []).length} fact.`].filter(Boolean).join(" · ") || "Sin vínculos"}
              </TD>
              <TD><div style={{ display: "flex", gap: 4 }}>{canDo && canDo("contratos") && <><GBtn sm onClick={() => openM("ct", ct)}>✏</GBtn><XBtn onClick={() => cDel(contratos, setContratos, ct.id, null, "Contrato eliminado")} /></>}</div></TD>
            </tr>; })}
            {!fd.length && <tr><td colSpan={9}><Empty text="Sin contratos" /></td></tr>}
          </tbody>
        </table></div>
        <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
      </Card>}
  </div>;
}

export function ViewPresDet({id,empresa,presupuestos,clientes,producciones,programas,piezas,contratos,facturas,navTo,openM,canDo,cSave,cDel,setPresupuestos,setProducciones,setProgramas,setPiezas,setMovimientos}){
  const {
    p,
    c,
    contrato,
    linkedInvoices,
    canPrograms,
    canContracts,
    canInvoices,
    canCreateContent,
    convOpen,
    setConvOpen,
    convTipo,
    setConvTipo,
    convNom,
    setConvNom,
    itemSort,
    setItemSort,
    setEstadoPres,
    convertir,
    sortedItems,
  } = useLabBudgetDetail({
    id,
    empresa,
    presupuestos,
    clientes,
    contratos,
    facturas,
    producciones,
    programas,
    piezas,
    setPresupuestos,
    setProducciones,
    setProgramas,
    setPiezas,
    setMovimientos,
    cSave,
    today,
    uid,
    hasAddon,
    canDo,
  });
  if(!p) return <Empty text="No encontrado"/>;
  return <div>
    <DetHeader title={p.titulo} tag="Presupuesto" badges={[<Badge key={0} label={p.estado||"Borrador"}/>]} meta={[c&&`Cliente: ${c.nom}`,p.cr&&`Creado: ${fmtD(p.cr)}`,`Válido: ${p.validez||30} días`].filter(Boolean)}
      actions={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={async()=>{ const { generateBudgetPdf, commercialPdfDeps } = await getCommercialPdfRuntime(); await generateBudgetPdf(p,c,empresa,commercialPdfDeps); }}>⬇ Descargar PDF</Btn>
        <GBtn onClick={async()=>{ const { sendBudgetToWhatsApp, commercialPdfDeps } = await getCommercialPdfRuntime(); await sendBudgetToWhatsApp(p,c,empresa,commercialPdfDeps); }}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            WhatsApp
          </span>
        </GBtn>
        {canDo&&canDo("presupuestos")&&<GBtn onClick={()=>setEstadoPres("Pendiente")}>Pendiente</GBtn>}
        {canDo&&canDo("presupuestos")&&<GBtn onClick={()=>setEstadoPres("Aceptado")}>Aceptado</GBtn>}
        {canDo&&canDo("presupuestos")&&<GBtn onClick={()=>setEstadoPres("Rechazado")}>Rechazado</GBtn>}
        {canDo&&canDo("presupuestos")&&<GBtn onClick={()=>openM("pres",p)}>✏ Editar</GBtn>}
        {canInvoices&&<Btn onClick={()=>openM("fact",{presupuestoId:p.id,entidadId:p.cliId,tipo:"cliente",tipoRef:p.tipo,proId:p.refId||"",montoNeto:Number(p.subtotal||p.total||0),iva:!!p.iva,contratoId:p.contratoId||"",obs:"",obs2:p.obs||"",recurring:!!p.recurring,recMonths:String(p.recMonths||"6"),recStart:p.recStart||today()})}>🧾 Crear documento tributario</Btn>}
        {p.estado==="Aceptado"&&!p.convertido&&<Btn onClick={()=>setConvOpen(true)} s={{background:"#00e08a",color:"var(--bg)"}}>→ Convertir en {convTipo==="programa"?"Producción":convTipo==="contenido"?"Contenidos":"Proyecto"}</Btn>}
        {canDo&&canDo("presupuestos")&&<DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(presupuestos,setPresupuestos,id,()=>navTo("presupuestos"),"Eliminado");}}>🗑</DBtn>}
      </div>}/>
    {p.convertido&&<div style={{background:"#00e08a18",border:"1px solid #00e08a35",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#00e08a"}}>✓ Convertido en {p.convertido==="produccion"?"proyecto":p.convertido==="programa"?"producción":"campaña de contenidos"}: <b>{p.convertidoNom}</b></div>}
    {(contrato || linkedInvoices.length) && <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      {contrato && canContracts && <Card title="Contrato Asociado">
        <KV label="Contrato" value={contrato.nom}/>
        <KV label="Estado" value={<Badge label={contractVisualState(contrato)}/>}/>
        <KV label="Vigencia" value={contrato.vig?fmtD(contrato.vig):"—"}/>
      </Card>}
      {linkedInvoices.length>0 && canInvoices && <Card title="Facturación Relacionada" sub={`${linkedInvoices.length} orden(es)`}>
        {linkedInvoices.slice(0,3).map(f=><div key={f.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--bdr)"}}>
          <div>
            <div style={{fontSize:12,fontWeight:700}}>{f.correlativo||"Sin correlativo"}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{f.estado||"Pendiente"}</div>
          </div>
          <div style={{fontFamily:"var(--fm)",fontSize:12,color:"var(--cy)"}}>{fmtM(f.total||0)}</div>
        </div>)}
      </Card>}
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Subtotal Neto" value={fmtMoney(p.subtotal||0,p.moneda||"CLP")}/>
      <Stat label={p.honorarios?"Boleta Hon. 15,25%":"IVA 19%"} value={p.iva||p.honorarios?fmtMoney(p.ivaVal||0,p.moneda||"CLP"):"No aplica"}/>
      <Stat label="Total Final" value={fmtMoney(p.total||0,p.moneda||"CLP")} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label={p.recurring?"Proyección":"Ítems"} value={p.recurring?fmtMoney(p.projectedTotal || Number(p.total||0) * Math.max(1, Number(p.recMonths||1)),p.moneda||"CLP"):(p.items||[]).length}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card title="Datos del Presupuesto">
        {[["Correlativo",p.correlativo||"—"],["Cliente",c?.nom||"—"],["Tipo",p.tipo||"—"],["Referencia",budgetRefLabel(p,producciones,programas,piezas)],["Estado",<Badge key={0} label={p.estado||"Borrador"}/>],["Moneda",p.moneda||"CLP"],["Impuesto",p.honorarios?"Boleta Honorarios 15,25%":p.iva?"IVA 19%":"No aplica"],["Validez",`${p.validez||30} días`],["Recurrencia",recurringSummary(p, p.cr || today())],["Contrato asociado",contrato?.nom||"—"],["Documento tributario posterior",p.autoFactura?"Listo para emitir":"Manual"],["Modo detalle",p.modoDetalle==="piezas"?"Precio por piezas":"Ítems personalizados"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Información de Pago">
        {[["Método",p.metodoPago||"—"],["Fecha pago",p.fechaPago?fmtD(p.fechaPago):"—"],["Notas de pago",p.notasPago||"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {companyPaymentInfoText(empresa,{intro:false,dueDate:p.fechaPago||""})&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line"}}>{companyPaymentInfoText(empresa,{intro:false,dueDate:p.fechaPago||""})}</div></>}
      </Card>
    </div>
    <Card title="Detalle de Ítems" style={{marginBottom:16}}>
      {(p.items||[]).length>0?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH onClick={()=>setItemSort(itemSort==="desc-asc"?"desc-desc":"desc-asc")} active={itemSort==="desc-asc"||itemSort==="desc-desc"} dir={itemSort==="desc-desc"?"desc":"asc"}>Descripción</TH><TH>Recurrencia</TH><TH onClick={()=>setItemSort(itemSort==="qty-asc"?"qty-desc":"qty-asc")} active={itemSort==="qty-asc"||itemSort==="qty-desc"} dir={itemSort==="qty-desc"?"desc":"asc"}>Cantidad</TH><TH onClick={()=>setItemSort(itemSort==="price-asc"?"price-desc":"price-asc")} active={itemSort==="price-asc"||itemSort==="price-desc"} dir={itemSort==="price-desc"?"desc":"asc"}>Precio Unit.</TH><TH onClick={()=>setItemSort(itemSort==="total-asc"?"total-desc":"total-asc")} active={itemSort==="total-asc"||itemSort==="total-desc"} dir={itemSort==="total-desc"?"desc":"asc"}>Total</TH></tr></thead>
        <tbody>{sortedItems.map(it=><tr key={it.id}><TD bold>{it.desc||"—"}</TD><TD>{it.recurrence==="monthly"?"Mensual":"Única vez"}</TD><TD mono>{it.qty||0}</TD><TD mono style={{fontSize:12}}>{fmtMoney(it.precio||0,p.moneda||"CLP")}</TD><TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12}}>{fmtMoney(Number(it.qty||0)*Number(it.precio||0),p.moneda||"CLP")}</TD></tr>)}</tbody>
      </table></div>:<Empty text="Sin ítems"/>}
      <div style={{marginTop:16,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:12,color:"var(--gr2)"}}><span>Subtotal Neto</span><span style={{fontFamily:"var(--fm)"}}>{fmtMoney(p.subtotal||0,p.moneda||"CLP")}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:12,color:"var(--gr2)"}}><span>IVA 19%</span><span style={{fontFamily:"var(--fm)"}}>{p.iva||p.honorarios?fmtMoney(p.ivaVal||0,p.moneda||"CLP"):"—"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--bdr)"}}><span>Total Final</span><span style={{fontFamily:"var(--fm)",color:"var(--cy)"}}>{fmtMoney(p.total||0,p.moneda||"CLP")}</span></div>
      </div>
    </Card>
    {(p.notasPago||p.obs)&&<Card title="Observaciones">
      {p.notasPago&&<div style={{marginBottom:p.obs?12:0}}><div style={{fontSize:11,fontWeight:700,color:"var(--wh)",marginBottom:4}}>Notas de pago</div><p style={{fontSize:12,color:"var(--gr3)",margin:0}}>{p.notasPago}</p></div>}
      {p.obs&&<div><div style={{fontSize:11,fontWeight:700,color:"var(--wh)",marginBottom:4}}>Observaciones comerciales</div><p style={{fontSize:12,color:"var(--gr3)",margin:0}}>{p.obs}</p></div>}
    </Card>}
    <Modal open={convOpen} onClose={()=>setConvOpen(false)} title="Convertir presupuesto" sub="Crea el registro operativo correspondiente.">
      <FG label="Tipo de registro"><FSl value={convTipo} onChange={e=>setConvTipo(e.target.value)}><option value="produccion">📽 Nuevo Proyecto</option>{canPrograms&&<option value="programa">📺 Nueva Producción</option>}{canCreateContent&&<option value="contenido">📱 Nueva Campaña de Contenidos</option>}</FSl></FG>
      <FG label={convTipo==="programa"?"Nombre de la producción":convTipo==="contenido"?"Nombre de la campaña":"Nombre del proyecto"}><FI value={convNom} onChange={e=>setConvNom(e.target.value)} placeholder={convTipo==="programa"?"Nombre de la producción":convTipo==="contenido"?"Nombre de la campaña":"Nombre del proyecto"}/></FG>
      <div style={{background:"#00e08a18",border:"1px solid #00e08a35",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#00e08a",marginBottom:16}}>Se creará {convTipo==="produccion"?"un proyecto":convTipo==="programa"?"una producción":"una campaña de contenidos"} con los datos del cliente. Podrás editar{convTipo==="contenido"?"la desde Contenidos":"lo desde el módulo correspondiente"}.</div>
      <MFoot onClose={()=>setConvOpen(false)} onSave={()=>convertir(navTo)} label={convTipo==="programa"?"Crear Producción":convTipo==="contenido"?"Crear Campaña":"Crear Proyecto"}/>
    </Modal>
  </div>;
}

export function MPres({open,data,clientes,producciones,programas,piezas,contratos,listas,onClose,onSave,empresa,currentUser}){
  const {
    f,
    u,
    canPrograms,
    canSocial,
    canContracts,
    canInvoices,
    addItem,
    updItem,
    delItem,
    addPieceLine,
    updPieceLine,
    delPieceLine,
    socialCampaign,
    pieceItems,
    subtotal,
    ivaVal,
    total,
    recurringMonths,
    projectedTotal,
    contratosCli,
    draftRestored,
    discardDraft,
    applyReference,
    buildPayload,
  } = useLabBudgetForm({
    open,
    data,
    empresa,
    currentUser,
    piezas,
    contratos,
    uid,
    today,
    hasAddon,
  });
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Presupuesto":"Nuevo Presupuesto"} sub="Cotización comercial" extraWide>
    {!data?.id&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:12,padding:"10px 12px",border:"1px solid var(--bdr2)",borderRadius:10,background:"var(--sur)"}}>
      <div style={{fontSize:11,color:"var(--gr2)"}}>
        {draftRestored?"Restauramos tu borrador automáticamente.":"Este formulario guarda un borrador automático para evitar pérdida de avance."}
      </div>
      <GBtn sm onClick={discardDraft}>Descartar borrador</GBtn>
    </div>}
    <R2>
      <FG label="Título / Descripción *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Proyecto / Producción Q2 2025"/></FG>
      <FG label="N° Correlativo"><FI value={f.correlativo||""} onChange={e=>u("correlativo",e.target.value)} placeholder="PRES-2025-001"/></FG>
    </R2>
    <FG label="Cliente *"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Seleccionar cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG>
    <R2>
      <FG label="Tipo"><FSl value={f.tipo||"produccion"} onChange={e=>u("tipo",e.target.value)}>{(listas?.tiposPres||DEFAULT_LISTAS.tiposPres).map(o=><option key={o} value={o==="Proyecto"?"produccion":o==="Producción"?"programa":o==="Contenidos"?"contenido":"servicio"}>{o}</option>)}</FSl></FG>
      <FG label="Estado"><FSl value={f.estado||"Pendiente"} onChange={e=>u("estado",e.target.value)}>{(listas?.estadosPres||DEFAULT_LISTAS.estadosPres).map(o=><option key={o}>{o}</option>)}</FSl></FG>
    </R2>
    <R2>
      <FG label={f.tipo==="programa"?"Producción asociada":f.tipo==="contenido"?"Campaña asociada":"Proyecto asociado"}>
        <FSl value={f.refId||""} onChange={e=>applyReference(e.target.value)}>
          <option value="">— Sin referencia directa —</option>
          {f.tipo==="programa"
            ? (canPrograms ? (programas||[]).map(p=><option key={p.id} value={p.id}>📺 {p.nom}</option>) : [])
            : f.tipo==="contenido"
              ? (canSocial ? (piezas||[]).map(p=><option key={p.id} value={p.id}>📱 {p.nom}</option>) : [])
              : (producciones||[]).map(p=><option key={p.id} value={p.id}>📽 {p.nom}</option>)}
        </FSl>
      </FG>
      {canContracts
        ? <FG label="Contrato asociado">
            <FSl value={f.contratoId||""} onChange={e=>u("contratoId",e.target.value)}>
              <option value="">— Sin contrato asociado —</option>
              {contratosCli.map(ct=><option key={ct.id} value={ct.id}>{ct.nom}</option>)}
            </FSl>
          </FG>
        : <FG label="Documento tributario posterior">
            <FSl value={f.autoFactura?"true":"false"} onChange={e=>u("autoFactura",e.target.value==="true")} disabled={!canInvoices}>
              <option value="false">Crear manualmente</option>
              <option value="true">Listo para emitir documento</option>
            </FSl>
          </FG>}
    </R2>
    <R3>
      <FG label="Validez (días)"><FI type="number" value={f.validez||"30"} onChange={e=>u("validez",e.target.value)} placeholder="30"/></FG>
      <FG label="Moneda"><FSl value={f.moneda||"CLP"} onChange={e=>u("moneda",e.target.value)}>{(listas?.monedas||DEFAULT_LISTAS.monedas).map(o=><option key={o}>{o}</option>)}</FSl></FG>
      <FG label="Impuesto"><FSl value={f.honorarios?"hon":f.iva?"iva":"none"} onChange={e=>{const v=e.target.value;u("iva",v==="iva");u("honorarios",v==="hon");}}>
        {(listas?.impuestos||DEFAULT_LISTAS.impuestos).map(o=>{
          const value=o==="IVA 19%"?"iva":o==="Boleta Honorarios 15,25%"?"hon":"none";
          return <option key={o} value={value}>{o}</option>;
        })}
      </FSl></FG>
    </R3>
    <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:f.recurring?12:0}}>
        <div>
          <div style={{fontSize:12,fontWeight:700}}>Servicio recurrente</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>Usa esta opción cuando el presupuesto sea un fee mensual o una prestación continua.</div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)"}}>
          <input type="checkbox" checked={!!f.recurring} onChange={e=>u("recurring",e.target.checked)}/>
          Activar mensualidad
        </label>
      </div>
      {f.recurring && <R2>
        <FG label="Inicio de recurrencia"><FI type="date" value={f.recStart||today()} onChange={e=>u("recStart",e.target.value)}/></FG>
        <FG label="Cantidad de meses"><FSl value={String(f.recMonths||"6")} onChange={e=>u("recMonths",e.target.value)}>
          {Array.from({length:24},(_,i)=>String(i+1)).map(m=><option key={m} value={m}>{m} mes{m==="1"?"":"es"}</option>)}
        </FSl></FG>
      </R2>}
    </div>
    {canSocial && f.tipo==="contenido" && <R2>
      <FG label="Modo de cálculo">
        <FSl value={f.modoDetalle||"items"} onChange={e=>u("modoDetalle",e.target.value)}>
          <option value="piezas">Precio por pieza × cantidad</option>
          <option value="items">Ítems personalizables</option>
        </FSl>
      </FG>
      <FG label="Campaña vinculada">
        <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"10px 12px",fontSize:12,color:"var(--gr3)"}}>
          {socialCampaign ? `${socialCampaign.nom} · ${socialCampaign.mes || ""} ${socialCampaign.ano || ""}`.trim() : "Selecciona una campaña para vincular el presupuesto."}
        </div>
      </FG>
    </R2>}
    <Sep/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Ítems / Detalle Comercial</div>
      {canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas"
        ? <GBtn sm onClick={addPieceLine}>+ Agregar línea de piezas</GBtn>
        : <GBtn sm onClick={addItem}>+ Agregar Ítem</GBtn>}
    </div>
    {canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas"
      ? <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"14px 16px",marginBottom:12}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr style={{background:"var(--bdr)"}}><th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--gr2)",fontWeight:600}}>Detalle</th><th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Recurrencia</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Cantidad de piezas</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:140}}>Precio por pieza</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Total</th><th style={{width:40}}></th></tr></thead>
              <tbody>{pieceItems.map((it,i)=><tr key={it.id} style={{borderTop:"1px solid var(--bdr)"}}>
                <td style={{padding:"6px 12px"}}><input value={it.desc||""} onChange={e=>updPieceLine(i,"desc",e.target.value)} placeholder="Gestión mensual de contenidos" style={{padding:"6px 8px",fontSize:12,borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}/></td>
                <td style={{padding:"6px 8px"}}><select value={it.recurrence||"monthly"} onChange={e=>updPieceLine(i,"recurrence",e.target.value)} style={{padding:"6px 8px",fontSize:12,borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}><option value="monthly">Mensual</option><option value="once">Única vez</option></select></td>
                <td style={{padding:"6px 8px"}}><input type="number" value={it.qty||""} onChange={e=>updPieceLine(i,"qty",e.target.value)} min="1" style={{padding:"6px 8px",fontSize:12,textAlign:"right",borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}/></td>
                <td style={{padding:"6px 8px"}}><input type="number" value={it.precio||""} onChange={e=>updPieceLine(i,"precio",e.target.value)} min="0" style={{padding:"6px 8px",fontSize:12,textAlign:"right",borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}/></td>
                <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"var(--fm)",fontSize:12,color:"var(--wh)",whiteSpace:"nowrap"}}>{fmtMoney(Number(it.qty||0)*Number(it.precio||0),f.moneda||"CLP")}</td>
                <td style={{padding:"6px 8px",textAlign:"center"}}>{pieceItems.length>1&&<XBtn onClick={()=>delPieceLine(i)}/>}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div style={{marginTop:8,fontSize:12,color:"var(--gr2)"}}>
            {socialCampaign ? `La campaña tiene ${socialCampaign.plannedPieces || 0} pieza(s) mensuales planificadas.` : "Puedes cotizar por volumen mensual aunque todavía no haya piezas creadas."}
          </div>
        </div>
      : (f.items||[]).length>0&&<div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden",marginBottom:12}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"var(--bdr)"}}><th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--gr2)",fontWeight:600}}>Descripción</th><th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Recurrencia</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:80}}>Qty</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Precio Unit.</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Total</th><th style={{width:40}}></th></tr></thead>
        <tbody>{(f.items||[]).map((it,i)=><tr key={it.id} style={{borderTop:"1px solid var(--bdr)"}}>
          <td style={{padding:"6px 12px"}}><input value={it.desc||""} onChange={e=>updItem(i,"desc",e.target.value)} placeholder="Descripción del ítem" style={{padding:"6px 8px",fontSize:12,borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}/></td>
          <td style={{padding:"6px 8px"}}><select value={it.recurrence||"once"} onChange={e=>updItem(i,"recurrence",e.target.value)} style={{padding:"6px 8px",fontSize:12,borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}><option value="once">Única vez</option><option value="monthly">Mensual</option></select></td>
          <td style={{padding:"6px 8px"}}><input type="number" value={it.qty||""} onChange={e=>updItem(i,"qty",e.target.value)} min="1" style={{padding:"6px 8px",fontSize:12,textAlign:"right",borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}/></td>
          <td style={{padding:"6px 8px"}}><input type="number" value={it.precio||""} onChange={e=>updItem(i,"precio",e.target.value)} min="0" style={{padding:"6px 8px",fontSize:12,textAlign:"right",borderRadius:8,border:"1px solid var(--bdr2)",background:"var(--card)",color:"var(--wh)",width:"100%"}}/></td>
          <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"var(--fm)",fontSize:12,color:"var(--wh)",whiteSpace:"nowrap"}}>{fmtMoney(Number(it.qty||0)*Number(it.precio||0),f.moneda||"CLP")}</td>
          <td style={{padding:"6px 8px",textAlign:"center"}}><XBtn onClick={()=>delItem(i)}/></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {!(canSocial && f.tipo==="contenido" && f.modoDetalle==="piezas") && !(f.items||[]).length&&<div style={{textAlign:"center",padding:14,color:"var(--gr2)",fontSize:12,border:"1px dashed var(--bdr2)",borderRadius:8,marginBottom:12}}>Sin ítems. Haz clic en "+ Agregar Ítem"</div>}
    <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"var(--gr2)"}}>Subtotal Neto</span><span style={{fontFamily:"var(--fm)",fontSize:13}}>{fmtMoney(subtotal,f.moneda||"CLP")}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"var(--gr2)"}}>IVA 19%</span><span style={{fontFamily:"var(--fm)",fontSize:13}}>{f.iva?fmtMoney(ivaVal,f.moneda||"CLP"):"—"}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid var(--bdr)"}}><span style={{fontSize:13,fontWeight:700}}>Total Final</span><span style={{fontFamily:"var(--fm)",fontSize:15,fontWeight:700,color:"var(--cy)"}}>{fmtMoney(total,f.moneda||"CLP")}</span></div>
      {f.recurring && <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,marginTop:8,borderTop:"1px dashed var(--bdr2)"}}><span style={{fontSize:12,color:"var(--gr2)"}}>Proyección {recurringMonths} mes{recurringMonths===1?"":"es"}</span><span style={{fontFamily:"var(--fm)",fontSize:14,fontWeight:700,color:"#00e08a"}}>{fmtMoney(projectedTotal,f.moneda||"CLP")}</span></div>}
    </div>
    <R2>
      <FG label="Método de Pago"><FI value={f.metodoPago||""} onChange={e=>u("metodoPago",e.target.value)} placeholder="Transferencia, cuotas..."/></FG>
      <FG label="Fecha de Pago"><FI type="date" value={f.fechaPago||""} onChange={e=>u("fechaPago",e.target.value)}/></FG>
    </R2>
    <FG label="Notas de pago"><FTA value={f.notasPago||""} onChange={e=>u("notasPago",e.target.value)} placeholder="Instrucciones de pago, condiciones comerciales o aclaraciones para el cliente..."/></FG>
    <FG label="Observaciones"><FTA value={f.obs||""} onChange={e=>u("obs",e.target.value)} placeholder="Condiciones, notas adicionales..."/></FG>
    {canInvoices && <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
      <div>
        <div style={{fontSize:12,fontWeight:700}}>Preparación de documento tributario</div>
        <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>Si este presupuesto se acepta, quedará listo para crear un documento tributario desde su detalle y ahí podrás elegir cuál.</div>
      </div>
      <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)"}}>
        <input type="checkbox" checked={!!f.autoFactura} onChange={e=>u("autoFactura",e.target.checked)}/>
        Marcar como listo para emitir documento
      </label>
    </div>}
    <MFoot onClose={onClose} onSave={()=>{
      if(!f.titulo?.trim()||!f.cliId)return;
      onSave(buildPayload());
    }}/>
  </Modal>;
}
