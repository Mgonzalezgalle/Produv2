import { useEffect, useState } from "react";
import { getBsaleBillingConfig } from "../lib/integrations/bsaleBilling";
import { getRemoteBsaleSnapshot, getRemoteProvisionedModules } from "../components/admin/towerControlHealth";

export function useLabAdminPanelModule({
  theme,
  empresa,
  user,
  users,
  empresas,
  saveUsers,
  saveEmpresas,
  platformServices,
  ntf,
  dbGet,
  companyReferralDiscountHistory,
  assignableRoleOptions,
  sanitizeAssignableRole,
  uid,
  sha256Hex,
}) {
  const canManageAdmin = ["admin", "superadmin"].includes(user?.role || "");
  const isSuperAdmin = user?.role === "superadmin";
  const [tab, setTab] = useState(0);
  const [lt, setLt] = useState(theme || {});
  const [uf, setUf] = useState({});
  const [uid2, setUid2] = useState(null);
  const [uq, setUq] = useState("");
  const [uRole, setURole] = useState("");
  const [uState, setUState] = useState("");
  const [refSols, setRefSols] = useState([]);
  const [platformSnapshot, setPlatformSnapshot] = useState(null);
  const [platformLoading, setPlatformLoading] = useState(false);
  const [platformPlanning, setPlatformPlanning] = useState(false);
  const [platformPreparingMemberships, setPlatformPreparingMemberships] = useState(false);
  const [platformQueueingMemberships, setPlatformQueueingMemberships] = useState(false);
  const [tenantBsaleConfig, setTenantBsaleConfig] = useState({
    mode: "sandbox",
    status: "draft",
    token: "",
    officeId: "",
    documentTypeId: "",
    priceListId: "",
  });
  const [tenantBsaleSaving, setTenantBsaleSaving] = useState(false);
  const bsaleGovernance = empresa?.integrationConfigs?.bsale?.governance || {};
  const bsaleGovernanceMode = bsaleGovernance.mode || "disabled";
  const tenantCanEditBsaleConfig = bsaleGovernance.allowTenantConfig === true;

  useEffect(() => setLt(theme || {}), [theme]);
  useEffect(() => { dbGet("produ:solicitudes").then(v => setRefSols(v || [])); }, [dbGet]);
  useEffect(() => {
    const envConfig = getBsaleBillingConfig();
    const current = empresa?.integrationConfigs?.bsale?.sandbox || {};
    const source = current.token
      ? (tenantCanEditBsaleConfig ? "tenant" : "governed")
      : (envConfig.token ? "environment" : "unset");
    setTenantBsaleConfig({
      mode: bsaleGovernanceMode,
      status: current.status || "draft",
      token: current.token || "",
      officeId: current.officeId || "",
      documentTypeId: current.documentTypeId || "",
      priceListId: current.priceListId || "",
      source,
      governed: bsaleGovernanceMode !== "disabled",
      tenantCanEdit: tenantCanEditBsaleConfig,
    });
  }, [empresa, bsaleGovernanceMode, tenantCanEditBsaleConfig]);

  const empUsers = (users || []).filter(u => u.empId === empresa?.id);
  const filteredUsers = empUsers.filter(u =>
    (!uq || u.name?.toLowerCase().includes(uq.toLowerCase()) || u.email?.toLowerCase().includes(uq.toLowerCase())) &&
    (!uRole || u.role === uRole) &&
    (!uState || (uState === "active" ? u.active : u.active === false)),
  );
  const activeUsers = empUsers.filter(u => u.active !== false).length;
  const inactiveUsers = empUsers.filter(u => u.active === false).length;
  const referredSols = (refSols || []).filter(s => s.referredByEmpId === empresa?.id && s.tipo === "empresa");
  const referralHistory = companyReferralDiscountHistory(empresa);
  const ADMIN_TABS = ["Colores", "Usuarios", "Empresa", "Listas", "Roles y Permisos", ...(canManageAdmin ? ["Plataforma"] : []), "Correo"];
  const ADMIN_TAB_META = {
    "Colores": "Personaliza la identidad visual de la instancia con presets consistentes de Produ.",
    "Usuarios": "Gestiona usuarios del tenant, accesos, roles base y pertenencia al crew interno.",
    "Empresa": "Actualiza branding, datos societarios, bancarios y configuración general de la empresa.",
    "Listas": "Administra opciones desplegables y taxonomías visibles en formularios operativos.",
    "Roles y Permisos": "Crea roles propios por empresa y define acceso granular por módulo.",
    "Plataforma": "Inspecciona el estado remoto de foundation en Supabase para este tenant.",
    "Correo": "Gestiona templates base de correo transaccional visibles para este tenant.",
  };
  const activeAdminTab = ADMIN_TABS[tab];
  useEffect(() => {
    if (tab >= ADMIN_TABS.length) setTab(0);
  }, [tab, ADMIN_TABS.length]);
  const editableRoleOptions = assignableRoleOptions(empresa, user);
  const remoteBsaleSnapshot = getRemoteBsaleSnapshot(platformSnapshot);
  const remoteProvisionedModules = getRemoteProvisionedModules(platformSnapshot);

  useEffect(() => {
    if (ADMIN_TABS[tab] !== "Plataforma") return;
    if (!empresa?.id || !platformServices?.getTenantPlatformSnapshot) return;
    let cancelled = false;
    setPlatformLoading(true);
    Promise.resolve(platformServices.getTenantPlatformSnapshot(empresa.id))
      .then(snapshot => {
        if (!cancelled) setPlatformSnapshot(snapshot || null);
      })
      .catch(() => {
        if (!cancelled) setPlatformSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setPlatformLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, empresa?.id, platformServices]);

  const referralStatus = sol => {
    const targetEmp = (empresas || []).find(e => e.id === sol.empresaId);
    const hasActiveUser = (users || []).some(u => u.empId === sol.empresaId && u.active !== false);
    if (hasActiveUser || targetEmp?.pendingActivation === false) return "Activado";
    if (targetEmp) return "Tenant creado";
    return "Pendiente";
  };

  const resetAccess = async target => {
    if (!canManageAdmin || !target?.id) return;
    const temp = uid().slice(1, 9);
    if (platformServices?.updateTenantUser) {
      await platformServices.updateTenantUser(target.id, { password: temp });
    } else {
      await saveUsers((users || []).map(u => u.id === target.id ? { ...u, passwordHash: "", password: temp } : u));
    }
    ntf("Acceso temporal generado ✓");
    let emailResult = null;
    if (target?.email && platformServices?.sendTransactionalEmail) {
      try {
        const safeName = target?.name || target?.email || "equipo";
        const tenantName = empresa?.nombre || empresa?.nom || "Produ";
        const text = [
          `Hola ${safeName},`,
          "",
          `Actualizamos tu acceso en ${tenantName}.`,
          "",
          `Email: ${target.email || ""}`,
          `Contraseña temporal: ${temp}`,
          "",
          "Te recomendamos cambiarla al ingresar.",
        ].join("\n").trim();
        emailResult = await platformServices.sendTransactionalEmail({
          tenantId: empresa?.id || target?.empId || "",
          templateKey: "access_updated",
          subject: `Acceso actualizado en ${tenantName}`,
          to: [target.email],
          text,
          html: `<p>${text.replace(/\n/g, "<br />")}</p>`,
          entityType: "user_access",
          entityId: target?.id || "",
          metadata: {
            tenantName,
            userName: target?.name || "",
            mode: "access_updated",
          },
        });
      } catch {
        emailResult = { ok: false };
      }
    }
    alert(`Acceso temporal para ${target.email}: ${temp}${emailResult?.ok ? " / Correo enviado." : ""}`);
  };

  const saveUser = async () => {
    if (!canManageAdmin) return;
    if (!uf.name || !uf.email) return;
    const id = uid2 || uid();
    const prev = (users || []).find(x => x.id === id);
    const nextRole = sanitizeAssignableRole(
      uf.role || prev?.role || "viewer",
      empresa,
      user,
      prev?.role && ["admin", "superadmin"].includes(prev.role) ? prev.role : "viewer",
    );
    const passwordHash = uf.password
      ? await sha256Hex(uf.password)
      : prev?.passwordHash || (prev?.password ? await sha256Hex(prev.password) : "");
    const obj = {
      id,
      name: uf.name,
      email: uf.email,
      passwordHash,
      role: nextRole,
      empId: empresa?.id || null,
      active: uf.active !== false,
      isCrew: uf.isCrew === true,
      crewRole: uf.isCrew === true ? (uf.crewRole || "Crew interno") : "",
    };
    if (platformServices?.updateTenantUser && platformServices?.createTenantUser) {
      if (uid2) {
        await platformServices.updateTenantUser(uid2, { ...obj, password: uf.password || "" });
      } else {
        await platformServices.createTenantUser({
          tenantId: empresa?.id || null,
          name: obj.name,
          email: obj.email,
          role: obj.role,
          active: obj.active,
          password: uf.password || "",
          isCrew: obj.isCrew,
          crewRole: obj.crewRole,
        });
      }
    } else {
      await saveUsers(uid2 ? (users || []).map(u => u.id === uid2 ? obj : u) : [...(users || []), obj]);
    }
    setUf({});
    setUid2(null);
    ntf("Usuario guardado");
  };

  const toggleUserActive = async target => {
    if (!canManageAdmin || !target?.id) return;
    if (platformServices?.updateTenantUser) {
      await platformServices.updateTenantUser(target.id, { active: !target.active });
    } else {
      await saveUsers((users || []).map(u => u.id === target.id ? { ...u, active: !u.active } : u));
    }
    ntf(target.active ? "Usuario desactivado" : "Usuario activado");
  };

  const deleteUser = async target => {
    if (!canManageAdmin || !target?.id || target.role === "superadmin") return;
    if (platformServices?.deleteTenantUser) {
      await platformServices.deleteTenantUser(target.id);
    } else {
      await saveUsers((users || []).filter(u => u.id !== target.id));
    }
    ntf("Usuario eliminado", "warn");
  };

  const refreshPlatformSnapshot = async () => {
    if (!empresa?.id || !platformServices?.getTenantPlatformSnapshot) return;
    setPlatformLoading(true);
    try {
      const snapshot = await platformServices.getTenantPlatformSnapshot(empresa.id);
      setPlatformSnapshot(snapshot || null);
      return snapshot || null;
    } catch {
      setPlatformSnapshot(null);
      return null;
    } finally {
      setPlatformLoading(false);
    }
  };

  const planIdentityPromotions = async () => {
    if (!empresa?.id || !platformServices?.planIdentityPromotions) return;
    setPlatformPlanning(true);
    try {
      const nextPlans = await platformServices.planIdentityPromotions(empresa.id);
      const nextSnapshot = await refreshPlatformSnapshot();
      if ((!nextSnapshot?.promotionPlans || !nextSnapshot.promotionPlans.length) && Array.isArray(nextPlans) && nextPlans.length) {
        setPlatformSnapshot(prev => ({ ...(prev || {}), promotionPlans: nextPlans }));
      }
      ntf("Plan de promoción generado ✓");
    } catch (err) {
      ntf(err?.message || "No pudimos generar el plan de promoción.", "warn");
    } finally {
      setPlatformPlanning(false);
    }
  };

  const prepareIdentityMembershipBlueprints = async () => {
    if (!empresa?.id || !platformServices?.prepareIdentityMembershipBlueprints) return;
    setPlatformPreparingMemberships(true);
    try {
      const nextBlueprints = await platformServices.prepareIdentityMembershipBlueprints(empresa.id);
      const nextSnapshot = await refreshPlatformSnapshot();
      if ((!nextSnapshot?.membershipBlueprints || !nextSnapshot.membershipBlueprints.length) && Array.isArray(nextBlueprints) && nextBlueprints.length) {
        setPlatformSnapshot(prev => ({ ...(prev || {}), membershipBlueprints: nextBlueprints }));
      }
      ntf("Blueprints de membresía preparados ✓");
    } catch (err) {
      ntf(err?.message || "No pudimos preparar las membresías.", "warn");
    } finally {
      setPlatformPreparingMemberships(false);
    }
  };

  const prepareMembershipTransitionQueue = async () => {
    if (!empresa?.id || !platformServices?.prepareMembershipTransitionQueue) return;
    setPlatformQueueingMemberships(true);
    try {
      const nextQueue = await platformServices.prepareMembershipTransitionQueue(empresa.id);
      const nextSnapshot = await refreshPlatformSnapshot();
      if ((!nextSnapshot?.membershipTransitionQueue || !nextSnapshot.membershipTransitionQueue.length) && Array.isArray(nextQueue) && nextQueue.length) {
        setPlatformSnapshot(prev => ({ ...(prev || {}), membershipTransitionQueue: nextQueue }));
      }
      ntf("Cola de transición preparada ✓");
    } catch (err) {
      ntf(err?.message || "No pudimos preparar la cola de transición.", "warn");
    } finally {
      setPlatformQueueingMemberships(false);
    }
  };

  const saveTenantBsaleConfig = async () => {
    if (!empresa?.id) return;
    if (!tenantCanEditBsaleConfig) {
      ntf("La configuración de Bsale se gobierna desde Torre de Control.", "warn");
      return;
    }
    setTenantBsaleSaving(true);
    try {
      const nextIntegrationConfigs = {
        ...(empresa?.integrationConfigs || {}),
        bsale: {
          ...((empresa?.integrationConfigs || {}).bsale || {}),
          sandbox: {
            status: tenantBsaleConfig.status || "draft",
            token: String(tenantBsaleConfig.token || "").trim(),
            officeId: String(tenantBsaleConfig.officeId || "").trim(),
            documentTypeId: String(tenantBsaleConfig.documentTypeId || "").trim(),
            priceListId: String(tenantBsaleConfig.priceListId || "").trim(),
          },
        },
      };
      await saveEmpresas((empresas || []).map(em => em.id === empresa.id ? { ...em, integrationConfigs: nextIntegrationConfigs } : em));
      setTenantBsaleConfig(prev => ({ ...prev, source: prev.token ? "tenant" : "unset", tenantCanEdit: true }));
      if (platformServices?.getTenantPlatformSnapshot) {
        refreshPlatformSnapshot();
      }
      ntf("Configuración Bsale del tenant guardada ✓");
    } catch (err) {
      ntf(err?.message || "No pudimos guardar la configuración Bsale del tenant.", "warn");
    } finally {
      setTenantBsaleSaving(false);
    }
  };

  return {
    canManageAdmin,
    isSuperAdmin,
    tab,
    setTab,
    lt,
    setLt,
    uf,
    setUf,
    uid2,
    setUid2,
    uq,
    setUq,
    uRole,
    setURole,
    uState,
    setUState,
    refSols,
    empUsers,
    filteredUsers,
    activeUsers,
    inactiveUsers,
    referredSols,
    referralHistory,
    ADMIN_TABS,
    ADMIN_TAB_META,
    activeAdminTab,
    editableRoleOptions,
    platformSnapshot,
    platformLoading,
    platformPlanning,
    platformPreparingMemberships,
    platformQueueingMemberships,
    remoteBsaleSnapshot,
    remoteProvisionedModules,
    bsaleGovernanceMode,
    tenantCanEditBsaleConfig,
    tenantBsaleConfig,
    setTenantBsaleConfig,
    tenantBsaleSaving,
    referralStatus,
    resetAccess,
    saveUser,
    toggleUserActive,
    deleteUser,
    refreshPlatformSnapshot,
    planIdentityPromotions,
    prepareIdentityMembershipBlueprints,
    prepareMembershipTransitionQueue,
    saveTenantBsaleConfig,
  };
}
