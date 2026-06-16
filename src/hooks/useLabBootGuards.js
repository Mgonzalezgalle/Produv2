import { useEffect } from "react";
import { loadStoredJson } from "../lib/auth/sessionStorage";
import { localLabKey } from "../lib/lab/labStorageConfig";
import { normalizeTenantOperationalSnapshot } from "../lib/tenants/tenantDataIntegrity";

export function useLabBootGuards({
  curEmp,
  curUser,
  setSystemLeidas,
  piezas,
  ldPiezas,
  setPiezas,
  normalizePiezas,
  crew,
  ldCrew,
  setCrew,
  users,
  syncCrew,
  uid,
  tenantCollections = {},
  tenantSetters = {},
  tenantLoadingMap = {},
}) {
  useEffect(() => {
    if (!curEmp?.id || !curUser?.id) {
      setSystemLeidas([]);
      return;
    }
    setSystemLeidas(loadStoredJson(localLabKey(`sysread:${curEmp.id}:${curUser.id}`)) || []);
  }, [curEmp?.id, curUser?.id, setSystemLeidas]);

  useEffect(() => {
    if (!curEmp || ldPiezas || !Array.isArray(piezas)) return;
    const normalized = normalizePiezas(piezas);
    if (JSON.stringify(normalized) !== JSON.stringify(piezas)) setPiezas(normalized);
  }, [curEmp, ldPiezas, piezas, setPiezas, normalizePiezas]);

  useEffect(() => {
    if (!curEmp?.id || ldCrew) return;
    const scopedUsers = (users || []).filter(user => user?.empId === curEmp.id);
    const currentCrew = (crew || []).filter(member => member?.empId === curEmp.id);
    const synced = syncCrew(scopedUsers, currentCrew);
    if (JSON.stringify(synced) !== JSON.stringify(currentCrew)) setCrew(synced);
  }, [curEmp?.id, users, crew, ldCrew, setCrew, syncCrew]);

  useEffect(() => {
    if (!curEmp?.id) return;
    if (Object.values(tenantLoadingMap || {}).some(Boolean)) return;
    const { collections, changed } = normalizeTenantOperationalSnapshot({
      empId: curEmp.id,
      uid,
      collections: tenantCollections,
    });
    if (!changed) return;
    Object.entries(collections).forEach(([key, value]) => {
      const setter = tenantSetters?.[key];
      if (typeof setter !== "function") return;
      if (JSON.stringify(value) === JSON.stringify(tenantCollections?.[key] || [])) return;
      Promise.resolve(setter(value)).catch(error => {
        console.warn(`[tenant-integrity] No pudimos normalizar ${key}`, error);
      });
    });
  }, [curEmp?.id, uid, tenantCollections, tenantSetters, tenantLoadingMap]);
}
