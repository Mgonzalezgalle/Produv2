import { useEffect, useState } from "react";
import { LAB_DATA_CONFIG, localLabKey } from "../lib/lab/labStorageConfig";
import { loadStoredJson } from "../lib/auth/sessionStorage";

function logGlobalInitIssue(scope, error) {
  console.error(`[lab-global-init] ${scope}`, error);
}

function normalizeText(value = "") {
  return String(value || "").trim();
}

function normalizeEmail(value = "") {
  return normalizeText(value).toLowerCase();
}

function inferTenantAddons(tenantStore = {}) {
  const moduleMap = [
    ["programas", "television"],
    ["episodios", "television"],
    ["producciones", "producciones"],
    ["piezas", "social"],
    ["presupuestos", "presupuestos"],
    ["facturas", "facturacion"],
    ["crmOpps", "crm"],
    ["crmActivities", "crm"],
    ["crmStages", "crm"],
    ["contratos", "contratos"],
    ["crew", "crew"],
    ["activos", "activos"],
    ["tareas", "tareas"],
    ["treasuryProviders", "tesoreria"],
    ["treasuryPayables", "tesoreria"],
    ["treasuryPurchaseOrders", "tesoreria"],
    ["treasuryIssuedOrders", "tesoreria"],
    ["treasuryReceipts", "tesoreria"],
    ["treasuryDisbursements", "tesoreria"],
  ];
  return [...new Set(moduleMap
    .filter(([key]) => tenantStore[key] !== null)
    .map(([, addon]) => addon))];
}

async function recoverReleaseEmpresasFromStorage({ dbGet, normalizeEmpresasModel }) {
  const [rawUsers, rawSupportThreads, rawSolicitudes, rawEmpresas] = await Promise.all([
    dbGet("produ:users"),
    dbGet("produ:supportThreads"),
    dbGet("produ:solicitudes"),
    dbGet("produ:empresas"),
  ]);
  const users = Array.isArray(rawUsers) ? rawUsers : [];
  const supportThreads = Array.isArray(rawSupportThreads) ? rawSupportThreads : [];
  const solicitudes = Array.isArray(rawSolicitudes) ? rawSolicitudes : [];
  const existingEmpresas = Array.isArray(rawEmpresas) ? rawEmpresas : [];
  const tenantIds = [...new Set([
    ...users.map(user => user?.empId).filter(Boolean),
    ...supportThreads.map(thread => thread?.empId).filter(Boolean),
    ...solicitudes.map(sol => sol?.empresaId).filter(Boolean),
    ...existingEmpresas.map(emp => emp?.id).filter(Boolean),
  ])];

  const recovered = [];

  for (const tenantId of tenantIds) {
    const tenantUsers = users.filter(user => user?.empId === tenantId);
    const tenantUserEmails = tenantUsers.map(user => normalizeEmail(user?.email)).filter(Boolean);
    const tenantThread = supportThreads.find(thread => thread?.empId === tenantId) || null;
    const tenantSolicitud = solicitudes.find(sol => sol?.empresaId === tenantId) || null;
    const existingEmpresa = existingEmpresas.find(emp => emp?.id === tenantId) || null;
    const hintedName = normalizeText(String(tenantThread?.title || "").replace(/^Soporte\s+/i, ""));
    const [
      clientes,
      programas,
      episodios,
      producciones,
      piezas,
      presupuestos,
      facturas,
      crmOpps,
      crmActivities,
      crmStages,
      contratos,
      crew,
      activos,
      tareas,
      treasuryProviders,
      treasuryPayables,
      treasuryPurchaseOrders,
      treasuryIssuedOrders,
      treasuryReceipts,
      treasuryDisbursements,
    ] = await Promise.all([
      dbGet(`produ:${tenantId}:clientes`),
      dbGet(`produ:${tenantId}:programas`),
      dbGet(`produ:${tenantId}:episodios`),
      dbGet(`produ:${tenantId}:producciones`),
      dbGet(`produ:${tenantId}:piezas`),
      dbGet(`produ:${tenantId}:presupuestos`),
      dbGet(`produ:${tenantId}:facturas`),
      dbGet(`produ:${tenantId}:crmOpps`),
      dbGet(`produ:${tenantId}:crmActivities`),
      dbGet(`produ:${tenantId}:crmStages`),
      dbGet(`produ:${tenantId}:contratos`),
      dbGet(`produ:${tenantId}:crew`),
      dbGet(`produ:${tenantId}:activos`),
      dbGet(`produ:${tenantId}:tareas`),
      dbGet(`produ:${tenantId}:treasuryProviders`),
      dbGet(`produ:${tenantId}:treasuryPayables`),
      dbGet(`produ:${tenantId}:treasuryPurchaseOrders`),
      dbGet(`produ:${tenantId}:treasuryIssuedOrders`),
      dbGet(`produ:${tenantId}:treasuryReceipts`),
      dbGet(`produ:${tenantId}:treasuryDisbursements`),
    ]);

    const clients = Array.isArray(clientes) ? clientes : [];
    const companyClient = clients.find(client => {
      const contacts = Array.isArray(client?.contactos) ? client.contactos : [];
      return contacts.some(contact => tenantUserEmails.includes(normalizeEmail(contact?.ema)));
    }) || clients.find(client => normalizeText(client?.nom) === hintedName) || null;

    const primaryContact = (Array.isArray(companyClient?.contactos) ? companyClient.contactos : [])[0] || null;
    const nombre = hintedName || normalizeText(companyClient?.nom) || normalizeText(tenantSolicitud?.empresaNombre) || normalizeText(existingEmpresa?.nombre);
    if (!nombre) continue;

    recovered.push({
      id: tenantId,
      nombre,
      rut: normalizeText(companyClient?.rut) || normalizeText(existingEmpresa?.rut),
      dir: normalizeText(companyClient?.dir) || normalizeText(existingEmpresa?.dir),
      tel: normalizeText(primaryContact?.tel) || normalizeText(existingEmpresa?.tel),
      ema: normalizeText(primaryContact?.ema || tenantUsers[0]?.email) || normalizeText(existingEmpresa?.ema),
      active: true,
      addons: inferTenantAddons({
        programas,
        episodios,
        producciones,
        piezas,
        presupuestos,
        facturas,
        crmOpps,
        crmActivities,
        crmStages,
        contratos,
        crew,
        activos,
        tareas,
        treasuryProviders,
        treasuryPayables,
        treasuryPurchaseOrders,
        treasuryIssuedOrders,
        treasuryReceipts,
        treasuryDisbursements,
      }),
    });
  }

  return normalizeEmpresasModel(recovered);
}

