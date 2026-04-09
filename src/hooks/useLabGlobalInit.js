import { useEffect } from "react";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/storageNamespace";
import { loadStoredJson } from "../lib/auth/sessionStorage";

export function useLabGlobalInit({
  dbGet,
  dbSet,
  dbCloneFromProd,
  setEmpresasRaw,
  setUsersRaw,
  setPrintLayoutsRaw,
  setSupportThreadsRaw,
  setSupportSettingsRaw,
  normalizeEmpresasTenantCodes,
  ensureRequiredSystemUsers,
  normalizePrintLayouts,
  normalizeSupportThreads,
  buildSupportSettings,
  applyTheme,
  THEME_PRESETS,
  setStoredSession,
  SEED_EMPRESAS,
  SEED_USERS,
  DEFAULT_PRINT_LAYOUTS,
  empresas,
  users,
  supportSettings,
}) {
  useEffect(() => {
    const domainEmpresas = LAB_DATA_CONFIG.releaseMode ? (empresas || []) : (empresas || SEED_EMPRESAS);
    const domainUsers = LAB_DATA_CONFIG.releaseMode ? (users || []) : (users || SEED_USERS);

    dbGet("produ:empresas").then(async value => {
      if (!value) {
        if (LAB_DATA_CONFIG.releaseMode) {
          setEmpresasRaw([]);
          return;
        }
        const source = await dbCloneFromProd("produ:empresas", SEED_EMPRESAS);
        const seeded = normalizeEmpresasTenantCodes(source || SEED_EMPRESAS);
        setEmpresasRaw(seeded);
        dbSet("produ:empresas", seeded);
      } else {
        const normalized = normalizeEmpresasTenantCodes(value);
        setEmpresasRaw(normalized);
        if (!LAB_DATA_CONFIG.releaseMode && JSON.stringify(normalized) !== JSON.stringify(value)) dbSet("produ:empresas", normalized);
      }
    });

    dbGet("produ:users").then(async value => {
      const clonedUsers = !value && !LAB_DATA_CONFIG.releaseMode ? await dbCloneFromProd("produ:users", SEED_USERS) : null;
      const baseUsers = value && Array.isArray(value) ? value : clonedUsers || (LAB_DATA_CONFIG.releaseMode ? [] : SEED_USERS);
      const normalizedUsers = LAB_DATA_CONFIG.releaseMode ? baseUsers : ensureRequiredSystemUsers(baseUsers);
      setUsersRaw(normalizedUsers);
      if (!LAB_DATA_CONFIG.releaseMode && (!value || JSON.stringify(normalizedUsers) !== JSON.stringify(baseUsers))) dbSet("produ:users", normalizedUsers);
    });

    dbGet("produ:printLayouts").then(async value => {
      const clonedLayouts = value ?? (
        LAB_DATA_CONFIG.releaseMode
          ? DEFAULT_PRINT_LAYOUTS
          : await dbCloneFromProd("produ:printLayouts", DEFAULT_PRINT_LAYOUTS)
      );
      const normalized = normalizePrintLayouts(clonedLayouts || DEFAULT_PRINT_LAYOUTS);
      setPrintLayoutsRaw(normalized);
      if (!LAB_DATA_CONFIG.releaseMode && (!value || JSON.stringify(normalized) !== JSON.stringify(clonedLayouts))) dbSet("produ:printLayouts", normalized);
    });

    dbGet("produ:supportThreads").then(value => {
      const normalized = normalizeSupportThreads(value || [], domainEmpresas, domainUsers, supportSettings || {});
      setSupportThreadsRaw(normalized);
      if (!LAB_DATA_CONFIG.releaseMode && (!value || JSON.stringify(normalized) !== JSON.stringify(value))) dbSet("produ:supportThreads", normalized);
    });

    dbGet("produ:supportSettings").then(value => {
      const normalized = buildSupportSettings(value || {}, domainUsers);
      setSupportSettingsRaw(normalized);
      if (!LAB_DATA_CONFIG.releaseMode && (!value || JSON.stringify(normalized) !== JSON.stringify(value))) dbSet("produ:supportSettings", normalized);
    });

    applyTheme(THEME_PRESETS.dark);

    const stored = loadStoredJson(localLabKey("session"));
    if (stored) setStoredSession(stored);
  }, []);
}
