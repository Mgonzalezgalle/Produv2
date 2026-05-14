import { Component, useEffect, useMemo, useRef, useState } from "react";
import { dbGet, dbSet } from "../../hooks/useLabDataStore";
import { countCampaignPieces, normalizeEmailValue } from "../../lib/utils/helpers";
import { buildClientPortalSessionKey, normalizeClientPortal } from "../../lib/clients/clientPortal";
import { appendWorkflowEventEntry } from "../../lib/operations/workflowEvents";
import { buildTreasuryReceivables } from "../../lib/utils/treasury";
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

function accessCodeSlots(code = "") {
  const clean = String(code || "").replace(/\D/g, "").slice(0, 6);
  return Array.from({ length: 6 }, (_, index) => clean[index] || "");
}

function portalResponseTone(status = "") {
  if (status === "approved") return { bg: "#ebfbf4", border: "#b7f0d3", color: "#0f9f63" };
  if (status === "changes_requested" || status === "rejected") return { bg: "#fff3eb", border: "#ffd7bf", color: "#e1712f" };
  return { bg: "#edf5ff", border: "#cfe0fb", color: "#2f6ea8" };
}

function safeText(value = "", fallback = "—") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const joined = value
      .map(item => safeText(item, ""))
      .filter(Boolean)
      .join(", ");
    return joined || fallback;
  }
  if (typeof value === "object") {
    return safeText(value.nom || value.nombre || value.label || value.name || value.value || "", fallback);
  }
  return fallback;
}

function safeUrl(value = "") {
  const normalized = safeText(value, "");
  return /^(https?:)?\/\//i.test(normalized) || normalized.startsWith("data:") ? normalized : "";
}

function resolvePiecePreviewUrl(piece = {}) {
  const candidates = [
    safeUrl(piece.previewAssetUrl),
    safeUrl(piece.finalLink),
    safeUrl(piece.link),
  ].filter(Boolean);
  return candidates[0] || "";
}

function isLikelyImageUrl(value = "") {
  const normalized = String(value || "").toLowerCase();
  return normalized.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(normalized);
}

function buildPortalContentSummary({ status = "", brief = "", comment = "", requestedChanges = "" } = {}) {
  const parts = [];
  if (brief) parts.push(`Brief adicional:\n${brief}`);
  if (comment) parts.push(`Comentario:\n${comment}`);
  if (status === "changes_requested" && requestedChanges) parts.push(`Correcciones solicitadas:\n${requestedChanges}`);
  return parts.join("\n\n").trim();
}

function countCampaignResponses(campaign = null) {
  const pieces = Array.isArray(campaign?.piezas) ? campaign.piezas : [];
  const pending = pieces.filter(piece => !piece?.clientPortalDecision?.status).length;
  const approved = pieces.filter(piece => piece?.clientPortalDecision?.status === "approved").length;
  const observed = pieces.filter(piece => piece?.clientPortalDecision?.status === "changes_requested").length;
  return { pending, approved, observed, total: pieces.length };
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
      receipts,
      crew,
    ] = await Promise.all([
      dbGet(`produ:${empId}:producciones`),
      dbGet(`produ:${empId}:programas`),
      dbGet(`produ:${empId}:piezas`),
      dbGet(`produ:${empId}:presupuestos`),
      dbGet(`produ:${empId}:facturas`),
      dbGet(`produ:${empId}:treasuryPurchaseOrders`),
      dbGet(`produ:${empId}:treasuryReceipts`),
      dbGet(`produ:${empId}:crew`),
    ]);
    return {
      empresa,
      client,
      portal: normalizeClientPortal(client?.portal, client),
      clients: Array.isArray(clients) ? clients : [],
      producciones: Array.isArray(producciones) ? producciones : [],
      programas: Array.isArray(programas) ? programas : [],
      piezas: Array.isArray(piezas) ? piezas : [],
      presupuestos: Array.isArray(presupuestos) ? presupuestos : [],
      facturas: Array.isArray(facturas) ? facturas : [],
      purchaseOrders: Array.isArray(purchaseOrders) ? purchaseOrders : [],
      receipts: Array.isArray(receipts) ? receipts : [],
      crew: Array.isArray(crew) ? crew : [],
    };
  }
  return { error: "not_found" };
}

function buildPortalActor(payload = null) {
  return {
    id: payload?.client?.id || "",
    name: payload?.client?.nom || "Cliente",
    email: Array.isArray(payload?.portal?.authorizedEmails) ? normalizeEmailValue(payload.portal.authorizedEmails[0] || "") : "",
    role: "client_portal",
  };
}

function uniqueEmails(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(value => normalizeEmailValue(value)).filter(Boolean)));
}

function PublicPortalShell({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(47,110,168,.16), transparent 30%), radial-gradient(circle at top right, rgba(47,110,168,.08), transparent 24%), linear-gradient(180deg, #f4f8fd 0%, #edf3fb 42%, #f8fbff 100%)", padding: "40px 20px" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

class PortalSectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return { failed: true, errorMessage: error?.message || "Error desconocido" };
  }

  componentDidCatch(error) {
    console.error("[client-portal] Seccion del portal con error", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <Card title="No pudimos abrir esta seccion" sub="Protegimos el portal para que una pieza invalida no deje la pantalla en blanco.">
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ borderRadius: 18, border: "1px solid #dbe7f5", background: "#f8fbff", padding: 18, color: "#475569", lineHeight: 1.7 }}>
              Algo de esta vista vino con informacion incompleta. Ya dejamos el portal estable y puedes volver al resumen o intentar nuevamente.
            </div>
            {this.state.errorMessage ? (
              <div style={{ borderRadius: 14, border: "1px solid #ffd7bf", background: "#fff8f3", padding: "12px 14px", color: "#8a5b33", fontSize: 12, lineHeight: 1.6 }}>
                <b style={{ color: "#0f172a" }}>Detalle tecnico:</b> {this.state.errorMessage}
                {this.props.details ? <div style={{ marginTop: 8 }}><b style={{ color: "#0f172a" }}>Contexto:</b> {this.props.details}</div> : null}
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Btn onClick={() => this.setState({ failed: false, errorMessage: "" })}>Intentar de nuevo</Btn>
              {typeof this.props.onBack === "function" ? <GBtn onClick={this.props.onBack}>Volver al resumen</GBtn> : null}
            </div>
          </div>
        </Card>
      );
    }
    return this.props.children;
  }
}

