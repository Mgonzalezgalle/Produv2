// ============================================================
//  PRODU — Gestión de Productoras
//  src/App.jsx  |  Parte 1 de 4: Core + Auth + Layout
// ============================================================
import { Suspense, lazy, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { normalizeUsersAuth, sha256Hex } from "./lib/auth/authCrypto";
import { buildAppOperationHelpers, useAppOperationModalComponents } from "./components/shared/AppOperationComposition";
import { RichTextBlock, StyleTag } from "./components/shared/AppCore";
import { AppBootScreen, AppLoginScreen, AppSuperAdminSelectorScreen } from "./components/shared/AppEntryScreens";
import { AppOverlays } from "./components/shared/AppOverlays";
import { AppShellFrame } from "./components/shared/AppShellFrame";
import { AppTopbarActions } from "./components/shared/AppTopbarActions";
import { AppViewRenderer } from "./components/shared/AppViewRenderer";
import { APP_SHELL_CSS } from "./components/shared/appShellCss";
import { BrandLockup, LoadingScreen } from "./components/shared/ShellLayout";
import { useLabCommercialDocs } from "./hooks/useLabCommercialDocs";
import { useLabTenantFoundationSync } from "./hooks/useLabTenantFoundationSync";
import { useLabTenantUserShadowSync } from "./hooks/useLabTenantUserShadowSync";
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
  cobranzaState,
  commentAttachmentFromFile,
  companyBillingBaseNet,
  companyBillingDiscountPct,
  companyBillingNet,
  companyBillingStatus,
  companyGoogleCalendarEnabled,
  companyIsUpToDate,
  companyPaymentDayLabel,
  companyPrintColor,
  companyReferralDiscountHistory,
  companyReferralDiscountMonthsPending,
  countCampaignPieces,
  ensureRequiredSystemUsers,
  nextTenantCode,
  normalizeEmailValue,
  normalizeCommentAttachments,
  normalizeEmpresasModel,
  normalizeEmpresasTenantCodes,
  normalizePrintLayouts,
  normalizeSocialCampaign,
  normalizeSocialCampaigns,
  normalizeSocialPiece,
  shouldConsumeReferralDiscountMonth,
  syncCrewWithUsers,
  userGoogleCalendar,
  daysUntil,
} from "./lib/utils/helpers";
import {
  CRM_STAGE_SEED,
  crmNormalizeActivities,
  crmNormalizeOpportunity,
  normalizeCrmStages,
  recoverPreferredCrmStages,
} from "./lib/utils/crm";
import {
  countPendingTreasury,
  TREASURY_MODULE_ICON,
  TREASURY_MODULE_ID,
  TREASURY_MODULE_LABEL,
  TREASURY_STORE_KEYS,
  treasuryReleaseEnabled,
} from "./lib/utils/treasury";
import {
  ADDON_REGISTRY,
  MODULE_LABELS,
} from "./lib/modules/moduleRegistry";
import { SYSTEM_MESSAGE_PRESETS, THEME_PRESETS } from "./lib/config/appConfig";
import { LAB_DATA_CONFIG, localLabKey } from "./lib/lab/labStorageConfig";
import { dbGet, dbSet, dbCloneFromProd } from "./lib/lab/labDb";
import { buildSeedData, SEED_EMPRESAS as BASE_SEED_EMPRESAS, SEED_USERS } from "./lib/lab/seeds";
import { isStoredSessionExpired } from "./lib/auth/sessionStorage";
import { getLabAuthModeLabel, LAB_AUTH_CONFIG } from "./lib/auth/authConfig";
import { useLabBootGuards } from "./hooks/useLabBootGuards";
import { useLabBalance } from "./hooks/useLabBalance";
import { useLabBillingPlatform } from "./hooks/useLabBillingPlatform";
import { useLabCrmGuards } from "./hooks/useLabCrmGuards";
import { useGlobalLabData, useTenantLabData } from "./hooks/useLabDataStore";
import { useLabGlobalInit } from "./hooks/useLabGlobalInit";
import { useLabAlerts } from "./hooks/useLabAlerts";
import { useLabPersistence } from "./hooks/useLabPersistence";
import { useLabPlatformFoundation } from "./hooks/useLabPlatformFoundation";
import { useLabShell } from "./hooks/useLabShell";
import { useLabSignals } from "./hooks/useLabSignals";
import { useLabTenantAdmin } from "./hooks/useLabTenantAdmin";
import { useLabFreshdeskWidget } from "./hooks/useLabFreshdeskWidget";
import { useLabTheme } from "./hooks/useLabTheme";
import { assignedNameList, COLS_TAREAS, getAssignedIds, normalizeTaskAssignees } from "./lib/utils/tasks";

