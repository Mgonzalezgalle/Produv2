import React, { useState } from "react";
import { ContactBtns } from "../shared/ContactButtons";
import { ConfirmActionDialog } from "../shared/ConfirmActionDialog";
import { TransactionalEmailComposerModal } from "../shared/TransactionalEmailComposerModal";
import { ActivityTimelineCard } from "../shared/ActivityTimelineCard";
import { ActivityTimelinePreviewModal } from "../shared/ActivityTimelinePreviewModal";
import { resolveTransactionalEmailTemplate } from "../../lib/integrations/transactionalEmailTemplates";
import { normalizeCommentAttachments } from "../../lib/utils/helpers";
import {
  Badge,
  Btn,
  Card,
  DetHeader,
  DBtn,
  Empty,
  FilterSel,
  GBtn,
  KV,
  ModuleHeader,
  Modal,
  Paginator,
  SearchBar,
  Sep,
  Stat,
  TD,
  TH,
  ViewModeToggle,
} from "../../lib/ui/components";

function timelineMeta(item = {}) {
  const safeType = String(item?.type || "").trim().toLowerCase();
  if (safeType === "email" || item?.to || item?.subject) return { label: "Correo", eyebrow: "Mensaje", accent: "#4f7cff" };
  if (safeType === "comment") return { label: "Comentario", eyebrow: "Registro", accent: "#94a3b8" };
  return { label: "Actividad", eyebrow: "Registro", accent: "#94a3b8" };
}

function timelineHeadline(item = {}) {
  return String(item?.subject || "").trim() || String(item?.text || "").split("\n")[0]?.trim() || "Registro sin asunto";
}

function timelineSecondary(item = {}) {
  if (item?.to) return `Para ${item.to}`;
  if (item?.byName) return `Registrado por ${item.byName}`;
  return "Sin contexto adicional";
}

