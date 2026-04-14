import { removeStoredJson } from "./sessionStorage";
import { authenticateLocalUser, persistSession, requestLocalPasswordReset, resolveSessionState } from "./localAuthProvider";
import { LAB_AUTH_CONFIG } from "./authConfig";

export const AUTH_STRATEGIES = {
  LOCAL: "local",
  SUPABASE: "supabase",
};

export function getLabAuthStrategy() {
  return LAB_AUTH_CONFIG.strategy === AUTH_STRATEGIES.SUPABASE
    ? AUTH_STRATEGIES.SUPABASE
    : AUTH_STRATEGIES.LOCAL;
}

let supabaseAuthProviderPromise = null;

async function loadSupabaseAuthProvider() {
  if (!supabaseAuthProviderPromise) {
    supabaseAuthProviderPromise = import("./supabaseAuthProvider");
  }
  return supabaseAuthProviderPromise;
}

function createLocalGateway() {
  return {
    strategy: AUTH_STRATEGIES.LOCAL,
    async authenticate({ users, email, password }) {
      return authenticateLocalUser({ users, email, password });
    },
    restoreSession({ storedSession, users, empresas, sessionKey }) {
      return resolveSessionState({ storedSession, users, empresas, sessionKey });
    },
    persistSession({ sessionKey, user, empresa, options }) {
      return persistSession({ sessionKey, user, empresa, options });
    },
    clearSession({ sessionKey }) {
      removeStoredJson(sessionKey);
    },
    supportsPasswordReset() {
      return true;
    },
    supportsAccountActivation() {
      return false;
    },
    async activateAccount() {
      return {
        ok: false,
        user: null,
        empresa: null,
        message: "La activación de cuenta no aplica para auth local.",
      };
    },
    async requestPasswordReset({ email }) {
      return requestLocalPasswordReset({ email });
    },
    supportsGoogleSignIn() {
      return false;
    },
    async signInWithGoogle() {
      return {
        ok: false,
        message: "Google Sign-In no aplica para auth local.",
      };
    },
    supportsTwoFactorSetup() {
      return LAB_AUTH_CONFIG.enableTwoFactorSetup;
    },
  };
}

function createSupabaseGateway() {
  return {
    strategy: AUTH_STRATEGIES.SUPABASE,
    async authenticate({ users, empresas, email, password }) {
      const { authenticateSupabaseUser } = await loadSupabaseAuthProvider();
      return authenticateSupabaseUser({ users, empresas, email, password });
    },
    async restoreSession({ storedSession, users, empresas }) {
      const { restoreSupabaseSession } = await loadSupabaseAuthProvider();
      return restoreSupabaseSession({ storedSession, users, empresas });
    },
    persistSession({ sessionKey, user, empresa, options }) {
      return persistSession({ sessionKey, user, empresa, options });
    },
    async clearSession({ sessionKey }) {
      removeStoredJson(sessionKey);
      const { signOutSupabaseUser } = await loadSupabaseAuthProvider();
      await signOutSupabaseUser();
    },
    supportsPasswordReset() {
      return true;
    },
    supportsAccountActivation() {
      return true;
    },
    async activateAccount({ users, empresas, email, password }) {
      const { activateSupabaseAccount } = await loadSupabaseAuthProvider();
      return activateSupabaseAccount({ users, empresas, email, password });
    },
    async requestPasswordReset({ email }) {
      const { requestSupabasePasswordReset } = await loadSupabaseAuthProvider();
      return requestSupabasePasswordReset({ email });
    },
    supportsGoogleSignIn() {
      return LAB_AUTH_CONFIG.enableGoogleSignIn;
    },
    async signInWithGoogle() {
      const { signInWithSupabaseGoogle } = await loadSupabaseAuthProvider();
      return signInWithSupabaseGoogle();
    },
    supportsTwoFactorSetup() {
      return LAB_AUTH_CONFIG.enableTwoFactorSetup;
    },
  };
}

export function createAuthGateway(strategy = getLabAuthStrategy()) {
  if (strategy === AUTH_STRATEGIES.SUPABASE) return createSupabaseGateway();
  return createLocalGateway();
}
