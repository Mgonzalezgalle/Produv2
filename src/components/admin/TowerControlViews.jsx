import { useState } from "react";
import { Badge, Btn, Card, DBtn, Empty, FG, FI, FSl, FTA, FilterSel, GBtn, KV, MultiSelect, R2, R3, SearchBar, Stat, Tabs, TD, TH, ViewModeToggle } from "../../lib/ui/components";
import { useLabSuperAdminModule } from "../../hooks/useLabSuperAdminModule";
import { assignableRoleOptions, getRoleConfig } from "../../lib/auth/authorization";
import { GovernanceSyncStatus } from "./TowerControlHealthViews";

const RESPONSIVE_TOWER_HERO_GRID = "repeat(auto-fit,minmax(min(100%,320px),1fr))";
const RESPONSIVE_TOWER_SUMMARY_GRID = "repeat(auto-fit,minmax(min(100%,160px),1fr))";

const SUPER_ADMIN_LIGHT_VARS = {
  "--bg": "#f4f8fd",
  "--card": "#ffffff",
  "--card2": "#f7fbff",
  "--sur": "#ffffff",
  "--bdr": "#dbe6f3",
  "--bdr2": "#cfdceb",
  "--wh": "#152033",
  "--gr": "#7b8aa3",
  "--gr2": "#66748d",
  "--gr3": "#42526b",
  "--cg": "rgba(26,26,46,.08)",
  "--cy": "#1a1a2e",
  "--cy2": "#2b6df6",
};
const SUPER_ADMIN_DARK_VARS = {
  "--bg": "#0b1220",
  "--card": "#131b2a",
  "--card2": "#111827",
  "--sur": "#0f1724",
  "--bdr": "#213045",
  "--bdr2": "#28384d",
  "--wh": "#f3f7ff",
  "--gr": "#6f7e96",
  "--gr2": "#93a0b5",
  "--gr3": "#ced7e5",
  "--cg": "rgba(56,189,248,.10)",
  "--cy": "#5ab4ff",
  "--cy2": "#93c5fd",
};
export function SuperAdminPanel({
  controlProps,
  actorUser,
  empresas,
  users,
  onSave,
  platformServices,
  onDeleteEmpresa,
  releaseMode = false,
  printLayouts,
  savePrintLayouts,
  helpers,
  ...panelComponents
}) {
  const resolvedProps = {
    ...(controlProps || {}),
    actorUser: actorUser ?? controlProps?.actorUser,
    empresas: empresas ?? controlProps?.empresas,
    users: users ?? controlProps?.users,
    onSave: onSave ?? controlProps?.onSave,
    platformServices: platformServices ?? controlProps?.platformServices,
    onDeleteEmpresa: onDeleteEmpresa ?? controlProps?.onDeleteEmpresa,
    releaseMode: releaseMode ?? controlProps?.releaseMode,
    printLayouts: printLayouts ?? controlProps?.printLayouts,
    savePrintLayouts: savePrintLayouts ?? controlProps?.savePrintLayouts,
    ...panelComponents,
    helpers: helpers ?? controlProps?.helpers,
  };
  const {
    actorUser: resolvedActorUser,
    empresas: resolvedEmpresas,
    users: resolvedUsers,
    onSave: resolvedOnSave,
    platformServices: resolvedPlatformServices,
    onDeleteEmpresa: resolvedOnDeleteEmpresa,
    releaseMode: resolvedReleaseMode = false,
    printLayouts: resolvedPrintLayouts,
    savePrintLayouts: resolvedSavePrintLayouts,
    EmpresasAdminPanel: ResolvedEmpresasAdminPanel,
    CarteraAdminPanel: ResolvedCarteraAdminPanel,
    SystemUsersPanel: ResolvedSystemUsersPanel,
    WizardAdminPanel: ResolvedWizardAdminPanel,
    IntegracionesAdminPanel: ResolvedIntegracionesAdminPanel,
    ComunicacionesAdminPanel: ResolvedComunicacionesAdminPanel,
    SolicitudesPanel: ResolvedSolicitudesPanel,
    helpers: resolvedHelpers,
  } = resolvedProps;
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
  } = resolvedHelpers;

  const {
    tab,setTab,q,setQ,stateF,setStateF,portfolioQ,setPortfolioQ,portfolioStatus,setPortfolioStatus,setPortfolioEmpId,
    uq,setUQ,uRole,setURole,uState,setUState,uEmp,setUEmp,ef,setEf,eid,setEid,sysUf,setSysUf,sysUid,setSysUid,integrationEmpId,setIntegrationEmpId,commEmpId,setCommEmpId,sysMsg,setSysMsg,
    bannerForm,setBannerForm,sysMsgBodyRef,totalEmp,activeEmp,totalUsers,grossMRR,netMRR,totalDiscountMRR,overdueEmp,
    activePortfolioClients,filteredEmp,filteredPortfolio,selectedPortfolioEmp,filteredUsers,selectedIntegrationEmp,selectedCommEmp,saveSystemUser,editSystemUser,resetSystemUserAccess,deleteSystemUser,SUPER_TABS,SUPER_TAB_META,activeSuperTab,saveEmp,savePortfolio,publishSystemMessage,wrapSystemSelection,insertSystemBlock,
    applySystemPreset,saveBanner,removeSystemMessage,handleAceptarSolicitud,handleRechazarSolicitud,guardedOnSave,saveIntegrationProvisioning,lastGovernanceSync,
  } = useLabSuperAdminModule({
    actorUser: resolvedActorUser,
    empresas: resolvedEmpresas,
    users: resolvedUsers,
    platformServices: resolvedPlatformServices,
    printLayouts: resolvedPrintLayouts,
    savePrintLayouts: resolvedSavePrintLayouts,
    onSave: resolvedOnSave,
    dbGet,
    dbSet,
    uid, today, nowIso, fmtD, fmtMoney, normalizePrintLayouts, DEFAULT_PRINT_LAYOUTS,
    normalizeEmpresasModel,
    companyBillingDiscountPct, companyReferralDiscountMonthsPending, companyReferralDiscountHistory,
    companyBillingBaseNet, companyBillingNet, companyBillingStatus, companyPaymentDayLabel,
    companyIsUpToDate, companyGoogleCalendarEnabled, nextTenantCode, shouldConsumeReferralDiscountMonth,
    normalizeEmailValue, sha256Hex, sanitizeAssignableRole,
  });

  const activeTabMeta = SUPER_TAB_META[activeSuperTab] || {};
  const [controlTheme] = useState("light");
  const isLightMode = controlTheme === "light";
  const controlThemeVars = isLightMode ? SUPER_ADMIN_LIGHT_VARS : SUPER_ADMIN_DARK_VARS;
  const summaryCards = [
    { label: "Tenants", value: totalEmp, accent: "var(--cy2)", tone: "rgba(43,109,246,.14)" },
    { label: "Activos", value: activeEmp, accent: "#4ade80", tone: "rgba(74,222,128,.14)" },
    { label: "MRR Neto", value: fmtMoney(netMRR,"UF"), accent: "#a855f7", tone: "rgba(168,85,247,.14)" },
  ];

  return <div style={controlThemeVars}>
    <div style={{padding:"18px 18px 16px",border:"1px solid var(--bdr2)",borderRadius:22,background:isLightMode?"linear-gradient(180deg,rgba(43,109,246,.08),rgba(43,109,246,.02) 42%, transparent 100%)":"linear-gradient(180deg,rgba(56,189,248,.10),rgba(56,189,248,.03) 42%, transparent 100%)",marginBottom:16,boxShadow:isLightMode?"0 18px 40px rgba(15,23,42,.08)":"0 18px 40px rgba(0,0,0,.22)"}}>
      <div style={{display:"grid",gridTemplateColumns:RESPONSIVE_TOWER_HERO_GRID,gap:16,alignItems:"stretch",marginBottom:14}}>
        <div style={{padding:"4px 2px 0"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:10}}>
            <Badge label="Torre de Control" color="cyan" sm />
            <span style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.5}}>{activeTabMeta.eyebrow || "Gobierno SaaS"}</span>
          </div>
          <div style={{fontFamily:"var(--fh)",fontSize:28,fontWeight:800,color:"var(--wh)",marginBottom:8,lineHeight:1.1}}>Centro operativo de Produ</div>
          <div style={{fontSize:12,color:"var(--gr2)",maxWidth:720,lineHeight:1.7,marginBottom:12}}>{activeTabMeta.desc}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Badge label={`${activeEmp} tenant${activeEmp === 1 ? "" : "s"} activos`} color="green" sm />
            <Badge label={`${totalUsers} usuario${totalUsers === 1 ? "" : "s"} administrados`} color="gray" sm />
          </div>
          {lastGovernanceSync && <div style={{marginTop:10}}><GovernanceSyncStatus sync={lastGovernanceSync} /></div>}
        </div>
        <div style={{display:"grid",gridTemplateColumns:RESPONSIVE_TOWER_SUMMARY_GRID,gap:10,alignContent:"start"}}>
          {summaryCards.map(card=><div key={card.label} style={{padding:"12px 12px 13px",borderRadius:16,border:"1px solid var(--bdr2)",background:"linear-gradient(180deg,#ffffff,#f7fbff)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>{card.label}</span>
              <span style={{width:8,height:8,borderRadius:999,background:card.accent,boxShadow:`0 0 0 5px ${card.tone}`}} />
            </div>
            <div style={{fontFamily:"var(--fm)",fontSize:card.label==="MRR Neto"?18:22,fontWeight:800,color:card.accent,lineHeight:1.1}}>{card.value}</div>
          </div>)}
        </div>
      </div>
      <div style={{padding:10,borderRadius:18,border:"1px solid var(--bdr2)",background:isLightMode?"rgba(255,255,255,.88)":"rgba(9,12,18,.72)",boxShadow:isLightMode?"0 12px 28px rgba(15,23,42,.05), inset 0 1px 0 rgba(255,255,255,.85)":"inset 0 1px 0 rgba(255,255,255,.03)"}}>
        <Tabs tabs={SUPER_TABS} active={tab} onChange={setTab}/>
      </div>
    </div>
    {tab===0&&<ResolvedEmpresasAdminPanel totalEmp={totalEmp} activeEmp={activeEmp} totalUsers={totalUsers} q={q} setQ={setQ} stateF={stateF} setStateF={setStateF} filteredEmp={filteredEmp} ini={ini} addons={addons} setEid={setEid} setEf={setEf} onSave={guardedOnSave} empresas={resolvedEmpresas} users={resolvedUsers} platformServices={resolvedPlatformServices} onDeleteEmpresa={resolvedOnDeleteEmpresa} eid={eid} ef={ef} saveEmp={saveEmp} releaseMode={resolvedReleaseMode} />}
    {tab===1&&<ResolvedCarteraAdminPanel activeEmp={activeEmp} grossMRR={grossMRR} totalDiscountMRR={totalDiscountMRR} netMRR={netMRR} overdueEmp={overdueEmp} portfolioQ={portfolioQ} setPortfolioQ={setPortfolioQ} portfolioStatus={portfolioStatus} setPortfolioStatus={setPortfolioStatus} exportActiveClientsCSV={exportActiveClientsCSV} exportActiveClientsPDF={exportActiveClientsPDF} activePortfolioClients={activePortfolioClients} filteredPortfolio={filteredPortfolio} selectedPortfolioEmp={selectedPortfolioEmp} setPortfolioEmpId={setPortfolioEmpId} companyBillingStatus={companyBillingStatus} companyBillingNet={companyBillingNet} companyBillingBaseNet={companyBillingBaseNet} companyReferralDiscountMonthsPending={companyReferralDiscountMonthsPending} companyReferralDiscountHistory={companyReferralDiscountHistory} companyPaymentDayLabel={companyPaymentDayLabel} companyBillingDiscountPct={companyBillingDiscountPct} companyIsUpToDate={companyIsUpToDate} fmtMoney={fmtMoney} fmtD={fmtD} savePortfolio={savePortfolio} addons={addons} ini={ini} users={resolvedUsers} platformServices={resolvedPlatformServices} />}
    {tab===2&&<ResolvedSystemUsersPanel empresas={resolvedEmpresas} sysUf={sysUf} setSysUf={setSysUf} sysUid={sysUid} setSysUid={setSysUid} systemRoleOptions={assignableRoleOptions(null, {role:"superadmin"}, true)} saveSystemUser={saveSystemUser} editSystemUser={editSystemUser} resetSystemUserAccess={resetSystemUserAccess} deleteSystemUser={deleteSystemUser} uq={uq} setUQ={setUQ} uRole={uRole} setURole={setURole} uState={uState} setUState={setUState} uEmp={uEmp} setUEmp={setUEmp} filteredUsers={filteredUsers} ini={ini} getRoleConfig={getRoleConfig} userGoogleCalendar={userGoogleCalendar} />}
    {tab===3&&<ResolvedWizardAdminPanel dbGet={dbGet} dbSet={dbSet} />}
    {tab===4&&<ResolvedIntegracionesAdminPanel empresas={resolvedEmpresas} integrationEmpId={integrationEmpId} setIntegrationEmpId={setIntegrationEmpId} selectedIntegrationEmp={selectedIntegrationEmp} companyGoogleCalendarEnabled={companyGoogleCalendarEnabled} onSave={guardedOnSave} saveIntegrationProvisioning={saveIntegrationProvisioning} platformServices={resolvedPlatformServices} />}
    {tab===5&&<ResolvedComunicacionesAdminPanel empresas={resolvedEmpresas} commEmpId={commEmpId} setCommEmpId={setCommEmpId} selectedCommEmp={selectedCommEmp} bannerForm={bannerForm} setBannerForm={setBannerForm} onSave={guardedOnSave} SYSTEM_MESSAGE_PRESETS={SYSTEM_MESSAGE_PRESETS} applySystemPreset={applySystemPreset} wrapSystemSelection={wrapSystemSelection} insertSystemBlock={insertSystemBlock} sysMsgBodyRef={sysMsgBodyRef} FTA={FTA} sysMsg={sysMsg} setSysMsg={setSysMsg} RichTextBlock={resolvedHelpers.RichTextBlock} publishSystemMessage={publishSystemMessage} removeSystemMessage={removeSystemMessage} fmtD={fmtD} XBtn={XBtn} saveBanner={saveBanner} />}
    {tab===6&&<ResolvedSolicitudesPanel empresas={resolvedEmpresas} dbGet={dbGet} fmtD={fmtD} addons={addons} onAceptar={handleAceptarSolicitud} onRechazar={handleRechazarSolicitud}/>}
  </div>;
}
