import { loadStoredJson, removeStoredJson, sessionPayload } from "../auth/sessionStorage";

export function createAuthMockService({ sessionKey, authGateway, users = [], empresas = [] }) {
  return {
    async loginWithPassword({ email, password }) {
      return authGateway.authenticate({ users, empresas, email, password });
    },

    async restoreSession() {
      const storedSession = loadStoredJson(sessionKey);
      return authGateway.restoreSession({ storedSession, users, empresas, sessionKey });
    },

    persistSession({ user, empresa, options = {} }) {
      const payload = authGateway.persistSession({ sessionKey, user, empresa, options });
      return typeof payload === "string" ? JSON.parse(payload) : payload;
    },

    clearSession() {
      removeStoredJson(sessionKey);
      return authGateway.clearSession({ sessionKey });
    },

    buildSessionSnapshot({ user, empresa, options = {} }) {
      return JSON.parse(sessionPayload(user, empresa, options));
    },
  };
}