function PortalGate({ empresa, client, portal, onUnlock }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const codeInputRef = useRef(null);
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
      <div style={{ maxWidth: 760, margin: "0 auto", background: "#ffffff", border: "1px solid #dbe6f3", boxShadow: "0 28px 80px rgba(15,23,42,.10)", borderRadius: 28, overflow: "hidden" }}>
        <div style={{ padding: "34px 36px 20px", borderBottom: "1px solid #e8eef8", background: "linear-gradient(135deg, rgba(47,110,168,.10), rgba(255,255,255,.96) 48%, rgba(47,110,168,.04))" }}>
          <div style={{ fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: "#2f6ea8", marginBottom: 12 }}>Portal cliente</div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 30, fontWeight: 900, color: "#0f172a", lineHeight: 1.1 }}>{client?.nom || "Cliente"}</div>
          <div style={{ fontSize: 15, color: "#5b6b82", marginTop: 10 }}>
            Estás entrando al espacio compartido por <b style={{ color: "#0f172a" }}>{empresa?.nombre || empresa?.nom || "Produ"}</b> para revisar avances, documentos y pendientes.
          </div>
        </div>
        <div style={{ padding: 36, display: "grid", gap: 20 }}>
          <div style={{ background: "#f7faff", border: "1px solid #dbe7f5", borderRadius: 22, padding: 24 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Código de acceso</div>
            <div style={{ fontSize: 14, color: "#5b6b82", lineHeight: 1.6, marginBottom: 18 }}>
              Ingresa el código de 6 dígitos que te compartieron para entrar al portal de este cliente.
            </div>
            <div style={{ display: "grid", gap: 16 }}>
              <button
                type="button"
                onClick={() => codeInputRef.current?.focus()}
                style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "transparent", border: "none", padding: 0, cursor: "text", textAlign: "left" }}
              >
                {accessCodeSlots(code).map((digit, index) => (
                  <div
                    key={index}
                    style={{
                      width: 54,
                      height: 66,
                      borderRadius: 18,
                      border: `1px solid ${error ? "#ff5566" : digit ? "#2f6ea8" : "#dbe7f5"}`,
                      background: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: digit ? "0 14px 30px rgba(47,110,168,.12)" : "none",
                      fontFamily: "var(--fm)",
                      fontSize: 24,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {digit || ""}
                  </div>
                ))}
              </button>
              <input
                ref={codeInputRef}
                value={code}
                onChange={(event) => setCode(String(event.target.value || "").replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && canSubmit) handleSubmit();
                }}
                placeholder="000000"
                inputMode="numeric"
                aria-label="Código de acceso"
                style={{
                  width: 220,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: `1px solid ${error ? "#ff5566" : "#dbe7f5"}`,
                  outline: "none",
                  fontFamily: "var(--fm)",
                  fontSize: 18,
                  letterSpacing: 4,
                  color: "#0f172a",
                  background: "#ffffff",
                }}
              />
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Btn onClick={handleSubmit} s={{ minWidth: 180, opacity: canSubmit ? 1 : 0.65 }} disabled={!canSubmit}>Entrar al portal</Btn>
                <div style={{ fontSize: 12, color: "#6b7c93" }}>Este acceso está pensado para revisar avances, responder piezas y revisar documentos.</div>
              </div>
            </div>
            {error ? <div style={{ marginTop: 12, fontSize: 13, color: "#ff5566" }}>{error}</div> : null}
          </div>
        </div>
      </div>
    </PublicPortalShell>
  );
}

