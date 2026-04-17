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
  return <div>
    <div style={{ fontSize: 12, color: "var(--gr3)", marginBottom: 12 }}>
      Usuarios del sistema. Cada empresa gestiona sus propios usuarios desde Torre de Control.
    </div>
    <div style={{ background: "var(--card2)", border: "1px solid var(--bdr2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
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
          <FSl value={sysUf.role || "admin"} onChange={e => setSysUf(p => ({ ...p, role: e.target.value, empId: e.target.value === "superadmin" ? "" : p.empId }))}>
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
      {sysUf.role !== "superadmin" && <FG label="Empresa">
        <FSl value={sysUf.empId || ""} onChange={e => setSysUf(p => ({ ...p, empId: e.target.value }))}>
          <option value="">Sin empresa</option>
          {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
        </FSl>
      </FG>}
      <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 10 }}>
        Desde Torre de Control se crean, actualizan y resguardan estas cuentas administrativas del sistema.
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <Btn onClick={saveSystemUser}>{sysUid ? "Guardar cambios" : "Guardar usuario sistema"}</Btn>
        {sysUid && <GBtn onClick={() => { setSysUid(null); setSysUf({ active: true, role: "admin", empId: "", password: "" }); }}>Cancelar</GBtn>}
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
      return <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "var(--sur)", border: "1px solid var(--bdr)", borderRadius: 10, marginBottom: 8 }}>
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
