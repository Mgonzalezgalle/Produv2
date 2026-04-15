import { useEffect, useState } from "react";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/labStorageConfig";
import { loadStoredJson } from "../lib/auth/sessionStorage";

function logGlobalInitIssue(scope, error) {
  console.error(`[lab-global-init] ${scope}`, error);
}

export function useLabGlobalInit({
  dbGet,
  dbSet,
  dbCloneFromProd,
  setEmpresasRaw,
  setUsersRaw,
  setPrintLayoutsRaw,
  normalizeEmpresasTenantCodes,
  ensureRequiredSystemUsers,
  normalizePrintLayouts,
  setStoredSession,
  SEED_EMPRESAS,
  SEED_USERS,
  DEFAULT_PRINT_LAYOUTS,
}) {
  const [globalInitReady, setGlobalInitReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const value = await dbGet("produ:empresas");
        if (cancelled) return;
        if (!value) {
          if (LAB_DATA_CONFIG.releaseMode) {
            setEmpresasRaw([]);
          } else {
            const source = await dbCloneFromProd("produ:empresas", SEED_EMPRESAS);
            if (cancelled) return;
            const seeded = normalizeEmpresasTenantCodes(source || SEED_EMPRESAS);
            setEmpresasRaw(seeded);
            await dbSet("produ:empresas", seeded);
          }
        } else {
          const normalized = normalizeEmpresasTenantCodes(value);
          setEmpresasRaw(normalized);
          if (!LAB_DATA_CONFIG.releaseMode && JSON.stringify(normalized) !== JSON.stringify(value)) {
            await dbSet("produ:empresas", normalized);
          }
        }
      } catch (error) {
        logGlobalInitIssue("No pudimos inicializar empresas", error);
      }

      try {
        const value = await dbGet("produ:users");
        const clonedUsers = !value && !LAB_DATA_CONFIG.releaseMode ? await dbCloneFromProd("produ:users", SEED_USERS) : null;
        if (cancelled) return;
        const baseUsers = value && Array.isArray(value) ? value : clonedUsers || (LAB_DATA_CONFIG.releaseMode ? [] : SEED_USERS);
        const normalizedUsers = LAB_DATA_CONFIG.releaseMode ? baseUsers : ensureRequiredSystemUsers(baseUsers);
        setUsersRaw(normalizedUsers);
        if (!LAB_DATA_CONFIG.releaseMode && (!value || JSON.stringify(normalizedUsers) !== JSON.stringify(baseUsers))) {
          await dbSet("produ:users", normalizedUsers);
        }
      } catch (error) {
        logGlobalInitIssue("No pudimos inicializar usuarios", error);
      }

      try {
        const value = await dbGet("produ:printLayouts");
        const clonedLayouts = value ?? (
          LAB_DATA_CONFIG.releaseMode
            ? DEFAULT_PRINT_LAYOUTS
            : await dbCloneFromProd("produ:printLayouts", DEFAULT_PRINT_LAYOUTS)
        );
        if (cancelled) return;
        const normalized = normalizePrintLayouts(clonedLayouts || DEFAULT_PRINT_LAYOUTS);
        setPrintLayoutsRaw(normalized);
        if (!LAB_DATA_CONFIG.releaseMode && (!value || JSON.stringify(normalized) !== JSON.stringify(clonedLayouts))) {
          await dbSet("produ:printLayouts", normalized);
        }
      } catch (error) {
        logGlobalInitIssue("No pudimos inicializar layouts de impresión", error);
      }

      try {
        const stored = loadStoredJson(localLabKey("session"));
        if (stored && !cancelled) setStoredSession(stored);
      } catch (error) {
        logGlobalInitIssue("No pudimos restaurar la sesión almacenada", error);
      }
      finally {
        if (!cancelled) setGlobalInitReady(true);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [dbGet, dbSet, dbCloneFromProd, setEmpresasRaw, setUsersRaw, setPrintLayoutsRaw, normalizeEmpresasTenantCodes, ensureRequiredSystemUsers, normalizePrintLayouts, setStoredSession, SEED_EMPRESAS, SEED_USERS, DEFAULT_PRINT_LAYOUTS]);

  return globalInitReady;
}