// ── SUPABASE ─────────────────────────────────────────────────
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
const sameIdArray = (a = [], b = []) => (
  Array.isArray(a)
  && Array.isArray(b)
  && a.length === b.length
  && a.every((value, index) => value === b[index])
);
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
const CoreModalRouter = lazy(() => import("./components/CoreModalRouter").then(module => ({ default: module.CoreModalRouter })));
const LoginView = lazy(() => import("./components/auth/AuthViews").then(module => ({ default: module.Login })));
const EmpresaSelectorView = lazy(() => import("./components/auth/AuthViews").then(module => ({ default: module.EmpresaSelector })));
const AdminPanelView = lazy(() => import("./components/admin/AdminViews").then(module => ({ default: module.AdminPanel })));
const SuperAdminPanelView = lazy(() => import("./components/admin/AdminViews").then(module => ({ default: module.SuperAdminPanel })));
const ToastView = lazy(() => import("./components/shared/CoreFeedback").then(module => ({ default: module.Toast })));
const AlertasPanelView = lazy(() => import("./components/shared/SystemPanels").then(module => ({ default: module.AlertasPanel })));
const SystemMessagesPanelView = lazy(() => import("./components/shared/SystemPanels").then(module => ({ default: module.SystemMessagesPanel })));
const ViewDashboard = lazy(() => import("./components/dashboard/DashboardView").then(module => ({ default: module.ViewDashboard })));
const ViewCalendario = lazy(() => import("./components/calendar/CalendarView").then(module => ({ default: module.ViewCalendario })));
const ViewCliDet = lazy(() => import("./components/clients/ClientViews").then(module => ({ default: module.ViewCliDet })));
const ViewClientes = lazy(() => import("./components/clients/ClientViews").then(module => ({ default: module.ViewClientes })));
const ViewCts = lazy(() => import("./components/commercial/BudgetViews").then(module => ({ default: module.ViewCts })));
const ViewPres = lazy(() => import("./components/commercial/BudgetViews").then(module => ({ default: module.ViewPres })));
const ViewPresDet = lazy(() => import("./components/commercial/BudgetViews").then(module => ({ default: module.ViewPresDet })));
const CrmModule = lazy(() => import("./components/crm/CrmModule").then(module => ({ default: module.CrmModule })));
const ViewFact = lazy(() => import("./components/commercial/InvoiceViews").then(module => ({ default: module.ViewFact })));
const TreasuryModule = lazy(() => import("./components/treasury/TreasuryModule").then(module => ({ default: module.TreasuryModule })));
const ViewActivos = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewActivos })));
const ViewAus = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewAus })));
const ViewContenidos = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewContenidos })));
const ViewContenidoDet = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewContenidoDet })));
const ViewCrew = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewCrew })));
const ViewEpDet = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewEpDet })));
const ViewPgs = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewPgs })));
const ViewPgDet = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewPgDet })));
const ViewPros = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewPros })));
const ViewProDet = lazy(() => import("./components/operations/ProductionViews").then(module => ({ default: module.ViewProDet })));
const ViewTareas = lazy(() => import("./components/operations/TaskViews").then(module => ({ default: module.ViewTareas })));

// ── UI PRIMITIVES ────────────────────────────────────────────
const { Modal, Btn, GBtn, XBtn, Tabs } = LabUI;

// ── LOGIN ────────────────────────────────────────────────────

// ── SOLICITUD MODAL ───────────────────────────────────────────
// ── EXPORT FUNCTIONS ─────────────────────────────────────────
// ── ALERTAS — Bandeja operativa ───────────────────────────────
// ── SUPER ADMIN PANEL ─────────────────────────────────────────

// ── ADMIN PANEL ───────────────────────────────────────────────

