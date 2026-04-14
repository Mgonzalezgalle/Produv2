import { useEffect, useMemo } from "react";
import { createAuthGateway } from "../lib/auth/authGateway";
import { LAB_AUTH_CONFIG } from "../lib/auth/authConfig";
import { localLabKey } from "../lib/lab/labStorageConfig";
import { createAuthMockService } from "../lib/backend/authMockService";
import { createMockPlatformServices } from "../lib/backend/mockPlatformServices";
import { createPlatformMockGateway } from "../lib/backend/platformMockGateway";
import { createMockPlatformApiAdapter } from "../lib/backend/mockPlatformApiAdapter";
import { getPlatformApiMode, PLATFORM_API_MODES } from "../lib/backend/platformApiMode";

let supabasePlatformServicesPromise = null;
let supabasePlatformApiAdapterPromise = null;

async function loadSupabasePlatformServicesFactory() {
  if (!supabasePlatformServicesPromise) {
    supabasePlatformServicesPromise = import("../lib/backend/supabasePlatformServices");
  }
  return supabasePlatformServicesPromise;
}

async function loadSupabasePlatformApiAdapterFactory() {
  if (!supabasePlatformApiAdapterPromise) {
    supabasePlatformApiAdapterPromise = import("../lib/backend/supabasePlatformApiAdapter");
  }
  return supabasePlatformApiAdapterPromise;
}

function createDeferredSupabasePlatformServices({ fallbackServices = null } = {}) {
  let liveServicesPromise = null;
  const resolveServices = async () => {
    if (!liveServicesPromise) {
      liveServicesPromise = loadSupabasePlatformServicesFactory()
        .then(({ createSupabasePlatformServices }) => createSupabasePlatformServices({ fallbackServices }));
    }
    return liveServicesPromise;
  };
  return new Proxy({}, {
    get(_target, prop) {
      if (prop === "__fallback") return fallbackServices;
      return async (...args) => {
        const services = await resolveServices();
        const value = services?.[prop];
        if (typeof value === "function") return value.apply(services, args);
        return value;
      };
    },
  });
}

function createDeferredSupabasePlatformApiAdapter({
  authGateway = null,
  users = [],
  empresas = [],
}) {
  let liveApiPromise = null;
  const resolveApi = async () => {
    if (!liveApiPromise) {
      liveApiPromise = loadSupabasePlatformApiAdapterFactory()
        .then(({ createSupabasePlatformApiAdapter }) => createSupabasePlatformApiAdapter({
          authGateway,
          users,
          empresas,
        }));
    }
    return liveApiPromise;
  };
  const callSection = (section, method) => async (...args) => {
    const api = await resolveApi();
    const fn = api?.[section]?.[method];
    if (typeof fn !== "function") return null;
    return fn(...args);
  };
  return {
    auth: {
      loginWithPassword: callSection("auth", "loginWithPassword"),
      restoreSession: callSection("auth", "restoreSession"),
      logout: callSection("auth", "logout"),
      requestPasswordReset: callSection("auth", "requestPasswordReset"),
    },
    tenants: {
      createPendingTenant: callSection("tenants", "createPendingTenant"),
      syncLegacyTenant: callSection("tenants", "syncLegacyTenant"),
      activatePendingTenant: callSection("tenants", "activatePendingTenant"),
    },
    checkout: {
      confirmPayment: callSection("checkout", "confirmPayment"),
    },
    billing: {
      getDocumentStatus: callSection("billing", "getDocumentStatus"),
    },
    notifications: {
      sendTransactionalEmail: callSection("notifications", "sendTransactionalEmail"),
      listTransactionalEmailLogs: callSection("notifications", "listTransactionalEmailLogs"),
    },
    calendar: {
      startGoogleCalendarOAuth: callSection("calendar", "startGoogleCalendarOAuth"),
      completeGoogleCalendarOAuth: callSection("calendar", "completeGoogleCalendarOAuth"),
      createGoogleCalendarEvent: callSection("calendar", "createGoogleCalendarEvent"),
    },
    foundation: {
      status: callSection("foundation", "status"),
      appendSyncAuditLog: callSection("foundation", "appendSyncAuditLog"),
    },
  };
}

export function useLabPlatformFoundation({
  users,
  empresas,
  dbGet,
  dbSet,
  sha256Hex,
  nextTenantCode,
  today,
  storedSession,
  setCurUser,
  setCurEmp,
  setStoredSession,
}) {
  const authGateway = useMemo(() => createAuthGateway(LAB_AUTH_CONFIG.strategy), []);
  const platformApiMode = useMemo(() => getPlatformApiMode(), []);
  const sessionKey = useMemo(() => localLabKey("session"), []);
  const authService = useMemo(
    () => createAuthMockService({ sessionKey, authGateway, users: users || [], empresas: empresas || [] }),
    [sessionKey, authGateway, users, empresas],
  );
  const mockPlatformServices = useMemo(
    () => createMockPlatformServices({ dbGet, dbSet, sha256Hex }),
    [dbGet, dbSet, sha256Hex],
  );
  const platformServices = useMemo(
    () => (
      platformApiMode === PLATFORM_API_MODES.SUPABASE
        ? createDeferredSupabasePlatformServices({ fallbackServices: mockPlatformServices })
        : mockPlatformServices
    ),
    [platformApiMode, mockPlatformServices],
  );
  const platformGateway = useMemo(
    () => createPlatformMockGateway({
      dbGet,
      dbSet,
      sha256Hex,
      authGateway,
      sessionKey,
      users: users || [],
      empresas: empresas || [],
      nextTenantCode,
      today,
    }),
    [dbGet, dbSet, sha256Hex, authGateway, sessionKey, users, empresas, nextTenantCode, today],
  );
  const platformApi = useMemo(
    () => (
      platformApiMode === PLATFORM_API_MODES.SUPABASE
        ? createDeferredSupabasePlatformApiAdapter({
            authGateway,
            users: users || [],
            empresas: empresas || [],
          })
        : createMockPlatformApiAdapter({
            authService,
            authGateway,
            users: users || [],
            tenantBootstrapService: platformGateway.tenantBootstrapService,
            platformGateway,
          })
    ),
    [platformApiMode, authService, authGateway, users, empresas, platformGateway],
  );

  useEffect(() => {
    if (!storedSession || !Array.isArray(users) || !Array.isArray(empresas)) return;
    let cancelled = false;
    const restore = platformApi?.auth?.restoreSession
      ? platformApi.auth.restoreSession({ storedSession })
      : authService.restoreSession();
    Promise.resolve(restore).then(next => {
      if (cancelled || !next) return;
      if (next.clearSession) {
        setCurUser(null);
        setCurEmp(null);
        setStoredSession(null);
        return;
      }
      setCurUser(prev => (prev?.id === next.user?.id ? prev : (next.user || null)));
      setCurEmp(prev => (prev?.id === (next.empresa?.id || null) ? prev : (next.empresa || null)));
    });
    return () => {
      cancelled = true;
    };
  }, [platformApi, authService, storedSession, users, empresas, setCurUser, setCurEmp, setStoredSession]);

  return {
    authGateway,
    platformApiMode,
    sessionKey,
    authService,
    platformServices,
    platformGateway,
    platformApi,
  };
}
