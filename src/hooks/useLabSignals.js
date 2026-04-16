import { useCallback, useMemo } from "react";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/labStorageConfig";

function persistSystemReadState(storageKey, next) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch (error) {
    console.warn("Unable to persist system signal state", {
      storageKey,
      error: error?.message || String(error || ""),
    });
  }
}

export function useLabSignals({
  empresas,
  curEmp,
  SEED_EMPRESAS,
  systemLeidas,
  setSystemLeidas,
  curUser,
}) {
  const domainEmpresas = useMemo(
    () => (LAB_DATA_CONFIG.releaseMode ? (empresas || []) : (empresas || SEED_EMPRESAS)),
    [SEED_EMPRESAS, empresas],
  );
  const currentEmpresa = useMemo(
    () => domainEmpresas.find(item => item.id === curEmp?.id) || curEmp || null,
    [curEmp, domainEmpresas],
  );
  const systemMessages = useMemo(
    () => currentEmpresa?.systemMessages || [],
    [currentEmpresa?.systemMessages],
  );
  const activeBanner = useMemo(
    () => (currentEmpresa?.systemBanner?.active && currentEmpresa?.systemBanner?.text ? currentEmpresa.systemBanner : null),
    [currentEmpresa?.systemBanner],
  );
  const unreadSystemCount = useMemo(
    () => systemMessages.filter(message => !systemLeidas.includes(message.id)).length,
    [systemLeidas, systemMessages],
  );
  const systemReadStorageKey = useMemo(
    () => localLabKey(`sysread:${curEmp?.id}:${curUser?.id}`),
    [curEmp?.id, curUser?.id],
  );

  const markSystemRead = useCallback((id) => {
    setSystemLeidas(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      persistSystemReadState(systemReadStorageKey, next);
      return next;
    });
  }, [setSystemLeidas, systemReadStorageKey]);

  const markAllSystemRead = useCallback(() => {
    const next = systemMessages.map(message => message.id);
    setSystemLeidas(next);
    persistSystemReadState(systemReadStorageKey, next);
  }, [systemMessages, setSystemLeidas, systemReadStorageKey]);

  return {
    currentEmpresa,
    systemMessages,
    activeBanner,
    unreadSystemCount,
    markSystemRead,
    markAllSystemRead,
  };
}
