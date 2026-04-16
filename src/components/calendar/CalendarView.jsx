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
import { fmtD, hasAddon, today } from "../../lib/utils/helpers";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS_SEMANA = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"];
const WEEK_HOURS = Array.from({ length: 17 }, (_, index) => index + 6);

function calendarSyncHash(event = {}) {
  return JSON.stringify({
    titulo: String(event?.titulo || "").trim(),
    desc: String(event?.desc || "").trim(),
    fecha: String(event?.fecha || "").trim(),
    hora: String(event?.hora || "").trim(),
    invitados: Array.isArray(event?.invitados) ? event.invitados.map(item => String(item || "").trim().toLowerCase()).filter(Boolean).sort() : [],
    addMeet: event?.addMeet === true,
  });
}

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

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isDateWithinRange(dateKey = "", range = null) {
  if (!dateKey || !range?.start || !range?.end) return false;
  const current = new Date(`${dateKey}T12:00:00`);
  return current >= range.start && current < range.end;
}

function buildTaskCalendarState(task = {}, todayKey = "") {
  const status = String(task?.estado || "").trim();
  const dueDate = String(task?.fechaLimite || "").trim();
  if (status === "Completada") {
    return { color: "#22c55e", stateLabel: "Completada" };
  }
  if (dueDate && dueDate < todayKey) {
    return { color: "#ef4444", stateLabel: "Vencida" };
  }
  if (dueDate && dueDate === todayKey) {
    return { color: "#f59e0b", stateLabel: "Vence hoy" };
  }
  return { color: "#7c5cff", stateLabel: status || "Pendiente" };
}

function startOfWeekMonday(date) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = next.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + delta);
  return next;
}

function hourNumber(value = "") {
  const [hh = "0"] = String(value || "").split(":");
  const parsed = Number(hh);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCalendarHour(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Santiago",
  });
}

function mapGoogleEventToCalendarItem(item = {}, userCalendar = {}) {
  const start = item?.start?.dateTime || item?.start?.date || item?.originalStartTime?.dateTime || item?.originalStartTime?.date || "";
  if (!start) return null;
  const d = new Date(start);
  const startDateTime = item?.start?.dateTime ? new Date(item.start.dateTime) : null;
  const attendeeEmails = Array.isArray(item.attendees) ? item.attendees.map(att => String(att?.email || "").trim().toLowerCase()).filter(Boolean) : [];
  const meetLink = item.hangoutLink || item?.conferenceData?.entryPoints?.find(entry => entry.entryPointType === "video")?.uri || "";
  return {
    id: `gcal_${item.id}`,
    googleEventId: item.id,
    fecha: start.slice(0, 10),
    dia: d.getDate(),
    tipo: "reunion",
    label: `📅 ${item.summary || "Evento Google"}`,
    sub: item.organizer?.email || userCalendar.email || "Google Calendar",
    color: "#4285f4",
    hora: startDateTime ? formatCalendarHour(startDateTime) : "",
    modulo: "google",
    estado: item.status === "cancelled" ? "Cancelado" : "Google Calendar",
    desc: item.description || "",
    source: "google",
    rawSummary: item.summary || "Evento Google",
    rawDescription: item.description || "",
    rawAttendees: attendeeEmails,
    rawStatus: item.status || "",
    location: item.location || "",
    attendeesCount: attendeeEmails.length,
    meetLink,
    addMeet: Boolean(meetLink),
    htmlLink: item.htmlLink || "",
    sortDateTime: item?.start?.dateTime || buildSortDateTime(start.slice(0, 10), ""),
  };
}

function mergeGoogleCalendarEventItems(current = [], incoming = null) {
  if (!incoming?.googleEventId) return Array.isArray(current) ? current : [];
  const base = Array.isArray(current) ? current : [];
  const next = base.filter(item => item?.googleEventId !== incoming.googleEventId);
  next.push(incoming);
  next.sort(byCalendarDateTime);
  return next;
}

function googleSyncBadgeState(event = {}) {
  if (event?.googleCalendarSyncState === "conflict") return { label: "Conflicto", color: "orange" };
  if (event?.googleCalendarSyncState === "cancelled") return { label: "Cancelado", color: "red" };
  if (event?.googleCalendarSyncState === "orphan") return { label: "Sin remoto", color: "yellow" };
  if (event?.googleCalendarSyncState === "error") return { label: "Sync error", color: "red" };
  if (event?.googleCalendarSyncState === "syncing") return { label: "Sincronizando", color: "yellow" };
  if (event?.googleEventId) return { label: "Sync ok", color: "green" };
  return { label: "Pendiente sync", color: "gray" };
}

function remoteCalendarSyncHash(remote = {}) {
  return JSON.stringify({
    titulo: String(remote?.rawSummary || "").trim(),
    desc: String(remote?.rawDescription || "").trim(),
    fecha: String(remote?.fecha || "").trim(),
    hora: String(remote?.hora || "").trim(),
    invitados: Array.isArray(remote?.rawAttendees) ? remote.rawAttendees.map(item => String(item || "").trim().toLowerCase()).filter(Boolean).sort() : [],
    addMeet: remote?.addMeet === true,
  });
}

function googleSyncIssueStyle(state = "") {
  if (state === "conflict") {
    return {
      background: "color-mix(in srgb, #f59e0b 10%, var(--sur))",
      border: "1px solid color-mix(in srgb, #f59e0b 32%, var(--bdr2))",
      color: "#ffcf7a",
    };
  }
  if (state === "cancelled") {
    return {
      background: "color-mix(in srgb, #ef4444 10%, var(--sur))",
      border: "1px solid color-mix(in srgb, #ef4444 32%, var(--bdr2))",
      color: "#ffaaaa",
    };
  }
  if (state === "orphan") {
    return {
      background: "color-mix(in srgb, #eab308 10%, var(--sur))",
      border: "1px solid color-mix(in srgb, #eab308 30%, var(--bdr2))",
      color: "#ffe07a",
    };
  }
  return {
    background: "color-mix(in srgb, #ff5566 10%, var(--sur))",
    border: "1px solid color-mix(in srgb, #ff5566 30%, var(--bdr2))",
    color: "#ffb4b4",
  };
}

function calendarToolbarButtonStyle(active = false) {
  return {
    padding: "8px 12px",
    borderRadius: 10,
    border: `1px solid ${active ? "var(--cy)" : "var(--bdr2)"}`,
    background: active ? "color-mix(in srgb, var(--cy) 12%, var(--sur))" : "var(--sur)",
    color: active ? "var(--cy)" : "var(--wh)",
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  };
}

