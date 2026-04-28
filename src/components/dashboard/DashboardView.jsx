import React from "react";
import { Badge, Card, Empty, Stat } from "../../lib/ui/components";
import { cobranzaState, contractVisualState, fmtD, hasAddon, invoiceEntityName, today } from "../../lib/utils/helpers";
import { getProduBillingFinancialMultiplier, requiresProduCollectionTracking } from "../../lib/integrations/billingDomain";

function daysUntil(date) {
  if (!date) return null;
  const now = new Date(`${today()}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  return Math.round((target - now) / 86400000);
}

function sumItems(items = [], resolver = item => item) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => sum + Number(resolver(item) || 0), 0);
}

function sectionCardStyle() {
  return { padding: "14px 16px", borderRadius: 16, border: "1px solid var(--bdr2)", background: "var(--sur)" };
}

function statusTone(type = "") {
  if (type === "critical") return { color: "#ff5566", badge: "red" };
  if (type === "warning") return { color: "#ffcc44", badge: "yellow" };
  if (type === "positive") return { color: "#00e08a", badge: "green" };
  return { color: "var(--cy)", badge: "cyan" };
}

function amountToCollect(doc = {}) {
  const multiplier = getProduBillingFinancialMultiplier(doc.documentTypeCode || doc.tipoDocumento || doc.tipoDoc);
  const base = Number(doc.pending ?? doc.saldoPendiente ?? doc.montoPendiente ?? doc.total ?? 0);
  return Math.max(0, base * multiplier);
}

function renderActionCard(action) {
  return (
    <button
      key={action.label}
      onClick={action.fn}
      style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)", cursor: "pointer" }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{action.label}</div>
      <div style={{ fontSize: 11, color: "var(--gr2)" }}>{action.sub}</div>
    </button>
  );
}

function renderQueueItem(item, navTo) {
  const tone = statusTone(item.tone);
  const clickable = Array.isArray(item.target);
  const content = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: tone.color, flexShrink: 0, boxShadow: `0 0 8px ${tone.color}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wh)" }}>{item.title}</div>
        <div style={{ fontSize: 11, color: "var(--gr2)" }}>{item.sub}</div>
      </div>
      {item.badge ? <Badge label={item.badge} color={tone.badge} sm /> : null}
    </div>
  );
  if (!clickable) return <div key={item.id}>{content}</div>;
  return (
    <button
      key={item.id}
      type="button"
      onClick={() => navTo(item.target[0], item.target[1])}
      style={{ width: "100%", border: "none", background: "transparent", padding: 0, margin: 0, textAlign: "left", cursor: "pointer" }}
    >
      {content}
    </button>
  );
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
  useBal(movimientos, empId);

  const mvs = (movimientos || []).filter(item => item.empId === empId);
  const ingresos = mvs.filter(item => item.tipo === "ingreso");
  const gastos = mvs.filter(item => item.tipo === "gasto");
  const ti = sumItems(ingresos, item => item.mon);
  const tg = sumItems(gastos, item => item.mon);
  const balance = ti - tg;

  const clis = (clientes || []).filter(item => item.empId === empId);
  const pros = (producciones || []).filter(item => item.empId === empId);
  const pgs = (programas || []).filter(item => item.empId === empId);
  const eps = (episodios || []).filter(item => item.empId === empId);
  const cts = (contratos || []).filter(item => item.empId === empId);
  const campaigns = (piezas || []).filter(item => item.empId === empId);
  const pres = (presupuestos || []).filter(item => item.empId === empId);
  const facts = (facturas || []).filter(item => item.empId === empId);
  const activeAssets = (activos || []).filter(item => item.empId === empId);

  const canContracts = hasAddon(empresa, "contratos");
  const canBudgets = hasAddon(empresa, "presupuestos") && canDo?.("presupuestos");
  const canInvoices = hasAddon(empresa, "facturacion") && canDo?.("facturacion");
  const canSocial = hasAddon(empresa, "social");

  const collectableFacts = facts.filter(doc => requiresProduCollectionTracking(doc.documentTypeCode || doc.tipoDocumento || doc.tipoDoc));
  const paidFacts = collectableFacts.filter(doc => cobranzaState(doc) === "Pagado");
  const openFacts = collectableFacts.filter(doc => cobranzaState(doc) !== "Pagado");
  const overdueFacts = openFacts.filter(doc => cobranzaState(doc) === "Retrasado de pago");
  const dueSoonFacts = openFacts.filter(doc => {
    const days = daysUntil(doc.fechaVencimiento);
    return days !== null && days >= 0 && days <= 7;
  });
  const overdueAmount = sumItems(overdueFacts, amountToCollect);
  const openAmount = sumItems(openFacts, amountToCollect);
  const paidAmount = sumItems(paidFacts, doc => Number(doc.total || 0) * getProduBillingFinancialMultiplier(doc.documentTypeCode || doc.tipoDocumento || doc.tipoDoc));

  const acceptedBudgets = pres.filter(item => item.estado === "Aceptado");
  const recurringBudgets = pres.filter(item => item.recurring);
  const totalAccepted = sumItems(acceptedBudgets, item => item.total);
  const acceptanceRate = pres.length ? Math.round((acceptedBudgets.length / pres.length) * 100) : 0;

  const activeProjects = pros.filter(item => ["En Curso", "Activo", "Pre-Producción", "Producción", "Post-Producción"].includes(item.est));
  const activePrograms = pgs.filter(item => item.est === "Activo");
  const pendingEpisodes = eps.filter(item => ["Planificado", "En Edición", "Programado"].includes(item.estado));
  const publishedEpisodes = eps.filter(item => item.estado === "Publicado");
  const activeCampaigns = campaigns.filter(item => item.est === "Activa" || item.est === "Planificada");
  const upcomingShoots = eps.filter(item => {
    const days = daysUntil(item.fechaGrab);
    return days !== null && days >= 0 && days <= 7;
  });

  const contractsExpiring = cts.filter(item => {
    const days = daysUntil(item.vig);
    return days !== null && days >= 0 && days <= 30;
  });
  const urgentAlerts = (alertas || []).slice(0, 5);

  const operationHealthLabel = overdueFacts.length
    ? `${overdueFacts.length} documento${overdueFacts.length !== 1 ? "s" : ""} con cobranza vencida`
    : urgentAlerts.length
      ? `${urgentAlerts.length} alerta${urgentAlerts.length !== 1 ? "s" : ""} operativa${urgentAlerts.length !== 1 ? "s" : ""}`
      : activePrograms.length
        ? `${activePrograms.length} producci${activePrograms.length !== 1 ? "ones" : "ón"} activa${activePrograms.length !== 1 ? "s" : ""}`
        : "Operación estable";
  const operationHealthTone = overdueFacts.length ? "#ff5566" : urgentAlerts.length ? "#ffcc44" : "#00e08a";

  const topStats = [
    {
      label: "Estado general",
      value: operationHealthLabel,
      accent: operationHealthTone,
      compact: true,
    },
    {
      label: "Balance",
      value: fmtM(balance),
      sub: balance >= 0 ? "resultado operativo positivo" : "resultado operativo bajo presión",
      accent: balance >= 0 ? "#00e08a" : "#ff5566",
    },
    {
      label: "Por cobrar",
      value: canInvoices ? fmtM(openAmount) : "No activo",
      sub: canInvoices ? `${openFacts.length} documento${openFacts.length !== 1 ? "s" : ""} abiertos` : "Activa facturación para medir cobranza",
      accent: canInvoices ? "#ffcc44" : "var(--gr2)",
    },
    {
      label: "Ejecución activa",
      value: `${activeProjects.length + activePrograms.length}`,
      sub: `${activeProjects.length} proyectos · ${activePrograms.length} producciones`,
      accent: "var(--cy)",
    },
  ];

  const kpis = [
    { label: "Clientes activos", value: clis.length, sub: "base comercial vigente", accent: "var(--cy)", vc: "var(--cy)" },
    { label: "Proyectos activos", value: activeProjects.length, sub: `${pros.length} proyectos en total`, accent: "#60a5fa", vc: "#60a5fa" },
    { label: "Producciones activas", value: activePrograms.length, sub: `${pendingEpisodes.length} episodios pendientes`, accent: "#00e08a", vc: "#00e08a" },
    canSocial
      ? { label: "Campañas activas", value: activeCampaigns.length, sub: `${campaigns.length} piezas registradas`, accent: "#a78bfa", vc: "#a78bfa" }
      : { label: "Episodios publicados", value: publishedEpisodes.length, sub: `${eps.length} episodios totales`, accent: "#a78bfa", vc: "#a78bfa" },
    canBudgets
      ? { label: "Aceptación comercial", value: `${acceptanceRate}%`, sub: `${acceptedBudgets.length} de ${pres.length} presupuestos`, accent: acceptanceRate >= 50 ? "#00e08a" : "#ffcc44", vc: acceptanceRate >= 50 ? "#00e08a" : "#ffcc44" }
      : { label: "Ingresos", value: fmtM(ti), sub: `${ingresos.length} movimientos`, accent: "#00e08a", vc: "#00e08a" },
    canInvoices
      ? { label: "Cobranza vencida", value: overdueFacts.length, sub: overdueFacts.length ? `${fmtM(overdueAmount)} pendiente` : "sin documentos críticos", accent: overdueFacts.length ? "#ff5566" : "#00e08a", vc: overdueFacts.length ? "#ff5566" : "#00e08a" }
      : { label: "Gastos", value: fmtM(tg), sub: `${gastos.length} movimientos`, accent: "#ff5566", vc: "#ff5566" },
  ];

  const actionCards = [
    { show: true, label: "Clientes", sub: `${clis.length} activos`, fn: () => navTo("clientes") },
    { show: true, label: "Proyectos", sub: `${activeProjects.length} en marcha`, fn: () => navTo("producciones") },
    { show: true, label: "Producciones", sub: `${activePrograms.length} activas`, fn: () => navTo("programas") },
    { show: canSocial, label: "Contenidos", sub: `${activeCampaigns.length} campañas activas`, fn: () => navTo("contenidos") },
    { show: canBudgets, label: "Presupuestos", sub: `${acceptedBudgets.length} aceptados`, fn: () => navTo("presupuestos") },
    { show: canInvoices, label: "Facturación", sub: `${overdueFacts.length} vencidos`, fn: () => navTo("facturacion") },
  ].filter(item => item.show);

  const priorityQueue = [
    ...overdueFacts.slice(0, 3).map(doc => ({
      id: `overdue-${doc.id}`,
      title: `Cobranza vencida · ${doc.correlativo || "Sin correlativo"}`,
      sub: `${invoiceEntityName(doc, clientes, auspiciadores)} · ${fmtM(amountToCollect(doc))}`,
      badge: doc.fechaVencimiento ? fmtD(doc.fechaVencimiento) : "Sin vencimiento",
      tone: "critical",
      target: ["facturacion"],
    })),
    ...dueSoonFacts.slice(0, 2).map(doc => ({
      id: `soon-${doc.id}`,
      title: `Cobranza próxima · ${doc.correlativo || "Sin correlativo"}`,
      sub: `${invoiceEntityName(doc, clientes, auspiciadores)} · vence ${fmtD(doc.fechaVencimiento)}`,
      badge: fmtM(amountToCollect(doc)),
      tone: "warning",
      target: ["facturacion"],
    })),
    ...contractsExpiring.slice(0, 2).map(contract => ({
      id: `contract-${contract.id}`,
      title: contract.nom || "Contrato",
      sub: `Contrato por vencer${contract.cliId ? ` · ${(clis.find(item => item.id === contract.cliId)?.nom) || "sin cliente"}` : ""}`,
      badge: contract.vig ? fmtD(contract.vig) : "Sin fecha",
      tone: "warning",
      target: ["contratos"],
    })),
    ...urgentAlerts.map(alerta => ({
      id: `alert-${alerta.id}`,
      title: alerta.titulo.replace(/^[^:]+:\s/, ""),
      sub: `${alerta.sub} · ${fmtD(alerta.fecha)}`,
      badge: alerta.diff === 0 ? "Hoy" : alerta.diff === 1 ? "Mañana" : `${alerta.diff} días`,
      tone: alerta.tipo === "urgente" ? "critical" : "warning",
    })),
  ].slice(0, 6);

  const executionQueue = [
    ...activeProjects.slice(0, 2).map(project => ({
      id: `pro-${project.id}`,
      title: project.nom,
      sub: `${project.tip || "Proyecto"} · ${project.est || "Activo"}`,
      badge: project.est || "Activo",
      tone: "positive",
      target: ["pro-det", project.id],
    })),
    ...activePrograms.slice(0, 2).map(program => ({
      id: `pg-${program.id}`,
      title: program.nom,
      sub: `${eps.filter(ep => ep.pgId === program.id && ep.estado === "Publicado").length}/${eps.filter(ep => ep.pgId === program.id).length} episodios publicados`,
      badge: program.est || "Activo",
      tone: "positive",
      target: ["pg-det", program.id],
    })),
    ...upcomingShoots.slice(0, 2).map(ep => ({
      id: `shoot-${ep.id}`,
      title: `Grabación próxima · Ep. ${ep.num || "—"}`,
      sub: `${pgs.find(item => item.id === ep.pgId)?.nom || "Producción"} · ${ep.titulo || "Sin título"}`,
      badge: ep.fechaGrab ? fmtD(ep.fechaGrab) : "Sin fecha",
      tone: "warning",
      target: ["ep-det", ep.id],
    })),
    ...activeCampaigns.slice(0, 2).map(campaign => ({
      id: `campaign-${campaign.id}`,
      title: campaign.nom,
      sub: `${clis.find(item => item.id === campaign.cliId)?.nom || "Sin cliente"} · ${campaign.plataforma || "Contenido"}`,
      badge: campaign.est || "Activa",
      tone: "positive",
      target: ["contenido-det", campaign.id],
    })),
  ].slice(0, 6);

  const financialCards = [
    { label: "Ingresos", value: fmtM(ti), sub: `${ingresos.length} movimientos registrados`, accent: "#00e08a" },
    { label: "Gastos", value: fmtM(tg), sub: `${gastos.length} egresos registrados`, accent: "#ff5566" },
    canInvoices
      ? { label: "Por cobrar", value: fmtM(openAmount), sub: `${openFacts.length} documentos abiertos`, accent: "#ffcc44" }
      : null,
    canInvoices
      ? { label: "Cobrado", value: fmtM(paidAmount), sub: `${paidFacts.length} documentos pagados`, accent: "#00e08a" }
      : null,
    canBudgets
      ? { label: "Aceptado", value: fmtM(totalAccepted), sub: `${recurringBudgets.length} recurrentes`, accent: "var(--cy)" }
      : null,
    canContracts
      ? { label: "Contratos en alerta", value: String(contractsExpiring.length), sub: `${cts.length} contratos registrados`, accent: contractsExpiring.length ? "#ffcc44" : "#00e08a" }
      : null,
  ].filter(Boolean);

  const operatingCards = [
    { label: "Proyectos activos", value: String(activeProjects.length), sub: `${pros.length} proyectos totales` },
    { label: "Producciones activas", value: String(activePrograms.length), sub: `${pgs.length} producciones registradas` },
    { label: "Episodios pendientes", value: String(pendingEpisodes.length), sub: `${publishedEpisodes.length} publicados` },
    canSocial
      ? { label: "Campañas activas", value: String(activeCampaigns.length), sub: `${campaigns.length} piezas registradas` }
      : null,
    upcomingShoots.length
      ? { label: "Grabaciones en 7 días", value: String(upcomingShoots.length), sub: "atención de calendario" }
      : null,
    empresa?.addons?.includes("activos")
      ? { label: "Activos", value: String(activeAssets.length), sub: "inventario registrado" }
      : null,
  ].filter(Boolean);

  return (
    <div style={{ width: "100%", minWidth: 0 }}>
      <div style={{ padding: "18px 20px", border: "1px solid var(--bdr2)", borderRadius: 20, background: "linear-gradient(180deg,var(--cg),transparent 68%)", marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ minWidth: 0, flex: "1 1 420px" }}>
            <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>Panel operativo</div>
            <div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800, color: "var(--wh)", marginBottom: 6 }}>Hola, {user?.name}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, maxWidth: 780 }}>
              Este panel resume lo que más conviene revisar en {empresa?.nombre}: salud operativa, presión comercial, ejecución activa y alertas concretas para el día.
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, minWidth: 320, flex: "1 1 360px" }}>
            {topStats.map(item => (
              <div key={item.label} style={{ ...sectionCardStyle(), minHeight: 110 }}>
                <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.8 }}>{item.label}</div>
                <div style={{ fontFamily: "var(--fb)", fontSize: item.compact ? 18 : 28, fontWeight: 700, letterSpacing: -0.02, color: item.accent, lineHeight: 1.1, marginTop: item.compact ? 14 : 10 }}>
                  {item.value}
                </div>
                {item.sub ? <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 8 }}>{item.sub}</div> : null}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>
          {actionCards.map(renderActionCard)}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 14, marginBottom: 18 }}>
        {kpis.map(stat => <Stat key={stat.label} {...stat} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,1.1fr) minmax(320px,.9fr)", gap: 16, marginBottom: 16 }}>
        <Card title="Atención prioritaria" sub={priorityQueue.length ? "Lo que puede impactar caja u operación si no se revisa" : "Sin riesgos inmediatos visibles"}>
          {priorityQueue.length
            ? priorityQueue.map(item => renderQueueItem(item, navTo))
            : <Empty text="Sin prioridades críticas" sub="No vemos vencimientos ni alertas fuertes en este momento." />}
        </Card>
        <Card title="Ejecución en foco" sub="Dónde conviene entrar primero para mover la operación">
          {executionQueue.length
            ? executionQueue.map(item => renderQueueItem(item, navTo))
            : <Empty text="Sin frentes activos" sub="Crea proyectos, producciones o contenidos para empezar a operar." />}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16, marginBottom: 16 }}>
        <Card title="Caja y comercial" sub="Métricas útiles para seguir ingresos, cobranza y cierre comercial">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {financialCards.map(item => (
              <div key={item.label} style={sectionCardStyle()}>
                <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: item.accent || "var(--wh)", marginBottom: 4 }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "var(--gr2)" }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Carga operativa" sub="Indicadores claros de la ejecución en curso">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            {operatingCards.map(item => (
              <div key={item.label} style={sectionCardStyle()}>
                <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{item.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{item.value}</div>
                <div style={{ fontSize: 11, color: "var(--gr2)" }}>{item.sub}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 16 }}>
        <Card title="Lectura comercial" sub="Un resumen corto de cómo está el frente comercial">
          <div style={{ display: "grid", gap: 10 }}>
            {canBudgets ? (
              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Presupuestos</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{acceptedBudgets.length} aceptados</div>
                <div style={{ fontSize: 11, color: "var(--gr2)" }}>
                  {pres.length ? `${acceptanceRate}% de aceptación sobre ${pres.length} presupuestos` : "Sin presupuestos registrados"}
                </div>
              </div>
            ) : null}
            {canInvoices ? (
              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Cobranza</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{openFacts.length} documentos abiertos</div>
                <div style={{ fontSize: 11, color: "var(--gr2)" }}>
                  {overdueFacts.length ? `${overdueFacts.length} vencidos · ${fmtM(overdueAmount)} críticos` : "Sin documentos vencidos"}
                </div>
              </div>
            ) : null}
            {canContracts ? (
              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Contratos</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{cts.length} registrados</div>
                <div style={{ fontSize: 11, color: "var(--gr2)" }}>
                  {contractsExpiring.length ? `${contractsExpiring.length} por vencer en 30 días` : "Sin alertas próximas"}
                </div>
              </div>
            ) : null}
            {!canBudgets && !canInvoices && !canContracts && (
              <Empty text="Sin módulos comerciales activos" sub="Activa presupuestos, facturación o contratos para ampliar este panel." />
            )}
          </div>
        </Card>
        <Card title="Contexto de operación" sub="Señales que ayudan a decidir prioridades del día">
          <div style={{ display: "grid", gap: 10 }}>
            <div style={sectionCardStyle()}>
              <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Producciones y episodios</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{activePrograms.length} activas · {pendingEpisodes.length} pendientes</div>
              <div style={{ fontSize: 11, color: "var(--gr2)" }}>{upcomingShoots.length ? `${upcomingShoots.length} grabación(es) en los próximos 7 días` : "Sin grabaciones próximas registradas"}</div>
            </div>
            <div style={sectionCardStyle()}>
              <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Relación con clientes</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", marginBottom: 4 }}>{clis.length} clientes activos</div>
              <div style={{ fontSize: 11, color: "var(--gr2)" }}>{canSocial ? `${activeCampaigns.length} campañas activas en contenidos` : `${activeProjects.length} proyectos en marcha`}</div>
            </div>
            {canContracts && cts.length ? (
              <div style={sectionCardStyle()}>
                <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Contratos</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {cts.slice(0, 4).map(contract => <Badge key={contract.id} label={`${contract.nom || "Contrato"} · ${contractVisualState(contract)}`} color={contractVisualState(contract) === "Vencido" ? "red" : contractVisualState(contract) === "Por vencer" ? "yellow" : "green"} sm />)}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
