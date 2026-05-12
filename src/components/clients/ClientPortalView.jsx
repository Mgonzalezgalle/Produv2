import { useEffect, useMemo, useState } from "react";
import { dbGet, dbSet } from "../../hooks/useLabDataStore";
import { countCampaignPieces, cobranzaState } from "../../lib/utils/helpers";
import { buildClientPortalSessionKey, normalizeClientPortal } from "../../lib/clients/clientPortal";
import { Badge, Btn, Card, Empty, FG, FTA, GBtn, Modal, Stat, TD, TH } from "../../lib/ui/components";

function todayIso() {
  return new Date().toISOString().split("T")[0];
}

function fmtMoney(value = 0) {
  return "$" + Number(value || 0).toLocaleString("es-CL");
}

function fmtDate(value = "") {
  if (!value) return "—";
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return value;
  }
}

function approvedLikeStatus(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "aceptado" || normalized === "aprobada" || normalized === "aprobado";
}

function rejectedLikeStatus(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "rechazado" || normalized === "rechazada";
}

function uid() {
  return `portal_${Math.random().toString(36).slice(2, 10)}`;
}

function clientDecisionLabel(decision = null, type = "content") {
  if (!decision?.status) return "";
  if (type === "budget") return decision.status === "approved" ? "Cliente aprobó" : "Cliente observó";
  return decision.status === "approved" ? "Cliente aprobó" : "Cliente pidió cambios";
}

async function resolvePortalPayload(empresas = [], slug = "") {
  const safeSlug = String(slug || "").trim();
  if (!safeSlug) return { error: "missing_slug" };
  for (const empresa of Array.isArray(empresas) ? empresas : []) {
    const empId = empresa?.id;
    if (!empId) continue;
    const clients = await dbGet(`produ:${empId}:clientes`);
    const client = (Array.isArray(clients) ? clients : []).find(item => {
      const portal = normalizeClientPortal(item?.portal, item);
      return portal.enabled && portal.slug === safeSlug;
    });
    if (!client) continue;
    const [
      producciones,
      programas,
      piezas,
      presupuestos,
      facturas,
      purchaseOrders,
    ] = await Promise.all([
      dbGet(`produ:${empId}:producciones`),
      dbGet(`produ:${empId}:programas`),
      dbGet(`produ:${empId}:piezas`),
      dbGet(`produ:${empId}:presupuestos`),
      dbGet(`produ:${empId}:facturas`),
      dbGet(`produ:${empId}:treasuryPurchaseOrders`),
    ]);
    return {
      empresa,
      client,
      portal: normalizeClientPortal(client?.portal, client),
      producciones: Array.isArray(producciones) ? producciones : [],
      programas: Array.isArray(programas) ? programas : [],
      piezas: Array.isArray(piezas) ? piezas : [],
      presupuestos: Array.isArray(presupuestos) ? presupuestos : [],
      facturas: Array.isArray(facturas) ? facturas : [],
      purchaseOrders: Array.isArray(purchaseOrders) ? purchaseOrders : [],
    };
  }
  return { error: "not_found" };
}

function PublicPortalShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(79,124,255,.18), transparent 32%), radial-gradient(circle at top right, rgba(168,85,247,.12), transparent 28%), linear-gradient(180deg, #eef4ff 0%, #f7faff 46%, #ffffff 100%)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function PortalGate({ empresa, client, portal, onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const canSubmit = code.trim().length === 6;
  const handleSubmit = () => {
    if (String(code).trim() !== String(portal?.accessCode || "").trim()) {
      setError("El código no coincide. Revisa el mensaje que te compartieron y vuelve a intentar.");
      return;
    }
    setError("");
    onUnlock();
  };
  return (
    <PublicPortalShell>
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#ffffff", border: "1px solid rgba(79,124,255,.18)", boxShadow: "0 28px 80px rgba(15,23,42,.10)", borderRadius: 28, overflow: "hidden" }}>
        <div style={{ padding: "34px 36px 20px", borderBottom: "1px solid #e8eefb", background: "linear-gradient(135deg, rgba(79,124,255,.08), rgba(255,255,255,.9) 45%, rgba(168,85,247,.06))" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: "#4f7cff", marginBottom: 12 }}>Portal cliente</div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 30, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>{client?.nom || "Cliente"}</div>
          <div style={{ fontSize: 15, color: "#64748b", marginTop: 10 }}>
            Estás entrando al espacio compartido por <b style={{ color: "#0f172a" }}>{empresa?.nombre || empresa?.nom || "Produ"}</b> para revisar avances, documentos y pendientes.
          </div>
        </div>
        <div style={{ padding: 36, display: "grid", gap: 20 }}>
          <div style={{ background: "#f6f9ff", border: "1px solid #dbe7ff", borderRadius: 22, padding: 24 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Código de acceso</div>
            <div style={{ fontSize: 14, color: "#475569", lineHeight: 1.6, marginBottom: 18 }}>
              Ingresa el código de 6 dígitos que te compartieron para entrar al portal de este cliente.
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={code}
                onChange={(event) => setCode(String(event.target.value || "").replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSubmit) handleSubmit();
                }}
                placeholder="000000"
                inputMode="numeric"
                style={{
                  width: 180,
                  padding: "15px 18px",
                  borderRadius: 16,
                  border: `1px solid ${error ? "#ff5566" : "#c8d7ff"}`,
                  outline: "none",
                  fontFamily: "var(--fm)",
                  fontSize: 24,
                  letterSpacing: 5,
                  color: "#0f172a",
                  background: "#ffffff",
                }}
              />
              <Btn onClick={handleSubmit} s={{ minWidth: 180, opacity: canSubmit ? 1 : 0.65 }} disabled={!canSubmit}>Entrar al portal</Btn>
            </div>
            {error ? <div style={{ marginTop: 12, fontSize: 13, color: "#ff5566" }}>{error}</div> : null}
          </div>
        </div>
      </div>
    </PublicPortalShell>
  );
}

export function ClientPortalView({ empresas = [], slug = "" }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [contentDecision, setContentDecision] = useState(null);
  const [budgetDecision, setBudgetDecision] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    resolvePortalPayload(empresas, slug)
      .then((result) => {
        if (!alive) return;
        setPayload(result);
        const sessionKey = buildClientPortalSessionKey(slug);
        setAuthorized(typeof window !== "undefined" && window.sessionStorage.getItem(sessionKey) === "ok");
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setPayload({ error: "load_failed" });
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [empresas, slug]);

  const summary = useMemo(() => {
    const empresa = payload?.empresa;
    const client = payload?.client;
    if (!empresa?.id || !client?.id) return null;
    const clientId = client.id;
    const activeProductions = (payload?.producciones || []).filter(item => item?.cliId === clientId);
    const activePrograms = (payload?.programas || []).filter(item => item?.cliId === clientId);
    const activeContent = (payload?.piezas || []).filter(item => item?.cliId === clientId);
    const budgets = (payload?.presupuestos || []).filter(item => item?.cliId === clientId);
    const invoices = (payload?.facturas || []).filter(item => item?.empId === empresa.id && item?.tipo === "cliente" && item?.entidadId === clientId);
    const orders = (payload?.purchaseOrders || []).filter(item => item?.empId === empresa.id && item?.clientId === clientId);
    const overdueInvoices = invoices.filter(item => {
      const state = cobranzaState(item);
      return state !== "Pagado" && item?.fechaVencimiento && item.fechaVencimiento < todayIso();
    });
    const pendingInvoices = invoices.filter(item => cobranzaState(item) !== "Pagado");
    const pendingBudgets = budgets.filter(item => !approvedLikeStatus(item?.estado) && !rejectedLikeStatus(item?.estado));
    const pendingApprovals = activeContent.filter(item => !["publicado", "aprobada", "aprobado"].includes(String(item?.est || "").trim().toLowerCase()));
    return {
      activeProductions,
      activePrograms,
      activeContent,
      budgets,
      invoices,
      orders,
      overdueInvoices,
      pendingInvoices,
      pendingBudgets,
      pendingApprovals,
      totalContentPieces: activeContent.reduce((sum, item) => sum + Number(countCampaignPieces(item) || 0), 0),
      pendingAmount: pendingInvoices.reduce((sum, item) => sum + Number(item?.total || 0), 0),
    };
  }, [payload]);

  const persistClientMutation = async ({ key, updater, payloadKey }) => {
    if (!payload?.empresa?.id || !payloadKey || typeof updater !== "function") return false;
    const storageKey = `produ:${payload.empresa.id}:${key}`;
    const currentRecords = Array.isArray(payload?.[payloadKey]) ? payload[payloadKey] : [];
    const nextRecords = updater(currentRecords);
    const persisted = await dbSet(storageKey, nextRecords);
    if (!persisted) return false;
    setPayload((current) => current ? { ...current, [payloadKey]: nextRecords } : current);
    return true;
  };

  const appendPortalActivityAndSystemMessage = async ({ headline, secondary, text, action }) => {
    if (!payload?.empresa?.id || !payload?.client?.id) return;
    const now = new Date().toISOString();
    const activityEntry = {
      id: uid(),
      action,
      headline,
      secondary,
      text: String(text || "").trim(),
      createdAt: now,
      authorName: payload.client.nom || "Cliente",
      source: "client_portal",
    };

    const clientsKey = `produ:${payload.empresa.id}:clientes`;
    const currentClients = await dbGet(clientsKey);
    const nextClients = (Array.isArray(currentClients) ? currentClients : []).map(item => {
      if (item.id !== payload.client.id) return item;
      return {
        ...item,
        portalActivity: [activityEntry, ...(Array.isArray(item.portalActivity) ? item.portalActivity : [])].slice(0, 50),
      };
    });
    await dbSet(clientsKey, nextClients);

    const empresasKey = "produ:empresas";
    const currentEmpresas = await dbGet(empresasKey);
    const systemMessage = {
      id: uid(),
      title: `Portal cliente · ${payload.client.nom}`,
      body: `${headline}${text ? `\n\n${text}` : ""}`,
      createdAt: now,
    };
    const nextEmpresas = (Array.isArray(currentEmpresas) ? currentEmpresas : []).map(item => item.id === payload.empresa.id
      ? { ...item, systemMessages: [systemMessage, ...(Array.isArray(item.systemMessages) ? item.systemMessages : [])].slice(0, 30) }
      : item);
    await dbSet(empresasKey, nextEmpresas);

    setPayload((current) => current ? {
      ...current,
      client: {
        ...current.client,
        portalActivity: [activityEntry, ...(Array.isArray(current.client?.portalActivity) ? current.client.portalActivity : [])].slice(0, 50),
      },
    } : current);
  };

  const markPortalAccess = async () => {
    if (!payload?.empresa?.id || !payload?.client?.id) return;
    const now = new Date().toISOString();
    const storageKey = `produ:${payload.empresa.id}:clientes`;
    const currentClients = await dbGet(storageKey);
    const nextClients = (Array.isArray(currentClients) ? currentClients : []).map(item => {
      if (item.id !== payload.client.id) return item;
      return {
        ...item,
        portal: {
          ...normalizeClientPortal(item.portal, item),
          lastAccessAt: now,
          updatedAt: now,
        },
      };
    });
    await dbSet(storageKey, nextClients);
    setPayload((current) => current ? {
      ...current,
      client: {
        ...current.client,
        portal: {
          ...normalizeClientPortal(current.client.portal, current.client),
          lastAccessAt: now,
          updatedAt: now,
        },
      },
      portal: {
        ...normalizeClientPortal(current.portal, current.client),
        lastAccessAt: now,
        updatedAt: now,
      },
    } : current);
  };

  useEffect(() => {
    if (!authorized || !payload?.client?.id || !payload?.empresa?.id) return;
    void markPortalAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authorized, payload?.client?.id, payload?.empresa?.id]);

  if (loading) {
    return <PublicPortalShell><Card title="Cargando portal" sub="Estamos preparando la información compartida para este acceso." /></PublicPortalShell>;
  }

  if (payload?.error || !payload?.client || !payload?.empresa) {
    return <PublicPortalShell><Card title="Portal no disponible"><Empty text="No encontramos este acceso compartido" sub="Revisa el enlace o pide a tu equipo una nueva invitación al portal." /></Card></PublicPortalShell>;
  }

  if (!payload.portal?.enabled) {
    return <PublicPortalShell><Card title="Portal desactivado"><Empty text="Este acceso no está activo por ahora" sub="Si necesitas entrar, pide a tu equipo que reactive el portal de este cliente." /></Card></PublicPortalShell>;
  }

  if (!authorized) {
    return <PortalGate empresa={payload.empresa} client={payload.client} portal={payload.portal} onUnlock={() => {
      const sessionKey = buildClientPortalSessionKey(slug);
      if (typeof window !== "undefined") window.sessionStorage.setItem(sessionKey, "ok");
      setAuthorized(true);
    }} />;
  }

  const headerMeta = [
    payload.client?.rut ? `RUT ${payload.client.rut}` : null,
    `Atiende ${payload.empresa?.nombre || payload.empresa?.nom || "Produ"}`,
  ].filter(Boolean).join(" · ");
  const tabs = [
    ["resumen", "Resumen", "#4f7cff"],
    ["contenidos", "Contenidos", "#8b5cf6"],
    ["presupuestos", "Presupuestos", "#00b894"],
    ["documentos", "Documentos y pagos", "#ff8844"],
  ];

  const saveContentDecision = async () => {
    if (!contentDecision?.campaignId || !contentDecision?.pieceId || !contentDecision?.status) return;
    setDecisionSaving(true);
    setDecisionFeedback("");
    const briefNote = String(contentDecision.brief || "").trim();
    const ok = await persistClientMutation({
      key: "piezas",
      payloadKey: "piezas",
      updater: (records = []) => (Array.isArray(records) ? records : []).map(campaign => {
        if (campaign.id !== contentDecision.campaignId) return campaign;
        const nextPieces = (Array.isArray(campaign.piezas) ? campaign.piezas : []).map(piece => {
          if (piece.id !== contentDecision.pieceId) return piece;
          return {
            ...piece,
            clientPortalDecision: {
              status: contentDecision.status,
              brief: briefNote,
              decidedAt: new Date().toISOString(),
              source: "client_portal",
            },
          };
        });
        return { ...campaign, piezas: nextPieces };
      }),
    });
    setDecisionSaving(false);
    if (!ok) {
      setDecisionFeedback("No pudimos guardar esta decisión todavía. Intenta nuevamente.");
      return;
    }
    await appendPortalActivityAndSystemMessage({
      headline: contentDecision.status === "approved" ? "Contenido aprobado por el cliente" : "Cliente solicitó cambios en contenido",
      secondary: `${payload.client.nom} respondió desde su portal en contenidos.`,
      text: briefNote,
      action: contentDecision.status === "approved" ? "content_approved" : "content_changes_requested",
    });
    setDecisionFeedback(contentDecision.status === "approved" ? "Contenido aprobado correctamente." : "Dejamos registradas las observaciones para este contenido.");
    setContentDecision(null);
  };

  const saveBudgetDecision = async () => {
    if (!budgetDecision?.budgetId || !budgetDecision?.status) return;
    setDecisionSaving(true);
    setDecisionFeedback("");
    const note = String(budgetDecision.note || "").trim();
    const ok = await persistClientMutation({
      key: "presupuestos",
      payloadKey: "presupuestos",
      updater: (records = []) => (Array.isArray(records) ? records : []).map(item => item.id === budgetDecision.budgetId ? {
        ...item,
        clientPortalDecision: {
          status: budgetDecision.status,
          note,
          decidedAt: new Date().toISOString(),
          source: "client_portal",
        },
      } : item),
    });
    setDecisionSaving(false);
    if (!ok) {
      setDecisionFeedback("No pudimos guardar esta respuesta del presupuesto. Intenta nuevamente.");
      return;
    }
    await appendPortalActivityAndSystemMessage({
      headline: budgetDecision.status === "approved" ? "Presupuesto aprobado por el cliente" : "Cliente observó un presupuesto",
      secondary: `${payload.client.nom} respondió desde su portal en presupuestos.`,
      text: note,
      action: budgetDecision.status === "approved" ? "budget_approved" : "budget_rejected",
    });
    setDecisionFeedback(budgetDecision.status === "approved" ? "Presupuesto aprobado correctamente." : "Presupuesto marcado con observaciones del cliente.");
    setBudgetDecision(null);
  };

  return (
    <PublicPortalShell>
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ background: "#ffffff", border: "1px solid rgba(79,124,255,.14)", borderRadius: 28, boxShadow: "0 28px 80px rgba(15,23,42,.08)", overflow: "hidden" }}>
          <div style={{ padding: "30px 30px 24px", borderBottom: "1px solid #ebf0fb", display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start", background: "linear-gradient(135deg, rgba(79,124,255,.07), rgba(255,255,255,.94) 48%, rgba(168,85,247,.06))" }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800, color: "#4f7cff", marginBottom: 10 }}>Portal cliente</div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{payload.client.nom}</div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#64748b" }}>{headerMeta}</div>
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                <div style={{ background: "#ffffff", border: "1px solid rgba(79,124,255,.12)", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Contenidos por revisar</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#4f7cff", marginTop: 6 }}>{summary?.pendingApprovals.length || 0}</div>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid rgba(168,85,247,.14)", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Presupuestos pendientes</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#8b5cf6", marginTop: 6 }}>{summary?.pendingBudgets.length || 0}</div>
                </div>
                <div style={{ background: "#ffffff", border: "1px solid rgba(255,136,68,.14)", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "#64748b", fontWeight: 700 }}>Monto pendiente</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#ff8844", marginTop: 6 }}>{fmtMoney(summary?.pendingAmount || 0)}</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Badge label={`${summary?.pendingApprovals.length || 0} contenido(s) por revisar`} color="purple" />
              <Badge label={`${summary?.pendingBudgets.length || 0} presupuesto(s) pendiente(s)`} color="yellow" />
              <Badge label={`${summary?.overdueInvoices.length || 0} documento(s) vencido(s)`} color={summary?.overdueInvoices.length ? "red" : "green"} />
              <GBtn onClick={() => {
                const sessionKey = buildClientPortalSessionKey(slug);
                if (typeof window !== "undefined") window.sessionStorage.removeItem(sessionKey);
                setAuthorized(false);
              }}>Cerrar portal</GBtn>
            </div>
          </div>

          <div style={{ padding: "0 24px 24px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 16 }}>
              {tabs.map(([id, label, accent]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  style={{
                    borderRadius: 999,
                    padding: "10px 16px",
                    border: `1px solid ${tab === id ? accent : "#dbe3f4"}`,
                    background: tab === id ? accent : "#ffffff",
                    color: tab === id ? "#ffffff" : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: tab === id ? "0 12px 30px rgba(15,23,42,.12)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {tab === "resumen" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 14 }}>
              <Stat label="Producciones activas" value={(summary?.activeProductions.length || 0) + (summary?.activePrograms.length || 0)} accent="#4f7cff" vc="#4f7cff" />
              <Stat label="Campañas de contenido" value={summary?.activeContent.length || 0} accent="#a855f7" vc="#a855f7" />
              <Stat label="Piezas visibles" value={summary?.totalContentPieces || 0} accent="#00b894" vc="#00b894" />
              <Stat label="Monto pendiente" value={fmtMoney(summary?.pendingAmount || 0)} accent="#ff8844" vc="#ff8844" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 18 }}>
              <Card title="Lo que requiere atención hoy" sub="Una vista rápida para entrar a lo importante sin perder tiempo.">
                <div style={{ display: "grid", gap: 10 }}>
                  <div>• {summary?.pendingApprovals.length || 0} campaña(s) de contenido todavía esperan revisión.</div>
                  <div>• {summary?.pendingBudgets.length || 0} presupuesto(s) siguen pendientes de respuesta.</div>
                  <div>• {summary?.pendingInvoices.length || 0} documento(s) siguen abiertos en documentos y pagos.</div>
                  <div>• {summary?.overdueInvoices.length || 0} documento(s) ya están vencidos.</div>
                </div>
              </Card>
              <Card title="Próximos bloques del portal" sub="Ya dejamos listo el espacio para seguir creciendo este acceso compartido.">
                <div style={{ display: "grid", gap: 10 }}>
                  <div>• Aprobación directa de contenidos con feedback y brief adicional.</div>
                  <div>• Aprobación de presupuestos con trazabilidad de decisión.</div>
                  <div>• Seguimiento más fino por hitos y entregables de producción.</div>
                </div>
              </Card>
            </div>
          </>
        ) : null}

        {tab === "contenidos" ? (
          <Card title="Contenidos" sub="Aquí puedes revisar las campañas y piezas que hoy están vinculadas a tu operación.">
            {summary?.activeContent.length ? <div style={{ display: "grid", gap: 12 }}>
              {summary.activeContent.map(item => (
                <div key={item.id} style={{ padding: 18, border: "1px solid rgba(139,92,246,.12)", borderRadius: 20, background: "linear-gradient(180deg, rgba(248,245,255,.92), #ffffff)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800 }}>{item.nom}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "var(--gr2)" }}>{[item.mes, item.ano].filter(Boolean).join(" ")} · {countCampaignPieces(item)} pieza(s)</div>
                    </div>
                    <Badge label={item.est || "Planificada"} color="purple" />
                  </div>
                  {item.brief ? <div style={{ marginTop: 12, fontSize: 13, color: "var(--gr2)", whiteSpace: "pre-line" }}>{item.brief}</div> : null}
                  {Array.isArray(item.piezas) && item.piezas.length ? <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    {item.piezas.map(piece => {
                      const portalDecision = piece.clientPortalDecision || null;
                      return (
                        <div key={piece.id} style={{ padding: 16, borderRadius: 18, background: "#ffffff", border: "1px solid rgba(79,124,255,.12)", boxShadow: "0 12px 28px rgba(15,23,42,.05)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                            <div>
                              <div style={{ fontWeight: 700, color: "var(--wh)" }}>{piece.nom || "Pieza"}</div>
                              <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 4 }}>{piece.tipo || "Contenido"} · {piece.formato || "Entregable"}</div>
                            </div>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                              <Badge label={piece.approval || "Pendiente"} color={(piece.approval || "Pendiente") === "Aprobada" ? "green" : (piece.approval || "Pendiente") === "Observada" ? "red" : "yellow"} />
                              {portalDecision?.status ? <Badge label={clientDecisionLabel(portalDecision, "content")} color={portalDecision.status === "approved" ? "green" : "orange"} /> : null}
                              <GBtn onClick={() => setContentDecision({ campaignId: item.id, pieceId: piece.id, status: "approved", brief: "" })}>Aprobar</GBtn>
                              <GBtn onClick={() => setContentDecision({ campaignId: item.id, pieceId: piece.id, status: "changes_requested", brief: portalDecision?.brief || "" })}>Pedir cambios</GBtn>
                            </div>
                          </div>
                          {portalDecision?.brief ? <div style={{ marginTop: 10, fontSize: 12, color: "var(--gr2)", whiteSpace: "pre-line" }}><b style={{ color: "var(--wh)" }}>Último comentario del cliente:</b> {portalDecision.brief}</div> : null}
                        </div>
                      );
                    })}
                  </div> : null}
                </div>
              ))}
            </div> : <Empty text="Todavía no hay campañas visibles" sub="Cuando este cliente tenga contenidos asociados, aparecerán aquí." />}
          </Card>
        ) : null}

        {tab === "presupuestos" ? (
          <Card title="Presupuestos" sub="Revisa propuestas activas y su estado actual.">
            {summary?.budgets.length ? <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <TH>Título</TH>
                    <TH>Estado</TH>
                    <TH>Creación</TH>
                    <TH>Total</TH>
                  </tr>
                </thead>
                <tbody>
                  {summary.budgets.map(item => (
                    <tr key={item.id}>
                      <TD bold>{item.titulo || item.correlativo || "Presupuesto"}</TD>
                      <TD>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <Badge label={item.estado || "Borrador"} color={approvedLikeStatus(item.estado) ? "green" : rejectedLikeStatus(item.estado) ? "red" : "yellow"} />
                          {item.clientPortalDecision?.status ? <Badge label={clientDecisionLabel(item.clientPortalDecision, "budget")} color={item.clientPortalDecision.status === "approved" ? "green" : "orange"} /> : null}
                          <GBtn sm onClick={() => setBudgetDecision({ budgetId: item.id, status: "approved", note: "" })}>Aprobar</GBtn>
                          <GBtn sm onClick={() => setBudgetDecision({ budgetId: item.id, status: "rejected", note: item.clientPortalDecision?.note || "" })}>Observar</GBtn>
                        </div>
                      </TD>
                      <TD>{fmtDate(item.cr || item.fecha || "")}</TD>
                      <TD mono>{fmtMoney(item.total || item.subtotal || 0)}</TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div> : <Empty text="Sin presupuestos visibles" sub="Cuando existan propuestas ligadas a este cliente, aparecerán aquí." />}
          </Card>
        ) : null}

        {tab === "documentos" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 14 }}>
              <Stat label="Documentos abiertos" value={summary?.pendingInvoices.length || 0} accent="#4f7cff" vc="#4f7cff" />
              <Stat label="Vencidos" value={summary?.overdueInvoices.length || 0} accent={summary?.overdueInvoices.length ? "#ff5566" : "#00b894"} vc={summary?.overdueInvoices.length ? "#ff5566" : "#00b894"} />
              <Stat label="OC recibidas" value={summary?.orders.length || 0} accent="#ffcc44" vc="#ffcc44" />
            </div>
            <Card title="Documentos y pagos" sub="Una vista rápida de facturas y vencimientos asociados a este cliente." style={{ background: "linear-gradient(180deg, rgba(255,248,242,.94), #ffffff)" }}>
              {summary?.invoices.length ? <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <TH>Documento</TH>
                      <TH>Emisión</TH>
                      <TH>Vencimiento</TH>
                      <TH>Monto</TH>
                      <TH>Estado</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.invoices.map(item => {
                      const state = cobranzaState(item);
                      return (
                        <tr key={item.id}>
                          <TD bold>{item.correlativo || item.tipoDoc || "Documento"}</TD>
                          <TD>{fmtDate(item.fecha || item.fechaEmision || "")}</TD>
                          <TD>{fmtDate(item.fechaVencimiento || "")}</TD>
                          <TD mono>{fmtMoney(item.total || 0)}</TD>
                          <TD><Badge label={state || "Pendiente"} color={state === "Pagado" ? "green" : (item.fechaVencimiento && item.fechaVencimiento < todayIso() ? "red" : "yellow")} /></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div> : <Empty text="No hay documentos visibles" sub="Cuando existan facturas o documentos asociados a este cliente, aparecerán aquí." />}
            </Card>
          </>
        ) : null}

        {decisionFeedback ? <Card><div style={{ fontSize: 13, color: "var(--wh)" }}>{decisionFeedback}</div></Card> : null}
      </div>

      <Modal
        open={!!contentDecision}
        onClose={() => !decisionSaving && setContentDecision(null)}
        title={contentDecision?.status === "approved" ? "Aprobar contenido" : "Pedir cambios"}
        sub={contentDecision?.status === "approved" ? "Puedes aprobar la pieza tal como está o dejar un brief complementario." : "Deja indicaciones claras para que el equipo ajuste esta pieza."}
      >
        <FG label="Brief adicional u observaciones">
          <FTA
            value={contentDecision?.brief || ""}
            onChange={(event) => setContentDecision(current => current ? { ...current, brief: event.target.value } : current)}
            placeholder={contentDecision?.status === "approved" ? "Opcional: agrega contexto adicional para la siguiente versión o publicación." : "Describe qué cambios necesitas y qué tono o foco debe ajustarse."}
            style={{ minHeight: 120 }}
          />
        </FG>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <GBtn onClick={() => setContentDecision(null)}>Cancelar</GBtn>
          <Btn onClick={saveContentDecision} s={{ opacity: decisionSaving ? 0.7 : 1 }}>{contentDecision?.status === "approved" ? "Confirmar aprobación" : "Guardar observaciones"}</Btn>
        </div>
      </Modal>

      <Modal
        open={!!budgetDecision}
        onClose={() => !decisionSaving && setBudgetDecision(null)}
        title={budgetDecision?.status === "approved" ? "Aprobar presupuesto" : "Observar presupuesto"}
        sub={budgetDecision?.status === "approved" ? "Confirma esta propuesta comercial y, si quieres, agrega una nota breve." : "Explica qué necesitas ajustar antes de poder aprobar este presupuesto."}
      >
        <FG label="Comentario del cliente">
          <FTA
            value={budgetDecision?.note || ""}
            onChange={(event) => setBudgetDecision(current => current ? { ...current, note: event.target.value } : current)}
            placeholder={budgetDecision?.status === "approved" ? "Opcional: deja una nota para el equipo." : "Describe qué necesitas revisar, cambiar o aclarar en esta propuesta."}
            style={{ minHeight: 120 }}
          />
        </FG>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <GBtn onClick={() => setBudgetDecision(null)}>Cancelar</GBtn>
          <Btn onClick={saveBudgetDecision} s={{ opacity: decisionSaving ? 0.7 : 1 }}>{budgetDecision?.status === "approved" ? "Confirmar aprobación" : "Guardar observación"}</Btn>
        </div>
      </Modal>
    </PublicPortalShell>
  );
}