export function ViewClientes({
  empresa,
  clientes,
  producciones,
  movimientos,
  navTo,
  openM,
  canDo,
  useBal,
  ini,
  fmtM,
}) {
  const empId = empresa?.id;
  const bal = useBal(movimientos, empId);
  const [q, setQ] = useState("");
  const [fi, setFi] = useState("");
  const [sortMode, setSortMode] = useState("az");
  const [vista, setVista] = useState("cards");
  const [pg, setPg] = useState(1);
  const PP = 9;
  const fd = (clientes || [])
    .filter(x => x.empId === empId)
    .filter(c => (
      c.nom.toLowerCase().includes(q.toLowerCase()) ||
      (c.contactos || []).some(co => co.nom.toLowerCase().includes(q.toLowerCase()))
    ) && (!fi || c.ind === fi))
    .sort((a, b) => {
      if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
      if (sortMode === "recent") return String(b.cr || "").localeCompare(String(a.cr || ""));
      if (sortMode === "oldest") return String(a.cr || "").localeCompare(String(b.cr || ""));
      return String(a.nom || "").localeCompare(String(b.nom || ""));
    });
  const canEdit = canDo?.("clientes");
  const bsaleClientReady = client => Boolean(
    String(client?.nom || "").trim()
    && String(client?.rut || "").trim()
    && String(client?.dir || "").trim()
    && String(client?.ciudad || "").trim()
    && String(client?.comuna || "").trim()
  );

  return (
    <div>
      <ModuleHeader
        module="Clientes"
        title="Clientes"
        description="Administra tu cartera, contactos y cupos de crédito desde una sola vista comercial."
        actions={canEdit && <Btn onClick={() => openM("cli", {})}>+ Nuevo Cliente</Btn>}
      />
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar cliente o contacto..." />
        <FilterSel value={fi} onChange={v => { setFi(v); setPg(1); }} options={["Retail", "Tecnología", "Salud", "Educación", "Entretenimiento", "Gastronomía", "Inmobiliaria", "Servicios", "Media", "Gobierno", "Otro"]} placeholder="Todas industrias" />
        <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }, { value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }]} placeholder="Ordenar" />
        <ViewModeToggle value={vista} onChange={setVista} />
      </div>
      {vista === "cards" ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
            {fd.slice((pg - 1) * PP, pg * PP).map(c => {
              const pr = (producciones || []).filter(p => p.cliId === c.id).length;
              let ti = 0;
              let tg = 0;
              (producciones || []).filter(p => p.cliId === c.id).forEach(p => { const b = bal(p.id); ti += b.i; tg += b.g; });
              return (
                <div key={c.id} onClick={() => navTo("cli-det", c.id)} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: 20, cursor: "pointer", transition: ".15s" }} onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }} onMouseLeave={e => { e.currentTarget.style.transform = ""; }}>
                  <div style={{ width: 44, height: 44, background: "var(--cg)", border: "1px solid var(--cm)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--fh)", fontSize: 15, fontWeight: 800, color: "var(--cy)", marginBottom: 14 }}>{ini(c.nom)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{c.nom}</div>
                    <Badge sm label={bsaleClientReady(c) ? "Facturable" : "No facturable"} color={bsaleClientReady(c) ? "green" : "yellow"} />
                  </div>
                  <div style={{ fontSize: 11, color: "var(--gr2)" }}>{c.ind || "Sin industria"}</div>
                  <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 5 }}>Cupo: {Number(c.creditLimit || 0) > 0 ? fmtM(c.creditLimit) : "No definido"}</div>
                  {(c.contactos || []).slice(0, 2).map(co => <div key={co.id} style={{ fontSize: 11, color: "var(--gr2)", marginTop: 5 }}>👤 {co.nom}{co.car ? ` · ${co.car}` : ""}</div>)}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
                    <span style={{ fontSize: 11, color: "var(--cy)" }}>{pr} prod.</span>
                    <span style={{ fontSize: 11, color: ti - tg >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)" }}>{fmtM(ti - tg)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          {!fd.length && <Empty text="Sin clientes" sub="Crea el primero con el botón superior" />}
          <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
        </>
      ) : (
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Nombre</TH>
                  <TH>Industria</TH>
                  <TH>Contacto Principal</TH>
                  <TH>Bsale</TH>
                  <TH>Email</TH>
                  <TH>Teléfono</TH>
                  <TH>Cupo</TH>
                  <TH title="Orden calculado desde el selector">Balance</TH>
                  <TH></TH>
                </tr>
              </thead>
              <tbody>
                {fd.slice((pg - 1) * PP, pg * PP).map(c => {
                  let ti = 0;
                  let tg = 0;
                  (producciones || []).filter(p => p.cliId === c.id).forEach(p => { const b = bal(p.id); ti += b.i; tg += b.g; });
                  const pc = (c.contactos || [])[0];
                  return (
                    <tr key={c.id} onClick={() => navTo("cli-det", c.id)}>
                      <TD bold>{c.nom}</TD>
                      <TD>{c.ind || "—"}</TD>
                      <TD>{pc ? pc.nom : "—"}</TD>
                      <TD><Badge sm label={bsaleClientReady(c) ? "Facturable" : "No facturable"} color={bsaleClientReady(c) ? "green" : "yellow"} /></TD>
                      <TD style={{ fontSize: 11 }}>{pc?.ema || "—"}</TD>
                      <TD style={{ fontSize: 11 }}>{pc?.tel || "—"}</TD>
                      <TD mono>{Number(c.creditLimit || 0) > 0 ? fmtM(c.creditLimit) : "—"}</TD>
                      <TD style={{ color: ti - tg >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(ti - tg)}</TD>
                      <TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("cli-det", c.id); }}>Ver →</GBtn></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
        </Card>
      )}
    </div>
  );
}

