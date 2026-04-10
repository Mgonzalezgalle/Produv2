// ============================================================
//  PRODU — Gestión de Productoras
//  src/App.jsx  |  Parte 1 de 4: Core + Auth + Layout
// ============================================================
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { dbGet as rawDbGet, dbSet as rawDbSet, normalizeUsersAuth, sb, sha256Hex } from "./lib/auth/clientAuth";
import { ViewCts, ViewPres, ViewPresDet } from "./components/commercial/BudgetViews";
import { ViewCalendario } from "./components/calendar/CalendarView";
import { CoreModalRouter } from "./components/CoreModalRouter";
import { ViewCliDet, ViewClientes } from "./components/clients/ClientViews";
import { AdminPanel as AdminPanelView, SuperAdminPanel as SuperAdminPanelView } from "./components/admin/AdminViews";
import { EmpresaSelector as EmpresaSelectorView, Login as LoginView } from "./components/auth/AuthViews";
import { CrmModule } from "./components/crm/CrmModule";
import { ViewFact } from "./components/commercial/InvoiceViews";
import { MActivo as MActivoView, MAus as MAusView, MCampanaContenido as MCampanaContenidoView, MCli as MCliView, MCrew as MCrewView, MEvento as MEventoView, MEp as MEpView, MPg as MPgView, MPiezaContenido as MPiezaContenidoView, MPro as MProView, MTarea as MTareaView } from "./components/operations/OperationModals";
import { AusCard as AusCardView, MiniCal as MiniCalView, MovBlock as MovBlockView } from "./components/operations/OperationSupport";
import { ViewActivos, ViewAus, ViewContenidos, ViewContenidoDet, ViewCrew, ViewEpDet, ViewPgs, ViewPgDet, ViewPros, ViewProDet } from "./components/operations/ProductionViews";
import { ComentariosBlock, TareaCard, TareasContexto } from "./components/operations/TaskSupport";
import { ViewTareas } from "./components/operations/TaskViews";
import { RichTextBlock, StyleTag } from "./components/shared/AppCore";
import { ContactBtns } from "./components/shared/ContactButtons";
import { TaskErrorBoundary, Toast } from "./components/shared/CoreFeedback";
import { BrandLockup, LoadingScreen, Sidebar } from "./components/shared/ShellLayout";
import { AlertasPanel as AlertasPanelView, SystemMessagesPanel as SystemMessagesPanelView } from "./components/shared/SystemPanels";
import { TreasuryModule } from "./components/treasury/TreasuryModule";
import { ModuleHeader } from "./lib/ui/components";
import { ViewDashboard } from "./components/dashboard/DashboardView";
import { useLabCommercialDocs } from "./hooks/useLabCommercialDocs";
import * as LabUI from "./lib/ui/components";
import {
  assignableRoleOptions,
  canAccessModule,
  canDo,
  getRoleConfig,
  hasAddon,
  roleOptions,
  sanitizeAssignableRole,
} from "./lib/auth/authorization";
import {
  DEFAULT_LISTAS,
  DEFAULT_PRINT_LAYOUTS,
  budgetPaymentDateValue,
  budgetPaymentMethodValue,
  budgetPaymentNotesValue,
  budgetObservationValue,
  buildInternalCrewFromUser,
  cobranzaState,
  commentAttachmentFromFile,
  companyBillingBaseNet,
  companyBillingDiscountPct,
  companyBillingNet,
  companyBillingStatus,
  companyGoogleCalendarEnabled,
  companyIsUpToDate,
  companyPaymentDayLabel,
  companyPaymentInfoText,
  contractsForReference,
  contractVisualState,
  companyPrintColor,
  companyReferralDiscountHistory,
  companyReferralDiscountMonthsPending,
  countCampaignPieces,
  buildSupportSettings,
  ensureSupportThread,
  ensureRequiredSystemUsers,
  invoiceEntityName,
  isPasswordHash,
  nextTenantCode,
  normalizeEmailValue,
  normalizeCommentAttachments,
  normalizeEmpresasModel,
  normalizeEmpresasTenantCodes,
  normalizePrintLayouts,
  normalizeSocialCampaign,
  normalizeSocialCampaigns,
  normalizeSocialPiece,
  normalizeSupportThreads,
  recurringSummary,
  shouldConsumeReferralDiscountMonth,
  supportAttachmentFromFile,
  supportThreadPreviewText,
  syncCrewWithUsers,
  userGoogleCalendar,
  budgetRefLabel,
  daysUntil,
} from "./lib/utils/helpers";
import {
  exportActiveClientsCSV,
  exportActiveClientsPDF,
  exportComentariosCSV,
  exportComentariosPDF,
  exportMovCSV,
  exportMovPDF,
} from "./lib/utils/exports";
import { buildSimplePdfBlob } from "./lib/utils/pdf";
import {
  CRM_STAGE_SEED,
  crmCanPassToClient,
  crmEntityLabel,
  crmFindClientDuplicate,
  crmFindSponsorDuplicate,
  crmNormalizeActivities,
  crmNormalizeOpportunity,
  normalizeCrmStages,
  recoverPreferredCrmStages,
} from "./lib/utils/crm";
import {
  buildSeedTreasuryData,
  buildTreasurySidebarItem,
  countPendingTreasury,
  TREASURY_MODULE_ICON,
  TREASURY_MODULE_ID,
  TREASURY_MODULE_LABEL,
  TREASURY_STORE_KEYS,
  treasuryReleaseEnabled,
} from "./lib/utils/treasury";
import {
  ADDON_REGISTRY,
  buildSidebarNavigation,
  MODULE_LABELS,
} from "./lib/modules/moduleRegistry";
import { SYSTEM_MESSAGE_PRESETS, THEME_PRESETS } from "./lib/config/appConfig";
import { createLabDb, LAB_DATA_CONFIG, localLabKey } from "./lib/lab/storageNamespace";
import { buildSeedData, SEED_EMPRESAS as BASE_SEED_EMPRESAS, SEED_USERS } from "./lib/lab/seeds";
import { isStoredSessionExpired, sessionPayload } from "./lib/auth/sessionStorage";
import { createAuthGateway } from "./lib/auth/authGateway";
import { getLabAuthModeLabel, LAB_AUTH_CONFIG } from "./lib/auth/authConfig";
import { useLabBootGuards } from "./hooks/useLabBootGuards";
import { useLabBalance } from "./hooks/useLabBalance";
import { useLabBudgetList } from "./hooks/useLabBudgetList";
import { useLabCrmGuards } from "./hooks/useLabCrmGuards";
import { useGlobalLabData, useTenantLabData } from "./hooks/useLabDataStore";
import { useLabGlobalInit } from "./hooks/useLabGlobalInit";
import { useLabAlerts } from "./hooks/useLabAlerts";
import { useLabPersistence } from "./hooks/useLabPersistence";
import { useLabShell } from "./hooks/useLabShell";
import { useLabSignals } from "./hooks/useLabSignals";
import { useLabTenantAdmin } from "./hooks/useLabTenantAdmin";
import { useLabTheme } from "./hooks/useLabTheme";
import { assignedNameList, COLS_TAREAS, getAssignedIds, normalizeTaskAssignees } from "./lib/utils/tasks";

