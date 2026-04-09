import React from "react";
import { MCt, MMov } from "./commercial/CommercialModals";
import { MFact } from "./commercial/InvoiceViews";
import { MPres } from "./commercial/BudgetViews";

export function CommercialModalRouter({
  mOpen,
  mData,
  closeM,
  empresa,
  listas,
  clientes,
  producciones,
  programas,
  piezas,
  auspiciadores,
  contratos,
  presupuestos,
  facturas,
  currentUser,
  onSaveContrato,
  onSaveMovimiento,
  onSavePresupuesto,
  onSaveFactura,
}) {
  return <>
    <MCt
      open={mOpen==="ct"}
      data={mData}
      empresa={empresa}
      clientes={clientes}
      producciones={producciones}
      programas={programas}
      piezas={piezas}
      presupuestos={presupuestos}
      facturas={facturas}
      listas={listas}
      onClose={closeM}
      onSave={onSaveContrato}
    />
    <MMov
      open={mOpen==="mov"}
      data={mData}
      listas={listas}
      onClose={closeM}
      onSave={onSaveMovimiento}
    />
    <MPres
      open={mOpen==="pres"}
      data={mData}
      clientes={clientes}
      producciones={producciones}
      programas={programas}
      piezas={piezas}
      contratos={contratos}
      listas={listas}
      onClose={closeM}
      onSave={onSavePresupuesto}
      empresa={empresa}
      currentUser={currentUser}
    />
    <MFact
      open={mOpen==="fact"}
      data={mData}
      empresa={empresa}
      clientes={clientes}
      auspiciadores={auspiciadores}
      producciones={producciones}
      programas={programas}
      piezas={piezas}
      presupuestos={presupuestos}
      contratos={contratos}
      listas={listas}
      onClose={closeM}
      onSave={onSaveFactura}
    />
  </>;
}
