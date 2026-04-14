import { useEffect, useState } from "react";
import { PLATFORM_API_MODES } from "../lib/backend/platformApiMode";

function buildTenantSnapshot(empresa = {}) {
  return {
    tenantCode: empresa?.tenantCode || "",
    nombre: empresa?.nombre || empresa?.brandName || "",
    brandName: empresa?.nombre || empresa?.brandName || "",
    rut: empresa?.rut || "",
    ema: empresa?.ema || "",
    tel: empresa?.tel || "",
    dir: empresa?.dir || "",
    logo: empresa?.logo || "",
    primaryColor: empresa?.theme?.cy || empresa?.primaryColor || "#00d4e8",
    active: empresa?.active !== false,
    customerType: empresa?.customerType || "productora",
    teamSize: empresa?.teamSize || "1-3",
    billingCurrency: empresa?.billingCurrency || "UF",
    billingMonthly: Number(empresa?.billingMonthly || 0),
    billingStatus: empresa?.billingStatus || "Pendiente",
    addons: Array.isArray(empresa?.addons) ? empresa.addons : [],
    requestedModules: Array.isArray(empresa?.addons) ? empresa.addons : [],
    metadata: {
      localTheme: empresa?.theme || null,
    },
  };
}

export function useLabTenantFoundationSync({
  curEmp,
  platformApiMode,
  platformApi,
}) {
  const [foundationTenantReady, setFoundationTenantReady] = useState(false);

  useEffect(() => {
    if (platformApiMode !== PLATFORM_API_MODES.SUPABASE) {
      setFoundationTenantReady(true);
      return;
    }
    if (!curEmp?.id || !platformApi?.tenants?.syncLegacyTenant) {
      setFoundationTenantReady(false);
      return;
    }

    let cancelled = false;
    setFoundationTenantReady(false);
    Promise.resolve(
      platformApi.tenants.syncLegacyTenant({
        legacyEmpId: curEmp.id,
        empresa: buildTenantSnapshot(curEmp),
      }).then(result => {
        if (cancelled) return result;
        if (result?.ok === false) {
          setFoundationTenantReady(false);
          return result;
        }
        setFoundationTenantReady(true);
        if (!platformApi?.foundation?.appendSyncAuditLog || result?.source !== "remote") return result;
        return platformApi.foundation.appendSyncAuditLog({
          legacyEmpId: curEmp.id,
          action: "tenant_snapshot_synced",
          entityType: "tenant",
          entityId: curEmp.id,
          payload: {
            tenantId: result?.tenant?.id || "",
            addons: Array.isArray(curEmp?.addons) ? curEmp.addons : [],
          },
        });
      }),
    ).catch(() => {
      if (!cancelled) setFoundationTenantReady(false);
    });

    return () => {
      cancelled = true;
    };
  }, [
    curEmp?.id,
    curEmp?.nombre,
    curEmp?.rut,
    curEmp?.ema,
    curEmp?.tel,
    curEmp?.dir,
    curEmp?.logo,
    curEmp?.active,
    curEmp?.billingMonthly,
    curEmp?.billingStatus,
    JSON.stringify(curEmp?.addons || []),
    JSON.stringify(curEmp?.theme || {}),
    platformApiMode,
    platformApi,
  ]);

  return foundationTenantReady;
}
