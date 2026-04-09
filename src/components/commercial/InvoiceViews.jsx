import React from "react";
import {
  Badge,
  Btn,
  Card,
  DBtn,
  Empty,
  FG,
  FSl,
  FI,
  FTA,
  GBtn,
  MFoot,
  Modal,
  ModuleHeader,
  Paginator,
  R2,
  R3,
  SearchBar,
  FilterSel,
  Stat,
  Tabs,
  TD,
  TH,
  XBtn,
} from "../../lib/ui/components";
import {
  DEFAULT_LISTAS,
  DEFAULT_PRINT_LAYOUTS,
  addMonths,
  budgetObservationValue,
  budgetPaymentDateValue,
  budgetPaymentMethodValue,
  budgetPaymentNotesValue,
  cobranzaState,
  companyPaymentInfoText,
  companyPrintColor,
  fmtD,
  fmtM,
  fmtMonthPeriod,
  hasAddon,
  invoiceEntityName,
  normalizePrintLayouts,
  recurringSummary,
  today,
  uid,
} from "../../lib/utils/helpers";
import {
  createCommercialPdfDeps,
  drawDocumentSectionBox,
  drawLegalDocStamp,
  drawRightAlignedPdfText,
  drawRoundedPdfBox,
  drawSummaryPanel,
  generateBillingPdf,
  hexToRgb,
  measurePdfTextBlock,
  wrapPdfText,
} from "../../lib/lab/commercialPdf";
import { useLabBillingTools } from "../../hooks/useLabBillingTools";
import { useLabInvoiceForm } from "../../hooks/useLabInvoiceForm";
import { useLabInvoiceList } from "../../hooks/useLabInvoiceList";
import { dbGet } from "../../hooks/useLabDataStore";

const commercialPdfDeps = createCommercialPdfDeps({
  dbGet,
  DEFAULT_PRINT_LAYOUTS,
  normalizePrintLayouts,
  hexToRgb,
  companyPaymentInfoText,
  budgetPaymentMethodValue,
  budgetPaymentDateValue,
  budgetPaymentNotesValue,
  budgetObservationValue,
  drawLegalDocStamp,
  drawDocumentSectionBox,
  drawRoundedPdfBox,
  drawRightAlignedPdfText,
  drawSummaryPanel,
  measurePdfTextBlock,
  wrapPdfText,
  recurringSummary,
  fmtD,
  fmtM,
  today,
  companyPrintColor,
  cobranzaState,
});

