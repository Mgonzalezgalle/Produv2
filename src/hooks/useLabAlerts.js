import { useEffect, useState } from "react";
import { normalizeOperationalSignal, sortOperationalSignals } from "../lib/operations/actionSignals";

function calcAlertas(episodios, programas, eventos, tareas, facturas, contratos, portalAlerts, empId, helpers) {
  const { cobranzaState, daysUntil, fmtM } = helpers;
  const hoy = new Date();
  const alerts = [];
  const pushAlert = alert => alerts.push(normalizeOperationalSignal(alert));

  (episodios || []).filter(e => e.empId === empId).forEach(ep => {
    if (!ep.fechaGrab) return;
    const d = new Date(ep.fechaGrab + "T12:00:00");
    const pg = (programas || []).find(x => x.id === ep.pgId);
    const diff = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
    if (diff < 0) return;
    const base = { id: ep.id + "_ep", area: "operacion", entityType: "episodio", entityId: ep.id, source: "producciones", icon: "🎬", sub: pg?.nom || "Episodio", fecha: ep.fechaGrab, diff };
    if (diff <= 2) pushAlert({ ...base, tipo: "urgente", titulo: `Grabación HOY/MAÑANA: Ep.${ep.num} — ${ep.titulo}` });
    else if (diff <= 7) pushAlert({ ...base, tipo: "pronto", titulo: `Grabación en ${diff} días: Ep.${ep.num} — ${ep.titulo}` });
    else if (diff <= 30) pushAlert({ ...base, tipo: "info", titulo: `Grabación en ${diff} días: Ep.${ep.num} — ${ep.titulo}` });
  });

  (eventos || []).filter(e => e.empId === empId && e.tipo === "grabacion" && e.fecha).forEach(ev => {
    const d = new Date(ev.fecha + "T12:00:00");
    const diff = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
    if (diff < 0) return;
    const sub = ev.hora ? `${ev.hora}${ev.desc ? " · " + ev.desc : ""}` : (ev.desc || "Calendario");
    const base = { id: ev.id + "_ev", area: "operacion", entityType: "calendario", entityId: ev.id, source: "calendario", icon: "📅", sub, fecha: ev.fecha, diff };
    if (diff <= 2) pushAlert({ ...base, tipo: "urgente", titulo: `Grabación HOY/MAÑANA: ${ev.titulo}` });
    else if (diff <= 7) pushAlert({ ...base, tipo: "pronto", titulo: `Grabación en ${diff} días: ${ev.titulo}` });
    else if (diff <= 30) pushAlert({ ...base, tipo: "info", titulo: `Grabación en ${diff} días: ${ev.titulo}` });
  });

  (tareas || []).filter(t => t.empId === empId && t.fechaLimite && !["Completada", "Finalizada"].includes(t.estado)).forEach(t => {
    const d = new Date(t.fechaLimite + "T12:00:00");
    const diff = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
    const tipo = diff < 0 ? "urgente" : diff <= 2 ? "urgente" : diff <= 7 ? "pronto" : "info";
    const label = diff < 0 ? `Tarea vencida: ${t.titulo}` : diff === 0 ? `Tarea vence hoy: ${t.titulo}` : diff === 1 ? `Tarea vence mañana: ${t.titulo}` : `Tarea vence en ${diff} días: ${t.titulo}`;
    pushAlert({ id: t.id + "_task", tipo, area: "equipo", entityType: "tarea", entityId: t.id, source: "tareas", icon: "✅", titulo: label, sub: t.estado || "Pendiente", fecha: t.fechaLimite, diff: Math.max(diff, 0) });
  });

  (facturas || []).filter(f => f.empId === empId && f.fechaVencimiento && cobranzaState(f) !== "Pagado").forEach(f => {
    const d = new Date(f.fechaVencimiento + "T12:00:00");
    const diff = Math.ceil((d - hoy) / (1000 * 60 * 60 * 24));
    const tipo = diff < 0 ? "urgente" : diff <= 3 ? "urgente" : diff <= 7 ? "pronto" : "info";
    const label = diff < 0 ? `Cobranza vencida: ${f.correlativo || "Invoice"}` : diff === 0 ? `Invoice vence hoy: ${f.correlativo || "Invoice"}` : `Invoice vence en ${Math.max(diff, 0)} días: ${f.correlativo || "Invoice"}`;
    pushAlert({ id: f.id + "_bill", tipo, area: "comercial", entityType: "documento_cobranza", entityId: f.id, source: "facturacion", icon: "💸", titulo: label, sub: fmtM(f.total || 0), fecha: f.fechaVencimiento, diff: Math.max(diff, 0) });
  });

  (contratos || []).filter(c => c.empId === empId && c.vig).forEach(ct => {
    const days = daysUntil(ct.vig);
    if (days === null || days > Number(ct.alertaDias || 30)) return;
    const tipo = days < 0 ? "urgente" : days <= 7 ? "urgente" : "pronto";
    const label = days < 0 ? `Contrato vencido: ${ct.nom}` : `Contrato por vencer: ${ct.nom}`;
    pushAlert({ id: ct.id + "_ct", tipo, area: "comercial", entityType: "contrato", entityId: ct.id, source: "contratos", icon: "📄", titulo: label, sub: ct.est || "Vigente", fecha: ct.vig, diff: Math.max(days, 0) });
  });

  (portalAlerts || []).filter(Boolean).forEach(item => {
    const createdAt = item.createdAt || new Date().toISOString();
    pushAlert({
      id: item.id || `${createdAt}_portal`,
      tipo: item.tipo || "info",
      area: item.area || "clientes",
      entityType: item.entityType || "portal_cliente",
      entityId: item.entityId || item.refId || "",
      source: item.source || "portal_cliente",
      icon: item.icon || "🗨️",
      titulo: item.titulo || "Nueva respuesta en portal cliente",
      sub: item.sub || "",
      fecha: createdAt,
      diff: 0,
    });
  });

  return sortOperationalSignals(alerts);
}

export function useLabAlerts(episodios, programas, eventos, tareas, facturas, contratos, portalAlerts, empId, helpers) {
  const [alerts, setAlerts] = useState([]);
  const epLen = (episodios || []).length;
  const evLen = (eventos || []).length;
  const tarLen = (tareas || []).length;
  const factLen = (facturas || []).length;
  const ctLen = (contratos || []).length;
  const portalLen = (portalAlerts || []).length;

  useEffect(() => {
    const nextAlerts = calcAlertas(episodios, programas, eventos, tareas, facturas, contratos, portalAlerts, empId, helpers);
    setAlerts(prev => JSON.stringify(prev) === JSON.stringify(nextAlerts) ? prev : nextAlerts);
  }, [epLen, evLen, tarLen, factLen, ctLen, portalLen, empId, helpers, episodios, programas, eventos, tareas, facturas, contratos, portalAlerts]);

  return alerts;
}
