import React from "react";
import { CommercialModalRouter } from "./CommercialModalRouter";
import { CrmModalRouter } from "./CrmModalRouter";
import { OperationsModalRouter } from "./OperationsModalRouter";
import { useLabModalActions } from "../hooks/useLabModalActions";

export function CoreModalRouter({
  modalComponents,
  helpers,
  mOpen,
  mData,
  closeM,
  VP,
  stateSetters,
  ntf,
  cSave,
  saveMov,
  saveFacturaDoc,
  uid,
  today,
}) {
  const { empresa, clientes, producciones, programas, piezas, auspiciadores, contratos, crew, eventos } = VP;
  const {
    setClientes,
    setProducciones,
    setProgramas,
    setPiezas,
    setEpisodios,
    setAuspiciadores,
    setContratos,
    setCrew,
    setEventos,
    setPresupuestos,
    setFacturas,
    setActivos,
    setTareas,
    setCrmOpps,
    setCrmActivities,
  } = stateSetters;
  const canWrite = (action) => !!(VP.canDo && VP.canDo(action));
  const guardSave = (action, handler) => async (payload) => {
    if (!canWrite(action)) return false;
    return handler(payload);
  };
  const {
    withEmp,
    saveContratoSafe,
    saveContentPiece,
    saveCrmOpp,
    saveTask,
  } = useLabModalActions({
    empresa,
    mData,
    contratos,
    piezas,
    crmStages: VP.crmStages,
    crmOpps: VP.crmOpps,
    crmActivities: VP.crmActivities,
    user: VP.user,
    tareas: VP.tareas,
    cSave,
    setContratos,
    setPiezas,
    setCrmOpps,
    setCrmActivities,
    setTareas,
    closeM,
    ntf,
    uid,
    today,
    helpers,
    canDo: VP.canDo,
  });

  return <>
    <OperationsModalRouter
      MCli={modalComponents.MCli}
      MPro={modalComponents.MPro}
      MPg={modalComponents.MPg}
      MCampanaContenido={modalComponents.MCampanaContenido}
      MPiezaContenido={modalComponents.MPiezaContenido}
      MEp={modalComponents.MEp}
      MAus={modalComponents.MAus}
      MCrew={modalComponents.MCrew}
      MEvento={modalComponents.MEvento}
      MActivo={modalComponents.MActivo}
      MTarea={modalComponents.MTarea}
      mOpen={mOpen}
      mData={mData}
      closeM={closeM}
      clientes={clientes}
      producciones={producciones}
      programas={programas}
      piezas={piezas}
      oportunidades={VP.crmOpps}
      crew={crew}
      crewOptions={(VP.crew || []).filter(c => c.empId === empresa?.id && c.active !== false)}
      listas={VP.listas}
      onSaveCli={guardSave("clientes", d => cSave(clientes, setClientes, withEmp(d)))}
      onSavePro={guardSave("producciones", d => cSave(producciones, setProducciones, withEmp(d)))}
      onSavePg={guardSave("programas", d => cSave(programas, setProgramas, withEmp(d)))}
      onSaveCampana={guardSave("contenidos", d => cSave(piezas, setPiezas, withEmp(d)))}
      onSavePieza={saveContentPiece}
      onSaveEp={guardSave("programas", d => cSave(VP.episodios, setEpisodios, withEmp(d)))}
      onSaveAus={guardSave("auspiciadores", d => cSave(auspiciadores, setAuspiciadores, withEmp(d)))}
      onSaveCrew={guardSave("crew", d => cSave(crew, setCrew, withEmp(d)))}
      onSaveEvento={guardSave("eventos", d => cSave(eventos, setEventos, withEmp(d)))}
      onSaveActivo={guardSave("activos", d => cSave(VP.activos, setActivos, withEmp(d)))}
      onSaveTarea={saveTask}
    />
    <CrmModalRouter
      mOpen={mOpen}
      mData={mData}
      closeM={closeM}
      crmStages={VP.crmStages}
      users={(VP.users || []).filter(u => u.empId === empresa?.id && u.active !== false)}
      onSaveCrmOpp={saveCrmOpp}
    />
    <CommercialModalRouter
      mOpen={mOpen}
      mData={mData}
      closeM={closeM}
      empresa={empresa}
      listas={VP.listas}
      clientes={clientes}
      producciones={producciones}
      programas={programas}
      piezas={piezas}
      auspiciadores={auspiciadores}
      contratos={VP.contratos}
      presupuestos={VP.presupuestos}
      facturas={VP.facturas}
      purchaseOrders={VP.purchaseOrders}
      currentUser={VP.user}
      onSaveContrato={saveContratoSafe}
      onSaveMovimiento={saveMov}
      onSavePresupuesto={guardSave("presupuestos", d => cSave(VP.presupuestos, setPresupuestos, withEmp(d)))}
      onSaveFactura={guardSave("facturacion", d => saveFacturaDoc(withEmp(d)))}
    />
  </>;
}
