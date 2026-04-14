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
  billingContact,
  cobranzaState,
  commentAttachmentFromFile,
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
import { useLabBillingTools } from "../../hooks/useLabBillingTools";
import { useLabInvoiceForm } from "../../hooks/useLabInvoiceForm";
import { useLabInvoiceList } from "../../hooks/useLabInvoiceList";
import { dbGet } from "../../hooks/useLabDataStore";
import { buildTreasuryPurchaseOrders, summarizePurchaseOrders } from "../../lib/utils/treasury";
import {
  buildProduBillingReferenceSummary,
  canProduBillingDocumentBeReferenced,
  evaluateProduBillingBsaleReadiness,
  getDefaultProduBillingReferenceReason,
  getProduBillingReferenceCodeLabel,
  getProduBillingReferenceCodeOptions,
  getProduBillingDocumentTypeLabel,
  getProduBillingReferenceReasonOptions,
  getProduBillingDocumentTypeOptions,
  requiresProduBillingReferences,
  requiresProduCollectionTracking,
  resolveProduBillingDocumentType,
  supportsProduDocumentHonorarios,
  supportsProduDocumentVat,
} from "../../lib/integrations/billingDomain";
import { TreasuryPurchaseOrderModal } from "../treasury/TreasuryPurchaseOrderModal";
import { TransactionalEmailComposerModal } from "../shared/TransactionalEmailComposerModal";
import { InvoiceCollectionSection, InvoiceIssuanceSection } from "./InvoiceSections";
import { resolveTransactionalEmailTemplate } from "../../lib/integrations/transactionalEmailTemplates";
export { MFact } from "./InvoiceModal";
let commercialPdfRuntimePromise = null;

async function getCommercialPdfRuntime() {
  if (!commercialPdfRuntimePromise) {
    commercialPdfRuntimePromise = Promise.all([
      import("../../lib/lab/commercialPdfBase"),
      import("../../lib/lab/commercialBillingPdf"),
    ]).then(([baseModule, billingModule]) => ({
      generateBillingPdf: billingModule.generateBillingPdf,
      buildFactPdfFile: billingModule.buildFactPdfFile,
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
        fmtM,
        today,
        companyPrintColor,
        cobranzaState,
      }),
    }));
  }
  return commercialPdfRuntimePromise;
}