export function InvoiceIssuanceSection({
  q, setQ, fe, setFe, sortMode, setSortMode, openM, canEdit,
  selectedIds, bulkEstado, setBulkEstado, applyBulkEstado, deleteSelected, clearSelection,
  currentPageIds, toggleAll, fd, pg, PP, clientes, auspiciadores, producciones, programas, piezas,
  presupuestos, contratos, recurringSummary, today, invoiceEntityName, fmtM, fmtD, Badge,
  SearchBar, FilterSel, GBtn, DBtn, FSl, Card, TH, TD, Empty, Paginator, setPg, toggleSelected, onEditDoc, onDeleteDoc,
  onOpenPdf, canPres, canContracts,
}) {
  return <>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);}} placeholder="Buscar invoice o entidad..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);}} options={["Borrador","Emitida","Anulada"]} placeholder="Todo estados"/>
      <FilterSel value={sortMode} onChange={v=>{setSortMode(v);}} options={[{value:"recent",label:"Más reciente"},{value:"oldest",label:"Más antiguo"},{value:"az",label:"A-Z entidad"},{value:"za",label:"Z-A entidad"},{value:"amount-desc",label:"Mayor monto"},{value:"amount-asc",label:"Menor monto"}]} placeholder="Ordenar"/>
      {canEdit&&<button onClick={()=>openM("fact",{tipoDoc:"Factura"})} style={{padding:"10px 14px",borderRadius:10,border:"1px solid var(--cy)",background:"var(--cy)",color:"#051018",fontWeight:800,cursor:"pointer"}}>+ Nuevo documento</button>}
    </div>
    {!!selectedIds.length&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:14,padding:"10px 12px",border:"1px solid var(--bdr2)",borderRadius:12,background:"var(--sur)"}}>
      <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{selectedIds.length} seleccionado{selectedIds.length===1?"":"s"}</div>
      <FSl value={bulkEstado} onChange={e=>setBulkEstado(e.target.value)} style={{maxWidth:180}}>
        <option value="">Cambiar estado...</option>
        {["Borrador","Emitida","Anulada"].map(opt=><option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={applyBulkEstado}>Aplicar estado</GBtn>
      {canEdit&&<DBtn sm onClick={deleteSelected}>Eliminar seleccionados</DBtn>}
      <GBtn sm onClick={clearSelection}>Limpiar selección</GBtn>
    </div>}
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH style={{width:36}}><input type="checkbox" checked={currentPageIds.length>0 && currentPageIds.every(id=>selectedIds.includes(id))} onChange={e=>toggleAll(e.target.checked)}/></TH><TH onClick={()=>setSortMode(sortMode==="oldest"?"recent":"oldest")} active={sortMode==="recent"||sortMode==="oldest"} dir={sortMode==="recent"?"desc":"asc"}>Documento</TH><TH onClick={()=>setSortMode(sortMode==="az"?"za":"az")} active={sortMode==="az"||sortMode==="za"} dir={sortMode==="za"?"desc":"asc"}>Entidad</TH><TH>Referencia</TH><TH>Estado</TH><TH onClick={()=>setSortMode(sortMode==="amount-desc"?"amount-asc":"amount-desc")} active={sortMode==="amount-desc"||sortMode==="amount-asc"} dir={sortMode==="amount-desc"?"desc":"asc"}>Total</TH><TH>Origen</TH><TH>Contrato</TH><TH>Fechas</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(f=>{
            const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
            const ref=f.tipoRef==="produccion"
              ? (producciones||[]).find(x=>x.id===f.proId)
              : (f.tipoRef==="contenido" ? (piezas||[]).find(x=>x.id===f.proId) : (programas||[]).find(x=>x.id===f.proId));
            const pres=(presupuestos||[]).find(x=>x.id===f.presupuestoId);
            const ct=(contratos||[]).find(x=>x.id===f.contratoId);
            return<tr key={f.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(f.id)} onChange={()=>toggleSelected(f.id)}/></TD>
              <TD><div style={{fontWeight:700}}>{f.correlativo||"—"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.tipoDoc||"Invoice"}</div><div style={{fontSize:10,color:f.recurring?"#00e08a":"var(--gr2)",marginTop:4}}>{recurringSummary(f, f.fechaEmision || today())}</div></TD>
              <TD><div>{invoiceEntityName(f, clientes, auspiciadores)}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.tipo==="auspiciador"?"Auspiciador":"Cliente"}</div></TD>
              <TD style={{fontSize:11}}>{ref?`${f.tipoRef==="produccion"?"📽":f.tipoRef==="contenido"?"📱":"📺"} ${ref.nom}`:"—"}</TD>
              <TD><Badge label={f.estado||"Emitida"}/></TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(f.total||0)}</TD>
              <TD style={{fontSize:11,color:"var(--gr2)"}}>{canPres?(pres?.correlativo||pres?.titulo||"—"):"—"}</TD>
              <TD style={{fontSize:11,color:"var(--gr2)"}}>{canContracts?(ct?.nom||"—"):"—"}</TD>
              <TD style={{fontSize:11}}>
                <div>{f.fechaEmision?fmtD(f.fechaEmision):"—"}</div>
                <div style={{color:"var(--gr2)"}}>{f.fechaVencimiento?`Vence ${fmtD(f.fechaVencimiento)}`:"Sin venc."}</div>
              </TD>
              <TD><div style={{display:"flex",gap:4}}>
                {canEdit&&<><GBtn sm onClick={()=>onEditDoc(f)}>✏</GBtn><button onClick={()=>onDeleteDoc(f.id)} style={{padding:"6px 8px",borderRadius:8,border:"1px solid #f66",background:"transparent",color:"#f88",cursor:"pointer"}}>×</button></>}
                <GBtn sm onClick={()=>onOpenPdf(f,ent,ref)}>⬇ PDF</GBtn>
              </div></TD>
            </tr>;
          })}
          {!fd.length&&<tr><td colSpan={10}><Empty text="Sin órdenes de factura"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </>;
}

