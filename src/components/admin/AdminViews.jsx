import { useEffect, useState } from "react";
import { Badge, Btn, Card, DBtn, Empty, FG, FI, FSl, FTA, FilterSel, GBtn, KV, MultiSelect, R2, R3, SearchBar, Stat, Tabs } from "../../lib/ui/components";
import { useLabAdminPanelModule } from "../../hooks/useLabAdminPanelModule";
import { useLabSuperAdminModule } from "../../hooks/useLabSuperAdminModule";
import { assignableRoleOptions, getCustomRoles, getRoleConfig, PERMS, ROLE_COLOR_MAP, ROLE_PERMISSION_GROUPS, ROLES } from "../../lib/auth/authorization";
import { companyPaymentInfoText, companyPrintColor, PRINT_COLORS } from "../../lib/utils/helpers";
import { TaskErrorBoundary } from "../shared/CoreFeedback";

const companyPrintColorLabel = empresa => PRINT_COLORS.find(opt => opt.value === companyPrintColor(empresa))?.label || "Azul institucional";
const normalizePaymentDetails = empresa => {
  const payment = empresa?.paymentDetails || {};
  return {
    holder: payment.holder || empresa?.paymentHolder || empresa?.nombre || "",
    rut: payment.rut || empresa?.paymentRut || empresa?.rut || "",
    bank: payment.bank || empresa?.paymentBank || "",
    accountType: payment.accountType || empresa?.paymentAccountType || "",
    accountNumber: payment.accountNumber || empresa?.paymentAccountNumber || "",
    email: payment.email || empresa?.paymentEmail || empresa?.ema || "",
    notes: payment.notes || empresa?.paymentNotes || "",
  };
};

