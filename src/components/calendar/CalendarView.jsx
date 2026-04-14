import React, { useEffect, useMemo, useRef, useState } from "react";
import googleCalendarLogo from "../../assets/google-calendar-logo.png";
import {
  Badge,
  Btn,
  Card,
  Empty,
  FilterSel,
  GBtn,
  ModuleHeader,
  Stat,
  Tabs,
} from "../../lib/ui/components";
import { cobranzaState, contractVisualState, fmtD, fmtM, hasAddon, today } from "../../lib/utils/helpers";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function buildSortDateTime(fecha = "", hora = "") {
  if (!fecha) return "";
  const safeHour = String(hora || "09:00").trim() || "09:00";
  return `${fecha}T${safeHour.length === 5 ? `${safeHour}:00` : safeHour}`;
}

function byCalendarDateTime(a, b) {
  const left = String(a?.sortDateTime || buildSortDateTime(a?.fecha, a?.hora) || "");
  const right = String(b?.sortDateTime || buildSortDateTime(b?.fecha, b?.hora) || "");
  return left.localeCompare(right);
}

function daysUntil(date) {
  if (!date) return 0;
  const now = new Date(`${today()}T12:00:00`);
  const target = new Date(`${date}T12:00:00`);
  return Math.round((target - now) / 86400000);
}