export function InvoiceCollectionSection({
  q, setQ, fc, setFc, sortMode, setSortMode, selectedIds, bulkCobranza, setBulkCobranza, applyBulkCobranza,
  clearSelection, currentPageIds, toggleAll, cobranzaDocs, pg, PP, clientes, auspiciadores, invoices,
  cobranzaState, fmtD, fmtM, Badge, SearchBar, FilterSel, GBtn, FSl, Card, TH, TD, Empty, Paginator,
  saveFacturaDoc, canEdit, sendBillingEmail, sendBillingWhatsApp, sendStatementEmail, sendStatementWhatsApp,
  today, toggleSelected, setPg,
}) {
  return <Card title="Cobranza" sub="Cuentas por cobrar por factura o invoice emitido">
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);}} placeholder="Buscar documento o entidad..."/>
      <FilterSel value={fc} onChange={v=>{setFc(v);}} options={["Pendiente de pago","Pagado","No pagado","Retrasado de pago"]} placeholder="Todo cobro"/>
      <FilterSel value={sortMode} onChange={v=>{setSortMode(v);}} options={[{value:"recent",label:"Más reciente"},{value:"oldest",label:"Más antiguo"},{value:"az",label:"A-Z entidad"},{value:"za",label:"Z-A entidad"},{value:"amount-desc",label:"Mayor monto"},{value:"amount-asc",label:"Menor monto"}]} placeholder="Ordenar"/>
    </div>
    {!!selectedIds.length&&<div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:14,padding:"10px 12px",border:"1px solid var(--bdr2)",borderRadius:12,background:"var(--sur)"}}>
      <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{selectedIds.length} seleccionada{selectedIds.length===1?"":"s"}</div>
      <FSl value={bulkCobranza} onChange={e=>setBulkCobranza(e.target.value)} style={{minWidth:180}}>
        <option value="">Cambiar cobranza...</option>
        {["Pendiente de pago","Pagado","No pagado","Retrasado de pago"].map(opt=><option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={applyBulkCobranza}>Aplicar estado</GBtn>
      <GBtn sm onClick={clearSelection}>Limpiar selección</GBtn>
    </div>}
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH style={{width:36}}><input type="checkbox" checked={currentPageIds.length>0 && currentPageIds.every(id=>selectedIds.includes(id))} onChange={e=>toggleAll(e.target.checked)}/></TH><TH onClick={()=>setSortMode(sortMode==="oldest"?"recent":"oldest")} active={sortMode==="recent"||sortMode==="oldest"} dir={sortMode==="recent"?"desc":"asc"}>Documento</TH><TH onClick={()=>setSortMode(sortMode==="az"?"za":"az")} active={sortMode==="az"||sortMode==="za"} dir={sortMode==="za"?"desc":"asc"}>Entidad</TH><TH>Vencimiento</TH><TH onClick={()=>setSortMode(sortMode==="amount-desc"?"amount-asc":"amount-desc")} active={sortMode==="amount-desc"||sortMode==="amount-asc"} dir={sortMode==="amount-desc"?"desc":"asc"}>Monto</TH><TH>Estado de cobro</TH><TH>Acciones</TH></tr></thead>
        <tbody>
          {cobranzaDocs.length ? cobranzaDocs.slice((pg-1)*PP,pg*PP).map(f=>{
            const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
            const cobro=cobranzaState(f);
            const entityDocs=invoices.filter(doc=>doc.tipo===f.tipo && doc.entidadId===f.entidadId);
            return <tr key={f.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(f.id)} onChange={()=>toggleSelected(f.id)}/></TD>
              <TD><div style={{fontWeight:700}}>{f.correlativo||"—"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.recurring?"Recurrente":"Único"}</div></TD>
              <TD>{ent?.nom||"—"}</TD>
              <TD style={{fontSize:11,color:cobro==="Retrasado de pago"?"#ff5566":"var(--gr2)"}}>{f.fechaVencimiento?fmtD(f.fechaVencimiento):"Sin vencimiento"}</TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(f.total||0)}</TD>
              <TD><Badge label={cobro} color={cobro==="Pagado"?"green":cobro==="Retrasado de pago"?"red":cobro==="No pagado"?"gray":"yellow"}/></TD>
              <TD>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {canEdit&&<FSl value={cobro} onChange={e=>saveFacturaDoc({...f,cobranzaEstado:e.target.value,fechaPago:e.target.value==="Pagado"?(f.fechaPago||today()):"",})} style={{minWidth:170}}>
                    {["Pendiente de pago","Pagado","No pagado","Retrasado de pago"].map(st=><option key={st}>{st}</option>)}
                  </FSl>}
                  <GBtn sm onClick={()=>sendBillingEmail(f,ent)}>✉ Correo</GBtn>
                  <GBtn sm onClick={()=>sendBillingWhatsApp(f,ent)}>WhatsApp</GBtn>
                  <GBtn sm onClick={()=>sendStatementEmail(entityDocs,ent,f.tipo)}>Estado cta. correo</GBtn>
                  <GBtn sm onClick={()=>sendStatementWhatsApp(entityDocs,ent,f.tipo)}>Estado cta. WA</GBtn>
                </div>
              </TD>
            </tr>;
          }) : <tr><td colSpan={7}><Empty text="Sin documentos en cobranza" sub="Emite una factura o un invoice para empezar a gestionar su cobranza."/></td></tr>}
        </tbody>
      </table>
    </div>
    <Paginator page={pg} total={cobranzaDocs.length} perPage={PP} onChange={setPg}/>
  </Card>;
}

