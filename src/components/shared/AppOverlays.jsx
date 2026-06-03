import { Suspense } from "react";
import { canManageAdminPanel } from "../../lib/auth/authorization";
import { LoadingScreen } from "./ShellLayout";

export function AppOverlays({
  alertsPanel,
  systemPanel,
  diioPanel,
  toastState,
  modalLayer,
  adminPanel,
}) {
  const {
    open: alertasOpen,
    AlertasPanelView,
    alertas,
    alertasOcultas,
    alertasLeidas,
    alertasResueltas,
    setAlertasLeidas,
    setAlertasResueltas,
    setAlertasOcultas,
    setAlertasOpen,
    recordAlertLifecycle,
    fmtD,
  } = alertsPanel;
  const findAlert = id => (alertas || []).find(item => item.id === id) || { id };
  const {
    open: systemOpen,
    SystemMessagesPanelView,
    currentEmpresa,
    systemMessages,
    systemLeidas,
    markSystemRead,
    markAllSystemRead,
    setSystemOpen,
    RichTextBlock,
  } = systemPanel;
  const {
    open: diioOpen,
    DiioInboxPanelView,
    currentEmpresa: diioEmpresa,
    currentUser,
    tenantDiioConnection,
    interactions: diioInteractions,
    targets: diioTargets,
    onConfirm: confirmDiioInteraction,
    onDismiss: dismissDiioInteraction,
    onRefresh: refreshDiioInteractions,
    setDiioOpen,
    fmtD: fmtDiioDate,
  } = diioPanel;
  const { toast, ToastView, setToast } = toastState;
  const {
    mOpen,
    CoreModalRouter,
    mData,
    closeM,
    VP,
    modalComponents,
    stateSetters,
    actions,
    helpers,
  } = modalLayer;
  const {
    adminOpen,
    curEmp,
    curUser,
    AdminPanelView,
    panelProps,
  } = adminPanel;
  return <>
    {alertasOpen && <Suspense fallback={null}>
      <AlertasPanelView
        alertas={alertas.filter(a => !alertasOcultas.includes(a.id))}
        leidas={alertasLeidas}
        resueltas={alertasResueltas}
        onMarcar={id => {
          setAlertasLeidas(p => p.includes(id) ? p : [...p, id]);
          recordAlertLifecycle?.("alert_reviewed", findAlert(id));
        }}
        onMarcarTodas={() => {
          const visibleAlerts = alertas.filter(a => !alertasOcultas.includes(a.id));
          setAlertasLeidas(prev => Array.from(new Set([...(prev || []), ...visibleAlerts.map(a => a.id)])));
          visibleAlerts.forEach(item => recordAlertLifecycle?.("alert_reviewed", item));
        }}
        onResolver={id => {
          setAlertasResueltas(p => p.includes(id) ? p : [...p, id]);
          setAlertasLeidas(p => p.includes(id) ? p : [...p, id]);
          recordAlertLifecycle?.("alert_resolved", findAlert(id));
        }}
        onResolverTodas={() => {
          const activeAlerts = alertas.filter(a => !alertasOcultas.includes(a.id) && !alertasResueltas.includes(a.id));
          const activeIds = activeAlerts.map(a => a.id);
          setAlertasResueltas(prev => Array.from(new Set([...(prev || []), ...activeIds])));
          setAlertasLeidas(prev => Array.from(new Set([...(prev || []), ...activeIds])));
          activeAlerts.forEach(item => recordAlertLifecycle?.("alert_resolved", item));
        }}
        onOcultar={id => {
          recordAlertLifecycle?.("alert_archived", findAlert(id));
          setAlertasOcultas(p => p.includes(id) ? p : [...p, id]);
          setAlertasLeidas(p => p.filter(item => item !== id));
          setAlertasResueltas(p => p.filter(item => item !== id));
        }}
        onOcultarTodas={() => {
          const hiddenAlerts = alertas.filter(a => (alertasLeidas.includes(a.id) || alertasResueltas.includes(a.id)) && !alertasOcultas.includes(a.id));
          const hiddenIds = hiddenAlerts.map(a => a.id);
          hiddenAlerts.forEach(item => recordAlertLifecycle?.("alert_archived", item));
          setAlertasOcultas(prev => Array.from(new Set([...(prev || []), ...hiddenIds])));
          setAlertasLeidas(prev => prev.filter(id => !hiddenIds.includes(id)));
          setAlertasResueltas(prev => prev.filter(id => !hiddenIds.includes(id)));
        }}
        onClose={() => setAlertasOpen(false)}
        fmtD={fmtD}
      />
    </Suspense>}
    {systemOpen && <Suspense fallback={null}>
      <SystemMessagesPanelView
        empresa={currentEmpresa}
        mensajes={systemMessages}
        leidas={systemLeidas}
        onMarcar={markSystemRead}
        onMarcarTodas={markAllSystemRead}
        onClose={() => setSystemOpen(false)}
        fmtD={fmtD}
        RichTextBlock={RichTextBlock}
      />
    </Suspense>}
    {diioOpen && <Suspense fallback={null}>
      <DiioInboxPanelView
        empresa={diioEmpresa}
        currentUser={currentUser}
        tenantDiioConnection={tenantDiioConnection}
        interactions={diioInteractions}
        targets={diioTargets}
        onConfirm={confirmDiioInteraction}
        onDismiss={dismissDiioInteraction}
        onRefresh={refreshDiioInteractions}
        onClose={() => setDiioOpen(false)}
        fmtD={fmtDiioDate}
      />
    </Suspense>}
    {toast && <Suspense fallback={null}>
      <ToastView msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
    </Suspense>}
    {mOpen && <Suspense fallback={<LoadingScreen label="Cargando formulario" note="Estamos preparando el modal comercial que necesitas." />}>
      <CoreModalRouter
        key={`${mOpen}:${mData?.id || mData?.campId || mData?.eid || mData?.refId || "new"}`}
        modalComponents={modalComponents}
        helpers={helpers}
        mOpen={mOpen}
        mData={mData}
        closeM={closeM}
        VP={VP}
        stateSetters={stateSetters}
        ntf={actions.ntf}
        cSave={actions.cSave}
        saveMov={actions.saveMov}
        saveFacturaDoc={actions.saveFacturaDoc}
        uid={actions.uid}
        today={actions.today}
      />
    </Suspense>}
    {adminOpen && curEmp && canManageAdminPanel(curUser) && <Suspense fallback={<LoadingScreen label="Cargando Panel Administrador" note="Estamos preparando la administración interna del tenant." />}>
      <AdminPanelView panelProps={panelProps} />
    </Suspense>}
  </>;
}