export function SuperAdminPanel({
  actorUser,
  empresas,
  users,
  onSave,
  onDeleteEmpresa,
  releaseMode = false,
  printLayouts,
  savePrintLayouts,
  supportThreads = [],
  supportSettings = {},
  helpers,
}) {
  const {
    dbGet,
    dbSet,
    uid,
    today,
    nowIso,
    fmtD,
    fmtMoney,
    normalizePrintLayouts,
    DEFAULT_PRINT_LAYOUTS,
    buildSupportSettings,
    normalizeSupportThreads,
    supportAttachmentFromFile,
    normalizeEmpresasModel,
    companyBillingDiscountPct,
    companyReferralDiscountMonthsPending,
    companyReferralDiscountHistory,
    companyBillingBaseNet,
    companyBillingNet,
    companyBillingStatus,
    companyPaymentDayLabel,
    companyIsUpToDate,
    companyGoogleCalendarEnabled,
    nextTenantCode,
    shouldConsumeReferralDiscountMonth,
    normalizeEmailValue,
    sha256Hex,
    sanitizeAssignableRole,
    ini,
    addons,
    exportActiveClientsCSV,
    exportActiveClientsPDF,
    userGoogleCalendar,
    SYSTEM_MESSAGE_PRESETS,
    XBtn,
  } = helpers;

  const {
    tab,setTab,q,setQ,planF,setPlanF,stateF,setStateF,portfolioQ,setPortfolioQ,portfolioPlan,setPortfolioPlan,portfolioStatus,setPortfolioStatus,portfolioEmpId,setPortfolioEmpId,
    uq,setUQ,uRole,setURole,uState,setUState,uEmp,setUEmp,ef,setEf,eid,setEid,sysUf,setSysUf,integrationEmpId,setIntegrationEmpId,commEmpId,setCommEmpId,sysMsg,setSysMsg,
    bannerForm,setBannerForm,printForm,activePrintDoc,setActivePrintDoc,sysMsgBodyRef,totalEmp,activeEmp,proEmp,totalUsers,grossMRR,netMRR,totalDiscountMRR,overdueEmp,
    activePortfolioClients,filteredEmp,filteredPortfolio,selectedPortfolioEmp,filteredUsers,selectedIntegrationEmp,selectedCommEmp,saveSystemUser,updatePrint,resetPrintLayouts,
    persistPrintLayouts,applyPrintPreset,renderPrintPreview,SUPER_TABS,SUPER_TAB_META,activeSuperTab,saveEmp,savePortfolio,publishSystemMessage,wrapSystemSelection,insertSystemBlock,
    applySystemPreset,saveBanner,removeSystemMessage,handleAceptarSolicitud,handleRechazarSolicitud,guardedOnSave,
  } = useLabSuperAdminModule({
    actorUser,
    empresas, users, printLayouts, savePrintLayouts, supportThreads, supportSettings, onSave, dbGet, dbSet,
    uid, today, nowIso, fmtD, fmtMoney, normalizePrintLayouts, DEFAULT_PRINT_LAYOUTS,
    buildSupportSettings, normalizeSupportThreads, supportAttachmentFromFile, normalizeEmpresasModel,
    companyBillingDiscountPct, companyReferralDiscountMonthsPending, companyReferralDiscountHistory,
    companyBillingBaseNet, companyBillingNet, companyBillingStatus, companyPaymentDayLabel,
    companyIsUpToDate, companyGoogleCalendarEnabled, nextTenantCode, shouldConsumeReferralDiscountMonth,
    normalizeEmailValue, sha256Hex, sanitizeAssignableRole,
  });

  return <div>
    <div style={{padding:"16px 18px",border:"1px solid var(--bdr2)",borderRadius:18,background:"linear-gradient(180deg,var(--cg),transparent 70%)",marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start",flexWrap:"wrap",marginBottom:14}}>
        <div>
          <div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.5,marginBottom:6}}>{SUPER_TAB_META[activeSuperTab]?.eyebrow || "Super Admin"}</div>
          <div style={{fontFamily:"var(--fh)",fontSize:24,fontWeight:800,color:"var(--wh)",marginBottom:6}}>Torre de control de Produ</div>
          <div style={{fontSize:12,color:"var(--gr2)",maxWidth:760,lineHeight:1.6}}>{SUPER_TAB_META[activeSuperTab]?.desc}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:8,minWidth:280,flex:"1 1 320px"}}>
          <div style={{padding:"10px 12px",borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Tenants</div><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:"var(--cy)"}}>{totalEmp}</div></div>
          <div style={{padding:"10px 12px",borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>Activos</div><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:"#00e08a"}}>{activeEmp}</div></div>
          <div style={{padding:"10px 12px",borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>MRR Neto</div><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:"#a855f7"}}>{fmtMoney(netMRR,"UF")}</div></div>
        </div>
      </div>
      <div style={{padding:10,borderRadius:16,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
        <Tabs tabs={SUPER_TABS} active={tab} onChange={setTab}/>
      </div>
    </div>
    {tab===0&&<EmpresasAdminPanel totalEmp={totalEmp} activeEmp={activeEmp} proEmp={proEmp} totalUsers={totalUsers} q={q} setQ={setQ} planF={planF} setPlanF={setPlanF} stateF={stateF} setStateF={setStateF} filteredEmp={filteredEmp} ini={ini} addons={addons} setEid={setEid} setEf={setEf} onSave={guardedOnSave} empresas={empresas} onDeleteEmpresa={onDeleteEmpresa} eid={eid} ef={ef} saveEmp={saveEmp} releaseMode={releaseMode} />}
    {tab===1&&<CarteraAdminPanel activeEmp={activeEmp} grossMRR={grossMRR} totalDiscountMRR={totalDiscountMRR} netMRR={netMRR} overdueEmp={overdueEmp} portfolioQ={portfolioQ} setPortfolioQ={setPortfolioQ} portfolioPlan={portfolioPlan} setPortfolioPlan={setPortfolioPlan} portfolioStatus={portfolioStatus} setPortfolioStatus={setPortfolioStatus} exportActiveClientsCSV={exportActiveClientsCSV} exportActiveClientsPDF={exportActiveClientsPDF} activePortfolioClients={activePortfolioClients} filteredPortfolio={filteredPortfolio} selectedPortfolioEmp={selectedPortfolioEmp} setPortfolioEmpId={setPortfolioEmpId} companyBillingStatus={companyBillingStatus} companyBillingNet={companyBillingNet} companyBillingBaseNet={companyBillingBaseNet} companyReferralDiscountMonthsPending={companyReferralDiscountMonthsPending} companyReferralDiscountHistory={companyReferralDiscountHistory} companyPaymentDayLabel={companyPaymentDayLabel} companyBillingDiscountPct={companyBillingDiscountPct} companyIsUpToDate={companyIsUpToDate} fmtMoney={fmtMoney} fmtD={fmtD} savePortfolio={savePortfolio} addons={addons} />}
    {tab===2&&<SystemUsersPanel empresas={empresas} sysUf={sysUf} setSysUf={setSysUf} systemRoleOptions={assignableRoleOptions(null, {role:"superadmin"}, true)} saveSystemUser={saveSystemUser} uq={uq} setUQ={setUQ} uRole={uRole} setURole={setURole} uState={uState} setUState={setUState} uEmp={uEmp} setUEmp={setUEmp} filteredUsers={filteredUsers} ini={ini} getRoleConfig={getRoleConfig} userGoogleCalendar={userGoogleCalendar} />}
    {tab===3&&<IntegracionesAdminPanel empresas={empresas} integrationEmpId={integrationEmpId} setIntegrationEmpId={setIntegrationEmpId} selectedIntegrationEmp={selectedIntegrationEmp} companyGoogleCalendarEnabled={companyGoogleCalendarEnabled} onSave={guardedOnSave} />}
    {tab===4&&<ComunicacionesAdminPanel empresas={empresas} commEmpId={commEmpId} setCommEmpId={setCommEmpId} selectedCommEmp={selectedCommEmp} bannerForm={bannerForm} setBannerForm={setBannerForm} onSave={guardedOnSave} SYSTEM_MESSAGE_PRESETS={SYSTEM_MESSAGE_PRESETS} applySystemPreset={applySystemPreset} wrapSystemSelection={wrapSystemSelection} insertSystemBlock={insertSystemBlock} sysMsgBodyRef={sysMsgBodyRef} FTA={FTA} sysMsg={sysMsg} setSysMsg={setSysMsg} RichTextBlock={helpers.RichTextBlock} publishSystemMessage={publishSystemMessage} removeSystemMessage={removeSystemMessage} fmtD={fmtD} XBtn={XBtn} saveBanner={saveBanner} />}
    {tab===5&&<SolicitudesPanel empresas={empresas} dbGet={dbGet} fmtD={fmtD} addons={addons} onAceptar={handleAceptarSolicitud} onRechazar={handleRechazarSolicitud}/>}
    {tab===6&&<ImpresosAdminPanel activePrintDoc={activePrintDoc} setActivePrintDoc={setActivePrintDoc} printForm={printForm} defaultPrintLayouts={DEFAULT_PRINT_LAYOUTS} updatePrint={updatePrint} applyPrintPreset={applyPrintPreset} resetPrintLayouts={resetPrintLayouts} persistPrintLayouts={persistPrintLayouts} renderPrintPreview={renderPrintPreview} />}
  </div>;
}

export function EmpresaEdit({
  empresa,
  empresas,
  saveEmpresas,
  ntf,
  addons,
  companyGoogleCalendarEnabled,
  canManageAdmin=true,
}) {
  const [ef, setEf] = useState({});
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const payment = normalizePaymentDetails(empresa);
    setEf({
      nombre: empresa.nombre || "",
      rut: empresa.rut || "",
      ema: empresa.ema || "",
      tel: empresa.tel || "",
      dir: empresa.dir || "",
      logo: empresa.logo || "",
      bankInfo: empresa.bankInfo || "",
      paymentHolder: payment.holder || "",
      paymentRut: payment.rut || "",
      paymentBank: payment.bank || "",
      paymentAccountType: payment.accountType || "",
      paymentAccountNumber: payment.accountNumber || "",
      paymentEmail: payment.email || "",
      paymentNotes: payment.notes || "",
      printColor: companyPrintColor(empresa),
      plan: empresa.plan || "starter",
      active: empresa.active !== false,
      addons: Array.isArray(empresa.addons) ? empresa.addons : [],
      googleCalendarEnabled: companyGoogleCalendarEnabled(empresa),
    });
  }, [empresa, companyGoogleCalendarEnabled]);

  const save = () => {
    if (!canManageAdmin) return;
    const updated = {
      ...empresa,
      ...ef,
      paymentDetails: {
        holder: ef.paymentHolder || ef.nombre || "",
        rut: ef.paymentRut || ef.rut || "",
        bank: ef.paymentBank || "",
        accountType: ef.paymentAccountType || "",
        accountNumber: ef.paymentAccountNumber || "",
        email: ef.paymentEmail || "",
        notes: ef.paymentNotes || "",
      },
    };
    saveEmpresas((empresas || []).map(em => em.id === empresa.id ? updated : em));
    ntf("Datos guardados ✓");
    setEditing(false);
  };

  if (!editing) return (
    <div style={{ background:"var(--sur)", border:"1px solid var(--bdr2)", borderRadius:10, padding:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontFamily:"var(--fh)", fontSize:13, fontWeight:700 }}>Datos de la Empresa</div>
        <GBtn sm onClick={() => setEditing(true)}>✏ Editar</GBtn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[["Nombre", empresa.nombre],["RUT", empresa.rut],["Email", empresa.ema||"—"],["Teléfono", empresa.tel||"—"],["Dirección", empresa.dir||"—"],["Plan", empresa.plan],["Estado", empresa.active!==false?"Activa":"Inactiva"],["Color de impresos", companyPrintColorLabel(empresa)],["Google Calendar", companyGoogleCalendarEnabled(empresa)?"Habilitado por Super Admin":"No habilitado"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </div>
      <div style={{marginTop:14}}>
        <div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Información bancaria</div>
        <div style={{background:"var(--card2)",border:"1px solid var(--bdr)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line"}}>{companyPaymentInfoText(empresa,{intro:false}) || empresa.bankInfo || "Sin información bancaria configurada"}</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>{(empresa.addons||[]).length?(empresa.addons||[]).map(a=><Badge key={a} label={addons[a]?.label||a} color="gray" sm/>):<span style={{fontSize:11,color:"var(--gr2)"}}>Sin addons activos</span>}</div>
    </div>
  );

  return (
    <div style={{ background:"var(--sur)", border:"1px solid var(--cy)", borderRadius:10, padding:16 }}>
      <div style={{ fontFamily:"var(--fh)", fontSize:13, fontWeight:700, marginBottom:14 }}>Editar Datos de la Empresa</div>
      <R2>
        <FG label="Nombre empresa"><FI value={ef.nombre} onChange={e=>setEf(p=>({...p,nombre:e.target.value}))} placeholder="Mi Productora SpA"/></FG>
        <FG label="RUT"><FI value={ef.rut} onChange={e=>setEf(p=>({...p,rut:e.target.value}))} placeholder="78.118.348-2"/></FG>
      </R2>
      <div style={{padding:"12px 14px",border:"1px solid var(--bdr2)",borderRadius:10,background:"var(--card2)",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--wh)",marginBottom:10}}>Logo de la empresa</div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{width:68,height:68,borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
            {ef.logo
              ? <img src={ef.logo} alt={ef.nombre || empresa?.nombre || "Logo empresa"} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              : <span style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,color:"var(--gr2)"}}>{(ef.nombre || empresa?.nombre || "?").slice(0,1).toUpperCase()}</span>}
          </div>
          <div style={{display:"grid",gap:8,flex:1,minWidth:220}}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setEf(p => ({ ...p, logo: String(reader.result || "") }));
                reader.readAsDataURL(file);
              }}
              style={{fontSize:12,color:"var(--gr3)"}}
            />
            <div style={{fontSize:11,color:"var(--gr2)"}}>Sube un logo en PNG, JPG, WEBP o SVG. Se usará en la identidad visual y en documentos.</div>
            {!!ef.logo && <div><GBtn sm onClick={() => setEf(p => ({ ...p, logo: "" }))}>Quitar logo</GBtn></div>}
          </div>
        </div>
      </div>
      <R2>
        <FG label="Email"><FI value={ef.ema} onChange={e=>setEf(p=>({...p,ema:e.target.value}))} placeholder="contacto@empresa.cl"/></FG>
        <FG label="Teléfono"><FI value={ef.tel} onChange={e=>setEf(p=>({...p,tel:e.target.value}))} placeholder="+56 9 1234 5678"/></FG>
      </R2>
      <R2>
        <FG label="Plan"><FSl value={ef.plan||"starter"} onChange={e=>setEf(p=>({...p,plan:e.target.value}))}><option value="starter">starter</option><option value="pro">pro</option><option value="enterprise">enterprise</option></FSl></FG>
        <FG label="Estado"><FSl value={ef.active!==false?"true":"false"} onChange={e=>setEf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activa</option><option value="false">Inactiva</option></FSl></FG>
      </R2>
      <FG label="Dirección"><FI value={ef.dir} onChange={e=>setEf(p=>({...p,dir:e.target.value}))} placeholder="Av. Principal 123, Santiago"/></FG>
      <FG label="Color de impresos">
        <FSl value={ef.printColor||"#172554"} onChange={e=>setEf(p=>({...p,printColor:e.target.value}))}>
          {PRINT_COLORS.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </FSl>
      </FG>
      <div style={{padding:"12px 14px",border:"1px solid var(--bdr2)",borderRadius:10,background:"var(--card2)",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--wh)",marginBottom:10}}>Información bancaria / datos de pago</div>
        <R2>
          <FG label="Titular"><FI value={ef.paymentHolder||""} onChange={e=>setEf(p=>({...p,paymentHolder:e.target.value}))} placeholder="Razón social o titular"/></FG>
          <FG label="RUT para pagos"><FI value={ef.paymentRut||""} onChange={e=>setEf(p=>({...p,paymentRut:e.target.value}))} placeholder="78.118.348-2"/></FG>
        </R2>
        <R2>
          <FG label="Banco"><FI value={ef.paymentBank||""} onChange={e=>setEf(p=>({...p,paymentBank:e.target.value}))} placeholder="Banco de Chile"/></FG>
          <FG label="Tipo de cuenta"><FI value={ef.paymentAccountType||""} onChange={e=>setEf(p=>({...p,paymentAccountType:e.target.value}))} placeholder="Cuenta Corriente"/></FG>
        </R2>
        <R2>
          <FG label="Número de cuenta"><FI value={ef.paymentAccountNumber||""} onChange={e=>setEf(p=>({...p,paymentAccountNumber:e.target.value}))} placeholder="123456789"/></FG>
          <FG label="Correo para comprobantes"><FI value={ef.paymentEmail||""} onChange={e=>setEf(p=>({...p,paymentEmail:e.target.value}))} placeholder="pagos@empresa.cl"/></FG>
        </R2>
        <FG label="Notas adicionales de pago"><FTA value={ef.paymentNotes||""} onChange={e=>setEf(p=>({...p,paymentNotes:e.target.value}))} placeholder="Instrucciones extra para pagos o comprobantes."/></FG>
      </div>
      <FG label="Información bancaria adicional"><FTA value={ef.bankInfo||""} onChange={e=>setEf(p=>({...p,bankInfo:e.target.value}))} placeholder="Texto adicional opcional que también quieras mostrar en documentos."/></FG>
      <div style={{marginTop:12}}>
        <div style={{fontSize:11,fontWeight:600,color:"var(--gr3)",marginBottom:8}}>Módulos activos</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {(empresa.addons||[]).length
            ? (empresa.addons||[]).map(a=><Badge key={a} label={addons[a]?.label||a} color="gray" sm/>)
            : <span style={{fontSize:11,color:"var(--gr2)"}}>Sin módulos activos</span>}
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginTop:8}}>La activación o desactivación de módulos se gestiona solo desde Super Admin.</div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <Btn onClick={save}>✓ Guardar</Btn>
        <GBtn onClick={() => setEditing(false)}>Cancelar</GBtn>
      </div>
    </div>
  );
}

