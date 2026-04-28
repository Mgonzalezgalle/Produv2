import { dbGet, dbSet } from "../lab/labDb";

const OPERATIONAL_AUDIT_LIMIT = 240;

function summarizeAuditValue(value) {
  if (Array.isArray(value)) return { type: "array", size: value.length };
  if (value && typeof value === "object") return { type: "object", keys: Object.keys(value).length };
  return { type: typeof value, value: value ?? null };
}

export function operationalAuditStorageKey(empId = "") {
  return `produ:${String(empId || "").trim()}:operationalAuditLog`;
}

export async function appendOperationalAuditEntry({
  empId = "",
  area = "operacion",
  action = "updated",
  entityType = "",
  entityId = "",
  actor = null,
  payload = null,
  platformServices = null,
} = {}) {
  const safeEmpId = String(empId || "").trim();
  if (!safeEmpId) return { ok: false, source: "skipped" };

  const entry = {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    empId: safeEmpId,
    area: String(area || "operacion").trim() || "operacion",
    action: String(action || "updated").trim() || "updated",
    entityType: String(entityType || "").trim(),
    entityId: String(entityId || "").trim(),
    actor: actor ? {
      id: String(actor?.id || "").trim(),
      name: String(actor?.name || "").trim(),
      email: String(actor?.email || "").trim().toLowerCase(),
      role: String(actor?.role || "").trim(),
    } : null,
    payload: payload ?? null,
    payloadSummary: summarizeAuditValue(payload),
    createdAt: new Date().toISOString(),
  };

  try {
    const storageKey = operationalAuditStorageKey(safeEmpId);
    const current = await dbGet(storageKey);
    const rows = Array.isArray(current) ? current : [];
    await dbSet(storageKey, [entry, ...rows].slice(0, OPERATIONAL_AUDIT_LIMIT));
  } catch (error) {
    console.error("[operational-audit] No pudimos persistir la auditoría local", error);
  }

  try {
    if (platformServices?.appendSyncAuditLog) {
      await platformServices.appendSyncAuditLog(
        safeEmpId,
        `${entry.area}_${entry.action}`,
        entry.entityType || entry.area,
        entry.entityId || safeEmpId,
        {
          actor: entry.actor,
          payload: entry.payload,
          createdAt: entry.createdAt,
        },
      );
    }
  } catch (error) {
    console.error("[operational-audit] No pudimos sincronizar la auditoría remota", error);
  }

  return { ok: true, source: "local_remote_best_effort", entry };
}