// ── SUPABASE ─────────────────────────────────────────────────
const { dbGet, dbSet, dbCloneFromProd } = createLabDb(rawDbGet, rawDbSet);

// ── UTILS ────────────────────────────────────────────────────
const uid   = () => "_" + Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().split("T")[0];
const nowIso = () => new Date().toISOString();
const addMonths = (dateStr = today(), months = 0) => {
  const [year, month, day] = String(dateStr || today()).split("-").map(Number);
  const base = new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1);
  if (Number.isNaN(base.getTime())) return dateStr || today();
  base.setMonth(base.getMonth() + Number(months || 0));
  return base.toISOString().split("T")[0];
};
const ini   = (s="") => s.split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const fmtM  = n => "$" + Number(n||0).toLocaleString("es-CL");
const fmtMoney = (n, currency="CLP") => {
  const value = Number(n || 0);
  if (currency === "UF") return `UF ${value.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  if (currency === "USD") return "US$" + value.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2});
  if (currency === "EUR") return "€" + value.toLocaleString("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2});
  return fmtM(value);
};
const fmtD  = d => { try { return new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d||"—"; } };
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const ADDONS = ADDON_REGISTRY;
const SEED_EMPRESAS = BASE_SEED_EMPRESAS(today);
const SEED_DATA = empId => buildSeedData(empId, { CRM_STAGE_SEED });

// ── CSS ──────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#080809;--sur:#0f0f11;--card:#141416;--card2:#1a1a1e;
  --bdr:#1e1e24;--bdr2:#28282f;--cy:#00d4e8;--cy2:#00b8c8;
  --cg:#00d4e820;--cm:#00d4e840;--wh:#f4f4f6;
  --gr:#52525e;--gr2:#7c7c8a;--gr3:#a8a8b8;
  --red:#ff5566;--grn:#00e08a;--yel:#ffcc44;--org:#ff8844;--pur:#a855f7;
  --fh:'Syne',sans-serif;--fb:'Inter',sans-serif;--fm:'JetBrains Mono',monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px;-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--wh);font-family:var(--fb);min-height:100vh}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px}
input:focus,select:focus,textarea:focus{outline:none!important;border-color:var(--cy)!important;box-shadow:0 0 0 3px var(--cg)!important}
tbody tr{cursor:pointer;transition:.1s}tbody tr:hover td{background:var(--card2)!important}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes modalIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{to{transform:rotate(360deg)}}
/* Modern light theme enhancements */
body.light .sidebar-inner{background:var(--sidebar-bg)!important}
body.light aside{background:var(--sidebar-bg)!important;border-right:none!important}
body.light aside *{border-color:#ffffff14!important}
body.light aside .nav-label{color:#e2e8f0!important}
body.light .card-wrap,.card{border-radius:12px}
body.light .card-wrap{box-shadow:0 1px 4px rgba(0,0,0,.07),0 2px 12px rgba(0,0,0,.04)!important;border:none!important}
body.light main{background:#eef2f7}
body.light .stat-card{box-shadow:0 2px 8px rgba(0,0,0,.07);border:none}
body.light input,body.light select,body.light textarea{background:#ffffff;border-color:#cbd5e1;color:#0f172a}
body.light input:focus,body.light select:focus,body.light textarea:focus{border-color:#4f46e5;box-shadow:0 0 0 3px #4f46e520}
body.light button[class*="btn"]{transition:all .15s}
.va{animation:fadeUp .2s ease}
body.light{--bg:#eef2f7;--sur:#ffffff;--card:#ffffff;--card2:#f3f6fb;--bdr:#d7dee8;--bdr2:#c2ccd8;--wh:#0f172a;--gr:#64748b;--gr2:#475569;--gr3:#1e293b;--sidebar:#111827;--sidebar-text:#cbd5e1;--sidebar-active:#ffffff;--sidebar-active-bg:#0ea5b7}
body.light .sidebar-wrap{background:var(--sidebar-bg)!important}
body.light .sidebar-wrap *{border-color:#ffffff15!important}
body.light aside{background:var(--sidebar-bg)!important;border-right:none!important;box-shadow:2px 0 24px rgba(15,23,42,.24)}
body.light aside .nav-group-label{color:#94a3b8!important}
body.light aside,body.light aside button,body.light aside div,body.light aside span,body.light aside small{color:#e5edf7!important}
body.light aside [style*="color:var(--gr2)"]{color:#a9b8cb!important}
body.light aside [style*="color:var(--gr3)"]{color:#e5edf7!important}
body.light aside [style*="color:var(--wh)"]{color:#ffffff!important}
body.light aside .active-nav{background:#ffffff18!important;color:#ffffff!important}
body.light .topbar{background:#ffffff;border-bottom:1px solid #dbe2ea;box-shadow:0 1px 3px rgba(15,23,42,.05)}
@media(max-width:1024px){
  html{font-size:13px}
  [style*="repeat(4,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  [style*="repeat(6,1fr)"]{grid-template-columns:repeat(3,minmax(0,1fr))!important}
  [style*="repeat(3,1fr)"]{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  [style*="1fr 1fr 1fr"]{grid-template-columns:1fr 1fr!important}
  [style*="1fr 1fr"]{grid-template-columns:1fr!important}
}
@media(max-width:768px){
  aside{transform:translateX(-100%);transition:transform .25s ease!important;width:260px!important;z-index:300!important}
  aside.mob-open{transform:translateX(0)!important}
  main,.app-main{margin-left:0!important;width:100%!important}
  .topbar{padding:0 14px!important;height:auto!important;min-height:60px;flex-wrap:wrap}
  .app-page{padding:14px!important}
  .app-breadcrumbs{min-width:0!important}
  .app-actions{width:100%;justify-content:flex-end;flex-wrap:wrap}
  [style*="repeat(4,1fr)"],[style*="repeat(6,1fr)"],[style*="repeat(3,1fr)"],[style*="1fr 1fr 1fr"],[style*="1fr 1fr"]{grid-template-columns:1fr!important}
  [style*="width:260px"]{width:100%!important;max-width:100%!important}
  [style*="min-width:190"]{min-width:0!important}
  [style*="justify-content:space-between"][style*="width:260px"]{width:100%!important}
  .login-shell,.company-shell{padding:16px!important}
  .login-card,.company-card{width:100%!important;max-width:100%!important;padding:24px 18px!important}
  .search-wrap{max-width:none!important;width:100%!important}
  .toast-box{left:12px!important;right:12px!important;bottom:12px!important;max-width:none!important}
  .pager{flex-direction:column;align-items:flex-start!important;gap:12px}
  .ham-btn{display:flex!important}
  .modal-wrap{align-items:flex-end!important;padding:0!important}
  .modal-box{border-radius:16px 16px 0 0!important;width:100%!important;max-width:100%!important;max-height:92vh!important}
  input,select,textarea{font-size:16px!important}
}
@media(max-width:1024px){
  .login-card{grid-template-columns:1fr!important;gap:14px!important}
  .login-form{order:-1;padding:30px 24px!important}
  .login-promo{min-height:auto!important;padding:26px!important}
  .login-promo-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .login-promo-footer{grid-template-columns:1fr!important}
  .login-title{font-size:34px!important;max-width:none!important}
}
@media(max-width:640px){
  .login-shell{padding:12px!important;align-items:flex-start!important}
  .login-card{gap:12px!important}
  .login-form,.login-promo{border-radius:18px!important;box-shadow:0 12px 36px rgba(0,0,0,.24)!important}
  .login-form{padding:22px 16px!important}
  .login-promo{padding:20px 16px!important}
  .login-promo-grid{grid-template-columns:1fr!important}
  .login-title{font-size:28px!important;line-height:1.05!important}
  .login-subcopy{font-size:13px!important}
  .login-promo-copy{font-size:13px!important}
}
@media(min-width:769px){
  .mob-overlay{display:none!important}
  .ham-btn{display:none!important}
}
`;

// ── UI PRIMITIVES ────────────────────────────────────────────
const { Badge, Paginator, Modal, FG, FI, FSl, FTA, R2, R3, MFoot, Btn, GBtn, DBtn, XBtn, Stat, TH, TD, Card, Empty, Sep, Tabs, KV, SearchBar, FilterSel, ViewModeToggle, MultiSelect } = LabUI;

// ── LOGIN ────────────────────────────────────────────────────

// ── SOLICITUD MODAL ───────────────────────────────────────────
// ── EXPORT FUNCTIONS ─────────────────────────────────────────
// ── ALERTAS — Bandeja operativa ───────────────────────────────
// ── SUPER ADMIN PANEL ─────────────────────────────────────────

// ── ADMIN PANEL ───────────────────────────────────────────────

// ── EMPRESA EDIT — editar datos de empresa desde Admin ───────
// ── APP ROOT ─────────────────────────────────────────────────
export default function App(){
  const authGateway = useMemo(() => createAuthGateway(LAB_AUTH_CONFIG.strategy), []);
  const [curUser,setCurUser]=useState(null);
  const [curEmp,setCurEmp]=useState(null);
  const [storedSession,setStoredSession]=useState(null);
  const [view,setView]=useState("dashboard");
  const [detId,setDetId]=useState(null);
  const [toast,setToast]=useState(null);
  const [mOpen,setMOpen]=useState("");
  const [mData,setMData]=useState({});
  const [adminOpen,setAdminOpen]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [isMobile,setIsMobile]=useState(()=>typeof window!=="undefined" ? window.innerWidth<=768 : false);
  const [syncPulse,setSyncPulse]=useState(false);
  const [superPanel,setSuperPanel]=useState(false);
  const [alertasOpen,setAlertasOpen]=useState(false);
  const [alertasLeidas,setAlertasLeidas]=useState([]);
  const [systemOpen,setSystemOpen]=useState(false);
  const [systemLeidas,setSystemLeidas]=useState([]);

  // Global data
  const {
    empresas,setEmpresasRaw,savEmpRef,
    users,setUsersRaw,savUsrRef,
    printLayouts,setPrintLayoutsRaw,
    supportThreads,setSupportThreadsRaw,savSupportThreads,
    supportSettings,setSupportSettingsRaw,savSupportSettings,
    setThemeDB,
  } = useGlobalLabData();

  // Per-empresa data
  const eId=curEmp?.id||"__none__";
  const {
    listas,setListas,savLst,ldLst,
    tareas,setTareas,savTar,ldTar,
    clientes,setClientes,savCli,ldCli,
    producciones,setProducciones,savPro,ldPro,
    programas,setProgramas,savPg,ldPg,
    piezas,setPiezas,savPiezas,ldPiezas,
    episodios,setEpisodios,savEp,ldEp,
    auspiciadores,setAuspiciadores,savAus,ldAus,
    crmOpps,setCrmOpps,savCrmOpps,ldCrmOpps,
    crmActivities,setCrmActivities,savCrmActivities,ldCrmActivities,
    crmStages,setCrmStages,savCrmStages,ldCrmStages,
    contratos,setContratos,savCt,ldCt,
    movimientos,setMovimientos,savMov,ldMov,
    crew,setCrew,savCrew,ldCrew,
    eventos,setEventos,savEv,ldEv,
    presupuestos,setPresupuestos,savPres,ldPres,
    facturas,setFacturas,savFact,ldFact,
    treasuryProviders,setTreasuryProviders,savTreasuryProviders,ldTreasuryProviders,
    treasuryPayables,setTreasuryPayables,savTreasuryPayables,ldTreasuryPayables,
    treasuryPurchaseOrders,setTreasuryPurchaseOrders,savTreasuryPurchaseOrders,ldTreasuryPurchaseOrders,
    treasuryIssuedOrders,setTreasuryIssuedOrders,savTreasuryIssuedOrders,ldTreasuryIssuedOrders,
    treasuryReceipts,setTreasuryReceipts,savTreasuryReceipts,ldTreasuryReceipts,
    treasuryDisbursements,setTreasuryDisbursements,savTreasuryDisbursements,ldTreasuryDisbursements,
    activos,setActivos,savAct,ldAct,
  } = useTenantLabData(eId);
  const L = listas || DEFAULT_LISTAS; // listas activas con fallback a defaults
  const empId = curEmp?.id;
  const isLoading = !!curEmp && [ldLst,ldTar,ldCli,ldPro,ldPg,ldPiezas,ldEp,ldAus,ldCrmOpps,ldCrmActivities,ldCrmStages,ldCt,ldMov,ldCrew,ldEv,ldPres,ldFact,ldTreasuryProviders,ldTreasuryPayables,ldTreasuryPurchaseOrders,ldTreasuryIssuedOrders,ldTreasuryReceipts,ldTreasuryDisbursements,ldAct].some(Boolean);
  const tasksEnabled = hasAddon(curEmp,"tareas");
  const alertHelpers = useMemo(() => ({
    cobranzaState,
    daysUntil,
    fmtM,
  }), []);
  const alertas = useLabAlerts(episodios, programas, eventos || [], tasksEnabled ? (tareas || []) : [], facturas || [], contratos || [], empId, alertHelpers);

  const { theme, applyTheme, saveTheme } = useLabTheme({
    THEME_PRESETS,
    curEmp,
    empresas,
    setEmpresasRaw,
    setThemeDB,
    dbSet,
  });

  useLabGlobalInit({
    dbGet,
    dbSet,
    dbCloneFromProd,
    setEmpresasRaw,
    setUsersRaw,
    setPrintLayoutsRaw,
    setSupportThreadsRaw,
    setSupportSettingsRaw,
    normalizeEmpresasTenantCodes,
    ensureRequiredSystemUsers,
    normalizePrintLayouts,
    normalizeSupportThreads,
    buildSupportSettings,
    applyTheme,
    THEME_PRESETS,
    setStoredSession,
    SEED_EMPRESAS,
    SEED_USERS,
    DEFAULT_PRINT_LAYOUTS,
    empresas,
    users,
    supportSettings,
  });

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(users) || !users.length) return;
    normalizeUsersAuth(users).then(next=>{
      const merged = ensureRequiredSystemUsers(next);
      const changed = JSON.stringify(merged) !== JSON.stringify(users);
      if(changed){
        setUsersRaw(merged);
        dbSet("produ:users",merged);
      }
    });
  },[users]);

  useEffect(()=>{
    if(!storedSession || !Array.isArray(users) || !Array.isArray(empresas)) return;
    if(isStoredSessionExpired(storedSession)){
      setCurUser(null);setCurEmp(null);
      try{sessionStorage.removeItem(localLabKey("session"));}catch{}
      try{localStorage.removeItem(localLabKey("session"));}catch{}
      setStoredSession(null);
      return;
    }
    const freshUser=(users||[]).find(u=>u.id===storedSession.userId&&u.active);
    if(!freshUser){
      setCurUser(null);setCurEmp(null);
      try{sessionStorage.removeItem(localLabKey("session"));}catch{}
      try{localStorage.removeItem(localLabKey("session"));}catch{}
      setStoredSession(null);
      return;
    }
    if(["superadmin","admin"].includes(freshUser.role) && storedSession?.authStrength!=="mfa_totp"){
      setCurUser(null);setCurEmp(null);
      try{sessionStorage.removeItem(localLabKey("session"));}catch{}
      try{localStorage.removeItem(localLabKey("session"));}catch{}
      setStoredSession(null);
      return;
    }
    const sessionEmpId=freshUser.role==="superadmin" ? storedSession.empId : freshUser.empId;
    const freshEmp=sessionEmpId?(empresas||[]).find(e=>e.id===sessionEmpId&&e.active!==false):null;
    setCurUser(prev => prev?.id === freshUser.id ? prev : freshUser);
    setCurEmp(prev => prev?.id === (freshEmp?.id || null) ? prev : (freshEmp||null));
  },[storedSession,users,empresas]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(empresas) || !empresas.length) return;
    const normalized = normalizeEmpresasModel(empresas);
    if(JSON.stringify(normalized)!==JSON.stringify(empresas)){
      setEmpresasRaw(normalized);
      dbSet("produ:empresas",normalized);
    }
  },[empresas]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(empresas) || !empresas.length) return;
    try{
      const flag = localStorage.getItem("produ_support_chat_default_off_v1");
      if(flag) return;
      const next = normalizeEmpresasModel((empresas||[]).map(emp=>({...emp,supportChatEnabled:false})));
      setEmpresasRaw(next);
      dbSet("produ:empresas",next);
      localStorage.setItem("produ_support_chat_default_off_v1","1");
    }catch{}
  },[empresas]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(empresas) || !empresas.length) return;
    try{
      const flag = localStorage.getItem("produ_freshdesk_removed_v1");
      if(flag) return;
      const next = normalizeEmpresasModel((empresas||[]).map(emp=>({...emp,freshdeskEnabled:false})));
      setEmpresasRaw(next);
      dbSet("produ:empresas",next);
      localStorage.setItem("produ_freshdesk_removed_v1","1");
    }catch{}
  },[empresas]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(empresas) || !empresas.length) return;
    try{
      const flag = localStorage.getItem("produ_crm_default_on_v1");
      if(flag) return;
      const next = normalizeEmpresasModel((empresas||[]).map(emp=>{
        const addons = Array.isArray(emp?.addons) ? emp.addons : [];
        return addons.includes("crm") ? emp : { ...emp, addons:[...addons,"crm"], migratedCrmAddon:true };
      }));
      setEmpresasRaw(next);
      dbSet("produ:empresas",next);
      localStorage.setItem("produ_crm_default_on_v1","1");
    }catch{}
  },[empresas]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!printLayouts) return;
    const normalized = normalizePrintLayouts(printLayouts);
    if(JSON.stringify(normalized)!==JSON.stringify(printLayouts)){
      setPrintLayoutsRaw(normalized);
      dbSet("produ:printLayouts",normalized);
    }
  },[printLayouts]);

  // Seed per-empresa data
  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!curEmp) return;
    const id=curEmp.id;
    const keys=["clientes","producciones","programas","piezas","episodios","auspiciadores","crmOpps","crmActivities","crmStages","contratos","movimientos","crew","eventos","presupuestos","facturas",...TREASURY_STORE_KEYS,"activos","listas","tareas"];
    const setters={setTareas,setClientes,setProducciones,setProgramas,setPiezas,setEpisodios,setAuspiciadores,setCrmOpps,setCrmActivities,setCrmStages,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setTreasuryPayables,setTreasuryPurchaseOrders,setTreasuryIssuedOrders,setTreasuryReceipts,setTreasuryDisbursements,setActivos,setMovimientos};
    keys.forEach(async k=>{
      const v=await dbGet(`${id}:${k}`);
      if(v===null){
        const seed=SEED_DATA(id)[k]||[];
        const cloned = await dbCloneFromProd(`produ:${id}:${k}`, seed);
        const next = cloned===null ? seed : cloned;
        dbSet(`${id}:${k}`,next);
        setters[k]?.(next);
      }
    });
  },[curEmp?.id]);

  const crmSavingRef = useRef(false);

  useLabCrmGuards({
    curEmp,
    ldCrmStages,
    crmStages,
    setCrmStages,
    normalizeCrmStages,
    recoverPreferredCrmStages,
    CRM_STAGE_SEED,
    ldCrmOpps,
    crmOpps,
    setCrmOpps,
    crmNormalizeOpportunity,
    ldCrmActivities,
    crmActivities,
    setCrmActivities,
    crmNormalizeActivities,
    crmSavingRef,
  });

  useEffect(()=>{
    const onResize=()=>{
      const mobile=window.innerWidth<=768;
      setIsMobile(mobile);
      if(mobile) setCollapsed(false);
    };
    onResize();
    window.addEventListener("resize",onResize);
    return ()=>window.removeEventListener("resize",onResize);
  },[]);

  const { ntf, openM, closeM, navTo, login, logout, selectEmp, refreshSessionActivity } = useLabShell({
    setToast,
    setSyncPulse,
    setMData,
    setMOpen,
    setView,
    setDetId,
    setCurUser,
    setCurEmp,
    setStoredSession,
    setSuperPanel,
    curUser,
    storedSession,
    empresas,
    SEED_EMPRESAS,
    sessionPayload,
  });

  useEffect(()=>{
    if(!curUser || !storedSession) return;
    let lastTouch = 0;
    const onActivity = () => {
      const now = Date.now();
      if(now - lastTouch < 15000) return;
      lastTouch = now;
      refreshSessionActivity({ lastActivityAt: now });
    };
    const events = ["mousedown","keydown","scroll","touchstart"];
    events.forEach(evt=>window.addEventListener(evt,onActivity,{passive:true}));
    return ()=>events.forEach(evt=>window.removeEventListener(evt,onActivity));
  },[curUser?.id,storedSession?.lastActivityAt,refreshSessionActivity]);

  useEffect(()=>{
    if(!curUser || !storedSession) return;
    const interval = setInterval(()=>{
      if(isStoredSessionExpired(storedSession)){
        logout();
        setToast({msg:"Sesión expirada por seguridad. Ingresa nuevamente.",type:"warn"});
      }
    },5000);
    return ()=>clearInterval(interval);
  },[curUser?.id,storedSession,logout,setToast]);

  // CRUD
  const cSave=async(arr,setArr,item)=>{
    const withEmp=item.empId?item:{...item,empId:curEmp?.id};
    const idx=(arr||[]).findIndex(x=>x.id===withEmp.id);
    const next=idx>=0?(arr||[]).map((x,i)=>i===idx?withEmp:x):[...(arr||[]),{...withEmp,id:withEmp.id||uid(),cr:today()}];
    closeM();ntf("Guardado ✓");await setArr(next);
  };
  const cDel=async(arr,setArr,id,goFn,msg="Eliminado")=>{
    if(!confirm("¿Confirmar eliminación?")) return;
    ntf(msg,"warn");if(goFn)goFn();
    await setArr((arr||[]).filter(x=>x.id!==id));
  };
  const { saveMov, delMov, saveFacturaDoc } = useLabCommercialDocs({
    curEmp,
    facturas,
    movimientos,
    setFacturas,
    setMovimientos,
    closeM,
    ntf,
    cobranzaState,
    addMonths,
    today,
    uid,
    canDo: action => canDo(curUser, action, curEmp),
  });

  useLabBootGuards({
    curEmp,
    curUser,
    setSystemLeidas,
    piezas,
    ldPiezas,
    setPiezas,
    normalizePiezas: normalizeSocialCampaigns,
    crew,
    ldCrew,
    setCrew,
    users,
    syncCrew: syncCrewWithUsers,
  });

  const { saveUsers, saveEmpresas, savePrintLayouts, saveSupportThreads, saveSupportSettings, saveSuperData } = useLabPersistence({
    curEmp,
    crew,
    setCrew,
    setUsersRaw,
    setEmpresasRaw,
    setPrintLayoutsRaw,
    setSupportThreadsRaw,
    setSupportSettingsRaw,
    dbSet,
    normalizeUsersAuth: async nextUsers => {
      const normalizedUsers = await normalizeUsersAuth(nextUsers);
      return LAB_DATA_CONFIG.releaseMode ? normalizedUsers : ensureRequiredSystemUsers(normalizedUsers);
    },
    normalizeEmpresasModel,
    normalizePrintLayouts,
    normalizeSupportThreads,
    buildSupportSettings,
    syncCrewWithUsers,
    empresas,
    users,
    supportSettings,
    ntf,
  });
  const { deleteEmpresa } = useLabTenantAdmin({
    dbGet,
    dbSet,
    empresas,
    users,
    supportThreads,
    supportSettings,
    normalizeEmpresasModel,
    ensureRequiredSystemUsers,
    normalizeSupportThreads,
    setEmpresasRaw,
    setUsersRaw,
    setSupportThreadsRaw,
    curEmp,
    curUser,
    setCurEmp,
    setCurUser,
    setStoredSession,
    ntf,
  });
  const useBal = useLabBalance;
  const domainUsers = LAB_DATA_CONFIG.releaseMode ? (users || []) : (users || SEED_USERS);
  const domainEmpresas = LAB_DATA_CONFIG.releaseMode ? (empresas || []) : (empresas || SEED_EMPRESAS);
  const ef=arr=>(arr||[]).filter(x=>x.empId===empId);
  const socialCampaigns = normalizeSocialCampaigns(piezas);
  const counts={cli:ef(clientes).length,pro:ef(producciones).length,pg:ef(programas).length,pz:ef(socialCampaigns).length,crew:ef(crew).length,aus:ef(auspiciadores).length,crm:ef(crmOpps).length,ct:ef(contratos).length,pres:ef(presupuestos).length,fact:ef(facturas).length,tes:countPendingTreasury(facturas,empId),act:ef(activos).length,tar:tasksEnabled?(Array.isArray(tareas)?tareas:[]).filter(t=>t&&t.empId===empId&&getAssignedIds(t).includes(curUser?.id)&&t.estado!=="Completada").length:0};

  // Breadcrumb
  const buildBc=()=>{
    const L=MODULE_LABELS;
    if(view==="cli-det"){const c=(clientes||[]).find(x=>x.id===detId);return [{l:"CLIENTES",fn:()=>navTo("clientes")},{l:c?.nom||"—"}];}
    if(view==="pro-det"){const p=(producciones||[]).find(x=>x.id===detId);return [{l:"PROYECTOS",fn:()=>navTo("producciones")},{l:p?.nom||"—"}];}
    if(view==="pg-det"){const pg=(programas||[]).find(x=>x.id===detId);return [{l:"PRODUCCIONES",fn:()=>navTo("programas")},{l:pg?.nom||"—"}];}
    if(view==="contenido-det"){const pz=socialCampaigns.find(x=>x.id===detId);return [{l:"CONTENIDOS",fn:()=>navTo("contenidos")},{l:pz?.nom||"—"}];}
    if(view==="ep-det"){const ep=(episodios||[]).find(x=>x.id===detId);const pg=(programas||[]).find(x=>x.id===ep?.pgId);return [{l:"PRODUCCIONES",fn:()=>navTo("programas")},{l:pg?.nom||"—",fn:()=>navTo("pg-det",ep?.pgId)},{l:`Ep.${ep?.num}`}];}
    if(view==="pres-det"){const p=(presupuestos||[]).find(x=>x.id===detId);return [{l:"PRESUPUESTOS",fn:()=>navTo("presupuestos")},{l:p?.titulo||"—"}];}
    if(view==="crm"){return [{l:"CRM"}];}
    return [{l:L[view]||view.toUpperCase()}];
  };

  const VP={empresa:curEmp,user:curUser,listas:L,tareas:tareas||[],clientes:clientes||[],producciones:producciones||[],programas:programas||[],piezas:socialCampaigns,episodios:episodios||[],auspiciadores:auspiciadores||[],crmOpps:crmOpps||[],crmActivities:crmActivities||[],crmStages:crmStages||normalizeCrmStages(CRM_STAGE_SEED),contratos:contratos||[],movimientos:movimientos||[],crew:crew||[],eventos:eventos||[],presupuestos:presupuestos||[],facturas:facturas||[],activos:activos||[],users:domainUsers,empresas:domainEmpresas,saveUsers,navTo,openM,cSave,cDel,saveMov,delMov,saveFacturaDoc,ntf,theme,fmtM,fmtD,canDo:(a)=>canDo(curUser,a,curEmp)};
  const treasuryProps={
    providers:treasuryProviders||[],
    setProviders:setTreasuryProviders,
    payables:treasuryPayables||[],
    setPayables:setTreasuryPayables,
    purchaseOrders:treasuryPurchaseOrders||[],
    setPurchaseOrders:setTreasuryPurchaseOrders,
    issuedOrders:treasuryIssuedOrders||[],
    setIssuedOrders:setTreasuryIssuedOrders,
    receipts:treasuryReceipts||[],
    setReceipts:setTreasuryReceipts,
    disbursements:treasuryDisbursements||[],
    setDisbursements:setTreasuryDisbursements,
  };
  const setters={setClientes,setProducciones,setProgramas,setPiezas,setEpisodios,setAuspiciadores,setCrmOpps,setCrmActivities,setCrmStages,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setActivos,setMovimientos,setTareas};
  const treasuryEnabled = !LAB_DATA_CONFIG.releaseMode || treasuryReleaseEnabled();
  const comentariosBlockComponent = props => <ComentariosBlock {...props} helpers={{ commentAttachmentFromFile, normalizeCommentAttachments, getAssignedIds, uid, today, fmtD, exportComentariosCSV, exportComentariosPDF: (items, nombre, empresa) => exportComentariosPDF(items, nombre, empresa, { companyPrintColor }) }} />;
  const tareasContextoComponent = props => <TareasContexto {...props} TareaCardComponent={TareaCard} helpers={{ uid }} />;
  const movBlockComponent = props => <MovBlockView {...props} fmtM={fmtM} fmtD={fmtD} />;
  const miniCalComponent = props => <MiniCalView {...props} fmtD={fmtD} />;
  const ausCardComponent = props => <AusCardView {...props} ini={ini} fmtM={fmtM} fmtD={fmtD} />;
  const exportMovCsvHelper = (movs, nombre) => exportMovCSV(movs, nombre);
  const exportMovPdfHelper = (movs, nombre, empresa, tipo) => exportMovPDF(movs, nombre, empresa, tipo, { companyPrintColor });
  const exportActiveClientsCsvHelper = items => exportActiveClientsCSV(items, { companyBillingStatus, companyBillingBaseNet, companyBillingNet, companyReferralDiscountMonthsPending, today });
  const exportActiveClientsPdfHelper = items => exportActiveClientsPDF(items, { companyBillingStatus, companyBillingBaseNet, companyBillingNet, companyReferralDiscountMonthsPending, fmtMoney, fmtD, today, buildSimplePdfBlob });

  const renderView=()=>{
    if(superPanel) return <><div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800}}>Panel Super Admin</div><GBtn onClick={()=>setSuperPanel(false)}>← Volver</GBtn></div><SuperAdminPanelView actorUser={curUser} empresas={empresas||[]} users={users||[]} onSave={saveSuperData} onDeleteEmpresa={deleteEmpresa} releaseMode={LAB_DATA_CONFIG.releaseMode} printLayouts={printLayouts||DEFAULT_PRINT_LAYOUTS} savePrintLayouts={savePrintLayouts} supportThreads={activeSupportThreads} supportSettings={activeSupportSettings} helpers={{dbGet,dbSet,uid,today,nowIso,fmtD,fmtMoney,normalizePrintLayouts,DEFAULT_PRINT_LAYOUTS,buildSupportSettings,normalizeSupportThreads,supportAttachmentFromFile,normalizeEmpresasModel,companyBillingDiscountPct,companyReferralDiscountMonthsPending,companyReferralDiscountHistory,companyBillingBaseNet,companyBillingNet,companyBillingStatus,companyPaymentDayLabel,companyIsUpToDate,companyGoogleCalendarEnabled,nextTenantCode,shouldConsumeReferralDiscountMonth,normalizeEmailValue,sha256Hex,sanitizeAssignableRole,ini,addons:ADDONS,exportActiveClientsCSV:exportActiveClientsCsvHelper,exportActiveClientsPDF:exportActiveClientsPdfHelper,userGoogleCalendar,SYSTEM_MESSAGE_PRESETS,XBtn,RichTextBlock}}/></>;
    if(!treasuryEnabled && view===TREASURY_MODULE_ID) return <Card title="Módulo fuera del corte"><Empty text="Tesorería aún no está habilitada en este release" sub="Su entrada se activará con rollout controlado, smoke test financiero y validación de datos."/></Card>;
    if(!canAccessModule(curUser, view, curEmp)) return <Card title="Acceso restringido"><Empty text="Este módulo está disponible solo para perfiles autorizados" sub="Si necesitas verlo, pide acceso al administrador de tu empresa."/></Card>;
    switch(view){
      case"dashboard":    return <ViewDashboard {...VP} alertas={alertas} useBal={useBal} fmtM={fmtM}/>;
      case"tareas":       return <ViewTareas {...VP} setTareas={setTareas} openM={openM} canDo={canDo} TareaCard={TareaCard} COLS_TAREAS={COLS_TAREAS} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds}/>;
      case"clientes":     return <ViewClientes     {...VP} useBal={useBal} ini={ini} fmtM={fmtM}/>;
      case"cli-det":      return <ViewCliDet        {...VP} id={detId} setClientes={setClientes} useBal={useBal} fmtM={fmtM} fmtD={fmtD} countCampaignPieces={countCampaignPieces} ini={ini}/>;
      case"producciones": return <ViewPros          {...VP} setProducciones={setProducciones} useBal={useBal} fmtM={fmtM} fmtD={fmtD}/>;
      case"pro-det":      return <ViewProDet        {...VP} id={detId} setProducciones={setProducciones} setMovimientos={setMovimientos} setTareas={setTareas} useBal={useBal} fmtM={fmtM} fmtD={fmtD} ini={ini} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent} MiniCal={miniCalComponent} TareasContexto={tareasContextoComponent} exportMovCSV={exportMovCsvHelper} exportMovPDF={exportMovPdfHelper} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds}/>;
      case"programas":    return <ViewPgs           {...VP} setProgramas={setProgramas} useBal={useBal} fmtM={fmtM}/>;
      case"pg-det":       return <ViewPgDet         {...VP} id={detId} setProgramas={setProgramas} setEpisodios={setEpisodios} setMovimientos={setMovimientos} setTareas={setTareas} useBal={useBal} fmtM={fmtM} fmtD={fmtD} ini={ini} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent} MiniCal={miniCalComponent} TareasContexto={tareasContextoComponent} exportMovCSV={exportMovCsvHelper} exportMovPDF={exportMovPdfHelper} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} AusCard={ausCardComponent}/>;
      case"contenidos":   return <ViewContenidos    {...VP} setPiezas={setPiezas} useBal={useBal} fmtM={fmtM} countCampaignPieces={countCampaignPieces}/>;
      case"contenido-det":return <ViewContenidoDet  {...VP} id={detId} setPiezas={setPiezas} setMovimientos={setMovimientos} setTareas={setTareas} useBal={useBal} fmtM={fmtM} fmtD={fmtD} countCampaignPieces={countCampaignPieces} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent} MiniCal={miniCalComponent} TareasContexto={tareasContextoComponent} exportMovCSV={exportMovCsvHelper} exportMovPDF={exportMovPdfHelper} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} normalizeSocialPiece={normalizeSocialPiece}/>;
      case"ep-det":       return <ViewEpDet         {...VP} id={detId} setEpisodios={setEpisodios} setMovimientos={setMovimientos} useBal={useBal} fmtM={fmtM} fmtD={fmtD} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent}/>;
      case"crm":          return <CrmModule         {...VP} setClientes={setClientes} setAuspiciadores={setAuspiciadores} setCrmOpps={setCrmOpps} setCrmActivities={setCrmActivities} setCrmStages={setCrmStages} setTareas={setTareas} crmSavingRef={crmSavingRef} TareaCard={TareaCard} getRoleConfig={getRoleConfig} uid={uid} fmtM={fmtM} fmtD={fmtD} canDo={(action)=>canDo(curUser,action,curEmp)}/>;
      case"crew":         return <ViewCrew          {...VP} setCrew={setCrew} ini={ini}/>;
      case"calendario":   return <ViewCalendario    {...VP} setEventos={setEventos} assignedNameList={assignedNameList}/>;
      case"auspiciadores":return <ViewAus           {...VP} setAuspiciadores={setAuspiciadores} AusCard={ausCardComponent}/>;
      case"contratos":    return <ViewCts           {...VP} setContratos={setContratos}/>;
      case"presupuestos": return <ViewPres          {...VP} setPresupuestos={setPresupuestos}/>;
      case"pres-det":     return <ViewPresDet       {...VP} id={detId} setPresupuestos={setPresupuestos} setProducciones={setProducciones} setProgramas={setProgramas} setMovimientos={setMovimientos}/>;
      case"facturacion":  return <ViewFact          {...VP} setFacturas={setFacturas} setMovimientos={setMovimientos}/>;
      case TREASURY_MODULE_ID: return <TreasuryModule {...VP} treasury={treasuryProps} />;
      case"activos":      return <ViewActivos       {...VP} setActivos={setActivos} fmtM={fmtM} fmtD={fmtD}/>;
      default: return <Empty text="Módulo no disponible"/>;
    }
  };
  const {
    currentEmpresa,
    activeSupportSettings,
    activeSupportThreads,
    systemMessages,
    activeBanner,
    unreadSystemCount,
    markSystemRead,
    markAllSystemRead,
  } = useLabSignals({
    empresas,
    curEmp,
    users,
    supportSettings,
    supportThreads,
    buildSupportSettings,
    normalizeSupportThreads,
    SEED_USERS,
    SEED_EMPRESAS,
    systemLeidas,
    setSystemLeidas,
    curUser,
  });

  const operationModalComponents = {
    MCli: props => <MCliView {...props} uid={uid} />,
    MPro: MProView,
    MPg: MPgView,
    MCampanaContenido: props => <MCampanaContenidoView {...props} normalizeSocialCampaign={normalizeSocialCampaign} meses={MESES} today={today} />,
    MPiezaContenido: props => <MPiezaContenidoView {...props} normalizeSocialPiece={normalizeSocialPiece} uid={uid} today={today} />,
    MEp: MEpView,
    MAus: MAusView,
    MCrew: MCrewView,
    MEvento: MEventoView,
    MActivo: MActivoView,
    MTarea: props => <MTareaView {...props} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} />,
  };

  // Screens
  if(!empresas||!users) return <div style={{background:"#080809",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#00d4e8",fontFamily:"monospace"}}><StyleTag css={CSS}/>Iniciando Produ...</div>;
  if(!curUser) return <><StyleTag css={CSS}/><LoginView users={domainUsers} empresas={domainEmpresas} onLogin={login} saveUsers={saveUsers} BrandLockup={BrandLockup} sha256Hex={sha256Hex} dbHelpers={{uid,today,dbGet,dbSet,nextTenantCode,normalizeEmpresasModel,SEED_EMPRESAS}} authGateway={authGateway} authModeLabel={getLabAuthModeLabel(authGateway.strategy)} releaseMode={LAB_DATA_CONFIG.releaseMode}/></>;
  if(curUser.role==="superadmin"&&!curEmp&&!superPanel) return <><StyleTag css={CSS}/><EmpresaSelectorView empresas={domainEmpresas} onSelect={selectEmp} BrandLockup={BrandLockup} ini={ini}/></>;

  const closeMobileSidebar=()=>{
    document.querySelector("aside")?.classList.remove("mob-open");
    const overlay=document.getElementById("mob-overlay");
    if(overlay) overlay.style.display="none";
  };
  const openMobileSidebar=()=>{
    setCollapsed(false);
    const sidebar=document.querySelector("aside");
    const overlay=document.getElementById("mob-overlay");
    if(sidebar) sidebar.classList.add("mob-open");
    if(overlay) overlay.style.display="block";
  };
  const sidebarCollapsed=isMobile?false:collapsed;
  const SW=sidebarCollapsed?64:240;
  const bc=buildBc();

  return <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>
    <StyleTag css={CSS}/>
    {/* Mobile overlay */}
    <div id="mob-overlay" onClick={closeMobileSidebar} style={{display:"none",position:"fixed",inset:0,zIndex:299,background:"rgba(0,0,0,.6)"}}/>
    <Sidebar user={curUser} empresa={curEmp} view={superPanel?"__super__":view} onNav={v=>{setSuperPanel(false);navTo(v);closeMobileSidebar();}} onAdmin={()=>{ if(curUser?.role==="superadmin"){ setSuperPanel(true); setAdminOpen(false); } else { setAdminOpen(true); } closeMobileSidebar(); }} onLogout={logout} onChangeEmp={curUser.role==="superadmin"?()=>{setCurEmp(null);setSuperPanel(false);closeMobileSidebar();}:null} counts={counts} collapsed={sidebarCollapsed} onToggle={()=>{if(isMobile) closeMobileSidebar(); else setCollapsed(v=>!v);}} syncPulse={syncPulse} isMobile={isMobile} ini={ini} includeTreasury={treasuryEnabled}/>
    <main className="app-main" style={{marginLeft:SW,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",transition:"margin-left .2s",background:"var(--bg)",overflowX:"hidden",overflowY:"auto"}}>
      {/* Topbar */}
      <div className="topbar" style={{height:64,background:"transparent",display:"flex",alignItems:"center",padding:"0 26px",gap:10,position:"sticky",top:0,zIndex:100,flexShrink:0}}>
        {/* Hamburger - solo visible en móvil via CSS */}
        <button className="ham-btn" onClick={openMobileSidebar} style={{display:"none",background:"none",border:"none",color:"var(--wh)",cursor:"pointer",fontSize:22,padding:"4px 6px",flexShrink:0,alignItems:"center",lineHeight:1}}>☰</button>
        <div className="app-breadcrumbs" style={{display:"flex",alignItems:"center",gap:8,flex:1,overflow:"hidden"}}>
          {bc.map((b,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:8}}>
            {i>0&&<span style={{color:"var(--bdr2)",fontSize:16}}>/</span>}
            <span onClick={b.fn} style={{fontFamily:"var(--fh)",fontWeight:700,fontSize:i===bc.length-1?15:11,letterSpacing:i===bc.length-1?1:2,textTransform:"uppercase",color:b.fn?"var(--gr2)":"var(--wh)",cursor:b.fn?"pointer":"default",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",}} onMouseEnter={e=>{if(b.fn)e.target.style.color="var(--cy)";}} onMouseLeave={e=>{if(b.fn)e.target.style.color="var(--gr2)";}}>{b.l}</span>
          </span>)}
        </div>
        <div className="app-actions" style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
    {(view==="pro-det"||view==="pg-det"||view==="contenido-det")&&canDo(curUser,"movimientos",curEmp)&&<Btn onClick={()=>openM("mov",{eid:detId,et:view==="pro-det"?"pro":view==="pg-det"?"pg":"pz"})} sm>+ Movimiento</Btn>}
          {view==="ep-det"&&canDo(curUser,"movimientos",curEmp)&&<Btn onClick={()=>openM("mov",{eid:detId,et:"ep",tipo:"gasto"})} sm>+ Gasto</Btn>}
          {curEmp&&<button onClick={()=>{setSystemOpen(!systemOpen);setAlertasOpen(false);}} style={{position:"relative",background:systemOpen?"var(--cg)":"var(--sur)",border:`1px solid ${systemOpen?"var(--cy)":"var(--bdr2)"}`,borderRadius:10,padding:"7px 12px",cursor:"pointer",color:systemOpen?"var(--cy)":"var(--gr3)",fontSize:13,display:"flex",alignItems:"center",gap:8,fontWeight:700}}>
            <span style={{fontSize:16}}>💬</span>
            <span>Mensajes</span>
            {unreadSystemCount>0&&<span style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"var(--cy)",fontSize:9,fontWeight:700,color:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center"}}>{unreadSystemCount}</span>}
          </button>}
          {curEmp&&<button onClick={()=>setAlertasOpen(!alertasOpen)} style={{position:"relative",background:alertasOpen?"var(--cg)":"var(--sur)",border:`1px solid ${alertasOpen?"var(--cy)":"var(--bdr2)"}`,borderRadius:10,padding:"7px 12px",cursor:"pointer",color:alertasOpen?"var(--cy)":"var(--gr3)",fontSize:13,display:"flex",alignItems:"center",gap:8,fontWeight:700}}>
            <span style={{fontSize:16}}>🔔</span>
            <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
              Alertas
              {alertas.filter(a=>a.tipo==="urgente"&&!alertasLeidas.includes(a.id)).length>0&&<span style={{fontSize:10,color:"#ff5566"}}>Urgente</span>}
            </span>
            {alertas.filter(a=>!alertasLeidas.includes(a.id)).length>0&&<span style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ff5566",fontSize:9,fontWeight:700,color:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center"}}>{alertas.filter(a=>!alertasLeidas.includes(a.id)).length}</span>}
          </button>}
        </div>
      </div>
      <div className="app-page" style={{flex:1,padding:"18px 26px 28px"}}>
        {activeBanner&&<div style={{marginBottom:14,padding:"12px 16px",borderRadius:14,border:`1px solid ${activeBanner.tone==="critical"?"#ff556640":activeBanner.tone==="warn"?"#ffcc4440":"var(--cm)"}`,background:activeBanner.tone==="critical"?"#ff556615":activeBanner.tone==="warn"?"#ffcc4415":"var(--cg)",color:activeBanner.tone==="critical"?"#ff5566":activeBanner.tone==="warn"?"#ffcc44":"var(--cy)",fontSize:12,fontWeight:700,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:16}}>{activeBanner.tone==="critical"?"⛔":activeBanner.tone==="warn"?"⚠️":"ℹ️"}</span>
          <span style={{whiteSpace:"pre-line"}}>{activeBanner.text}</span>
        </div>}
        <div className="va" key={view+detId+superPanel}>
          {isLoading ? <LoadingScreen/> : renderView()}
        </div>
      </div>
    </main>
    {alertasOpen&&<AlertasPanelView alertas={alertas} leidas={alertasLeidas} onMarcar={id=>setAlertasLeidas(p=>[...p,id])} onMarcarTodas={()=>setAlertasLeidas(alertas.map(a=>a.id))} onClose={()=>setAlertasOpen(false)} fmtD={fmtD}/> }
    {systemOpen&&<SystemMessagesPanelView empresa={currentEmpresa} mensajes={systemMessages} leidas={systemLeidas} onMarcar={markSystemRead} onMarcarTodas={markAllSystemRead} onClose={()=>setSystemOpen(false)} fmtD={fmtD} RichTextBlock={RichTextBlock}/>}
        {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    {mOpen&&<CoreModalRouter modalComponents={operationModalComponents} helpers={{normalizeSocialPiece,crmNormalizeOpportunity}} mOpen={mOpen} mData={mData} closeM={closeM} VP={VP} setters={setters} ntf={ntf} cSave={cSave} saveMov={saveMov} saveFacturaDoc={saveFacturaDoc} uid={uid} today={today}/>}
    {adminOpen&&<AdminPanelView Modal={Modal} open={adminOpen} onClose={()=>setAdminOpen(false)} theme={theme} onSaveTheme={saveTheme} empresa={curEmp} user={curUser} users={users||[]} empresas={empresas||[]} saveUsers={saveUsers} saveEmpresas={saveEmpresas} listas={L} saveListas={async nl=>{await setListas(nl);ntf("Listas guardadas");}} onPurge={()=>{if(LAB_DATA_CONFIG.releaseMode){ntf("La limpieza masiva está bloqueada en release mode","warn");return;} if(!confirm("¿Eliminar TODOS los datos de esta empresa?")) return; ["clientes","producciones","programas","piezas","episodios","auspiciadores","contratos","movimientos","crew","eventos","presupuestos","facturas",...TREASURY_STORE_KEYS,"activos"].forEach(k=>dbSet(`${empId}:${k}`,[]));ntf("Datos eliminados","warn");setAdminOpen(false);}} ntf={ntf} dbGet={dbGet} companyReferralDiscountHistory={companyReferralDiscountHistory} companyReferralDiscountMonthsPending={companyReferralDiscountMonthsPending} assignableRoleOptions={assignableRoleOptions} sanitizeAssignableRole={sanitizeAssignableRole} uid={uid} sha256Hex={sha256Hex} themePresets={THEME_PRESETS} roleOptions={roleOptions} ini={ini} getRoleConfig={getRoleConfig} userGoogleCalendar={userGoogleCalendar} companyGoogleCalendarEnabled={companyGoogleCalendarEnabled} addons={ADDONS} defaultListas={DEFAULT_LISTAS} Tabs={Tabs} XBtn={XBtn} releaseMode={LAB_DATA_CONFIG.releaseMode}/>}
  </div>;
}

// ── HELPERS COMPARTIDOS ─────────────────────────────────────

// ── FACTURACIÓN ───────────────────────────────────────────────
