const ALERT_SEVERITY = {
  urgente: "critical",
  pronto: "warning",
  info: "info",
};

const ALERT_PRIORITY = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function normalizeSignalStatus(value = "") {
  const status = String(value || "").trim().toLowerCase();
  if (["resolved", "resuelta", "cerrada", "closed"].includes(status)) return "resolved";
  if (["archived", "archivada", "hidden", "oculta"].includes(status)) return "archived";
  if (["read", "leida", "leída"].includes(status)) return "read";
  return "open";
}

export function isSignalActive(signal = {}) {
  return !["resolved", "archived"].includes(normalizeSignalStatus(signal.status));
}

export function normalizeOperationalSignal(input = {}) {
  const createdAt = input.createdAt || input.fecha || new Date().toISOString();
  const tipo = String(input.tipo || "info").trim().toLowerCase() || "info";
  const severity = input.severity || ALERT_SEVERITY[tipo] || "info";
  const area = String(input.area || "operacion").trim().toLowerCase() || "operacion";
  const entityType = String(input.entityType || area || "signal").trim() || "signal";
  const entityId = String(input.entityId || input.refId || input.sourceId || "").trim();
  const id = String(input.id || `${area}:${entityType}:${entityId || createdAt}`).trim();

  return {
    ...input,
    id,
    tipo,
    severity,
    priority: ALERT_PRIORITY[severity] ?? ALERT_PRIORITY.info,
    status: normalizeSignalStatus(input.status),
    area,
    entityType,
    entityId,
    source: String(input.source || "produ").trim() || "produ",
    title: input.title || input.titulo || "Alerta operativa",
    titulo: input.titulo || input.title || "Alerta operativa",
    sub: input.sub || input.description || "",
    fecha: input.fecha || createdAt,
    createdAt,
    diff: Number.isFinite(Number(input.diff)) ? Number(input.diff) : 0,
  };
}

export function sortOperationalSignals(signals = []) {
  return [...signals].sort((a, b) => (
    (a.priority ?? 9) - (b.priority ?? 9)
    || Number(a.diff ?? 0) - Number(b.diff ?? 0)
    || String(b.createdAt || b.fecha || "").localeCompare(String(a.createdAt || a.fecha || ""))
  ));
}