function calendarChipStyle(active = false, color = "var(--bdr2)") {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? color : "var(--bdr2)"}`,
    background: active ? `color-mix(in srgb, ${color} 14%, var(--sur))` : "transparent",
    color: active ? color : "var(--gr2)",
    cursor: "pointer",
    fontSize: 10,
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };
}

function CalendarSidebarSection({ title, sub = "", children }) {
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
        {sub ? <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{sub}</div> : null}
      </div>
      {children}
    </div>
  );
}

function CalendarAgendaRow({ ev, onOpen, onDelete, canDelete = false, compact = false, extraActions = null }) {
  const syncState = googleSyncBadgeState(ev);
  const issueStyle = googleSyncIssueStyle(ev?.googleCalendarSyncState || "");
  return (
    <div style={{ display: "flex", gap: 10, padding: compact ? "8px 0" : "10px 0", borderBottom: "1px solid var(--bdr)", alignItems: "flex-start" }}>
      <div style={{ width: compact ? 38 : 44, height: compact ? 38 : 44, borderRadius: 12, background: `${ev.color}18`, border: `1px solid ${ev.color}35`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ fontSize: compact ? 12 : 14 }}>{ev.tipoIcon || "📌"}</div>
        <div style={{ fontSize: 9, fontFamily: "var(--fm)", fontWeight: 700, color: ev.color }}>{String(ev.dia || "").padStart(2, "0")}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0, cursor: onOpen ? "pointer" : "default" }} onClick={onOpen}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 700, color: "var(--wh)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.label}</div>
        <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>
          {ev.hora ? `${ev.hora} · ` : ""}
          {ev.sub}
        </div>
        {(ev.estado || ev.meetLink || ev.attendeesCount) && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
            {ev.estado ? <Badge label={ev.estado} color="gray" sm /> : null}
            {ev.meetLink ? <Badge label="Meet" color="purple" sm /> : null}
            {ev.attendeesCount ? <Badge label={`${ev.attendeesCount} invitados`} color="cyan" sm /> : null}
            {ev.custom ? <Badge label={syncState.label} color={syncState.color} sm /> : null}
          </div>
        )}
        {ev.custom && ev.googleCalendarSyncError ? (
          <div style={{ ...issueStyle, fontSize: 10, marginTop: 6, lineHeight: 1.45, borderRadius: 10, padding: "8px 10px" }}>
            {ev.googleCalendarSyncError}
          </div>
        ) : null}
        {extraActions ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{extraActions}</div> : null}
      </div>
      {canDelete ? <button onClick={e => { e.stopPropagation(); onDelete?.(); }} style={{ width: 28, height: 28, borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr2)", cursor: "pointer", flexShrink: 0 }}>×</button> : null}
    </div>
  );
}

export function ViewCalendario(props) {
  const { empresa, user, tareas, crew, clientes, episodios, programas, piezas, producciones, eventos, openM, canDo, cDel, setEventos, ntf, assignedNameList, platformApi, saveUsers, users } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const googleCalendarEnabled = empresa?.googleCalendarEnabled === true;
  const activeUser = (Array.isArray(users) ? users.find(item => item.id === user?.id) : null) || user || {};
  const userCalendar = activeUser?.googleCalendar || {};
  const userCalendarEmail = String(userCalendar.email || "");
  const userCalendarConnected = userCalendar.connected === true;
  const googleCalendarReady = googleCalendarEnabled && userCalendarConnected && !!userCalendar.refreshToken;
  const [googleCalendarConnecting, setGoogleCalendarConnecting] = useState(false);
  const [googleCalendarEvents, setGoogleCalendarEvents] = useState([]);
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(false);
  const [googleCalendarError, setGoogleCalendarError] = useState("");
  const [googleCalendarLastPullAt, setGoogleCalendarLastPullAt] = useState("");
  const [googleCalendarRefreshTick, setGoogleCalendarRefreshTick] = useState(0);
  const syncInFlightRef = useRef(new Set());
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [mes, setMes] = useState(() => { const h = new Date(); return { y: h.getFullYear(), m: h.getMonth() }; });
  const [filtro, setFiltro] = useState("todos");
  const [diaSelec, setDiaSelec] = useState(null);
  const [vistaLista, setVistaLista] = useState(false);
  const [calendarViewport, setCalendarViewport] = useState("week");
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

  const rangeAnchorDate = useMemo(() => {
    const todayDate = new Date();
    if (diaSelec) return new Date(mes.y, mes.m, diaSelec);
    if (todayDate.getFullYear() === mes.y && todayDate.getMonth() === mes.m) return new Date(mes.y, mes.m, todayDate.getDate());
    return new Date(mes.y, mes.m, 1);
  }, [diaSelec, mes.m, mes.y]);

  const visibleDateRange = useMemo(() => {
    if (calendarViewport === "week") {
      const start = startOfWeekMonday(rangeAnchorDate);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end };
    }
    return {
      start: new Date(mes.y, mes.m, 1),
      end: new Date(mes.y, mes.m + 1, 1),
    };
  }, [calendarViewport, mes.m, mes.y, rangeAnchorDate]);

  const googleCalendarRange = useMemo(() => {
    const from = new Date(visibleDateRange.start);
    from.setHours(0, 0, 0, 0);
    const to = new Date(visibleDateRange.end);
    to.setHours(0, 0, 0, 0);
    return {
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
    };
  }, [visibleDateRange.end, visibleDateRange.start]);

  useEffect(() => {
    if (!googleCalendarReady) {
      setGoogleCalendarEvents([]);
      setGoogleCalendarError("");
      return;
    }
    let cancelled = false;
    const loadGoogleEvents = async () => {
      try {
        setGoogleCalendarLoading(true);
        setGoogleCalendarError("");
        const result = await Promise.resolve(platformApi?.calendar?.listGoogleCalendarEvents?.({
          calendarId: userCalendar.calendarId || "primary",
          refreshToken: userCalendar.refreshToken || "",
          timeMin: googleCalendarRange.timeMin,
          timeMax: googleCalendarRange.timeMax,
        }));
        if (!result?.ok) {
          if (!cancelled) {
            setGoogleCalendarError(result?.message || "No pudimos leer los eventos de Google Calendar.");
          }
          return;
        }
        const items = Array.isArray(result?.items) ? result.items : [];
        const mapped = items.map(item => mapGoogleEventToCalendarItem(item, { email: userCalendarEmail })).filter(Boolean);
        if (!cancelled) {
          setGoogleCalendarEvents(mapped);
          setGoogleCalendarLastPullAt(new Date().toISOString());
        }
      } catch (error) {
        if (!cancelled) {
          setGoogleCalendarError(error?.message || "No pudimos leer los eventos de Google Calendar.");
        }
      } finally {
        if (!cancelled) setGoogleCalendarLoading(false);
      }
    };
    loadGoogleEvents();
    return () => {
      cancelled = true;
    };
  }, [googleCalendarReady, googleCalendarRange.timeMax, googleCalendarRange.timeMin, userCalendar.calendarId, userCalendar.refreshToken, userCalendarEmail, platformApi?.calendar, googleCalendarRefreshTick]);

  useEffect(() => {
    if (!googleCalendarReady || !Array.isArray(eventos) || !setEventos || !platformApi?.calendar?.createGoogleCalendarEvent) return;
    const pending = eventos.filter(ev =>
      ev?.empId === empId &&
      ev?.fecha &&
      (!ev?.googleEventId || ev?.googleCalendarSyncHash !== calendarSyncHash(ev)) &&
      !syncInFlightRef.current.has(ev.id)
    );
    if (!pending.length) return;

    let cancelled = false;
    pending.forEach(ev => {
      syncInFlightRef.current.add(ev.id);
      Promise.resolve(setEventos((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === ev.id ? {
        ...item,
        googleCalendarSyncState: "syncing",
        googleCalendarSyncError: "",
        googleCalendarLastAttemptAt: new Date().toISOString(),
      } : item)));
      const baseTime = ev.hora || "09:00";
      const startDate = new Date(`${ev.fecha}T${baseTime}:00`);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      const startDateTime = startDate.toISOString();
      const endDateTime = endDate.toISOString();
      Promise.resolve(platformApi.calendar.createGoogleCalendarEvent({
        calendarId: userCalendar.calendarId || "primary",
        refreshToken: userCalendar.refreshToken || "",
        googleEventId: ev.googleEventId || "",
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
          const remoteEvent = mapGoogleEventToCalendarItem(result.event, { email: userCalendarEmail });
          await Promise.resolve(setEventos((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === ev.id ? {
            ...item,
            googleEventId: result.event.id,
            googleCalendarSyncedAt: new Date().toISOString(),
            googleCalendarSyncHash: calendarSyncHash(ev),
            googleCalendarSyncState: "synced",
            googleCalendarSyncError: "",
          } : item)));
          if (remoteEvent) {
            setGoogleCalendarEvents((current = []) => mergeGoogleCalendarEventItems(current, remoteEvent));
          }
          setGoogleCalendarRefreshTick(tick => tick + 1);
        })
        .catch(error => {
          if (!cancelled) {
            void Promise.resolve(setEventos((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === ev.id ? {
              ...item,
              googleCalendarSyncState: "error",
              googleCalendarSyncError: error?.message || "No pudimos sincronizar este evento con Google Calendar.",
            } : item)));
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
  }, [empId, eventos, googleCalendarReady, ntf, platformApi?.calendar, setEventos, userCalendar.calendarId, userCalendar.refreshToken]);

  useEffect(() => {
    if (!googleCalendarReady || !Array.isArray(eventos) || !setEventos) return;
    const scopedLocal = eventos.filter(ev => ev?.empId === empId && ev?.googleEventId && ev?.fecha && isDateWithinRange(ev.fecha, visibleDateRange));
    if (!scopedLocal.length) return;
    const remoteMap = new Map((googleCalendarEvents || []).filter(ev => ev?.googleEventId).map(ev => [ev.googleEventId, ev]));
    let changed = false;
    let remoteUpdatedCount = 0;
    let conflictCount = 0;
    let cancelledCount = 0;
    let removedCount = 0;

    const next = (eventos || []).flatMap(item => {
      if (!item?.googleEventId || item?.empId !== empId || !item?.fecha || !isDateWithinRange(item.fecha, visibleDateRange)) {
        return [item];
      }
      const remote = remoteMap.get(item.googleEventId);
      const localCurrentHash = calendarSyncHash(item);
      if (!remote) {
        if (
          item.googleCalendarSyncedAt &&
          (!googleCalendarLastPullAt || new Date(item.googleCalendarSyncedAt).getTime() >= new Date(googleCalendarLastPullAt).getTime())
        ) {
          return [item];
        }
        if (item.googleCalendarSyncState === "orphan") return [item];
        changed = true;
        return [{
          ...item,
          googleCalendarSyncState: "orphan",
          googleCalendarSyncError: "No encontramos este evento en Google Calendar dentro del rango visible actual. Se mantiene en Produ para no perderlo.",
        }];
      }
      const remoteHash = remoteCalendarSyncHash(remote);
      if (remote.rawStatus === "cancelled") {
        if (item.googleCalendarSyncState === "cancelled" && item.googleCalendarSyncHash === remoteHash) return [item];
        changed = true;
        cancelledCount += 1;
        return [{
          ...item,
          googleCalendarSyncState: "cancelled",
          googleCalendarSyncError: "Este evento fue cancelado directamente en Google Calendar.",
          googleCalendarSyncHash: remoteHash,
        }];
      }
      if (item.googleCalendarSyncHash === localCurrentHash && remoteHash !== localCurrentHash) {
        changed = true;
        remoteUpdatedCount += 1;
        return [{
          ...item,
          titulo: remote.rawSummary || item.titulo,
          desc: remote.rawDescription || "",
          fecha: remote.fecha || item.fecha,
          hora: remote.hora || "",
          invitados: Array.isArray(remote.rawAttendees) ? remote.rawAttendees : [],
          addMeet: remote.addMeet === true,
          googleCalendarSyncHash: remoteHash,
          googleCalendarSyncState: "synced",
          googleCalendarSyncError: "",
          googleCalendarSyncedAt: new Date().toISOString(),
        }];
      }
      if (item.googleCalendarSyncHash !== localCurrentHash && remoteHash !== localCurrentHash) {
        if (item.googleCalendarSyncState === "conflict" && item.googleCalendarSyncError) return [item];
        changed = true;
        conflictCount += 1;
        return [{
          ...item,
          googleCalendarSyncState: "conflict",
          googleCalendarSyncError: "Hay cambios locales y remotos distintos para este evento. Revisa antes de sobrescribir.",
        }];
      }
      if (item.googleCalendarSyncState !== "synced" || item.googleCalendarSyncError) {
        changed = true;
        return [{
          ...item,
          googleCalendarSyncState: "synced",
          googleCalendarSyncError: "",
          googleCalendarSyncHash: remoteHash,
        }];
      }
      return [item];
    });

    if (!changed) return;
    void Promise.resolve(setEventos(next));
    if (remoteUpdatedCount) ntf?.(`${remoteUpdatedCount} evento(s) se actualizaron desde Google Calendar.`);
    if (conflictCount) ntf?.(`${conflictCount} evento(s) tienen conflicto entre Produ y Google Calendar.`, "warn");
    if (cancelledCount) ntf?.(`${cancelledCount} evento(s) fueron cancelados en Google Calendar.`, "warn");
    if (removedCount) ntf?.(`${removedCount} evento(s) eliminados en Google dejaron de mostrarse en Produ.`, "warn");
  }, [empId, eventos, googleCalendarEvents, googleCalendarReady, googleCalendarLastPullAt, ntf, setEventos, userCalendarEmail, visibleDateRange]);

  const DIAS = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
  const moveCalendarRange = delta => {
    if (calendarViewport === "week") {
      const baseDate = diaSelec
        ? new Date(mes.y, mes.m, diaSelec)
        : (hoy.getFullYear() === mes.y && hoy.getMonth() === mes.m ? new Date(mes.y, mes.m, hoy.getDate()) : new Date(mes.y, mes.m, 1));
      baseDate.setDate(baseDate.getDate() + (delta * 7));
      setMes({ y: baseDate.getFullYear(), m: baseDate.getMonth() });
      setDiaSelec(baseDate.getDate());
      return;
    }
    setMes(prev => {
      let m = prev.m + delta;
      let y = prev.y;
      if (m > 11) { m = 0; y += 1; }
      if (m < 0) { m = 11; y -= 1; }
      return { y, m };
    });
  };
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
  const todayKey = today();

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
    if (isDateWithinRange(ev.fecha, visibleDateRange)) {
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
      if (isDateWithinRange(ep.fechaGrab, visibleDateRange)) todosEvs.push({ id: `${ep.id}_g`, fecha: ep.fechaGrab, dia: d.getDate(), tipo: "grabacion", label: `🎬 Ep.${ep.num}: ${ep.titulo}`, sub: pg?.nom || "", color: "var(--cy)", hora: "", auto: true, editModal: "ep", sourceId: ep.id, modulo: "ep", estado: ep.estado || "Planificado", sortDateTime: buildSortDateTime(ep.fechaGrab, "") });
    }
    if (ep.fechaEmision) {
      const d = new Date(`${ep.fechaEmision}T12:00:00`);
      if (isDateWithinRange(ep.fechaEmision, visibleDateRange)) todosEvs.push({ id: `${ep.id}_e`, fecha: ep.fechaEmision, dia: d.getDate(), tipo: "emision", label: `📡 Ep.${ep.num}: ${ep.titulo}`, sub: pg?.nom || "", color: "#00e08a", hora: "", auto: true, editModal: "ep", sourceId: ep.id, modulo: "ep", estado: ep.estado || "Programado", sortDateTime: buildSortDateTime(ep.fechaEmision, "") });
    }
  });
  (producciones || []).filter(p => p.empId === empId).forEach(p => {
    if (p.ini) {
      const d = new Date(`${p.ini}T12:00:00`);
      if (isDateWithinRange(p.ini, visibleDateRange)) todosEvs.push({ id: `${p.id}_ini`, fecha: p.ini, dia: d.getDate(), tipo: "otro", label: `▶ Inicio: ${p.nom}`, sub: "Proyecto", color: "#a855f7", hora: "", auto: true, editModal: "pro", sourceId: p.id, modulo: "pro", estado: p.est || "En Curso", clienteId: p.cliId || "", sortDateTime: buildSortDateTime(p.ini, "") });
    }
    if (p.fin) {
      const d = new Date(`${p.fin}T12:00:00`);
      if (isDateWithinRange(p.fin, visibleDateRange)) todosEvs.push({ id: `${p.id}_fin`, fecha: p.fin, dia: d.getDate(), tipo: "entrega", label: `✓ Entrega: ${p.nom}`, sub: "Proyecto", color: "#ff8844", hora: "", auto: true, editModal: "pro", sourceId: p.id, modulo: "pro", estado: p.est || "En Curso", clienteId: p.cliId || "", sortDateTime: buildSortDateTime(p.fin, "") });
    }
  });
  (piezas || []).filter(p => p.empId === empId).forEach(c => {
    if (c.ini) {
      const d = new Date(`${c.ini}T12:00:00`);
      if (isDateWithinRange(c.ini, visibleDateRange)) todosEvs.push({ id: `${c.id}_ini`, fecha: c.ini, dia: d.getDate(), tipo: "otro", label: `📱 Inicio campaña: ${c.nom}`, sub: "Contenidos", color: "#a855f7", hora: "", auto: true, editModal: "contenido", sourceId: c.id, modulo: "pz", estado: c.est || "Planificada", clienteId: c.cliId || "", sortDateTime: buildSortDateTime(c.ini, "") });
    }
    if (c.fin) {
      const d = new Date(`${c.fin}T12:00:00`);
      if (isDateWithinRange(c.fin, visibleDateRange)) todosEvs.push({ id: `${c.id}_fin`, fecha: c.fin, dia: d.getDate(), tipo: "entrega", label: `✓ Cierre campaña: ${c.nom}`, sub: "Contenidos", color: "#ff8844", hora: "", auto: true, editModal: "contenido", sourceId: c.id, modulo: "pz", estado: c.est || "Planificada", clienteId: c.cliId || "", sortDateTime: buildSortDateTime(c.fin, "") });
    }
    (c.piezas || []).forEach(pc => {
      if (pc.fin) {
        const d = new Date(`${pc.fin}T12:00:00`);
        if (isDateWithinRange(pc.fin, visibleDateRange)) todosEvs.push({ id: `${pc.id}_fin`, fecha: pc.fin, dia: d.getDate(), tipo: pc.est === "Publicado" ? "estreno" : "entrega", label: `📌 ${pc.nom}`, sub: c.nom, color: pc.est === "Publicado" ? "#00e08a" : "#ff8844", hora: "", auto: true, modulo: "pz", estado: pc.est || "", clienteId: c.cliId || "", sortDateTime: buildSortDateTime(pc.fin, "") });
      }
    });
  });
  safeTasks.forEach(t => {
    if (!t.fechaLimite) return;
    const d = new Date(`${t.fechaLimite}T12:00:00`);
    if (isDateWithinRange(t.fechaLimite, visibleDateRange)) {
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
      const taskVisual = buildTaskCalendarState(t, todayKey);
      todosEvs.push({ id: `task_${t.id}`, fecha: t.fechaLimite, dia: d.getDate(), tipo: "tarea", label: `✅ ${t.titulo}`, sub: refLabel || "Sin vínculo", color: taskVisual.color, hora: "", task: true, sourceId: t.id, modulo: "task", estado: taskVisual.stateLabel, responsableId: primaryAssigned, responsable: assignedNames.join(", "), desc: t.desc || "", sortDateTime: buildSortDateTime(t.fechaLimite, "") });
    }
  });

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
  const hoy = useMemo(() => new Date(), []);
  const hoyStr = todayKey;
  const esHoy = d => hoy.getFullYear() === mes.y && hoy.getMonth() === mes.m && hoy.getDate() === d;
  const celdas = [];
  for (let i = 0; i < primerDia; i += 1) celdas.push(null);
  for (let d = 1; d <= diasMes; d += 1) celdas.push(d);
  const evsDelDia = d => eventosFiltrados.filter(e => e.dia === d).sort(byCalendarDateTime);
  const evsDiaSel = diaSelec ? eventosFiltrados.filter(e => e.dia === diaSelec).sort(byCalendarDateTime) : [];
  const weekStart = useMemo(() => new Date(visibleDateRange.start), [visibleDateRange.start]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const current = new Date(weekStart);
    current.setDate(weekStart.getDate() + index);
    return current;
  }), [weekStart]);
  const weekDayMap = useMemo(() => weekDays.map(date => {
    const dateKey = toDateKey(date);
    const items = eventosFiltrados.filter(ev => ev.fecha === dateKey).sort(byCalendarDateTime);
    return {
      date,
      dateKey,
      items,
      timed: items.filter(ev => ev.hora),
      allDay: items.filter(ev => !ev.hora),
    };
  }), [eventosFiltrados, weekDays]);
  const proximos = [...eventosFiltrados].sort(byCalendarDateTime);
  const agendaHoy = proximos.filter(ev => ev.fecha === hoyStr);
  const agendaSemana = proximos.filter(ev => ev.fecha >= hoyStr).slice(0, 8);
  const programacion = proximos.filter(ev => ["grabacion", "emision", "entrega", "estreno"].includes(ev.tipo));
  const agendaEquipo = proximos.filter(ev => ev.tipo === "tarea");
  const hitosCriticos = proximos.filter(ev => ev.estado === "En Revisión" || ev.estado === "Retrasado de pago" || ev.estado === "Vencida" || ev.estado === "Vence hoy").slice(0, 8);
  const estadoOptions = Array.from(new Set(todosEvs.map(ev => ev.estado).filter(Boolean)));
  const canManageCalendar = !!(canDo && canDo("calendario"));
  const remoteGoogleEventsMap = useMemo(
    () => new Map((googleCalendarEvents || []).filter(ev => ev?.googleEventId).map(ev => [ev.googleEventId, ev])),
    [googleCalendarEvents]
  );
  const openCalendarCreate = ({ date = "", hour = "" } = {}) => {
    if (!canManageCalendar) return;
    openM("evento", { fecha: date || "", hora: hour || "" });
  };
  const retryGoogleSync = ev => {
    if (!ev?.custom || !setEventos) return;
    void Promise.resolve(setEventos((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === ev.id ? {
      ...item,
      googleCalendarSyncHash: "",
      googleCalendarSyncState: "",
      googleCalendarSyncError: "",
      googleCalendarLastAttemptAt: new Date().toISOString(),
    } : item)));
    ntf?.("Reintentando sincronización con Google Calendar...");
  };
  const forceProduVersion = ev => {
    if (!ev?.custom || !setEventos) return;
    void Promise.resolve(setEventos((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === ev.id ? {
      ...item,
      googleCalendarSyncHash: "",
      googleCalendarSyncState: "",
      googleCalendarSyncError: "",
      googleCalendarLastAttemptAt: new Date().toISOString(),
    } : item)));
    ntf?.("Produ intentará volver a imponer su versión en Google Calendar.");
  };
  const applyGoogleVersion = ev => {
    if (!ev?.custom || !setEventos || !ev?.googleEventId) return;
    const remote = remoteGoogleEventsMap.get(ev.googleEventId);
    if (!remote) {
      ntf?.("No encontramos versión remota en Google para este evento.", "warn");
      return;
    }
    const remoteHash = remoteCalendarSyncHash(remote);
    void Promise.resolve(setEventos((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === ev.id ? {
      ...item,
      titulo: remote.rawSummary || item.titulo,
      desc: remote.rawDescription || "",
      fecha: remote.fecha || item.fecha,
      hora: remote.hora || "",
      invitados: Array.isArray(remote.rawAttendees) ? remote.rawAttendees : [],
      addMeet: remote.addMeet === true,
      googleCalendarSyncHash: remoteHash,
      googleCalendarSyncState: "synced",
      googleCalendarSyncError: "",
      googleCalendarSyncedAt: new Date().toISOString(),
    } : item)));
    ntf?.("Aplicamos la versión de Google Calendar en Produ.");
  };
  const renderGoogleSyncActions = ev => {
    if (!ev?.custom) return null;
    const state = ev.googleCalendarSyncState;
    if (!["error", "conflict", "orphan", "cancelled"].includes(state)) return null;
    return (
      <>
        <GBtn sm onClick={e => { e.stopPropagation(); retryGoogleSync(ev); }}>Reintentar</GBtn>
        {state === "conflict" || state === "orphan" || state === "cancelled" ? (
          <>
            <GBtn sm onClick={e => { e.stopPropagation(); forceProduVersion(ev); }}>Usar versión Produ</GBtn>
            {remoteGoogleEventsMap.has(ev.googleEventId) ? <GBtn sm onClick={e => { e.stopPropagation(); applyGoogleVersion(ev); }}>Usar versión Google</GBtn> : null}
          </>
        ) : null}
      </>
    );
  };
  const openCalendarItem = ev => {
    if (!ev) return;
    if (ev.source === "google" && ev.htmlLink) {
      window.open(ev.htmlLink, "_blank", "noopener,noreferrer");
      return;
    }
    editCalItem(ev);
  };
  const canDeleteCalendarItem = ev => {
    if (!canManageCalendar || !ev) return false;
    return Boolean(ev.custom || ev.googleEventId);
  };
  const delEvento = async ev => {
    if (!ev) return;
    if (ev.googleEventId && googleCalendarReady && platformApi?.calendar?.deleteGoogleCalendarEvent) {
      const remoteDelete = await Promise.resolve(platformApi.calendar.deleteGoogleCalendarEvent({
        calendarId: userCalendar.calendarId || "primary",
        refreshToken: userCalendar.refreshToken || "",
        googleEventId: ev.googleEventId,
      }));
      if (!remoteDelete?.ok) {
        ntf?.(remoteDelete?.message || "No pudimos eliminar el evento en Google Calendar.", "warn");
        if (ev.custom) {
          await Promise.resolve(setEventos((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === ev.id ? {
            ...item,
            googleCalendarSyncState: "error",
            googleCalendarSyncError: remoteDelete?.message || "No pudimos eliminar este evento en Google Calendar.",
          } : item)));
        }
        return;
      } else {
        setGoogleCalendarRefreshTick(tick => tick + 1);
      }
    }
    if (ev.custom) {
      await cDel(eventos, setEventos, ev.id, null, "Evento eliminado");
      return;
    }
    if (ev.source === "google") {
      ntf?.("Evento eliminado de Google Calendar ✓");
      setGoogleCalendarRefreshTick(tick => tick + 1);
    }
  };
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
    setGoogleCalendarError("");
    setGoogleCalendarLastPullAt("");
    ntf?.("Google Calendar desconectado");
  };

  const refreshGoogleCalendar = () => {
    if (!googleCalendarReady) {
      ntf?.("Primero debes conectar Google Calendar.", "warn");
      return;
    }
    setGoogleCalendarLoading(true);
    setGoogleCalendarError("");
    setGoogleCalendarRefreshTick(tick => tick + 1);
    ntf?.("Actualizando Google Calendar...");
  };

  const syncedCustomEvents = (eventos || []).filter(ev => ev?.empId === empId && ev?.googleEventId).length;
  const pendingSyncEvents = (eventos || []).filter(ev => ev?.empId === empId && ev?.fecha && (!ev?.googleEventId || ev?.googleCalendarSyncHash !== calendarSyncHash(ev))).length;
  const googleMeetEvents = googleCalendarEvents.filter(ev => ev?.meetLink).length;
  const syncIssueEvents = (eventos || [])
    .filter(ev => ev?.empId === empId && ["error", "conflict", "orphan", "cancelled"].includes(ev?.googleCalendarSyncState))
    .sort(byCalendarDateTime);
  const syncConflictCount = syncIssueEvents.filter(ev => ev?.googleCalendarSyncState === "conflict").length;
  const syncRemovedCount = syncIssueEvents.filter(ev => ["orphan", "cancelled"].includes(ev?.googleCalendarSyncState)).length;

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
            <span style={{ fontSize: 10, color: "var(--gr2)" }}>
              {userCalendar.email || activeUser.email || "Cuenta conectada"}
              {userCalendar.calendarName ? ` · ${userCalendar.calendarName}` : ""}
            </span>
          </div>
          <GBtn sm onClick={refreshGoogleCalendar}>{googleCalendarLoading ? "Sync..." : "Actualizar"}</GBtn>
          <GBtn sm onClick={disconnectGoogleCalendar}>Desconectar</GBtn>
        </div>}
        {canDo && canDo("calendario") ? <Btn onClick={() => openM("evento", {})} sm>+ Nuevo Evento</Btn> : null}
      </div>}
    />

    <Tabs tabs={["Calendario", "Agenda", "Programación"]} active={Math.min(subTab, 2)} onChange={setSubTab} />
    {subTab !== 0 && <Card title="Filtros operativos" sub="Afina la lectura por tipo, módulo, responsable, estado o cliente." style={{ marginBottom: 16 }}>
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
    </Card>}

    {subTab === 1 && <>
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
          <Card title="Google Calendar">
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <img src={googleCalendarLogo} alt="Google Calendar" style={{ width: 38, height: 38, objectFit: "contain" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>Sincronización personal</div>
                  <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.45 }}>
                    {googleCalendarEnabled ? "Tu agenda de Google se mezcla con el calendario operativo de Produ." : "Esta integración no está habilitada para este tenant."}
                  </div>
                </div>
              </div>
              {googleCalendarEnabled && userCalendarConnected && <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--gr2)", marginBottom: 4 }}>Eventos Google</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#4285f4" }}>{googleCalendarEvents.length}</div>
                </div>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--gr2)", marginBottom: 4 }}>Pendientes sync</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: pendingSyncEvents ? "#f59e0b" : "#22c55e" }}>{pendingSyncEvents}</div>
                </div>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--gr2)", marginBottom: 4 }}>Eventos Produ vinculados</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--cy)" }}>{syncedCustomEvents}</div>
                </div>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--gr2)", marginBottom: 4 }}>Reuniones con Meet</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#7c5cff" }}>{googleMeetEvents}</div>
                </div>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--gr2)", marginBottom: 4 }}>Conflictos</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: syncConflictCount ? "#f59e0b" : "#22c55e" }}>{syncConflictCount}</div>
                </div>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: "var(--gr2)", marginBottom: 4 }}>Sin remoto / cancelados</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: syncRemovedCount ? "#ef4444" : "#22c55e" }}>{syncRemovedCount}</div>
                </div>
              </div>}
              {googleCalendarEnabled && userCalendarConnected && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Badge label={googleCalendarLoading ? "Sincronizando..." : "Sync activo"} color={googleCalendarLoading ? "yellow" : "green"} sm />
                <Badge label={userCalendar.calendarName || "Calendario principal"} color="cyan" sm />
              </div>}
              {googleCalendarEnabled && userCalendarConnected && googleCalendarError && <div style={{ fontSize: 11, lineHeight: 1.5, color: "#ff9b9b", background: "color-mix(in srgb, #ff5566 10%, var(--sur))", border: "1px solid color-mix(in srgb, #ff5566 35%, var(--bdr2))", borderRadius: 12, padding: 12 }}>{googleCalendarError}</div>}
              {googleCalendarEnabled && userCalendarConnected && !googleCalendarError && <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.5 }}>
                {googleCalendarLastPullAt ? `Última lectura remota: ${fmtD(googleCalendarLastPullAt.slice(0, 10))}. Usa Actualizar si acabas de mover algo en Google.` : "Conecta tu agenda para ver reuniones, invitados y videollamadas en el mismo calendario de Produ."}
              </div>}
              {googleCalendarEnabled && !googleCalendarReady && <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.5 }}>Conecta tu cuenta para ver eventos de Google y sincronizar tus eventos manuales de Produ.</div>}
            </div>
          </Card>
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
              {googleCalendarEnabled && !googleCalendarReady && <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.5 }}>Conecta tu cuenta para ver eventos de Google y sincronizar los eventos manuales de Produ.</div>}
            </div>
          </Card>
        </div>
      </div>
    </>}

    {subTab === 0 && <>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr auto", gap: 14, alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => moveCalendarRange(-1)} style={{ ...calendarToolbarButtonStyle(false), width: 38, height: 38, padding: 0, fontSize: 18 }}>‹</button>
          <div>
            <div style={{ fontFamily: "var(--fh)", fontSize: isMobile ? 22 : 30, fontWeight: 900, letterSpacing: "-0.03em" }}>{MESES[mes.m]} {mes.y}</div>
            {calendarViewport === "week" ? <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 2 }}>Vista semanal con foco horario</div> : null}
          </div>
          <button onClick={() => moveCalendarRange(1)} style={{ ...calendarToolbarButtonStyle(false), width: 38, height: 38, padding: 0, fontSize: 18 }}>›</button>
          <button onClick={() => {
            const now = new Date();
            setMes({ y: now.getFullYear(), m: now.getMonth() });
            setDiaSelec(now.getDate());
          }} style={calendarToolbarButtonStyle(false)}>Hoy</button>
          <div style={{ display: "inline-flex", border: "1px solid var(--bdr2)", borderRadius: 12, overflow: "hidden", background: "var(--sur)" }}>
            {[
              { key: "week", label: "Semana" },
              { key: "month", label: "Mes" },
              ...(!isMobile ? [{ key: "list", label: "Lista" }] : []),
            ].map(item => (
              <button
                key={item.key}
                onClick={() => {
                  if (item.key === "list") {
                    setCalendarViewport("month");
                    setVistaLista(true);
                    return;
                  }
                  setVistaLista(false);
                  setCalendarViewport(item.key);
                }}
                style={{
                  padding: "8px 12px",
                  border: "none",
                  background: (item.key === "list" ? vistaLista : calendarViewport === item.key && !vistaLista) ? "color-mix(in srgb, var(--cy) 14%, var(--sur))" : "transparent",
                  color: (item.key === "list" ? vistaLista : calendarViewport === item.key && !vistaLista) ? "var(--cy)" : "var(--wh)",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: isMobile ? "flex-start" : "flex-end" }}>
          {["todos", ...TIPOS.map(t => t.v)].map(v => {
            const item = TIPOS.find(t => t.v === v);
            const color = v === "todos" ? "var(--cy)" : tc(v);
            return <button key={v} onClick={() => setFiltro(v)} style={calendarChipStyle(filtro === v, color)}>{v === "todos" ? "Todos" : <><span>{item?.ico}</span><span>{item?.lbl}</span></>}</button>;
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,minmax(0,1fr))" : "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
        {[["Total", eventosFiltrados.length, "var(--cy)"], ["Google", googleCalendarEvents.length, "#4285f4"], ["Pendientes sync", pendingSyncEvents, pendingSyncEvents ? "#f59e0b" : "#22c55e"], ["Reuniones", eventosFiltrados.filter(e => e.tipo === "reunion" || e.source === "google").length, "#ffcc44"]].map(([l, v, c]) => <Stat key={l} label={l} value={v} accent={c} vc={c} sub={MESES[mes.m]} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : calendarViewport === "week" ? "280px minmax(0,1fr) 340px" : "minmax(0,1fr) 340px", gap: 16, alignItems: "start" }}>
        {!isMobile && calendarViewport === "week" && <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CalendarSidebarSection title={MESES[mes.m]} sub={String(mes.y)}>
            {canManageCalendar ? <div style={{ marginBottom: 12 }}><Btn onClick={() => openCalendarCreate({ date: toDateKey(new Date()) })} sm>+ Crear</Btn></div> : null}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 4 }}>
              {DIAS_SEMANA.map(label => <div key={label} style={{ fontSize: 10, color: "var(--gr2)", textAlign: "center", fontWeight: 700 }}>{label.slice(0, 1)}</div>)}
              {Array.from({ length: ((new Date(mes.y, mes.m, 1).getDay() + 6) % 7) }, (_, idx) => <div key={`spacer-${idx}`} />)}
              {Array.from({ length: diasMes }, (_, idx) => idx + 1).map(day => {
                const isCurrent = diaSelec === day;
                const isTodayMonth = esHoy(day);
                return (
                  <button
                    key={day}
                    onClick={() => setDiaSelec(day)}
                    style={{
                      aspectRatio: "1 / 1",
                      borderRadius: 999,
                      border: "none",
                      background: isCurrent || isTodayMonth ? "var(--cy)" : "transparent",
                      color: isCurrent || isTodayMonth ? "var(--bg)" : "var(--wh)",
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 800,
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </CalendarSidebarSection>
          <CalendarSidebarSection title="Filtros" sub="Refina la semana activa.">
            <div style={{ display: "grid", gap: 8 }}>
              <FilterSel value={filtroModulo} onChange={setFiltroModulo} placeholder="Todos los módulos" options={[
                { value: "pro", label: "Proyectos" },
                { value: "pg", label: "Producciones" },
                { value: "ep", label: "Episodios" },
                { value: "pz", label: "Contenidos" },
                ...(googleCalendarEnabled ? [{ value: "google", label: "Google Calendar" }] : []),
                ...(tasksEnabled ? [{ value: "task", label: "Tareas" }] : []),
                { value: "cal", label: "Eventos manuales" },
              ]} />
              <FilterSel value={filtroResponsable} onChange={setFiltroResponsable} placeholder="Todos los responsables" options={(crew || []).filter(c => c.empId === empId).map(c => ({ value: c.id, label: c.nom }))} />
              <FilterSel value={filtroEstado} onChange={setFiltroEstado} placeholder="Todos los estados" options={estadoOptions} />
            </div>
          </CalendarSidebarSection>
          <CalendarSidebarSection title="Mis calendarios" sub="Capas visibles en esta vista.">
            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: 999, background: "var(--cy)" }} /><span style={{ fontSize: 12, color: "var(--gr2)" }}>Operación Produ</span></div>
              {googleCalendarEnabled ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: 999, background: "#4285f4" }} /><span style={{ fontSize: 12, color: "var(--gr2)" }}>Google Calendar</span></div> : null}
              {tasksEnabled ? <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 10, height: 10, borderRadius: 999, background: "#7c5cff" }} /><span style={{ fontSize: 12, color: "var(--gr2)" }}>Tareas</span></div> : null}
            </div>
          </CalendarSidebarSection>
          <CalendarSidebarSection title="Semana activa" sub={`${fmtD(toDateKey(weekDays[0]))} · ${fmtD(toDateKey(weekDays[6]))}`}>
            {weekDayMap.map(day => (
              <div key={day.dateKey} onClick={() => setDiaSelec(day.date.getDate())} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 0", borderBottom: "1px solid var(--bdr)", cursor: "pointer" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{DIAS_SEMANA[(day.date.getDay() + 6) % 7]} {day.date.getDate()}</div>
                  <div style={{ fontSize: 10, color: "var(--gr2)" }}>{day.items.length} evento(s)</div>
                </div>
                <Badge label={day.items.length ? "Activo" : "Libre"} color={day.items.length ? "cyan" : "gray"} sm />
              </div>
            ))}
          </CalendarSidebarSection>
        </div>}

        <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 22, overflow: "hidden", boxShadow: "0 18px 50px rgba(0,0,0,.12)" }}>
          {calendarViewport === "week" ? (
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 960 }}>
                <div style={{ display: "grid", gridTemplateColumns: "72px repeat(7,minmax(120px,1fr))", borderBottom: "1px solid var(--bdr)", background: "color-mix(in srgb, var(--sur) 82%, transparent)" }}>
                  <div />
                  {weekDayMap.map(day => {
                    const current = esHoy(day.date.getDate()) && day.date.getMonth() === mes.m && day.date.getFullYear() === mes.y;
                    return (
                      <div
                        key={day.dateKey}
                        style={{ padding: "14px 10px", borderLeft: "1px solid var(--bdr)", cursor: canManageCalendar ? "pointer" : "default" }}
                        onClick={() => {
                          setDiaSelec(day.date.getDate());
                          openCalendarCreate({ date: day.dateKey });
                        }}
                      >
                        <div style={{ fontSize: 10, color: "var(--gr2)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em" }}>{DIAS_SEMANA[(day.date.getDay() + 6) % 7]}</div>
                        <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 999, background: current ? "var(--cy)" : "transparent", color: current ? "var(--bg)" : "var(--wh)", fontSize: 18, fontWeight: 800 }}>{day.date.getDate()}</div>
                        <div style={{ marginTop: 10, display: "grid", gap: 4 }}>
                          {day.allDay.slice(0, 2).map(ev => (
                            <div key={ev.id} onClick={e => { e.stopPropagation(); openCalendarItem(ev); }} style={{ padding: "4px 6px", borderRadius: 8, background: `${ev.color}18`, color: ev.color, border: `1px solid ${ev.color}30`, fontSize: 10, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.label}</span>
                              {canDeleteCalendarItem(ev) ? <button onClick={e => { e.stopPropagation(); delEvento(ev); }} style={{ width: 18, height: 18, borderRadius: 999, border: "none", background: "transparent", color: ev.color, cursor: "pointer", fontSize: 12, lineHeight: 1, flexShrink: 0 }}>×</button> : null}
                            </div>
                          ))}
                          {day.allDay.length > 2 ? <div style={{ fontSize: 10, color: "var(--gr2)" }}>+{day.allDay.length - 2} más</div> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div>
                  {WEEK_HOURS.map(hour => (
                    <div key={hour} style={{ display: "grid", gridTemplateColumns: "72px repeat(7,minmax(120px,1fr))", minHeight: 64, borderBottom: "1px solid var(--bdr)" }}>
                      <div style={{ padding: "8px 10px", fontSize: 11, color: "var(--gr2)", borderRight: "1px solid var(--bdr)", background: "color-mix(in srgb, var(--sur) 82%, transparent)" }}>{String(hour).padStart(2, "0")}:00</div>
                      {weekDayMap.map(day => {
                        const hourEvents = day.timed.filter(ev => hourNumber(ev.hora) === hour);
                        return (
                          <div
                            key={`${day.dateKey}-${hour}`}
                            style={{ padding: "6px 8px", borderRight: "1px solid var(--bdr)", position: "relative", cursor: canManageCalendar ? "pointer" : "default" }}
                            onClick={() => {
                              setDiaSelec(day.date.getDate());
                              openCalendarCreate({ date: day.dateKey, hour: `${String(hour).padStart(2, "0")}:00` });
                            }}
                          >
                            {hourEvents.map(ev => (
                              <div key={ev.id} onClick={e => { e.stopPropagation(); openCalendarItem(ev); }} style={{ padding: "6px 8px", borderRadius: 10, background: `${ev.color}18`, color: ev.color, border: `1px solid ${ev.color}30`, fontSize: 11, fontWeight: 700, marginBottom: 4, cursor: "pointer", overflow: "hidden" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.label}</div>
                                  {canDeleteCalendarItem(ev) ? <button onClick={e => { e.stopPropagation(); delEvento(ev); }} style={{ width: 18, height: 18, borderRadius: 999, border: "none", background: "transparent", color: ev.color, cursor: "pointer", fontSize: 12, lineHeight: 1, flexShrink: 0 }}>×</button> : null}
                                </div>
                                <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>{ev.hora || `${String(hour).padStart(2, "0")}:00`}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", borderBottom: "1px solid var(--bdr)", background: "color-mix(in srgb, var(--sur) 82%, transparent)" }}>
            {DIAS.map(d => <div key={d} style={{ padding: "12px 0", textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--gr2)", letterSpacing: ".08em", textTransform: "uppercase" }}>{d}</div>)}
          </div>
          {!showListCalendar ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
              {celdas.map((d, i) => {
                const evs = d ? evsDelDia(d) : [];
                const isTod = d && esHoy(d);
                const isSel = d && diaSelec === d;
                return (
                  <div
                    key={i}
                    onClick={() => d && setDiaSelec(diaSelec === d ? null : d)}
                    style={{
                      minHeight: isMobile ? 108 : 132,
                      padding: "8px 7px",
                      borderRight: i % 7 !== 6 ? "1px solid var(--bdr)" : "none",
                      borderBottom: "1px solid var(--bdr)",
                      background: isSel ? "color-mix(in srgb, var(--cy) 12%, var(--card))" : isTod ? "color-mix(in srgb, var(--cy) 5%, var(--card))" : "transparent",
                      cursor: d ? "pointer" : "default",
                    }}
                  >
                    {d ? <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{
                          width: 28,
                          height: 28,
                          borderRadius: 999,
                          display: "grid",
                          placeItems: "center",
                          fontSize: 12,
                          fontWeight: 800,
                          color: isTod || isSel ? "var(--bg)" : "var(--wh)",
                          background: isTod || isSel ? "var(--cy)" : "transparent",
                        }}>{d}</div>
                        {canManageCalendar ? <button onClick={e => { e.stopPropagation(); openCalendarCreate({ date: `${mes.y}-${String(mes.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}` }); }} style={{ width: 24, height: 24, borderRadius: 8, border: "none", background: "transparent", color: "var(--gr2)", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button> : null}
                      </div>
                      <div style={{ display: "grid", gap: 4 }}>
                        {evs.slice(0, isMobile ? 2 : 4).map(ev => (
                          <div
                            key={ev.id}
                            onClick={e => { e.stopPropagation(); openCalendarItem(ev); }}
                            style={{
                              fontSize: isMobile ? 9 : 10,
                              padding: "5px 7px",
                              borderRadius: 8,
                              background: `${ev.color}18`,
                              color: ev.color,
                              fontWeight: 700,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              border: `1px solid ${ev.color}30`,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                            title={`${ev.label} · ${ev.sub}${ev.hora ? ` · ${ev.hora}` : ""}`}
                          >
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {ev.hora ? <span style={{ opacity: 0.8 }}>{ev.hora} </span> : null}
                              {ev.label}
                            </span>
                            {canDeleteCalendarItem(ev) ? <button onClick={e => { e.stopPropagation(); delEvento(ev); }} style={{ width: 18, height: 18, borderRadius: 999, border: "none", background: "transparent", color: ev.color, cursor: "pointer", fontSize: 12, lineHeight: 1, flexShrink: 0 }}>×</button> : null}
                          </div>
                        ))}
                        {evs.length > (isMobile ? 2 : 4) ? <div style={{ fontSize: 10, color: "var(--gr2)", paddingLeft: 2 }}>+{evs.length - (isMobile ? 2 : 4)} más</div> : null}
                      </div>
                    </> : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 18 }}>
              {proximos.length ? proximos.map(ev => (
                <CalendarAgendaRow
                  key={ev.id}
                  ev={{ ...ev, tipoIcon: ti(ev.tipo) }}
                  onOpen={() => openCalendarItem(ev)}
                  onDelete={() => delEvento(ev)}
                  canDelete={canDeleteCalendarItem(ev)}
                />
              )) : <Empty text="Sin eventos este mes" sub="Cuando programes fechas, aparecerán aquí." />}
            </div>
          )}
          </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <CalendarSidebarSection title={diaSelec ? `${String(diaSelec).padStart(2, "0")} ${MESES[mes.m]}` : "Selecciona un día"} sub={diaSelec ? `${evsDiaSel.length} evento(s)` : "Haz clic en una fecha para ver el detalle diario."}>
            {diaSelec ? (
              <>
                {canManageCalendar ? <div style={{ marginBottom: 12 }}><Btn onClick={() => openCalendarCreate({ date: `${mes.y}-${String(mes.m + 1).padStart(2, "0")}-${String(diaSelec).padStart(2, "0")}` })} sm>+ Nuevo evento</Btn></div> : null}
                {evsDiaSel.some(ev => ev.custom && ev.googleCalendarSyncState === "error") ? <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb, #ff5566 10%, var(--sur))", border: "1px solid color-mix(in srgb, #ff5566 30%, var(--bdr2))", fontSize: 11, color: "#ffb4b4", lineHeight: 1.45 }}>Hay eventos con error de sincronización en este día. Abre el evento para corregir datos o vuelve a intentar el sync editándolo.</div> : null}
                {evsDiaSel.length ? evsDiaSel.map(ev => (
                  <CalendarAgendaRow
                    key={ev.id}
                    ev={{ ...ev, tipoIcon: ti(ev.tipo) }}
                    onOpen={() => openCalendarItem(ev)}
                    onDelete={() => delEvento(ev)}
                    canDelete={canDeleteCalendarItem(ev)}
                    compact
                    extraActions={renderGoogleSyncActions(ev)}
                  />
                )) : <Empty text="Sin eventos este día" sub="Puedes crear uno nuevo desde aquí." />}
              </>
            ) : <Empty text="Ningún día seleccionado" sub="La columna lateral quedará enfocada en la agenda diaria." />}
          </CalendarSidebarSection>

          <CalendarSidebarSection title="Próximos" sub={`${MESES[mes.m]} ${mes.y}`}>
            {proximos.slice(0, 7).length ? proximos.slice(0, 7).map(ev => (
              <CalendarAgendaRow
                key={ev.id}
                ev={{ ...ev, tipoIcon: ti(ev.tipo) }}
                onOpen={() => openCalendarItem(ev)}
                onDelete={() => delEvento(ev)}
                canDelete={canDeleteCalendarItem(ev)}
                compact
                extraActions={renderGoogleSyncActions(ev)}
              />
            )) : <Empty text="Sin próximos eventos" />}
          </CalendarSidebarSection>

          <CalendarSidebarSection title="Google Calendar" sub={googleCalendarEnabled ? "Estado de la sincronización personal." : "Integración no habilitada para este tenant."}>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <img src={googleCalendarLogo} alt="Google Calendar" style={{ width: 28, height: 28, objectFit: "contain" }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800 }}>{userCalendarConnected ? "Cuenta conectada" : "Cuenta no conectada"}</div>
                  <div style={{ fontSize: 11, color: "var(--gr2)" }}>
                    {userCalendar.email || "Google Calendar personal"}
                    {userCalendar.calendarName ? ` · base ${userCalendar.calendarName}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Remotos</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#4285f4" }}>{googleCalendarEvents.length}</div>
                </div>
                <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 4 }}>Pendientes</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: pendingSyncEvents ? "#f59e0b" : "#22c55e" }}>{pendingSyncEvents}</div>
                </div>
              </div>
              {syncIssueEvents.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: "var(--wh)" }}>Requieren atención</div>
                  {syncIssueEvents.slice(0, 3).map(ev => (
                    <div key={ev.id} style={{ background: googleSyncIssueStyle(ev.googleCalendarSyncState).background, border: googleSyncIssueStyle(ev.googleCalendarSyncState).border, borderRadius: 12, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wh)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.titulo || ev.label}</div>
                        <Badge label={googleSyncBadgeState(ev).label} color={googleSyncBadgeState(ev).color} sm />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 4 }}>{ev.fecha ? fmtD(ev.fecha) : "Sin fecha"}{ev.hora ? ` · ${ev.hora}` : ""}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {googleCalendarError ? <div style={{ fontSize: 11, lineHeight: 1.5, color: "#ff9b9b" }}>{googleCalendarError}</div> : <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.5 }}>{googleCalendarLastPullAt ? `Última lectura: ${fmtD(googleCalendarLastPullAt.slice(0, 10))}. Produ ahora mezcla los calendarios visibles de la cuenta conectada.` : "Conecta la cuenta para mezclar reuniones, invitados y Meet con la agenda operativa."}</div>}
            </div>
          </CalendarSidebarSection>
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

  </div>;
}
