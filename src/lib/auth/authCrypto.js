const HASH_RE = /^[a-f0-9]{64}$/i;

export async function sha256Hex(text = "") {
  const data = new TextEncoder().encode(String(text));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export function isPasswordHash(v = "") {
  return HASH_RE.test(String(v || ""));
}

export async function normalizeUserAuth(user = {}) {
  const { password, ...rest } = user || {};
  const passwordHash = user.passwordHash
    ? user.passwordHash
    : user.password
      ? await sha256Hex(user.password)
      : "";
  return {
    ...rest,
    passwordHash,
  };
}

export async function normalizeUsersAuth(users = []) {
  return Promise.all((Array.isArray(users) ? users : []).filter(Boolean).map(normalizeUserAuth));
}
