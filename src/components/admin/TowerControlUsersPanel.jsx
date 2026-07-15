import React from "react";
import { Badge, Btn, DBtn, Empty, FG, FI, FSl, FilterSel, GBtn, R2, R3, SearchBar } from "../../lib/ui/components";
import { ConfirmActionDialog } from "../shared/ConfirmActionDialog";

export function SystemUsersPanel({
  empresas,
  sysUf,
  setSysUf,
  sysUid,
  setSysUid,
  systemRoleOptions,
  saveSystemUser,
  editSystemUser,
  resetSystemUserAccess,
  deleteSystemUser,
  uq,
  setUQ,
  uRole,
  setURole,
  uState,
  setUState,
  uEmp,
  setUEmp,
  filteredUsers,
  ini,
  getRoleConfig,
  userGoogleCalendar,
}) {
  const [pendingDeleteUser, setPendingDeleteUser] = React.useState(null);
  const activeEmpresas = (Array.isArray(empresas) ? empresas : []).filter(item => item?.active !== false);
  const selectedTenantIds = Array.isArray(sysUf.tenantIds) && sysUf.tenantIds.length
    ? sysUf.tenantIds
    : [sysUf.empId].filter(Boolean);
  const toggleTenantSelection = tenantId => {
    setSysUf(prev => {
      const current = new Set(Array.isArray(prev.tenantIds) && prev.tenantIds.length ? prev.tenantIds : [prev.empId].filter(Boolean));
      if (current.has(tenantId)) current.delete(tenantId);
      else current.add(tenantId);
      const nextTenantIds = Array.from(current);
      return { ...prev, tenantIds: nextTenantIds, empId: nextTenantIds[0] || "" };
    });
  };

  return <div>
    <div style={{ fontSize: 12, color: "var(--gr3)", marginBottom: 12 }}>
      Usuarios del sistema. Desde aquí se gobierna el acceso entre empresas; el panel administrador solo gestiona el tenant actual.
    </div>
    <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 16, padding: 16, marginBottom: 16, boxShadow: "0 10px 24px rgba(15,23,42,.05)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", gap:12, alignItems:"center", marginBottom: 12, flexWrap:"wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700, marginBottom:4 }}>{sysUid ? "Editar usuario sistema" : "Crear usuario sistema"}</div>
          <div style={{ fontSize:11, color:"var(--gr2)" }}>{sysUid ? "Actualiza acceso, rol, tenant asignado o estado." : "Crea una cuenta administrativa del sistema y define su alcance."}</div>
        </div>
        {sysUid && <Badge label="Edición activa" color="cyan" sm />}
      </div>
      <R2>
        <FG label="Nombre"><FI value={sysUf.name || ""} onChange={e => setSysUf(p => ({ ...p, name: e.target.value }))} placeholder="Nombre completo" /></FG>
        <FG label="Email"><FI type="email" value={sysUf.email || ""} onChange={e => setSysUf(p => ({ ...p, email: e.target.value }))} placeholder="correo@empresa.cl" /></FG>
      </R2>
      <R3>
        <FG label={sysUid ? "Nueva contraseña opcional" : "Contraseña inicial"}><FI type="password" value={sysUf.password || ""} onChange={e => setSysUf(p => ({ ...p, password: e.target.value }))} placeholder={sysUid ? "Solo si quieres reemplazar la clave" : "Contraseña temporal o final"} /></FG>
        <FG label="Rol">
          <FSl value={sysUf.role || "admin"} onChange={e => setSysUf(p => ({ ...p, role: e.target.value, empId: e.target.value === "superadmin" ? "" : p.empId, tenantIds: e.target.value === "superadmin" ? [] : p.tenantIds }))}>
            {systemRoleOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </FSl>
        </FG>
        <FG label="Estado">
          <FSl value={sysUf.active === false ? "false" : "true"} onChange={e => setSysUf(p => ({ ...p, active: e.target.value === "true" }))}>
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
          </FSl>
        </FG>
      </R3>
      {sysUf.role !== "superadmin" && <FG label="Empresas asociadas">
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:8,padding:"10px 12px",border:"1px solid var(--bdr2)",borderRadius:14,background:"var(--card)",marginBottom:10}}>
          {activeEmpresas.map(item => (
            <label key={item.id} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)",cursor:"pointer"}}>
              <input type="checkbox" checked={selectedTenantIds.includes(item.id)} onChange={() => toggleTenantSelection(item.id)} />
              <span>{item.nombre || item.nom || "Empresa"}</span>
            </label>
          ))}
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginTop:-4,marginBottom:8}}>Si seleccionas más de una empresa, este usuario verá un selector de tenant al iniciar sesión.</div>
      </FG>}
      <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 10 }}>
        Desde Torre de Control se crean, actualizan y resguardan estas cuentas administrativas del sistema.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={saveSystemUser}>{sysUid ? "Guardar cambios" : "Guardar usuario sistema"}</Btn>
        {sysUid && <GBtn onClick={() => { setSysUid(null); setSysUf({ active: true, role: "admin", empId: "", tenantIds: [], password: "" }); }}>Cancelar</GBtn>}
      </div>
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={uq} onChange={setUQ} placeholder="Buscar usuario por nombre o email..." />
      <FilterSel value={uRole} onChange={setURole} options={systemRoleOptions} placeholder="Todos los roles" />
      <FilterSel value={uState} onChange={setUState} options={[{ value: "active", label: "Activos" }, { value: "inactive", label: "Inactivos" }]} placeholder="Todos los estados" />
      <FilterSel value={uEmp} onChange={setUEmp} options={(empresas || []).map(e => ({ value: e.id, label: e.nombre }))} placeholder="Todas las empresas" />
    </div>
    {filteredUsers.map(u => {
      const empresa = (empresas || []).find(e => e.id === u.empId);
      const roleCfg = getRoleConfig(u.role, empresa);
      return <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--sur)", border: "1px solid var(--bdr)", borderRadius: 12, marginBottom: 8, boxShadow: "0 8px 18px rgba(15,23,42,.04)" }}>
        <div style={{ width: 30, height: 30, background: "linear-gradient(135deg,var(--cy),var(--cy2))", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--bg)", flexShrink: 0 }}>{ini(u.name)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{u.name}</div>
          <div style={{ fontSize: 11, color: "var(--gr2)" }}>{u.email}</div>
          <div style={{ fontSize: 11, color: "var(--gr3)" }}>Tenant: {empresa?.nombre || "Sin tenant"}</div>
        </div>
        <Badge label={roleCfg.label} color={roleCfg.badge} sm />
        <Badge label={u.active ? "Activo" : "Inactivo"} color={u.active ? "green" : "red"} sm />
        <Badge label={userGoogleCalendar(u).connected ? "Google conectado" : "Sin Google"} color={userGoogleCalendar(u).connected ? "cyan" : "gray"} sm />
        <GBtn sm onClick={() => editSystemUser(u)}>Editar</GBtn>
        <GBtn sm onClick={() => resetSystemUserAccess(u)}>Reset clave</GBtn>
        {u.role !== "superadmin" && <DBtn sm onClick={() => setPendingDeleteUser(u)}>Eliminar</DBtn>}
      </div>;
    })}
    {!filteredUsers.length && <Empty text="Sin usuarios para este filtro" />}
    <ConfirmActionDialog
      open={Boolean(pendingDeleteUser)}
      title="Eliminar usuario del sistema"
      message={`¿Eliminar a ${pendingDeleteUser?.name || pendingDeleteUser?.email || "este usuario"} del sistema?`}
      confirmLabel="Eliminar usuario"
      onClose={() => setPendingDeleteUser(null)}
      onConfirm={() => {
        if (!pendingDeleteUser) return;
        deleteSystemUser(pendingDeleteUser);
        setPendingDeleteUser(null);
      }}
    />
  </div>;
}
