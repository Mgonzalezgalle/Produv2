import React from "react";
import {
  DEFAULT_LISTAS,
  fmtD,
  fmtM,
  hasAddon,
  today,
} from "../../lib/utils/helpers";
import {
  canProduBillingDocumentBeReferenced,
  getDefaultProduBillingReferenceReason,
  getProduBillingDocumentTypeLabel,
  getProduBillingDocumentTypeOptions,
  getProduBillingReferenceCodeLabel,
  getProduBillingReferenceCodeOptions,
  getProduBillingReferenceReasonOptions,
  requiresProduBillingReferences,
  resolveProduBillingDocumentType,
  supportsProduDocumentHonorarios,
  supportsProduDocumentVat,
} from "../../lib/integrations/billingDomain";
import { useLabInvoiceForm } from "../../hooks/useLabInvoiceForm";
import { FSl, FG, FI, FTA, GBtn, MFoot, Modal, R2, R3 } from "../../lib/ui/components";

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
  facturas,
  purchaseOrders = [],
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
    addItem,
    updItem,
    delItem,
    mn,
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
  const selectedBillingType = resolveProduBillingDocumentType(
    f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
  );
  const effectiveReferenceValue = String(f.relatedDocumentId || f.relatedDocumentFolio || f.treasuryPurchaseOrderId || "").trim();
  const requiresReference = requiresProduBillingReferences(selectedBillingType.code);
  const validationMessage = !f.entidadId
    ? `Selecciona un ${f.tipo === "auspiciador" ? "auspiciador" : "cliente"} para continuar.`
    : mn <= 0
      ? "Ingresa un monto neto o agrega al menos un ítem con valor."
      : ((requiresReference || !!f.referenceCodeSii) && !effectiveReferenceValue)
        ? "Completa la referencia del documento antes de guardar."
        : "";
  const canSubmit = !validationMessage;
  const billingTypeOptions = getProduBillingDocumentTypeOptions();
  const referenceCodeOptions = getProduBillingReferenceCodeOptions();
  const relatedPurchaseOrderOptions = (purchaseOrders || []).filter((item) => (
    item?.clientId === f.entidadId || !f.entidadId
  ));
  const relatedDocumentOptions = ((facturas || []).filter(item =>
    item?.id !== data?.id &&
    item?.empId === empresa?.id &&
    canProduBillingDocumentBeReferenced(
      resolveProduBillingDocumentType(item.documentTypeCode || item.tipoDocumento || item.tipoDoc)?.code,
    )
  ));
  const taxOptions = [
    { value: "none", label: "Sin impuesto" },
    ...(supportsProduDocumentVat(selectedBillingType.code) ? [{ value: "iva", label: "IVA 19%" }] : []),
    ...(supportsProduDocumentHonorarios(selectedBillingType.code) ? [{ value: "hon", label: "Boleta Honorarios 15,25%" }] : []),
  ];
  const isElectronicDocumentLocked = !!data?.externalSync;

  return <Modal extraWide open={open} onClose={onClose} title={data?.id?`${isElectronicDocumentLocked ? "Detalle" : "Editar"} ${f.tipoDoc||"Documento"}`:`Nuevo ${f.tipoDoc||"Documento"}`} sub={isElectronicDocumentLocked ? "Documento emitido electrónicamente. Solo lectura para proteger consistencia tributaria." : "Registro de cobro y documento comercial"}>
    {isElectronicDocumentLocked && (
      <div style={{marginBottom:14,padding:"12px 14px",borderRadius:10,border:"1px solid color-mix(in srgb, var(--cy) 22%, var(--bdr2) 78%)",background:"color-mix(in srgb, var(--cy) 10%, var(--card) 90%)",fontSize:12,color:"var(--gr3)",lineHeight:1.5}}>
        Este documento ya fue emitido electrónicamente. Dejamos bloqueada su edición estructural para evitar diferencias entre Produ y el motor tributario.
      </div>
    )}
    <fieldset disabled={isElectronicDocumentLocked} style={{margin:0,padding:0,border:"none",minWidth:0}}>
    {canPres && <FG label="Presupuesto origen">
      <FSl value={f.presupuestoId||""} onChange={(e)=>applyPresupuesto(e.target.value)}>
        <option value="">— Sin presupuesto asociado —</option>
        {(presupuestos||[]).map((p)=><option key={p.id} value={p.id}>{p.correlativo||p.titulo} · {fmtM(p.total||0)}</option>)}
      </FSl>
    </FG>}
    <R3>
      <FG label="Tipo de documento">
        <FSl value={selectedBillingType.label} onChange={(e)=>{
          const nextType = resolveProduBillingDocumentType(e.target.value);
          setF((prev)=>({
            ...prev,
            tipoDoc: nextType.label,
            documentTypeCode: nextType.code,
            tipoDocumento: nextType.code,
            iva: supportsProduDocumentVat(nextType.code) ? prev.iva : false,
            honorarios: supportsProduDocumentHonorarios(nextType.code) ? prev.honorarios : false,
            relatedDocumentId: requiresProduBillingReferences(nextType.code) ? prev.relatedDocumentId : "",
            referenceKind: requiresProduBillingReferences(nextType.code) ? (prev.referenceKind || "document") : prev.referenceKind,
            relatedDocumentFolio: requiresProduBillingReferences(nextType.code) ? prev.relatedDocumentFolio : "",
            relatedDocumentTypeCode: requiresProduBillingReferences(nextType.code) ? prev.relatedDocumentTypeCode : "",
            relatedDocumentDate: requiresProduBillingReferences(nextType.code) ? prev.relatedDocumentDate : "",
            relatedDocumentReason: requiresProduBillingReferences(nextType.code)
              ? (prev.relatedDocumentReason || getDefaultProduBillingReferenceReason(nextType.code))
              : "",
            relatedExternalDocumentId: requiresProduBillingReferences(nextType.code) ? prev.relatedExternalDocumentId : "",
          }));
        }} disabled={!!f.recurring}>
          {billingTypeOptions.map((o)=><option key={o.code} value={o.value}>{o.label}</option>)}
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
    <R2>
      <FG label="Código de referencia">
        <FSl value={f.referenceCodeSii||""} onChange={(e)=>{
          const nextCode = e.target.value;
          const nextRef = referenceCodeOptions.find((item) => item.value === nextCode);
          const nextKind = nextCode === "document" ? "document" : nextCode ? "tax_reference" : "";
          setF((prev)=>({
            ...prev,
            referenceKind: nextKind,
            referenceCodeSii: nextCode,
            treasuryPurchaseOrderId: nextCode === "801" ? (prev.treasuryPurchaseOrderId || "") : "",
            relatedDocumentId: nextCode === "document" ? prev.relatedDocumentId : "",
            relatedDocumentFolio: nextCode ? prev.relatedDocumentFolio : "",
            relatedDocumentTypeCode: nextCode === "document" ? prev.relatedDocumentTypeCode : (nextCode === "801" ? "orden_compra" : ""),
            relatedDocumentDate: nextCode ? prev.relatedDocumentDate : "",
            relatedDocumentReason: nextKind
              ? (prev.relatedDocumentReason || (nextCode === "document"
                ? getDefaultProduBillingReferenceReason(selectedBillingType.code)
                : `${nextRef?.label || getProduBillingReferenceCodeLabel(nextCode)} ${prev.relatedDocumentFolio || ""}`.trim()))
              : "",
            relatedExternalDocumentId: nextCode === "document" ? prev.relatedExternalDocumentId : "",
          }));
        }}>
          {referenceCodeOptions.map((option)=><option key={option.value || "none"} value={option.value}>{option.codeSii ? `${option.codeSii} · ${option.label}` : option.label}</option>)}
        </FSl>
      </FG>
      <FG label="Valor de referencia">
        <FI value={f.relatedDocumentFolio||""} onChange={(e)=>{
          const nextValue = e.target.value;
          const selectedRef = referenceCodeOptions.find((item) => item.value === (f.referenceCodeSii || ""));
          setF((prev)=>({
            ...prev,
            relatedDocumentFolio: nextValue,
            relatedDocumentReason: prev.referenceCodeSii && prev.referenceCodeSii !== "document"
              ? `${selectedRef?.label || getProduBillingReferenceCodeLabel(prev.referenceCodeSii)} ${nextValue}`.trim()
              : prev.relatedDocumentReason,
          }));
        }} placeholder="Número, folio o valor de la referencia" />
      </FG>
    </R2>
    {f.referenceCodeSii === "801" && <>
      <FG label="Orden de Compra">
        <FSl value={f.treasuryPurchaseOrderId||""} onChange={(e)=>{
          const nextId = e.target.value;
          const selectedOrder = relatedPurchaseOrderOptions.find((item) => item.id === nextId);
          setF((prev)=>({
            ...prev,
            treasuryPurchaseOrderId: nextId,
            relatedDocumentId: "",
            relatedDocumentFolio: selectedOrder?.number || "",
            referenceCodeSii: "801",
            relatedDocumentTypeCode: "orden_compra",
            relatedDocumentDate: selectedOrder?.issueDate || "",
            relatedDocumentReason: selectedOrder?.number ? `Orden de Compra ${selectedOrder.number}` : "Orden de Compra",
            relatedExternalDocumentId: "",
          }));
        }}>
          <option value="">— Seleccionar OC —</option>
          {relatedPurchaseOrderOptions.map((item)=><option key={item.id} value={item.id}>{item.number} · {item.clientName || "Cliente"} · {fmtM(item.amount || 0)}</option>)}
        </FSl>
      </FG>
      <R2>
        <FG label="Número OC">
          <FI value={f.relatedDocumentFolio||""} onChange={(e)=>u("relatedDocumentFolio",e.target.value)} placeholder="Número de la OC" />
        </FG>
        <FG label="Fecha OC">
          <FI type="date" value={f.relatedDocumentDate||""} onChange={(e)=>u("relatedDocumentDate",e.target.value)} />
        </FG>
      </R2>
      <div style={{fontSize:11,color:"var(--gr2)",marginTop:-6,marginBottom:12}}>Esta referencia viajará a Bsale como `Orden de Compra` con código tributario `801`.</div>
    </>}
    {(requiresReference || f.referenceCodeSii === "document") && <>
      <FG label="Documento de referencia">
        <FSl value={f.relatedDocumentId||""} onChange={(e)=>{
          const nextId = e.target.value;
          const related = relatedDocumentOptions.find(item => item.id === nextId);
          setF(prev => ({
            ...prev,
            referenceCodeSii: "document",
            referenceKind: "document",
            relatedDocumentId: nextId,
            relatedDocumentFolio: related?.correlativo || "",
            relatedDocumentTypeCode: related ? resolveProduBillingDocumentType(related.documentTypeCode || related.tipoDocumento || related.tipoDoc)?.code || "" : "",
            relatedDocumentDate: related?.fechaEmision || related?.fecha || "",
            relatedDocumentReason: prev.relatedDocumentReason || getDefaultProduBillingReferenceReason(selectedBillingType.code),
            relatedExternalDocumentId: related?.externalSync?.externalDocumentId || "",
          }));
        }} disabled={f.referenceCodeSii === "801"}>
          <option value="">— Seleccionar documento origen —</option>
          {relatedDocumentOptions.map((item)=><option key={item.id} value={item.id}>{item.correlativo || item.id} · {getProduBillingDocumentTypeLabel(item.documentTypeCode || item.tipoDocumento || item.tipoDoc)}</option>)}
        </FSl>
      </FG>
      <R2>
        <FG label="Folio / número referencia">
          <FI value={f.relatedDocumentFolio||""} onChange={(e)=>u("relatedDocumentFolio",e.target.value)} placeholder="Folio o número del documento origen" disabled={f.referenceCodeSii === "801"} />
        </FG>
        <FG label="Motivo de referencia">
          <FSl value={f.relatedDocumentReason||getDefaultProduBillingReferenceReason(selectedBillingType.code)} onChange={(e)=>u("relatedDocumentReason",e.target.value)} disabled={f.referenceCodeSii === "801"}>
            {getProduBillingReferenceReasonOptions(selectedBillingType.code).map((option)=><option key={option} value={option}>{option}</option>)}
          </FSl>
        </FG>
      </R2>
      <div style={{fontSize:11,color:"var(--gr2)",marginTop:-6,marginBottom:12}}>Para `Notas` y `Guía de Despacho`, deja indicado el documento origen o al menos su folio para preparar una emisión tributaria consistente.</div>
    </>}
    <div style={{marginBottom:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:10}}>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Detalle de facturación</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginTop:4}}>Aquí indicamos exactamente qué se está facturando. Si el documento nace desde un presupuesto, puedes ajustar el detalle antes de emitir.</div>
        </div>
        <GBtn sm onClick={addItem}>+ Agregar Ítem</GBtn>
      </div>
      {(f.items||[]).length ? (
        <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,overflow:"hidden"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:"color-mix(in srgb, var(--card) 78%, white 22%)"}}>
                <th style={{textAlign:"left",padding:"10px 12px",fontSize:11,color:"var(--gr2)",fontWeight:700}}>Detalle</th>
                <th style={{textAlign:"left",padding:"10px 12px",fontSize:11,color:"var(--gr2)",fontWeight:700,width:96}}>Cant.</th>
                <th style={{textAlign:"left",padding:"10px 12px",fontSize:11,color:"var(--gr2)",fontWeight:700,width:120}}>P. Unit.</th>
                <th style={{textAlign:"right",padding:"10px 12px",fontSize:11,color:"var(--gr2)",fontWeight:700,width:120}}>Total</th>
                <th style={{width:56}} />
              </tr>
            </thead>
            <tbody>
              {(f.items||[]).map((item, index)=>{
                const lineTotal = Number(item.qty || 0) * Number(item.precio || 0);
                return (
                  <tr key={item.id || index} style={{borderTop:"1px solid var(--bdr2)"}}>
                    <td style={{padding:10}}>
                      <FI value={item.desc || ""} onChange={(e)=>updItem(index, "desc", e.target.value)} placeholder="Describe lo que se está facturando..." />
                    </td>
                    <td style={{padding:10}}>
                      <FI type="number" min="0" step="1" value={item.qty ?? 1} onChange={(e)=>updItem(index, "qty", e.target.value)} placeholder="1" />
                    </td>
                    <td style={{padding:10}}>
                      <FI type="number" min="0" step="0.01" value={item.precio ?? 0} onChange={(e)=>updItem(index, "precio", e.target.value)} placeholder="0" />
                    </td>
                    <td style={{padding:"10px 12px",textAlign:"right",fontFamily:"var(--fm)",fontSize:13,fontWeight:700,color:"var(--gr3)"}}>
                      {fmtM(lineTotal)}
                    </td>
                    <td style={{padding:10}}>
                      <button type="button" onClick={()=>delItem(index)} style={{width:34,height:34,borderRadius:10,border:"1px solid #ffb8b8",background:"#fff",color:"#ff5c5c",fontWeight:800,cursor:"pointer"}} aria-label="Eliminar ítem">×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{padding:"14px 16px",borderRadius:10,border:"1px dashed var(--bdr2)",background:"color-mix(in srgb, var(--sur) 82%, white 18%)",fontSize:12,color:"var(--gr2)"}}>
          Sin detalle todavía. Agrega ítems para dejar claro qué se está facturando.
        </div>
      )}
    </div>
    <R3>
      <FG label="Monto Neto *">
        <FI type="number" value={(f.items||[]).length ? String(mn || 0) : (f.montoNeto||"")} onChange={(e)=>u("montoNeto",e.target.value)} placeholder="0" min="0" disabled={!!(f.items||[]).length} />
      </FG>
      <FG label="Impuesto">
        <FSl
          value={selectedBillingType.code==="invoice"?"none":f.honorarios?"hon":f.iva?"iva":"none"}
          onChange={(e)=>{
            const value=e.target.value;
            u("iva", value==="iva");
            u("honorarios", value==="hon");
          }}
          disabled={taxOptions.length <= 1}
        >
          {taxOptions.map((option)=><option key={option.value} value={option.value}>{option.label}</option>)}
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
          <input type="checkbox" checked={!!f.recurring} onChange={(e)=>setF((prev)=>({
            ...prev,
            recurring:e.target.checked,
            tipoDoc:e.target.checked ? "Invoice" : prev.tipoDoc,
            documentTypeCode:e.target.checked ? "invoice" : (prev.documentTypeCode || prev.tipoDocumento || resolveProduBillingDocumentType(prev.tipoDoc || "factura_afecta")?.code || "factura_afecta"),
            tipoDocumento:e.target.checked ? "invoice" : (prev.documentTypeCode || prev.tipoDocumento || resolveProduBillingDocumentType(prev.tipoDoc || "factura_afecta")?.code || "factura_afecta"),
            iva:false,
            honorarios:false,
          }))}/>
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
    </fieldset>
    {isElectronicDocumentLocked ? (
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--bdr)" }}>
        <button type="button" onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr3)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
          Cerrar
        </button>
      </div>
    ) : (
      <>
        {validationMessage && (
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--red)", fontWeight: 600 }}>
            {validationMessage}
          </div>
        )}
        <MFoot disabled={!canSubmit} onClose={onClose} onSave={()=>{
          if (!canSubmit) return;
          onSave(buildPayload((factura) => factura?.cobranzaEstado || "Pendiente de pago"));
        }}/>
      </>
    )}
  </Modal>;
}