export function ViewFact({ empresa, facturas, movimientos, clientes, auspiciadores, producciones, programas, piezas, presupuestos, contratos, openM, canDo, cDel, setFacturas, setMovimientos, saveFacturaDoc, ntf, treasury = {}, emitFacturaToBsale, syncFacturaWithBsale, inspectFacturaBsaleSync, platformApi, user }) {
  const canEdit = canDo && canDo("facturacion");
  const canPres = Array.isArray(empresa?.addons) && empresa.addons.includes("presupuestos");
  const canContracts = Array.isArray(empresa?.addons) && empresa.addons.includes("contratos");
  const allDocs = (facturas || []).filter((x) => x.empId === empresa?.id);
  const purchaseOrders = React.useMemo(() => buildTreasuryPurchaseOrders({
    orders: treasury.purchaseOrders || [],
    facturas: allDocs,
    clientes,
    receipts: treasury.receipts || [],
    empId: empresa?.id,
  }), [allDocs, clientes, empresa?.id, treasury.purchaseOrders, treasury.receipts]);
  const purchaseOrderSummary = React.useMemo(() => summarizePurchaseOrders(purchaseOrders), [purchaseOrders]);
  const [poOpen, setPoOpen] = React.useState(false);
  const [poDraft, setPoDraft] = React.useState(null);
  const [poQuery, setPoQuery] = React.useState("");
  const [poStatus, setPoStatus] = React.useState("");
  const [poDocTarget, setPoDocTarget] = React.useState(null);
  const [emailComposerOpen, setEmailComposerOpen] = React.useState(false);
  const [emailComposerDraft, setEmailComposerDraft] = React.useState(null);
  const [emailComposerSending, setEmailComposerSending] = React.useState(false);
  const [poDocType, setPoDocType] = React.useState("Factura Afecta");
  const [bsaleSyncTarget, setBsaleSyncTarget] = React.useState(null);
  const [bsaleSyncSessions, setBsaleSyncSessions] = React.useState([]);
  const [bsaleSyncLoading, setBsaleSyncLoading] = React.useState(false);
  const filteredPurchaseOrders = React.useMemo(() => {
    const term = String(poQuery || "").trim().toLowerCase();
    return purchaseOrders.filter(row => {
      const matchesTerm = !term || [row.clientName, row.number].some(value => String(value || "").toLowerCase().includes(term));
      const matchesStatus = !poStatus || row.status === poStatus;
      return matchesTerm && matchesStatus;
    });
  }, [purchaseOrders, poQuery, poStatus]);
  const savePurchaseOrder = async next => {
    if (!canEdit || typeof treasury.setPurchaseOrders !== "function") return false;
    const list = Array.isArray(treasury.purchaseOrders) ? treasury.purchaseOrders : [];
    const exists = list.some(item => item.id === next.id);
    const updated = exists ? list.map(item => item.id === next.id ? { ...next, empId: empresa?.id } : item) : [...list, { ...next, empId: empresa?.id }];
    await treasury.setPurchaseOrders(updated);
    setPoOpen(false);
    setPoDraft(null);
    return true;
  };
  const updatePurchaseOrderStatus = async (row, status) => {
    if (!row || !status) return false;
    return savePurchaseOrder({ ...row, status });
  };
  const isAcceptedPurchaseOrder = row => String(row?.status || "").trim().toLowerCase() === "aceptada";
  const deletePurchaseOrder = async id => {
    if (!canEdit || typeof treasury.setPurchaseOrders !== "function") return false;
    await treasury.setPurchaseOrders((Array.isArray(treasury.purchaseOrders) ? treasury.purchaseOrders : []).filter(item => item.id !== id));
    return true;
  };
  const createDocFromPurchaseOrder = () => {
    if (!poDocTarget) return;
    const targetDocType = resolveProduBillingDocumentType(poDocType);
    openM("fact", {
      tipoDoc: targetDocType.label,
      documentTypeCode: targetDocType.code,
      tipoDocumento: targetDocType.code,
      tipo: "cliente",
      entidadId: poDocTarget.clientId || "",
      montoNeto: Number(poDocTarget.amount || 0),
      fechaEmision: today(),
      fechaVencimiento: "",
      estado: "Emitida",
      cobranzaEstado: "Pendiente de pago",
      obs: `Documento creado desde OC ${poDocTarget.number || ""}`.trim(),
      referenceKind: "purchase_order",
      treasuryPurchaseOrderId: poDocTarget.id,
      relatedDocumentFolio: poDocTarget.number || "",
      relatedDocumentTypeCode: "orden_compra",
      relatedDocumentDate: poDocTarget.issueDate || "",
      relatedDocumentReason: poDocTarget.number ? `Orden de Compra ${poDocTarget.number}` : "Orden de Compra",
    });
    setPoDocTarget(null);
  };

  const {
    invoices,
    seriesList,
    pauseSeries,
    cutSeries,
    regenerateSeries,
    createBillingEmailDraft,
    createStatementEmailDraft,
    deliverEmailDraft,
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
    platformApi,
    senderReplyTo: user?.email || "",
  });

  const openEmailComposer = React.useCallback((builderResult) => {
    if (!builderResult?.ok || !builderResult?.draft) {
      window.alert(builderResult?.message || "No pudimos preparar el correo.");
      return;
    }
    setEmailComposerDraft(builderResult.draft);
    setEmailComposerOpen(true);
  }, []);

  const closeEmailComposer = React.useCallback(() => {
    if (emailComposerSending) return;
    setEmailComposerOpen(false);
    setEmailComposerDraft(null);
  }, [emailComposerSending]);

  const handleSendComposedEmail = React.useCallback(async (draft) => {
    setEmailComposerSending(true);
    try {
      const result = await deliverEmailDraft(draft);
      if (!result?.ok) {
        window.alert(result?.message || "No pudimos enviar el correo.");
        return;
      }
      setEmailComposerOpen(false);
      setEmailComposerDraft(null);
    } finally {
      setEmailComposerSending(false);
    }
  }, [deliverEmailDraft]);

  const cobranzaSourceDocs = allDocs.filter(f => requiresProduCollectionTracking(f.documentTypeCode || f.tipoDocumento || f.tipoDoc));
  const openBsaleSyncDetail = async (factura) => {
    if (!factura?.id) return;
    setBsaleSyncTarget(factura);
    setBsaleSyncLoading(true);
    try {
      const sessions = await inspectFacturaBsaleSync?.(factura);
      setBsaleSyncSessions(Array.isArray(sessions) ? sessions : []);
    } finally {
      setBsaleSyncLoading(false);
    }
  };

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
    selectablePageIds,
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

  const openBillingEmailComposer = React.useCallback((doc, entity) => {
    openEmailComposer(createBillingEmailDraft(doc, entity));
  }, [createBillingEmailDraft, openEmailComposer]);

  const openStatementEmailComposer = React.useCallback((docs, entity, type) => {
    openEmailComposer(createStatementEmailDraft(docs, entity, type));
  }, [createStatementEmailDraft, openEmailComposer]);
  const openInvoiceManualEmailComposer = React.useCallback(async (fact, entity, ref) => {
    const contact = billingContact(entity, fact?.tipo);
    if (!contact.email) {
      window.alert("La entidad no tiene email registrado para enviar la factura.");
      return;
    }
    const resolved = resolveTransactionalEmailTemplate(empresa, "invoice_manual_delivery", {
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      entityLabel: contact.entidad || "cliente",
      issueDate: fact?.fechaEmision ? fmtD(fact.fechaEmision) : "sin fecha",
      documentNumber: fact?.correlativo || "",
      totalFormatted: fmtM(fact?.total || 0),
      pendingFormatted: fmtM(fact?.saldo ?? fact?.total ?? 0),
      dueDate: fact?.fechaVencimiento ? fmtD(fact.fechaVencimiento) : "sin fecha de vencimiento",
      currency: fact?.moneda || empresa?.moneda || "CLP",
    });
    let attachments = [];
    try {
      const { buildFactPdfFile, commercialPdfDeps } = await getCommercialPdfRuntime();
      const file = await buildFactPdfFile(fact, entity, ref, empresa, commercialPdfDeps);
      const attachment = await commentAttachmentFromFile(file);
      if (attachment) attachments = [attachment];
    } catch {
      window.alert("No pudimos adjuntar automáticamente el PDF de la factura. El correo se abrirá igual para revisión.");
    }
    openEmailComposer({
      ok: true,
      draft: {
        tenantId: empresa?.id || "",
        templateKey: "invoice_manual_delivery",
        subject: `Notificación de ${empresa?.nombre || empresa?.nom || "Produ"}`,
        to: contact.email,
        body: resolved.body,
        attachments,
        entityType: "invoice",
        entityId: fact?.id || "",
        metadata: {
          companyName: empresa?.nombre || empresa?.nom || "Produ",
          entityLabel: contact.entidad || "",
          contactName: contact.nombre || "",
          documentNumber: fact?.correlativo || "",
        },
      },
    });
  }, [commentAttachmentFromFile, empresa, fmtD, fmtM, openEmailComposer]);

  return <div>
    <ModuleHeader
      module="Facturación"
      title="Facturación"
      description="Emite documentos y administra recurrencias. La cobranza operativa vive en Tesorería dentro de Cuentas por Cobrar."
    />
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Documentos emitidos" value={fd.length} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Cuentas por cobrar" value={fmtM(pendiente)} accent="#ffcc44" vc="#ffcc44" sub={`${cuentasPorCobrar.length} documento(s)`}/>
      <Stat label="Cobrado" value={fmtM(pagado)} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Emitidos / Recurrentes" value={`${emitidas} / ${recurrentes}`} accent="#ff5566" vc="#ff5566" sub={`atrasadas: ${vencidas}`}/>
    </div>
    <Tabs tabs={["Emisión","Órdenes de Compra Recibidas","Recurrencias"]} active={Math.min(tab,2)} onChange={(idx)=>{setTab(idx);setPg(1);}}/>
    <div style={{background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"var(--cy)"}}>
      ℹ En Producciones, la facturación solo incluye <b>Auspiciadores Principales y Secundarios</b>. No incluye canjes, colaboradores ni partners. El seguimiento de cobranza y pagos ahora se gestiona desde <b>Tesorería → Cuentas por Cobrar</b>.
    </div>
    {tab===0 && <InvoiceIssuanceSection
      q={q} setQ={(v)=>{setQ(v);setPg(1);}}
      fe={fe} setFe={(v)=>{setFe(v);setPg(1);}}
      sortMode={sortMode} setSortMode={(v)=>{setSortMode(v);setPg(1);}}
      openM={openM} canEdit={canEdit}
      selectedIds={selectedIds} bulkEstado={bulkEstado} setBulkEstado={setBulkEstado}
      applyBulkEstado={applyBulkEstado} deleteSelected={deleteSelected} clearSelection={()=>setSelectedIds([])}
      currentPageIds={currentPageIds} selectablePageIds={selectablePageIds} toggleAll={toggleAll} toggleSelected={toggleSelected}
      fd={fd} pg={pg} PP={PP} setPg={setPg}
      clientes={clientes} auspiciadores={auspiciadores} producciones={producciones} programas={programas} piezas={piezas}
      presupuestos={presupuestos} contratos={contratos}
      recurringSummary={recurringSummary} today={today} invoiceEntityName={invoiceEntityName}
      fmtM={fmtM} fmtD={fmtD} Badge={Badge}
      SearchBar={SearchBar} FilterSel={FilterSel} GBtn={GBtn} DBtn={DBtn} FSl={FSl} Card={Card} TH={TH} TD={TD} Empty={Empty} Paginator={Paginator}
      sendBillingEmail={openBillingEmailComposer}
      sendStatementEmail={openStatementEmailComposer}
      sendBillingWhatsApp={sendBillingWhatsApp}
      sendStatementWhatsApp={sendStatementWhatsApp}
      onEditDoc={(f)=>openM("fact",f)}
      onDeleteDoc={(id)=>{if(!canEdit) return; cDel(facturas,setFacturas,id,null,"Eliminada");}}
      onOpenPdf={async(f, ent, ref)=>{
        const { generateBillingPdf, commercialPdfDeps } = await getCommercialPdfRuntime();
        await generateBillingPdf(f, ent, ref, empresa, commercialPdfDeps);
      }}
      sendInvoiceManualEmail={openInvoiceManualEmailComposer}
      onEmitBsale={emitFacturaToBsale}
      onSyncBsale={syncFacturaWithBsale}
      onInspectBsale={openBsaleSyncDetail}
      onCreateCreditNote={(factura)=>{
        const sourceType = resolveProduBillingDocumentType(
          factura.documentTypeCode || factura.tipoDocumento || factura.tipoDoc || "factura_afecta",
        );
        openM("fact", {
          tipoDoc: "Nota de Crédito",
          documentTypeCode: "nota_credito",
          tipoDocumento: "nota_credito",
          tipo: factura.tipo || "cliente",
          entidadId: factura.entidadId || "",
          tipoRef: factura.tipoRef || "",
          proId: factura.proId || "",
          presupuestoId: factura.presupuestoId || "",
          contratoId: factura.contratoId || "",
          relatedDocumentId: factura.id,
          relatedDocumentFolio: factura.correlativo || "",
          relatedDocumentTypeCode: sourceType?.code || "",
          relatedDocumentDate: factura.fechaEmision || factura.fecha || "",
          relatedDocumentReason: "Corrige monto del documento",
          relatedExternalDocumentId: factura.externalSync?.externalDocumentId || "",
          montoNeto: Number(factura.montoNeto || factura.subtotal || factura.neto || factura.total || 0),
          iva: false,
          honorarios: false,
          fechaEmision: today(),
          fechaVencimiento: "",
          obs: `Ajuste sobre ${factura.correlativo || "documento"}`,
        });
      }}
      onCreateDebitNote={(factura)=>{
        openM("fact", {
          tipoDoc: "Nota de Débito",
          documentTypeCode: "nota_debito",
          tipoDocumento: "nota_debito",
          tipo: factura.tipo || "cliente",
          entidadId: factura.entidadId || "",
          tipoRef: factura.tipoRef || "",
          proId: factura.proId || "",
          presupuestoId: factura.presupuestoId || "",
          contratoId: factura.contratoId || "",
          relatedDocumentId: factura.id,
          relatedDocumentFolio: factura.correlativo || "",
          relatedDocumentTypeCode: "nota_credito",
          relatedDocumentDate: factura.fechaEmision || factura.fecha || "",
          relatedDocumentReason: "Ajuste de monto",
          relatedExternalDocumentId: factura.externalSync?.externalDocumentId || "",
          relatedExternalReturnId: factura.externalSync?.externalReturnId || "",
          montoNeto: Number(factura.montoNeto || factura.subtotal || factura.neto || factura.total || 0),
          iva: false,
          honorarios: false,
          fechaEmision: today(),
          fechaVencimiento: "",
          obs: `Reversa sobre ${factura.correlativo || "nota de crédito"}`,
        });
      }}
      canPres={canPres} canContracts={canContracts}
    />}
    {tab===1 && <Card title="Órdenes de Compra Recibidas" sub="Gestiona las OC del cliente desde Facturación y crea el documento comercial cuando la OC esté aceptada">
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:18}}>
        <Stat label="OC recibidas" value={purchaseOrderSummary.docs} accent="var(--cy)" vc="var(--cy)"/>
        <Stat label="Monto OC" value={fmtM(purchaseOrderSummary.total)} accent="#00e08a" vc="#00e08a"/>
        <Stat label="Pendiente Match" value={fmtM(purchaseOrderSummary.pending)} accent="#ffcc44" vc="#ffcc44"/>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={poQuery} onChange={setPoQuery} placeholder="Buscar OC o cliente..." />
        <FilterSel value={poStatus} onChange={setPoStatus} options={["Pendiente","Aceptada","Rechazada","Parcial","Conciliada"]} placeholder="Todos los estados OC" />
        {canEdit && <button onClick={()=>{setPoDraft(null);setPoOpen(true);}} style={{padding:"10px 14px",borderRadius:10,border:"1px solid var(--cy)",background:"var(--cy)",color:"#051018",fontWeight:800,cursor:"pointer"}}>+ Nueva OC</button>}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>Cliente</TH><TH>OC</TH><TH>Fecha</TH><TH>Estado OC</TH><TH>Estado factura</TH><TH>Monto</TH><TH>Pendiente</TH><TH></TH></tr></thead>
          <tbody>
            {filteredPurchaseOrders.map(row => <tr key={row.id}>
              <TD style={{fontWeight:700}}>{row.clientName}</TD>
              <TD>{row.number}</TD>
              <TD>{row.issueDate ? fmtD(row.issueDate) : "—"}</TD>
              <TD>
                {canEdit ? (
                  <FSl value={row.status || "Pendiente"} onChange={e=>updatePurchaseOrderStatus(row, e.target.value)} style={{minWidth:140}}>
                    {["Pendiente","Aceptada","Rechazada"].map(status => <option key={status} value={status}>{status}</option>)}
                  </FSl>
                ) : <Badge label={row.status || "Pendiente"} />}
              </TD>
              <TD><Badge label={row.billingStatus} /></TD>
              <TD style={{fontFamily:"var(--fm)",color:"var(--cy)"}}>{fmtM(row.amount)}</TD>
              <TD style={{fontFamily:"var(--fm)",color:row.pendingAmount>0?"#ffcc44":"#00e08a"}}>{fmtM(row.pendingAmount)}</TD>
              <TD>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                  {canEdit && <GBtn sm onClick={()=>{setPoDraft(row);setPoOpen(true);}}>Editar</GBtn>}
                  {canEdit && <DBtn sm onClick={()=>deletePurchaseOrder(row.id)}>Eliminar</DBtn>}
                  {canEdit && isAcceptedPurchaseOrder(row) && <GBtn sm onClick={()=>{setPoDocTarget(row);setPoDocType("Factura Afecta");}}>Crear documento</GBtn>}
                </div>
              </TD>
            </tr>)}
            {!filteredPurchaseOrders.length && <tr><td colSpan={8}><Empty text="Sin órdenes de compra recibidas" sub="Registra una OC y, cuando esté aceptada, podrás crear Factura, Orden de Factura o Invoice." /></td></tr>}
          </tbody>
        </table>
      </div>
      <TreasuryPurchaseOrderModal open={poOpen} data={poDraft} clientes={clientes} facturas={allDocs} onClose={()=>{setPoOpen(false);setPoDraft(null);}} onSave={savePurchaseOrder} />
      <Modal open={!!poDocTarget} onClose={()=>setPoDocTarget(null)} title="Crear documento desde OC" sub={poDocTarget ? `OC ${poDocTarget.number}` : ""}>
        <FG label="Tipo de documento">
          <FSl value={poDocType} onChange={e=>setPoDocType(e.target.value)}>
            {["Factura Afecta","Factura Exenta","Orden de Factura","Invoice"].map(type => <option key={type} value={type}>{type}</option>)}
          </FSl>
        </FG>
        <MFoot onClose={()=>setPoDocTarget(null)} onSave={createDocFromPurchaseOrder} label="Crear documento" />
      </Modal>
    </Card>}
    {tab===2 && <Card title="Recurrencias" sub="Administra series activas sin mezclar emisión ni cobro">
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
    <Modal
      open={!!bsaleSyncTarget}
      onClose={() => {
        setBsaleSyncTarget(null);
        setBsaleSyncSessions([]);
      }}
      title={`Detalle tributario · ${bsaleSyncTarget?.correlativo || "Documento"}`}
      sub={bsaleSyncTarget ? getProduBillingDocumentTypeLabel(bsaleSyncTarget.documentTypeCode || bsaleSyncTarget.tipoDocumento || bsaleSyncTarget.tipoDoc) : ""}
    >
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginBottom:16}}>
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>ESTADO</div>
          <div style={{fontWeight:700,color:"var(--cy)"}}>{bsaleSyncTarget?.externalSync?.status || "draft"}</div>
        </div>
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>FOLIO EXTERNO</div>
          <div style={{fontWeight:700,color:"var(--wh)"}}>{bsaleSyncTarget?.externalSync?.externalFolio || "—"}</div>
        </div>
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>ORIGEN</div>
          <div style={{fontWeight:700,color:"var(--wh)"}}>{bsaleSyncTarget?.externalSync?.source === "mock" ? "Motor de respaldo" : bsaleSyncTarget?.externalSync?.source === "bsale" ? "Motor tributario" : "Sin definir"}</div>
        </div>
        {bsaleSyncTarget?.externalSync?.externalReturnId && (
          <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
            <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>DEVOLUCIÓN</div>
            <div style={{fontWeight:700,color:"var(--wh)"}}>#{bsaleSyncTarget.externalSync.externalReturnId}{bsaleSyncTarget.externalSync.returnCode ? ` · ${bsaleSyncTarget.externalSync.returnCode}` : ""}</div>
          </div>
        )}
        {bsaleSyncTarget?.externalSync?.externalAnnulmentId && (
          <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
            <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>ANULACIÓN</div>
            <div style={{fontWeight:700,color:"var(--wh)"}}>#{bsaleSyncTarget.externalSync.externalAnnulmentId}</div>
          </div>
        )}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:16}}>
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>NETO</div>
          <div style={{fontWeight:800,color:"var(--wh)",fontFamily:"var(--fm)"}}>{fmtM(Number(bsaleSyncTarget?.externalSync?.netAmount ?? bsaleSyncTarget?.montoNeto ?? bsaleSyncTarget?.subtotal ?? bsaleSyncTarget?.neto ?? 0))}</div>
        </div>
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>IMPUESTO</div>
          <div style={{fontWeight:800,color:"var(--wh)",fontFamily:"var(--fm)"}}>{fmtM(Number(bsaleSyncTarget?.externalSync?.taxAmount ?? bsaleSyncTarget?.ivaVal ?? 0))}</div>
        </div>
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>TOTAL</div>
          <div style={{fontWeight:800,color:"var(--cy)",fontFamily:"var(--fm)"}}>{fmtM(Number(bsaleSyncTarget?.externalSync?.totalAmount ?? bsaleSyncTarget?.total ?? 0))}</div>
        </div>
      </div>
      {buildProduBillingReferenceSummary(bsaleSyncTarget || {}) && (
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)",marginBottom:16}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:4}}>REFERENCIA TRIBUTARIA</div>
          <div style={{fontSize:12,color:"var(--wh)"}}>{buildProduBillingReferenceSummary(bsaleSyncTarget || {})}</div>
        </div>
      )}
      {(bsaleSyncTarget?.externalSync?.pdfUrl || bsaleSyncTarget?.externalSync?.publicViewUrl || bsaleSyncTarget?.externalSync?.providerMessage) && (
        <div style={{padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)",marginBottom:16}}>
          <div style={{fontSize:10,color:"var(--gr2)",fontWeight:700,marginBottom:8}}>RECURSOS TRIBUTARIOS</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:bsaleSyncTarget?.externalSync?.providerMessage ? 10 : 0}}>
            {bsaleSyncTarget?.externalSync?.pdfUrl && <a href={bsaleSyncTarget.externalSync.pdfUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:8,border:"1px solid var(--bdr2)",textDecoration:"none",color:"var(--wh)",fontSize:12,fontWeight:700}}>PDF tributario <span>⇱</span></a>}
            {bsaleSyncTarget?.externalSync?.publicViewUrl && <a href={bsaleSyncTarget.externalSync.publicViewUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 10px",borderRadius:8,border:"1px solid var(--bdr2)",textDecoration:"none",color:"var(--wh)",fontSize:12,fontWeight:700}}>Ver documento <span>⇱</span></a>}
          </div>
          {bsaleSyncTarget?.externalSync?.providerMessage && <div style={{fontSize:12,color:"var(--gr2)",lineHeight:1.45}}>{bsaleSyncTarget.externalSync.providerMessage}</div>}
        </div>
      )}
      {bsaleSyncLoading ? (
        <div style={{fontSize:12,color:"var(--gr2)"}}>Cargando sesiones de sincronización...</div>
      ) : bsaleSyncSessions.length ? (
        <div style={{display:"grid",gap:12,maxHeight:"55vh",overflowY:"auto"}}>
          {bsaleSyncSessions.map((session, index) => (
            <div key={session.id || session.session_key || `${session.external_document_id || "session"}-${index}`} style={{padding:"12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:8,flexWrap:"wrap"}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{session.status || "draft"}</div>
                <div style={{fontSize:11,color:"var(--gr2)"}}>{(session.updated_at || session.updatedAt || "").slice(0, 19) || "Sin marca temporal"}</div>
              </div>
              <div style={{fontSize:11,color:"var(--gr2)",marginBottom:8}}>Documento externo: {session.external_document_id || session.externalDocumentId || "—"} · Folio: {session.external_folio || session.externalFolio || "—"}</div>
              <pre style={{margin:0,whiteSpace:"pre-wrap",fontSize:11,lineHeight:1.45,padding:"10px 12px",borderRadius:10,background:"#09111f",color:"#dbeafe",overflowX:"auto"}}>{JSON.stringify(session.response_payload_data || session.response || session.metadata_data || session.metadata || {}, null, 2)}</pre>
            </div>
          ))}
        </div>
      ) : (
        <Empty text="Sin detalle tributario" sub="Cuando emitas o actualices este documento, aquí verás la respuesta del motor tributario." />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--bdr)" }}>
        <GBtn sm onClick={() => {
          setBsaleSyncTarget(null);
          setBsaleSyncSessions([]);
        }}>Cerrar</GBtn>
      </div>
    </Modal>
    <TransactionalEmailComposerModal
      open={emailComposerOpen}
      draft={emailComposerDraft}
      sending={emailComposerSending}
      onClose={closeEmailComposer}
      onSend={handleSendComposedEmail}
    />
  </div>;
}
