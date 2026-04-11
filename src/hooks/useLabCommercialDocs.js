import { useCallback } from "react";

export function useLabCommercialDocs({
  curEmp,
  facturas,
  movimientos,
  setFacturas,
  setMovimientos,
  closeM,
  ntf,
  cobranzaState,
  addMonths,
  today,
  uid,
  canDo,
}) {
  const canManageMovements = !!(canDo && canDo("movimientos"));
  const canManageBilling = !!(canDo && canDo("facturacion"));
  const saveMov = useCallback(async (d) => {
    if (!canManageMovements) return false;
    const item = {
      ...d,
      id: uid(),
      empId: curEmp?.id,
      mon: Number(d?.mon ?? d?.monto ?? 0),
      des: d?.des ?? d?.desc ?? "",
      fec: d?.fec ?? d?.fecha ?? today(),
    };
    await setMovimientos(prev => [...(Array.isArray(prev) ? prev : []), item]);
    closeM();
    ntf("Registrado ✓");
    return true;
  }, [canManageMovements, closeM, curEmp?.id, ntf, setMovimientos, today, uid]);

  const delMov = useCallback(async (id) => {
    if (!canManageMovements) return false;
    await setMovimientos((movimientos || []).filter((m) => m.id !== id));
    ntf("Eliminado", "warn");
    return true;
  }, [canManageMovements, movimientos, ntf, setMovimientos]);

  const saveFacturaDoc = useCallback(async (fact) => {
    if (!canManageBilling) return false;
    const currentFacts = Array.isArray(facturas) ? facturas : [];
    const isNew = !fact.id;
    const recurringEnabled = !!fact.recurring && isNew;
    const recurringMonths = Math.max(1, Number(fact.recMonths || 1));
    const seriesId = fact.seriesId || uid();
    const baseDate = fact.recStart || fact.fechaEmision || today();
    const series = recurringEnabled
      ? Array.from({ length: recurringMonths }, (_, idx) => {
          const fechaEmision = addMonths(baseDate, idx);
          const fechaVencimiento = fact.fechaVencimiento ? addMonths(fact.fechaVencimiento, idx) : "";
          const fechaPago = cobranzaState(fact) === "Pagado" && fact.fechaPago
            ? addMonths(fact.fechaPago, idx)
            : cobranzaState(fact) === "Pagado"
              ? fechaEmision
              : "";
          return {
            ...fact,
            empId: fact.empId || curEmp?.id,
            id: uid(),
            cr: idx === 0 ? (fact.cr || today()) : today(),
            tipoDoc: "Invoice",
            estado: fact.estado || "Emitida",
            cobranzaEstado: cobranzaState(fact),
            recurring: true,
            recurringStatus: fact.recurringStatus || "Activa",
            recMonths: recurringMonths,
            recStart: baseDate,
            seriesId,
            seriesIndex: idx + 1,
            seriesTotal: recurringMonths,
            fechaEmision,
            fechaVencimiento,
            fechaPago,
            correlativo: fact.correlativo
              ? (recurringMonths > 1 ? `${fact.correlativo}-${String(idx + 1).padStart(2, "0")}` : fact.correlativo)
              : "",
          };
        })
      : [{
          ...fact,
          empId: fact.empId || curEmp?.id,
          id: fact.id || uid(),
          cr: fact.cr || today(),
          estado: fact.estado || "Emitida",
          cobranzaEstado: cobranzaState(fact),
        }];

    const itemsById = new Map(currentFacts.map((x) => [x.id, x]));
    series.forEach((item) => itemsById.set(item.id, item));
    const nextFacts = Array.from(itemsById.values());
    await setFacturas(nextFacts);

    let nextMovs = Array.isArray(movimientos) ? [...movimientos] : [];
    series.forEach((item) => {
      const targetEt = item.tipoRef === "produccion" ? "pro" : item.tipoRef === "programa" ? "pg" : item.tipoRef === "contenido" ? "pz" : "";
      const movement = {
        empId: curEmp?.id,
        eid: item.proId || "",
        et: targetEt,
        tipo: "ingreso",
        cat: "Facturación",
        des: `${item.tipoDoc || "Orden de Factura"}${item.correlativo ? ` ${item.correlativo}` : ""}`,
        mon: Number(item.total || 0),
        fec: item.fechaPago || item.fechaEmision || today(),
        facturaId: item.id,
      };
      const existing = nextMovs.find((m) => m.facturaId === item.id);
      if (cobranzaState(item) === "Pagado") {
        nextMovs = existing
          ? nextMovs.map((m) => (m.facturaId === item.id ? { ...m, ...movement, id: m.id } : m))
          : [...nextMovs, { id: uid(), ...movement }];
      } else if (existing) {
        nextMovs = nextMovs.filter((m) => m.facturaId !== item.id);
      }
    });

    await setMovimientos(nextMovs);
    closeM();
    ntf(recurringEnabled ? `Serie mensual creada ✓ (${recurringMonths} documento${recurringMonths === 1 ? "" : "s"})` : "Documento guardado ✓");
    return true;
  }, [
    addMonths,
    canManageBilling,
    closeM,
    cobranzaState,
    curEmp?.id,
    facturas,
    movimientos,
    ntf,
    setFacturas,
    setMovimientos,
    today,
    uid,
  ]);

  return {
    saveMov,
    delMov,
    saveFacturaDoc,
  };
}