export function RolesEditor({ empresa, empresas, saveEmpresas, ntf, uid, canManageAdmin=true }) {
  const [activeKey,setActiveKey]=useState("");
  const [draft,setDraft]=useState({label:"",color:"#7c7c8a",badge:"gray",permissions:[]});
  const customRoles=getCustomRoles(empresa);
  const roleList=[...Object.entries(ROLES).filter(([k])=>k!=="superadmin").map(([key,val])=>({key,base:true,label:val.label,color:val.color,badge:ROLE_COLOR_MAP[key]||"gray",permissions:PERMS[key]||[]})),...customRoles.map(r=>({...r,base:false}))];
  useEffect(()=>{
    const first=roleList[0]?.key||"";
    if(!activeKey && first) setActiveKey(first);
  },[roleList.length, activeKey, roleList]);
  useEffect(()=>{
    const selected=roleList.find(r=>r.key===activeKey);
    if(selected) setDraft({label:selected.label||"",color:selected.color||"#7c7c8a",badge:selected.badge||"gray",permissions:[...(selected.permissions||[])]});
  },[activeKey, roleList]);
  const selected=roleList.find(r=>r.key===activeKey);
  const persistRoles=nextCustomRoles=>{
    if(!canManageAdmin) return;
    saveEmpresas((empresas||[]).map(em=>em.id===empresa.id?{...em,customRoles:nextCustomRoles}:em));
  };
  const createRole=()=>{
    const nextRole={key:`custom_${uid().slice(1,7)}`,label:"Nuevo rol",color:"#7c7c8a",badge:"gray",permissions:[]};
    persistRoles([...(customRoles||[]),nextRole]);
    setActiveKey(nextRole.key);
    ntf("Rol creado ✓");
  };
  const saveRole=()=>{
    if(!selected || selected.base || !draft.label?.trim()) return;
    const nextCustomRoles=(customRoles||[]).map(r=>r.key===selected.key?{...r,label:draft.label.trim(),color:draft.color,badge:draft.badge,permissions:[...(draft.permissions||[])]}:r);
    persistRoles(nextCustomRoles);
    ntf("Rol actualizado ✓");
  };
  const deleteRole=()=>{
    if(!selected || selected.base) return;
    if(!confirm("¿Eliminar este rol personalizado?")) return;
    persistRoles((customRoles||[]).filter(r=>r.key!==selected.key));
    setActiveKey(roleList.find(r=>r.key!==selected.key)?.key||"");
    ntf("Rol eliminado","warn");
  };
  const togglePerm=perm=>setDraft(p=>({...p,permissions:p.permissions.includes(perm)?p.permissions.filter(x=>x!==perm):[...p.permissions,perm]}));
  return <div>
    <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Crea roles personalizados por empresa y define qué módulos puede usar cada perfil. Los roles base se pueden revisar, pero no eliminar.</div>
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16,alignItems:"start"}}>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,overflow:"hidden"}}>
        {roleList.map(role=><div key={role.key} onClick={()=>setActiveKey(role.key)} style={{padding:"11px 14px",cursor:"pointer",borderBottom:"1px solid var(--bdr)",background:activeKey===role.key?"var(--cg)":"transparent",borderLeft:activeKey===role.key?"3px solid var(--cy)":"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:activeKey===role.key?"var(--cy)":"var(--gr3)"}}>{role.label}</span>
            {role.base?<Badge label="Base" color="gray" sm/>:<Badge label="Custom" color="cyan" sm/>}
          </div>
          <div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{(role.permissions||[]).length} permisos</div>
        </div>)}
        <div style={{padding:12}}><Btn onClick={createRole} sm>+ Nuevo rol</Btn></div>
      </div>
      {selected?<div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:10,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Rol: {selected.label}</div>
          {!selected.base&&<DBtn onClick={deleteRole} sm>Eliminar</DBtn>}
        </div>
        <R3>
          <FG label="Nombre del rol"><FI value={draft.label||""} onChange={e=>setDraft(p=>({...p,label:e.target.value}))} disabled={selected.base}/></FG>
          <FG label="Color label"><FI type="color" value={draft.color||"#7c7c8a"} onChange={e=>setDraft(p=>({...p,color:e.target.value}))} disabled={selected.base}/></FG>
          <FG label="Badge"><FSl value={draft.badge||"gray"} onChange={e=>setDraft(p=>({...p,badge:e.target.value}))} disabled={selected.base}>{["gray","cyan","green","yellow","red","purple"].map(c=><option key={c} value={c}>{c}</option>)}</FSl></FG>
        </R3>
        <div style={{display:"grid",gap:12,marginTop:8}}>
          {ROLE_PERMISSION_GROUPS.map(group=><div key={group.label} style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:10,padding:12}}>
            <div style={{fontSize:11,fontWeight:800,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.4,marginBottom:10}}>{group.label}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {group.items.map(([perm,label])=><label key={perm} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--card)",border:`1px solid ${draft.permissions.includes(perm)?"var(--cy)":"var(--bdr2)"}`,borderRadius:8,cursor:selected.base?"default":"pointer",opacity:selected.base?0.75:1}}>
                <input type="checkbox" checked={draft.permissions.includes(perm)} disabled={selected.base} onChange={()=>togglePerm(perm)}/>
                <span style={{fontSize:12,color:"var(--wh)"}}>{label}</span>
              </label>)}
            </div>
          </div>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          {!selected.base&&<Btn onClick={saveRole}>Guardar rol</Btn>}
          {selected.base&&<div style={{fontSize:11,color:"var(--gr2)"}}>Los roles base se usan como referencia y no se editan desde aquí.</div>}
        </div>
      </div>:<Empty text="Selecciona un rol para editar"/>}
    </div>
  </div>;
}

