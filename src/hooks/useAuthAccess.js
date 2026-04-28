import { useEffect, useMemo, useState } from "react";
import { loadStoredJson, removeStoredJson } from "../lib/auth/sessionStorage";
import { createAuthGateway } from "../lib/auth/authGateway";
import { buildAuthSnapshot } from "../lib/auth/authIdentity";

export function useAuthAccess({ users, empresas, sessionKey, strategy }) {
  const gateway = useMemo(() => createAuthGateway(strategy), [strategy]);
  const [curUser, setCurUser] = useState(null);
  const [curEmp, setCurEmp] = useState(null);
  const [storedSession, setStoredSession] = useState(() => loadStoredJson(sessionKey));
  const [authReady, setAuthReady] = useState(false);
  const restorePayload = useMemo(() => ({
    storedSession,
    users,
    empresas,
    sessionKey,
  }), [storedSession, users, empresas, sessionKey]);

  useEffect(() => {
    let cancelled = false;
    setAuthReady(false);
    Promise.resolve(gateway.restoreSession(restorePayload))
      .then(next => {
        if (cancelled || !next) return;
        setCurUser(next.user);
        setCurEmp(next.empresa);
        if (next.clearSession) {
          console.warn("Auth session cleared during restore", {
            strategy: gateway.strategy,
            reason: next.invalidReason || "session_invalidated",
          });
          removeStoredJson(sessionKey);
          setStoredSession(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Auth session restore failed", {
            strategy: gateway.strategy,
            error: error?.message || String(error || ""),
          });
        }
      })
      .finally(() => {
        if (!cancelled) setAuthReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [gateway, restorePayload, sessionKey]);

  const login = (user, options = {}) => {
    if (!user) return;
    const emp = user.role === "superadmin"
      ? null
      : (empresas || []).find(item => item.id === user.empId) || null;
    setCurUser(user);
    setCurEmp(emp);
    setStoredSession(gateway.persistSession({ sessionKey, user, empresa: emp, options }));
  };

  const logout = () => {
    setCurUser(null);
    setCurEmp(null);
    Promise.resolve(gateway.clearSession({ sessionKey })).catch((error) => {
      console.warn("Auth session clear failed", {
        strategy: gateway.strategy,
        error: error?.message || String(error || ""),
      });
    });
    setStoredSession(null);
  };

  const selectEmp = emp => {
    if (!curUser) return;
    setCurEmp(emp || null);
    setStoredSession(gateway.persistSession({ sessionKey, user: curUser, empresa: emp || null }));
  };

  return {
    authStrategy: gateway.strategy,
    authGateway: gateway,
    authReady,
    authSnapshot: buildAuthSnapshot({ user: curUser, empresa: curEmp, strategy: gateway.strategy }),
    curUser,
    curEmp,
    setCurUser,
    setCurEmp,
    storedSession,
    setStoredSession,
    login,
    logout,
    selectEmp,
  };
}
