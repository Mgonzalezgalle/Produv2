import React from "react";
import { Badge, Card, Empty, Stat } from "../../lib/ui/components";
import { fmtD, hasAddon, invoiceEntityName, today } from "../../lib/utils/helpers";
import { getProduBillingFinancialMultiplier, requiresProduCollectionTracking } from "../../lib/integrations/billingDomain";

function daysUntil(date) {
  if (!date) return null;
  const now = new Date(`${today()}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  return Math.round((target - now) / 86400000);
}

export function ViewDashboard({
  empresa,
  user,
  clientes,
  producciones,
  programas,
  episodios,
  auspiciadores,
  movimientos,
  presupuestos,
  facturas,
  contratos,
  piezas,
  activos,
  alertas,
  navTo,
  canDo,
  useBal,
  fmtM,
}) {
  const empId = empresa?.id;
  const bal = useBal(movimientos, empId);
  const mvs = (movimientos || []).filter(m => m.empId === empId);
  const ti = mvs.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.mon), 0);
  const tg = mvs.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.mon), 0);
  const clis = (clientes || []).filter(x => x.empId === empId);
  const pros = (producciones || []).filter(x => x.empId === empId);
  const pgs = (programas || []).filter(x => x.empId === empId);
  const eps = (episodios || []).filter(x => x.empId === empId);
  const cts = (contratos || []).filter(x => x.empId === empId);
  const campaigns = (piezas || []).filter(x => x.empId === empId);
  const pres = (presupuestos || []).filter(x => x.empId === empId);
  const facts = (facturas || []).filter(x => x.empId === empId);
  const cobrableFacts = facts.filter(f => requiresProduCollectionTracking(f.documentTypeCode || f.tipoDocumento || f.tipoDoc));
  const canContracts = hasAddon(empresa, "contratos");
  const canBudgets = hasAddon(empresa, "presupuestos") && canDo?.("presupuestos");
  const canInvoices = hasAddon(empresa, "facturacion") && canDo?.("facturacion");
  const canSocial = hasAddon(empresa, "social");
  const overdueFacts = cobrableFacts.filter(f => f.estado !== "Pagada" && f.fechaVencimiento && String(f.fechaVencimiento) < today());
  const payableSoon = cobrableFacts.filter(f => f.estado !== "Pagada" && f.fechaVencimiento && daysUntil(f.fechaVencimiento) != null && daysUntil(f.fechaVencimiento) >= 0 && daysUntil(f.fechaVencimiento) <= 7);
  const contractsExpiring = cts.filter(ct => daysUntil(ct.vig) != null && daysUntil(ct.vig) >= 0 && daysUntil(ct.vig) <= 30);
  const acceptedBudgets = pres.filter(p => p.estado === "Aceptado");
  const recurringBudgets = pres.filter(p => p.recurring);
  const activeCampaigns = campaigns.filter(c => c.est === "Activa" || c.est === "Planificada");
  const pendingEpisodes = eps.filter(e => ["Planificado", "En Edición", "Programado"].includes(e.estado));
  const activeProductions = pgs.filter(p => p.est === "Activo");
  const urgentAlerts = (alertas || []).slice(0, 4);
  const totalAccepted = acceptedBudgets.reduce((s, p) => s + Number(p.total || 0), 0);
  const dashboardStatus = overdueFacts.length
    ? `${overdueFacts.length} documento${overdueFacts.length !== 1 ? "s" : ""} vencido${overdueFacts.length !== 1 ? "s" : ""}`
    : urgentAlerts.length
      ? `${urgentAlerts.length} alerta${urgentAlerts.length !== 1 ? "s" : ""} prioritaria${urgentAlerts.length !== 1 ? "s" : ""}`
      : activeProductions.length
        ? `${activeProductions.length} producci${activeProductions.length !== 1 ? "ones" : "ón"} activa${activeProductions.length !== 1 ? "s" : ""}`
        : "Operación estable";
  const commercialPulse = [
    canBudgets ? `${acceptedBudgets.length} presupuestos aceptados` : null,
    canInvoices ? `${overdueFacts.length} documentos vencidos` : null,
    canContracts ? `${contractsExpiring.length} contratos por vencer` : null,
  ].filter(Boolean);
  const overviewStats = [
    { label: "Proyectos", value: pros.length, sub: `${pros.filter(p => p.est === "En Curso").length} en curso`, accent: "var(--cy)", vc: "var(--cy)" },
    { label: "Producciones", value: pgs.length, sub: `${pendingEpisodes.length} episodios pendientes`, accent: "#60a5fa", vc: "#60a5fa" },
    canSocial
      ? { label: "Campañas", value: activeCampaigns.length, sub: `${campaigns.length} piezas registradas`, accent: "#00e08a", vc: "#00e08a" }
      : { label: "Clientes", value: clis.length, sub: "cartera activa", accent: "#00e08a", vc: "#00e08a" },
    canInvoices
      ? { label: "Cobranza", value: overdueFacts.length, sub: overdueFacts.length ? `${fmtM(overdueFacts.reduce((s, f) => s + (Number(f.total || 0) * getProduBillingFinancialMultiplier(f.documentTypeCode || f.tipoDocumento || f.tipoDoc)), 0))} vencido` : "Sin vencidos", accent: overdueFacts.length ? "#ff5566" : "#ffcc44", vc: overdueFacts.length ? "#ff5566" : "#ffcc44" }
      : { label: "Balance", value: fmtM(ti - tg), sub: ti - tg >= 0 ? "resultado positivo" : "requiere atención", accent: ti - tg >= 0 ? "#00e08a" : "#ff5566", vc: ti - tg >= 0 ? "#00e08a" : "#ff5566" },
  ];
  const focusItems = [
    ...urgentAlerts.map(a => ({
      id: `alert-${a.id}`,
      title: a.titulo.replace(/^[^:]+:\s/, ""),
      sub: `${a.sub} · ${fmtD(a.fecha)}`,
      badge: a.diff === 0 ? "Hoy" : a.diff === 1 ? "Mañana" : `${a.diff} días`,
      tone: a.tipo === "urgente" ? "red" : a.tipo === "pronto" ? "yellow" : "cyan",
    })),
    ...payableSoon.slice(0, 2).map(f => ({
      id: `fact-${f.id}`,
      title: `Cobranza próxima · ${f.correlativo || "Sin correlativo"}`,
      sub: `${invoiceEntityName(f, clientes, auspiciadores)} · vence ${fmtD(f.fechaVencimiento)}`,
      badge: fmtM(f.total || 0),
      tone: "yellow",
    })),
  ].slice(0, 5);
  const operationItems = [
    ...activeProductions.slice(0, 2).map(pg => ({
      id: `pg-${pg.id}`,
      title: pg.nom,
      sub: `${pg.tip} · ${eps.filter(e => e.pgId === pg.id && e.estado === "Publicado").length}/${eps.filter(e => e.pgId === pg.id).length} ep. publicados`,
      badge: pg.est || "Activo",
      target: ["pg-det", pg.id],
    })),
    ...pendingEpisodes.slice(0, 3).map(ep => ({
      id: `ep-${ep.id}`,
      title: `Ep. ${ep.num}: ${ep.titulo}`,
      sub: `${pgs.find(x => x.id === ep.pgId)?.nom || "Producción"}${ep.fechaGrab ? ` · ${fmtD(ep.fechaGrab)}` : ""}`,
      badge: ep.estado,
      target: ["ep-det", ep.id],
    })),
    ...activeCampaigns.slice(0, 2).map(c => ({
      id: `camp-${c.id}`,
      title: c.nom,
      sub: `${clis.find(cli => cli.id === c.cliId)?.nom || "Sin cliente"} · ${c.mes} ${c.anio}`,
      badge: c.est || "Activa",
      target: ["cnt-det", c.id],
    })),
  ].slice(0, 5);
  const radarItems = [
    { label: "Ingresos", value: fmtM(ti), sub: "registrados" },
    { label: "Gastos", value: fmtM(tg), sub: "egresos" },
    canBudgets ? { label: "Aceptado", value: fmtM(totalAccepted), sub: "en presupuestos" } : null,
    canSocial ? { label: "Campañas activas", value: String(activeCampaigns.length), sub: "en contenidos" } : null,
    empresa.addons?.includes("activos") ? { label: "Activos", value: String((activos || []).filter(a => a.empId === empId).length), sub: "registrados" } : null,
  ].filter(Boolean).slice(0, 4);
  const quickActions = [
    { show: true, label: "Clientes", sub: `${clis.length} activos`, fn: () => navTo("clientes") },
    { show: true, label: "Proyectos", sub: `${pros.filter(p => p.est === "En Curso").length} en curso`, fn: () => navTo("producciones") },
    { show: true, label: "Producciones", sub: `${activeProductions.length} activas`, fn: () => navTo("programas") },
    { show: canSocial, label: "Contenidos", sub: `${activeCampaigns.length} campañas`, fn: () => navTo("contenidos") },
    { show: canBudgets, label: "Presupuestos", sub: `${acceptedBudgets.length} aceptados`, fn: () => navTo("presupuestos") },
    { show: canInvoices, label: "Facturación", sub: `${overdueFacts.length} vencidas`, fn: () => navTo("facturacion") },
  ].filter(x => x.show);
  const summaryLabelStyle = { fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.8 };
  const summaryValueStyle = { fontFamily: "var(--fb)", fontSize: 28, fontWeight: 700, letterSpacing: -0.02, color: "var(--wh)", lineHeight: 1.05 };
  const summaryTextStyle = { fontFamily: "var(--fb)", fontSize: 18, fontWeight: 700, letterSpacing: -0.01, color: "var(--wh)", lineHeight: 1.15 };

  return <div style={{ width: "100%", minWidth: 0 }}>
    <div style={{ padding: "18px 20px", border: "1px solid var(--bdr2)", borderRadius: 20, background: "linear-gradient(180deg,var(--cg),transparent 68%)", marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Resumen operativo</div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800, color: "var(--wh)", marginBottom: 6 }}>Hola, {user?.name}</div>
          <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, maxWidth: 720 }}>Aquí tienes una vista corta de lo importante en {empresa?.nombre}: qué está activo, qué requiere atención y a dónde conviene entrar primero.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, minWidth: 0, flex: "1 1 320px", width: "100%", maxWidth: 520 }}>
          <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={summaryLabelStyle}>Estado</div>
            <div style={{ ...summaryTextStyle, marginTop: 14 }}>{dashboardStatus}</div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={summaryLabelStyle}>Balance</div>
            <div style={{ ...summaryValueStyle, marginTop: 10, color: ti - tg >= 0 ? "#00e08a" : "#ff5566" }}>{fmtM(ti - tg)}</div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={summaryLabelStyle}>Clientes</div>
            <div style={{ ...summaryValueStyle, marginTop: 10, color: "var(--cy)" }}>{clis.length}</div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={summaryLabelStyle}>Comercial</div>
            <div style={{ ...summaryTextStyle, marginTop: 14 }}>{commercialPulse[0] || "Sin alertas comerciales"}</div>
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
        {quickActions.map(action => <button key={action.label} onClick={action.fn} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)", cursor: "pointer" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{action.label}</div>
          <div style={{ fontSize: 11, color: "var(--gr2)" }}>{action.sub}</div>
        </button>)}
      </div>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 18 }}>
      {overviewStats.map(stat => <Stat key={stat.label} {...stat} />)}
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 16 }}>
      <Card title="Agenda prioritaria" sub={urgentAlerts.length ? `${urgentAlerts.length} hitos cercanos` : "Sin urgencias por ahora"}>
        {focusItems.length ? focusItems.map(item => {
          const colores = { red: "#ff5566", yellow: "#ffcc44", cyan: "var(--cy)" };
          return <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: colores[item.tone], flexShrink: 0, boxShadow: `0 0 8px ${colores[item.tone]}` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)" }}>{item.sub}</div>
            </div>
            <Badge label={item.badge} color={item.tone} sm />
          </div>;
        }) : <Empty text="No tienes alertas prioritarias" sub="El calendario operativo y comercial está al día." />}
      </Card>
      <Card title="Operación en foco" sub="Lo siguiente que conviene revisar">
        {operationItems.length ? operationItems.map(item => <div key={item.id} onClick={() => navTo(item.target[0], item.target[1])} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--bdr)", cursor: "pointer" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</div>
            <div style={{ fontSize: 11, color: "var(--gr2)" }}>{item.sub}</div>
          </div>
          <Badge label={item.badge} sm />
        </div>) : <Empty text="Sin operación en curso" sub="Crea un proyecto, producción o campaña para empezar." />}
      </Card>
    </div>

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
      <Card title="Radar rápido" action={{ label: "Abrir clientes →", fn: () => navTo("clientes") }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          {radarItems.map(item => <div key={item.label} style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{item.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "var(--gr2)" }}>{item.sub}</div>
          </div>)}
        </div>
      </Card>
      <Card title="Resumen comercial" sub="Solo lo importante del ciclo de negocio">
        <div style={{ display: "grid", gap: 10 }}>
          {canBudgets && <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Presupuestos</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{acceptedBudgets.length} aceptados</div>
            <div style={{ fontSize: 11, color: "var(--gr2)" }}>Total aceptado: {fmtM(totalAccepted)}{recurringBudgets.length ? ` · ${recurringBudgets.length} recurrentes` : ""}</div>
          </div>}
          {canInvoices && <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Facturación</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{facts.length} documentos</div>
            <div style={{ fontSize: 11, color: "var(--gr2)" }}>{overdueFacts.length ? `${overdueFacts.length} vencidos` : "Sin vencidos"}{payableSoon.length ? ` · ${payableSoon.length} próximos a vencer` : ""}</div>
          </div>}
          {canContracts && <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}>
            <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Contratos</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{cts.length} registrados</div>
            <div style={{ fontSize: 11, color: "var(--gr2)" }}>{contractsExpiring.length ? `${contractsExpiring.length} por vencer en 30 días` : `Sin alertas próximas`}</div>
          </div>}
          {!canBudgets && !canInvoices && !canContracts && <Empty text="Sin módulos comerciales activos" sub="Activa presupuestos, facturación o contratos para ver este resumen." />}
        </div>
      </Card>
    </div>
  </div>;
}
