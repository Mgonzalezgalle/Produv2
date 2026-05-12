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

export function createClientPortalSlug(client = {}) {
  const base = slugifyLabel(client?.nom || client?.nombre || "cliente");
  return `${base || "cliente"}-${randomChars(8)}`;
}

export function createClientPortalAccessCode() {
  const cryptoObj = typeof globalThis !== "undefined" ? globalThis.crypto : null;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint32Array(1);
    cryptoObj.getRandomValues(bytes);
    return String(bytes[0] % 1000000).padStart(6, "0");
  }
  return String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
}

export function normalizePortalEmails(value = null) {
  const entries = Array.isArray(value) ? value : String(value || "").split(/[,\n;]/);
  const seen = new Set();
  return entries
    .map(item => String(item || "").trim().toLowerCase())
    .filter(item => item.includes("@") && !seen.has(item) && seen.add(item));
}

export function collectClientPortalEmails(client = {}) {
  return normalizePortalEmails((client?.contactos || []).map(contact => contact?.ema).filter(Boolean));
}

export function normalizeClientPortal(raw = null, client = {}) {
  const now = new Date().toISOString();
  const fallbackEmails = collectClientPortalEmails(client);
  const enabled = Boolean(raw?.enabled);
  return {
    enabled,
    accessMode: String(raw?.accessMode || "email_code"),
    slug: String(raw?.slug || "").trim() || createClientPortalSlug(client),
    accessCode: String(raw?.accessCode || "").trim() || createClientPortalAccessCode(),
    authorizedEmails: normalizePortalEmails(raw?.authorizedEmails).length
      ? normalizePortalEmails(raw?.authorizedEmails)
      : fallbackEmails,
    createdAt: String(raw?.createdAt || "").trim() || now,
    updatedAt: String(raw?.updatedAt || "").trim() || now,
    lastSharedAt: raw?.lastSharedAt || null,
    lastAccessAt: raw?.lastAccessAt || null,
    notes: String(raw?.notes || "").trim(),
  };
}

export function buildClientPortalUrl(portal = null, origin = "") {
  const slug = String(portal?.slug || "").trim();
  if (!slug) return "";
  const base = String(origin || "").trim().replace(/\/+$/, "");
  if (!base) return `#/portal/clientes/${slug}`;
  return `${base}/#/portal/clientes/${slug}`;
}

export function resolveClientPortalSlugFromPath(pathname = "", hash = "") {
  const pathMatch = String(pathname || "").match(/^\/portal\/clientes\/([^/?#]+)/i);
  if (pathMatch) return decodeURIComponent(pathMatch[1]);
  const normalizedHash = String(hash || "").replace(/^#/, "");
  const hashMatch = normalizedHash.match(/^\/portal\/clientes\/([^/?#]+)/i);
  return hashMatch ? decodeURIComponent(hashMatch[1]) : "";
}

export function buildClientPortalSessionKey(slug = "") {
  return `produ:client-portal:${String(slug || "").trim()}`;
}
