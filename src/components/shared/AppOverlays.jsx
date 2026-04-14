import { Suspense } from "react";
import { LoadingScreen } from "./ShellLayout";

export function AppOverlays({
  alertsPanel,
  systemPanel,
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
    setAlertasLeidas,
    setAlertasOcultas,
    setAlertasOpen,
    fmtD,
  } = alertsPanel;
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
    AdminPanelView,
    panelProps,
  } = adminPanel;
  return <>
    {alertasOpen && <Suspense fallback={null}>
      <AlertasPanelView
        alertas={alertas.filter(a => !alertasOcultas.includes(a.id))}
        leidas={alertasLeidas}
        onMarcar={id => setAlertasLeidas(p => p.includes(id) ? p : [...p, id])}
        onMarcarTodas={() => setAlertasLeidas(prev => Array.from(new Set([...(prev || []), ...alertas.filter(a => !alertasOcultas.includes(a.id)).map(a => a.id)])))}
        onOcultar={id => {
          setAlertasOcultas(p => p.includes(id) ? p : [...p, id]);
          setAlertasLeidas(p => p.filter(item => item !== id));
        }}
        onOcultarTodas={() => {
          const hiddenIds = alertas.filter(a => alertasLeidas.includes(a.id) && !alertasOcultas.includes(a.id)).map(a => a.id);
          setAlertasOcultas(prev => Array.from(new Set([...(prev || []), ...hiddenIds])));
          setAlertasLeidas(prev => prev.filter(id => !hiddenIds.includes(id)));
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
    {adminOpen && curEmp && <Suspense fallback={<LoadingScreen label="Cargando Panel Administrador" note="Estamos preparando la administración interna del tenant." />}>
      <AdminPanelView panelProps={panelProps} />
    </Suspense>}
  </>;
}