export function useLabGlobalInit({
  dbGet,
  dbSet,
  dbCloneFromProd,
  setEmpresasRaw,
  setUsersRaw,
  setPrintLayoutsRaw,
  normalizeEmpresasTenantCodes,
  normalizeEmpresasModel,
  ensureRequiredSystemUsers,
  normalizePrintLayouts,
  applyTheme,
  THEME_PRESETS,
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
            const recovered = await recoverReleaseEmpresasFromStorage({ dbGet, normalizeEmpresasModel });
            if (cancelled) return;
            setEmpresasRaw(recovered);
            if (Array.isArray(recovered) && recovered.length) {
              await dbSet("produ:empresas", recovered);
            }
          } else {
            const source = await dbCloneFromProd("produ:empresas", SEED_EMPRESAS);
            if (cancelled) return;
            const seeded = normalizeEmpresasTenantCodes(source || SEED_EMPRESAS);
            setEmpresasRaw(seeded);
            await dbSet("produ:empresas", seeded);
          }
        } else {
          const normalized = normalizeEmpresasTenantCodes(value);
          if (
            LAB_DATA_CONFIG.releaseMode
            && Array.isArray(normalized)
            && normalized.length === 0
          ) {
            const recovered = await recoverReleaseEmpresasFromStorage({ dbGet, normalizeEmpresasModel });
            if (cancelled) return;
            setEmpresasRaw(recovered);
            if (Array.isArray(recovered) && recovered.length) {
              await dbSet("produ:empresas", recovered);
            }
            return;
          }
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
        applyTheme(THEME_PRESETS.dark);
      } catch (error) {
        logGlobalInitIssue("No pudimos aplicar el tema inicial", error);
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
  }, [dbGet, dbSet, dbCloneFromProd, setEmpresasRaw, setUsersRaw, setPrintLayoutsRaw, normalizeEmpresasTenantCodes, normalizeEmpresasModel, ensureRequiredSystemUsers, normalizePrintLayouts, applyTheme, THEME_PRESETS.dark, setStoredSession, SEED_EMPRESAS, SEED_USERS, DEFAULT_PRINT_LAYOUTS]);

  return globalInitReady;
}