export function SolicitudesAdmin({ users, onSaveUsers, dbGet, dbSet, uid, sha256Hex }) {
  const [sols, setSols] = useState([]);

  useEffect(() => {
    dbGet("produ:solicitudes").then(v => setSols(v || []));
  }, [dbGet]);

  const aprobar = async s => {
    const pw = prompt(`Contraseña temporal para ${s.nombre}:`, "produ2024");
    if (!pw) return;
    const newUser = { id: uid(), name: s.nombre, email: s.email, passwordHash: await sha256Hex(pw), role: "productor", empId: "", active: true };
    onSaveUsers([...(users || []), newUser]);
    const upd = sols.map(x => x.id === s.id ? { ...x, estado: "aprobada" } : x);
    setSols(upd);
    await dbSet("produ:solicitudes", upd);
    alert(`✓ Usuario creado. Contraseña: ${pw}. Recuerda asignarle una empresa.`);
  };

  const rechazar = async s => {
    if (!confirm(`¿Rechazar solicitud de ${s.nombre}?`)) return;
    const upd = sols.map(x => x.id === s.id ? { ...x, estado: "rechazada" } : x);
    setSols(upd);
    await dbSet("produ:solicitudes", upd);
  };

  const pendientes = sols.filter(s => s.estado === "pendiente");

  return <div>
    <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 16 }}>
      {pendientes.length > 0 ? <span style={{ color: "#fbbf24", fontWeight: 600 }}>{pendientes.length} solicitud{pendientes.length !== 1 ? "es" : ""} pendiente{pendientes.length !== 1 ? "s" : ""}</span> : "Sin solicitudes pendientes"}
    </div>
    {sols.length === 0 && <Empty text="Aún no hay solicitudes de acceso" />}
    {sols.map(s => (
      <div key={s.id} style={{ background: "var(--sur)", border: `1px solid ${s.estado === "pendiente" ? "#fbbf2440" : s.estado === "aprobada" ? "#4ade8030" : "#ff556630"}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700 }}>{s.nombre}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 2 }}>✉ {s.email}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)" }}>🏢 {s.productora}</div>
            {s.mensaje && <div style={{ fontSize: 12, color: "var(--gr3)", marginTop: 4, fontStyle: "italic" }}>"{s.mensaje}"</div>}
            <div style={{ fontSize: 11, color: "var(--gr)", marginTop: 4 }}>Enviada: {s.fecha}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <Badge label={s.estado === "pendiente" ? "Pendiente" : s.estado === "aprobada" ? "Aprobada" : "Rechazada"} color={s.estado === "aprobada" ? "green" : s.estado === "rechazada" ? "red" : "yellow"} sm />
            {s.estado === "pendiente" && <>
              <GBtn sm onClick={() => aprobar(s)}>✓ Aprobar</GBtn>
              <GBtn sm onClick={() => rechazar(s)}>✕ Rechazar</GBtn>
            </>}
          </div>
        </div>
      </div>
    ))}
  </div>;
}

export function ListasEditor({ listas, saveListas, defaultListas }) {
  const mergeListValues = (base = {}, overrides = {}) => {
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(overrides || {})]);
    const next = {};
    keys.forEach(key => {
      const baseArr = Array.isArray(base?.[key]) ? base[key] : [];
      const overrideArr = Array.isArray(overrides?.[key]) ? overrides[key] : [];
      next[key] = [...new Set([...baseArr, ...overrideArr].filter(v => String(v || "").trim()))];
    });
    return next;
  };

  const L = mergeListValues(defaultListas, listas || {});
  const [active, setActive] = useState("tiposPro");
  const [newVal, setNewVal] = useState("");

  const GROUPS = [
    { key: "tiposPro", label: "Tipos de Proyecto" },
    { key: "estadosPro", label: "Estados de Proyecto" },
    { key: "tiposPg", label: "Tipos de Producción" },
    { key: "estadosPg", label: "Estados de Producción" },
    { key: "freqsPg", label: "Frecuencias de Producción" },
    { key: "estadosEp", label: "Estados de Episodio" },
    { key: "tiposAus", label: "Tipos de Auspiciador" },
    { key: "frecPagoAus", label: "Frecuencias de Pago" },
    { key: "estadosAus", label: "Estados de Auspiciador" },
    { key: "tiposCt", label: "Tipos de Contrato" },
    { key: "estadosCt", label: "Estados de Contrato" },
    { key: "catMov", label: "Categorías de Movimientos" },
    { key: "industriasCli", label: "Industrias de Clientes" },
    { key: "estadosCamp", label: "Estados de Campaña" },
    { key: "plataformasContenido", label: "Plataformas de Contenido" },
    { key: "formatosPieza", label: "Formatos de Pieza" },
    { key: "estadosPieza", label: "Estados de Pieza" },
    { key: "areasCrew", label: "Áreas de Crew" },
    { key: "rolesCrew", label: "Roles de Crew" },
    { key: "tiposPres", label: "Tipos de Presupuesto" },
    { key: "estadosPres", label: "Estados de Presupuesto" },
    { key: "monedas", label: "Monedas" },
    { key: "impuestos", label: "Impuestos" },
    { key: "estadosFact", label: "Estados de Facturación" },
    { key: "tiposEntidadFact", label: "Tipos de Entidad Factura" },
    { key: "tiposDocPagar", label: "Tipos de Documento por Pagar" },
    { key: "catActivos", label: "Categorías de Activos" },
    { key: "estadosActivos", label: "Estados de Activos" },
    { key: "prioridadesTarea", label: "Prioridades de Tarea" },
    { key: "estadosTarea", label: "Estados de Tarea" },
  ];

  const items = L[active] || [];
  const persistLists = next => saveListas(mergeListValues(defaultListas, next || {}));

  const addItem = () => {
    if (!newVal.trim() || items.includes(newVal.trim())) return;
    persistLists({ ...L, [active]: [...items, newVal.trim()] });
    setNewVal("");
  };

  const delItem = val => persistLists({ ...L, [active]: items.filter(x => x !== val) });

  const moveItem = (val, dir) => {
    const arr = [...items];
    const i = arr.indexOf(val);
    if (dir === -1 && i === 0) return;
    if (dir === 1 && i === arr.length - 1) return;
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    persistLists({ ...L, [active]: arr });
  };

  const resetGroup = () => {
    if (!confirm("¿Restaurar valores por defecto para esta lista?")) return;
    persistLists({ ...L, [active]: defaultListas[active] });
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 16 }}>
        Administra las opciones que aparecen en los formularios. Los cambios se aplican de inmediato.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 8, overflow: "hidden" }}>
          {GROUPS.map(g => (
            <div key={g.key} onClick={() => { setActive(g.key); setNewVal(""); }}
              style={{ padding: "11px 14px", cursor: "pointer", fontSize: 12, fontWeight: active === g.key ? 700 : 400, color: active === g.key ? "var(--cy)" : "var(--gr3)", background: active === g.key ? "var(--cg)" : "transparent", borderLeft: active === g.key ? "3px solid var(--cy)" : "3px solid transparent", borderBottom: "1px solid var(--bdr)" }}>
              {g.label}
              <span style={{ float: "right", background: "var(--bdr2)", borderRadius: 20, padding: "1px 7px", fontSize: 10, color: "var(--gr2)", fontFamily: "var(--fm)" }}>{(L[g.key] || []).length}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700 }}>{GROUPS.find(g => g.key === active)?.label}</div>
            <button onClick={resetGroup} style={{ fontSize: 11, color: "var(--gr2)", background: "transparent", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>↺ Restaurar defaults</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} placeholder="Agregar nueva opción..." style={{ width: "100%", padding: "9px 12px", background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 6, color: "var(--wh)", fontFamily: "var(--fb)", fontSize: 13, outline: "none", flex: 1 }}/>
            <button onClick={addItem} style={{ padding: "9px 16px", borderRadius: 6, border: "none", background: "var(--cy)", color: "var(--bg)", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>+ Agregar</button>
          </div>
          <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 8, overflow: "hidden" }}>
            {items.length > 0 ? items.map((val, i) => (
              <div key={val} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: i < items.length - 1 ? "1px solid var(--bdr)" : "none", background: "transparent" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveItem(val, -1)} disabled={i === 0} style={{ background: "none", border: "none", color: i === 0 ? "var(--bdr2)" : "var(--gr2)", cursor: i === 0 ? "default" : "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
                  <button onClick={() => moveItem(val, 1)} disabled={i === items.length - 1} style={{ background: "none", border: "none", color: i === items.length - 1 ? "var(--bdr2)" : "var(--gr2)", cursor: i === items.length - 1 ? "default" : "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
                </div>
                <span style={{ flex: 1, fontSize: 13, color: "var(--wh)" }}>{val}</span>
                <button onClick={() => delItem(val)} style={{ background: "none", border: "1px solid #ff556625", borderRadius: 4, color: "var(--red)", cursor: "pointer", fontSize: 10, fontWeight: 600, padding: "2px 8px" }}>✕</button>
              </div>
            )) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--gr2)", fontSize: 12 }}>Sin opciones. Agrega la primera arriba.</div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--gr)", marginTop: 8 }}>{items.length} opciones · Los cambios se guardan automáticamente</div>
        </div>
      </div>
    </div>
  );
}

export function SolicitudesPanel({ onAceptar, onRechazar, empresas, dbGet, fmtD, addons }) {
  const [sols, setSols] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dbGet("produ:solicitudes").then(v => {
      setSols(v || []);
      setLoading(false);
    });
  }, [dbGet]);

  const pendientes = sols.filter(s => s.estado === "pendiente");

  if (loading) {
    return <div style={{ padding: 20, color: "var(--gr2)" }}>Cargando...</div>;
  }

  if (!pendientes.length) {
    return <div style={{ padding: 20, textAlign: "center", color: "var(--gr2)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
      <div style={{ fontSize: 14 }}>Sin solicitudes pendientes</div>
    </div>;
  }

  return <div>
    <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 16 }}>
      {pendientes.length} solicitud{pendientes.length !== 1 ? "es" : ""} pendiente{pendientes.length !== 1 ? "s" : ""}
    </div>
    {pendientes.map(sol => (
      <div key={sol.id} style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{sol.nom}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)" }}>{sol.ema} · {sol.emp}</div>
            <div style={{ fontSize: 11, color: "var(--gr)", marginTop: 4 }}>
              {sol.tipo === "empresa"
                ? `Empresa solicitante · ${sol.customerType || "productora"} · ${fmtD(sol.fecha)}`
                : `Rol: ${sol.rol} · ${fmtD(sol.fecha)}`}
            </div>
            {sol.tel && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>Teléfono: {sol.tel}</div>}
            {sol.teamSize && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>Equipo: {sol.teamSize}</div>}
            {!!(sol.requestedModules || []).length && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {(sol.requestedModules || []).map(mod => <Badge key={mod} label={addons?.[mod]?.label || mod} color="gray" sm />)}
            </div>}
            {sol.msg && <div style={{ fontSize: 12, color: "var(--gr3)", marginTop: 6, fontStyle: "italic" }}>"{sol.msg}"</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge label="Pendiente" color="yellow" sm />
            {sol.tipo === "empresa" && <Badge label="Empresa solicitante" color="cyan" sm />}
            {sol.referred && <Badge label="Referido" color="purple" sm />}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sol.tipo !== "empresa" && <div style={{ flex: 1, minWidth: 120 }}>
            <select defaultValue="" style={{ width: "100%", padding: "7px 10px", background: "var(--card)", border: "1px solid var(--bdr2)", borderRadius: 6, color: "var(--wh)", fontSize: 12 }} id={`emp-${sol.id}`}>
              <option value="">Asignar a empresa...</option>
              {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>}
          <button onClick={() => {
            const empId = document.getElementById(`emp-${sol.id}`)?.value || "";
            onAceptar(sol, empId);
            setSols(p => p.map(s => s.id === sol.id ? { ...s, estado: "aprobada" } : s));
          }} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#4ade80", color: "#ffffff", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✓ Aceptar</button>
          <button onClick={() => {
            onRechazar(sol);
            setSols(p => p.map(s => s.id === sol.id ? { ...s, estado: "rechazada" } : s));
          }} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #ff556640", background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕ Rechazar</button>
        </div>
      </div>
    ))}
  </div>;
}

export function SystemUsersPanel({
  empresas,
  sysUf,
  setSysUf,
  systemRoleOptions,
  saveSystemUser,
  uq,
  setUQ,
  uRole,
  setURole,
  uState,
  setUState,
  uEmp,
  setUEmp,
  filteredUsers,
  ini,
  getRoleConfig,
  userGoogleCalendar,
}) {
  return <div>
    <div style={{ fontSize: 12, color: "var(--gr3)", marginBottom: 12 }}>
      Usuarios del sistema. Cada empresa gestiona sus propios usuarios desde el Panel Admin.
    </div>
    <div style={{ background: "var(--card2)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Crear usuario sistema</div>
      <R2>
        <FG label="Nombre"><FI value={sysUf.name || ""} onChange={e => setSysUf(p => ({ ...p, name: e.target.value }))} placeholder="Nombre completo" /></FG>
        <FG label="Email"><FI type="email" value={sysUf.email || ""} onChange={e => setSysUf(p => ({ ...p, email: e.target.value }))} placeholder="correo@empresa.cl" /></FG>
      </R2>
      <R3>
        <FG label="Contraseña inicial"><FI type="password" value={sysUf.password || ""} onChange={e => setSysUf(p => ({ ...p, password: e.target.value }))} placeholder="Contraseña temporal o final" /></FG>
        <FG label="Rol">
          <FSl value={sysUf.role || "admin"} onChange={e => setSysUf(p => ({ ...p, role: e.target.value, empId: e.target.value === "superadmin" ? "" : p.empId }))}>
            {systemRoleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </FSl>
        </FG>
        <FG label="Estado">
          <FSl value={sysUf.active === false ? "false" : "true"} onChange={e => setSysUf(p => ({ ...p, active: e.target.value === "true" }))}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </FSl>
        </FG>
      </R3>
      {sysUf.role !== "superadmin" && <FG label="Empresa">
        <FSl value={sysUf.empId || ""} onChange={e => setSysUf(p => ({ ...p, empId: e.target.value }))}>
          <option value="">Sin empresa</option>
          {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </FSl>
      </FG>}
      <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 10 }}>
        Solo desde Super Admin se pueden crear o promover cuentas administrativas del sistema.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={saveSystemUser}>Guardar usuario sistema</Btn>
      </div>
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={uq} onChange={setUQ} placeholder="Buscar usuario por nombre o email..." />
      <FilterSel value={uRole} onChange={setURole} options={systemRoleOptions} placeholder="Todos los roles" />
      <FilterSel value={uState} onChange={setUState} options={[{ value: "active", label: "Activos" }, { value: "inactive", label: "Inactivos" }]} placeholder="Todos los estados" />
      <FilterSel value={uEmp} onChange={setUEmp} options={(empresas || []).map(e => ({ value: e.id, label: e.nombre }))} placeholder="Todas las empresas" />
    </div>
    {filteredUsers.map(u => {
      const empresa = (empresas || []).find(e => e.id === u.empId);
      const roleCfg = getRoleConfig(u.role, empresa);
      return <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--sur)", border: "1px solid var(--bdr)", borderRadius: 6, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,var(--cy),var(--cy2))", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--bg)", flexShrink: 0 }}>{ini(u.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div>
          <div style={{ fontSize: 11, color: "var(--gr2)" }}>{u.email}</div>
          <div style={{ fontSize: 11, color: "var(--gr3)" }}>Empresa: {empresa?.nombre || "Sin empresa"}</div>
        </div>
        <Badge label={roleCfg.label} color={roleCfg.badge} sm />
        <Badge label={u.active ? "Activo" : "Inactivo"} color={u.active ? "green" : "red"} sm />
        <Badge label={userGoogleCalendar(u).connected ? "Google conectado" : "Sin Google"} color={userGoogleCalendar(u).connected ? "cyan" : "gray"} sm />
      </div>;
    })}
    {!filteredUsers.length && <Empty text="Sin usuarios para este filtro" />}
  </div>;
}

export function EmpresasAdminPanel({
  totalEmp,
  activeEmp,
  proEmp,
  totalUsers,
  q,
  setQ,
  planF,
  setPlanF,
  stateF,
  setStateF,
  filteredEmp,
  ini,
  addons,
  setEid,
  setEf,
  onSave,
  empresas,
  onDeleteEmpresa,
  eid,
  ef,
  saveEmp,
  releaseMode = false,
}) {
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Empresas</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "var(--cy)" }}>{totalEmp}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Activas</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "#00e08a" }}>{activeEmp}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Planes Pro+</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "#ffcc44" }}>{proEmp}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "var(--wh)" }}>{totalUsers}</div></div>
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={setQ} placeholder="Buscar empresa por nombre o RUT..." />
      <FilterSel value={planF} onChange={setPlanF} options={["starter", "pro", "enterprise"]} placeholder="Todos los planes" />
      <FilterSel value={stateF} onChange={setStateF} options={["Activa", "Inactiva"]} placeholder="Todos los estados" />
    </div>
    <div style={{ marginBottom: 14 }}>
      {filteredEmp.map(emp => <div key={emp.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px", background: "var(--sur)", border: "1px solid var(--bdr)", borderRadius: 8, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, background: `${emp.color}30`, border: `2px solid ${emp.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--fh)", fontSize: 13, fontWeight: 800, color: emp.color, flexShrink: 0, overflow: "hidden" }}>
          {emp.logo ? <img src={emp.logo} style={{ width: 34, height: 34, objectFit: "contain", borderRadius: 6 }} alt={emp.nombre} /> : ini(emp.nombre)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{emp.nombre}</div>
          <div style={{ fontSize: 11, color: "var(--gr2)" }}>{emp.rut || "Sin RUT"} · {emp.ema || "Sin email"} · Tenant ID: {emp.tenantCode || "—"} · ID técnico: {emp.id}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
            {(emp.addons || []).length ? (emp.addons || []).map(a => <Badge key={a} label={addons[a]?.label || a} color="gray" sm />) : <span style={{ fontSize: 10, color: "var(--gr2)" }}>Sin addons</span>}
          </div>
        </div>
        <Badge label={emp.active ? "Activa" : "Inactiva"} color={emp.active ? "green" : "red"} sm />
        <Badge label={emp.plan} color="gray" sm />
        <GBtn sm onClick={() => { setEid(emp.id); setEf({ ...emp }); }}>✏</GBtn>
        <GBtn sm onClick={() => onSave("empresas", empresas.map(e => e.id === emp.id ? { ...e, active: !e.active } : e))}>{emp.active ? "Desactivar" : "Activar"}</GBtn>
        {!releaseMode && emp.active === false && <button onClick={() => onDeleteEmpresa && onDeleteEmpresa(emp)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #ff556655", background: "#ff556614", color: "#ff5566", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>Eliminar instancia</button>}
      </div>)}
      {!filteredEmp.length && <Empty text="Sin empresas para este filtro" />}
    </div>
    <div style={{ background: "var(--card2)", border: "1px solid var(--bdr2)", borderRadius: 8, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700 }}>{eid ? "Editar Empresa" : "Nueva Empresa"}</div>
        {eid && <span style={{ fontSize: 11, color: "var(--gr2)" }}>Tenant ID: {(empresas.find(e => e.id === eid)?.tenantCode) || "—"} · ID instancia: {eid}</span>}
      </div>
      <R2><FG label="Nombre *"><FI value={ef.nombre || ""} onChange={e => setEf(p => ({ ...p, nombre: e.target.value }))} placeholder="Play Media SpA" /></FG><FG label="RUT"><FI value={ef.rut || ""} onChange={e => setEf(p => ({ ...p, rut: e.target.value }))} placeholder="78.118.348-2" /></FG></R2>
      <R2><FG label="Email"><FI value={ef.ema || ""} onChange={e => setEf(p => ({ ...p, ema: e.target.value }))} placeholder="contacto@empresa.cl" /></FG><FG label="Plan"><FSl value={ef.plan || "starter"} onChange={e => setEf(p => ({ ...p, plan: e.target.value }))}><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></FSl></FG></R2>
      <R2><FG label="Teléfono"><FI value={ef.tel || ""} onChange={e => setEf(p => ({ ...p, tel: e.target.value }))} placeholder="+56 9 1234 5678" /></FG><FG label="Dirección"><FI value={ef.dir || ""} onChange={e => setEf(p => ({ ...p, dir: e.target.value }))} placeholder="Av. Principal 123, Santiago" /></FG></R2>
      <FG label="Addons activados"><MultiSelect options={Object.entries(addons).map(([v, a]) => ({ value: v, label: `${a.icon} ${a.label}` }))} value={ef.addons || []} onChange={v => setEf(p => ({ ...p, addons: v }))} placeholder="Seleccionar addons..." /></FG>
      <R2><FG label="Color acento"><FI type="color" value={ef.color || "#00d4e8"} onChange={e => setEf(p => ({ ...p, color: e.target.value }))} /></FG><FG label="Estado"><FSl value={ef.active === false ? "false" : "true"} onChange={e => setEf(p => ({ ...p, active: e.target.value === "true" }))}><option value="true">Activa</option><option value="false">Inactiva</option></FSl></FG></R2>
      <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 10 }}>La creación de empresa genera la instancia principal. Luego los datos operativos se poblarán al primer acceso.</div>
      <div style={{ display: "flex", gap: 8 }}><Btn onClick={saveEmp}>{eid ? "Actualizar" : "Crear Empresa"}</Btn>{eid && <GBtn onClick={() => { setEid(null); setEf({}); }}>Cancelar</GBtn>}</div>
    </div>
  </div>;
}

export function CarteraAdminPanel({
  activeEmp,
  grossMRR,
  totalDiscountMRR,
  netMRR,
  overdueEmp,
  portfolioQ,
  setPortfolioQ,
  portfolioPlan,
  setPortfolioPlan,
  portfolioStatus,
  setPortfolioStatus,
  exportActiveClientsCSV,
  exportActiveClientsPDF,
  activePortfolioClients,
  filteredPortfolio,
  selectedPortfolioEmp,
  setPortfolioEmpId,
  companyBillingStatus,
  companyBillingNet,
  companyBillingBaseNet,
  companyReferralDiscountMonthsPending,
  companyReferralDiscountHistory,
  companyPaymentDayLabel,
  companyBillingDiscountPct,
  companyIsUpToDate,
  fmtMoney,
  fmtD,
  savePortfolio,
  addons,
}) {
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
      <Stat label="Empresas activas" value={activeEmp} sub="Tenants operativos" accent="var(--cy)" />
      <Stat label="MRR bruto" value={fmtMoney(grossMRR, "UF")} sub="Suma mensual pactada" accent="#00e08a" />
      <Stat label="Descuentos" value={fmtMoney(totalDiscountMRR, "UF")} sub="Rebajas activas" accent="#ffcc44" vc="#ffcc44" />
      <Stat label="MRR neto" value={fmtMoney(netMRR, "UF")} sub="Valor mensual Produ" accent="#a855f7" vc="#a855f7" />
      <Stat label="Con mora" value={overdueEmp} sub="Vencidas o suspendidas" accent="#ff5566" vc="#ff5566" />
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={portfolioQ} onChange={setPortfolioQ} placeholder="Buscar por empresa, RUT o contratado por..." />
      <FilterSel value={portfolioPlan} onChange={setPortfolioPlan} options={["starter", "pro", "enterprise"]} placeholder="Todos los planes" />
      <FilterSel value={portfolioStatus} onChange={setPortfolioStatus} options={["Al día", "Pendiente", "Vencido", "Mora", "Suspendido"]} placeholder="Todos los pagos" />
      <GBtn sm onClick={() => exportActiveClientsCSV(activePortfolioClients)}>⬇ CSV activos</GBtn>
      <GBtn sm onClick={() => exportActiveClientsPDF(activePortfolioClients)}>⬇ PDF activos</GBtn>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }}>
      <Card title="Empresas en cartera" sub={`${filteredPortfolio.length} tenant${filteredPortfolio.length === 1 ? "" : "s"} visibles`} style={{ padding: 14 }}>
        <div style={{ display: "grid", gap: 8 }}>
          {filteredPortfolio.map(emp => {
            const isActive = selectedPortfolioEmp?.id === emp.id;
            const status = companyBillingStatus(emp);
            const payColor = status === "Al día" ? "green" : status === "Pendiente" ? "yellow" : status === "Suspendido" ? "red" : "orange";
            return <button key={emp.id} onClick={() => setPortfolioEmpId(emp.id)} style={{ textAlign: "left", padding: "12px 12px", borderRadius: 14, border: `1px solid ${isActive ? "var(--cy)" : "var(--bdr2)"}`, background: isActive ? "var(--cg)" : "var(--sur)", cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: isActive ? "var(--cy)" : "var(--wh)" }}>{emp.nombre}</div>
                  <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 3 }}>{emp.tenantCode || "—"} · {String(emp.plan || "starter").toUpperCase()}</div>
                </div>
                <Badge label={status} color={payColor} sm />
              </div>
              <div style={{ fontSize: 11, color: "var(--gr2)" }}>{emp.userCount} usuario{emp.userCount === 1 ? "" : "s"} · {fmtMoney(companyBillingNet(emp), emp.billingCurrency || "UF")}/mes{emp.referralDiscountMonthsPending > 0 ? ` · ${emp.referralDiscountMonthsPending} mes${emp.referralDiscountMonthsPending === 1 ? "" : "es"} gratis pendiente${emp.referralDiscountMonthsPending === 1 ? "" : "s"}` : ""}</div>
            </button>;
          })}
          {!filteredPortfolio.length && <Empty text="Sin empresas en cartera para este filtro" sub="Ajusta plan, estado de pago o búsqueda." />}
        </div>
      </Card>
      {selectedPortfolioEmp ? (() => {
        const emp = selectedPortfolioEmp;
        const net = companyBillingNet(emp);
        const baseNet = companyBillingBaseNet(emp);
        const pendingReferralMonths = companyReferralDiscountMonthsPending(emp);
        const status = companyBillingStatus(emp);
        const payColor = status === "Al día" ? "green" : status === "Pendiente" ? "yellow" : status === "Suspendido" ? "red" : "orange";
        return <Card key={emp.id} title={emp.nombre} sub={`${emp.tenantCode || "Sin Tenant ID"} · Plan ${emp.plan} · ${emp.userCount} usuario${emp.userCount === 1 ? "" : "s"} · ${emp.active !== false ? "Tenant activo" : "Tenant inactivo"}`} style={{ padding: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                <div style={{ padding: 12, border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Plan</div><div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800 }}>{String(emp.plan || "starter").toUpperCase()}</div></div>
                <div style={{ padding: 12, border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Usuarios</div><div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800 }}>{emp.userCount}</div></div>
                <div style={{ padding: 12, border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Valor Produ</div><div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800, color: "var(--cy)" }}>{fmtMoney(net, emp.billingCurrency || "UF")}</div></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
                <FG label="Moneda cartera"><FSl value={emp.billingCurrency || "UF"} onChange={e => savePortfolio(emp.id, { billingCurrency: e.target.value })}><option value="UF">UF</option><option value="CLP">CLP</option><option value="USD">USD</option></FSl></FG>
                <FG label="Valor mensual pactado"><FI type="number" min="0" step="0.01" value={emp.billingMonthly || 0} onChange={e => savePortfolio(emp.id, { billingMonthly: e.target.value })} placeholder="0" /></FG>
              </div>
              <FG label="Descuento (%)"><FI type="number" min="0" max="100" value={emp.billingDiscountPct || 0} onChange={e => savePortfolio(emp.id, { billingDiscountPct: e.target.value })} placeholder="0" /></FG>
              <R2>
                <FG label="Contratado por"><FI value={emp.contractOwner || ""} onChange={e => savePortfolio(emp.id, { contractOwner: e.target.value })} placeholder="Nombre del responsable comercial" /></FG>
                <FG label="Portal cliente"><FI value={emp.clientPortalUrl || ""} onChange={e => savePortfolio(emp.id, { clientPortalUrl: e.target.value })} placeholder="https://cliente.produ.cl/empresa" /></FG>
              </R2>
              <FG label="Descuento / nota comercial"><FI value={emp.billingDiscountNote || ""} onChange={e => savePortfolio(emp.id, { billingDiscountNote: e.target.value })} placeholder="Motivo del descuento, upgrade o acuerdo especial" /></FG>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(emp.addons || []).length ? (emp.addons || []).map(a => <Badge key={a} label={addons[a]?.label || a} color="gray" sm />) : <span style={{ fontSize: 11, color: "var(--gr2)" }}>Sin módulos adicionales</span>}
              </div>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ padding: 14, border: "1px solid var(--bdr2)", borderRadius: 16, background: "var(--sur)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Estado de pagos</div>
                  <Badge label={status} color={payColor} sm />
                </div>
                <KV label="Tenant ID" value={emp.tenantCode || "—"} />
                <KV label="RUT" value={emp.rut || "—"} />
                <KV label="Contacto" value={emp.ema || "—"} />
                <KV label="Último pago" value={emp.billingLastPaidAt ? fmtD(emp.billingLastPaidAt) : "Sin registro"} />
                <KV label="Frecuencia" value={companyPaymentDayLabel(emp)} />
                <KV label="Descuento activo" value={`${companyBillingDiscountPct(emp)}%`} />
                <KV label="Meses gratis por referidos" value={pendingReferralMonths ? `${pendingReferralMonths} pendiente${pendingReferralMonths === 1 ? "" : "s"}` : "Sin pendientes"} />
                <KV label="Descuento referido aplicado" value={pendingReferralMonths > 0 ? `${Math.min(1, pendingReferralMonths)} mes` : "No aplicado"} />
                <KV label="Moneda cartera" value={emp.billingCurrency || "UF"} />
                <KV label="Valor mensual base" value={fmtMoney(baseNet, emp.billingCurrency || "UF")} />
                <KV label="Valor mensual Produ" value={fmtMoney(net, emp.billingCurrency || "UF")} />
                <KV label="Próximo cobro Produ" value={pendingReferralMonths > 0 ? fmtMoney(0, emp.billingCurrency || "UF") : fmtMoney(net, emp.billingCurrency || "UF")} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 12 }}>
                <FG label="Estado de pago">
                  <FSl value={status} onChange={e => savePortfolio(emp.id, { billingStatus: e.target.value })}>
                    <option value="Al día">Al día</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Vencido">Vencido</option>
                    <option value="Mora">Mora</option>
                    <option value="Suspendido">Suspendido</option>
                  </FSl>
                </FG>
                <FG label="Día de cobro">
                  <FI type="number" min="1" max="31" value={emp.billingDueDay || ""} onChange={e => savePortfolio(emp.id, { billingDueDay: e.target.value })} placeholder="5" />
                </FG>
              </div>
              <R2>
                <FG label="Último pago"><FI type="date" value={emp.billingLastPaidAt || ""} onChange={e => savePortfolio(emp.id, { billingLastPaidAt: e.target.value })} /></FG>
                <FG label="Estado tenant"><FSl value={emp.active === false ? "false" : "true"} onChange={e => savePortfolio(emp.id, { active: e.target.value === "true" })}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG>
              </R2>
              <div style={{ padding: 12, borderRadius: 14, border: "1px solid var(--bdr2)", background: pendingReferralMonths > 0 ? "#60a5fa12" : companyIsUpToDate(emp) ? "#00e08a14" : "#ffcc4412", color: pendingReferralMonths > 0 ? "#60a5fa" : companyIsUpToDate(emp) ? "#00e08a" : "#ffcc44", fontSize: 12, fontWeight: 700 }}>
                {pendingReferralMonths > 0
                  ? `Tiene ${pendingReferralMonths} mes${pendingReferralMonths === 1 ? "" : "es"} gratis pendiente${pendingReferralMonths === 1 ? "" : "s"} por referidos. Al registrar el siguiente pago se consumirá ${pendingReferralMonths === 1 ? "ese beneficio" : "uno"}.`
                  : companyIsUpToDate(emp)
                    ? "Tenant al día con Produ."
                    : "Este tenant requiere seguimiento comercial o cobranza."}
              </div>
              <div style={{ padding: 14, border: "1px solid var(--bdr2)", borderRadius: 16, background: "var(--sur)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Historial de referidos</div>
                  <Badge label={`${companyReferralDiscountHistory(emp).length}`} color="cyan" sm />
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {companyReferralDiscountHistory(emp).slice(0, 4).map(item => {
                    const earned = item.type === "earned";
                    return <div key={item.id || `${item.type}-${item.date}-${item.sourceEmpId || ""}`} style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--card)" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{earned ? "Mes acreditado" : "Mes aplicado"}</div>
                        <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4, lineHeight: 1.5 }}>{item.note || (earned ? "Beneficio acreditado por referido." : "Beneficio consumido al pago mensual.")}</div>
                      </div>
                      <div style={{ display: "grid", justifyItems: "end", gap: 6, flexShrink: 0 }}>
                        <Badge label={earned ? "Acreditado" : "Aplicado"} color={earned ? "cyan" : "green"} sm />
                        <div style={{ fontSize: 10, color: "var(--gr2)" }}>{item.date ? fmtD(item.date) : "Sin fecha"}</div>
                      </div>
                    </div>;
                  })}
                  {!companyReferralDiscountHistory(emp).length && <div style={{ fontSize: 11, color: "var(--gr2)" }}>Sin movimientos de referidos registrados.</div>}
                </div>
              </div>
            </div>
          </div>
        </Card>;
      })() : <Empty text="Selecciona una empresa para revisar su cartera" sub="Haz clic en una empresa de la lista izquierda." />}
    </div>
  </div>;
}

