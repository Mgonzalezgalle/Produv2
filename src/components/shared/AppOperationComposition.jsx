import { lazy, useMemo } from "react";
import { exportActiveClientsCSV, exportActiveClientsPDF, exportComentariosCSV, exportComentariosPDF, exportMovCSV, exportMovPDF } from "../../lib/utils/exports";

const MCliView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MCli })));
const MProView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MPro })));
const MPgView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MPg })));
const MCampanaContenidoView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MCampanaContenido })));
const MPiezaContenidoView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MPiezaContenido })));
const MEpView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MEp })));
const MAusView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MAus })));
const MCrewView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MCrew })));
const MEventoView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MEvento })));
const MActivoView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MActivo })));
const MTareaView = lazy(() => import("../operations/OperationModals").then(module => ({ default: module.MTarea })));
const AusCardView = lazy(() => import("../operations/OperationSupport").then(module => ({ default: module.AusCard })));
const MiniCalView = lazy(() => import("../operations/OperationSupport").then(module => ({ default: module.MiniCal })));
const MovBlockView = lazy(() => import("../operations/OperationSupport").then(module => ({ default: module.MovBlock })));
const ComentariosBlockView = lazy(() => import("../operations/TaskSupport").then(module => ({ default: module.ComentariosBlock })));
const TareaCardView = lazy(() => import("../operations/TaskSupport").then(module => ({ default: module.TareaCard })));
const TareasContextoView = lazy(() => import("../operations/TaskSupport").then(module => ({ default: module.TareasContexto })));

export function useAppOperationModalComponents({
  uid,
  today,
  normalizeSocialCampaign,
  normalizeSocialPiece,
  normalizeTaskAssignees,
  getAssignedIds,
  MESES,
}) {
  return useMemo(() => ({
    MCli: props => <MCliView {...props} uid={uid} />,
    MPro: MProView,
    MPg: MPgView,
    MCampanaContenido: props => <MCampanaContenidoView {...props} normalizeSocialCampaign={normalizeSocialCampaign} meses={MESES} today={today} />,
    MPiezaContenido: props => <MPiezaContenidoView {...props} normalizeSocialPiece={normalizeSocialPiece} uid={uid} today={today} />,
    MEp: MEpView,
    MAus: MAusView,
    MCrew: MCrewView,
    MEvento: MEventoView,
    MActivo: MActivoView,
    MTarea: props => <MTareaView {...props} normalizeTaskAssignees={normalizeTaskAssignees} getAssignedIds={getAssignedIds} />,
  }), [MESES, getAssignedIds, normalizeSocialCampaign, normalizeSocialPiece, normalizeTaskAssignees, today, uid]);
}

export function buildAppOperationHelpers({
  commentAttachmentFromFile,
  normalizeCommentAttachments,
  getAssignedIds,
  uid,
  today,
  fmtD,
  fmtM,
  ini,
  companyPrintColor,
  companyBillingStatus,
  companyBillingBaseNet,
  companyBillingNet,
  companyReferralDiscountMonthsPending,
  fmtMoney,
}) {
  const comentariosBlockComponent = props => <ComentariosBlockView {...props} helpers={{ commentAttachmentFromFile, normalizeCommentAttachments, getAssignedIds, uid, today, fmtD, exportComentariosCSV, exportComentariosPDF: (items, nombre, empresa) => exportComentariosPDF(items, nombre, empresa, { companyPrintColor }) }} />;
  const tareasContextoComponent = props => <TareasContextoView {...props} TareaCardComponent={TareaCardView} helpers={{ uid }} />;
  const movBlockComponent = props => <MovBlockView {...props} fmtM={fmtM} fmtD={fmtD} />;
  const miniCalComponent = props => <MiniCalView {...props} fmtD={fmtD} />;
  const ausCardComponent = props => <AusCardView {...props} ini={ini} fmtM={fmtM} fmtD={fmtD} />;
  const exportMovCsvHelper = (movs, nombre) => exportMovCSV(movs, nombre);
  const exportMovPdfHelper = (movs, nombre, empresa, tipo) => exportMovPDF(movs, nombre, empresa, tipo, { companyPrintColor });
  const exportActiveClientsCsvHelper = items => exportActiveClientsCSV(items, { companyBillingStatus, companyBillingBaseNet, companyBillingNet, companyReferralDiscountMonthsPending, today });
  const exportActiveClientsPdfHelper = items => exportActiveClientsPDF(items, { companyBillingStatus, companyBillingBaseNet, companyBillingNet, companyReferralDiscountMonthsPending, fmtMoney, fmtD, today });

  return {
    comentariosBlockComponent,
    tareasContextoComponent,
    movBlockComponent,
    miniCalComponent,
    ausCardComponent,
    exportMovCsvHelper,
    exportMovPdfHelper,
    exportActiveClientsCsvHelper,
    exportActiveClientsPdfHelper,
    TareaCard: TareaCardView,
  };
}
