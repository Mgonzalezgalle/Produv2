import { LAB_DATA_CONFIG, labStorageKey, prodStorageKey } from "./labStorageConfig";

let supabaseStoragePromise = null;
const CRITICAL_GLOBAL_KEYS = new Set([
  "produ:empresas",
  "produ:users",
  "produ:printLayouts",
]);
const CRITICAL_AUDIT_KEY = "produ:audit:critical-config";
const CRITICAL_AUDIT_LIMIT = 120;

async function loadSupabaseStorageDb() {
  if (!supabaseStoragePromise) {
    supabaseStoragePromise = import("../auth/supabaseStorageDb");
  }
  return supabaseStoragePromise;
}

async function readStorage(key) {
  const { dbGet } = await loadSupabaseStorageDb();
  return dbGet(key);
}

async function readStorageDetailed(key) {
  const { dbGetDetailed } = await loadSupabaseStorageDb();
  return dbGetDetailed(key);
}

async function writeStorage(key, value) {
  const { dbSet } = await loadSupabaseStorageDb();
  return dbSet(key, value);
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function summarizeValue(value) {
  if (Array.isArray(value)) return { type: "array", size: value.length };
  if (value && typeof value === "object") return { type: "object", keys: Object.keys(value).length };
  return { type: typeof value, value: value ?? null };
}

function isEmptyStructuredValue(value) {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === "object") return Object.keys(value).length === 0;
  return value == null || value === "";
}

export function createLabDb() {
  const dbGet = key => readStorage(labStorageKey(key));

  const appendCriticalAuditEvent = async ({ targetKey = "", action = "write", previousValue = null, nextValue = null } = {}) => {
    const auditStorageKey = labStorageKey(CRITICAL_AUDIT_KEY);
    const current = await readStorage(auditStorageKey);
    const entries = Array.isArray(current) ? current : [];
    const nextEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      targetKey,
      action,
      releaseMode: LAB_DATA_CONFIG.releaseMode === true,
      mode: LAB_DATA_CONFIG.mode,
      previous: summarizeValue(previousValue),
      next: summarizeValue(nextValue),
      changed: !sameJson(previousValue, nextValue),
      createdAt: new Date().toISOString(),
    };
    await writeStorage(auditStorageKey, [nextEntry, ...entries].slice(0, CRITICAL_AUDIT_LIMIT));
  };

  const dbSet = async (key, val) => {
    const storageKey = labStorageKey(key);
    const canonicalKey = prodStorageKey(key);
    const previousDetailed = CRITICAL_GLOBAL_KEYS.has(canonicalKey)
      ? await readStorageDetailed(storageKey)
      : null;
    const previousValue = previousDetailed?.ok ? previousDetailed.value : null;
    const resolved = typeof val === "function" ? await val(await dbGet(key)) : val;
    if (
      LAB_DATA_CONFIG.releaseMode
      && canonicalKey === "produ:empresas"
      && Array.isArray(resolved)
      && resolved.length === 0
    ) {
      console.warn("Blocked empty write to produ:empresas in release mode");
      await appendCriticalAuditEvent({
        targetKey: canonicalKey,
        action: "blocked_empty_write",
        previousValue,
        nextValue: resolved,
      });
      return false;
    }
    if (
      LAB_DATA_CONFIG.releaseMode
      && canonicalKey === "produ:users"
      && Array.isArray(previousValue)
      && previousValue.length > 0
      && Array.isArray(resolved)
      && resolved.length === 0
    ) {
      console.warn("Blocked empty write to produ:users in release mode");
      await appendCriticalAuditEvent({
        targetKey: canonicalKey,
        action: "blocked_empty_write",
        previousValue,
        nextValue: resolved,
      });
      return false;
    }
    if (
      LAB_DATA_CONFIG.releaseMode
      && canonicalKey === "produ:printLayouts"
      && !isEmptyStructuredValue(previousValue)
      && isEmptyStructuredValue(resolved)
    ) {
      console.warn("Blocked empty write to produ:printLayouts in release mode");
      await appendCriticalAuditEvent({
        targetKey: canonicalKey,
        action: "blocked_empty_write",
        previousValue,
        nextValue: resolved,
      });
      return false;
    }
    const writeOk = await writeStorage(storageKey, resolved);
    if (
      writeOk
      && CRITICAL_GLOBAL_KEYS.has(canonicalKey)
      && !sameJson(previousValue, resolved)
    ) {
      await appendCriticalAuditEvent({
        targetKey: canonicalKey,
        action: "write",
        previousValue,
        nextValue: resolved,
      });
    }
    return writeOk;
  };

  const dbCloneFromProd = async (key, fallback = null) => {
    if (!LAB_DATA_CONFIG.cloneProdOnBoot) return fallback;
    const data = await readStorage(prodStorageKey(key));
    if (data !== null) await dbSet(key, data);
    return data !== null ? data : fallback;
  };

  return { dbGet, dbSet, dbCloneFromProd };
}

export const { dbGet, dbSet, dbCloneFromProd } = createLabDb();