export function ViewCliDet({
  id,
  empresa,
  clientes,
  producciones,
  programas,
  piezas,
  contratos,
  movimientos,
  navTo,
  openM,
  canDo,
  cDel,
  setClientes,
  useBal,
  fmtM,
  fmtD,
  countCampaignPieces,
  ini,
  ntf,
  platformApi,
  user,
}) {
  const empId = empresa?.id;
  const canManageClients = !!canDo?.("clientes");
  const bal = useBal(movimientos, empId);
  const c = (clientes || []).find(x => x.id === id);
  const [proSort, setProSort] = useState("name-asc");
  const [pgSort, setPgSort] = useState("name-asc");
  const [pzSort, setPzSort] = useState("name-asc");
  const prs = (producciones || []).filter(p => p.cliId === id);
  const pgs = (programas || []).filter(p => p.cliId === id);
  const ctn = (piezas || []).filter(p => p.cliId === id);
  const cts = (contratos || []).filter(x => x.cliId === id);
  let ti = 0;
  let tg = 0;
  prs.forEach(p => { const b = bal(p.id); ti += b.i; tg += b.g; });
  pgs.forEach(p => { const b = bal(p.id); ti += b.i; tg += b.g; });
  ctn.forEach(p => { const b = bal(p.id); ti += b.i; tg += b.g; });
  const sortedPrs = [...prs].sort((a, b) => {
    const ba = bal(a.id).b;
    const bb = bal(b.id).b;
    if (proSort === "name-desc") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (proSort === "date-desc") return String(b.ini || b.cr || "").localeCompare(String(a.ini || a.cr || ""));
    if (proSort === "date-asc") return String(a.ini || a.cr || "").localeCompare(String(b.ini || b.cr || ""));
    if (proSort === "balance-desc") return bb - ba;
    if (proSort === "balance-asc") return ba - bb;
    return String(a.nom || "").localeCompare(String(b.nom || ""));
  });
  const sortedPgs = [...pgs].sort((a, b) => {
    const ba = bal(a.id).b;
    const bb = bal(b.id).b;
    if (pgSort === "name-desc") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (pgSort === "date-desc") return String(b.cr || "").localeCompare(String(a.cr || ""));
    if (pgSort === "date-asc") return String(a.cr || "").localeCompare(String(b.cr || ""));
    if (pgSort === "balance-desc") return bb - ba;
    if (pgSort === "balance-asc") return ba - bb;
    return String(a.nom || "").localeCompare(String(b.nom || ""));
  });
  const sortedCtn = [...ctn].sort((a, b) => {
    const ba = bal(a.id).b;
    const bb = bal(b.id).b;
    if (pzSort === "name-desc") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (pzSort === "date-desc") return String(`${b.ano || ""}-${b.mes || ""}`).localeCompare(String(`${a.ano || ""}-${a.mes || ""}`));
    if (pzSort === "date-asc") return String(`${a.ano || ""}-${a.mes || ""}`).localeCompare(String(`${b.ano || ""}-${b.mes || ""}`));
    if (pzSort === "balance-desc") return bb - ba;
    if (pzSort === "balance-asc") return ba - bb;
    return String(a.nom || "").localeCompare(String(b.nom || ""));
  });
  const [emailChoice, setEmailChoice] = useState(null);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [emailComposerDraft, setEmailComposerDraft] = useState(null);
  const [emailComposerSending, setEmailComposerSending] = useState(false);
  const [emailPreview, setEmailPreview] = useState(null);
  const [deleteClientConfirmOpen, setDeleteClientConfirmOpen] = useState(false);
  if (!c) return <Empty text="No encontrado" />;
  const emailHistory = Array.isArray(c.emailHistory) ? [...c.emailHistory].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))) : [];
  const recordClientEmail = async ({ draft, recipients, delivery = null, source = "remote" }) => {
    if (!c?.id) return;
    const nextEntry = {
      id: `client_mail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      subject: String(draft?.subject || "").trim(),
      to: recipients.join(", "),
      text: String(draft?.body || "").trim(),
      attachments: Array.isArray(draft?.attachments) ? draft.attachments : [],
      createdAt: new Date().toISOString(),
      byName: user?.name || user?.nom || user?.email || "Usuario",
      byEmail: user?.email || "",
      source,
      delivery,
    };
    const nextClients = (clientes || []).map(item => item.id === c.id ? { ...item, emailHistory: [nextEntry, ...(Array.isArray(item.emailHistory) ? item.emailHistory : [])].slice(0, 50) } : item);
    await setClientes(nextClients);
  };
  const openClientEmailChoice = contact => {
    if (!contact?.ema) return;
    setEmailChoice(contact);
  };
  const openClientEmailComposer = contact => {
    if (!contact?.ema) return;
    const resolved = resolveTransactionalEmailTemplate(empresa, "client_contact", {
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      contactName: contact.nom || c.nom || "equipo",
      messageBody: `Queríamos tomar contacto con ${c.nom || "ustedes"} para dar continuidad a la gestión.`,
    });
    setEmailComposerDraft({
      tenantId: empresa?.id || "",
      templateKey: "client_contact",
      subject: `Notificación de ${empresa?.nombre || empresa?.nom || "Produ"}`,
      to: contact.ema,
      body: resolved.body,
      entityType: "client",
      entityId: c.id || "",
      metadata: {
        companyName: empresa?.nombre || empresa?.nom || "Produ",
        entityLabel: c.nom || "",
        contactName: contact.nom || "",
      },
    });
    setEmailChoice(null);
    setEmailComposerOpen(true);
  };
  const closeClientEmailComposer = () => {
    if (emailComposerSending) return;
    setEmailComposerOpen(false);
    setEmailComposerDraft(null);
  };
  const sendClientEmail = async (draft) => {
    const recipients = String(draft?.to || "").split(",").map(item => item.trim()).filter(Boolean);
    if (!recipients.length) {
      window.alert("Debes indicar al menos un destinatario.");
      return;
    }
    if (!String(draft?.subject || "").trim() || !String(draft?.body || "").trim()) {
      window.alert("El asunto y el cuerpo del correo son obligatorios.");
      return;
    }
    setEmailComposerSending(true);
    try {
      const payload = {
        tenantId: draft?.tenantId || empresa?.id || "",
        templateKey: draft?.templateKey || "client_contact",
        subject: String(draft?.subject || "").trim(),
        to: recipients,
        text: String(draft?.body || "").trim(),
        html: `<p>${String(draft?.body || "").trim().replace(/\n/g, "<br />")}</p>`,
        replyTo: String(user?.email || "").trim() || undefined,
        attachments: Array.isArray(draft?.attachments) ? draft.attachments : [],
        entityType: draft?.entityType || "client",
        entityId: draft?.entityId || "",
        metadata: draft?.metadata || {},
      };
      const remoteResult = await platformApi?.notifications?.sendTransactionalEmail?.(payload);
      if (!remoteResult?.ok) {
        if (remoteResult?.message) {
          window.alert(`Resend no pudo entregar este correo todavía.\n\n${remoteResult.message}`);
        }
        window.open(`mailto:${encodeURIComponent(recipients.join(","))}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.text)}`, "_blank");
        ntf?.(`Abrimos tu cliente de correo para ${recipients.join(", ")}.`);
        await recordClientEmail({ draft, recipients, source: "mailto_fallback" });
      } else {
        ntf?.(`Correo enviado a ${recipients.join(", ")} ✓`);
        await recordClientEmail({ draft, recipients, source: remoteResult?.source || "remote", delivery: remoteResult?.delivery || null });
      }
      setEmailComposerOpen(false);
      setEmailComposerDraft(null);
    } finally {
      setEmailComposerSending(false);
    }
  };
  const associationBlocks = [
    {
      key: "pro",
      title: "Proyectos",
      count: prs.length,
      action: canDo?.("producciones") ? { label: "+ Nuevo", fn: () => openM("pro", { cliId: id }) } : null,
      render: () => <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><TH onClick={() => setProSort(proSort === "name-asc" ? "name-desc" : "name-asc")} active={proSort === "name-asc" || proSort === "name-desc"} dir={proSort === "name-desc" ? "desc" : "asc"}>Nombre</TH><TH>Tipo</TH><TH>Estado</TH><TH onClick={() => setProSort(proSort === "date-asc" ? "date-desc" : "date-asc")} active={proSort === "date-asc" || proSort === "date-desc"} dir={proSort === "date-desc" ? "desc" : "asc"}>Inicio</TH><TH>Entrega</TH><TH onClick={() => setProSort(proSort === "balance-asc" ? "balance-desc" : "balance-asc")} active={proSort === "balance-asc" || proSort === "balance-desc"} dir={proSort === "balance-desc" ? "desc" : "asc"}>Balance</TH><TH></TH></tr></thead><tbody>{sortedPrs.map(p => { const b = bal(p.id); return <tr key={p.id} onClick={() => navTo("pro-det", p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.tip} color="gray" sm /></TD><TD><Badge label={p.est} /></TD><TD mono style={{ fontSize: 11 }}>{p.ini ? fmtD(p.ini) : "—"}</TD><TD mono style={{ fontSize: 11 }}>{p.fin ? fmtD(p.fin) : "—"}</TD><TD style={{ color: b.b >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(b.b)}</TD><TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("pro-det", p.id); }}>Ver →</GBtn></TD></tr>; })}</tbody></table>,
    },
    {
      key: "pg",
      title: "Producciones",
      count: pgs.length,
      action: canDo?.("programas") ? { label: "+ Nuevo", fn: () => openM("pg", { cliId: id }) } : null,
      render: () => <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><TH onClick={() => setPgSort(pgSort === "name-asc" ? "name-desc" : "name-asc")} active={pgSort === "name-asc" || pgSort === "name-desc"} dir={pgSort === "name-desc" ? "desc" : "asc"}>Nombre</TH><TH>Tipo</TH><TH>Estado</TH><TH>Canal</TH><TH>Frecuencia</TH><TH onClick={() => setPgSort(pgSort === "balance-asc" ? "balance-desc" : "balance-asc")} active={pgSort === "balance-asc" || pgSort === "balance-desc"} dir={pgSort === "balance-desc" ? "desc" : "asc"}>Balance</TH><TH></TH></tr></thead><tbody>{sortedPgs.map(p => { const b = bal(p.id); return <tr key={p.id} onClick={() => navTo("pg-det", p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.tip || "Producción"} color="gray" sm /></TD><TD><Badge label={p.est} /></TD><TD>{p.can || "—"}</TD><TD>{p.fre || "—"}</TD><TD style={{ color: b.b >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(b.b)}</TD><TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("pg-det", p.id); }}>Ver →</GBtn></TD></tr>; })}</tbody></table>,
    },
    {
      key: "pz",
      title: "Contenidos",
      count: ctn.length,
      action: canDo?.("contenidos") ? { label: "+ Nuevo", fn: () => openM("contenido", { cliId: id }) } : null,
      render: () => <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><TH onClick={() => setPzSort(pzSort === "name-asc" ? "name-desc" : "name-asc")} active={pzSort === "name-asc" || pzSort === "name-desc"} dir={pzSort === "name-desc" ? "desc" : "asc"}>Campaña</TH><TH>Plataforma</TH><TH onClick={() => setPzSort(pzSort === "date-asc" ? "date-desc" : "date-asc")} active={pzSort === "date-asc" || pzSort === "date-desc"} dir={pzSort === "date-desc" ? "desc" : "asc"}>Mes</TH><TH>Estado</TH><TH>Piezas</TH><TH onClick={() => setPzSort(pzSort === "balance-asc" ? "balance-desc" : "balance-asc")} active={pzSort === "balance-asc" || pzSort === "balance-desc"} dir={pzSort === "balance-desc" ? "desc" : "asc"}>Balance</TH><TH></TH></tr></thead><tbody>{sortedCtn.map(p => { const b = bal(p.id); return <tr key={p.id} onClick={() => navTo("contenido-det", p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.plataforma || "Contenidos"} color="gray" sm /></TD><TD>{[p.mes, p.ano].filter(Boolean).join(" ") || "—"}</TD><TD><Badge label={p.est || "Planificada"} /></TD><TD mono style={{ fontSize: 11 }}>{countCampaignPieces(p)}</TD><TD style={{ color: b.b >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(b.b)}</TD><TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("contenido-det", p.id); }}>Ver →</GBtn></TD></tr>; })}</tbody></table>,
    },
  ].filter(block => block.count > 0);

  return (
    <div>
      <DetHeader title={c.nom} tag={c.ind} meta={[c.rut && `RUT: ${c.rut}`, c.dir].filter(Boolean)} actions={canManageClients && <><GBtn onClick={() => openM("cli", c)}>✏ Editar</GBtn><DBtn onClick={() => { if (!canManageClients) return; setDeleteClientConfirmOpen(true); }}>🗑 Eliminar</DBtn></>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        <Stat label="Asociaciones" value={prs.length + pgs.length + ctn.length} accent="var(--cy)" vc="var(--cy)" />
        <Stat label="Contratos" value={cts.length} />
        <Stat label="Ingresos" value={fmtM(ti)} accent="#00e08a" vc="#00e08a" />
        <Stat label="Balance" value={fmtM(ti - tg)} accent={ti - tg >= 0 ? "#00e08a" : "#ff5566"} vc={ti - tg >= 0 ? "#00e08a" : "#ff5566"} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title="Contactos">
          {(c.contactos || []).length > 0 ? (c.contactos || []).map(co => <div key={co.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}><div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--cg)", border: "1px solid var(--cm)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--cy)", flexShrink: 0 }}>{ini(co.nom)}</div><div><div style={{ fontSize: 13, fontWeight: 600 }}>{co.nom}</div><div style={{ fontSize: 11, color: "var(--gr2)" }}>{co.car || "—"}</div></div></div><div style={{ fontSize: 11, color: "var(--gr3)", paddingLeft: 38, marginBottom: 8 }}>✉ {co.ema || "—"} &nbsp;·&nbsp; ☎ {co.tel || "—"}</div>{co.not && <div style={{ fontSize: 11, color: "var(--gr2)", paddingLeft: 38, marginBottom: 8 }}>{co.not}</div>}<div style={{ paddingLeft: 38 }}><ContactBtns tel={co.tel} ema={co.ema} nombre={co.nom} origen={empresa?.nombre || "tu empresa"} mensaje={`Hola ${co.nom}, te contactamos desde ${empresa?.nombre || "tu empresa"}.`} onEmail={co?.ema ? () => openClientEmailChoice(co) : null} emailLabel="Correo" /></div></div>) : <Empty text="Sin contactos registrados" />}
        </Card>
        <Card title="Financiero">
          <KV label="Total Ingresos" value={<span style={{ color: "#00e08a", fontFamily: "var(--fm)" }}>{fmtM(ti)}</span>} />
          <KV label="Total Gastos" value={<span style={{ color: "#ff5566", fontFamily: "var(--fm)" }}>{fmtM(tg)}</span>} />
          <KV label="Límite de crédito" value={<span style={{ fontFamily: "var(--fm)" }}>{Number(c.creditLimit || 0) > 0 ? fmtM(c.creditLimit) : "No definido"}</span>} />
          <KV label="Cupo disponible" value={<span style={{ fontFamily: "var(--fm)", color: Number(c.creditLimit || 0) > 0 && Number(c.creditLimit || 0) - (ti - tg) < 0 ? "#ff5566" : "var(--wh)" }}>{Number(c.creditLimit || 0) > 0 ? fmtM(Number(c.creditLimit || 0) - (ti - tg)) : "—"}</span>} />
          <Sep />
          <KV label={<b>Balance</b>} value={<span style={{ color: ti - tg >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 14 }}>{fmtM(ti - tg)}</span>} />
          {c.not && <><Sep /><div style={{ fontSize: 12, color: "var(--gr3)" }}>{c.not}</div></>}
        </Card>
      </div>
      <Card title={`Correos enviados (${emailHistory.length})`} style={{ marginBottom: 20 }}>
        {emailHistory.length ? <div style={{ display: "grid", gap: 10 }}>
          {emailHistory.map(item => {
            const meta = timelineMeta(item);
            const attachments = normalizeCommentAttachments({ attachments: item.attachments || [] });
            return <ActivityTimelineCard
              key={item.id}
              meta={meta}
              headline={timelineHeadline(item)}
              secondary={timelineSecondary(item)}
              preview={item.text || "Sin contenido"}
              attachments={attachments}
              dateLabel={item.createdAt ? new Date(item.createdAt).toLocaleString("es-CL") : "—"}
              authorLabel={item.byName || "Usuario"}
              onClick={() => setEmailPreview(item)}
              interactive
            />;
          })}
        </div> : <Empty text="Sin correos enviados" sub="Aquí verás el historial de correos enviados a este cliente." />}
      </Card>
      {associationBlocks.map(block => <Card key={block.key} title={`${block.title} (${block.count})`} action={block.action} style={{ marginBottom: 16 }}>{block.render()}</Card>)}
      <Card title={`Contratos (${cts.length})`} action={canDo?.("contratos") ? { label: "+ Nuevo", fn: () => openM("ct", { cliId: id }) } : null}>
        {cts.map(ct => <div key={ct.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}><span style={{ fontSize: 18, flexShrink: 0 }}>📄</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{ct.nom}</div><div style={{ fontSize: 11, color: "var(--gr2)" }}>{ct.tip}{ct.vig ? ` · ${fmtD(ct.vig)}` : ""}</div></div><Badge label={ct.est} />{ct.mon && <span style={{ fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(ct.mon)}</span>}</div>)}
        {!cts.length && <Empty text="Sin contratos" />}
      </Card>
      <Modal open={!!emailChoice} onClose={() => setEmailChoice(null)} title="Enviar correo" sub="Elige cómo quieres continuar con este contacto.">
        <div style={{ display: "grid", gap: 10 }}>
          <button
            type="button"
            onClick={() => openClientEmailComposer(emailChoice)}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "#ffffff", color: "#0f172a", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
          >
            Enviar desde Produ
          </button>
          <button
            type="button"
            onClick={() => {
              if (!emailChoice?.ema) return;
              const subject = encodeURIComponent(`Notificación de ${empresa?.nombre || empresa?.nom || "Produ"}`);
              const body = encodeURIComponent(`Hola ${emailChoice?.nom || ""},\n\nTe escribimos desde ${empresa?.nombre || empresa?.nom || "Produ"}.\n\nQuedamos atentos.`);
              window.open(`mailto:${encodeURIComponent(emailChoice.ema)}?subject=${subject}&body=${body}`, "_blank");
              setEmailChoice(null);
            }}
            style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "#ffffff", color: "#0f172a", fontWeight: 700, cursor: "pointer", textAlign: "left" }}
          >
            Enviar desde tu correo
          </button>
        </div>
      </Modal>
      <ActivityTimelinePreviewModal
        open={!!emailPreview}
        item={emailPreview}
        title={emailPreview?.subject || "Correo enviado"}
        subtitle={emailPreview?.to ? `Para ${emailPreview.to}` : "Vista previa del correo enviado"}
        dateLabel={emailPreview?.createdAt ? new Date(emailPreview.createdAt).toLocaleString("es-CL") : "—"}
        authorLabel={emailPreview?.byName || "Usuario"}
        originLabel={emailPreview?.source === "mailto_fallback" ? "Tu cliente de correo" : "Produ"}
        meta={emailPreview ? timelineMeta(emailPreview) : null}
        preview={emailPreview?.text || "Sin contenido"}
        onClose={() => setEmailPreview(null)}
      />
      <TransactionalEmailComposerModal
        open={emailComposerOpen}
        draft={emailComposerDraft}
        sending={emailComposerSending}
        onClose={closeClientEmailComposer}
        onSend={sendClientEmail}
      />
      <ConfirmActionDialog
        open={deleteClientConfirmOpen}
        title="Eliminar cliente"
        message={`Vamos a eliminar a ${c.nom || "este cliente"} del laboratorio. Esta acción quitará su ficha comercial actual.`}
        confirmLabel="Sí, eliminar cliente"
        onClose={() => setDeleteClientConfirmOpen(false)}
        onConfirm={() => {
          setDeleteClientConfirmOpen(false);
          cDel(clientes, setClientes, id, () => navTo("clientes"), "Cliente eliminado");
        }}
      />
    </div>
  );
}
