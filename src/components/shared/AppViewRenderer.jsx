import { Suspense } from "react";
import { Card, Empty, GBtn } from "../../lib/ui/components";
import { LoadingScreen } from "./ShellLayout";
import { TREASURY_MODULE_ID } from "../../lib/utils/treasury";

const withFullFrame = node => <div style={{ width: "100%", minWidth: 0 }}>{node}</div>;

export function AppViewRenderer({
  navigation,
  VP,
  contexts,
  registry,
}) {
  const { superPanel, setSuperPanel, view } = navigation;
  const { superAdmin, access, state, helpers } = contexts;
  const { modules } = registry;
  const {
    curUser,
    curEmp,
    treasuryEnabled,
    alertas,
    useBal,
    fmtM,
    fmtD,
    uid,
    detId,
  } = state;
  const { canAccessModule, countCampaignPieces, normalizeTaskAssignees, getAssignedIds, assignedNameList, TREASURY_MODULE_ID: treasuryModuleId = TREASURY_MODULE_ID } = access;
  const {
    comentariosBlockComponent,
    movBlockComponent,
    miniCalComponent,
    tareasContextoComponent,
    ausCardComponent,
    exportMovCsvHelper,
    exportMovPdfHelper,
    TareaCard,
    COLS_TAREAS,
    getRoleConfig,
  } = helpers;
  const {
    SuperAdminPanelView,
    ViewDashboard,
    ViewTareas,
    ViewClientes,
    ViewCliDet,
    ViewPros,
    ViewProDet,
    ViewPgs,
    ViewPgDet,
    ViewContenidos,
    ViewContenidoDet,
    ViewEpDet,
    CrmModule,
    ViewCrew,
    ViewCalendario,
    ViewAus,
    ViewCts,
    ViewPres,
    ViewPresDet,
    ViewFact,
    TreasuryModule,
    ViewActivos,
  } = modules;

  if (superPanel) {
    return <>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800 }}>Torre de Control</div>
        <GBtn onClick={() => setSuperPanel(false)}>← Volver</GBtn>
      </div>
      <Suspense fallback={<LoadingScreen label="Cargando Torre de Control" note="Estamos preparando el plano SaaS y sus controles." />}>
        <SuperAdminPanelView controlProps={superAdmin} />
      </Suspense>
    </>;
  }

  if (!treasuryEnabled && view === treasuryModuleId) {
    return <Card title="Módulo fuera del corte">
      <Empty text="Tesorería aún no está habilitada en este release" sub="Su entrada se activará con rollout controlado, smoke test financiero y validación de datos." />
    </Card>;
  }

  if (!canAccessModule(curUser, view, curEmp)) {
    return <Card title="Acceso restringido">
      <Empty text="Este módulo está disponible solo para perfiles autorizados" sub="Si necesitas verlo, pide acceso al administrador de tu empresa." />
    </Card>;
  }

  switch (view) {
    case "dashboard":
      return withFullFrame(<ViewDashboard {...VP} alertas={alertas} useBal={useBal} fmtM={fmtM} />);
    case "tareas":
      return withFullFrame(<ViewTareas {...VP} setTareas={modules.setters.setTareas} openM={modules.openM} canDo={VP.canDo} TareaCard={TareaCard} COLS_TAREAS={COLS_TAREAS} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} />);
    case "clientes":
      return withFullFrame(<ViewClientes {...VP} useBal={useBal} ini={modules.ini} fmtM={fmtM} />);
    case "cli-det":
      return withFullFrame(<ViewCliDet {...VP} id={detId} setClientes={modules.setters.setClientes} useBal={useBal} fmtM={fmtM} fmtD={fmtD} countCampaignPieces={countCampaignPieces} ini={modules.ini} />);
    case "producciones":
      return withFullFrame(<ViewPros {...VP} setProducciones={modules.setters.setProducciones} useBal={useBal} fmtM={fmtM} fmtD={fmtD} />);
    case "pro-det":
      return withFullFrame(<ViewProDet {...VP} id={detId} setProducciones={modules.setters.setProducciones} setMovimientos={modules.setters.setMovimientos} setTareas={modules.setters.setTareas} useBal={useBal} fmtM={fmtM} fmtD={fmtD} ini={modules.ini} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent} MiniCal={miniCalComponent} TareasContexto={tareasContextoComponent} exportMovCSV={exportMovCsvHelper} exportMovPDF={exportMovPdfHelper} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} />);
    case "programas":
      return withFullFrame(<ViewPgs {...VP} setProgramas={modules.setters.setProgramas} useBal={useBal} fmtM={fmtM} />);
    case "pg-det":
      return withFullFrame(<ViewPgDet {...VP} id={detId} setProgramas={modules.setters.setProgramas} setEpisodios={modules.setters.setEpisodios} setMovimientos={modules.setters.setMovimientos} setTareas={modules.setters.setTareas} useBal={useBal} fmtM={fmtM} fmtD={fmtD} ini={modules.ini} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent} MiniCal={miniCalComponent} TareasContexto={tareasContextoComponent} exportMovCSV={exportMovCsvHelper} exportMovPDF={exportMovPdfHelper} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} AusCard={ausCardComponent} />);
    case "contenidos":
      return withFullFrame(<ViewContenidos {...VP} setPiezas={modules.setters.setPiezas} useBal={useBal} fmtM={fmtM} countCampaignPieces={countCampaignPieces} />);
    case "contenido-det":
      return withFullFrame(<ViewContenidoDet {...VP} id={detId} setPiezas={modules.setters.setPiezas} setMovimientos={modules.setters.setMovimientos} setTareas={modules.setters.setTareas} useBal={useBal} fmtM={fmtM} fmtD={fmtD} countCampaignPieces={countCampaignPieces} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent} MiniCal={miniCalComponent} TareasContexto={tareasContextoComponent} exportMovCSV={exportMovCsvHelper} exportMovPDF={exportMovPdfHelper} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} normalizeSocialPiece={modules.normalizeSocialPiece} />);
    case "ep-det":
      return withFullFrame(<ViewEpDet {...VP} id={detId} setEpisodios={modules.setters.setEpisodios} setMovimientos={modules.setters.setMovimientos} useBal={useBal} fmtM={fmtM} fmtD={fmtD} ComentariosBlock={comentariosBlockComponent} MovBlock={movBlockComponent} />);
    case "crm":
      return withFullFrame(<CrmModule {...VP} setClientes={modules.setters.setClientes} setAuspiciadores={modules.setters.setAuspiciadores} setCrmOpps={modules.setters.setCrmOpps} setCrmActivities={modules.setters.setCrmActivities} setCrmStages={modules.setters.setCrmStages} setTareas={modules.setters.setTareas} crmSavingRef={modules.crmSavingRef} TareaCard={TareaCard} getRoleConfig={getRoleConfig} uid={uid} fmtM={fmtM} fmtD={fmtD} canDo={action => modules.canDo(action)} />);
    case "crew":
      return withFullFrame(<ViewCrew {...VP} setCrew={modules.setters.setCrew} ini={modules.ini} />);
    case "calendario":
      return withFullFrame(<ViewCalendario {...VP} setEventos={modules.setters.setEventos} assignedNameList={assignedNameList} />);
    case "auspiciadores":
      return withFullFrame(<ViewAus {...VP} setAuspiciadores={modules.setters.setAuspiciadores} AusCard={ausCardComponent} />);
    case "contratos":
      return withFullFrame(<ViewCts {...VP} setContratos={modules.setters.setContratos} />);
    case "presupuestos":
      return withFullFrame(<ViewPres {...VP} setPresupuestos={modules.setters.setPresupuestos} />);
    case "pres-det":
      return withFullFrame(<ViewPresDet {...VP} id={detId} setPresupuestos={modules.setters.setPresupuestos} setProducciones={modules.setters.setProducciones} setProgramas={modules.setters.setProgramas} setPiezas={modules.setters.setPiezas} setMovimientos={modules.setters.setMovimientos} />);
    case "facturacion":
      return withFullFrame(<ViewFact {...VP} treasury={modules.treasuryProps} setFacturas={modules.setters.setFacturas} setMovimientos={modules.setters.setMovimientos} emitFacturaToBsale={modules.emitFacturaToBsale} syncFacturaWithBsale={modules.syncFacturaWithBsale} inspectFacturaBsaleSync={modules.inspectFacturaBsaleSync} />);
    case treasuryModuleId:
      return withFullFrame(<TreasuryModule {...VP} treasury={modules.treasuryProps} />);
    case "activos":
      return withFullFrame(<ViewActivos {...VP} setActivos={modules.setters.setActivos} fmtM={fmtM} fmtD={fmtD} />);
    default:
      return <Empty text="Módulo no disponible" />;
  }
}
