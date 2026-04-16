import { useCallback } from "react";
import { touchStoredSession } from "../lib/auth/sessionStorage";
import { LAB_DATA_CONFIG } from "../lib/lab/labStorageConfig";

export function useLabShell({
  setToast,
  setSyncPulse,
  setMData,
  setMOpen,
  setView,
  setDetId,
  setCurUser,
  setCurEmp,
  setStoredSession,
  setSuperPanel,
  curUser,
  storedSession,
  empresas,
  SEED_EMPRESAS,
  authService,
  sessionKey,
}) {
  const ntf = useCallback((msg, type = "ok") => {
    setToast({ msg, type });
    setSyncPulse(true);
    setTimeout(() => setSyncPulse(false), 2000);
  }, [setToast, setSyncPulse]);

  const openM = useCallback((key, data = {}) => {
    setMOpen("");
    setMData({});
    const nextData = data || {};
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        setMData(nextData);
        setMOpen(key);
      });
      return;
    }
    setTimeout(() => {
      setMData(nextData);
      setMOpen(key);
    }, 0);
  }, [setMData, setMOpen]);

  const closeM = useCallback(() => {
    setMOpen("");
    setMData({});
  }, [setMOpen, setMData]);

  const navTo = useCallback((view, id = null) => {
    setView(view);
    setDetId(id);
  }, [setView, setDetId]);

  const login = useCallback((user, options = {}) => {
    if (!authService) return;
    if (user.role === "superadmin") {
      setCurUser(user);
      setCurEmp(null);
      setStoredSession(authService.persistSession({ user, empresa: null, options }));
      return;
    }
    const domainEmpresas = LAB_DATA_CONFIG.releaseMode ? (empresas || []) : (empresas || SEED_EMPRESAS);
    const empresa = domainEmpresas.find(item => item.id === user.empId);
    setCurUser(user);
    setCurEmp(empresa || null);
    setStoredSession(authService.persistSession({ user, empresa: empresa || null, options }));
  }, [authService, setCurUser, setCurEmp, setStoredSession, empresas, SEED_EMPRESAS]);

  const logout = useCallback(() => {
    setCurUser(null);
    setCurEmp(null);
    setStoredSession(null);
    Promise.resolve(authService?.clearSession()).catch((error) => {
      console.warn("Auth session clear failed", {
        error: error?.message || String(error || ""),
      });
    });
  }, [authService, setCurUser, setCurEmp, setStoredSession]);

  const selectEmp = useCallback((empresa) => {
    if (!authService || !curUser) return;
    if (empresa === "__super__") {
      setCurEmp(null);
      setStoredSession(authService.persistSession({ user: curUser, empresa: null, options: storedSession || {} }));
      setSuperPanel(true);
      return;
    }
    setSuperPanel(false);
    setCurEmp(empresa);
    setStoredSession(authService.persistSession({ user: curUser, empresa, options: storedSession || {} }));
  }, [authService, setSuperPanel, setCurEmp, setStoredSession, curUser, storedSession]);

  const refreshSessionActivity = useCallback((patch = {}) => {
    const next = touchStoredSession(sessionKey, storedSession, patch);
    if (next) setStoredSession(next);
    return next;
  }, [sessionKey, storedSession, setStoredSession]);

  return {
    ntf,
    openM,
    closeM,
    navTo,
    login,
    logout,
    selectEmp,
    refreshSessionActivity,
  };
}