export function AdminPanel({
  Modal,
  open,
  onClose,
  theme,
  onSaveTheme,
  empresa,
  user,
  users,
  empresas,
  saveUsers,
  saveEmpresas,
  listas,
  saveListas,
  onPurge,
  ntf,
  dbGet,
  companyReferralDiscountHistory,
  companyReferralDiscountMonthsPending,
  assignableRoleOptions,
  sanitizeAssignableRole,
  uid,
  sha256Hex,
  themePresets,
  roleOptions,
  ini,
  getRoleConfig,
  userGoogleCalendar,
  companyGoogleCalendarEnabled,
  addons,
  defaultListas,
  Tabs,
  XBtn,
  releaseMode = false,
}) {
  const safeCompanyReferralDiscountHistory =
    typeof companyReferralDiscountHistory === "function"
      ? companyReferralDiscountHistory
      : () => [];
  const safeCompanyReferralDiscountMonthsPending =
    typeof companyReferralDiscountMonthsPending === "function"
      ? companyReferralDiscountMonthsPending
      : () => 0;
  const {
    tab, setTab, lt, setLt, uf, setUf, uid2, setUid2, uq, setUq, uRole, setURole, uState, setUState,
    filteredUsers, activeUsers, inactiveUsers, referredSols, referralHistory, ADMIN_TABS, ADMIN_TAB_META,
    activeAdminTab, editableRoleOptions, referralStatus, canManageAdmin, resetAccess, saveUser, toggleUserActive, deleteUser,
  } = useLabAdminPanelModule({
    theme,
    empresa,
    user,
    users,
    empresas,
    saveUsers,
    ntf,
    dbGet,
    companyReferralDiscountHistory: safeCompanyReferralDiscountHistory,
    assignableRoleOptions,
    sanitizeAssignableRole,
    uid,
    sha256Hex,
  });

  return <Modal open={open} onClose={onClose} title="⚙ Panel Administrador" sub={`${empresa?.nombre || "Sistema"}`} extraWide>
    <div style={{ padding: "18px 20px", border: "1px solid var(--bdr2)", borderRadius: 20, background: "linear-gradient(180deg,var(--cg),transparent 68%)", marginBottom: 16, boxShadow: "0 14px 40px rgba(0,0,0,.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Control interno</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800, color: "var(--wh)" }}>{empresa?.nombre || "Empresa"}</div>
            <Badge label={empresa?.tenantCode || "Sin tenant"} color="purple" sm />
          </div>
          <div style={{ fontSize: 12, color: "var(--gr2)", maxWidth: 720, lineHeight: 1.6 }}>{ADMIN_TAB_META[activeAdminTab]}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, minWidth: 280, flex: "1 1 320px" }}>
          <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios activos</div><div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: "var(--cy)" }}>{activeUsers}</div></div>
          <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Plan</div><div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800, color: "var(--wh)" }}>{String(empresa?.plan || "—").toUpperCase()}</div></div>
          <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Addons</div><div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: "#00e08a" }}>{(empresa?.addons || []).length}</div></div>
          <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios inactivos</div><div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: "#ffcc44" }}>{inactiveUsers}</div></div>
        </div>
      </div>
      <div style={{ padding: 10, borderRadius: 18, border: "1px solid var(--bdr2)", background: "var(--sur)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)" }}>
        <Tabs tabs={ADMIN_TABS} active={tab} onChange={setTab} />
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios activos</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "var(--cy)" }}>{activeUsers}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios inactivos</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "#ffcc44" }}>{inactiveUsers}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Addons activos</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "#00e08a" }}>{(empresa?.addons || []).length}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Plan</div><div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800, color: "var(--wh)" }}>{empresa?.plan || "—"}</div></div>
    </div>
    {tab===0&&<div>
      <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 14 }}>Selecciona un preset visual curado para tu instancia. Conserva la identidad de Produ y evita combinaciones de color poco legibles.</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {Object.entries(themePresets).map(([key,preset])=>{
          const swatch=preset[lt.mode||"dark"]||preset.dark;
          const active=(lt.preset||"clasico")===key;
          return <button key={key} onClick={e=>{e.stopPropagation();setLt({...swatch,preset:key,mode:lt.mode||"dark"});}} style={{textAlign:"left",padding:"14px 16px",borderRadius:12,border:`1px solid ${active?"var(--cy)":"var(--bdr2)"}`,background:active?"linear-gradient(180deg,var(--cg),transparent)":"var(--sur)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,color:"var(--wh)"}}>{preset.label}</div>
              {active&&<Badge label="Activo" color="cyan" sm/>}
            </div>
            <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10,lineHeight:1.4}}>{preset.description}</div>
            <div style={{display:"flex",gap:8}}>
              {[swatch.bg,swatch.surface,swatch.card,swatch.accent].map(c=><span key={c} style={{width:24,height:24,borderRadius:8,background:c,border:"1px solid var(--bdr2)"}}/>)}
            </div>
          </button>;
        })}
      </div>
      <FG label="Modo visual">
        <FSl value={lt.mode||"dark"} onChange={e=>{
          const mode=e.target.value;
          const presetKey=lt.preset||"clasico";
          const preset=themePresets[presetKey]||themePresets.clasico;
          setLt({...preset[mode],preset:presetKey,mode});
        }}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </FSl>
      </FG>
      <div style={{fontSize:11,color:"var(--gr2)",marginBottom:14}}>Los presets son fijos para mantener consistencia visual. Si más adelante quieres, podemos sumar nuevos estilos sin reabrir el selector libre de colores.</div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={e=>{e.stopPropagation();e.preventDefault();onSaveTheme(lt);ntf("Tema aplicado ✓");}} style={{padding:"9px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Aplicar</button>
        <button onClick={e=>{e.stopPropagation();const dt={...themePresets.clasico.dark,preset:"clasico",mode:"dark"};setLt(dt);onSaveTheme(dt);ntf("Produ Clásico Dark");}} style={{padding:"9px 14px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:600}}>Reset clásico</button>
      </div>
    </div>}
    {tab===1&&<div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={uq} onChange={setUq} placeholder="Buscar usuario por nombre o email..."/>
        <FilterSel value={uRole} onChange={setURole} options={roleOptions(empresa)} placeholder="Todos los roles"/>
        <FilterSel value={uState} onChange={setUState} options={[{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}].map(o=>o.label)} placeholder="Todos los estados"/>
      </div>
      <div style={{marginBottom:14}}>
        {filteredUsers.map(u=>{
          const restrictedBySuper = user?.role!=="superadmin" && ["admin","superadmin"].includes(u.role);
          return <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:6,marginBottom:6}}>
            <div style={{width:28,height:28,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(u.name)}</div>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{u.email}</div></div>
            <Badge label={getRoleConfig(u.role, empresa).label} color={getRoleConfig(u.role, empresa).badge} sm/>
            {u.isCrew&&<Badge label={u.crewRole||"Crew"} color="cyan" sm/>}
            <Badge label={u.active?"Activo":"Inactivo"} color={u.active?"green":"red"} sm/>
            <Badge label={userGoogleCalendar(u).connected?"Google conectado":"Sin Google"} color={userGoogleCalendar(u).connected?"cyan":"gray"} sm/>
            {restrictedBySuper ? <Badge label="Gestiona Super Admin" color="purple" sm/> : <>
              <GBtn sm onClick={()=>{setUid2(u.id);setUf({...u,password:""});}}>✏</GBtn>
              <GBtn sm onClick={()=>resetAccess(u)}>🔐 Reset</GBtn>
              <GBtn sm onClick={()=>toggleUserActive(u)}>{u.active?"Desactivar":"Activar"}</GBtn>
              {u.role!=="superadmin"&&<XBtn onClick={()=>{ if(!confirm("¿Eliminar usuario?")) return; deleteUser(u); }}/>}
            </>}
          </div>;
        })}
        {!filteredUsers.length&&<Empty text="Sin usuarios para este filtro"/>}
      </div>
      <div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:8,padding:16}}>
        <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:14}}>{uid2?"Editar":"Agregar"} Usuario</div>
        <R2><FG label="Nombre"><FI value={uf.name||""} onChange={e=>setUf(p=>({...p,name:e.target.value}))} placeholder="Juan Pérez"/></FG><FG label="Email"><FI type="email" value={uf.email||""} onChange={e=>setUf(p=>({...p,email:e.target.value}))} placeholder="juan@empresa.cl"/></FG></R2>
        <R3><FG label="Contraseña"><FI type="password" value={uf.password||""} onChange={e=>setUf(p=>({...p,password:e.target.value}))} placeholder={uid2?"Nueva contraseña opcional":"Contraseña inicial"}/></FG><FG label="Rol"><FSl value={editableRoleOptions.some(o=>o.value===(uf.role||"viewer"))?(uf.role||"viewer"):(editableRoleOptions[0]?.value||"viewer")} onChange={e=>setUf(p=>({...p,role:e.target.value}))}>{editableRoleOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</FSl></FG><FG label="Estado"><FSl value={uf.active===false?"false":"true"} onChange={e=>setUf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG></R3>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)",paddingTop:10}}>
            <input type="checkbox" checked={uf.isCrew===true} onChange={e=>setUf(p=>({...p,isCrew:e.target.checked,crewRole:e.target.checked?(p.crewRole||"Crew interno"):""}))}/>
            Este usuario pertenece al crew interno
          </label>
          {uf.isCrew===true&&<FG label="Cargo en crew"><FI value={uf.crewRole||""} onChange={e=>setUf(p=>({...p,crewRole:e.target.value}))} placeholder="Ej: Productor Ejecutivo, Editor, Community Manager"/></FG>}
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10}}>Puedes dejar la contraseña vacía al editar si no quieres cambiar el acceso. Las cuentas `Admin` y `Super Admin` solo se crean o gestionan desde `Super Admin &gt; Usuarios del sistema`.</div>
        <div style={{display:"flex",gap:8}}><Btn onClick={saveUser}>Guardar Usuario</Btn>{uid2&&<GBtn onClick={()=>{setUid2(null);setUf({});}}>Cancelar</GBtn>}</div>
      </div>
    </div>}
    {tab===2&&empresa&&<EmpresaEdit empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} ntf={ntf} addons={addons} companyGoogleCalendarEnabled={companyGoogleCalendarEnabled} canManageAdmin={canManageAdmin}/>}
    {tab===3&&<ListasEditor listas={listas} saveListas={saveListas} defaultListas={defaultListas}/>}
    {tab===4&&empresa&&<RolesEditor empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} ntf={ntf} uid={uid} canManageAdmin={canManageAdmin}/>}
    {tab===5&&<div>
      <div style={{fontSize:12,color:"var(--gr2)",marginBottom:14}}>Acciones sobre la base de datos de esta empresa.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        {!releaseMode
          ? <GBtn onClick={onPurge}>🔄 Restaurar / limpiar datos</GBtn>
          : <div style={{fontSize:12,color:"var(--gr2)"}}>La limpieza masiva queda bloqueada en release mode.</div>}
      </div>
    </div>}
  </Modal>;
}

