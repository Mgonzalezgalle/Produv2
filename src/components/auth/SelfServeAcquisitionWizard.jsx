import React, { useEffect, useMemo, useState } from "react";
import { Badge, Btn, GBtn } from "../../lib/ui/components";
import {
  SELF_SERVE_ADDON_GROUPS,
  buildSelfServeBaseProduct,
  SELF_SERVE_PRICE_UNIT,
  buildSelfServePricingSnapshot,
  getSelfServeAddonCatalog,
  getSelfServeRecommendations,
  normalizeSelfServeSelection,
} from "../../lib/config/selfServeCatalog";
import { buildSelfServeCommercialSummary } from "../../lib/config/selfServeCheckout";
import { DEFAULT_SELF_SERVE_SETTINGS, normalizeSelfServeSettings, SELF_SERVE_SETTINGS_KEY } from "../../lib/config/selfServeAdminConfig";
import { createPlatformMockGateway } from "../../lib/backend/platformMockGateway";

export class AuthModalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: String(error?.message || "No pudimos renderizar este flujo.") };
  }

  componentDidCatch(error) {
    console.error("Auth modal render error", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:18,width:560,maxWidth:"100%",padding:28}}>
            <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,marginBottom:8}}>No pudimos abrir este flujo</div>
            <div style={{fontSize:12,color:"var(--gr2)",lineHeight:1.7,marginBottom:18}}>
              El login siguió estable, pero el wizard de contratación encontró un error de render. Ya lo tomamos para corregirlo sin tocar `productivo`.
            </div>
            <div style={{padding:"12px 14px",borderRadius:12,border:"1px solid #ff556635",background:"#ff556615",color:"var(--red)",fontSize:12,marginBottom:18}}>
              {this.state.message}
            </div>
            <GBtn onClick={this.props.onClose}>Cerrar</GBtn>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function SelfServeAcquisitionWizard({
  onClose,
  solF,
  setSolF,
  solSent,
  setSolSent,
  empresas = [],
  helpers,
  releaseMode = false,
}) {
  const {
    today,
    dbGet,
    dbSet,
    nextTenantCode,
    sha256Hex,
    authGateway,
    sessionKey,
    users,
    empresas: helperEmpresas,
    platformApi,
    platformGateway: providedPlatformGateway,
  } = helpers;
  const platformGateway = useMemo(
    () => providedPlatformGateway || createPlatformMockGateway({
      dbGet,
      dbSet,
      sha256Hex,
      authGateway,
      sessionKey,
      users,
      empresas: helperEmpresas,
      nextTenantCode,
      today,
    }),
    [providedPlatformGateway, authGateway, sessionKey, users, helperEmpresas, dbGet, dbSet, nextTenantCode, sha256Hex, today],
  );

  const [step, setStep] = useState(1);
  const [selfServeSettings, setSelfServeSettings] = useState(DEFAULT_SELF_SERVE_SETTINGS);
  const addonCatalog = useMemo(() => getSelfServeAddonCatalog(selfServeSettings), [selfServeSettings]);
  const selectedModules = normalizeSelfServeSelection(solF.modules || []);
  const baseProduct = useMemo(() => buildSelfServeBaseProduct(selfServeSettings), [selfServeSettings]);
  const pricingSnapshot = buildSelfServePricingSnapshot(selectedModules, selfServeSettings);
  const commercialSummary = buildSelfServeCommercialSummary(pricingSnapshot);
  const recommendations = getSelfServeRecommendations(selectedModules, selfServeSettings);
  const groupedModules = SELF_SERVE_ADDON_GROUPS.map(group => ({
    ...group,
    items: addonCatalog.filter(item => item.group === group.code),
  })).filter(group => group.items.length > 0);
  const canAdvanceFromStep1 = !!(solF.emp && solF.ema && solF.tel);
  const canAdvanceFromStep2 = !!(solF.nom && solF.adminLastName && solF.adminEmail);
  const effectiveCheckoutMethod = selfServeSettings.assistedOnly ? "contacto" : (solF.checkoutMethod || "contacto");
  const canAdvanceFromStep5 = !!effectiveCheckoutMethod;

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const stored = await dbGet(SELF_SERVE_SETTINGS_KEY);
        if (!cancelled) setSelfServeSettings(normalizeSelfServeSettings(stored || DEFAULT_SELF_SERVE_SETTINGS));
      } catch {
        if (!cancelled) setSelfServeSettings(DEFAULT_SELF_SERVE_SETTINGS);
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [dbGet]);

  const setField = (key, value) => setSolF(prev => ({ ...prev, [key]: value }));
  const toggleModule = (code) => {
    setSolF(prev => {
      const next = new Set(normalizeSelfServeSelection(prev.modules || []));
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...prev, modules: Array.from(next) };
    });
  };

  const stepMeta = [
    { id: 1, label: "Empresa" },
    { id: 2, label: "Administrador" },
    { id: 3, label: "Addons" },
    { id: 4, label: "Confirmación" },
    { id: 5, label: "Checkout" },
  ];

  const nextStep = () => {
    if (step === 1 && !canAdvanceFromStep1) {
      alert("Completa empresa, email y teléfono para continuar.");
      return;
    }
    if (step === 2 && !canAdvanceFromStep2) {
      alert("Completa nombre, apellido y email del administrador.");
      return;
    }
    if (step === 5 && !canAdvanceFromStep5) {
      alert("Selecciona un método de checkout para continuar.");
      return;
    }
    setStep(current => Math.min(5, current + 1));
  };

  const prevStep = () => setStep(current => Math.max(1, current - 1));

  const saveAcquisitionDraft = async () => {
    if (!solF.nom || !solF.emp || !solF.ema || !solF.tel) {
      alert("Completa los datos principales antes de enviar la solicitud.");
      return;
    }
    const referral = (empresas || []).find(
      e => String(e.referralCode || "").toUpperCase() === String(solF.referralCode || "").toUpperCase() && e.active !== false
    );
    const tenantRequest = {
      companyDraft: {
        nombre: solF.emp,
        rut: solF.rut || "",
        dir: solF.dir || "",
        tel: solF.tel || "",
        ema: solF.ema || "",
        billingMonthly: pricingSnapshot.totalUF,
        referredByEmpId: referral?.id || "",
        referredByName: referral?.nombre || "",
        referred: !!referral,
        contractOwner: `${solF.nom || ""} ${solF.adminLastName || ""}`.trim(),
      },
      requestedModules: selectedModules,
      customerType: solF.customerType || "productora",
      teamSize: solF.teamSize || "1-3",
    };
    const tenantResponse = platformApi?.tenants?.createPendingTenant
      ? await platformApi.tenants.createPendingTenant(tenantRequest)
      : { tenantDraft: await platformGateway.createPendingTenant(tenantRequest) };
    const companyDraft = tenantResponse?.tenantDraft;
    if (!companyDraft?.id) {
      alert("No pudimos preparar la empresa para activación.");
      return;
    }
    const acquisitionLead = {
      id: `lead_${companyDraft.id}`,
      source: "login_self_serve",
      tipo: "empresa",
      estado: "checkout_started",
      fecha: today(),
      empresaId: companyDraft.id,
      companyDraft,
      adminDraft: {
        firstName: solF.nom || "",
        lastName: solF.adminLastName || "",
        email: solF.adminEmail || solF.ema || "",
        phone: solF.adminPhone || solF.tel || "",
        role: solF.rol || "admin",
        cargo: solF.adminRole || "Administrador",
      },
      moduleSelection: {
        baseCode: baseProduct.code,
        addonCodes: selectedModules,
      },
      pricingSnapshot,
      checkoutState: effectiveCheckoutMethod,
      paymentState: "pending",
      activationState: "awaiting_review",
      nom: `${solF.nom || ""} ${solF.adminLastName || ""}`.trim(),
      ema: solF.adminEmail || solF.ema || "",
      tel: solF.adminPhone || solF.tel || "",
      emp: solF.emp || "",
      msg: solF.msg || "",
      customerType: solF.customerType || "productora",
      teamSize: solF.teamSize || "1-3",
      requestedModules: selectedModules,
      referralCode: solF.referralCode || "",
      referred: !!referral,
      referredByEmpId: referral?.id || "",
      referredByName: referral?.nombre || "",
    };
    const cur = await dbGet("produ:solicitudes") || [];
    let nextLead = { ...acquisitionLead };
    if (effectiveCheckoutMethod === "link_pago") {
      const checkoutResult = await platformGateway.createSelfServeCheckoutSession({
        acquisitionLead,
        pricingSnapshot,
      });
      if (!checkoutResult?.ok) {
        alert(checkoutResult?.error || "No pudimos preparar el checkout.");
        return;
      }
      nextLead = {
        ...nextLead,
        ...(checkoutResult.leadPatch || {}),
      };
    }
    await dbSet("produ:solicitudes", [...cur, nextLead]);
    setSolSent(true);
  };

  return <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:18,width:1120,maxWidth:"100%",padding:28,animation:"modalIn .2s ease",maxHeight:"92vh",overflow:"auto"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,marginBottom:4}}>Contratar Produ</div>
          <div style={{fontSize:12,color:"var(--gr2)"}}>Activación guiada de empresa, administrador y addons</div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:20}}>✕</button>
      </div>
      {!solSent && <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:8,marginBottom:20}}>
        {stepMeta.map(item => {
          const active = item.id === step;
          const done = item.id < step;
          return (
            <div key={item.id} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${active ? "var(--cy)" : "var(--bdr2)"}`,background:active ? "var(--cg)" : "var(--sur)"}}>
              <div style={{fontSize:10,color:done ? "var(--cy)" : "var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:4}}>Paso {item.id}</div>
              <div style={{fontSize:12,fontWeight:800,color:active ? "var(--wh)" : "var(--gr3)"}}>{item.label}</div>
            </div>
          );
        })}
      </div>}
      {solSent
        ?<div style={{textAlign:"center",padding:20}}>
          <div style={{fontSize:40,marginBottom:12}}>✅</div>
          <div style={{fontFamily:"var(--fh)",fontSize:16,fontWeight:700,marginBottom:8}}>Activación registrada</div>
          <div style={{fontSize:13,color:"var(--gr2)",marginBottom:16}}>
            {releaseMode
              ? "Tu solicitud quedó registrada para revisión. El equipo de Produ validará la empresa, los addons y el checkout antes de activar la instancia."
              : "Tu empresa quedó registrada como activación guiada. El equipo de Produ revisará los datos y te contactará para cerrar el alta."}
          </div>
          <button onClick={onClose} style={{padding:"9px 24px",borderRadius:8,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:13,fontWeight:700}}>Cerrar</button>
        </div>
        :<div style={{display:"grid",gridTemplateColumns:"minmax(0,1.2fr) minmax(320px,.8fr)",gap:20}}>
          <div>
            {step === 1 && <>
              <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:6}}>Datos de empresa</div>
              <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Queremos entender bien tu operación antes de activarla.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Empresa / Productora *</div>
                <input value={solF.emp||""} onChange={e=>setField("emp", e.target.value)} placeholder="Play Media SpA" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>RUT</div>
                <input value={solF.rut||""} onChange={e=>setField("rut", e.target.value)} placeholder="77.118.348-2" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Email principal *</div>
                <input type="email" value={solF.ema||""} onChange={e=>setField("ema", e.target.value)} placeholder="hola@empresa.cl" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Teléfono *</div>
                <input value={solF.tel||""} onChange={e=>setField("tel", e.target.value)} placeholder="+56 9 1234 5678" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Tipo de cliente</div>
                <select value={solF.customerType||"productora"} onChange={e=>setField("customerType", e.target.value)} style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}>
                  <option value="productora">Productora</option>
                  <option value="creador">Creador independiente</option>
                  <option value="agencia">Agencia</option>
                  <option value="estudio">Estudio</option>
                </select></div>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Tamaño de equipo</div>
                <select value={solF.teamSize||"1-3"} onChange={e=>setField("teamSize", e.target.value)} style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}>
                  <option value="1-3">1-3 personas</option>
                  <option value="4-10">4-10 personas</option>
                  <option value="11-25">11-25 personas</option>
                  <option value="25+">25+ personas</option>
                </select></div>
              </div>
              <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Dirección</div>
              <input value={solF.dir||""} onChange={e=>setField("dir", e.target.value)} placeholder="Providencia 1250, Santiago" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
            </>}
            {step === 2 && <>
              <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:6}}>Primer administrador</div>
              <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Definimos el responsable inicial de la empresa dentro de Produ.</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Nombre *</div>
                <input value={solF.nom||""} onChange={e=>setField("nom", e.target.value)} placeholder="Juan" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Apellido *</div>
                <input value={solF.adminLastName||""} onChange={e=>setField("adminLastName", e.target.value)} placeholder="Pérez" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Email del admin *</div>
                <input type="email" value={solF.adminEmail||solF.ema||""} onChange={e=>setField("adminEmail", e.target.value)} placeholder="admin@empresa.cl" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Teléfono</div>
                <input value={solF.adminPhone||solF.tel||""} onChange={e=>setField("adminPhone", e.target.value)} placeholder="+56 9 1234 5678" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Cargo</div>
                <input value={solF.adminRole||""} onChange={e=>setField("adminRole", e.target.value)} placeholder="Gerente general" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Rol inicial</div>
                <select value={solF.rol||"admin"} onChange={e=>setField("rol", e.target.value)} style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}>
                  <option value="admin">Administrador</option>
                  <option value="productor">Productor</option>
                  <option value="comercial">Comercial</option>
                </select></div>
              </div>
            </>}
            {step === 3 && <>
              <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:6}}>Addons para tu operación</div>
              <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>La base de Produ siempre está incluida. Aquí eliges los addons que necesitas hoy.</div>
              <div style={{padding:16,borderRadius:16,border:"1px solid var(--cm)",background:"var(--cg)",marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:4}}>Base obligatoria</div>
                    <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800}}>{baseProduct.label}</div>
                  </div>
                  <div style={{fontSize:16,fontWeight:800,color:"var(--cy)"}}>{pricingSnapshot.base.monthlyUF} {SELF_SERVE_PRICE_UNIT}</div>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                  {baseProduct.includes.map(item => <Badge key={item.code} label={item.label} color="cyan" sm />)}
                </div>
              </div>
              <div style={{display:"grid",gap:14}}>
                {groupedModules.map(group => (
                  <div key={group.code}>
                    <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:8}}>{group.label}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
                      {group.items.map(item => {
                        const active = selectedModules.includes(item.code);
                        return <button key={item.code} type="button" onClick={() => toggleModule(item.code)} style={{textAlign:"left",padding:14,borderRadius:16,border:`1px solid ${active ? "var(--cy)" : "var(--bdr2)"}`,background:active ? "var(--cg)" : "var(--sur)",cursor:"pointer"}}>
                          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start",marginBottom:8}}>
                            <div>
                              <div style={{fontSize:14,fontWeight:800,marginBottom:4}}>{item.label}</div>
                              <div style={{fontSize:11,color:"var(--gr2)"}}>{item.audience}</div>
                            </div>
                            <Badge label={item.badge} color={active ? "cyan" : "gray"} sm />
                          </div>
                          <div style={{fontSize:12,color:"var(--gr3)",lineHeight:1.6,marginBottom:10}}>{item.description}</div>
                          <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}>
                            <div style={{fontSize:13,fontWeight:800,color:"var(--cy)"}}>{item.monthlyUF} {SELF_SERVE_PRICE_UNIT}</div>
                            <div style={{fontSize:11,fontWeight:700,color:active ? "var(--cy)" : "var(--gr2)"}}>{active ? "Agregado" : "Agregar"}</div>
                          </div>
                        </button>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>}
            {step === 4 && <>
              <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:6}}>Confirmación</div>
              <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Revisa la empresa, el administrador y la configuración comercial antes del checkout.</div>
              <div style={{display:"grid",gap:12}}>
                <div style={{padding:14,borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
                  <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:8}}>Empresa</div>
                  <div style={{fontSize:14,fontWeight:800,marginBottom:6}}>{solF.emp || "Sin definir"}</div>
                  <div style={{fontSize:12,color:"var(--gr3)"}}>{solF.customerType || "productora"} · {solF.teamSize || "1-3"} personas</div>
                </div>
                <div style={{padding:14,borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
                  <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:8}}>Administrador inicial</div>
                  <div style={{fontSize:14,fontWeight:800,marginBottom:6}}>{`${solF.nom || ""} ${solF.adminLastName || ""}`.trim() || "Sin definir"}</div>
                  <div style={{fontSize:12,color:"var(--gr3)"}}>{solF.adminEmail || solF.ema || "Sin email"}{solF.adminRole ? ` · ${solF.adminRole}` : ""}</div>
                </div>
                <div style={{padding:14,borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
                  <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:8}}>Mensaje para Produ</div>
                  <textarea value={solF.msg||""} onChange={e=>setField("msg", e.target.value)} placeholder="Cuéntanos brevemente qué necesitas operar con Produ..." rows={4} style={{width:"100%",padding:"9px 12px",background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:10,color:"var(--wh)",fontSize:13,outline:"none",resize:"vertical",fontFamily:"inherit"}}/>
                </div>
              </div>
            </>}
            {step === 5 && <>
              <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:6}}>Checkout</div>
              <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>En esta fase dejamos registrada la activación y cómo quieres continuar el cierre comercial.</div>
              <div style={{padding:"12px 14px",borderRadius:14,border:"1px solid var(--cm)",background:"var(--cg)",marginBottom:14}}>
                <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:8}}>Estimación para checkout</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,fontSize:12}}>
                  <span>Total mensual en UF</span>
                  <strong>{commercialSummary.totalUF} {SELF_SERVE_PRICE_UNIT}</strong>
                  <span>Valor referencial UF</span>
                  <strong>{commercialSummary.ufValueClp.toLocaleString("es-CL")} CLP</strong>
                  <span>Total estimado a cobrar</span>
                  <strong style={{color:"var(--cy)"}}>{commercialSummary.totalClpFormatted}</strong>
                </div>
              </div>
              <div style={{display:"grid",gap:10,marginBottom:14}}>
                {[
                  ...(selfServeSettings.assistedOnly
                    ? [["contacto","Quiero activarlo con el equipo de Produ"]]
                    : [["contacto","Quiero que me contacte el equipo de Produ"], ["link_pago","Quiero recibir link de pago para activar"]]),
                ].map(([value,label]) => {
                  const active = effectiveCheckoutMethod === value;
                  return <button key={value} type="button" onClick={() => setField("checkoutMethod", value)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:14,borderRadius:14,border:`1px solid ${active ? "var(--cy)" : "var(--bdr2)"}`,background:active ? "var(--cg)" : "var(--sur)",cursor:"pointer",textAlign:"left"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,marginBottom:4}}>{label}</div>
                    <div style={{fontSize:11,color:"var(--gr2)"}}>
                        {value === "contacto" ? "Registro inmediato y seguimiento comercial." : "Dejamos todo listo para cobro y activación."}
                      </div>
                    </div>
                    <Badge label={active ? "Elegido" : "Seleccionar"} color={active ? "cyan" : "gray"} sm />
                  </button>;
                })}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                <div><div style={{fontSize:11,fontWeight:700,color:"var(--gr2)",marginBottom:4}}>Código de referido</div>
                <input value={solF.referralCode||""} onChange={e=>setField("referralCode", e.target.value.toUpperCase())} placeholder="PLAYMEDIASPA" style={{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontSize:13,outline:"none"}}/></div>
                  <div style={{display:"flex",alignItems:"end",fontSize:12,color:"var(--gr2)"}}>{selfServeSettings.assistedOnly ? "Hoy el cierre queda asistido por el equipo de Produ." : "La activación inicial puede continuar por checkout o por seguimiento asistido."}</div>
              </div>
            </>}
            <div style={{display:"flex",justifyContent:"space-between",gap:12,marginTop:18}}>
              <GBtn onClick={step === 1 ? onClose : prevStep}>{step === 1 ? "Cancelar" : "Volver"}</GBtn>
              {step < 5
                ? <Btn onClick={nextStep}>Continuar</Btn>
                : <Btn onClick={saveAcquisitionDraft}>Registrar activación</Btn>}
            </div>
          </div>
          <div style={{padding:18,borderRadius:18,border:"1px solid var(--bdr2)",background:"linear-gradient(145deg,color-mix(in srgb,var(--cy) 8%, var(--card)),var(--card))",alignSelf:"start",position:"sticky",top:0}}>
            <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Resumen comercial</div>
            <div style={{paddingBottom:14,borderBottom:"1px solid var(--bdr2)",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:10,marginBottom:6}}>
                <div>
                  <div style={{fontSize:14,fontWeight:800}}>{baseProduct.label}</div>
                  <div style={{fontSize:11,color:"var(--gr2)"}}>Incluye dashboard, calendario, clientes y proyectos</div>
                </div>
                <div style={{fontSize:14,fontWeight:800,color:"var(--cy)"}}>
                  {pricingSnapshot.base.promoMonthlyUF === 0 && pricingSnapshot.base.promoMonths > 0
                    ? `$0 por ${pricingSnapshot.base.promoMonths} meses`
                    : `${baseProduct.monthlyUF} UF`}
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {baseProduct.includes.map(item => <Badge key={item.code} label={item.label} color="gray" sm />)}
              </div>
            </div>
            <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.2,marginBottom:8}}>Addons elegidos</div>
            <div style={{display:"grid",gap:8,marginBottom:14}}>
              {pricingSnapshot.addons.length
                ? pricingSnapshot.addons.map(item => (
                    <div key={item.code} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12}}>
                      <span>{item.label}</span>
                      <strong>{item.monthlyUF} UF</strong>
                    </div>
                  ))
                : <div style={{fontSize:12,color:"var(--gr2)"}}>Todavía no agregas addons. Puedes partir solo con la base.</div>}
            </div>
            {!!recommendations.length && step === 3 && <div style={{padding:"12px 14px",borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)",marginBottom:14}}>
              <div style={{fontSize:11,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.1,marginBottom:8}}>Recomendados</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {recommendations.map(item => <button key={item.code} type="button" onClick={() => toggleModule(item.code)} style={{padding:"7px 10px",borderRadius:999,border:"1px solid var(--cm)",background:"var(--cg)",color:"var(--cy)",fontSize:11,fontWeight:700,cursor:"pointer"}}>{item.label}</button>)}
              </div>
            </div>}
            <div style={{paddingTop:14,borderTop:"1px solid var(--bdr2)",display:"grid",gap:8}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--gr2)"}}><span>Base</span><span>{pricingSnapshot.base.monthlyUF} UF</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--gr2)"}}><span>Addons</span><span>{pricingSnapshot.addonSubtotalUF} UF</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:16,fontWeight:800}}><span>Total estimado</span><span style={{color:"var(--cy)"}}>{pricingSnapshot.totalUF} {SELF_SERVE_PRICE_UNIT}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"var(--gr2)"}}><span>Equivalente referencial</span><span>{commercialSummary.totalClpFormatted}</span></div>
            </div>
          </div>
        </div>}
    </div>
  </div>;
}
