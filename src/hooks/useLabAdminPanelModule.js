import { useEffect, useState } from "react";

export function useLabAdminPanelModule({
  theme,
  empresa,
  user,
  users,
  empresas,
  saveUsers,
  ntf,
  dbGet,
  companyReferralDiscountHistory,
  assignableRoleOptions,
  sanitizeAssignableRole,
  uid,
  sha256Hex,
}) {
  const safeCompanyReferralDiscountHistory =
    typeof companyReferralDiscountHistory === "function"
      ? companyReferralDiscountHistory
      : () => [];
  const canManageAdmin = ["admin", "superadmin"].includes(user?.role || "");
  const [tab, setTab] = useState(0);
  const [lt, setLt] = useState(theme || {});
  const [uf, setUf] = useState({});
  const [uid2, setUid2] = useState(null);
  const [uq, setUq] = useState("");
  const [uRole, setURole] = useState("");
  const [uState, setUState] = useState("");
  const [refSols, setRefSols] = useState([]);

  useEffect(() => setLt(theme || {}), [theme]);
  useEffect(() => {
    let active = true;
    dbGet("produ:solicitudes")
      .then(v => {
        if (!active) return;
        const normalized = Array.isArray(v)
          ? v
              .filter(item => item && typeof item === "object")
              .map(item => ({
                id: item.id || uid(),
                tipo: item.tipo || "",
                nom: item.nom || item.nombre || "",
                ema: item.ema || item.email || "",
                tel: item.tel || "",
                emp: item.emp || item.empresa || item.companyName || "",
                rol: item.rol || "admin",
                msg: item.msg || "",
                fecha: item.fecha || item.cr || "",
                estado: item.estado || "pendiente",
                empresaId: item.empresaId || "",
                customerType: item.customerType || "productora",
                teamSize: item.teamSize || "—",
                requestedModules: Array.isArray(item.requestedModules) ? item.requestedModules : [],
                referred: !!item.referred,
                referredByEmpId: item.referredByEmpId || "",
                referredByName: item.referredByName || "",
                referralCode: item.referralCode || "",
              }))
          : [];
        setRefSols(normalized);
      })
      .catch(() => {
        if (!active) return;
        setRefSols([]);
      });
    return () => { active = false; };
  }, [dbGet]);

  const empUsers = (users || []).filter(u => u.empId === empresa?.id);
  const filteredUsers = empUsers.filter(u =>
    (!uq || u.name?.toLowerCase().includes(uq.toLowerCase()) || u.email?.toLowerCase().includes(uq.toLowerCase())) &&
    (!uRole || u.role === uRole) &&
    (!uState || (uState === "active" ? u.active : u.active === false)),
  );
  const activeUsers = empUsers.filter(u => u.active !== false).length;
  const inactiveUsers = empUsers.filter(u => u.active === false).length;
  const referredSols = (Array.isArray(refSols) ? refSols : []).filter(s =>
    s?.tipo === "empresa" && (
      s?.referredByEmpId === empresa?.id ||
      (!!empresa?.referralCode && s?.referralCode === empresa.referralCode)
    )
  );
  const referralHistory = Array.isArray(safeCompanyReferralDiscountHistory(empresa))
    ? safeCompanyReferralDiscountHistory(empresa).filter(Boolean)
    : [];
  const ADMIN_TABS = ["Colores", "Usuarios", "Empresa", "Listas", "Roles y Permisos", "Referidos", "Datos"];
  const ADMIN_TAB_META = {
    "Colores": "Personaliza la identidad visual de la instancia con presets consistentes de Produ.",
    "Usuarios": "Gestiona usuarios del tenant, accesos, roles base y pertenencia al crew interno.",
    "Empresa": "Actualiza branding, datos societarios, bancarios y configuración general de la empresa.",
    "Listas": "Administra opciones desplegables y taxonomías visibles en formularios operativos.",
    "Roles y Permisos": "Crea roles propios por empresa y define acceso granular por módulo.",
    "Referidos": "Comparte tu código, monitorea activaciones y revisa meses bonificados.",
    "Datos": "Acciones críticas sobre la data del tenant y restauración controlada.",
  };
  const activeAdminTab = ADMIN_TABS[tab];
  const editableRoleOptions = assignableRoleOptions(empresa, user);

  const referralStatus = sol => {
    if (!sol || typeof sol !== "object") return "Pendiente";
    const targetEmp = (empresas || []).find(e => e.id === sol.empresaId);
    const hasActiveUser = (users || []).some(u => u.empId === sol.empresaId && u.active !== false);
    if (hasActiveUser || targetEmp?.pendingActivation === false) return "Activado";
    if (targetEmp) return "Tenant creado";
    return "Pendiente";
  };

  const resetAccess = async target => {
    if (!canManageAdmin || !target?.id) return;
    const temp = uid().slice(1, 9);
    await saveUsers((users || []).map(u => u.id === target.id ? { ...u, passwordHash: "", password: temp } : u));
    ntf("Acceso temporal generado ✓");
    alert(`Acceso temporal para ${target.email}: ${temp}`);
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
    saveUsers(uid2 ? (users || []).map(u => u.id === uid2 ? obj : u) : [...(users || []), obj]);
    setUf({});
    setUid2(null);
    ntf("Usuario guardado");
  };

  const toggleUserActive = async target => {
    if (!canManageAdmin || !target?.id) return;
    await saveUsers((users || []).map(u => u.id === target.id ? { ...u, active: !u.active } : u));
    ntf(target.active ? "Usuario desactivado" : "Usuario activado");
  };

  const deleteUser = async target => {
    if (!canManageAdmin || !target?.id || target.role === "superadmin") return;
    await saveUsers((users || []).filter(u => u.id !== target.id));
    ntf("Usuario eliminado", "warn");
  };

  return {
    canManageAdmin,
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
    referralStatus,
    resetAccess,
    saveUser,
    toggleUserActive,
    deleteUser,
  };
}