export function IntegracionesAdminPanel({
  empresas,
  integrationEmpId,
  setIntegrationEmpId,
  selectedIntegrationEmp,
  companyGoogleCalendarEnabled,
  onSave,
}) {
  return <div>
    <div style={{ fontSize: 12, color: "var(--gr3)", marginBottom: 14 }}>
      Aquí quedan las bases de integraciones por empresa. Se habilitan o deshabilitan a nivel de instancia, y luego cada integración futura podrá conectarse por usuario cuando exista backend real.
    </div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <FilterSel value={integrationEmpId} onChange={setIntegrationEmpId} options={(empresas || []).map(e => ({ value: e.id, label: e.nombre }))} placeholder="Selecciona una empresa" />
    </div>
    {selectedIntegrationEmp ? <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 16 }}>
      <Card title="Google Calendar" sub={selectedIntegrationEmp.nombre}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge label={companyGoogleCalendarEnabled(selectedIntegrationEmp) ? "Activa" : "Desactivada"} color={companyGoogleCalendarEnabled(selectedIntegrationEmp) ? "green" : "gray"} sm />
          <Badge label="Base preparada" color="cyan" sm />
          <Badge label="Conexión futura por usuario" color="purple" sm />
        </div>
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
          La integración está modelada para multiempresa y conexión individual por usuario. Mientras no exista OAuth/backend real, mantenerla desactivada evita mostrar opciones incompletas dentro del calendario.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn onClick={() => onSave("empresas", (empresas || []).map(e => e.id === selectedIntegrationEmp.id ? { ...e, googleCalendarEnabled: true } : e))} sm>Activar base</Btn>
          <GBtn onClick={() => onSave("empresas", (empresas || []).map(e => e.id === selectedIntegrationEmp.id ? { ...e, googleCalendarEnabled: false } : e))} sm>Desactivar</GBtn>
        </div>
      </Card>
      <Card title="Estado operativo" sub="Lo que ya queda resuelto en el producto">
        <KV label="Visibilidad en Calendario" value={companyGoogleCalendarEnabled(selectedIntegrationEmp) ? "Oculta hasta tener sync real" : "Oculta"} />
        <KV label="Gobierno" value="Super Admin por empresa" />
        <KV label="Conexión futura" value="Usuario individual" />
        <KV label="Modelo" value="Multiempresa / multiusuario" />
      </Card>
    </div> : <Empty text="Selecciona una empresa para administrar integraciones" />}
  </div>;
}

