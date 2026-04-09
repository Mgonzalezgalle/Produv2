import { useEffect, useRef, useState } from "react";

export function useLabSuperAdminModule({
  actorUser,
  empresas,
  users,
  printLayouts,
  savePrintLayouts,
  supportThreads = [],
  supportSettings = {},
  onSave,
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
}) {
  const [tab, setTab] = useState(0);
  const [ef, setEf] = useState({});
  const [eid, setEid] = useState(null);
  const [sysUf, setSysUf] = useState({ active: true, role: "admin", empId: "", password: "" });
  const [integrationEmpId, setIntegrationEmpId] = useState("");
  const [commEmpId, setCommEmpId] = useState("");
  const [sysMsg, setSysMsg] = useState({ title: "", body: "" });
  const [bannerForm, setBannerForm] = useState({ active: false, tone: "info", text: "" });
  const [q, setQ] = useState("");
  const [planF, setPlanF] = useState("");
  const [stateF, setStateF] = useState("");
  const [portfolioQ, setPortfolioQ] = useState("");
  const [portfolioPlan, setPortfolioPlan] = useState("");
  const [portfolioStatus, setPortfolioStatus] = useState("");
  const [portfolioEmpId, setPortfolioEmpId] = useState("");
  const [uq, setUQ] = useState("");
  const [uRole, setURole] = useState("");
  const [uState, setUState] = useState("");
  const [uEmp, setUEmp] = useState("");
  const [printForm, setPrintForm] = useState(() => normalizePrintLayouts(printLayouts));
  const [activePrintDoc, setActivePrintDoc] = useState("budget");
  const [supportEmpId, setSupportEmpId] = useState("");
  const [supportThreadId, setSupportThreadId] = useState("");
  const [supportReply, setSupportReply] = useState("");
  const sysMsgBodyRef = useRef(null);
  const [supportAttachments, setSupportAttachments] = useState([]);
  const [supportForm, setSupportForm] = useState(() => buildSupportSettings(supportSettings, users));
  const isSuperAdmin = actorUser?.role === "superadmin";
  const canWriteGlobal = () => isSuperAdmin;
  const guardedOnSave = (key, next) => {
    if (!canWriteGlobal()) return false;
    onSave(key, next);
    return true;
  };

  const totalEmp = (empresas || []).length;
  const activeEmp = (empresas || []).filter(e => e.active !== false).length;
  const proEmp = (empresas || []).filter(e => e.plan === "pro" || e.plan === "enterprise").length;
  const totalUsers = (users || []).filter(u => u.role !== "superadmin").length;
  const carteraEmp = (empresas || []).map(emp => ({
    ...emp,
    userCount: (users || []).filter(u => u.role !== "superadmin" && u.empId === emp.id).length,
    grossMonthly: Number(emp.billingMonthly || 0),
    discountPct: companyBillingDiscountPct(emp),
    referralDiscountMonthsPending: companyReferralDiscountMonthsPending(emp),
    netMonthly: companyBillingNet(emp),
    payStatus: companyBillingStatus(emp),
  }));
  const grossMRR = carteraEmp.reduce((s, emp) => s + emp.grossMonthly, 0);
  const netMRR = carteraEmp.reduce((s, emp) => s + emp.netMonthly, 0);
  const totalDiscountMRR = Math.max(0, grossMRR - netMRR);
  const overdueEmp = carteraEmp.filter(emp => ["Vencido", "Mora", "Suspendido"].includes(emp.payStatus)).length;
  const activePortfolioClients = carteraEmp.filter(emp => emp.active !== false);
  const filteredEmp = (empresas || []).filter(emp => (!q || emp.nombre?.toLowerCase().includes(q.toLowerCase()) || emp.rut?.toLowerCase().includes(q.toLowerCase())) && (!planF || emp.plan === planF) && (!stateF || (stateF === "Activa" ? emp.active !== false : emp.active === false)));
  const filteredPortfolio = carteraEmp.filter(emp =>
    (!portfolioQ || emp.nombre?.toLowerCase().includes(portfolioQ.toLowerCase()) || emp.contractOwner?.toLowerCase().includes(portfolioQ.toLowerCase()) || emp.rut?.toLowerCase().includes(portfolioQ.toLowerCase())) &&
    (!portfolioPlan || emp.plan === portfolioPlan) &&
    (!portfolioStatus || emp.payStatus === portfolioStatus),
  );
  const selectedPortfolioEmp = filteredPortfolio.find(emp => emp.id === portfolioEmpId) || filteredPortfolio[0] || null;
  const sysUsers = Array.isArray(users) ? users : [];
  const filteredUsers = sysUsers.filter(u =>
    (!uq || u.name?.toLowerCase().includes(uq.toLowerCase()) || u.email?.toLowerCase().includes(uq.toLowerCase())) &&
    (!uRole || u.role === uRole) &&
    (!uState || (uState === "active" ? u.active : u.active === false)) &&
    (!uEmp || u.empId === uEmp),
  );
  const selectedIntegrationEmp = (empresas || []).find(e => e.id === integrationEmpId) || (empresas || [])[0] || null;
  const selectedCommEmp = (empresas || []).find(e => e.id === commEmpId) || (empresas || [])[0] || null;
  const normalizedSupportSettings = buildSupportSettings(supportSettings, users);
  const normalizedSupportThreads = normalizeSupportThreads(supportThreads, empresas, users, normalizedSupportSettings);
  const selectedSupportEmp = (empresas || []).find(e => e.id === supportEmpId) || (empresas || [])[0] || null;
  const supportThreadsForEmp = normalizedSupportThreads.filter(thread => !selectedSupportEmp || thread.empId === selectedSupportEmp.id);
  const selectedSupportThread = supportThreadsForEmp.find(thread => thread.id === supportThreadId) || supportThreadsForEmp[0] || null;

  useEffect(() => { setPrintForm(normalizePrintLayouts(printLayouts)); }, [printLayouts, normalizePrintLayouts]);
  useEffect(() => { setSupportForm(buildSupportSettings(supportSettings, users)); }, [supportSettings, users, buildSupportSettings]);

  const saveSystemUser = async () => {
    if (!canWriteGlobal()) return false;
    if (!sysUf.name?.trim() || !sysUf.email?.trim() || !sysUf.password?.trim()) return;
    const normalizedEmail = normalizeEmailValue(sysUf.email);
    const existing = (users || []).find(u => normalizeEmailValue(u.email) === normalizedEmail);
    const payload = {
      id: existing?.id || uid(),
      name: sysUf.name.trim(),
      email: normalizedEmail,
      passwordHash: await sha256Hex(sysUf.password),
      role: sanitizeAssignableRole(sysUf.role, null, { role: "superadmin" }, "admin"),
      empId: sysUf.role === "superadmin" ? null : (sysUf.empId || null),
      active: sysUf.active !== false,
      isCrew: false,
      crewRole: "",
    };
    const next = existing
      ? (users || []).map(u => u.id === existing.id ? { ...u, ...payload } : u)
      : [...(users || []), payload];
    guardedOnSave("users", next);
    setSysUf({ active: true, role: "admin", empId: "", password: "" });
  };

  const updatePrint = (doc, key, value) => setPrintForm(prev => ({
    ...prev,
    [doc]: {
      ...prev?.[doc],
      [key]: key === "accent" ? value : Number(value || 0),
    },
  }));

  const resetPrintLayouts = () => setPrintForm(normalizePrintLayouts(DEFAULT_PRINT_LAYOUTS));
  const persistPrintLayouts = async () => {
    if (!canWriteGlobal()) return false;
    await savePrintLayouts(normalizePrintLayouts(printForm));
    return true;
  };

  const applyPrintPreset = (doc, preset) => {
    const base = normalizePrintLayouts(printForm)?.[doc] || DEFAULT_PRINT_LAYOUTS[doc];
    const nextPreset = preset === "compact"
      ? {
          companyTitleSize: Math.max(14, Number(base.companyTitleSize || 16) - 1.4),
          metaSize: Math.max(7.2, Number(base.metaSize || 8.8) - 0.6),
          sectionTitleSize: Math.max(8, Number(base.sectionTitleSize || 9.2) - 0.4),
          sectionBodySize: Math.max(7.4, Number(base.sectionBodySize || 8.6) - 0.6),
          summaryLabelSize: Math.max(6.8, Number(base.summaryLabelSize || 7.5) - 0.4),
          summaryValueSize: Math.max(8.8, Number(base.summaryValueSize || 10) - 0.8),
          stampWidth: Math.max(138, Number(base.stampWidth || 158) - 10),
          stampHeight: Math.max(72, Number(base.stampHeight || 84) - 6),
          detailHeaderSize: Math.max(6.8, Number(base.detailHeaderSize || 7.7) - 0.5),
          detailBodySize: Math.max(6.4, Number(base.detailBodySize || 7.1) - 0.5),
        }
      : preset === "airy"
        ? {
            companyTitleSize: Math.min(24, Number(base.companyTitleSize || 18) + 1),
            metaSize: Math.min(10.5, Number(base.metaSize || 9) + 0.4),
            sectionTitleSize: Math.min(11.5, Number(base.sectionTitleSize || 9.2) + 0.6),
            sectionBodySize: Math.min(10.2, Number(base.sectionBodySize || 8.6) + 0.5),
            summaryLabelSize: Math.min(9.5, Number(base.summaryLabelSize || 7.5) + 0.4),
            summaryValueSize: Math.min(12.6, Number(base.summaryValueSize || 10) + 0.6),
            stampWidth: Math.min(200, Number(base.stampWidth || 158) + 8),
            stampHeight: Math.min(104, Number(base.stampHeight || 84) + 6),
            detailHeaderSize: Math.min(9.5, Number(base.detailHeaderSize || 7.7) + 0.4),
            detailBodySize: Math.min(8.8, Number(base.detailBodySize || 7.1) + 0.4),
          }
        : {
            ...DEFAULT_PRINT_LAYOUTS[doc],
          };
    setPrintForm(prev => normalizePrintLayouts({
      ...prev,
      [doc]: {
        ...prev?.[doc],
        ...nextPreset,
      },
    }));
  };

  const renderPrintPreview = (doc, cfg) => {
    const isBudget = doc === "budget";
    const summaryRows = isBudget
      ? [
          { label: "Condición de pago", value: "Al iniciar" },
          { label: "Validez", value: "30 días" },
          { label: "SubTotal", value: "$185.000" },
          { label: "TOTAL FINAL", value: "$185.000", highlight: true },
        ]
      : [
          { label: "Pago esperado", value: "$185.000" },
          { label: "Fecha de pago", value: "06 abr 2026" },
          { label: "SubTotal", value: "$185.000" },
          { label: "Total", value: "$185.000", highlight: true },
        ];
    const detailCols = [
      { label: "Detalle", width: cfg.detailColWidth || 300 },
      { label: isBudget ? "Recurr." : "Estado", width: cfg.recurrenceColWidth || 78 },
      { label: "Cant.", width: cfg.qtyColWidth || 34 },
      { label: "V. Unit.", width: cfg.unitColWidth || 74 },
      { label: "Total", width: cfg.totalColWidth || 42 },
    ];
    return <div style={{ padding: 14, border: "1px solid var(--bdr2)", borderRadius: 18, background: "linear-gradient(180deg,var(--sur),var(--card))", marginTop: 14 }}>
      <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 10 }}>Vista previa</div>
      <div style={{ width: 320, maxWidth: "100%", aspectRatio: "0.77", margin: "0 auto", border: "1px solid #d6dce7", borderRadius: 16, background: "#fff", boxShadow: "0 20px 40px rgba(15,23,42,.14)", padding: 16, display: "grid", gridTemplateRows: "auto auto auto 1fr auto auto", gap: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: Math.max(9, cfg.companyTitleSize || 18), fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Play Media SpA</div>
            <div style={{ marginTop: 6, fontSize: Math.max(6.2, (cfg.metaSize || 9) - 1), lineHeight: 1.35, color: "#6b7280" }}>
              78.118.348-2<br />Av. Providencia 1234, Santiago<br />playmedia@grupogonzalez.co
            </div>
          </div>
          <div style={{ width: Math.max(86, (cfg.stampWidth || 158) * 0.5), height: Math.max(58, (cfg.stampHeight || 84) * 0.52), border: "2px solid #c1121f", borderRadius: 12, padding: "8px 10px", display: "grid", alignContent: "center", justifyItems: "center", color: "#c1121f", flexShrink: 0 }}>
            <div style={{ fontSize: 7, fontWeight: 800, lineHeight: 1 }}>78.118.348-2</div>
            <div style={{ fontSize: Math.max(9, (cfg.sectionTitleSize || 9.2) + 4), fontWeight: 900, lineHeight: 1.05, marginTop: 4 }}>{isBudget ? "PRESUPUESTO" : "FACTURACIÓN"}</div>
            <div style={{ fontSize: Math.max(8, (cfg.sectionTitleSize || 9.2) + 1), fontWeight: 800, lineHeight: 1, marginTop: 4 }}>N° 002396</div>
          </div>
        </div>
        <div style={{ fontSize: Math.max(6.2, cfg.metaSize || 9), lineHeight: 1.45, color: "#111827" }}>
          Fecha: 05 abr 2026<br />
          {isBudget ? "Validez: 30 días" : "Vencimiento: 15 abr 2026"}<br />
          Moneda: CLP
        </div>
        <div style={{ border: "1px solid #d7deea", borderRadius: 12, padding: "10px 12px", background: "#fff" }}>
          <div style={{ fontSize: Math.max(6.4, cfg.sectionTitleSize || 9.2), fontWeight: 800, color: cfg.accent || "#1f2f5f", marginBottom: 4 }}>Cliente</div>
          <div style={{ fontSize: Math.max(8.5, (cfg.companyTitleSize || 18) - 3), fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Raíces de Tango</div>
          <div style={{ marginTop: 4, fontSize: Math.max(6.1, cfg.sectionBodySize || 8.8), lineHeight: 1.35, color: "#6b7280" }}>
            Av. Calera de Tango, paradero 8<br />Contacto: Catalina Contreras
          </div>
        </div>
        <div style={{ border: "1px solid #d7deea", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
          <div style={{ padding: "8px 10px", background: cfg.accent || "#1f2f5f", display: "grid", gridTemplateColumns: `${detailCols.map(c => `${c.width}fr`).join(" ")}`, gap: 8 }}>
            {detailCols.map(col => <div key={col.label} style={{ fontSize: Math.max(5.8, cfg.detailHeaderSize || 7.7), fontWeight: 800, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{col.label}</div>)}
          </div>
          {[1, 2].map(row => <div key={row} style={{ padding: "8px 10px", display: "grid", gridTemplateColumns: `${detailCols.map(c => `${c.width}fr`).join(" ")}`, gap: 8, borderTop: "1px solid #e5e7eb", alignItems: "start" }}>
            <div style={{ fontSize: Math.max(5.8, cfg.detailBodySize || 7.1), lineHeight: 1.25, color: "#111827" }}>{row === 1 ? "Piezas Reel Instagram - Video Vertical" : "Piezas Gráficas Mensuales - Foto Montajes"}</div>
            <div style={{ fontSize: Math.max(5.8, cfg.detailBodySize || 7.1), lineHeight: 1.25, color: "#111827" }}>{isBudget ? (row === 1 ? "Mensual" : "Única vez") : (row === 1 ? "Emitida" : "Pagada")}</div>
            <div style={{ fontSize: Math.max(5.8, cfg.detailBodySize || 7.1), textAlign: "right", color: "#111827" }}>{row === 1 ? "3" : "10"}</div>
            <div style={{ fontSize: Math.max(5.8, cfg.detailBodySize || 7.1), textAlign: "right", color: "#111827" }}>{row === 1 ? "$25.000" : "$6.000"}</div>
            <div style={{ fontSize: Math.max(5.9, (cfg.detailBodySize || 7.1) + .2), textAlign: "right", fontWeight: 800, color: "#111827" }}>{row === 1 ? "$75.000" : "$60.000"}</div>
          </div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[summaryRows.slice(0, 2), summaryRows.slice(2)].map((rows, idx) => <div key={idx} style={{ border: "1px solid #d7deea", borderRadius: 12, padding: 10, background: "#fff", display: "grid", gap: 8 }}>
            {rows.map(row => <div key={row.label} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
              <div style={{ padding: "6px 10px", borderRadius: 10, background: idx === 0 && row.highlight ? "#c1121f" : cfg.accent || "#1f2f5f", fontSize: Math.max(5.8, cfg.summaryLabelSize || 7.5), fontWeight: 800, color: "#fff", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.label}</div>
              <div style={{ fontSize: Math.max(7, cfg.summaryValueSize || 10), fontWeight: 900, color: row.highlight ? "#c1121f" : "#111827", textAlign: "right" }}>{row.value}</div>
            </div>)}
          </div>)}
        </div>
        <div style={{ border: "1px solid #d7deea", borderRadius: 12, padding: "10px 12px", background: "#fff" }}>
          <div style={{ fontSize: Math.max(6.4, cfg.sectionTitleSize || 9.2), fontWeight: 800, color: cfg.accent || "#1f2f5f", marginBottom: 4 }}>Datos de pago</div>
          <div style={{ fontSize: Math.max(6.1, cfg.sectionBodySize || 8.8), lineHeight: 1.35, color: "#111827" }}>
            Titular: Play Media SpA<br />Banco: Banco Scotiabank<br />Cuenta corriente: 991604383
          </div>
        </div>
      </div>
    </div>;
  };

  const SUPER_TABS = ["Empresas", "Cartera", "Usuarios del sistema", "Integraciones", "Comunicaciones", "Solicitudes", "Impresos"];
  const SUPER_TAB_META = {
    "Empresas": { eyebrow: "Estructura", desc: "Administra tenants, planes, addons y configuración base de cada instancia." },
    "Cartera": { eyebrow: "Control comercial", desc: "Monitorea MRR, descuentos, pagos, referidos y salud financiera de los tenants." },
    "Usuarios del sistema": { eyebrow: "Accesos", desc: "Revisa usuarios creados, roles y conectividad operativa por empresa." },
    "Integraciones": { eyebrow: "Base técnica", desc: "Activa o desactiva integraciones preparadas por tenant sin exponer funciones incompletas." },
    "Comunicaciones": { eyebrow: "Mensajería", desc: "Envía mensajes sistémicos y banners visibles para cada empresa usuaria." },
    "Solicitudes": { eyebrow: "Pipeline", desc: "Aprueba accesos, solicitudes y referidos desde una sola bandeja de control." },
    "Impresos": { eyebrow: "Diseño documental", desc: "Ajusta tamaños, pesos visuales y estructura base de los PDFs de Presupuestos y Facturación desde una consola central." },
  };
  const activeSuperTab = SUPER_TABS[tab];

  const saveEmp = () => {
    if (!canWriteGlobal()) return false;
    if (!ef.nombre?.trim()) return;
    const id = eid || `emp_${uid().slice(1, 7)}`;
    const prev = empresas.find(e => e.id === eid) || {};
    const obj = { id, tenantCode: prev.tenantCode || nextTenantCode(empresas), nombre: ef.nombre, rut: ef.rut || "", dir: ef.dir || "", tel: ef.tel || "", ema: ef.ema || "", logo: ef.logo || prev.logo || "", color: ef.color || "#00d4e8", addons: ef.addons || [], active: ef.active !== false, plan: ef.plan || "starter", theme: ef.theme || prev.theme || null, googleCalendarEnabled: prev.googleCalendarEnabled === true, freshdeskEnabled: false, migratedTasksAddon: prev.migratedTasksAddon ?? true, supportChatEnabled: false, systemMessages: prev.systemMessages || [], systemBanner: prev.systemBanner || { active: false, tone: "info", text: "" }, billingCurrency: prev.billingCurrency || "UF", billingMonthly: Number(prev.billingMonthly || 0), billingDiscountPct: companyBillingDiscountPct(prev), billingDiscountNote: prev.billingDiscountNote || "", billingStatus: prev.billingStatus || "Pendiente", billingDueDay: Number(prev.billingDueDay || 0), billingLastPaidAt: prev.billingLastPaidAt || "", referralDiscountMonthsPending: companyReferralDiscountMonthsPending(prev), referralDiscountHistory: companyReferralDiscountHistory(prev), contractOwner: prev.contractOwner || "", clientPortalUrl: prev.clientPortalUrl || "", paymentDetails: prev.paymentDetails || null, bankInfo: prev.bankInfo || "", cr: eid ? (empresas.find(e => e.id === eid)?.cr || today()) : today() };
    guardedOnSave("empresas", eid ? empresas.map(e => e.id === eid ? obj : e) : [...empresas, obj]);
    setEf({});
    setEid(null);
  };

  const savePortfolio = (empId, patch = {}) => {
    if (!canWriteGlobal()) return false;
    guardedOnSave("empresas", (empresas || []).map(e => {
      if (e.id !== empId) return e;
      const consumeReferralMonth = shouldConsumeReferralDiscountMonth(e, patch);
      const nextHistory = consumeReferralMonth
        ? [{
            id: uid(),
            type: "applied",
            date: patch.billingLastPaidAt || today(),
            note: "Se aplicó 1 mes gratis por referido al registrar un nuevo pago.",
          }, ...companyReferralDiscountHistory(e)]
        : companyReferralDiscountHistory(e);
      return {
        ...e,
        ...patch,
        billingCurrency: patch.billingCurrency ?? e.billingCurrency ?? "UF",
        billingMonthly: Number(patch.billingMonthly ?? e.billingMonthly ?? 0),
        billingDiscountPct: companyBillingDiscountPct({ billingDiscountPct: patch.billingDiscountPct ?? e.billingDiscountPct ?? 0 }),
        billingDueDay: Number(patch.billingDueDay ?? e.billingDueDay ?? 0),
        referralDiscountMonthsPending: Math.max(0, Number(
          patch.referralDiscountMonthsPending
          ?? (consumeReferralMonth ? companyReferralDiscountMonthsPending(e) - 1 : companyReferralDiscountMonthsPending(e))
        ) || 0),
        referralDiscountHistory: Array.isArray(patch.referralDiscountHistory) ? patch.referralDiscountHistory : nextHistory,
      };
    }));
    return true;
  };

  const publishSystemMessage = () => {
    if (!canWriteGlobal()) return false;
    if (!selectedCommEmp || !sysMsg.title?.trim() || !sysMsg.body?.trim()) return;
    const next = (empresas || []).map(e => e.id === selectedCommEmp.id ? { ...e, systemMessages: [{ id: uid(), title: sysMsg.title.trim(), body: sysMsg.body.trim(), createdAt: today() }, ...(e.systemMessages || [])] } : e);
    guardedOnSave("empresas", next);
    setSysMsg({ title: "", body: "" });
  };
  const updateSystemBody = updater => {
    setSysMsg(prev => ({ ...prev, body: typeof updater === "function" ? updater(prev.body || "") : updater }));
  };
  const wrapSystemSelection = (before, after = before) => {
    const el = sysMsgBodyRef.current;
    if (!el) {
      updateSystemBody(text => `${text || ""}${before}${after}`);
      return;
    }
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? start;
    const value = sysMsg.body || "";
    const selected = value.slice(start, end);
    const nextValue = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    updateSystemBody(nextValue);
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  };
  const insertSystemBlock = block => {
    const el = sysMsgBodyRef.current;
    const value = sysMsg.body || "";
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const prefix = start > 0 && !value.slice(0, start).endsWith("\n") ? "\n" : "";
    const suffix = end < value.length && !value.slice(end).startsWith("\n") ? "\n" : "";
    const nextValue = `${value.slice(0, start)}${prefix}${block}${suffix}${value.slice(end)}`;
    updateSystemBody(nextValue);
    requestAnimationFrame(() => {
      if (el) {
        const caret = start + prefix.length + block.length;
        el.focus();
        el.setSelectionRange(caret, caret);
      }
    });
  };
  const applySystemPreset = preset => {
    setSysMsg({ title: preset.title, body: preset.body });
    requestAnimationFrame(() => sysMsgBodyRef.current?.focus());
  };
  const saveBanner = () => {
    if (!canWriteGlobal()) return false;
    if (!selectedCommEmp) return;
    const payload = { active: !!bannerForm.active, tone: bannerForm.tone || "info", text: bannerForm.text || "", updatedAt: today() };
    const next = (empresas || []).map(e => e.id === selectedCommEmp.id ? { ...e, systemBanner: payload } : e);
    guardedOnSave("empresas", next);
  };
  const removeSystemMessage = msgId => {
    if (!canWriteGlobal()) return false;
    if (!selectedCommEmp) return;
    const next = (empresas || []).map(e => e.id === selectedCommEmp.id ? { ...e, systemMessages: (e.systemMessages || []).filter(m => m.id !== msgId) } : e);
    guardedOnSave("empresas", next);
  };

  const toggleSupportForEmp = enabled => {
    if (!canWriteGlobal()) return false;
    if (!selectedSupportEmp) return;
    guardedOnSave("empresas", (empresas || []).map(emp => emp.id === selectedSupportEmp.id ? { ...emp, supportChatEnabled: enabled } : emp));
  };
  const persistSupportSettings = () => {
    if (!canWriteGlobal()) return false;
    return guardedOnSave("supportSettings", supportForm);
  };
  const loadSupportFiles = async files => {
    const list = Array.from(files || []).slice(0, Math.max(0, 4 - supportAttachments.length));
    const next = [];
    for (const file of list) {
      const att = await supportAttachmentFromFile(file);
      if (att) next.push(att);
    }
    if (next.length) setSupportAttachments(prev => [...prev, ...next].slice(0, 4));
  };
  const saveSupportThreadsFromPanel = next => {
    if (!canWriteGlobal()) return false;
    return guardedOnSave("supportThreads", next);
  };
  const assignSupportAdmins = ids => {
    if (!canWriteGlobal()) return false;
    if (!selectedSupportThread) return;
    const next = normalizedSupportThreads.map(thread => thread.id === selectedSupportThread.id ? { ...thread, assignedAdminIds: ids, updatedAt: nowIso() } : thread);
    saveSupportThreadsFromPanel(next);
  };
  const sendSupportReply = () => {
    if (!canWriteGlobal()) return false;
    if (!selectedSupportThread || (!supportReply.trim() && !supportAttachments.length)) return;
    const adminName = "Equipo Produ";
    const msg = {
      id: uid(),
      authorType: "admin",
      authorId: "",
      authorName: adminName,
      text: supportReply.trim(),
      attachments: supportAttachments,
      createdAt: nowIso(),
    };
    const next = normalizedSupportThreads.map(thread => thread.id === selectedSupportThread.id ? {
      ...thread,
      status: "open",
      updatedAt: msg.createdAt,
      lastMessageAt: msg.createdAt,
      messages: [...(thread.messages || []), msg],
    } : thread);
    saveSupportThreadsFromPanel(next);
    setSupportReply("");
    setSupportAttachments([]);
  };
  const updateSupportThreadStatus = status => {
    if (!canWriteGlobal()) return false;
    if (!selectedSupportThread) return;
    const next = normalizedSupportThreads.map(thread => thread.id === selectedSupportThread.id ? { ...thread, status, updatedAt: nowIso() } : thread);
    saveSupportThreadsFromPanel(next);
  };

  const handleAceptarSolicitud = async (sol, empId) => {
    if (!canWriteGlobal()) return false;
    const cur = await dbGet("produ:solicitudes") || [];
    if (sol.tipo === "empresa") {
      const liveEmpresas = normalizeEmpresasModel((await dbGet("produ:empresas")) || empresas || []);
      const liveUsers = (await dbGet("produ:users")) || users || [];
      const targetEmpId = sol.empresaId || empId || "";
      if (!targetEmpId) { alert("No se encontró la empresa pendiente para activar."); return; }
      const tempPassword = uid().slice(1, 9);
      const alreadyExists = (liveUsers || []).find(u => u.email?.toLowerCase() === sol.ema?.toLowerCase() && u.empId === targetEmpId);
      const nextUsers = alreadyExists
        ? (liveUsers || []).map(u => u.id === alreadyExists.id ? { ...u, name: sol.nom, role: sol.rol || u.role || "admin", active: true, empId: targetEmpId } : u)
        : [...(liveUsers || []), { id: uid(), name: sol.nom, email: sol.ema, passwordHash: await sha256Hex(tempPassword), role: sol.rol || "admin", empId: targetEmpId, active: true, isCrew: false, crewRole: "" }];
      guardedOnSave("users", nextUsers);
      const empresaExists = (liveEmpresas || []).some(e => e.id === targetEmpId);
      const baseEmpresas = empresaExists
        ? liveEmpresas
        : normalizeEmpresasModel([
            ...(liveEmpresas || []),
            {
              id: targetEmpId,
              tenantCode: nextTenantCode(liveEmpresas || []),
              nombre: sol.emp || sol.companyDraft?.nombre || "Empresa pendiente",
              rut: sol.companyDraft?.rut || "",
              dir: sol.companyDraft?.dir || "",
              tel: sol.tel || sol.companyDraft?.tel || "",
              ema: sol.ema || sol.companyDraft?.ema || "",
              logo: sol.companyDraft?.logo || "",
              color: sol.companyDraft?.color || "#00d4e8",
              addons: sol.companyDraft?.addons || [],
              active: false,
              pendingActivation: true,
              requestType: "demo",
              customerType: sol.customerType || sol.companyDraft?.customerType || "productora",
              teamSize: sol.teamSize || sol.companyDraft?.teamSize || "1-3",
              requestedModules: sol.requestedModules || sol.companyDraft?.requestedModules || [],
              referredByEmpId: sol.referredByEmpId || sol.companyDraft?.referredByEmpId || "",
              referredByName: sol.referredByName || sol.companyDraft?.referredByName || "",
              referred: !!sol.referred,
              plan: sol.companyDraft?.plan || "starter",
              googleCalendarEnabled: false,
              migratedTasksAddon: true,
              systemMessages: sol.companyDraft?.systemMessages || [],
              systemBanner: sol.companyDraft?.systemBanner || { active: false, tone: "info", text: "" },
              billingCurrency: sol.companyDraft?.billingCurrency || "UF",
              billingMonthly: Number(sol.companyDraft?.billingMonthly || 0),
              billingDiscountPct: Number(sol.companyDraft?.billingDiscountPct || 0),
              billingDiscountNote: sol.companyDraft?.billingDiscountNote || "",
              billingStatus: sol.companyDraft?.billingStatus || "Pendiente",
              billingDueDay: Number(sol.companyDraft?.billingDueDay || 0),
              billingLastPaidAt: sol.companyDraft?.billingLastPaidAt || "",
              contractOwner: sol.nom || sol.companyDraft?.contractOwner || "",
              clientPortalUrl: sol.companyDraft?.clientPortalUrl || "",
              cr: sol.companyDraft?.cr || today(),
            },
          ]);
      const nextEmpresas = baseEmpresas.map(e => {
        if (e.id === targetEmpId) return { ...e, active: true, pendingActivation: false, requestType: "demo" };
        if (sol.referred && e.id === sol.referredByEmpId) {
          return {
            ...e,
            referralCredits: Number(e.referralCredits || 0) + 1,
            referralDiscountMonthsPending: companyReferralDiscountMonthsPending(e) + 1,
            billingDiscountNote: e.billingDiscountNote || "1 mes pendiente por referido activado",
            referralDiscountHistory: [{
              id: uid(),
              type: "earned",
              date: today(),
              sourceEmpId: targetEmpId,
              sourceEmpName: sol.emp || sol.referredCompanyName || "Empresa referida",
              note: `Se acreditó 1 mes gratis por activar a ${sol.emp || sol.referredCompanyName || "una empresa referida"}.`,
            }, ...companyReferralDiscountHistory(e)],
          };
        }
        return e;
      });
      guardedOnSave("empresas", nextEmpresas);
      const nextSols = cur.map(s => s.id === sol.id ? { ...s, estado: "aprobada", approvedAt: today() } : s);
      await dbSet("produ:solicitudes", nextSols);
      alert("Empresa activada. Email: " + sol.ema + (alreadyExists ? "" : " / Contrasena temporal: " + tempPassword) + (sol.referred ? " / Se acreditó 1 mes de descuento al referido." : ""));
      return;
    }
    const tempPassword = uid().slice(1, 9);
    const newUser = { id: uid(), name: sol.nom, email: sol.ema, passwordHash: await sha256Hex(tempPassword), role: sol.rol || "productor", empId: empId || "", active: true };
    guardedOnSave("users", [...(users || []), newUser]);
    await dbSet("produ:solicitudes", cur.filter(s => s.id !== sol.id));
    alert("Usuario creado. Email: " + sol.ema + " / Contrasena temporal: " + tempPassword);
  };

  const handleRechazarSolicitud = async sol => {
    if (!canWriteGlobal()) return false;
    const cur = await dbGet("produ:solicitudes") || [];
    if (sol.tipo === "empresa") {
      if ((empresas || []).some(e => e.id === sol.empresaId)) {
        guardedOnSave("empresas", (empresas || []).filter(e => e.id !== sol.empresaId));
      }
      await dbSet("produ:solicitudes", cur.map(s => s.id === sol.id ? { ...s, estado: "rechazada", rejectedAt: today() } : s));
      return;
    }
    await dbSet("produ:solicitudes", cur.filter(s => s.id !== sol.id));
  };

  return {
    tab,
    setTab,
    q,
    setQ,
    planF,
    setPlanF,
    stateF,
    setStateF,
    portfolioQ,
    setPortfolioQ,
    portfolioPlan,
    setPortfolioPlan,
    portfolioStatus,
    setPortfolioStatus,
    portfolioEmpId,
    setPortfolioEmpId,
    uq,
    setUQ,
    uRole,
    setURole,
    uState,
    setUState,
    uEmp,
    setUEmp,
    ef,
    setEf,
    eid,
    setEid,
    sysUf,
    setSysUf,
    integrationEmpId,
    setIntegrationEmpId,
    commEmpId,
    setCommEmpId,
    sysMsg,
    setSysMsg,
    bannerForm,
    setBannerForm,
    printForm,
    activePrintDoc,
    setActivePrintDoc,
    supportEmpId,
    setSupportEmpId,
    supportThreadId,
    setSupportThreadId,
    supportReply,
    setSupportReply,
    sysMsgBodyRef,
    supportAttachments,
    setSupportAttachments,
    supportForm,
    setSupportForm,
    totalEmp,
    activeEmp,
    proEmp,
    totalUsers,
    carteraEmp,
    grossMRR,
    netMRR,
    totalDiscountMRR,
    overdueEmp,
    activePortfolioClients,
    filteredEmp,
    filteredPortfolio,
    selectedPortfolioEmp,
    filteredUsers,
    selectedIntegrationEmp,
    selectedCommEmp,
    normalizedSupportSettings,
    normalizedSupportThreads,
    selectedSupportEmp,
    supportThreadsForEmp,
    selectedSupportThread,
    isSuperAdmin,
    guardedOnSave,
    saveSystemUser,
    updatePrint,
    resetPrintLayouts,
    persistPrintLayouts,
    applyPrintPreset,
    renderPrintPreview,
    SUPER_TABS,
    SUPER_TAB_META,
    activeSuperTab,
    saveEmp,
    savePortfolio,
    publishSystemMessage,
    wrapSystemSelection,
    insertSystemBlock,
    applySystemPreset,
    saveBanner,
    removeSystemMessage,
    toggleSupportForEmp,
    persistSupportSettings,
    loadSupportFiles,
    assignSupportAdmins,
    sendSupportReply,
    updateSupportThreadStatus,
    companyBillingStatus,
    companyBillingNet,
    companyBillingBaseNet,
    companyReferralDiscountMonthsPending,
    companyReferralDiscountHistory,
    companyPaymentDayLabel,
    companyBillingDiscountPct,
    companyIsUpToDate,
    companyGoogleCalendarEnabled,
    handleAceptarSolicitud,
    handleRechazarSolicitud,
    fmtD,
    fmtMoney,
  };
}