export function ClientPortalView({ empresas = [], slug = "", platformServices = null, platformApi = null }) {
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState(null);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState("resumen");
  const [contentDecisionFilter, setContentDecisionFilter] = useState("all");
  const [contentCampaignFilter, setContentCampaignFilter] = useState("");
  const [contentDecision, setContentDecision] = useState(null);
  const [budgetDecision, setBudgetDecision] = useState(null);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState("");

  const reloadPortalPayload = useRef(async () => {});

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const hadLightClass = document.body.classList.contains("light");
    document.body.classList.add("light");
    return () => {
      if (!hadLightClass) document.body.classList.remove("light");
    };
  }, []);

  useEffect(() => {
    let alive = true;
    reloadPortalPayload.current = async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const result = await resolvePortalPayload(empresas, slug);
        if (!alive) return;
        setPayload(result);
        const sessionKey = buildClientPortalSessionKey(slug);
        setAuthorized(typeof window !== "undefined" && window.sessionStorage.getItem(sessionKey) === "ok");
      } catch {
        if (!alive) return;
        setPayload({ error: "load_failed" });
      } finally {
        if (!alive) return;
        if (!silent) setLoading(false);
      }
    };
    void reloadPortalPayload.current();
    return () => {
      alive = false;
    };
  }, [empresas, slug]);

  useEffect(() => {
    if (typeof window === "undefined" || !authorized) return undefined;
    const handleFocusRefresh = () => { void reloadPortalPayload.current({ silent: true }); };
    const interval = window.setInterval(() => { void reloadPortalPayload.current({ silent: true }); }, 30000);
    window.addEventListener("focus", handleFocusRefresh);
    document.addEventListener("visibilitychange", handleFocusRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocusRefresh);
      document.removeEventListener("visibilitychange", handleFocusRefresh);
    };
  }, [authorized]);

  const summary = useMemo(() => {
    const empresa = payload?.empresa;
    const client = payload?.client;
    if (!empresa?.id || !client?.id) return null;
    const clientId = client.id;
    const activeProductions = (payload?.producciones || []).filter(item => item?.cliId === clientId);
    const activePrograms = (payload?.programas || []).filter(item => item?.cliId === clientId);
    const activeContent = (payload?.piezas || []).filter(item => item?.cliId === clientId);
    const budgets = (payload?.presupuestos || []).filter(item => item?.cliId === clientId);
    const invoices = buildTreasuryReceivables({
      facturas: (payload?.facturas || []).filter(item => item?.empId === empresa.id && item?.tipo === "cliente" && item?.entidadId === clientId),
      clientes: Array.isArray(payload?.clients) ? payload.clients : [client],
      receipts: Array.isArray(payload?.receipts) ? payload.receipts : [],
      empId: empresa.id,
    });
    const orders = (payload?.purchaseOrders || []).filter(item => item?.empId === empresa.id && item?.clientId === clientId);
    const overdueInvoices = invoices.filter(item => item?.bucket === "Vencido" && Number(item?.pending || 0) > 0);
    const pendingInvoices = invoices.filter(item => Number(item?.pending || 0) > 0);
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
      pendingAmount: pendingInvoices.reduce((sum, item) => sum + Number(item?.pending || 0), 0),
    };
  }, [payload]);

  const contentWorkspace = useMemo(() => {
    const campaigns = Array.isArray(summary?.activeContent) ? summary.activeContent : [];
    const campaignOptions = campaigns.map(item => ({ value: item.id, label: item.nom || "Campaña" }));
    const pieces = campaigns.flatMap(campaign => (Array.isArray(campaign?.piezas) ? campaign.piezas : []).filter(Boolean).map(piece => ({
      campaignId: campaign.id,
      campaignName: campaign.nom || "Campaña",
      campaignMonth: [campaign.mes, campaign.ano].filter(Boolean).join(" "),
      campaignStatus: campaign.est || "Planificada",
      campaignBrief: campaign.brief || "",
      piece,
    })));
    const reviewQueue = pieces.filter(item => !item.piece?.clientPortalDecision?.status);
    const responded = pieces.filter(item => !!item.piece?.clientPortalDecision?.status);
    const approved = pieces.filter(item => item.piece?.clientPortalDecision?.status === "approved");
    const observed = pieces.filter(item => item.piece?.clientPortalDecision?.status === "changes_requested");
    return {
      campaigns,
      campaignOptions,
      pieces,
      reviewQueue,
      responded,
      approved,
      observed,
    };
  }, [summary?.activeContent]);

  const filteredContentCampaigns = useMemo(() => {
    let rows = Array.isArray(contentWorkspace?.campaigns) ? contentWorkspace.campaigns : [];
    rows = rows.filter(item => item && typeof item === "object");
    if (contentCampaignFilter) rows = rows.filter(item => item.id === contentCampaignFilter);
    if (contentDecisionFilter === "queue") {
      rows = rows.filter(item => (Array.isArray(item.piezas) ? item.piezas : []).some(piece => !piece?.clientPortalDecision?.status));
    }
    if (contentDecisionFilter === "approved") {
      rows = rows.filter(item => (Array.isArray(item.piezas) ? item.piezas : []).some(piece => piece?.clientPortalDecision?.status === "approved"));
    }
    if (contentDecisionFilter === "changes") {
      rows = rows.filter(item => (Array.isArray(item.piezas) ? item.piezas : []).some(piece => piece?.clientPortalDecision?.status === "changes_requested"));
    }
    return rows;
  }, [contentWorkspace?.campaigns, contentCampaignFilter, contentDecisionFilter]);

  const visibleContentPieces = useMemo(() => (
    filteredContentCampaigns.flatMap(item => (
      (Array.isArray(item?.piezas) ? item.piezas : [])
        .filter(Boolean)
        .filter(piece => {
          const portalDecision = piece?.clientPortalDecision || null;
          if (contentDecisionFilter === "queue") return !portalDecision?.status;
          if (contentDecisionFilter === "approved") return portalDecision?.status === "approved";
          if (contentDecisionFilter === "changes") return portalDecision?.status === "changes_requested";
          return true;
        })
        .map(piece => ({
          campaignId: item.id,
          campaignName: item.nom || "Campaña",
          campaignMonth: [item.mes, item.ano].filter(Boolean).join(" "),
          campaignPlatform: item.plataforma || "Contenido",
          piece,
        }))
    ))
  ), [filteredContentCampaigns, contentDecisionFilter]);

  const safeFilteredContentCampaigns = useMemo(
    () => filteredContentCampaigns.filter(item => item && typeof item === "object"),
    [filteredContentCampaigns],
  );

  const contentDebugDetails = useMemo(() => {
    const ids = visibleContentPieces.slice(0, 6).map(item => safeText(item?.piece?.id, "sin-id")).join(", ");
    return `campanas=${safeFilteredContentCampaigns.length} · piezas=${visibleContentPieces.length}${ids ? ` · ids=${ids}` : ""}`;
  }, [safeFilteredContentCampaigns.length, visibleContentPieces]);

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

  const sendInternalPortalNotification = async ({
    subject = "",
    body = "",
    recipients = [],
    entityType = "client_portal",
    entityId = "",
  } = {}) => {
    const to = uniqueEmails(recipients);
    if (!to.length || !platformApi?.notifications?.sendTransactionalEmail || !payload?.empresa?.id) return;
    try {
      await platformApi.notifications.sendTransactionalEmail({
        tenantId: payload.empresa.id,
        templateKey: "client_portal_signal",
        subject: String(subject || "").trim(),
        to,
        text: String(body || "").trim(),
        html: `<p>${String(body || "").trim().replace(/\n/g, "<br />")}</p>`,
        entityType,
        entityId,
        metadata: {
          clientName: payload.client?.nom || "",
          portalSlug: payload.portal?.slug || "",
        },
      });
    } catch (error) {
      console.error("[client-portal] No pudimos enviar la notificación interna", error);
    }
  };

  const appendPortalWorkflowSignal = async ({
    eventName = "",
    entityType = "",
    entityId = "",
    signalPayload = {},
  } = {}) => {
    if (!payload?.empresa?.id || !eventName) return;
    await appendWorkflowEventEntry({
      empId: payload.empresa.id,
      stream: "client_portal",
      eventName,
      entityType,
      entityId,
      actor: buildPortalActor(payload),
      payload: {
        clientId: payload.client?.id || "",
        clientName: payload.client?.nom || "",
        portalSlug: payload.portal?.slug || "",
        ...((signalPayload && typeof signalPayload === "object") ? signalPayload : {}),
      },
      platformServices,
    });
  };

  const resolveContentRecipients = (campaignId = "", pieceId = "") => {
    const campaign = (Array.isArray(payload?.piezas) ? payload.piezas : []).find(item => item.id === campaignId);
    const piece = (Array.isArray(campaign?.piezas) ? campaign.piezas : []).find(item => item.id === pieceId);
    const responsibleEmail = normalizeEmailValue((Array.isArray(payload?.crew) ? payload.crew : []).find(member => member.id === piece?.responsableId)?.ema || "");
    return uniqueEmails([responsibleEmail, payload?.empresa?.ema || ""]);
  };

  const resolveBudgetRecipients = () => uniqueEmails([payload?.empresa?.ema || ""]);

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
    const portalAlert = {
      id: uid(),
      tipo: action?.includes("changes") || action?.includes("rejected") ? "urgente" : "info",
      area: "clientes",
      icon: "🗨️",
      titulo: `Portal cliente · ${payload.client.nom}`,
      sub: headline,
      body: `${headline}${text ? `\n\n${text}` : ""}`,
      createdAt: now,
      source: "client_portal",
      clientId: payload.client.id,
    };
    const nextEmpresas = (Array.isArray(currentEmpresas) ? currentEmpresas : []).map(item => item.id === payload.empresa.id
      ? { ...item, portalAlerts: [portalAlert, ...(Array.isArray(item.portalAlerts) ? item.portalAlerts : [])].slice(0, 50) }
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
    await appendPortalWorkflowSignal({
      eventName: "client_portal_accessed",
      entityType: "client",
      entityId: payload.client.id,
      signalPayload: {
        accessCodeProtected: true,
      },
    });
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
  ];

  const saveContentDecision = async () => {
    if (!contentDecision?.campaignId || !contentDecision?.pieceId || !contentDecision?.status) return;
    setDecisionSaving(true);
    setDecisionFeedback("");
    const briefNote = String(contentDecision.brief || "").trim();
    const commentNote = String(contentDecision.comment || "").trim();
    const requestedChangesNote = String(contentDecision.requestedChanges || "").trim();
    const summaryNote = buildPortalContentSummary({
      status: contentDecision.status,
      brief: briefNote,
      comment: commentNote,
      requestedChanges: requestedChangesNote,
    });
    const now = new Date().toISOString();
    const ok = await persistClientMutation({
      key: "piezas",
      payloadKey: "piezas",
      updater: (records = []) => (Array.isArray(records) ? records : []).map(campaign => {
        if (campaign.id !== contentDecision.campaignId) return campaign;
        const nextPieces = (Array.isArray(campaign.piezas) ? campaign.piezas : []).map(piece => {
          if (piece.id !== contentDecision.pieceId) return piece;
          const portalComment = {
            id: uid(),
            text: summaryNote || (contentDecision.status === "approved" ? "Cliente aprobó esta pieza desde el portal." : "Cliente solicitó correcciones desde el portal."),
            kind: contentDecision.status === "approved" ? "decision" : "risk",
            important: contentDecision.status !== "approved",
            attachments: [],
            photos: [],
            cr: String(now).slice(0, 10),
            createdAt: now,
            authorName: payload.client.nom || "Cliente",
            authorId: payload.client.id || "client_portal",
            source: "client_portal",
          };
          return {
            ...piece,
            approval: contentDecision.status === "approved" ? "Aprobada" : "Observada",
            clientPortalDecision: {
              status: contentDecision.status,
              brief: summaryNote,
              comment: commentNote,
              requestedChanges: requestedChangesNote,
              additionalBrief: briefNote,
              decidedAt: now,
              source: "client_portal",
            },
            brief: briefNote ? piece.brief ? `${piece.brief}\n\n[Cliente]\n${briefNote}` : `[Cliente]\n${briefNote}` : piece.brief || "",
            comentarios: [portalComment, ...(Array.isArray(piece.comentarios) ? piece.comentarios : [])].slice(0, 100),
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
    await appendPortalWorkflowSignal({
      eventName: contentDecision.status === "approved" ? "client_portal_content_approved" : "client_portal_content_changes_requested",
      entityType: "content_piece",
      entityId: contentDecision.pieceId,
      signalPayload: {
        campaignId: contentDecision.campaignId,
        decision: contentDecision.status,
        brief: summaryNote,
        comment: commentNote,
        requestedChanges: requestedChangesNote,
      },
    });
    await appendPortalActivityAndSystemMessage({
      headline: contentDecision.status === "approved" ? "Contenido aprobado por el cliente" : "Cliente solicitó cambios en contenido",
      secondary: `${payload.client.nom} respondió desde su portal en contenidos.`,
      text: summaryNote,
      action: contentDecision.status === "approved" ? "content_approved" : "content_changes_requested",
    });
    await sendInternalPortalNotification({
      subject: contentDecision.status === "approved"
        ? `${payload.client.nom} aprobó un contenido en Produ`
        : `${payload.client.nom} pidió cambios en un contenido`,
      body: [
        `${payload.client.nom} respondió desde su portal cliente.`,
        contentDecision.status === "approved" ? "La pieza quedó aprobada por el cliente." : "La pieza quedó observada por el cliente.",
        summaryNote ? `\nDetalle:\n${summaryNote}` : "",
      ].filter(Boolean).join("\n\n"),
      recipients: resolveContentRecipients(contentDecision.campaignId, contentDecision.pieceId),
      entityType: "content_piece",
      entityId: contentDecision.pieceId,
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
        estado: budgetDecision.status === "approved" ? "Aceptado" : "Rechazado",
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
    await appendPortalWorkflowSignal({
      eventName: budgetDecision.status === "approved" ? "client_portal_budget_approved" : "client_portal_budget_rejected",
      entityType: "budget",
      entityId: budgetDecision.budgetId,
      signalPayload: {
        decision: budgetDecision.status,
        note,
      },
    });
    await appendPortalActivityAndSystemMessage({
      headline: budgetDecision.status === "approved" ? "Presupuesto aprobado por el cliente" : "Cliente observó un presupuesto",
      secondary: `${payload.client.nom} respondió desde su portal en presupuestos.`,
      text: note,
      action: budgetDecision.status === "approved" ? "budget_approved" : "budget_rejected",
    });
    await sendInternalPortalNotification({
      subject: budgetDecision.status === "approved"
        ? `${payload.client.nom} aprobó un presupuesto en Produ`
        : `${payload.client.nom} observó un presupuesto en Produ`,
      body: [
        `${payload.client.nom} respondió desde su portal cliente.`,
        budgetDecision.status === "approved" ? "El presupuesto quedó aprobado por el cliente." : "El presupuesto quedó observado por el cliente.",
        note ? `\nComentario:\n${note}` : "",
      ].filter(Boolean).join("\n\n"),
      recipients: resolveBudgetRecipients(),
      entityType: "budget",
      entityId: budgetDecision.budgetId,
    });
    setDecisionFeedback(budgetDecision.status === "approved" ? "Presupuesto aprobado correctamente." : "Presupuesto marcado con observaciones del cliente.");
    setBudgetDecision(null);
  };

  return (
    <PublicPortalShell>
      <div style={{ display: "grid", gap: 20 }}>
        <div style={{ background: "#ffffff", border: "1px solid #dbe6f3", borderRadius: 28, boxShadow: "0 28px 80px rgba(15,23,42,.10)", overflow: "hidden" }}>
          <div style={{ padding: "30px 30px 24px", borderBottom: "1px solid #e8eef8", display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap", alignItems: "flex-start", background: "linear-gradient(135deg, rgba(47,110,168,.10), rgba(255,255,255,.96) 48%, rgba(47,110,168,.04))" }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: 800, color: "#2f6ea8", marginBottom: 10 }}>Portal cliente</div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{payload.client.nom}</div>
              <div style={{ marginTop: 8, fontSize: 14, color: "#5b6b82" }}>{headerMeta}</div>
              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                <div style={{ background: "#f7faff", border: "1px solid #dbe7f5", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>Contenidos por revisar</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#2f6ea8", marginTop: 6 }}>{summary?.pendingApprovals.length || 0}</div>
                </div>
                <div style={{ background: "#faf7ff", border: "1px solid #eadcff", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>Campañas activas</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#8e5cf6", marginTop: 6 }}>{summary?.activeContent.length || 0}</div>
                </div>
                <div style={{ background: "#fff8f4", border: "1px solid #ffe0cf", borderRadius: 16, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>Piezas visibles</div>
                  <div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#e1712f", marginTop: 6 }}>{summary?.totalContentPieces || 0}</div>
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gap: 10, minWidth: 280, flex: "0 0 320px" }}>
              <div style={{ background: "#f7faff", border: "1px solid #dbe7f5", borderRadius: 18, padding: "16px 18px", boxShadow: "0 16px 36px rgba(15,23,42,.05)" }}>
                <div style={{ fontSize: 11, letterSpacing: 1.3, textTransform: "uppercase", color: "#6b7c93", fontWeight: 800, marginBottom: 8 }}>Lo más importante hoy</div>
                <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#334155" }}>
                  <div>• {summary?.pendingApprovals.length || 0} contenido(s) esperan tu revisión.</div>
                  <div>• {summary?.activeContent.length || 0} campaña(s) siguen activas en este espacio.</div>
                  <div>• {summary?.activeProductions.length || 0} producción(es) están visibles desde tu portal.</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Badge label={`${summary?.pendingApprovals.length || 0} contenido(s) por revisar`} color="purple" />
                <Badge label={`${summary?.activeContent.length || 0} campaña(s) activas`} color="cyan" />
                <Badge label={`${summary?.totalContentPieces || 0} pieza(s) visibles`} color="yellow" />
                <GBtn onClick={() => {
                  const sessionKey = buildClientPortalSessionKey(slug);
                  if (typeof window !== "undefined") window.sessionStorage.removeItem(sessionKey);
                  setAuthorized(false);
                }}>Cerrar portal</GBtn>
              </div>
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
                    border: `1px solid ${tab === id ? accent : "#dbe7f5"}`,
                    background: tab === id ? accent : "#ffffff",
                    color: tab === id ? "#ffffff" : "#475569",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: tab === id ? "0 12px 30px rgba(15,23,42,.10)" : "none",
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
                  <div>• {summary?.activeContent.length || 0} campaña(s) están activas y visibles para tu equipo.</div>
                  <div>• {summary?.totalContentPieces || 0} pieza(s) ya están disponibles en este portal.</div>
                  <div>• {summary?.activeProductions.length || 0} producción(es) siguen en curso.</div>
                </div>
              </Card>
              <Card title="Cómo usar este espacio" sub="Aquí puedes revisar avances y responder lo que hoy necesita confirmación.">
                <div style={{ display: "grid", gap: 10 }}>
                  <div>• En contenidos puedes aprobar piezas o pedir ajustes con observaciones claras.</div>
                  <div>• El brief adicional y los comentarios quedarán visibles dentro de Produ.</div>
                  <div>• La relación documental y financiera ahora vive en un portal independiente.</div>
                </div>
              </Card>
            </div>
          </>
        ) : null}

        {tab === "contenidos" ? (
          <PortalSectionBoundary onBack={() => setTab("resumen")} details={contentDebugDetails}>
            <div style={{ background: "#ffffff", border: "1px solid #dbe6f3", borderRadius: 28, padding: 24, boxShadow: "0 20px 50px rgba(15,23,42,.06)" }}>
              <div style={{ display: "grid", gap: 18 }}>
                <div>
                  <div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Contenidos</div>
                  <div style={{ fontSize: 14, color: "#5b6b82", marginTop: 8, lineHeight: 1.7 }}>
                    Aquí puedes revisar piezas, abrir su previsualización y responder con aprobación, comentario, brief adicional o solicitud de corrección.
                  </div>
                </div>

                {Array.isArray(summary?.activeContent) && summary.activeContent.length ? (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12 }}>
                      {[
                        ["Pendientes", contentWorkspace.reviewQueue.length, "#2f6ea8"],
                        ["Aprobadas", contentWorkspace.approved.length, "#00b894"],
                        ["Con cambios", contentWorkspace.observed.length, "#ff8844"],
                        ["Piezas visibles", visibleContentPieces.length, "#8b5cf6"],
                      ].map(([label, value, color]) => (
                        <div key={label} style={{ borderRadius: 18, border: "1px solid #dbe7f5", background: "#f8fbff", padding: "14px 16px" }}>
                          <div style={{ fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>{label}</div>
                          <div style={{ fontFamily: "var(--fm)", fontSize: 28, fontWeight: 800, color, marginTop: 8 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "end" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {[
                          ["all", "Todo"],
                          ["queue", "Por revisar"],
                          ["approved", "Aprobadas"],
                          ["changes", "Con cambios"],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setContentDecisionFilter(value)}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 999,
                              border: `1px solid ${contentDecisionFilter === value ? "#2f6ea8" : "#dbe7f5"}`,
                              background: contentDecisionFilter === value ? "#2f6ea8" : "#ffffff",
                              color: contentDecisionFilter === value ? "#ffffff" : "#475569",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#6b7c93", fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Campaña</div>
                        <select
                          value={contentCampaignFilter}
                          onChange={(event) => setContentCampaignFilter(event.target.value)}
                          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe7f5", background: "#ffffff", color: "#0f172a", fontSize: 13 }}
                        >
                          <option value="">Todas las campañas</option>
                          {contentWorkspace.campaignOptions.map(option => (
                            <option key={option.value} value={option.value}>{safeText(option.label, "Campaña")}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {visibleContentPieces.length ? (
                      <div style={{ display: "grid", gap: 14 }}>
                        {visibleContentPieces.map((item) => {
                          const piece = item?.piece;
                          if (!piece?.id) return null;
                          const portalDecision = piece?.clientPortalDecision || null;
                          const tone = portalResponseTone(portalDecision?.status);
                          const previewUrl = resolvePiecePreviewUrl(piece);
                          const approvalLabel = safeText(piece.approval, "Pendiente");
                          return (
                            <div key={piece.id} style={{ padding: 18, borderRadius: 22, background: "#ffffff", border: "1px solid #dbe7f5", boxShadow: "0 14px 28px rgba(15,23,42,.05)" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 18, alignItems: "start" }}>
                                <div style={{ display: "grid", gap: 12 }}>
                                  <div>
                                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>{safeText(piece.nom, "Pieza")}</div>
                                    <div style={{ fontSize: 13, color: "#6b7c93", marginTop: 4 }}>
                                      {safeText(item.campaignName, "Campaña")} · {safeText(item.campaignMonth, "Sin mes")}
                                    </div>
                                  </div>

                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
                                    <div style={{ borderRadius: 14, background: "#f7faff", border: "1px solid #dbe7f5", padding: "10px 12px" }}>
                                      <div style={{ fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>Estado</div>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{safeText(piece.est, "En revisión")}</div>
                                    </div>
                                    <div style={{ borderRadius: 14, background: "#f7faff", border: "1px solid #dbe7f5", padding: "10px 12px" }}>
                                      <div style={{ fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>Formato</div>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>{safeText(piece.formato, "Entregable")}</div>
                                    </div>
                                    <div style={{ borderRadius: 14, background: "#f7faff", border: "1px solid #dbe7f5", padding: "10px 12px" }}>
                                      <div style={{ fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>Aprobación</div>
                                      <div style={{ fontSize: 13, fontWeight: 700, color: approvalLabel === "Aprobada" ? "#00b894" : approvalLabel === "Observada" ? "#e1712f" : "#0f172a", marginTop: 4 }}>{approvalLabel}</div>
                                    </div>
                                  </div>

                                  <div style={{ display: "grid", gap: 8 }}>
                                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                                      <b style={{ color: "#0f172a" }}>Plataforma:</b> {safeText(piece.plataforma || item.campaignPlatform, "Contenido")}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
                                      <b style={{ color: "#0f172a" }}>Entrega:</b> {fmtDate(piece.fecha || piece.fechaEntrega || piece.publishDate || "")}
                                    </div>
                                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                                      <b style={{ color: "#0f172a" }}>Brief:</b> {safeText(piece.brief || piece.objetivo || piece.des || "Sin brief aún", "Sin brief aún")}
                                    </div>
                                  </div>

                                  {portalDecision?.brief ? (
                                    <div style={{ borderRadius: 14, background: tone.bg, border: `1px solid ${tone.border}`, padding: "12px 14px", fontSize: 12, color: tone.color, lineHeight: 1.7, whiteSpace: "pre-line" }}>
                                      <b style={{ color: "#0f172a" }}>Última respuesta registrada:</b> {safeText(portalDecision.brief, "")}
                                    </div>
                                  ) : null}
                                </div>

                                <div style={{ borderRadius: 18, border: "1px solid #dbe7f5", background: "linear-gradient(180deg,#f8fbff,#ffffff)", padding: 14, display: "grid", gap: 12 }}>
                                  <div>
                                    <div style={{ fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase", color: "#6b7c93", fontWeight: 700 }}>Previsualización</div>
                                    {previewUrl ? (
                                      isLikelyImageUrl(previewUrl) ? (
                                        <img src={previewUrl} alt={safeText(piece.nom, "Pieza")} style={{ width: "100%", height: 152, objectFit: "cover", borderRadius: 12, marginTop: 8, border: "1px solid #dbe7f5", background: "#ffffff" }} />
                                      ) : (
                                        <div style={{ marginTop: 8, borderRadius: 12, background: "#ffffff", border: "1px solid #dbe7f5", padding: 14, fontSize: 12, color: "#5b6b82", lineHeight: 1.6 }}>
                                          Esta pieza tiene un enlace de revisión. Puedes abrirlo desde los accesos directos de abajo.
                                        </div>
                                      )
                                    ) : (
                                      <div style={{ marginTop: 8, borderRadius: 12, background: "#ffffff", border: "1px dashed #dbe7f5", padding: 14, fontSize: 12, color: "#5b6b82", lineHeight: 1.6 }}>
                                        Todavía no hay una vista previa cargada para esta pieza.
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {safeUrl(piece.link) ? <a href={safeUrl(piece.link)} target="_blank" rel="noreferrer" style={{ color: "#2f6ea8", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver trabajo ↗</a> : null}
                                    {safeUrl(piece.finalLink) ? <a href={safeUrl(piece.finalLink)} target="_blank" rel="noreferrer" style={{ color: "#2f6ea8", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Ver final ↗</a> : null}
                                  </div>

                                  <div style={{ display: "grid", gap: 8 }}>
                                    <GBtn onClick={() => setContentDecision({ campaignId: item.campaignId, pieceId: piece.id, status: "approved", brief: portalDecision?.additionalBrief || "", comment: portalDecision?.comment || "", requestedChanges: "" })}>Aprobar pieza</GBtn>
                                    <GBtn onClick={() => setContentDecision({ campaignId: item.campaignId, pieceId: piece.id, status: "changes_requested", brief: portalDecision?.additionalBrief || "", comment: portalDecision?.comment || "", requestedChanges: portalDecision?.requestedChanges || "" })}>Pedir cambios</GBtn>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ borderRadius: 18, border: "1px dashed #dbe7f5", padding: 18, color: "#5b6b82", background: "#f8fbff" }}>
                        No hay piezas visibles con el filtro actual. Puedes cambiar la campaña o volver a “Todo”.
                      </div>
                    )}
                  </>
                ) : (
                  <Empty text="Todavía no hay campañas visibles" sub="Cuando este cliente tenga contenidos asociados, aparecerán aquí." />
                )}
              </div>
            </div>
          </PortalSectionBoundary>
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
            <Card title="Documentos y pagos" sub="Una vista rápida de facturas y vencimientos asociados a este cliente." style={{ background: "linear-gradient(180deg, #fff8f4, #ffffff)", borderColor: "#ffe0cf" }}>
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
                      const state = item?.cobranza || "Pendiente";
                      return (
                        <tr key={item.id}>
                          <TD bold>{item.correlativo || item.tipoDoc || "Documento"}</TD>
                          <TD>{fmtDate(item.fechaEmision || item.fecha || "")}</TD>
                          <TD>{fmtDate(item.fechaVencimiento || "")}</TD>
                          <TD mono>{fmtMoney((Number(item.pending || 0) > 0 ? item.pending : item.total) || 0)}</TD>
                          <TD><Badge label={state || "Pendiente"} color={state === "Pagado" ? "green" : (item.bucket === "Vencido" ? "red" : "yellow")} /></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div> : <Empty text="No hay documentos visibles" sub="Cuando existan facturas o documentos asociados a este cliente, aparecerán aquí." />}
            </Card>
          </>
        ) : null}

        {decisionFeedback ? <Card><div style={{ fontSize: 13, color: "#0f172a" }}>{decisionFeedback}</div></Card> : null}
      </div>

      <Modal
        open={!!contentDecision}
        onClose={() => !decisionSaving && setContentDecision(null)}
        title={contentDecision?.status === "approved" ? "Aprobar contenido" : "Pedir cambios"}
        sub={contentDecision?.status === "approved" ? "Puedes aprobar la pieza tal como está o dejar un brief complementario." : "Deja indicaciones claras para que el equipo ajuste esta pieza."}
      >
        {contentDecision ? (() => {
          const campaign = (Array.isArray(payload?.piezas) ? payload.piezas : []).find(item => item.id === contentDecision.campaignId);
          const piece = (Array.isArray(campaign?.piezas) ? campaign.piezas : []).find(item => item.id === contentDecision.pieceId);
          const previewUrl = resolvePiecePreviewUrl(piece);
          return (
            <div style={{ display: "grid", gap: 14, marginBottom: 16 }}>
              <div style={{ borderRadius: 18, border: "1px solid #dbe7f5", background: "linear-gradient(180deg,#f8fbff,#ffffff)", padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontFamily: "var(--fh)", fontSize: 17, fontWeight: 900, color: "#0f172a" }}>{piece?.nom || "Pieza"}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#6b7c93" }}>{campaign?.nom || "Campaña"} · {piece?.tipo || "Contenido"} · {piece?.formato || "Entregable"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {piece?.plataforma ? <Badge label={piece.plataforma} color="purple" /> : null}
                    {piece?.approval ? <Badge label={piece.approval} color={piece.approval === "Aprobada" ? "green" : piece.approval === "Observada" ? "red" : "yellow"} /> : null}
                  </div>
                </div>
                {previewUrl ? (
                  <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                    {isLikelyImageUrl(previewUrl) ? <img src={previewUrl} alt={piece?.nom || "Pieza"} style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 16, border: "1px solid #dbe7f5" }} /> : null}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {piece?.link ? <a href={piece.link} target="_blank" rel="noreferrer" style={{ color: "#2f6ea8", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Abrir versión de trabajo ↗</a> : null}
                      {piece?.finalLink ? <a href={piece.finalLink} target="_blank" rel="noreferrer" style={{ color: "#2f6ea8", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>Abrir versión final ↗</a> : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })() : null}
        <FG label="Brief adicional">
          <FTA
            value={contentDecision?.brief || ""}
            onChange={(event) => setContentDecision(current => current ? { ...current, brief: event.target.value } : current)}
            placeholder="Agrega contexto, tono, referencias o foco para el equipo."
            style={{ minHeight: 90 }}
          />
        </FG>
        <FG label="Comentario">
          <FTA
            value={contentDecision?.comment || ""}
            onChange={(event) => setContentDecision(current => current ? { ...current, comment: event.target.value } : current)}
            placeholder="Comparte observaciones, dudas o contexto adicional sobre esta pieza."
            style={{ minHeight: 90 }}
          />
        </FG>
        {contentDecision?.status === "changes_requested" ? (
          <FG label="Corrección solicitada">
            <FTA
              value={contentDecision?.requestedChanges || ""}
              onChange={(event) => setContentDecision(current => current ? { ...current, requestedChanges: event.target.value } : current)}
              placeholder="Explica exactamente qué debe corregirse antes de aprobar esta pieza."
              style={{ minHeight: 120 }}
            />
          </FG>
        ) : null}
        <div style={{ borderRadius: 16, padding: "12px 14px", background: portalResponseTone(contentDecision?.status).bg, border: `1px solid ${portalResponseTone(contentDecision?.status).border}`, color: portalResponseTone(contentDecision?.status).color, fontSize: 12, lineHeight: 1.6 }}>
          {contentDecision?.status === "approved"
            ? "Tu aprobación quedará registrada y el equipo verá inmediatamente que esta pieza ya fue validada desde el portal."
            : "Tu observación quedará visible para el equipo junto con el comentario que dejes aquí."}
        </div>
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
        <div style={{ borderRadius: 16, padding: "12px 14px", background: portalResponseTone(budgetDecision?.status).bg, border: `1px solid ${portalResponseTone(budgetDecision?.status).border}`, color: portalResponseTone(budgetDecision?.status).color, fontSize: 12, lineHeight: 1.6 }}>
          {budgetDecision?.status === "approved"
            ? "La respuesta quedará guardada para que el equipo continúe con el siguiente paso comercial."
            : "La observación quedará registrada junto con tu comentario para que el presupuesto pueda revisarse."}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <GBtn onClick={() => setBudgetDecision(null)}>Cancelar</GBtn>
          <Btn onClick={saveBudgetDecision} s={{ opacity: decisionSaving ? 0.7 : 1 }}>{budgetDecision?.status === "approved" ? "Confirmar aprobación" : "Guardar observación"}</Btn>
        </div>
      </Modal>
    </PublicPortalShell>
  );
}