// ── EMPRESA EDIT — editar datos de empresa desde Admin ───────
// ── APP ROOT ─────────────────────────────────────────────────
export default function App(){
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
  const [mobileSidebarOpen,setMobileSidebarOpen]=useState(false);
  const [syncPulse,setSyncPulse]=useState(false);
  const [superPanel,setSuperPanel]=useState(false);
  const [alertasOpen,setAlertasOpen]=useState(false);
  const [alertasLeidas,setAlertasLeidas]=useState([]);
  const [alertasOcultas,setAlertasOcultas]=useState([]);
  const [systemOpen,setSystemOpen]=useState(false);
  const [systemLeidas,setSystemLeidas]=useState([]);
  const alertasReadKey = useMemo(() => curUser ? localLabKey(`alertas-leidas:${curUser.id}:${curEmp?.id || "global"}`) : "", [curUser, curEmp?.id]);
  const alertasHiddenKey = useMemo(() => curUser ? localLabKey(`alertas-ocultas:${curUser.id}:${curEmp?.id || "global"}`) : "", [curUser, curEmp?.id]);
  const systemReadKey = useMemo(() => curUser ? localLabKey(`system-leidas:${curUser.id}:${curEmp?.id || "global"}`) : "", [curUser, curEmp?.id]);

  // Global data
  const {
    empresas,setEmpresasRaw,
    users,setUsersRaw,
    printLayouts,setPrintLayoutsRaw,
    setThemeDB,
  } = useGlobalLabData();
  const {
    authGateway,
    platformApiMode,
    sessionKey,
    authService,
    platformServices,
    platformGateway,
    platformApi,
  } = useLabPlatformFoundation({
    users,
    empresas,
    dbGet,
    dbSet,
    sha256Hex,
    nextTenantCode,
    today,
    storedSession,
    setCurUser,
    setCurEmp,
    setStoredSession,
  });
  const foundationTenantReady = useLabTenantFoundationSync({
    curEmp,
    platformApiMode,
    platformApi,
  });
  useLabTenantUserShadowSync({
    curEmp,
    users,
    platformApiMode,
    platformServices,
    foundationTenantReady,
  });

  // Per-empresa data
  const eId=curEmp?.id||"__none__";
  const {
    listas,setListas,ldLst,
    tareas,setTareas,ldTar,
    clientes,setClientes,ldCli,
    producciones,setProducciones,ldPro,
    programas,setProgramas,ldPg,
    piezas,setPiezas,ldPiezas,
    episodios,setEpisodios,ldEp,
    auspiciadores,setAuspiciadores,ldAus,
    crmOpps,setCrmOpps,ldCrmOpps,
    crmActivities,setCrmActivities,ldCrmActivities,
    crmStages,setCrmStages,ldCrmStages,
    contratos,setContratos,ldCt,
    movimientos,setMovimientos,ldMov,
    crew,setCrew,ldCrew,
    eventos,setEventos,ldEv,
    presupuestos,setPresupuestos,ldPres,
    facturas,setFacturas,ldFact,
    treasuryProviders,setTreasuryProviders,ldTreasuryProviders,
    treasuryPayables,setTreasuryPayables,ldTreasuryPayables,
    treasuryPurchaseOrders,setTreasuryPurchaseOrders,ldTreasuryPurchaseOrders,
    treasuryIssuedOrders,setTreasuryIssuedOrders,ldTreasuryIssuedOrders,
    treasuryReceipts,setTreasuryReceipts,ldTreasuryReceipts,
    treasuryDisbursements,setTreasuryDisbursements,ldTreasuryDisbursements,
    activos,setActivos,ldAct,
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
    storedSession,
    empresas,
    setEmpresasRaw,
    setThemeDB,
    dbSet,
  });

  const globalInitReady = useLabGlobalInit({
    dbGet,
    dbSet,
    dbCloneFromProd,
    setEmpresasRaw,
    setUsersRaw,
    setPrintLayoutsRaw,
    normalizeEmpresasTenantCodes,
    ensureRequiredSystemUsers,
    normalizePrintLayouts,
    applyTheme,
    THEME_PRESETS,
    setStoredSession,
    SEED_EMPRESAS,
    SEED_USERS,
    DEFAULT_PRINT_LAYOUTS,
    empresas,
    users,
  });

  const normalizedUsersSignatureRef = useRef("");
  const crmAddonMigrationAttemptedRef = useRef(false);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(users) || !users.length) return;
    const sourceSignature = JSON.stringify(users);
    if (normalizedUsersSignatureRef.current === sourceSignature) return;
    let cancelled = false;
    normalizeUsersAuth(users).then(next=>{
      if (cancelled) return;
      const merged = ensureRequiredSystemUsers(next);
      const mergedSignature = JSON.stringify(merged);
      normalizedUsersSignatureRef.current = mergedSignature;
      const changed = mergedSignature !== sourceSignature;
      if(changed){
        setUsersRaw(merged);
        dbSet("produ:users",merged);
      }
    });
    return () => {
      cancelled = true;
    };
  },[users, setUsersRaw]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(empresas) || !empresas.length) return;
    const normalized = normalizeEmpresasModel(empresas);
    if(JSON.stringify(normalized)!==JSON.stringify(empresas)){
      setEmpresasRaw(normalized);
      dbSet("produ:empresas",normalized);
    }
  },[empresas, setEmpresasRaw]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!Array.isArray(empresas) || !empresas.length) return;
    if (crmAddonMigrationAttemptedRef.current) return;
    crmAddonMigrationAttemptedRef.current = true;
    try{
      const flag = localStorage.getItem("produ_crm_default_on_v1");
      if(flag) return;
      const next = normalizeEmpresasModel((empresas||[]).map(emp=>{
        const addons = Array.isArray(emp?.addons) ? emp.addons : [];
        return addons.includes("crm") ? emp : { ...emp, addons:[...addons,"crm"], migratedCrmAddon:true };
      }));
      if(JSON.stringify(next)===JSON.stringify(empresas)){
        localStorage.setItem("produ_crm_default_on_v1","1");
        return;
      }
      setEmpresasRaw(next);
      dbSet("produ:empresas",next);
      localStorage.setItem("produ_crm_default_on_v1","1");
    }catch{
      // Avoid retry loops within the same session if storage is unavailable.
    }
  },[empresas, setEmpresasRaw]);

  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!printLayouts) return;
    const normalized = normalizePrintLayouts(printLayouts);
    if(JSON.stringify(normalized)!==JSON.stringify(printLayouts)){
      setPrintLayoutsRaw(normalized);
      dbSet("produ:printLayouts",normalized);
    }
  },[printLayouts, setPrintLayoutsRaw]);

  // Seed per-empresa data
  useEffect(()=>{
    if (LAB_DATA_CONFIG.releaseMode) return;
    if(!curEmp) return;
    let cancelled = false;
    const id=curEmp.id;
    const keys=["clientes","producciones","programas","piezas","episodios","auspiciadores","crmOpps","crmActivities","crmStages","contratos","movimientos","crew","eventos","presupuestos","facturas",...TREASURY_STORE_KEYS,"activos","listas","tareas"];
    const setters={
      listas: setListas,
      tareas: setTareas,
      clientes: setClientes,
      producciones: setProducciones,
      programas: setProgramas,
      piezas: setPiezas,
      episodios: setEpisodios,
      auspiciadores: setAuspiciadores,
      crmOpps: setCrmOpps,
      crmActivities: setCrmActivities,
      crmStages: setCrmStages,
      contratos: setContratos,
      movimientos: setMovimientos,
      crew: setCrew,
      eventos: setEventos,
      presupuestos: setPresupuestos,
      facturas: setFacturas,
      treasuryProviders: setTreasuryProviders,
      treasuryPayables: setTreasuryPayables,
      treasuryPurchaseOrders: setTreasuryPurchaseOrders,
      treasuryIssuedOrders: setTreasuryIssuedOrders,
      treasuryReceipts: setTreasuryReceipts,
      treasuryDisbursements: setTreasuryDisbursements,
      activos: setActivos,
    };
    (async () => {
      const seedData = SEED_DATA(id);
      for (const k of keys) {
        const v = await dbGet(`${id}:${k}`);
        const shouldRehydrateEmptySeed = Array.isArray(v)
          && v.length === 0
          && ["crmOpps","crmActivities","presupuestos","facturas"].includes(k)
          && Array.isArray(seedData[k])
          && seedData[k].length > 0;
        if (cancelled) return;
        if (v === null || shouldRehydrateEmptySeed) {
          const seed = seedData[k] || [];
          const cloned = await dbCloneFromProd(`produ:${id}:${k}`, seed);
          const next = cloned === null ? seed : cloned;
          if (cancelled) return;
          await dbSet(`${id}:${k}`, next);
          setters[k]?.(next);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  },[curEmp, setListas, setTareas, setClientes, setProducciones, setProgramas, setPiezas, setEpisodios, setAuspiciadores, setCrmOpps, setCrmActivities, setCrmStages, setContratos, setMovimientos, setCrew, setEventos, setPresupuestos, setFacturas, setTreasuryProviders, setTreasuryPayables, setTreasuryPurchaseOrders, setTreasuryIssuedOrders, setTreasuryReceipts, setTreasuryDisbursements, setActivos]);

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
      if(!mobile) setMobileSidebarOpen(false);
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
    authService,
    sessionKey,
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
    const events = ["mousemove","keydown","scroll","touchstart"];
    events.forEach(evt=>window.addEventListener(evt,onActivity,{passive:true}));
    return ()=>events.forEach(evt=>window.removeEventListener(evt,onActivity));
  },[curUser, storedSession, refreshSessionActivity]);

  useEffect(()=>{
    if(!curUser || !storedSession) return;
    const interval = setInterval(()=>{
      if(isStoredSessionExpired(storedSession)){
        logout();
        setToast({msg:"Sesión expirada por seguridad. Ingresa nuevamente.",type:"warn"});
      }
    },5000);
    return ()=>clearInterval(interval);
  },[curUser, storedSession, logout]);

  useLabFreshdeskWidget({ user: curUser, empresa: curEmp });

  useEffect(()=>{
    if(curEmp) return;
    setAdminOpen(false);
  },[curEmp,setAdminOpen]);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  const openMobileSidebar = useCallback(() => {
    setCollapsed(false);
    setMobileSidebarOpen(true);
  }, []);

  // CRUD
  const cSave=useCallback(async(arr,setArr,item)=>{
    const withEmp=item.empId?item:{...item,empId:curEmp?.id};
    const idx=(arr||[]).findIndex(x=>x.id===withEmp.id);
    const next=idx>=0?(arr||[]).map((x,i)=>i===idx?withEmp:x):[...(arr||[]),{...withEmp,id:withEmp.id||uid(),cr:today()}];
    closeM();ntf("Guardado ✓");await setArr(next);
  }, [closeM, curEmp?.id, ntf]);
  const cDel=useCallback(async(arr,setArr,id,goFn,msg="Eliminado")=>{
    if(!confirm("¿Confirmar eliminación?")) return;
    ntf(msg,"warn");if(goFn)goFn();
    await setArr((arr||[]).filter(x=>x.id!==id));
  }, [ntf]);
  const { saveMov, delMov, saveFacturaDoc } = useLabCommercialDocs({
    curEmp,
    facturas,
    movimientos,
    setFacturas,
    setMovimientos,
    treasuryPurchaseOrders,
    setTreasuryPurchaseOrders,
    closeM,
    ntf,
    cobranzaState,
    addMonths,
    today,
    uid,
    canDo: action => canDo(curUser, action, curEmp),
  });
  const { emitFacturaToBsale, syncFacturaWithBsale, inspectFacturaBsaleSync } = useLabBillingPlatform({
    curEmp,
    facturas,
    clientes,
    auspiciadores,
    platformGateway,
    platformApi,
    platformServices,
    setFacturas,
    ntf,
    dbGet,
    dbSet,
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

  const { saveUsers, saveEmpresas, savePrintLayouts, saveSuperData } = useLabPersistence({
    curEmp,
    crew,
    setCrew,
    setUsersRaw,
    setEmpresasRaw,
    setPrintLayoutsRaw,
    dbSet,
    normalizeUsersAuth: async nextUsers => {
      const normalizedUsers = await normalizeUsersAuth(nextUsers);
      return LAB_DATA_CONFIG.releaseMode ? normalizedUsers : ensureRequiredSystemUsers(normalizedUsers);
    },
    normalizeEmpresasModel,
    normalizePrintLayouts,
    syncCrewWithUsers,
    ntf,
  });

  useEffect(() => {
    if (typeof window === "undefined" || !curUser?.id || !saveUsers || !Array.isArray(users)) return;
    const url = new URL(window.location.href);
    const status = url.searchParams.get("google_calendar_status");
    if (!status) return;

    const cleanUrl = () => {
      url.searchParams.delete("google_calendar_status");
      url.searchParams.delete("google_calendar_message");
      url.searchParams.delete("google_calendar_connection");
      window.history.replaceState({}, document.title, url.toString());
    };

    if (status === "connected") {
      const rawConnection = url.searchParams.get("google_calendar_connection") || "";
      try {
        const connection = JSON.parse(rawConnection);
        const targetUserId = String(connection?.userId || curUser.id).trim() || curUser.id;
        const nextGoogleCalendar = {
          connected: true,
          email: String(connection?.userEmail || curUser?.email || "").trim(),
          calendarId: String(connection?.calendarId || "primary").trim(),
          calendarName: String(connection?.calendarName || "Calendario principal").trim(),
          autoSync: false,
          lastSyncAt: String(connection?.connectedAt || new Date().toISOString()).trim(),
          tokenType: String(connection?.tokenType || "Bearer").trim(),
          scope: String(connection?.scope || "").trim(),
          accessToken: String(connection?.accessToken || "").trim(),
          refreshToken: String(connection?.refreshToken || "").trim(),
          expiresIn: Number(connection?.expiresIn || 0),
        };
        const nextUsers = users.map(item => item.id === targetUserId ? {
          ...item,
          googleCalendar: nextGoogleCalendar,
        } : item);
        cleanUrl();
        if (targetUserId === curUser.id) {
          setCurUser(prev => prev ? { ...prev, googleCalendar: nextGoogleCalendar } : prev);
        }
        navTo("calendario");
        ntf("Google Calendar conectado ✓");
        Promise.resolve(saveUsers(nextUsers)).catch(() => {
          ntf("Conectamos Google Calendar, pero no pudimos persistir la conexión localmente.", "warn");
        });
        return;
      } catch {
        ntf("No pudimos leer la conexión devuelta por Google Calendar.", "warn");
        cleanUrl();
        return;
      }
    }

    ntf(url.searchParams.get("google_calendar_message") || "No pudimos conectar Google Calendar.", "warn");
    navTo("calendario");
    cleanUrl();
  }, [curUser, users, saveUsers, navTo, ntf]);
  const { deleteEmpresa } = useLabTenantAdmin({
    dbGet,
    dbSet,
    empresas,
    users,
    normalizeEmpresasModel,
    ensureRequiredSystemUsers,
    setEmpresasRaw,
    setUsersRaw,
    curEmp,
    curUser,
    setCurEmp,
    setCurUser,
    setStoredSession,
    ntf,
  });
  const useBal = useLabBalance;
  const domainUsers = useMemo(() => LAB_DATA_CONFIG.releaseMode ? (users || []) : (users || SEED_USERS), [users]);
  const domainEmpresas = useMemo(() => LAB_DATA_CONFIG.releaseMode ? (empresas || []) : (empresas || SEED_EMPRESAS), [empresas]);
  const ef = useCallback(arr => (arr || []).filter(x => x.empId === empId), [empId]);
  const socialCampaigns = normalizeSocialCampaigns(piezas);
  const counts = useMemo(() => ({
    cli: ef(clientes).length,
    pro: ef(producciones).length,
    pg: ef(programas).length,
    pz: ef(socialCampaigns).length,
    crew: ef(crew).length,
    aus: ef(auspiciadores).length,
    crm: ef(crmOpps).length,
    ct: ef(contratos).length,
    pres: ef(presupuestos).length,
    fact: ef(facturas).length,
    tes: countPendingTreasury(facturas, empId),
    act: ef(activos).length,
    tar: tasksEnabled ? (Array.isArray(tareas) ? tareas : []).filter(t => t && t.empId === empId && getAssignedIds(t).includes(curUser?.id) && !["Completada", "Finalizada"].includes(t.estado)).length : 0,
  }), [clientes, producciones, programas, socialCampaigns, crew, auspiciadores, crmOpps, contratos, presupuestos, facturas, activos, tareas, tasksEnabled, empId, curUser?.id, ef]);

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

  const VP = useMemo(() => ({
    empresa:curEmp,
    user:curUser,
    listas:L,
    tareas:tareas||[],
    clientes:clientes||[],
    producciones:producciones||[],
    programas:programas||[],
    piezas:socialCampaigns,
    episodios:episodios||[],
    auspiciadores:auspiciadores||[],
    crmOpps:crmOpps||[],
    crmActivities:crmActivities||[],
    crmStages:crmStages||normalizeCrmStages(CRM_STAGE_SEED),
    contratos:contratos||[],
    movimientos:movimientos||[],
    crew:crew||[],
    eventos:eventos||[],
    presupuestos:presupuestos||[],
    facturas:facturas||[],
    activos:activos||[],
    purchaseOrders:treasuryPurchaseOrders||[],
    users:domainUsers,
    empresas:domainEmpresas,
    saveUsers,
    navTo,
    openM,
    cSave,
    cDel,
    saveMov,
    delMov,
    saveFacturaDoc,
    ntf,
    theme,
    fmtM,
    fmtD,
    platformApi,
    canDo:(a)=>canDo(curUser,a,curEmp),
  }), [curEmp, curUser, L, tareas, clientes, producciones, programas, socialCampaigns, episodios, auspiciadores, crmOpps, crmActivities, crmStages, contratos, movimientos, crew, eventos, presupuestos, facturas, activos, treasuryPurchaseOrders, domainUsers, domainEmpresas, saveUsers, navTo, openM, cSave, cDel, saveMov, delMov, saveFacturaDoc, ntf, theme, platformApi]);
  const treasuryProps = useMemo(() => ({
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
  }), [treasuryProviders, treasuryPayables, treasuryPurchaseOrders, treasuryIssuedOrders, treasuryReceipts, treasuryDisbursements, setTreasuryProviders, setTreasuryPayables, setTreasuryPurchaseOrders, setTreasuryIssuedOrders, setTreasuryReceipts, setTreasuryDisbursements]);
  const setters = useMemo(() => ({setClientes,setProducciones,setProgramas,setPiezas,setEpisodios,setAuspiciadores,setCrmOpps,setCrmActivities,setCrmStages,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setActivos,setMovimientos,setTareas}), [setClientes, setProducciones, setProgramas, setPiezas, setEpisodios, setAuspiciadores, setCrmOpps, setCrmActivities, setCrmStages, setContratos, setCrew, setEventos, setPresupuestos, setFacturas, setActivos, setMovimientos, setTareas]);
  const modalStateSetters = setters;
  const treasuryEnabled = !LAB_DATA_CONFIG.releaseMode || treasuryReleaseEnabled();
  const {
    comentariosBlockComponent,
    tareasContextoComponent,
    movBlockComponent,
    miniCalComponent,
    ausCardComponent,
    exportMovCsvHelper,
    exportMovPdfHelper,
    exportActiveClientsCsvHelper,
    exportActiveClientsPdfHelper,
    TareaCard,
  } = useMemo(() => buildAppOperationHelpers({
    commentAttachmentFromFile,
    normalizeCommentAttachments,
    getAssignedIds,
    uid,
    today,
    fmtD,
    fmtM,
    ini,
    companyPrintColor,
    companyBillingStatus,
    companyBillingBaseNet,
    companyBillingNet,
    companyReferralDiscountMonthsPending,
    fmtMoney,
  }), []);

  const {
    currentEmpresa,
    systemMessages,
    activeBanner,
    unreadSystemCount,
    markSystemRead,
    markAllSystemRead,
  } = useLabSignals({
    empresas,
    curEmp,
    SEED_EMPRESAS,
    systemLeidas,
    setSystemLeidas,
    curUser,
  });

  useEffect(() => {
    if (!alertasReadKey) {
      setAlertasLeidas([]);
      return;
    }
    try {
      const raw = localStorage.getItem(alertasReadKey) || sessionStorage.getItem(alertasReadKey) || "[]";
      const parsed = JSON.parse(raw);
      setAlertasLeidas(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAlertasLeidas([]);
    }
  }, [alertasReadKey]);

  useEffect(() => {
    if (!systemReadKey) {
      setSystemLeidas([]);
      return;
    }
    try {
      const raw = localStorage.getItem(systemReadKey) || sessionStorage.getItem(systemReadKey) || "[]";
      const parsed = JSON.parse(raw);
      setSystemLeidas(Array.isArray(parsed) ? parsed : []);
    } catch {
      setSystemLeidas([]);
    }
  }, [systemReadKey]);

  useEffect(() => {
    if (!alertasHiddenKey) {
      setAlertasOcultas([]);
      return;
    }
    try {
      const raw = localStorage.getItem(alertasHiddenKey) || sessionStorage.getItem(alertasHiddenKey) || "[]";
      const parsed = JSON.parse(raw);
      setAlertasOcultas(Array.isArray(parsed) ? parsed : []);
    } catch {
      setAlertasOcultas([]);
    }
  }, [alertasHiddenKey]);

  useEffect(() => {
    setAlertasLeidas(prev => {
      const next = prev.filter(id => (alertas || []).some(alerta => alerta.id === id));
      return sameIdArray(prev, next) ? prev : next;
    });
  }, [alertas]);

  useEffect(() => {
    setAlertasOcultas(prev => {
      const next = prev.filter(id => (alertas || []).some(alerta => alerta.id === id));
      return sameIdArray(prev, next) ? prev : next;
    });
  }, [alertas]);

  useEffect(() => {
    setSystemLeidas(prev => {
      const next = prev.filter(id => (systemMessages || []).some(message => message.id === id));
      return sameIdArray(prev, next) ? prev : next;
    });
  }, [systemMessages]);

  useEffect(() => {
    if (!alertasReadKey) return;
    const payload = JSON.stringify(Array.isArray(alertasLeidas) ? alertasLeidas : []);
    try { localStorage.setItem(alertasReadKey, payload); } catch { /* ignore storage write failures */ }
    try { sessionStorage.setItem(alertasReadKey, payload); } catch { /* ignore storage write failures */ }
  }, [alertasReadKey, alertasLeidas]);

  useEffect(() => {
    if (!systemReadKey) return;
    const payload = JSON.stringify(Array.isArray(systemLeidas) ? systemLeidas : []);
    try { localStorage.setItem(systemReadKey, payload); } catch { /* ignore storage write failures */ }
    try { sessionStorage.setItem(systemReadKey, payload); } catch { /* ignore storage write failures */ }
  }, [systemReadKey, systemLeidas]);

  useEffect(() => {
    if (!alertasHiddenKey) return;
    const payload = JSON.stringify(Array.isArray(alertasOcultas) ? alertasOcultas : []);
    try { localStorage.setItem(alertasHiddenKey, payload); } catch { /* ignore storage write failures */ }
    try { sessionStorage.setItem(alertasHiddenKey, payload); } catch { /* ignore storage write failures */ }
  }, [alertasHiddenKey, alertasOcultas]);

  const operationModalComponents = useAppOperationModalComponents({
    uid,
    today,
    normalizeSocialCampaign,
    normalizeSocialPiece,
    normalizeTaskAssignees,
    getAssignedIds,
    MESES,
  });
  const loginDbHelpers = useMemo(() => ({
    uid,
    today,
    dbGet,
    dbSet,
    nextTenantCode,
    normalizeEmpresasModel,
    SEED_EMPRESAS,
    sha256Hex,
    authGateway,
    sessionKey,
    users: domainUsers,
    empresas: domainEmpresas,
    platformApi,
    platformGateway,
  }), [authGateway, sessionKey, domainUsers, domainEmpresas, platformApi, platformGateway]);
  const superAdminHelpers = useMemo(() => ({
    dbGet, dbSet, uid, today, nowIso, fmtD, fmtMoney, normalizePrintLayouts, DEFAULT_PRINT_LAYOUTS, normalizeEmpresasModel,
    companyBillingDiscountPct, companyReferralDiscountMonthsPending, companyReferralDiscountHistory, companyBillingBaseNet, companyBillingNet,
    companyBillingStatus, companyPaymentDayLabel, companyIsUpToDate, companyGoogleCalendarEnabled, nextTenantCode,
    shouldConsumeReferralDiscountMonth, normalizeEmailValue, sha256Hex, sanitizeAssignableRole, ini, addons: ADDONS,
    exportActiveClientsCSV: exportActiveClientsCsvHelper, exportActiveClientsPDF: exportActiveClientsPdfHelper,
    userGoogleCalendar, SYSTEM_MESSAGE_PRESETS, XBtn, RichTextBlock,
  }), [exportActiveClientsCsvHelper, exportActiveClientsPdfHelper]);
  const superAdminContext = useMemo(() => ({
    actorUser: curUser,
    empresas: empresas || [],
    users: users || [],
    platformServices,
    onSave: saveSuperData,
    onDeleteEmpresa: deleteEmpresa,
    releaseMode: LAB_DATA_CONFIG.releaseMode,
    printLayouts: printLayouts || DEFAULT_PRINT_LAYOUTS,
    savePrintLayouts,
    helpers: superAdminHelpers,
  }), [curUser, empresas, users, platformServices, saveSuperData, deleteEmpresa, printLayouts, savePrintLayouts, superAdminHelpers]);
  const rendererHelpers = useMemo(() => ({
    comentariosBlockComponent,
    movBlockComponent,
    miniCalComponent,
    tareasContextoComponent,
    ausCardComponent,
    exportMovCsvHelper,
    exportMovPdfHelper,
    exportActiveClientsCsvHelper,
    exportActiveClientsPdfHelper,
    TareaCard,
    COLS_TAREAS,
    getRoleConfig,
  }), [comentariosBlockComponent, movBlockComponent, miniCalComponent, tareasContextoComponent, ausCardComponent, exportMovCsvHelper, exportMovPdfHelper, exportActiveClientsCsvHelper, exportActiveClientsPdfHelper, TareaCard]);

  const sidebarCollapsed=isMobile?false:collapsed;
  const SW=sidebarCollapsed?64:240;
  const bc=buildBc();
  const moduleLoadingOverlay = (
    <div
      style={{
        position: "fixed",
        left: 0,
        top: 64,
        right: 0,
        bottom: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        zIndex: 90,
      }}
    >
      <div style={{width:"min(520px, calc(100vw - 48px))"}}>
        <LoadingScreen minHeight="auto" fullWidth={false} />
      </div>
    </div>
  );
  const adminPanelProps = useMemo(() => ({
    Modal,
    open: adminOpen,
    onClose: () => setAdminOpen(false),
    theme,
    onSaveTheme: saveTheme,
    empresa: curEmp,
    user: curUser,
    users: users || [],
    empresas: empresas || [],
    saveUsers,
    saveEmpresas,
    platformServices,
    listas: L,
    saveListas: async nl => { await setListas(nl); ntf("Listas guardadas"); },
    onPurge: () => {
      if (LAB_DATA_CONFIG.releaseMode) {
        ntf("La limpieza masiva está bloqueada en release mode", "warn");
        return;
      }
      if (!confirm("¿Eliminar TODOS los datos de esta empresa?")) return;
      ["clientes","producciones","programas","piezas","episodios","auspiciadores","contratos","movimientos","crew","eventos","presupuestos","facturas",...TREASURY_STORE_KEYS,"activos"].forEach(k => dbSet(`${empId}:${k}`, []));
      ntf("Datos eliminados", "warn");
      setAdminOpen(false);
    },
    ntf,
    dbGet,
    companyReferralDiscountHistory,
    companyReferralDiscountMonthsPending,
    assignableRoleOptions,
    sanitizeAssignableRole,
    uid,
    sha256Hex,
    themePresets: THEME_PRESETS,
    roleOptions,
    ini,
    getRoleConfig,
    userGoogleCalendar,
    companyGoogleCalendarEnabled,
    addons: ADDONS,
    defaultListas: DEFAULT_LISTAS,
    Tabs,
    XBtn,
    releaseMode: LAB_DATA_CONFIG.releaseMode,
  }), [adminOpen, theme, saveTheme, curEmp, curUser, users, empresas, saveUsers, saveEmpresas, platformServices, L, ntf, empId, setListas]);
  const sidebarProps = useMemo(() => ({
    user: curUser,
    empresa: curEmp,
    view: superPanel ? "__super__" : view,
    mobileOpen: mobileSidebarOpen,
    onNav: v => { setSuperPanel(false); navTo(v); closeMobileSidebar(); },
    onAdmin: () => { setAdminOpen(true); closeMobileSidebar(); },
    onLogout: logout,
    onChangeEmp: curUser?.role === "superadmin" ? () => { selectEmp(null); closeMobileSidebar(); } : null,
    counts,
    collapsed: sidebarCollapsed,
    onToggle: () => { if (isMobile) closeMobileSidebar(); else setCollapsed(v => !v); },
    syncPulse,
    isMobile,
    ini,
    includeTreasury: treasuryEnabled,
  }), [curUser, curEmp, superPanel, view, mobileSidebarOpen, navTo, closeMobileSidebar, logout, selectEmp, counts, sidebarCollapsed, syncPulse, isMobile, treasuryEnabled]);
  const alertsPanelProps = useMemo(() => ({
    open: alertasOpen,
    AlertasPanelView,
    alertas,
    alertasOcultas,
    alertasLeidas,
    setAlertasLeidas,
    setAlertasOcultas,
    setAlertasOpen,
    fmtD,
  }), [alertasOpen, alertas, alertasOcultas, alertasLeidas]);
  const systemPanelProps = useMemo(() => ({
    open: systemOpen,
    SystemMessagesPanelView,
    currentEmpresa,
    systemMessages,
    systemLeidas,
    markSystemRead,
    markAllSystemRead,
    setSystemOpen,
    RichTextBlock,
  }), [systemOpen, currentEmpresa, systemMessages, systemLeidas, markSystemRead, markAllSystemRead]);
  const modalLayerProps = useMemo(() => ({
    mOpen,
    CoreModalRouter,
    mData,
    closeM,
    VP,
    modalComponents: operationModalComponents,
    stateSetters: modalStateSetters,
    actions: { ntf, cSave, saveMov, saveFacturaDoc, uid, today },
    helpers: { normalizeSocialPiece, crmNormalizeOpportunity },
  }), [mOpen, mData, closeM, VP, operationModalComponents, modalStateSetters, ntf, cSave, saveMov, saveFacturaDoc]);
  const adminOverlayProps = useMemo(() => ({
    adminOpen,
    curEmp,
    AdminPanelView,
    panelProps: adminPanelProps,
  }), [adminOpen, curEmp, adminPanelProps]);
  const topbarActionProps = useMemo(() => ({
    view,
    detId,
    curEmp,
    curUser,
    canDo,
    openM,
    setSystemOpen,
    systemOpen,
    unreadSystemCount,
    setAlertasOpen,
    alertasOpen,
    alertas,
    alertasLeidas,
    alertasOcultas,
  }), [view, detId, curEmp, curUser, openM, systemOpen, unreadSystemCount, alertasOpen, alertas, alertasLeidas, alertasOcultas]);
  const navigationProps = useMemo(() => ({
    superPanel,
    setSuperPanel,
    view,
  }), [superPanel, view]);
  const viewRendererContexts = useMemo(() => ({
    superAdmin: superAdminContext,
    access: { canAccessModule, countCampaignPieces, normalizeTaskAssignees, getAssignedIds, assignedNameList, TREASURY_MODULE_ID },
    state: { curUser, curEmp, treasuryEnabled, alertas, useBal, fmtM, fmtD, uid, detId },
    helpers: rendererHelpers,
  }), [superAdminContext, curUser, curEmp, treasuryEnabled, alertas, useBal, detId, rendererHelpers]);
  const viewRendererRegistry = useMemo(() => ({
    modules: {
      SuperAdminPanelView,
      ViewDashboard,
      ViewTareas,
      ViewClientes,
      ViewCliDet,
      ViewPros,
      ViewProDet,
      ViewPgs,
      ViewPgDet,
      ViewContenidos,
      ViewContenidoDet,
      ViewEpDet,
      CrmModule,
      ViewCrew,
      ViewCalendario,
      ViewAus,
      ViewCts,
      ViewPres,
      ViewPresDet,
      ViewFact,
      TreasuryModule,
      ViewActivos,
      setters,
      openM,
      ini,
      crmSavingRef,
      canDo: action => canDo(curUser, action, curEmp),
      normalizeSocialPiece,
      treasuryProps,
      emitFacturaToBsale,
      syncFacturaWithBsale,
      inspectFacturaBsaleSync,
    },
  }), [curUser, curEmp, setters, openM, crmSavingRef, treasuryProps, emitFacturaToBsale, syncFacturaWithBsale, inspectFacturaBsaleSync]);
  const viewRendererProps = useMemo(() => ({
    navigation: navigationProps,
    VP,
    contexts: viewRendererContexts,
    registry: viewRendererRegistry,
  }), [navigationProps, VP, viewRendererContexts, viewRendererRegistry]);

  // Screens
  if(!globalInitReady || !empresas||!users) return <AppBootScreen css={APP_SHELL_CSS} />;
  if(!curUser) return <AppLoginScreen css={APP_SHELL_CSS} LoginView={LoginView} domainUsers={domainUsers} domainEmpresas={domainEmpresas} login={login} saveUsers={saveUsers} BrandLockup={BrandLockup} sha256Hex={sha256Hex} dbHelpers={loginDbHelpers} authGateway={authGateway} authModeLabel={getLabAuthModeLabel(authGateway.strategy)} releaseMode={LAB_DATA_CONFIG.releaseMode} />;
  if(curUser?.role==="superadmin"&&!curEmp&&!superPanel) return <AppSuperAdminSelectorScreen css={APP_SHELL_CSS} EmpresaSelectorView={EmpresaSelectorView} domainEmpresas={domainEmpresas} selectEmp={selectEmp} setAdminOpen={setAdminOpen} BrandLockup={BrandLockup} ini={ini} />;

  return <div style={{display:"flex",minHeight:"100vh",background:"var(--bg)"}}>
    <StyleTag css={APP_SHELL_CSS}/>
    <AppShellFrame
      sidebarProps={sidebarProps}
      sidebarWidth={SW}
      isMobile={isMobile}
      mobileSidebarOpen={mobileSidebarOpen}
      closeMobileSidebar={closeMobileSidebar}
      openMobileSidebar={openMobileSidebar}
      breadcrumbs={bc}
      topbarActions={<AppTopbarActions {...topbarActionProps} />}
      activeBanner={activeBanner}
      viewKey={view+detId+superPanel}
    >
      {isLoading ? moduleLoadingOverlay : <Suspense fallback={moduleLoadingOverlay}>
        <AppViewRenderer {...viewRendererProps} />
      </Suspense>}
    </AppShellFrame>
    <AppOverlays
      alertsPanel={alertsPanelProps}
      systemPanel={systemPanelProps}
      toastState={{ toast, ToastView, setToast }}
      modalLayer={modalLayerProps}
      adminPanel={adminOverlayProps}
    />
  </div>;
}

// ── HELPERS COMPARTIDOS ─────────────────────────────────────

// ── FACTURACIÓN ───────────────────────────────────────────────
