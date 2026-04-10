import { useCallback } from "react";
import { removeStoredJson, saveStoredJson, touchStoredSession } from "../lib/auth/sessionStorage";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/storageNamespace";

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
  sessionPayload,
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
    const sessionKey = localLabKey("session");
    if (user.role === "superadmin") {
      setCurUser(user);
      setCurEmp(null);
      const payload = sessionPayload(user, null, options);
      saveStoredJson(sessionKey, payload);
      setStoredSession(JSON.parse(payload));
      return;
    }
    const domainEmpresas = LAB_DATA_CONFIG.releaseMode ? (empresas || []) : (empresas || SEED_EMPRESAS);
    const empresa = domainEmpresas.find(item => item.id === user.empId);
    setCurUser(user);
    setCurEmp(empresa || null);
    const payload = sessionPayload(user, empresa || null, options);
    saveStoredJson(sessionKey, payload);
    setStoredSession(JSON.parse(payload));
  }, [setCurUser, setCurEmp, setStoredSession, empresas, SEED_EMPRESAS, sessionPayload]);

  const logout = useCallback(() => {
    setCurUser(null);
    setCurEmp(null);
    setStoredSession(null);
    removeStoredJson(localLabKey("session"));
  }, [setCurUser, setCurEmp, setStoredSession]);

  const selectEmp = useCallback((empresa) => {
    if (empresa === "__super__") {
      setCurEmp(null);
      const payload = sessionPayload(curUser, null, storedSession || {});
      saveStoredJson(localLabKey("session"), payload);
      setStoredSession(JSON.parse(payload));
      setSuperPanel(true);
      return;
    }
    setSuperPanel(false);
    setCurEmp(empresa);
    const payload = sessionPayload(curUser, empresa, storedSession || {});
    saveStoredJson(localLabKey("session"), payload);
    setStoredSession(JSON.parse(payload));
  }, [setSuperPanel, setCurEmp, setStoredSession, curUser, storedSession, sessionPayload]);

  const refreshSessionActivity = useCallback((patch = {}) => {
    const next = touchStoredSession(localLabKey("session"), storedSession, patch);
    if (next) setStoredSession(next);
    return next;
  }, [storedSession, setStoredSession]);

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
