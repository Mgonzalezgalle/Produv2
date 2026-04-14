import { useEffect, useState } from "react";
import { Badge, Btn, Card, DBtn, Empty, FG, FI, FSl, FilterSel, GBtn, KV, MultiSelect, R2, R3, SearchBar, Stat, TD, TH, ViewModeToggle } from "../../lib/ui/components";
import { buildTenantHealth, getRemoteBsaleSnapshot, getRemoteProvisionedModules } from "./towerControlHealth";
import { TenantHealthBadgeRow } from "./TowerControlHealthViews";
import { SolicitudesPanel } from "./TowerControlRequestsPanel";
import { SystemUsersPanel } from "./TowerControlUsersPanel";
import { ComunicacionesAdminPanel } from "./TowerControlCommunicationsPanel";
import { ImpresosAdminPanel } from "./TowerControlPrintsPanel";
import { IntegracionesAdminPanel } from "./TowerControlIntegrationsPanel";

export { ComunicacionesAdminPanel, ImpresosAdminPanel, IntegracionesAdminPanel, SolicitudesPanel, SystemUsersPanel };

const sidePanelBackdropStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(8,12,18,.32)",
  backdropFilter: "blur(2px)",
  zIndex: 70,
};
const sidePanelCardStyle = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "min(920px, calc(100vw - 36px))",
  maxHeight: "calc(100vh - 72px)",
  overflow: "auto",
  zIndex: 71,
  borderRadius: 22,
  boxShadow: "0 24px 60px rgba(0,0,0,.26)",
};

