import React from "react";
import { Badge, Btn, Card, GBtn, Modal } from "../../lib/ui/components";
import { useLabAdminPanelModule } from "../../hooks/useLabAdminPanelModule";
import { SuperAdminPanel as TowerControlSuperAdminPanel } from "./TowerControlViews";
import { CarteraAdminPanel, ComunicacionesAdminPanel, EmpresasAdminPanel, ImpresosAdminPanel, IntegracionesAdminPanel, SolicitudesPanel, SystemUsersPanel } from "./TowerControlPanels";
import { ListasEditor } from "./AdminListasEditor";
import { RolesEditor } from "./AdminRolesEditor";
import { SolicitudesAdmin } from "./AdminSolicitudes";
import { EmpresaEditSection, PlatformFoundationPanel, ThemeSettingsPanel, TransactionalEmailTemplatesPanel, UsersAdminSection } from "./AdminPanelSections";

const RESPONSIVE_ADMIN_SUMMARY_GRID = "repeat(auto-fit,minmax(min(100%,160px),1fr))";
const RESPONSIVE_ADMIN_HEADER_GRID = "repeat(auto-fit,minmax(min(100%,140px),1fr))";

export function SuperAdminPanel({
  controlProps,
  actorUser,
  empresas,
  users,
  onSave,
  platformServices,
  onDeleteEmpresa,
  releaseMode = false,
  printLayouts,
  savePrintLayouts,
  helpers,
}) {
  const resolvedProps = controlProps || {
    actorUser,
    empresas,
    users,
    onSave,
    platformServices,
    onDeleteEmpresa,
    releaseMode,
    printLayouts,
    savePrintLayouts,
    helpers,
  };
  return <TowerControlSuperAdminPanel
    controlProps={resolvedProps}
    EmpresasAdminPanel={EmpresasAdminPanel}
    CarteraAdminPanel={CarteraAdminPanel}
    SystemUsersPanel={SystemUsersPanel}
    IntegracionesAdminPanel={IntegracionesAdminPanel}
    ComunicacionesAdminPanel={ComunicacionesAdminPanel}
    SolicitudesPanel={SolicitudesPanel}
    ImpresosAdminPanel={ImpresosAdminPanel}
  />;
}

export const EmpresaEdit = EmpresaEditSection;

function AdminTabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, width: "100%" }}>
      {tabs.map((label, index) => {
        const isActive = active === index;
        return (
          <button
            key={label}
            onClick={() => onChange(index)}
            style={{
              border: `1px solid ${isActive ? "var(--cy)" : "var(--bdr2)"}`,
              background: isActive ? "var(--cg)" : "var(--sur2)",
              color: isActive ? "var(--wh)" : "var(--gr2)",
              borderRadius: 999,
              padding: "9px 14px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "normal",
              minHeight: 42,
              width: "100%",
              textAlign: "center",
              transition: "all .18s ease",
              boxShadow: isActive ? "0 0 0 1px rgba(57,208,255,.08) inset" : "none",
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function AdminPanel(rawProps) {
  const props = rawProps.panelProps || rawProps;
  const [purgeConfirmOpen, setPurgeConfirmOpen] = React.useState(false);
  const {
    Modal,
    open,
    onClose,
    theme,
    onSaveTheme,
    empresa,
    user,
    users,
    empresas,
    saveUsers,
    saveEmpresas,
    platformServices,
    listas,
    saveListas,
    onPurge,
    ntf,
    dbGet,
    companyReferralDiscountHistory,
    assignableRoleOptions,
    sanitizeAssignableRole,
    uid,
    sha256Hex,
    themePresets,
    roleOptions,
    ini,
    getRoleConfig,
    userGoogleCalendar,
    companyGoogleCalendarEnabled,
    addons,
    defaultListas,
    XBtn,
    releaseMode = false,
  } = props;
  const {
    tab, setTab, lt, setLt, uf, setUf, uid2, setUid2, uq, setUq, uRole, setURole, uState, setUState,
    empUsers, filteredUsers, activeUsers, inactiveUsers, ADMIN_TABS, ADMIN_TAB_META,
    activeAdminTab, editableRoleOptions, canManageAdmin, platformSnapshot, platformLoading, platformPlanning, platformPreparingMemberships, platformQueueingMemberships, remoteBsaleSnapshot, remoteProvisionedModules, bsaleGovernanceMode, tenantCanEditBsaleConfig, tenantBsaleConfig, mercadoPagoGovernanceMode, tenantCanEditMercadoPagoConfig, tenantMercadoPagoConfig, setTenantMercadoPagoConfig, tenantMercadoPagoSaving, resetAccess, saveUser, toggleUserActive, deleteUser, planIdentityPromotions, refreshPlatformSnapshot, prepareIdentityMembershipBlueprints, prepareMembershipTransitionQueue, saveTenantMercadoPagoConfig,
  } = useLabAdminPanelModule({
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
  });
  const localCustomRoleCount = Array.isArray(empresa?.customRoles) ? empresa.customRoles.length : 0;
  const remoteCustomRoleCount = Array.isArray(platformSnapshot?.customRoles) ? platformSnapshot.customRoles.length : 0;
  const remoteUserShadowCount = Array.isArray(platformSnapshot?.userShadows) ? platformSnapshot.userShadows.length : 0;
  const remoteIdentityCandidateCount = Array.isArray(platformSnapshot?.identityCandidates) ? platformSnapshot.identityCandidates.length : 0;
  const remoteBlueprintCount = Array.isArray(platformSnapshot?.membershipBlueprints) ? platformSnapshot.membershipBlueprints.length : 0;
  const remoteQueueCount = Array.isArray(platformSnapshot?.membershipTransitionQueue) ? platformSnapshot.membershipTransitionQueue.length : 0;
  const identityUsersAligned = empUsers.length === remoteUserShadowCount;
  const identityRolesAligned = localCustomRoleCount === remoteCustomRoleCount;
  const identityHealthLabel = identityUsersAligned && identityRolesAligned
    ? "Alineado"
    : remoteUserShadowCount || remoteCustomRoleCount || remoteIdentityCandidateCount || remoteBlueprintCount || remoteQueueCount
      ? "Parcial"
      : "Inicial";
  const identityHealthColor = identityHealthLabel === "Alineado" ? "green" : identityHealthLabel === "Parcial" ? "yellow" : "gray";

  return <Modal open={open} onClose={onClose} title="⚙ Panel Administrador" sub={`${empresa?.nombre || "Sistema"}`} extraWide>
    <div style={{ padding: "18px 20px", border: "1px solid var(--bdr2)", borderRadius: 20, background: "linear-gradient(180deg,var(--cg),transparent 68%)", marginBottom: 16, boxShadow: "0 14px 40px rgba(0,0,0,.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.6, marginBottom: 6 }}>Control interno</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 24, fontWeight: 800, color: "var(--wh)" }}>{empresa?.nombre || "Empresa"}</div>
            <Badge label={empresa?.tenantCode || "Sin tenant"} color="purple" sm />
          </div>
          <div style={{ fontSize: 12, color: "var(--gr2)", maxWidth: 720, lineHeight: 1.6 }}>{ADMIN_TAB_META[activeAdminTab]}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: RESPONSIVE_ADMIN_HEADER_GRID, gap: 8, minWidth: 0, flex: "1 1 320px", width: "100%", maxWidth: 420 }}>
          <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios activos</div><div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: "var(--cy)" }}>{activeUsers}</div></div>
          <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Addons</div><div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: "#00e08a" }}>{(empresa?.addons || []).length}</div></div>
          <div style={{ padding: "10px 12px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios inactivos</div><div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: "#ffcc44" }}>{inactiveUsers}</div></div>
        </div>
      </div>
      <div style={{ padding: 10, borderRadius: 18, border: "1px solid var(--bdr2)", background: "var(--sur)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)", position: "relative", zIndex: 3 }}>
        <AdminTabs tabs={ADMIN_TABS} active={tab} onChange={setTab} />
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: RESPONSIVE_ADMIN_SUMMARY_GRID, gap: 10, marginBottom: 16, position: "relative", zIndex: 1 }}>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios activos</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "var(--cy)" }}>{activeUsers}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Usuarios inactivos</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "#ffcc44" }}>{inactiveUsers}</div></div>
      <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 14, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Addons activos</div><div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: "#00e08a" }}>{(empresa?.addons || []).length}</div></div>
    </div>
    {activeAdminTab==="Colores"&&<ThemeSettingsPanel lt={lt} setLt={setLt} themePresets={themePresets} onSaveTheme={onSaveTheme} ntf={ntf} />}
    {activeAdminTab==="Usuarios"&&<UsersAdminSection
      uq={uq} setUq={setUq} uRole={uRole} setURole={setURole} uState={uState} setUState={setUState}
      roleOptions={roleOptions} empresa={empresa} filteredUsers={filteredUsers} ini={ini} getRoleConfig={getRoleConfig}
      userGoogleCalendar={userGoogleCalendar} setUid2={setUid2} setUf={setUf} resetAccess={resetAccess}
      toggleUserActive={toggleUserActive} deleteUser={deleteUser} uid2={uid2} uf={uf}
      editableRoleOptions={editableRoleOptions} saveUser={saveUser} canManageAdmin={canManageAdmin}
    />}
    {activeAdminTab==="Empresa"&&empresa&&<EmpresaEditSection empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} ntf={ntf} addons={addons} companyGoogleCalendarEnabled={companyGoogleCalendarEnabled} canManageAdmin={canManageAdmin} mercadoPagoGovernanceMode={mercadoPagoGovernanceMode} tenantCanEditMercadoPagoConfig={tenantCanEditMercadoPagoConfig} tenantMercadoPagoConfig={tenantMercadoPagoConfig} setTenantMercadoPagoConfig={setTenantMercadoPagoConfig} tenantMercadoPagoSaving={tenantMercadoPagoSaving} saveTenantMercadoPagoConfig={saveTenantMercadoPagoConfig} />}
    {activeAdminTab==="Listas"&&<ListasEditor listas={listas} saveListas={saveListas} defaultListas={defaultListas}/>}
    {activeAdminTab==="Roles y Permisos"&&empresa&&<RolesEditor empresa={empresa} empresas={empresas} users={users} saveEmpresas={saveEmpresas} platformServices={platformServices} ntf={ntf} uid={uid} canManageAdmin={canManageAdmin}/>}
    {activeAdminTab==="Plataforma"&&<PlatformFoundationPanel
      planIdentityPromotions={planIdentityPromotions}
      platformPlanning={platformPlanning}
      prepareIdentityMembershipBlueprints={prepareIdentityMembershipBlueprints}
      platformPreparingMemberships={platformPreparingMemberships}
      prepareMembershipTransitionQueue={prepareMembershipTransitionQueue}
      platformQueueingMemberships={platformQueueingMemberships}
      refreshPlatformSnapshot={refreshPlatformSnapshot}
      platformLoading={platformLoading}
      platformSnapshot={platformSnapshot}
      remoteProvisionedModules={remoteProvisionedModules}
      addons={addons}
      identityHealthLabel={identityHealthLabel}
      identityHealthColor={identityHealthColor}
      identityUsersAligned={identityUsersAligned}
      identityRolesAligned={identityRolesAligned}
      empUsers={empUsers}
      remoteUserShadowCount={remoteUserShadowCount}
      localCustomRoleCount={localCustomRoleCount}
      remoteCustomRoleCount={remoteCustomRoleCount}
      remoteIdentityCandidateCount={remoteIdentityCandidateCount}
      remoteBlueprintCount={remoteBlueprintCount}
      remoteQueueCount={remoteQueueCount}
      bsaleGovernanceMode={bsaleGovernanceMode}
      tenantBsaleConfig={tenantBsaleConfig}
      remoteBsaleSnapshot={remoteBsaleSnapshot}
      tenantCanEditBsaleConfig={tenantCanEditBsaleConfig}
      empresa={empresa}
      getRoleConfig={getRoleConfig}
    />}
    {activeAdminTab==="Correo"&&empresa&&<TransactionalEmailTemplatesPanel empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} ntf={ntf} canManageAdmin={canManageAdmin} />}
    {!releaseMode && activeAdminTab==="Empresa" && canManageAdmin && (
      <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
        <GBtn onClick={() => setPurgeConfirmOpen(true)}>🔄 Restaurar / limpiar datos</GBtn>
      </div>
    )}
    <Modal open={purgeConfirmOpen} onClose={() => setPurgeConfirmOpen(false)} title="Confirmar limpieza" sub={empresa?.nombre || "Empresa"}>
      <div style={{ fontSize: 13, color: "var(--gr3)", lineHeight: 1.6, marginBottom: 18 }}>
        Vamos a limpiar los datos operativos de esta empresa dentro del `lab`. Esta acción vacía clientes, proyectos, contenidos, facturación, tesorería y activos del tenant actual.
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <GBtn onClick={() => setPurgeConfirmOpen(false)}>Cancelar</GBtn>
        <Btn
          onClick={() => {
            onPurge?.();
            setPurgeConfirmOpen(false);
          }}
          style={{ background: "linear-gradient(135deg,#ff6b6b,#e03131)", borderColor: "#ff8787" }}
        >
          Sí, limpiar datos
        </Btn>
      </div>
    </Modal>
  </Modal>;
}