export function ViewFact({ empresa, facturas, movimientos, clientes, auspiciadores, producciones, programas, piezas, presupuestos, contratos, openM, canDo, cDel, setFacturas, setMovimientos, saveFacturaDoc, ntf }) {
  const canEdit = canDo && canDo("facturacion");
  const canPres = Array.isArray(empresa?.addons) && empresa.addons.includes("presupuestos");
  const canContracts = Array.isArray(empresa?.addons) && empresa.addons.includes("contratos");
  const allDocs = (facturas || []).filter((x) => x.empId === empresa?.id);

  const {
    invoices,
    seriesList,
    pauseSeries,
    cutSeries,
    regenerateSeries,
    sendBillingEmail,
    sendBillingWhatsApp,
    sendStatementEmail,
    sendStatementWhatsApp,
  } = useLabBillingTools({
    allDocs,
    movimientos,
    setFacturas,
    setMovimientos,
    canEdit,
    ntf,
    empresa,
    clientes,
    auspiciadores,
    invoiceEntityName,
    cobranzaState,
    fmtD,
    fmtM,
    fmtMonthPeriod,
    today,
    addMonths,
    uid,
  });

  const cobranzaSourceDocs = allDocs.filter(f => ["Invoice", "Factura"].includes(f.tipoDoc || "Orden de Factura"));

  const {
    tab,
    setTab,
    q,
    setQ,
    fe,
    setFe,
    fc,
    setFc,
    sortMode,
    setSortMode,
    selectedIds,
    setSelectedIds,
    bulkEstado,
    setBulkEstado,
    bulkCobranza,
    setBulkCobranza,
    pg,
    setPg,
    PP,
    fd,
    cobranzaDocs,
    currentPageIds,
    toggleSelected,
    toggleAll,
    cuentasPorCobrar,
    pendiente,
    pagado,
    vencidas,
    emitidas,
    recurrentes,
    applyBulkEstado,
    deleteSelected,
    applyBulkCobranza,
  } = useLabInvoiceList({
    empresa,
    facturas,
    movimientos,
    invoices: cobranzaSourceDocs,
    clientes,
    auspiciadores,
    canEdit,
    setFacturas,
    setMovimientos,
    invoiceEntityName,
    cobranzaState,
    today,
  });

  return <div>
    <ModuleHeader
      module="Facturación"
      title="Facturación"
      description="Emite documentos, controla la cobranza y administra recurrencias dentro del mismo flujo financiero."
    />
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Documentos emitidos" value={fd.length} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Cuentas por cobrar" value={fmtM(pendiente)} accent="#ffcc44" vc="#ffcc44" sub={`${cuentasPorCobrar.length} documento(s)`}/>
      <Stat label="Cobrado" value={fmtM(pagado)} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Emitidos / Recurrentes" value={`${emitidas} / ${recurrentes}`} accent="#ff5566" vc="#ff5566" sub={`atrasadas: ${vencidas}`}/>
    </div>
    <Tabs tabs={["Emisión","Cobranza","Recurrencias"]} active={tab} onChange={(idx)=>{setTab(idx);setPg(1);}}/>
    <div style={{background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"var(--cy)"}}>
      ℹ En Producciones, la facturación solo incluye <b>Auspiciadores Principales y Secundarios</b>. No incluye canjes, colaboradores ni partners.
    </div>
    {tab===0 && <InvoiceIssuanceSection
      q={q} setQ={(v)=>{setQ(v);setPg(1);}}
      fe={fe} setFe={(v)=>{setFe(v);setPg(1);}}
      sortMode={sortMode} setSortMode={(v)=>{setSortMode(v);setPg(1);}}
      openM={openM} canEdit={canEdit}
      selectedIds={selectedIds} bulkEstado={bulkEstado} setBulkEstado={setBulkEstado}
      applyBulkEstado={applyBulkEstado} deleteSelected={deleteSelected} clearSelection={()=>setSelectedIds([])}
      currentPageIds={currentPageIds} toggleAll={toggleAll} toggleSelected={toggleSelected}
      fd={fd} pg={pg} PP={PP} setPg={setPg}
      clientes={clientes} auspiciadores={auspiciadores} producciones={producciones} programas={programas} piezas={piezas}
      presupuestos={presupuestos} contratos={contratos}
      recurringSummary={recurringSummary} today={today} invoiceEntityName={invoiceEntityName}
      fmtM={fmtM} fmtD={fmtD} Badge={Badge}
      SearchBar={SearchBar} FilterSel={FilterSel} GBtn={GBtn} DBtn={DBtn} FSl={FSl} Card={Card} TH={TH} TD={TD} Empty={Empty} Paginator={Paginator}
      onEditDoc={(f)=>openM("fact",f)}
      onDeleteDoc={(id)=>{if(!canEdit) return; cDel(facturas,setFacturas,id,null,"Eliminada");}}
      onOpenPdf={async(f, ent, ref)=>{await generateBillingPdf(f, ent, ref, empresa, commercialPdfDeps);}}
      canPres={canPres} canContracts={canContracts}
    />}
    {tab===1 && <InvoiceCollectionSection
      q={q} setQ={(v)=>{setQ(v);setPg(1);}}
      fc={fc} setFc={(v)=>{setFc(v);setPg(1);}}
      sortMode={sortMode} setSortMode={(v)=>{setSortMode(v);setPg(1);}}
      selectedIds={selectedIds} bulkCobranza={bulkCobranza} setBulkCobranza={setBulkCobranza}
      applyBulkCobranza={applyBulkCobranza} clearSelection={()=>setSelectedIds([])}
      currentPageIds={currentPageIds} toggleAll={toggleAll} cobranzaDocs={cobranzaDocs}
      pg={pg} PP={PP} setPg={setPg} clientes={clientes} auspiciadores={auspiciadores} invoices={invoices}
      cobranzaState={cobranzaState} fmtD={fmtD} fmtM={fmtM} Badge={Badge}
      SearchBar={SearchBar} FilterSel={FilterSel} GBtn={GBtn} FSl={FSl} Card={Card} TH={TH} TD={TD} Empty={Empty} Paginator={Paginator}
      saveFacturaDoc={saveFacturaDoc} canEdit={canEdit}
      sendBillingEmail={sendBillingEmail} sendBillingWhatsApp={sendBillingWhatsApp}
      sendStatementEmail={sendStatementEmail} sendStatementWhatsApp={sendStatementWhatsApp}
      today={today} toggleSelected={toggleSelected}
    />}
    {tab===2 && <Card title="Recurrencias" sub="Administra series activas sin mezclar cobro ni pago">
      {seriesList.length ? <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Serie</TH><TH>Entidad</TH><TH>Estado</TH><TH>Meses</TH><TH>Próximo</TH><TH>Proyección</TH><TH></TH></tr></thead>
          <tbody>
            {seriesList.map((series)=><tr key={series.id}>
              <TD><div style={{fontWeight:700}}>{series.first.correlativo?.replace(/-\d{2}$/,"") || series.first.tipoDoc || "Serie"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{series.first.tipoDoc || "Documento"} · {series.first.tipoRef==="produccion"?"Proyecto":series.first.tipoRef==="contenido"?"Campaña":"Producción"}</div></TD>
              <TD>{series.entityName || "—"}</TD>
              <TD><Badge label={series.status}/></TD>
              <TD mono>{series.docs.length}/{series.totalMonths}</TD>
              <TD style={{fontSize:11}}>{series.nextDate ? fmtMonthPeriod(series.nextDate) : "Sin próximos"}</TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(series.projected)}</TD>
              <TD><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                {canEdit&&series.status!=="Cancelada"&&<GBtn sm onClick={()=>pauseSeries(series)}>{series.status==="Pausada"?"▶ Reactivar":"⏸ Pausar"}</GBtn>}
                {canEdit&&<GBtn sm onClick={()=>regenerateSeries(series)}>↻ Regenerar</GBtn>}
                {canEdit&&series.status!=="Cancelada"&&<XBtn onClick={()=>{if(!confirm("¿Cancelar los meses futuros de esta recurrencia?")) return; cutSeries(series);}} title="Cancelar recurrencia"/>}
              </div></TD>
            </tr>)}
          </tbody>
        </table>
      </div> : <Empty text="Sin recurrencias activas" sub="Crea un documento recurrente desde el botón de nuevo documento."/>}
    </Card>}
  </div>;
}