export function ComunicacionesAdminPanel({
  empresas,
  commEmpId,
  setCommEmpId,
  selectedCommEmp,
  bannerForm,
  setBannerForm,
  onSave,
  SYSTEM_MESSAGE_PRESETS,
  applySystemPreset,
  wrapSystemSelection,
  insertSystemBlock,
  sysMsgBodyRef,
  FTA,
  sysMsg,
  setSysMsg,
  RichTextBlock,
  publishSystemMessage,
  removeSystemMessage,
  fmtD,
  XBtn,
  saveBanner,
}) {
  const TextArea = FTA;
  const RemoveButton = XBtn;
  return <div>
    <div style={{ fontSize: 12, color: "var(--gr3)", marginBottom: 14 }}>Mensajes visibles para todos los usuarios del tenant y banner global de avisos importantes.</div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <FilterSel value={commEmpId} onChange={v => {
        setCommEmpId(v);
        const emp = (empresas || []).find(e => e.id === v) || (empresas || [])[0] || null;
        setBannerForm(emp?.systemBanner || { active: false, tone: "info", text: "" });
      }} options={(empresas || []).map(e => ({ value: e.id, label: e.nombre }))} placeholder="Selecciona una empresa" />
    </div>
    {selectedCommEmp ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Mensajes del sistema" sub={selectedCommEmp.nombre}>
        <FG label="Título"><FI value={sysMsg.title || ""} onChange={e => setSysMsg(p => ({ ...p, title: e.target.value }))} placeholder="Mantenimiento programado" /></FG>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>Mensajes preset</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SYSTEM_MESSAGE_PRESETS.map(preset => <button key={preset.id} onClick={() => applySystemPreset(preset)} style={{ padding: "8px 10px", borderRadius: 999, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {preset.label}
            </button>)}
          </div>
        </div>
        <FG label="Mensaje">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button onClick={() => wrapSystemSelection("**", "**")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>B</button>
            <button onClick={() => wrapSystemSelection("*", "*")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", fontSize: 11, fontStyle: "italic", cursor: "pointer" }}>I</button>
            <button onClick={() => insertSystemBlock("- ")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Lista</button>
            <button onClick={() => insertSystemBlock("**Título breve**")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Título</button>
            <button onClick={() => wrapSystemSelection("[", "](https://)")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Link</button>
          </div>
          <TextArea ref={sysMsgBodyRef} value={sysMsg.body || ""} onChange={e => setSysMsg(p => ({ ...p, body: e.target.value }))} placeholder="Este es un mensaje visible para todos los usuarios de la empresa. Usa **negrita**, *cursiva* o [texto](https://enlace.com)." />
        </FG>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--sur)", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Vista previa</div>
          <RichTextBlock text={sysMsg.body || "Aquí verás cómo se mostrará el mensaje."} style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.55 }} color="var(--gr3)" />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Btn onClick={publishSystemMessage}>Enviar mensaje</Btn>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {(selectedCommEmp.systemMessages || []).map(msg => <div key={msg.id} style={{ padding: 12, background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{msg.title}</div>
                <RichTextBlock text={msg.body || ""} style={{ fontSize: 11, color: "var(--gr3)", marginTop: 4, lineHeight: 1.55 }} color="var(--gr3)" />
                <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 6 }}>{msg.createdAt ? fmtD(msg.createdAt) : "—"}</div>
              </div>
              <RemoveButton onClick={() => removeSystemMessage(msg.id)} />
            </div>
          </div>)}
          {!(selectedCommEmp.systemMessages || []).length && <Empty text="Sin mensajes del sistema" />}
        </div>
      </Card>
      <Card title="Banner global" sub="Visible en el portal del tenant">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--gr3)", marginBottom: 14 }}>
          <input type="checkbox" checked={!!bannerForm.active} onChange={e => setBannerForm(p => ({ ...p, active: e.target.checked }))} />
          Banner activo
        </label>
        <FG label="Tono">
          <FSl value={bannerForm.tone || "info"} onChange={e => setBannerForm(p => ({ ...p, tone: e.target.value }))}>
            <option value="info">Info</option>
            <option value="warn">Advertencia</option>
            <option value="critical">Crítico</option>
          </FSl>
        </FG>
        <FG label="Texto del banner"><TextArea value={bannerForm.text || ""} onChange={e => setBannerForm(p => ({ ...p, text: e.target.value }))} placeholder="Información importante para todos los usuarios de esta empresa." /></FG>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Btn onClick={saveBanner}>Guardar banner</Btn>
          <GBtn onClick={() => {
            setBannerForm({ active: false, tone: "info", text: "" });
            const next = (empresas || []).map(e => e.id === selectedCommEmp.id ? { ...e, systemBanner: { active: false, tone: "info", text: "" } } : e);
            onSave("empresas", next);
          }}>Desactivar</GBtn>
        </div>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--bdr2)", background: bannerForm.tone === "critical" ? "#ff556615" : bannerForm.tone === "warn" ? "#ffcc4415" : "var(--cg)", color: bannerForm.tone === "critical" ? "#ff5566" : bannerForm.tone === "warn" ? "#ffcc44" : "var(--cy)", fontSize: 12, fontWeight: 700 }}>
          {bannerForm.text || "Vista previa del banner"}
        </div>
      </Card>
    </div> : <Empty text="Selecciona una empresa para comunicarte con ese tenant" />}
  </div>;
}

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
