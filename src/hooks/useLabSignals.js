import { useCallback } from "react";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/labStorageConfig";

export function useLabSignals({
  empresas,
  curEmp,
  SEED_EMPRESAS,
  systemLeidas,
  setSystemLeidas,
  curUser,
}) {
  const domainEmpresas = LAB_DATA_CONFIG.releaseMode ? (empresas || []) : (empresas || SEED_EMPRESAS);
  const currentEmpresa = domainEmpresas.find(item => item.id === curEmp?.id) || curEmp || null;
  const systemMessages = currentEmpresa?.systemMessages || [];
  const activeBanner = currentEmpresa?.systemBanner?.active && currentEmpresa?.systemBanner?.text ? currentEmpresa.systemBanner : null;
  const unreadSystemCount = systemMessages.filter(message => !systemLeidas.includes(message.id)).length;

  const markSystemRead = useCallback((id) => {
    setSystemLeidas(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try { localStorage.setItem(localLabKey(`sysread:${curEmp?.id}:${curUser?.id}`), JSON.stringify(next)); } catch {}
      return next;
    });
  }, [setSystemLeidas, curEmp?.id, curUser?.id]);

  const markAllSystemRead = useCallback(() => {
    const next = systemMessages.map(message => message.id);
    setSystemLeidas(next);
    try { localStorage.setItem(localLabKey(`sysread:${curEmp?.id}:${curUser?.id}`), JSON.stringify(next)); } catch {}
  }, [systemMessages, setSystemLeidas, curEmp?.id, curUser?.id]);

  return {
    currentEmpresa,
    systemMessages,
    activeBanner,
    unreadSystemCount,
    markSystemRead,
    markAllSystemRead,
  };
}
