import React from "react";
import {
  buildProduBillingReferenceSummary,
  evaluateProduBillingBsaleReadiness,
  getProduBillingDocumentTypeLabel,
  requiresProduCollectionTracking,
  resolveProduBillingDocumentType,
} from "../../lib/integrations/billingDomain";

export function InvoiceIssuanceSection({
  q, setQ, fe, setFe, sortMode, setSortMode, openM, canEdit,
  selectedIds, bulkEstado, setBulkEstado, applyBulkEstado, deleteSelected, clearSelection,
  currentPageIds, selectablePageIds, toggleAll, fd, pg, PP, clientes, auspiciadores, producciones, programas, piezas,
  presupuestos, contratos, recurringSummary, today, invoiceEntityName, fmtM, fmtD, Badge,
  SearchBar, FilterSel, GBtn, DBtn, FSl, Card, TH, TD, Empty, Paginator, setPg, toggleSelected, onEditDoc, onDeleteDoc,
  onOpenPdf, sendInvoiceManualEmail, canPres, canContracts, onEmitBsale, onSyncBsale, onInspectBsale, onCreateCreditNote, onCreateDebitNote,
}) {
  const actionChipStyle = {
    padding: "6px 9px",
    borderRadius: 9,
    border: "1px solid var(--bdr2)",
    background: "var(--sur)",
    color: "var(--gr3)",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 700,
    textDecoration: "none",
    lineHeight: 1,
    minHeight: 30,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    whiteSpace: "nowrap",
  };
  const iconChipStyle = {
    ...actionChipStyle,
    minWidth: 30,
    padding: "6px 8px",
  };
  const menuItemStyle = {
    display: "flex",
    width: "100%",
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid var(--bdr2)",
    background: "var(--card)",
    color: "var(--gr3)",
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    textDecoration: "none",
    alignItems: "center",
    justifyContent: "space-between",
    lineHeight: 1.2,
  };
  return <>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);}} placeholder="Buscar invoice o entidad..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);}} options={["Borrador","Emitida","Anulada"]} placeholder="Todo estados"/>
      <FilterSel value={sortMode} onChange={v=>{setSortMode(v);}} options={[{value:"recent",label:"Más reciente"},{value:"oldest",label:"Más antiguo"},{value:"az",label:"A-Z entidad"},{value:"za",label:"Z-A entidad"},{value:"amount-desc",label:"Mayor monto"},{value:"amount-asc",label:"Menor monto"}]} placeholder="Ordenar"/>
      {canEdit&&<button onClick={()=>openM("fact",{tipoDoc:"Factura Afecta",documentTypeCode:"factura_afecta",tipoDocumento:"factura_afecta"})} style={{padding:"10px 14px",borderRadius:10,border:"1px solid var(--cy)",background:"var(--cy)",color:"#051018",fontWeight:800,cursor:"pointer"}}>+ Nuevo documento</button>}
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
        <thead><tr><TH style={{width:36}}><input type="checkbox" checked={selectablePageIds.length>0 && selectablePageIds.every(id=>selectedIds.includes(id))} onChange={e=>toggleAll(e.target.checked)} disabled={!selectablePageIds.length}/></TH><TH onClick={()=>setSortMode(sortMode==="oldest"?"recent":"oldest")} active={sortMode==="recent"||sortMode==="oldest"} dir={sortMode==="recent"?"desc":"asc"}>Documento</TH><TH onClick={()=>setSortMode(sortMode==="az"?"za":"az")} active={sortMode==="az"||sortMode==="za"} dir={sortMode==="za"?"desc":"asc"}>Entidad</TH><TH>Referencia</TH><TH>Estado</TH><TH onClick={()=>setSortMode(sortMode==="amount-desc"?"amount-asc":"amount-desc")} active={sortMode==="amount-desc"||sortMode==="amount-asc"} dir={sortMode==="amount-desc"?"desc":"asc"}>Total</TH><TH>Origen</TH><TH>Fechas</TH><TH style={{textAlign:"right",minWidth:170}}>Acciones</TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(f=>{
            const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
            const ref=f.tipoRef==="produccion"
              ? (producciones||[]).find(x=>x.id===f.proId)
              : (f.tipoRef==="contenido" ? (piezas||[]).find(x=>x.id===f.proId) : (programas||[]).find(x=>x.id===f.proId));
            const pres=(presupuestos||[]).find(x=>x.id===f.presupuestoId);
            const billingType = resolveProduBillingDocumentType(f.documentTypeCode || f.tipoDocumento || f.tipoDoc);
            const bsaleReadiness = evaluateProduBillingBsaleReadiness(f);
            const canEmitBsale = canEdit && billingType?.requiresExternalProvider && bsaleReadiness.status === "ready";
            const externalSync = f.externalSync || null;
            const canSelectRow = !externalSync;
            const referenceSummary = buildProduBillingReferenceSummary(f);
            const electronicStatusLabel = externalSync
              ? (externalSync.status === "synced" ? "Emitido electrónicamente" : "Documento electrónico")
              : null;
            return<tr key={f.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(f.id)} onChange={()=>toggleSelected(f.id)} disabled={!canSelectRow} title={canSelectRow ? "Seleccionar documento" : "Documento emitido electrónicamente: no disponible para acciones masivas"}/></TD>
              <TD style={{paddingTop:14,paddingBottom:14}}>
                <div style={{display:"grid",gap:6,minWidth:160}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,lineHeight:1.15,color:"var(--tx)"}}>{f.correlativo||"—"}</div>
                    <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>{getProduBillingDocumentTypeLabel(f.documentTypeCode || f.tipoDocumento || f.tipoDoc)}</div>
                    <div style={{fontSize:10,color:f.recurring?"#00a86b":"var(--gr2)",marginTop:6,fontWeight:600}}>{recurringSummary(f, f.fechaEmision || today())}</div>
                    {referenceSummary && <div style={{fontSize:10,color:"var(--gr2)",marginTop:5,lineHeight:1.35,maxWidth:220}}>{referenceSummary}</div>}
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    <Badge sm label={bsaleReadiness.label} color={bsaleReadiness.status === "ready" ? "green" : bsaleReadiness.status === "pending_references" ? "yellow" : "gray"} />
                    {externalSync && <Badge sm label={electronicStatusLabel || "Documento electrónico"} color={externalSync.status === "draft" ? "purple" : "gray"} />}
                  </div>
                </div>
              </TD>
              <TD style={{paddingTop:14,paddingBottom:14}}>
                <div style={{display:"grid",gap:4,minWidth:140}}>
                  <div style={{fontSize:14,fontWeight:700,lineHeight:1.25}}>{invoiceEntityName(f, clientes, auspiciadores)}</div>
                  <div style={{fontSize:10,color:"var(--gr2)",fontWeight:600,letterSpacing:".04em",textTransform:"uppercase"}}>{f.tipo==="auspiciador"?"Auspiciador":"Cliente"}</div>
                </div>
              </TD>
              <TD style={{fontSize:11,color:"var(--gr3)",lineHeight:1.4,minWidth:128}}>{ref?`${f.tipoRef==="produccion"?"📽":f.tipoRef==="contenido"?"📱":"📺"} ${ref.nom}`:"—"}</TD>
              <TD><Badge label={f.estado||"Emitida"}/></TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:14,fontWeight:700,whiteSpace:"nowrap"}}>{fmtM(f.total||0)}</TD>
              <TD style={{fontSize:11,color:"var(--gr2)",lineHeight:1.4,minWidth:96}}>{canPres?(pres?.correlativo||pres?.titulo||"—"):"—"}</TD>
              <TD style={{fontSize:11,minWidth:110}}>
                <div style={{fontWeight:600}}>{f.fechaEmision?fmtD(f.fechaEmision):"—"}</div>
                <div style={{color:"var(--gr2)",marginTop:6}}>{f.fechaVencimiento?`Vence ${fmtD(f.fechaVencimiento)}`:"Sin venc."}</div>
              </TD>
              <TD style={{paddingTop:14,paddingBottom:14}}>
                <div style={{display:"grid",gap:6,justifyItems:"end",minWidth:162}}>
                  <div style={{display:"flex",gap:6,alignItems:"center",justifyContent:"flex-end"}}>
                    {externalSync
                      ? <button onClick={()=>onInspectBsale?.(f)} style={actionChipStyle}>Detalle tributario</button>
                      : canEmitBsale
                        ? <button onClick={()=>onEmitBsale?.(f)} style={actionChipStyle}>Emitir electrónico</button>
                        : <button onClick={()=>onOpenPdf(f,ent,ref)} style={actionChipStyle}>⬇ PDF</button>}
                    <details style={{position:"relative"}}>
                      <summary style={{...iconChipStyle,listStyle:"none"}} title="Más acciones">⋯</summary>
                      <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",zIndex:20,width:180,padding:8,borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--card)",boxShadow:"0 18px 36px rgba(15,23,42,.14)",display:"grid",gap:6}}>
                        {canEdit && !externalSync && <button onClick={()=>onEditDoc(f)} style={menuItemStyle}>Editar <span>✏</span></button>}
                        {canEdit && !externalSync && <button onClick={()=>onDeleteDoc(f.id)} style={{...menuItemStyle,color:"#ff6a6a",border:"1px solid #ffd1d1"}}>Eliminar <span>×</span></button>}
                        <button onClick={()=>onOpenPdf(f,ent,ref)} style={menuItemStyle}>Descargar PDF <span>⬇</span></button>
                        <button onClick={()=>sendInvoiceManualEmail?.(f,ent,ref)} style={menuItemStyle}>Crear correo factura <span>✉</span></button>
                        {canEdit && externalSync?.externalDocumentId && ["factura_afecta","factura_exenta"].includes(billingType?.code) && <button onClick={()=>onCreateCreditNote?.(f)} style={menuItemStyle}>Crear NC <span>NC</span></button>}
                        {canEdit && externalSync?.externalReturnId && billingType?.code === "nota_credito" && <button onClick={()=>onCreateDebitNote?.(f)} style={menuItemStyle}>Crear ND <span>ND</span></button>}
                        {canEmitBsale && !externalSync && <button onClick={()=>onEmitBsale?.(f)} style={menuItemStyle}>Emitir electrónico <span>↗</span></button>}
                        {canEmitBsale && externalSync && <button onClick={()=>onSyncBsale?.(f)} style={menuItemStyle}>Actualizar estado <span>↻</span></button>}
                        {externalSync && <button onClick={()=>onInspectBsale?.(f)} style={menuItemStyle}>Detalle tributario <span>◎</span></button>}
                        {externalSync?.pdfUrl && <a href={externalSync.pdfUrl} target="_blank" rel="noreferrer" style={menuItemStyle}>PDF tributario <span>⇱</span></a>}
                        {externalSync?.publicViewUrl && <a href={externalSync.publicViewUrl} target="_blank" rel="noreferrer" style={menuItemStyle}>Ver documento <span>⇱</span></a>}
                      </div>
                    </details>
                  </div>
                  {!externalSync && billingType?.requiresExternalProvider && bsaleReadiness.status !== "ready" && <div style={{fontSize:10,color:"var(--gr2)",maxWidth:204,textAlign:"right",lineHeight:1.35}}>{bsaleReadiness.reason}</div>}
                </div>
              </TD>
            </tr>;
          })}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin órdenes de factura"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </>;
}

