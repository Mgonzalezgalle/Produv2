import React from "react";
import { canAccessAdminSection, canManageAdminPanel, canManageSuperAdminPanel } from "../../lib/auth/authorization";
import { Badge, Btn, Card, GBtn, Modal } from "../../lib/ui/components";
import { useLabAdminPanelModule } from "../../hooks/useLabAdminPanelModule";
import { SuperAdminPanel as TowerControlSuperAdminPanel } from "./TowerControlViews";
import { CarteraAdminPanel, ComunicacionesAdminPanel, EmpresasAdminPanel, IntegracionesAdminPanel, SolicitudesPanel, SystemUsersPanel, WizardAdminPanel } from "./TowerControlPanels";
import { ListasEditor } from "./AdminListasEditor";
import { RolesEditor } from "./AdminRolesEditor";
import { SolicitudesAdmin } from "./AdminSolicitudes";
import { EmpresaEditSection, PlatformFoundationPanel, ThemeSettingsPanel, TransactionalEmailTemplatesPanel, UsersAdminSection } from "./AdminPanelSections";

const RESPONSIVE_ADMIN_SUMMARY_GRID = "repeat(auto-fit,minmax(min(100%,160px),1fr))";
const RESPONSIVE_ADMIN_HEADER_GRID = "repeat(auto-fit,minmax(min(100%,140px),1fr))";

