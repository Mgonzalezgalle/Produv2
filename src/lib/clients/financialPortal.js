function randomChars(length = 10) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    return Array.from(bytes, byte => alphabet[byte % alphabet.length]).join("");
  }
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function slugifyLabel(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
}

export function createFinancePortalSlug(entity = {}, type = "client") {
  const label = type === "provider"
    ? entity?.name || entity?.razonSocial || "proveedor"
    : entity?.nom || entity?.nombre || "cliente";
  const base = slugifyLabel(label);
  return `${base || (type === "provider" ? "proveedor" : "cliente")}-${randomChars(8)}`;
}

export function createFinancePortalAccessCode() {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint32Array(1);
    cryptoObj.getRandomValues(bytes);
    return String(bytes[0] % 1000000).padStart(6, "0");
  }
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

export function normalizeFinancePortalEmails(value = null) {
  const entries = Array.isArray(value) ? value : String(value || "").split(/[,\n;]/);
  const seen = new Set();
  return entries
    .map(item => String(item || "").trim().toLowerCase())
    .filter(item => item.includes("@") && !seen.has(item) && seen.add(item));
}

export function collectClientFinancePortalEmails(client = {}) {
  return normalizeFinancePortalEmails((client?.contactos || []).map(contact => contact?.ema || contact?.email).filter(Boolean));
}

export function collectProviderFinancePortalEmails(provider = {}) {
  const contactEmails = (provider?.contactos || []).map(contact => contact?.email).filter(Boolean);
  const bankEmails = (provider?.bankAccounts || []).map(account => account?.emailPago).filter(Boolean);
  return normalizeFinancePortalEmails([...contactEmails, ...bankEmails]);
}

function normalizeFinancePortal(raw = null, fallbackEmails = [], entity = {}, type = "client") {
  const now = new Date().toISOString();
  const enabled = Boolean(raw?.enabled);
  return {
    enabled,
    accessMode: String(raw?.accessMode || "email_code"),
    slug: String(raw?.slug || "").trim() || createFinancePortalSlug(entity, type),
    accessCode: String(raw?.accessCode || "").trim() || createFinancePortalAccessCode(),
    authorizedEmails: normalizeFinancePortalEmails(raw?.authorizedEmails).length
      ? normalizeFinancePortalEmails(raw?.authorizedEmails)
      : fallbackEmails,
    createdAt: String(raw?.createdAt || "").trim() || now,
    updatedAt: String(raw?.updatedAt || "").trim() || now,
    lastSharedAt: raw?.lastSharedAt || null,
    lastAccessAt: raw?.lastAccessAt || null,
    notes: String(raw?.notes || "").trim(),
  };
}

export function normalizeClientFinancePortal(raw = null, client = {}) {
  return normalizeFinancePortal(raw, collectClientFinancePortalEmails(client), client, "client");
}

export function normalizeProviderFinancePortal(raw = null, provider = {}) {
  return normalizeFinancePortal(raw, collectProviderFinancePortalEmails(provider), provider, "provider");
}

export function buildFinancePortalUrl(portal = null, type = "client", origin = "") {
  const slug = String(portal?.slug || "").trim();
  if (!slug) return "";
  const safeType = type === "provider" ? "proveedores" : "clientes";
  const base = String(origin || "").trim().replace(/\/+$/, "");
  if (!base) return `#/portal/finanzas/${safeType}/${slug}`;
  return `${base}/#/portal/finanzas/${safeType}/${slug}`;
}

export function resolveFinancePortalRoute(pathname = "", hash = "") {
  const extract = (value = "") => {
    const match = String(value || "").match(/\/portal\/finanzas\/(clientes|proveedores)\/([^/?#]+)/i);
    if (!match) return null;
    return {
      type: match[1].toLowerCase() === "proveedores" ? "provider" : "client",
      slug: decodeURIComponent(match[2]),
    };
  };
  return extract(pathname) || extract(String(hash || "").replace(/^#/, "")) || null;
}

export function buildFinancePortalSessionKey(type = "client", slug = "") {
  return `produ:finance-portal:${type}:${String(slug || "").trim()}`;
}