export function MFact({
  open,
  data,
  empresa,
  clientes,
  auspiciadores,
  producciones,
  programas,
  piezas,
  presupuestos,
  contratos,
  listas,
  onClose,
  onSave,
}) {
  const {
    f,
    setF,
    u,
    canPrograms,
    canPres,
    canContracts,
    applyPresupuesto,
    total,
    projectedTotal,
    ausValidos,
    contratosEntidad,
    buildPayload,
  } = useLabInvoiceForm({
    open,
    data,
    empresa,
    clientes,
    auspiciadores,
    producciones,
    programas,
    piezas,
    presupuestos,
    contratos,
    today,
    hasAddon,
  });

  return <Modal open={open} onClose={onClose} title={data?.id?`Editar ${f.tipoDoc||"Documento"}`:`Nuevo ${f.tipoDoc||"Documento"}`} sub="Registro de cobro y documento comercial">
    {canPres && <FG label="Presupuesto origen">
      <FSl value={f.presupuestoId||""} onChange={(e)=>applyPresupuesto(e.target.value)}>
        <option value="">— Sin presupuesto asociado —</option>
        {(presupuestos||[]).map((p)=><option key={p.id} value={p.id}>{p.correlativo||p.titulo} · {fmtM(p.total||0)}</option>)}
      </FSl>
    </FG>}
    <R3>
      <FG label="Tipo de documento">
        <FSl value={f.recurring?"Invoice":(f.tipoDoc||"Factura")} onChange={(e)=>setF((prev)=>({...prev,tipoDoc:e.target.value,iva:e.target.value==="Invoice"?false:prev.iva,honorarios:e.target.value==="Invoice"?false:prev.honorarios}))} disabled={!!f.recurring}>
          {(listas?.tiposDocFact||DEFAULT_LISTAS.tiposDocFact).map((o)=><option key={o}>{o}</option>)}
        </FSl>
      </FG>
      <FG label="Correlativo Interno"><FI value={f.correlativo||""} onChange={(e)=>u("correlativo",e.target.value)} placeholder="OC-2025-001"/></FG>
      <FG label="Estado del documento"><FSl value={f.estado||"Emitida"} onChange={(e)=>u("estado",e.target.value)}>{(listas?.estadosFact||DEFAULT_LISTAS.estadosFact).map((o)=><option key={o}>{o}</option>)}</FSl></FG>
    </R3>
    <R2>
      <FG label="Tipo Entidad"><FSl value={f.tipo||"cliente"} onChange={(e)=>u("tipo",e.target.value)}>{(listas?.tiposEntidadFact||DEFAULT_LISTAS.tiposEntidadFact).map((o)=><option key={o} value={o==="Auspiciador"?"auspiciador":"cliente"}>{o}</option>)}</FSl></FG>
      <FG label="Tipo Referencia"><FSl value={f.tipoRef||""} onChange={(e)=>u("tipoRef",e.target.value)}><option value="">Sin referencia</option><option value="produccion">Proyecto</option>{canPrograms&&<option value="programa">Producción</option>}{hasAddon(empresa,"social")&&<option value="contenido">Contenidos</option>}</FSl></FG>
    </R2>
    <FG label={f.tipo==="auspiciador"?"Auspiciador (Principal o Secundario) *":"Cliente *"}>
      <FSl value={f.entidadId||""} onChange={(e)=>u("entidadId",e.target.value)}>
        <option value="">— Seleccionar —</option>
        {f.tipo==="auspiciador"
          ? ausValidos.map((a)=><option key={a.id} value={a.id}>{a.nom} · {a.tip}</option>)
          : (clientes||[]).map((c)=><option key={c.id} value={c.id}>{c.nom}</option>)}
      </FSl>
    </FG>
    <R2>
      <FG label="Proyecto / Producción / Campaña">
        <FSl value={f.proId||""} onChange={(e)=>u("proId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          <optgroup label="Proyectos">{(producciones||[]).map((p)=><option key={p.id} value={p.id}>📽 {p.nom}</option>)}</optgroup>
          {canPrograms&&<optgroup label="Producciones">{(programas||[]).map((p)=><option key={p.id} value={p.id}>📺 {p.nom}</option>)}</optgroup>}
          {hasAddon(empresa,"social")&&<optgroup label="Campañas">{(piezas||[]).map((p)=><option key={p.id} value={p.id}>📱 {p.nom}</option>)}</optgroup>}
        </FSl>
      </FG>
    </R2>
    {canContracts && <FG label="Contrato asociado">
      <FSl value={f.contratoId||""} onChange={(e)=>u("contratoId",e.target.value)}>
        <option value="">— Sin contrato asociado —</option>
        {contratosEntidad.map((ct)=><option key={ct.id} value={ct.id}>{ct.nom}</option>)}
      </FSl>
    </FG>}
    <R3>
      <FG label="Monto Neto *"><FI type="number" value={f.montoNeto||""} onChange={(e)=>u("montoNeto",e.target.value)} placeholder="0" min="0"/></FG>
      <FG label="Impuesto">
        <FSl
          value={f.tipoDoc==="Invoice"?"none":f.honorarios?"hon":f.iva?"iva":"none"}
          onChange={(e)=>{
            const value=e.target.value;
            u("iva", value==="iva");
            u("honorarios", value==="hon");
          }}
          disabled={f.tipoDoc==="Invoice"}
        >
          {(listas?.impuestos||DEFAULT_LISTAS.impuestos).map((o)=>{
            const value=o==="IVA 19%"?"iva":o==="Boleta Honorarios 15,25%"?"hon":"none";
            return <option key={o} value={value}>{f.tipoDoc==="Invoice"&&value!=="none" ? `${o} (solo Factura / OF)` : o}</option>;
          })}
        </FSl>
      </FG>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,padding:"9px 12px"}}>
        <div style={{fontSize:10,color:"var(--gr2)",marginBottom:4,fontWeight:600}}>TOTAL</div>
        <div style={{fontFamily:"var(--fm)",fontSize:16,fontWeight:700,color:"var(--cy)"}}>{fmtM(total)}</div>
      </div>
    </R3>
    <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:f.recurring?12:0}}>
        <div>
          <div style={{fontSize:12,fontWeight:700}}>Facturación recurrente</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>La recurrencia siempre se crea desde un Invoice y luego se administra aparte del cobro.</div>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)"}}>
          <input type="checkbox" checked={!!f.recurring} onChange={(e)=>setF((prev)=>({...prev,recurring:e.target.checked,tipoDoc:e.target.checked?"Invoice":prev.tipoDoc,iva:e.target.checked?false:prev.iva,honorarios:e.target.checked?false:prev.honorarios}))}/>
          Activar mensualidad
        </label>
      </div>
      {f.recurring && <R2>
        <FG label="Inicio de serie"><FI type="date" value={f.recStart||f.fechaEmision||today()} onChange={(e)=>{u("recStart",e.target.value); if(!f.fechaEmision) u("fechaEmision",e.target.value);}}/></FG>
        <FG label="Cantidad de meses"><FSl value={String(f.recMonths||"6")} onChange={(e)=>u("recMonths",e.target.value)}>
          {Array.from({length:24},(_,i)=>String(i+1)).map((m)=><option key={m} value={m}>{m} mes{m==="1"?"":"es"}</option>)}
        </FSl></FG>
      </R2>}
      {f.recurring && <div style={{marginTop:8,fontSize:12,color:"var(--gr2)"}}>Proyección de la serie: <span style={{fontFamily:"var(--fm)",color:"#00e08a"}}>{fmtM(projectedTotal)}</span></div>}
    </div>
    <R2>
      <FG label="Fecha Emisión"><FI type="date" value={f.fechaEmision||""} onChange={(e)=>u("fechaEmision",e.target.value)}/></FG>
      <FG label="Fecha Vencimiento"><FI type="date" value={f.fechaVencimiento||""} onChange={(e)=>u("fechaVencimiento",e.target.value)}/></FG>
    </R2>
    <FG label="Observación comercial"><FTA value={f.obs||""} onChange={(e)=>u("obs",e.target.value)} placeholder="Glosa comercial visible para el documento o contexto del cobro..."/></FG>
    <FG label="Observaciones adicionales"><FTA value={f.obs2||""} onChange={(e)=>u("obs2",e.target.value)} placeholder="Notas internas, condiciones o aclaraciones extra..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.entidadId||!f.montoNeto)return;onSave(buildPayload(cobranzaState));}}/>
  </Modal>;
}