export function EmpresasAdminPanel({
  totalEmp,
  activeEmp,
  totalUsers,
  q,
  setQ,
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
  users = [],
  platformServices,
  releaseMode = false,
}) {
  const [vista, setVista] = useState("cards");
  const [remoteSnapshots, setRemoteSnapshots] = useState({});
  useEffect(() => {
    if (!platformServices?.getTenantPlatformSnapshot || !filteredEmp.length) {
      setRemoteSnapshots({});
      return;
    }
    let cancelled = false;
    Promise.all(filteredEmp.slice(0, 12).map(async emp => {
      try {
        const snapshot = await platformServices.getTenantPlatformSnapshot(emp.id);
        return [emp.id, snapshot || {}];
      } catch {
        return [emp.id, null];
      }
    })).then(entries => {
      if (cancelled) return;
      setRemoteSnapshots(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [filteredEmp, platformServices]);
  const healthByTenant = Object.fromEntries(
    filteredEmp.map(emp => [emp.id, buildTenantHealth(emp, users, remoteSnapshots[emp.id] || {})]),
  );
  const foundationReadyCount = filteredEmp.filter(emp => healthByTenant[emp.id]?.foundationReady).length;
  const identityAlignedCount = filteredEmp.filter(emp => healthByTenant[emp.id]?.identityAligned).length;
  const tributaryProvisionedCount = filteredEmp.filter(emp => {
    const mode = healthByTenant[emp.id]?.remoteBsale?.governanceMode;
    return mode === "sandbox" || mode === "production";
  }).length;
  const statCards = [
    { label: "Empresas", value: totalEmp, accent: "var(--cy)" },
    { label: "Activas", value: activeEmp, accent: "#4ade80" },
    { label: "Usuarios", value: totalUsers, accent: "var(--wh)" },
    { label: "Foundation OK", value: foundationReadyCount, accent: "#60a5fa" },
    { label: "Identidad alineada", value: identityAlignedCount, accent: "#f59e0b" },
    { label: "Tributario provisionado", value: tributaryProvisionedCount, accent: "#a855f7" },
  ];
  return <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
      {statCards.map(card => <div key={card.label} style={{ background: "linear-gradient(180deg,var(--sur),rgba(255,255,255,.015))", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>{card.label}</div>
          <span style={{width:7,height:7,borderRadius:999,background:card.accent,opacity:.9}} />
        </div>
        <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 800, color: card.accent }}>{card.value}</div>
      </div>)}
    </div>
    <div style={{ background:"var(--card2)", border:"1px solid var(--bdr2)", borderRadius:16, padding:"12px 12px 10px", marginBottom:14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={setQ} placeholder="Buscar tenant por nombre o RUT..." />
        <FilterSel value={stateF} onChange={setStateF} options={["Activa", "Inactiva"]} placeholder="Todos los estados" />
        <ViewModeToggle value={vista} onChange={setVista} />
      </div>
    </div>
    {vista === "cards" ? <div style={{ marginBottom: 14, display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:16 }}>
      {filteredEmp.map(emp => {
        const visibleAddons = (emp.addons || []).slice(0, 3);
        const extraAddons = Math.max(0, (emp.addons || []).length - visibleAddons.length);
        const tenantHealth = healthByTenant[emp.id] || buildTenantHealth(emp, users, remoteSnapshots[emp.id] || {});
        return <div key={emp.id} style={{ background:"var(--card)", border:"1px solid var(--bdr)", borderRadius:14, padding:20, display:"grid", gap:12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${emp.color}24`, border: `1px solid ${emp.color}80`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--fh)", fontSize: 15, fontWeight: 800, color: emp.color, overflow: "hidden" }}>
            {emp.logo ? <img src={emp.logo} style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 10 }} alt={emp.nombre} /> : ini(emp.nombre)}
          </div>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{emp.nombre}</div>
              <Badge label={emp.active ? "Activa" : "Inactiva"} color={emp.active ? "green" : "red"} sm />
            </div>
            <div style={{ fontSize:11, color:"var(--gr2)", lineHeight:1.6 }}>{emp.rut || "Sin RUT"} · {emp.tenantCode || "Sin tenant"}</div>
            <div style={{ fontSize:11, color:"var(--gr2)", marginTop:4 }}>{emp.ema || "Sin correo"}</div>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {visibleAddons.length ? visibleAddons.map(a => <Badge key={a} label={addons[a]?.label || a} color="gray" sm />) : <span style={{ fontSize:10, color:"var(--gr2)" }}>Sin módulos</span>}
            {extraAddons > 0 && <Badge label={`+${extraAddons} más`} color="gray" sm />}
          </div>
          <TenantHealthBadgeRow health={tenantHealth} />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:12, borderTop:"1px solid var(--bdr)" }}>
            <span style={{ fontSize:11, color:"var(--cy)" }}>Tenant activo</span>
            <div style={{ display:"flex", gap:8 }}>
              <GBtn sm onClick={() => { setEid(emp.id); setEf({ ...emp }); }}>Editar</GBtn>
              <GBtn sm onClick={() => onSave("empresas", empresas.map(e => e.id === emp.id ? { ...e, active: !e.active } : e))}>{emp.active ? "Desactivar" : "Activar"}</GBtn>
              {!releaseMode && emp.active === false && <DBtn sm onClick={() => onDeleteEmpresa && onDeleteEmpresa(emp)}>Eliminar</DBtn>}
            </div>
          </div>
        </div>;
      })}
      {!filteredEmp.length && <Empty text="Sin empresas para este filtro" />}
    </div> : <Card>
      <div style={{ overflowX:"auto" }}>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              <TH>Nombre</TH>
              <TH>RUT</TH>
              <TH>Estado</TH>
              <TH>Email</TH>
              <TH>Tenant</TH>
              <TH>Módulos</TH>
              <TH></TH>
            </tr>
          </thead>
          <tbody>
            {filteredEmp.map(emp => (
              <tr key={emp.id}>
                <TD bold>{emp.nombre}</TD>
                <TD>{emp.rut || "—"}</TD>
                <TD><Badge label={emp.active ? "Activa" : "Inactiva"} color={emp.active ? "green" : "red"} sm /></TD>
                <TD style={{ fontSize:11 }}>{emp.ema || "—"}</TD>
                <TD>{emp.tenantCode || "—"}</TD>
                <TD style={{ fontSize:11 }}>{(emp.addons || []).length}</TD>
                <TD>
                  <div style={{display:"flex",justifyContent:"flex-end",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <TenantHealthBadgeRow health={buildTenantHealth(emp, users, remoteSnapshots[emp.id] || {})} compact />
                    <GBtn sm onClick={() => { setEid(emp.id); setEf({ ...emp }); }}>Editar</GBtn>
                    <GBtn sm onClick={() => onSave("empresas", empresas.map(e => e.id === emp.id ? { ...e, active: !e.active } : e))}>{emp.active ? "Desactivar" : "Activar"}</GBtn>
                    {!releaseMode && emp.active === false && <DBtn sm onClick={() => onDeleteEmpresa && onDeleteEmpresa(emp)}>Eliminar</DBtn>}
                  </div>
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!filteredEmp.length && <Empty text="Sin empresas para este filtro" />}
    </Card>}
    <div style={{ background: "var(--card2)", border: "1px solid var(--bdr2)", borderRadius: 16, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700, marginBottom:4 }}>{eid ? "Editar tenant" : "Provisionar tenant"}</div>
          <div style={{ fontSize:11, color:"var(--gr2)" }}>{eid ? "Ajusta identidad base y módulos provisionados de esta instancia." : "Crea una nueva empresa SaaS y define su configuración inicial."}</div>
        </div>
        {eid && <span style={{ fontSize: 11, color: "var(--gr2)" }}>Tenant ID: {(empresas.find(e => e.id === eid)?.tenantCode) || "—"} · ID instancia: {eid}</span>}
      </div>
      <R2><FG label="Nombre *"><FI value={ef.nombre || ""} onChange={e => setEf(p => ({ ...p, nombre: e.target.value }))} placeholder="Play Media SpA" /></FG><FG label="RUT"><FI value={ef.rut || ""} onChange={e => setEf(p => ({ ...p, rut: e.target.value }))} placeholder="78.118.348-2" /></FG></R2>
      <FG label="Email"><FI value={ef.ema || ""} onChange={e => setEf(p => ({ ...p, ema: e.target.value }))} placeholder="contacto@empresa.cl" /></FG>
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
  ini,
  users = [],
  platformServices,
}) {
  const [vista, setVista] = useState("cards");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedPortfolioIds, setSelectedPortfolioIds] = useState([]);
  const [detailSnapshot, setDetailSnapshot] = useState(null);
  const [detailSnapshotLoading, setDetailSnapshotLoading] = useState(false);
  const openDetail = empId => {
    setPortfolioEmpId(empId);
    setDetailOpen(true);
  };
  const togglePortfolioSelection = empId => {
    setSelectedPortfolioIds(prev => prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]);
  };
  const toggleAllPortfolioSelection = () => {
    const visibleIds = filteredPortfolio.map(emp => emp.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedPortfolioIds.includes(id));
    setSelectedPortfolioIds(allSelected ? selectedPortfolioIds.filter(id => !visibleIds.includes(id)) : [...new Set([...selectedPortfolioIds, ...visibleIds])]);
  };
  const updateSelectedPortfolioStatus = nextStatus => {
    const targets = filteredPortfolio.filter(emp => selectedPortfolioIds.includes(emp.id));
    targets.forEach(emp => savePortfolio(emp.id, { billingStatus: nextStatus }));
  };
  const allVisibleSelected = filteredPortfolio.length > 0 && filteredPortfolio.every(emp => selectedPortfolioIds.includes(emp.id));
  useEffect(() => {
    if (!detailOpen || !selectedPortfolioEmp?.id || !platformServices?.getTenantPlatformSnapshot) {
      setDetailSnapshot(null);
      return;
    }
    let cancelled = false;
    setDetailSnapshotLoading(true);
    Promise.resolve(platformServices.getTenantPlatformSnapshot(selectedPortfolioEmp.id))
      .then(snapshot => {
        if (!cancelled) setDetailSnapshot(snapshot || null);
      })
      .catch(() => {
        if (!cancelled) setDetailSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setDetailSnapshotLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [detailOpen, selectedPortfolioEmp?.id, platformServices]);
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
      <FilterSel value={portfolioStatus} onChange={setPortfolioStatus} options={["Al día", "Pendiente", "Vencido", "Mora", "Suspendido"]} placeholder="Todos los pagos" />
      <ViewModeToggle value={vista} onChange={setVista} />
      <GBtn sm onClick={() => exportActiveClientsCSV(activePortfolioClients)}>⬇ CSV activos</GBtn>
      <GBtn sm onClick={() => exportActiveClientsPDF(activePortfolioClients)}>⬇ PDF activos</GBtn>
    </div>
    {!!selectedPortfolioIds.length && <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:14, padding:"10px 12px", border:"1px solid var(--bdr2)", borderRadius:14, background:"var(--sur)" }}>
      <Badge label={`${selectedPortfolioIds.length} seleccionado${selectedPortfolioIds.length === 1 ? "" : "s"}`} color="cyan" sm />
      <FG label="Estado de pago masivo" style={{ margin:0, minWidth:220 }}>
        <FSl value="" onChange={e => { if (!e.target.value) return; updateSelectedPortfolioStatus(e.target.value); e.target.value = ""; }}>
          <option value="">Cambiar estado de pago…</option>
          <option value="Al día">Al día</option>
          <option value="Pendiente">Pendiente</option>
          <option value="Vencido">Vencido</option>
          <option value="Mora">Mora</option>
          <option value="Suspendido">Suspendido</option>
        </FSl>
      </FG>
      <GBtn sm onClick={() => setSelectedPortfolioIds([])}>Limpiar selección</GBtn>
    </div>}
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="Tenants en cartera" sub={`${filteredPortfolio.length} tenant${filteredPortfolio.length === 1 ? "" : "s"} visibles`} style={{ padding: 14 }}>
        {vista === "cards"
          ? <div style={{ display: "grid", gap: 10 }}>
              {filteredPortfolio.map(emp => {
                const isActive = selectedPortfolioEmp?.id === emp.id;
                const isSelected = selectedPortfolioIds.includes(emp.id);
                const status = companyBillingStatus(emp);
                const payColor = status === "Al día" ? "green" : status === "Pendiente" ? "yellow" : status === "Suspendido" ? "red" : "orange";
                return <button key={emp.id} onClick={() => openDetail(emp.id)} style={{ textAlign: "left", padding: "14px 14px", borderRadius: 16, border: `1px solid ${isActive ? "var(--cy)" : "var(--bdr2)"}`, background: isActive ? "var(--cg)" : "var(--sur)", cursor: "pointer", boxShadow: isActive ? "0 0 0 1px rgba(47,111,179,.08)" : "none" }}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <label style={{display:"flex",alignItems:"center",gap:8,fontSize:11,color:"var(--gr2)"}} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={isSelected} onChange={() => togglePortfolioSelection(emp.id)} />
                      Seleccionar
                    </label>
                  </div>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:12, minWidth:0 }}>
                    <div style={{ width:40, height:40, borderRadius:12, background:`${emp.color || "#2f6fb3"}18`, border:`1px solid ${(emp.color || "#2f6fb3")}66`, display:"flex", alignItems:"center", justifyContent:"center", color:emp.color || "#2f6fb3", fontWeight:800, fontSize:13, flexShrink:0, overflow:"hidden" }}>
                      {emp.logo ? <img src={emp.logo} alt={emp.nombre} style={{ width:40, height:40, objectFit:"contain", borderRadius:10 }} /> : ini(emp.nombre)}
                    </div>
                    <div style={{ minWidth:0, flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:4 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: isActive ? "var(--cy)" : "var(--wh)" }}>{emp.nombre}</div>
                        <Badge label={status} color={payColor} sm />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--gr2)", lineHeight: 1.55, marginBottom: 8 }}>{emp.tenantCode || "—"} · {emp.rut || "Sin RUT"}</div>
                      <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight:1.55, marginBottom: 10 }}>{emp.userCount} usuario{emp.userCount === 1 ? "" : "s"} · {fmtMoney(companyBillingNet(emp), emp.billingCurrency || "UF")}/mes{emp.referralDiscountMonthsPending > 0 ? ` · ${emp.referralDiscountMonthsPending} mes${emp.referralDiscountMonthsPending === 1 ? "" : "es"} gratis pendiente${emp.referralDiscountMonthsPending === 1 ? "" : "s"}` : ""}</div>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:10, borderTop:"1px solid var(--bdr)" }}>
                        <span style={{ fontSize:11, color:"var(--cy)" }}>Tenant en seguimiento</span>
                        <span style={{ fontSize:11, color:"var(--gr2)" }}>Ver detalle →</span>
                      </div>
                    </div>
                  </div>
                </button>;
              })}
            </div>
          : <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse" }}>
                <thead>
                  <tr>
                    <TH><label style={{display:"flex",alignItems:"center",justifyContent:"center"}}><input type="checkbox" checked={allVisibleSelected} onChange={toggleAllPortfolioSelection} /></label></TH>
                    <TH>Tenant</TH>
                    <TH>Estado</TH>
                    <TH>Usuarios</TH>
                    <TH>MRR</TH>
                    <TH></TH>
                  </tr>
                </thead>
                <tbody>
                  {filteredPortfolio.map(emp => {
                    const isActive = selectedPortfolioEmp?.id === emp.id;
                    const isSelected = selectedPortfolioIds.includes(emp.id);
                    const status = companyBillingStatus(emp);
                    const payColor = status === "Al día" ? "green" : status === "Pendiente" ? "yellow" : status === "Suspendido" ? "red" : "orange";
                    return <tr key={emp.id} onClick={() => openDetail(emp.id)} style={{ cursor:"pointer", background:isActive ? "var(--cg)" : "transparent" }}>
                      <TD onClick={e => e.stopPropagation()}><label style={{display:"flex",alignItems:"center",justifyContent:"center"}}><input type="checkbox" checked={isSelected} onChange={() => togglePortfolioSelection(emp.id)} /></label></TD>
                      <TD bold>{emp.nombre}</TD>
                      <TD><Badge label={status} color={payColor} sm /></TD>
                      <TD>{emp.userCount}</TD>
                      <TD mono>{fmtMoney(companyBillingNet(emp), emp.billingCurrency || "UF")}</TD>
                      <TD><GBtn sm onClick={e => { e.stopPropagation(); openDetail(emp.id); }}>Ver →</GBtn></TD>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>}
        {!filteredPortfolio.length && <Empty text="Sin empresas en cartera para este filtro" sub="Ajusta estado de pago o búsqueda." />}
      </Card>
      {detailOpen && selectedPortfolioEmp ? (() => {
        const emp = selectedPortfolioEmp;
        const net = companyBillingNet(emp);
        const baseNet = companyBillingBaseNet(emp);
        const pendingReferralMonths = companyReferralDiscountMonthsPending(emp);
        const status = companyBillingStatus(emp);
        const payColor = status === "Al día" ? "green" : status === "Pendiente" ? "yellow" : status === "Suspendido" ? "red" : "orange";
        const detailHealth = buildTenantHealth(emp, users, detailSnapshot || {});
        return <>
        <div style={sidePanelBackdropStyle} onClick={() => setDetailOpen(false)} />
        <Card key={emp.id} title={emp.nombre} sub={`${emp.tenantCode || "Sin Tenant ID"} · ${emp.userCount} usuario${emp.userCount === 1 ? "" : "s"} · ${emp.active !== false ? "Tenant activo" : "Tenant inactivo"}`} style={{ ...sidePanelCardStyle, padding: 18 }} onClick={e => e.stopPropagation?.()}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:14}}>
            <div style={{fontSize:11,color:"var(--gr2)"}}>Detalle de cartera</div>
            <GBtn sm onClick={() => setDetailOpen(false)}>Cerrar</GBtn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr", gap: 16 }}>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 }}>
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
              <div style={{ padding: 14, border: "1px solid var(--bdr2)", borderRadius: 16, background: "var(--sur)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Foundation / identidad</div>
                  {detailSnapshotLoading
                    ? <Badge label="Actualizando..." color="gray" sm />
                    : <Badge label={detailHealth.foundationReady ? "Foundation OK" : "Sin foundation"} color={detailHealth.foundationReady ? "green" : "gray"} sm />}
                </div>
                <div style={{ marginBottom:10 }}>
                  <TenantHealthBadgeRow health={detailHealth} />
                </div>
                <KV label="Usuarios locales / remotos" value={`${users.filter(user => user.empId === emp.id).length} / ${detailHealth.remoteUsers}`} />
                <KV label="Roles custom locales / remotos" value={`${Array.isArray(emp.customRoles) ? emp.customRoles.length : 0} / ${detailHealth.remoteRoles}`} />
                <KV label="Módulos remotos" value={detailHealth.remoteModules.length ? detailHealth.remoteModules.length : "—"} />
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
        </Card>
        </>;
      })() : null}
    </div>
  </div>;
}