function AdminStatCard({ label, value, tone = "var(--cy)", hint = null }) {
  return (
    <div style={{ background: "linear-gradient(180deg,rgba(255,255,255,.03),transparent)", border: "1px solid var(--bdr2)", borderRadius: 16, padding: "14px 15px", minHeight: 92 }}>
      <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "var(--fm)", fontSize: 24, fontWeight: 700, color: tone, lineHeight: 1 }}>{value}</div>
      {!!hint && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 8, lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

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
    WizardAdminPanel={WizardAdminPanel}
    IntegracionesAdminPanel={IntegracionesAdminPanel}
    ComunicacionesAdminPanel={ComunicacionesAdminPanel}
    SolicitudesPanel={SolicitudesPanel}
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
    empUsers, filteredUsers, activeUsers, inactiveUsers, operationalHealth, workflowAnalytics, criticalAuditEntries, operationalAuditEntries, ADMIN_TABS, ADMIN_TAB_META,
    activeAdminTab, editableRoleOptions, canManageAdmin, platformSnapshot, platformLoading, platformPlanning, platformPreparingMemberships, platformQueueingMemberships, remoteBsaleSnapshot, remoteProvisionedModules, bsaleGovernanceMode, tenantCanEditBsaleConfig, tenantBsaleConfig, setTenantBsaleConfig, tenantBsaleSaving, mercadoPagoGovernanceMode, tenantCanEditMercadoPagoConfig, simpleApiRcvGovernanceMode, tenantCanEditSimpleApiRcvConfig, diioGovernanceMode, tenantDiioEnabled, tenantCanEditDiioConfig, tenantMercadoPagoConfig, setTenantMercadoPagoConfig, tenantMercadoPagoSaving, tenantSimpleApiRcvConfig, setTenantSimpleApiRcvConfig, tenantSimpleApiRcvSaving, tenantDiioConfig, setTenantDiioConfig, tenantDiioSaving, tenantDiioTesting, tenantDiioImporting, resetAccess, saveUser, toggleUserActive, deleteUser, planIdentityPromotions, refreshPlatformSnapshot, prepareIdentityMembershipBlueprints, prepareMembershipTransitionQueue, saveTenantBsaleConfig, saveTenantMercadoPagoConfig, saveTenantSimpleApiRcvConfig, saveTenantDiioConfig, verifyTenantDiioConnection, importTenantDiioMeetings,
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
  const canOpenAdminPanel = canManageAdminPanel(user);
  const canOpenPlatformTab = canManageSuperAdminPanel(user);
  const healthWarnings = operationalHealth?.warningCount || 0;
  const adminStageLabel = canOpenPlatformTab ? "Gobierno total" : "Gobierno operativo";
  const currentTabDescription = ADMIN_TAB_META[activeAdminTab] || "Vista administrativa activa";
  const lightMode = theme?.mode === "light";
  const adminHeroBackground = lightMode
    ? "linear-gradient(180deg, rgba(17,138,178,.12), rgba(255,255,255,.96) 54%, rgba(241,246,255,.92) 100%)"
    : "linear-gradient(180deg,var(--cg),rgba(9,14,24,.82) 52%,rgba(9,14,24,.28) 100%)";
  const adminHeroShadow = lightMode
    ? "0 14px 30px rgba(17, 138, 178, .08)"
    : "0 18px 42px rgba(0,0,0,.12)";
  const adminHeroPanelBackground = lightMode ? "rgba(255,255,255,.78)" : "rgba(255,255,255,.03)";

  if (!canOpenAdminPanel) {
    return <Modal open={open} onClose={onClose} title="⚙ Panel Administrador" sub={`${empresa?.nombre || "Sistema"}`}>
      <Card title="Acceso restringido">
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6 }}>
          Este panel solo está disponible para perfiles administrativos autorizados.
        </div>
      </Card>
    </Modal>;
  }

  if (!canAccessAdminSection(user, activeAdminTab)) {
    return <Modal open={open} onClose={onClose} title="⚙ Panel Administrador" sub={`${empresa?.nombre || "Sistema"}`}>
      <Card title="Sección restringida">
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6 }}>
          Esta sección del panel está reservada para un perfil con mayor nivel de gobierno.
        </div>
      </Card>
    </Modal>;
  }

  return <Modal open={open} onClose={onClose} title="⚙ Panel Administrador" sub={`${empresa?.nombre || "Sistema"}`} extraWide>
    <div style={{ padding: "22px 22px 18px", border: "1px solid var(--bdr2)", borderRadius: 24, background: adminHeroBackground, marginBottom: 18, boxShadow: adminHeroShadow }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(300px,.95fr)", gap: 16, alignItems: "stretch", marginBottom: 16 }}>
        <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.8 }}>Centro de control</div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div style={{ fontFamily: "var(--fh)", fontSize: 28, fontWeight: 800, color: "var(--wh)", lineHeight: 1.1 }}>{empresa?.nombre || "Empresa"}</div>
              <Badge label={adminStageLabel} color={canOpenPlatformTab ? "cyan" : "purple"} sm />
              <Badge label={empresa?.tenantCode || "Sin código"} color="gray" sm />
            </div>
            <div style={{ fontSize: 13, color: "var(--gr2)", maxWidth: 760, lineHeight: 1.65 }}>{currentTabDescription}</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge label={`${activeAdminTab}`} color="cyan" sm />
            <Badge label={empresa?.active !== false ? "Empresa activa" : "Empresa inactiva"} color={empresa?.active !== false ? "green" : "yellow"} sm />
            <Badge label={`${(empresa?.addons || []).length} módulo${(empresa?.addons || []).length === 1 ? "" : "s"} activo${(empresa?.addons || []).length === 1 ? "" : "s"}`} color="gray" sm />
          </div>
        </div>
        <div style={{ border: "1px solid var(--bdr2)", borderRadius: 18, background: adminHeroPanelBackground, padding: 14, display: "grid", gap: 10 }}>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.4 }}>Lectura rápida</div>
          <div style={{ display: "grid", gridTemplateColumns: RESPONSIVE_ADMIN_HEADER_GRID, gap: 8 }}>
            <AdminStatCard label="Usuarios activos" value={activeUsers} tone="var(--cy)" />
            <AdminStatCard label="Módulos activos" value={(empresa?.addons || []).length} tone="#00e08a" />
            <AdminStatCard label="Usuarios inactivos" value={inactiveUsers} tone="#ffcc44" />
          </div>
        </div>
      </div>
      <div style={{ padding: 10, borderRadius: 18, border: "1px solid var(--bdr2)", background: "var(--sur)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.03)", position: "relative", zIndex: 3 }}>
        <AdminTabs tabs={ADMIN_TABS} active={tab} onChange={setTab} />
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: RESPONSIVE_ADMIN_SUMMARY_GRID, gap: 10, marginBottom: 18, position: "relative", zIndex: 1 }}>
      <AdminStatCard label="Sección activa" value={activeAdminTab} tone="var(--wh)" hint="La navegación mantiene una lectura única por contexto." />
      <AdminStatCard label="Usuarios activos" value={activeUsers} tone="var(--cy)" hint={`${inactiveUsers} usuario(s) inactivo(s) dentro de esta empresa.`} />
      <AdminStatCard label="Módulos activos" value={(empresa?.addons || []).length} tone="#00e08a" hint="Las capacidades habilitadas se gestionan desde el gobierno de la cuenta." />
    </div>
    {activeAdminTab==="Colores"&&<ThemeSettingsPanel lt={lt} setLt={setLt} themePresets={themePresets} onSaveTheme={onSaveTheme} ntf={ntf} />}
    {activeAdminTab==="Usuarios"&&<UsersAdminSection
      uq={uq} setUq={setUq} uRole={uRole} setURole={setURole} uState={uState} setUState={setUState}
      roleOptions={roleOptions} empresa={empresa} filteredUsers={filteredUsers} ini={ini} getRoleConfig={getRoleConfig}
      userGoogleCalendar={userGoogleCalendar} setUid2={setUid2} setUf={setUf} resetAccess={resetAccess}
      toggleUserActive={toggleUserActive} deleteUser={deleteUser} uid2={uid2} uf={uf}
      editableRoleOptions={editableRoleOptions} saveUser={saveUser} canManageAdmin={canManageAdmin}
    />}
    {activeAdminTab==="Empresa"&&empresa&&<EmpresaEditSection empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} platformServices={platformServices} ntf={ntf} addons={addons} companyGoogleCalendarEnabled={companyGoogleCalendarEnabled} canManageAdmin={canManageAdmin} bsaleGovernanceMode={bsaleGovernanceMode} tenantCanEditBsaleConfig={tenantCanEditBsaleConfig} tenantBsaleConfig={tenantBsaleConfig} setTenantBsaleConfig={setTenantBsaleConfig} tenantBsaleSaving={tenantBsaleSaving} saveTenantBsaleConfig={saveTenantBsaleConfig} mercadoPagoGovernanceMode={mercadoPagoGovernanceMode} tenantCanEditMercadoPagoConfig={tenantCanEditMercadoPagoConfig} tenantMercadoPagoConfig={tenantMercadoPagoConfig} setTenantMercadoPagoConfig={setTenantMercadoPagoConfig} tenantMercadoPagoSaving={tenantMercadoPagoSaving} saveTenantMercadoPagoConfig={saveTenantMercadoPagoConfig} simpleApiRcvGovernanceMode={simpleApiRcvGovernanceMode} tenantCanEditSimpleApiRcvConfig={tenantCanEditSimpleApiRcvConfig} tenantSimpleApiRcvConfig={tenantSimpleApiRcvConfig} setTenantSimpleApiRcvConfig={setTenantSimpleApiRcvConfig} tenantSimpleApiRcvSaving={tenantSimpleApiRcvSaving} saveTenantSimpleApiRcvConfig={saveTenantSimpleApiRcvConfig} diioGovernanceMode={diioGovernanceMode} tenantDiioEnabled={tenantDiioEnabled} tenantCanEditDiioConfig={tenantCanEditDiioConfig} tenantDiioConfig={tenantDiioConfig} setTenantDiioConfig={setTenantDiioConfig} tenantDiioSaving={tenantDiioSaving} tenantDiioTesting={tenantDiioTesting} tenantDiioImporting={tenantDiioImporting} saveTenantDiioConfig={saveTenantDiioConfig} verifyTenantDiioConnection={verifyTenantDiioConnection} importTenantDiioMeetings={importTenantDiioMeetings} operationalHealth={operationalHealth} workflowAnalytics={workflowAnalytics} criticalAuditEntries={criticalAuditEntries} operationalAuditEntries={operationalAuditEntries} />}
    {activeAdminTab==="Listas"&&<ListasEditor listas={listas} saveListas={saveListas} defaultListas={defaultListas}/>}
    {activeAdminTab==="Roles y Permisos"&&empresa&&<RolesEditor empresa={empresa} empresas={empresas} users={users} saveEmpresas={saveEmpresas} platformServices={platformServices} ntf={ntf} uid={uid} canManageAdmin={canManageAdmin}/>}
    {activeAdminTab==="Plataforma"&&canOpenPlatformTab&&<PlatformFoundationPanel
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