export function ViewCalendario(props) {
  const { empresa, user, tareas, crew, clientes, auspiciadores, episodios, programas, piezas, producciones, eventos, facturas, contratos, openM, canDo, cDel, setEventos, ntf, assignedNameList, platformApi, saveUsers, users } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const googleCalendarEnabled = empresa?.googleCalendarEnabled === true;
  const activeUser = (Array.isArray(users) ? users.find(item => item.id === user?.id) : null) || user || {};
  const userCalendar = activeUser?.googleCalendar || {};
  const userCalendarConnected = userCalendar.connected === true;
  const googleCalendarReady = googleCalendarEnabled && userCalendarConnected && !!userCalendar.accessToken;
  const [googleCalendarConnecting, setGoogleCalendarConnecting] = useState(false);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const syncInFlightRef = useRef(new Set());
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [mes, setMes] = useState(() => { const h = new Date(); return { y: h.getFullYear(), m: h.getMonth() }; });
  const [filtro, setFiltro] = useState("todos");
  const [diaSelec, setDiaSelec] = useState(null);
  const [vistaLista, setVistaLista] = useState(false);
  const [subTab, setSubTab] = useState(0);
  const [filtroModulo, setFiltroModulo] = useState("");
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");

  useEffect(() => {
    const onResize = () => setIsMobile(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const googleCalendarRange = useMemo(() => {
    const from = new Date(Date.UTC(mes.y, mes.m, 1, 0, 0, 0));
    const to = new Date(Date.UTC(mes.y, mes.m + 1, 1, 0, 0, 0));
    return {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
    };
  }, [mes.m, mes.y]);

  useEffect(() => {
    if (!googleCalendarReady) {
      setGoogleCalendarEvents([]);
      return;
    }
    let cancelled = false;
    const loadGoogleEvents = async () => {
      try {
        const calendarId = encodeURIComponent(userCalendar.calendarId || "primary");
        const params = new URLSearchParams({
          singleEvents: "true",
          orderBy: "startTime",
          timeMin: googleCalendarRange.timeMin,
          timeMax: googleCalendarRange.timeMax,
        });
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${userCalendar.accessToken}`,
          },
        });
        if (!res.ok) {
          if (!cancelled) setGoogleCalendarEvents([]);
          return;
        }
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        const mapped = items.map(item => {
          const start = item?.start?.dateTime || item?.start?.date || "";
          if (!start) return null;
          const d = new Date(start);
          return {
            id: `gcal_${item.id}`,
            googleEventId: item.id,
            fecha: start.slice(0, 10),
            dia: d.getDate(),
            tipo: "reunion",
            label: `📅 ${item.summary || "Evento Google"}`,
            sub: item.organizer?.email || userCalendar.email || "Google Calendar",
            color: "#4285f4",
            hora: item?.start?.dateTime ? new Date(item.start.dateTime).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" }) : "",
            modulo: "google",
            estado: "Google Calendar",
            desc: item.description || "",
            source: "google",
            sortDateTime: item?.start?.dateTime || buildSortDateTime(start.slice(0, 10), ""),
          };
        }).filter(Boolean);
        if (!cancelled) setGoogleCalendarEvents(mapped);
      } catch {
        if (!cancelled) setGoogleCalendarEvents([]);
      }
    };
    loadGoogleEvents();
    return () => {
      cancelled = true;
    };
  }, [googleCalendarReady, googleCalendarRange.timeMax, googleCalendarRange.timeMin, userCalendar.accessToken, userCalendar.calendarId, userCalendar.email]);

  useEffect(() => {
    if (!googleCalendarReady || !Array.isArray(eventos) || !setEventos || !platformApi?.calendar?.createGoogleCalendarEvent) return;
    const pending = eventos.filter(ev =>
      ev?.empId === empId &&
      ev?.fecha &&
      !ev?.googleEventId &&
      !syncInFlightRef.current.has(ev.id)
    );
    if (!pending.length) return;

    let cancelled = false;
    pending.forEach(ev => {
      syncInFlightRef.current.add(ev.id);
      const baseTime = ev.hora || "09:00";
      const startDate = new Date(`${ev.fecha}T${baseTime}:00`);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const startDateTime = startDate.toISOString();
      const endDateTime = endDate.toISOString();
      Promise.resolve(platformApi.calendar.createGoogleCalendarEvent({
        calendarId: userCalendar.calendarId || "primary",
        refreshToken: userCalendar.refreshToken || "",
        summary: ev.titulo || "Evento Produ",
        description: ev.desc || "",
        startDateTime,
        endDateTime,
        timeZone: "America/Santiago",
        attendees: Array.isArray(ev.invitados) ? ev.invitados : [],
        addMeet: ev.addMeet === true,
      }))
        .then(async result => {
          if (!result?.ok || !result?.event?.id) {
            throw new Error(result?.message || result?.error || "google_event_create_failed");
          }
          if (cancelled) return;
          const next = (eventos || []).map(item => item.id === ev.id ? { ...item, googleEventId: result.event.id, googleCalendarSyncedAt: new Date().toISOString() } : item);
          await Promise.resolve(setEventos(next));
        })
        .catch(error => {
          if (!cancelled) {
            ntf?.(`No pudimos crear "${ev.titulo || "evento"}" en Google Calendar. ${error?.message || ""}`.trim(), "warn");
            console.error("google_calendar_create_failed", error);
          }
        })
        .finally(() => {
          syncInFlightRef.current.delete(ev.id);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [empId, eventos, googleCalendarReady, platformApi?.calendar, setEventos, userCalendar.calendarId, userCalendar.refreshToken]);

  const DIAS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const addMes = delta => setMes(prev => {
    let m = prev.m + delta;
    let y = prev.y;
    if (m > 11) { m = 0; y += 1; }
    if (m < 0) { m = 11; y -= 1; }
    return { y, m };
  });
  const TIPOS = [
    { v: "grabacion", ico: "🎬", lbl: "Grabación", c: "var(--cy)" },
    { v: "emision", ico: "📡", lbl: "Emisión", c: "#00e08a" },
    ...(tasksEnabled ? [{ v: "tarea", ico: "✅", lbl: "Tarea", c: "#7c5cff" }] : []),
    { v: "entrega", ico: "✓", lbl: "Entrega", c: "#ff8844" },
    { v: "cobranza", ico: "💸", lbl: "Cobranza", c: "#ff5566" },
    { v: "estreno", ico: "🌟", lbl: "Publicado", c: "#22c55e" },
    { v: "reunion", ico: "💬", lbl: "Reunión", c: "#ffcc44" },
    { v: "otro", ico: "📌", lbl: "Otro", c: "#7c7c8a" },
  ];
  const tc = v => TIPOS.find(t => t.v === v)?.c || "#7c7c8a";
  const ti = v => TIPOS.find(t => t.v === v)?.ico || "📌";
  const moduloLabel = ev => ({ pro: "Proyecto", pg: "Producción", ep: "Episodio", pz: "Contenidos", cal: "Evento", task: "Tarea", billing: "Cobranza", contract: "Contrato" })[ev.modulo] || "General";
  const safeTasks = tasksEnabled && Array.isArray(tareas) ? tareas.filter(t => t && t.empId === empId) : [];

  const editCalItem = ev => {
    if (!ev || !(canDo && canDo("calendario"))) return;
    if (ev.task) {
      openM("tarea", safeTasks.find(t => t.id === ev.sourceId) || { id: ev.sourceId });
      return;
    }
    if (ev.custom) {
      const original = (eventos || []).find(x => x.id === ev.id);
      if (original) openM("evento", original);
      return;
    }
    if (ev.editModal === "pro") {
      const pro = (producciones || []).find(x => x.id === ev.sourceId);
      if (pro) openM("pro", pro);
      return;
    }
    if (ev.editModal === "ep") {
      const ep = (episodios || []).find(x => x.id === ev.sourceId);
      if (ep) openM("ep", ep);
      return;
    }
    if (ev.editModal === "contenido") {
      const contenido = (piezas || []).find(x => x.id === ev.sourceId);
      if (contenido) openM("contenido", contenido);
    }
  };

  const todosEvs = [];
  (eventos || []).filter(e => e.empId === empId).forEach(ev => {
    if (!ev.fecha) return;
    const d = new Date(`${ev.fecha}T12:00:00`);
    if (d.getFullYear() === mes.y && d.getMonth() === mes.m) {
      const ref = ev.refTipo === "produccion"
        ? (producciones || []).find(x => x.id === ev.ref)
        : (ev.refTipo === "pieza" || ev.refTipo === "contenido")
          ? (piezas || []).find(x => x.id === ev.ref)
          : (programas || []).find(x => x.id === ev.ref);
      todosEvs.push({ id: ev.id, fecha: ev.fecha, dia: d.getDate(), tipo: ev.tipo, label: `${ti(ev.tipo)} ${ev.titulo}`, sub: ref ? ref.nom : "Sin vinculación", color: tc(ev.tipo), hora: ev.hora || "", custom: true, desc: ev.desc || "", modulo: "cal", estado: "Programado", invitados: Array.isArray(ev.invitados) ? ev.invitados : [], sortDateTime: buildSortDateTime(ev.fecha, ev.hora || "") });
    }
  });
  (episodios || []).filter(e => e.empId === empId).forEach(ep => {
    const pg = (programas || []).find(x => x.id === ep.pgId);
    if (ep.fechaGrab) {
      const d = new Date(`${ep.fechaGrab}T12:00:00`);
      if (d.getFullYear() === mes.y && d.getMonth() === mes.m) todosEvs.push({ id: `${ep.id}_g`, fecha: ep.fechaGrab, dia: d.getDate(), tipo: "grabacion", label: `🎬 Ep.${ep.num}: ${ep.titulo}`, sub: pg?.nom || "", color: "var(--cy)", hora: "", auto: true, editModal: "ep", sourceId: ep.id, modulo: "ep", estado: ep.estado || "Planificado", sortDateTime: buildSortDateTime(ep.fechaGrab, "") });
    }
    if (ep.fechaEmision) {
      const d = new Date(`${ep.fechaEmision}T12:00:00`);
      if (d.getFullYear() === mes.y && d.getMonth() === mes.m) todosEvs.push({ id: `${ep.id}_e`, fecha: ep.fechaEmision, dia: d.getDate(), tipo: "emision", label: `📡 Ep.${ep.num}: ${ep.titulo}`, sub: pg?.nom || "", color: "#00e08a", hora: "", auto: true, editModal: "ep", sourceId: ep.id, modulo: "ep", estado: ep.estado || "Programado", sortDateTime: buildSortDateTime(ep.fechaEmision, "") });
    }
  });
  (producciones || []).filter(p => p.empId === empId).forEach(p => {
    if (p.ini) {
      const d = new Date(`${p.ini}T12:00:00`);
      if (d.getFullYear() === mes.y && d.getMonth() === mes.m) todosEvs.push({ id: `${p.id}_ini`, fecha: p.ini, dia: d.getDate(), tipo: "otro", label: `▶ Inicio: ${p.nom}`, sub: "Proyecto", color: "#a855f7", hora: "", auto: true, editModal: "pro", sourceId: p.id, modulo: "pro", estado: p.est || "En Curso", clienteId: p.cliId || "", sortDateTime: buildSortDateTime(p.ini, "") });
    }
    if (p.fin) {
      const d = new Date(`${p.fin}T12:00:00`);
      if (d.getFullYear() === mes.y && d.getMonth() === mes.m) todosEvs.push({ id: `${p.id}_fin`, fecha: p.fin, dia: d.getDate(), tipo: "entrega", label: `✓ Entrega: ${p.nom}`, sub: "Proyecto", color: "#ff8844", hora: "", auto: true, editModal: "pro", sourceId: p.id, modulo: "pro", estado: p.est || "En Curso", clienteId: p.cliId || "", sortDateTime: buildSortDateTime(p.fin, "") });
    }
  });
  (piezas || []).filter(p => p.empId === empId).forEach(c => {
    if (c.ini) {
      const d = new Date(`${c.ini}T12:00:00`);
      if (d.getFullYear() === mes.y && d.getMonth() === mes.m) todosEvs.push({ id: `${c.id}_ini`, fecha: c.ini, dia: d.getDate(), tipo: "otro", label: `📱 Inicio campaña: ${c.nom}`, sub: "Contenidos", color: "#a855f7", hora: "", auto: true, editModal: "contenido", sourceId: c.id, modulo: "pz", estado: c.est || "Planificada", clienteId: c.cliId || "", sortDateTime: buildSortDateTime(c.ini, "") });
    }
    if (c.fin) {
      const d = new Date(`${c.fin}T12:00:00`);
      if (d.getFullYear() === mes.y && d.getMonth() === mes.m) todosEvs.push({ id: `${c.id}_fin`, fecha: c.fin, dia: d.getDate(), tipo: "entrega", label: `✓ Cierre campaña: ${c.nom}`, sub: "Contenidos", color: "#ff8844", hora: "", auto: true, editModal: "contenido", sourceId: c.id, modulo: "pz", estado: c.est || "Planificada", clienteId: c.cliId || "", sortDateTime: buildSortDateTime(c.fin, "") });
    }
    (c.piezas || []).forEach(pc => {
      if (pc.fin) {
        const d = new Date(`${pc.fin}T12:00:00`);
        if (d.getFullYear() === mes.y && d.getMonth() === mes.m) todosEvs.push({ id: `${pc.id}_fin`, fecha: pc.fin, dia: d.getDate(), tipo: pc.est === "Publicado" ? "estreno" : "entrega", label: `📌 ${pc.nom}`, sub: c.nom, color: pc.est === "Publicado" ? "#00e08a" : "#ff8844", hora: "", auto: true, modulo: "pz", estado: pc.est || "", clienteId: c.cliId || "", sortDateTime: buildSortDateTime(pc.fin, "") });
      }
    });
  });
  safeTasks.forEach(t => {
    if (!t.fechaLimite) return;
    const d = new Date(`${t.fechaLimite}T12:00:00`);
    if (d.getFullYear() === mes.y && d.getMonth() === mes.m) {
      const refLabel = t.refTipo === "pro"
        ? (producciones || []).find(x => x.id === t.refId)?.nom
        : t.refTipo === "pg"
          ? (programas || []).find(x => x.id === t.refId)?.nom
          : t.refTipo === "pz"
            ? (piezas || []).find(x => x.id === t.refId)?.nom
            : t.refTipo === "crew"
              ? (crew || []).find(x => x.id === t.refId)?.nom
              : "";
      const assignedNames = assignedNameList ? assignedNameList(t, crew, user) : [];
      const primaryAssigned = (t.assignedIds || [])[0] || t.asignadoA || "";
      todosEvs.push({ id: `task_${t.id}`, fecha: t.fechaLimite, dia: d.getDate(), tipo: "tarea", label: `✅ ${t.titulo}`, sub: refLabel || "Sin vínculo", color: "#7c5cff", hora: "", task: true, sourceId: t.id, modulo: "task", estado: t.estado || "Pendiente", responsableId: primaryAssigned, responsable: assignedNames.join(", "), desc: t.desc || "", sortDateTime: buildSortDateTime(t.fechaLimite, "") });
    }
  });

  const facturasEmp = (facturas || []).filter(f => f.empId === empId);
  const contratosEmp = (contratos || []).filter(c => c.empId === empId);
  const cobranzaItems = facturasEmp.filter(f => f.fechaVencimiento).map(f => {
    const estado = cobranzaState(f);
    const entidad = f.tipo === "auspiciador"
      ? (auspiciadores || []).find(a => a.id === f.entidadId)?.nom
      : (clientes || []).find(c => c.id === f.entidadId)?.nom;
    return { ...f, estadoCobranza: estado, entidad: entidad || "Sin entidad" };
  }).sort((a, b) => (a.fechaVencimiento || "").localeCompare(b.fechaVencimiento || ""));
  const dueInvoices = cobranzaItems.filter(f => f.fechaVencimiento).map(f => {
    const d = new Date(`${f.fechaVencimiento}T12:00:00`);
    if (d.getFullYear() !== mes.y || d.getMonth() !== mes.m) return null;
    return { id: `bill_${f.id}`, fecha: f.fechaVencimiento, dia: d.getDate(), tipo: "cobranza", label: `💸 ${f.correlativo || f.tipoDoc || "Invoice"}`, sub: f.entidad, color: "#ff5566", hora: "", modulo: "billing", estado: f.estadoCobranza, clienteId: f.tipo === "cliente" ? f.entidadId : "", desc: fmtM(f.total || 0) };
  }).filter(Boolean);
  const dueContracts = contratosEmp.filter(ct => ct.vig).map(ct => {
    const d = new Date(`${ct.vig}T12:00:00`);
    if (d.getFullYear() !== mes.y || d.getMonth() !== mes.m) return null;
    return { id: `ct_${ct.id}`, fecha: ct.vig, dia: d.getDate(), tipo: "cobranza", label: `📄 ${ct.nom}`, sub: "Vigencia contrato", color: "#f59e0b", hora: "", modulo: "contract", estado: contractVisualState(ct), clienteId: ct.cliId || "", desc: ct.not || "" };
  }).filter(Boolean);
  todosEvs.push(...dueInvoices, ...dueContracts);

  todosEvs.push(...googleCalendarEvents);
  const eventosFiltrados = todosEvs.filter(e =>
    (filtro === "todos" || e.tipo === filtro) &&
    (!filtroModulo || e.modulo === filtroModulo) &&
    (!filtroResponsable || e.responsableId === filtroResponsable) &&
    (!filtroEstado || String(e.estado || "") === filtroEstado) &&
    (!filtroCliente || e.clienteId === filtroCliente)
  );
  const primerDia = new Date(mes.y, mes.m, 1).getDay();
  const diasMes = new Date(mes.y, mes.m + 1, 0).getDate();
  const hoy = new Date();
  const hoyStr = today();
  const esHoy = d => hoy.getFullYear() === mes.y && hoy.getMonth() === mes.m && hoy.getDate() === d;
  const celdas = [];
  for (let i = 0; i < primerDia; i += 1) celdas.push(null);
  for (let d = 1; d <= diasMes; d += 1) celdas.push(d);
  const evsDelDia = d => eventosFiltrados.filter(e => e.dia === d).sort(byCalendarDateTime);
  const evsDiaSel = diaSelec ? eventosFiltrados.filter(e => e.dia === diaSelec) : [];
  const proximos = [...eventosFiltrados].sort(byCalendarDateTime);
  const agendaHoy = proximos.filter(ev => ev.fecha === hoyStr);
  const agendaSemana = proximos.filter(ev => ev.fecha >= hoyStr).slice(0, 8);
  const programacion = proximos.filter(ev => ["grabacion", "emision", "entrega", "estreno"].includes(ev.tipo));
  const agendaEquipo = proximos.filter(ev => ev.tipo === "tarea");
  const hitosCriticos = proximos.filter(ev => ev.tipo === "cobranza" || ev.estado === "En Revisión" || ev.estado === "Retrasado de pago").slice(0, 8);
  const contratosPorVencer = contratosEmp.filter(ct => ct.vig && ct.vig >= hoyStr).sort((a, b) => (a.vig || "").localeCompare(b.vig || "")).slice(0, 6);
  const estadoOptions = Array.from(new Set(todosEvs.map(ev => ev.estado).filter(Boolean)));
  const delEvento = async evId => { await cDel(eventos, setEventos, evId, null, "Evento eliminado"); };
  const showListCalendar = isMobile ? true : vistaLista;

  const connectGoogleCalendar = async () => {
    if (!googleCalendarEnabled || !user?.id || !platformApi?.calendar?.startGoogleCalendarOAuth) return;
    setGoogleCalendarConnecting(true);
    try {
      const result = await platformApi.calendar.startGoogleCalendarOAuth({
        tenantId: empresa?.id || "",
        userId: activeUser.id,
        userEmail: activeUser.email || "",
        redirectTo: typeof window !== "undefined" ? window.location.href : "",
      });
      if (!result?.ok || !result?.authUrl) {
        ntf?.(result?.message || "No pudimos iniciar la conexión con Google Calendar.", "warn");
        return;
      }
      window.location.href = result.authUrl;
    } catch (error) {
      ntf?.(error?.message || "No pudimos iniciar Google Calendar.", "warn");
    } finally {
      setGoogleCalendarConnecting(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!activeUser?.id || !saveUsers || !Array.isArray(users)) return;
    const nextUsers = users.map(item => item.id === activeUser.id ? {
      ...item,
      googleCalendar: {
        connected: false,
        email: "",
        calendarId: "primary",
        calendarName: "Calendario principal",
        autoSync: false,
        lastSyncAt: "",
        tokenType: "",
        scope: "",
        accessToken: "",
        refreshToken: "",
        expiresIn: 0,
      },
    } : item);
    await Promise.resolve(saveUsers(nextUsers));
    setGoogleCalendarEvents([]);
    ntf?.("Google Calendar desconectado");
  };

  return <div>
    <ModuleHeader
      module="Calendario"
      title="Calendario Operativo"
      description="Programación, agenda del equipo y vencimientos en un solo lugar."
      actions={<div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: isMobile ? "stretch" : "flex-end" }}>
        {googleCalendarEnabled && !userCalendarConnected && <button
          onClick={connectGoogleCalendar}
          disabled={googleCalendarConnecting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid var(--bdr2)",
            background: "var(--sur)",
            color: "var(--wh)",
            cursor: googleCalendarConnecting ? "wait" : "pointer",
            fontSize: 12,
            fontWeight: 700,
            minHeight: 42,
            boxShadow: "0 10px 30px rgba(0,0,0,.08)",
          }}
        >
          <img src={googleCalendarLogo} alt="Google Calendar" style={{ width: 24, height: 24, objectFit: "contain", flexShrink: 0 }} />
          <span>{googleCalendarConnecting ? "Conectando..." : "Conectar con Google Calendar"}</span>
        </button>}
        {googleCalendarEnabled && userCalendarConnected && <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "color-mix(in srgb, #22c55e 10%, var(--sur))" }}>
          <img src={googleCalendarLogo} alt="Google Calendar" style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>Conectado</span>
            <span style={{ fontSize: 10, color: "var(--gr2)" }}>{userCalendar.email || activeUser.email || "Cuenta conectada"}</span>
          </div>
          <GBtn sm onClick={disconnectGoogleCalendar}>Desconectar</GBtn>
        </div>}
        {canDo && canDo("calendario") ? <Btn onClick={() => openM("evento", {})} sm>+ Nuevo Evento</Btn> : null}
      </div>}
    />

    <Tabs tabs={["Agenda", "Calendario", "Programación", "Cobranza"]} active={subTab} onChange={setSubTab} />
    <Card title="Filtros operativos" sub="Afina la lectura por tipo, módulo, responsable, estado o cliente." style={{ marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(5,minmax(0,1fr))", gap: 10 }}>
        <FilterSel value={filtroModulo} onChange={setFiltroModulo} placeholder="Todos los módulos" options={[
          { value: "pro", label: "Proyectos" },
          { value: "pg", label: "Producciones" },
          { value: "ep", label: "Episodios" },
          { value: "pz", label: "Contenidos" },
          ...(googleCalendarEnabled ? [{ value: "google", label: "Google Calendar" }] : []),
          ...(tasksEnabled ? [{ value: "task", label: "Tareas" }] : []),
          { value: "billing", label: "Cobranza" },
          { value: "contract", label: "Contratos" },
          { value: "cal", label: "Eventos manuales" },
        ]} />
        <FilterSel value={filtroResponsable} onChange={setFiltroResponsable} placeholder="Todos los responsables" options={(crew || []).filter(c => c.empId === empId).map(c => ({ value: c.id, label: c.nom }))} />
        <FilterSel value={filtroEstado} onChange={setFiltroEstado} placeholder="Todos los estados" options={estadoOptions} />
        <FilterSel value={filtroCliente} onChange={setFiltroCliente} placeholder="Todos los clientes" options={(clientes || []).filter(c => c.empId === empId).map(c => ({ value: c.id, label: c.nom }))} />
        <FilterSel value={filtro} onChange={setFiltro} placeholder="Todos los tipos" options={TIPOS.map(t => ({ value: t.v, label: `${t.ico} ${t.lbl}` }))} />
      </div>
    </Card>

    {subTab === 0 && <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[["Hoy", agendaHoy.length, "var(--cy)"], ["Próx. 7 días", agendaSemana.length, "#00e08a"], ["Equipo", agendaEquipo.length, "#7c5cff"], ["Críticos", hitosCriticos.length, "#ff5566"]].map(([l, v, c]) => <Stat key={l} label={l} value={v} accent={c} vc={c} sub={MESES[mes.m]} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.2fr .8fr", gap: 16 }}>
        <Card title="Próximos eventos">
          {agendaSemana.length ? agendaSemana.map(ev => <div key={ev.id} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--bdr)", alignItems: "flex-start" }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: `${ev.color}20`, border: `1px solid ${ev.color}35`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <div style={{ fontSize: 14 }}>{ti(ev.tipo)}</div>
              <div style={{ fontSize: 9, fontFamily: "var(--fm)", fontWeight: 700, color: ev.color }}>{ev.fecha ? fmtD(ev.fecha).split(" ").slice(0, 2).join(" ") : "--"}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{ev.label}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>{ev.sub}{ev.hora ? ` · ${ev.hora}` : ""} · {moduloLabel(ev)}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 5 }}>
                {ev.estado && <Badge label={ev.estado} color={ev.tipo === "cobranza" ? "red" : "gray"} sm />}
                {ev.responsable && <Badge label={ev.responsable} color="purple" sm />}
              </div>
              {ev.desc && <div style={{ fontSize: 11, color: "var(--gr3)", marginTop: 4 }}>{ev.desc}</div>}
            </div>
            {canDo && canDo("calendario") && <GBtn sm onClick={() => editCalItem(ev)}>Abrir</GBtn>}
          </div>) : <Empty text="Sin eventos próximos" sub="Cuando programes fechas, aparecerán aquí." />}
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card title="Hoy">
            {agendaHoy.length ? agendaHoy.map(ev => <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--bdr)" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: ev.color }}>{ev.label}</div>
                <div style={{ fontSize: 11, color: "var(--gr2)" }}>{ev.sub} · {moduloLabel(ev)}</div>
              </div>
              {ev.hora && <Badge label={ev.hora} color="gray" sm />}
            </div>) : <Empty text="Nada programado hoy" />}
          </Card>
          <Card title="Hitos críticos">
            {hitosCriticos.length ? hitosCriticos.map(ev => <div key={ev.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--bdr)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: ev.color }}>{ev.label}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>{ev.sub} · {ev.fecha ? fmtD(ev.fecha) : "Sin fecha"}</div>
            </div>) : <Empty text="Sin hitos críticos" />}
          </Card>
          <Card title="Acciones rápidas">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {canDo && canDo("calendario") && <Btn onClick={() => openM("evento", {})} sm>Crear evento manual</Btn>}
              {canDo && canDo("calendario") && <GBtn onClick={() => { setSubTab(1); setVistaLista(false); }} sm>Ver mes completo</GBtn>}
              <GBtn onClick={() => setSubTab(2)} sm>Ir a Programación</GBtn>
              <GBtn onClick={() => setSubTab(3)} sm>Revisar Cobranza</GBtn>
              {googleCalendarEnabled && !googleCalendarReady && <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.5 }}>Conecta tu cuenta para ver eventos de Google y sincronizar los eventos manuales de Produ.</div>}
            </div>
          </Card>
        </div>
      </div>
    </>}

    {subTab === 1 && <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => addMes(-1)} style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr3)", cursor: "pointer", fontSize: 18 }}>‹</button>
          <div style={{ fontFamily: "var(--fh)", fontSize: 20, fontWeight: 800, minWidth: 190, textAlign: "center" }}>{MESES[mes.m]} {mes.y}</div>
          <button onClick={() => addMes(1)} style={{ width: 36, height: 36, borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr3)", cursor: "pointer", fontSize: 18 }}>›</button>
          <button onClick={() => setMes({ y: hoy.getFullYear(), m: hoy.getMonth() })} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr3)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Hoy</button>
          {!isMobile && <button onClick={() => setVistaLista(!vistaLista)} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--bdr2)", background: vistaLista ? "var(--cg)" : "transparent", color: vistaLista ? "var(--cy)" : "var(--gr3)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>{vistaLista ? "📅 Grilla" : "☰ Lista"}</button>}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {["todos", ...TIPOS.map(t => t.v)].map(v => <button key={v} onClick={() => setFiltro(v)} style={{ padding: "5px 10px", borderRadius: 20, border: `1px solid ${filtro === v ? tc(v) : "var(--bdr2)"}`, background: filtro === v ? `${tc(v)}22` : "transparent", color: filtro === v ? tc(v) : "var(--gr3)", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>{v === "todos" ? "Todos" : `${ti(v)} ${TIPOS.find(t => t.v === v)?.lbl}`}</button>)}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {[["Total", eventosFiltrados.length, "var(--cy)"], ["Grabaciones", eventosFiltrados.filter(e => e.tipo === "grabacion").length, "var(--cy)"], ["Emisiones", eventosFiltrados.filter(e => e.tipo === "emision").length, "#00e08a"], ["Reuniones+", eventosFiltrados.filter(e => !["grabacion", "emision"].includes(e.tipo)).length, "#ffcc44"]].map(([l, v, c]) => <Stat key={l} label={l} value={v} accent={c} vc={c} sub={MESES[mes.m]} />)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: 16, alignItems: "start" }}>
        {!showListCalendar ? <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--bdr)" }}>{DIAS.map(d => <div key={d} style={{ padding: "10px 0", textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--gr2)", letterSpacing: 1 }}>{d}</div>)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
            {celdas.map((d, i) => {
              const evs = d ? evsDelDia(d) : [];
              const isTod = d && esHoy(d);
              const isSel = d && diaSelec === d;
              return (
                <div key={i} onClick={() => d && setDiaSelec(diaSelec === d ? null : d)} style={{ minHeight: 90, padding: "5px 3px", borderRight: i % 7 !== 6 ? "1px solid var(--bdr)" : "none", borderBottom: "1px solid var(--bdr)", background: isSel ? "var(--am)" : isTod ? "var(--cg)" : "transparent", cursor: d ? "pointer" : "default", transition: ".1s" }}>
                  {d && <><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3, padding: "0 2px" }}>
                    <span style={{ fontSize: 12, fontWeight: isTod || isSel ? 700 : 400, color: isTod || isSel ? "var(--cy)" : "var(--gr3)" }}>{d}</span>
                    {canDo && canDo("calendario") && <span onClick={e => { e.stopPropagation(); openM("evento", { fecha: `${mes.y}-${String(mes.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` }); }} style={{ fontSize: 10, color: "var(--gr)", cursor: "pointer", opacity: 0.6 }}>+</span>}
                  </div>
                    {evs.slice(0, 3).map(ev => <div key={ev.id} onClick={e => { e.stopPropagation(); if (canDo && canDo("calendario")) editCalItem(ev); }} style={{ fontSize: 9, padding: "2px 4px", borderRadius: 3, marginBottom: 2, background: `${ev.color}25`, color: ev.color, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: canDo && canDo("calendario") ? "pointer" : "default" }} title={`${canDo && canDo("calendario") ? "Clic para editar · " : ""}${ev.label} · ${ev.sub}${ev.hora ? ` · ${ev.hora}` : ""}`}>{ev.hora ? <span style={{ opacity: 0.7 }}>{ev.hora} </span> : ""}{ev.label}</div>)}
                    {evs.length > 3 && <div style={{ fontSize: 9, color: "var(--gr2)", padding: "0 2px" }}>+{evs.length - 3} más</div>}</>}
                </div>
              );
            })}
          </div>
        </div> :
          <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: 20 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Todos los eventos — {MESES[mes.m]} {mes.y}</div>
            {proximos.length > 0 ? proximos.map(ev => <div key={ev.id} style={{ display: "flex", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bdr)", alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: `${ev.color}22`, border: `1px solid ${ev.color}40`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>{ti(ev.tipo)}</span>
                <span style={{ fontSize: 9, fontFamily: "var(--fm)", fontWeight: 700, color: ev.color }}>{String(ev.dia).padStart(2, "0")}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0, cursor: canDo && canDo("calendario") ? "pointer" : "default" }} onClick={() => canDo && canDo("calendario") && editCalItem(ev)}><div style={{ fontSize: 13, fontWeight: 600 }}>{ev.label}</div><div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>{ev.sub}{ev.hora ? ` · ${ev.hora}` : ""} · {moduloLabel(ev)}</div>{ev.desc && <div style={{ fontSize: 11, color: "var(--gr3)", marginTop: 3 }}>{ev.desc}</div>}</div>
              {canDo && canDo("calendario") && <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}><GBtn sm onClick={() => editCalItem(ev)}>✏</GBtn>{ev.custom && <button onClick={() => delEvento(ev.id)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr2)", cursor: "pointer" }}>×</button>}</div>}
            </div>) : <Empty text="Sin eventos este mes" />}
          </div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {diaSelec && <div style={{ background: "var(--card)", border: "1px solid var(--cy)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700 }}>{diaSelec} de {MESES[mes.m]}</div>
              {canDo && canDo("calendario") && <GBtn sm onClick={() => openM("evento", { fecha: `${mes.y}-${String(mes.m + 1).padStart(2, "0")}-${String(diaSelec).padStart(2, "0")}` })}>+ Agregar</GBtn>}
            </div>
            {evsDiaSel.length > 0 ? evsDiaSel.map(ev => <div key={ev.id} style={{ display: "flex", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--bdr)", alignItems: "flex-start" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ev.color, marginTop: 4, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{ev.label}</div>
                <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>{ev.sub}{ev.hora ? ` · ${ev.hora}` : ""}</div>
              </div>
              {canDo && canDo("calendario") && <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                <GBtn sm onClick={() => editCalItem(ev)}>Abrir</GBtn>
                {ev.custom && <button onClick={() => delEvento(ev.id)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr2)", cursor: "pointer" }}>×</button>}
              </div>}
            </div>) : <Empty text="Sin eventos este día" sub="Clic en '+' para agregar" />}
          </div>}
          <Card title="Próximos" sub={`${MESES[mes.m]} ${mes.y}`}>
            {proximos.slice(0, 8).map(ev => <div key={ev.id} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--bdr)", alignItems: "center" }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: `${ev.color}22`, border: `1px solid ${ev.color}40`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><span style={{ fontFamily: "var(--fm)", fontSize: 10, fontWeight: 700, color: ev.color }}>{String(ev.dia).padStart(2, "0")}</span></div>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 11, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.label}</div><div style={{ fontSize: 10, color: "var(--gr2)" }}>{ev.sub} · {moduloLabel(ev)}</div></div>
              {canDo && canDo("calendario") && ev.custom && <button onClick={() => delEvento(ev.id)} style={{ width: 24, height: 24, borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr2)", cursor: "pointer", flexShrink: 0 }}>×</button>}
            </div>)}
            {!proximos.length && <Empty text="Sin eventos" />}
          </Card>
          <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: 16 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Leyenda</div>
            {TIPOS.map(t => <div key={t.v} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: t.c, flexShrink: 0 }} /><span style={{ fontSize: 11, color: "var(--gr3)" }}>{t.ico} {t.lbl}</span></div>)}
            {googleCalendarEnabled && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}><div style={{ width: 10, height: 10, borderRadius: 3, background: "#4285f4", flexShrink: 0 }} /><span style={{ fontSize: 11, color: "var(--gr3)" }}>📅 Google Calendar</span></div>}
          </div>
        </div>
      </div>
    </>}

    {subTab === 2 && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      <Card title="Grabaciones y emisiones" sub="Vista operativa para producción y post.">
        {programacion.length ? programacion.map(ev => <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ev.color }}>{ev.label}</div>
            <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>{ev.sub} · {ev.fecha ? fmtD(ev.fecha) : "Sin fecha"}</div>
          </div>
          <Badge label={TIPOS.find(t => t.v === ev.tipo)?.lbl || "Evento"} color={ev.tipo === "grabacion" ? "cyan" : ev.tipo === "emision" ? "green" : ev.tipo === "entrega" ? "orange" : "purple"} sm />
        </div>) : <Empty text="Sin hitos de programación" />}
      </Card>
      <Card title="Agenda del equipo">
        {agendaEquipo.length ? agendaEquipo.slice(0, 8).map(ev => <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: ev.color }}>{ev.label}</div>
            <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>{ev.responsable || "Sin asignar"} · {ev.fecha ? fmtD(ev.fecha) : "Sin fecha"}</div>
          </div>
          <Badge label={ev.estado || "Pendiente"} color="purple" sm />
        </div>) : <Empty text="Sin tareas con fecha límite" />}
      </Card>
      <Card title="Resumen por tipo">
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 }}>
          {TIPOS.filter(t => ["grabacion", "emision", "entrega", "estreno", "tarea", "cobranza"].includes(t.v)).map(t => <div key={t.v} style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{t.lbl}</div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: t.c }}>{eventosFiltrados.filter(ev => ev.tipo === t.v).length}</div>
          </div>)}
        </div>
        <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 12 }}>Esta vista está pensada para revisar rápido grabaciones, entregas y publicaciones sin navegar por cada módulo.</div>
      </Card>
    </div>}

    {subTab === 3 && <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16 }}>
      <Card title="Documentos por cobrar" sub="Estado comercial y próximos vencimientos.">
        {cobranzaItems.length ? cobranzaItems.map(doc => {
          const late = doc.estadoCobranza === "Retrasado de pago";
          const badgeColor = doc.estadoCobranza === "Pagado" ? "green" : late ? "red" : doc.estadoCobranza === "No pagado" ? "orange" : "yellow";
          return <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{doc.correlativo || doc.tipoDoc || "Invoice"}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)" }}>{doc.entidad} · vence {fmtD(doc.fechaVencimiento)}</div>
              <div style={{ fontSize: 11, color: "var(--gr3)", marginTop: 3 }}>{fmtM(doc.total || 0)}</div>
            </div>
            <Badge label={doc.estadoCobranza} color={badgeColor} sm />
          </div>;
        }) : <Empty text="Sin documentos con vencimiento" />}
      </Card>
      <Card title="Contratos por vencer" sub="Control comercial complementario.">
        {contratosPorVencer.length ? contratosPorVencer.map(ct => {
          const cli = (clientes || []).find(x => x.id === ct.cliId)?.nom || "Sin cliente";
          return <div key={ct.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{ct.nom}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)" }}>{cli} · vigencia {fmtD(ct.vig)}</div>
            </div>
            <Badge label={`${daysUntil(ct.vig)} días`} color="yellow" sm />
          </div>;
        }) : <Empty text="Sin contratos por vencer" />}
      </Card>
    </div>}
  </div>;
}