export function InvoiceCollectionSection({
  q, setQ, fc, setFc, sortMode, setSortMode, selectedIds, bulkCobranza, setBulkCobranza, applyBulkCobranza,
  clearSelection, currentPageIds, selectablePageIds, toggleAll, cobranzaDocs, pg, PP, clientes, auspiciadores, invoices,
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
        <thead><tr><TH style={{width:36}}><input type="checkbox" checked={selectablePageIds.length>0 && selectablePageIds.every(id=>selectedIds.includes(id))} onChange={e=>toggleAll(e.target.checked)} disabled={!selectablePageIds.length}/></TH><TH onClick={()=>setSortMode(sortMode==="oldest"?"recent":"oldest")} active={sortMode==="recent"||sortMode==="oldest"} dir={sortMode==="recent"?"desc":"asc"}>Documento</TH><TH onClick={()=>setSortMode(sortMode==="az"?"za":"az")} active={sortMode==="az"||sortMode==="za"} dir={sortMode==="za"?"desc":"asc"}>Entidad</TH><TH>Vencimiento</TH><TH onClick={()=>setSortMode(sortMode==="amount-desc"?"amount-asc":"amount-desc")} active={sortMode==="amount-desc"||sortMode==="amount-asc"} dir={sortMode==="amount-desc"?"desc":"asc"}>Monto</TH><TH>Estado de cobro</TH><TH>Acciones</TH></tr></thead>
        <tbody>
          {cobranzaDocs.length ? cobranzaDocs.slice((pg-1)*PP,pg*PP).map(f=>{
            const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
            const cobro=cobranzaState(f);
            const entityDocs=invoices.filter(doc=>doc.tipo===f.tipo && doc.entidadId===f.entidadId);
            const canTrackCollection = requiresProduCollectionTracking(resolveProduBillingDocumentType(f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta")?.code);
            return <tr key={f.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(f.id)} onChange={()=>toggleSelected(f.id)} disabled={!canTrackCollection} title={canTrackCollection ? "Seleccionar documento" : "Este documento no participa en cobranza masiva"}/></TD>
              <TD><div style={{fontWeight:700}}>{f.correlativo||"—"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.recurring?"Recurrente":"Único"}</div></TD>
              <TD>{ent?.nom||"—"}</TD>
              <TD style={{fontSize:11,color:cobro==="Retrasado de pago"?"#ff5566":"var(--gr2)"}}>{f.fechaVencimiento?fmtD(f.fechaVencimiento):"Sin vencimiento"}</TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(f.total||0)}</TD>
              <TD><Badge label={cobro} color={cobro==="Pagado"?"green":cobro==="Retrasado de pago"?"red":cobro==="No pagado"?"gray":"yellow"}/></TD>
              <TD>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                  {canEdit && canTrackCollection && <FSl value={cobro} onChange={e=>saveFacturaDoc({...f,cobranzaEstado:e.target.value,fechaPago:e.target.value==="Pagado"?(f.fechaPago||today()):"",})} style={{minWidth:170}}>
                    {["Pendiente de pago","Pagado","No pagado","Retrasado de pago"].map(st=><option key={st}>{st}</option>)}
                  </FSl>}
                  <GBtn sm onClick={()=>sendBillingEmail(f,ent)}>✉ Crear correo</GBtn>
                  <GBtn sm onClick={()=>sendBillingWhatsApp(f,ent)}>WhatsApp</GBtn>
                  <GBtn sm onClick={()=>sendStatementEmail(entityDocs,ent,f.tipo)}>✉ Crear estado de cuenta</GBtn>
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
