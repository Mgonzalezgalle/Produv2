import { useEffect, useMemo, useState } from "react";
import { contractsForReference } from "../lib/utils/helpers";

export function useLabInvoiceForm({
  open,
  data,
  empresa,
  clientes,
  auspiciadores,
  producciones,
  programas,
  piezas,
  presupuestos,
  contratos,
  today,
  hasAddon,
}) {
  const [f, setF] = useState({});
  const canPrograms = hasAddon(empresa, "television");
  const canPres = hasAddon(empresa, "presupuestos");
  const canContracts = hasAddon(empresa, "contratos");

  useEffect(() => {
    const base = {
      correlativo: "",
      tipoDoc: "Invoice",
      tipo: "cliente",
      entidadId: "",
      proId: "",
      tipoRef: "",
      montoNeto: 0,
      iva: false,
      honorarios: false,
      estado: "Emitida",
      cobranzaEstado: "Pendiente de pago",
      fechaEmision: today(),
      fechaVencimiento: "",
      fechaPago: "",
      presupuestoId: "",
      contratoId: "",
      obs: "",
      obs2: "",
      recurring: false,
      recMonths: "6",
      recStart: today(),
    };
    setF(data?.id ? { ...base, ...data } : { ...base, ...(data || {}) });
  }, [data, open, today]);

  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const applyPresupuesto = (presId) => {
    const pres = (presupuestos || []).find((p) => p.id === presId);
    if (!pres) {
      u("presupuestoId", "");
      return;
    }
    setF((prev) => ({
      ...prev,
      presupuestoId: pres.id,
      entidadId: pres.cliId || prev.entidadId,
      tipo: "cliente",
      tipoRef: pres.tipo || prev.tipoRef,
      proId: pres.refId || prev.proId,
      montoNeto: Number(pres.subtotal || pres.total || 0),
      iva: prev.tipoDoc === "Invoice" ? false : !!pres.iva,
      honorarios: prev.tipoDoc === "Invoice" ? false : !!pres.honorarios,
      contratoId: pres.contratoId || prev.contratoId,
      obs: prev.obs || "",
      obs2: prev.obs2 || pres.obs || "",
      estado: prev.estado || "Emitida",
      cobranzaEstado: prev.cobranzaEstado || "Pendiente de pago",
      recurring: typeof prev.recurring === "boolean" ? prev.recurring : !!pres.recurring,
      recMonths: prev.recMonths || String(pres.recMonths || "6"),
      recStart: prev.recStart || pres.recStart || prev.fechaEmision || today(),
    }));
  };

  const mn = Number(f.montoNeto || 0);
  const ivaV = f.iva ? Math.round(mn * 0.19) : f.honorarios ? Math.round(mn * 0.1525) : 0;
  const total = mn + ivaV;
  const recurringMonths = Math.max(1, Number(f.recMonths || 1));
  const projectedTotal = f.recurring ? total * recurringMonths : total;

  const ausValidos = useMemo(
    () => (auspiciadores || []).filter((a) => ["Auspiciador Principal", "Auspiciador Secundario"].includes(a.tip)),
    [auspiciadores],
  );
  const contratosEntidad = useMemo(
    () => contractsForReference(contratos || [], f.entidadId, f.tipoRef, f.proId),
    [contratos, f.entidadId, f.proId, f.tipoRef],
  );

  const buildPayload = (cobranzaState) => ({
    ...f,
    tipoDoc: f.recurring ? "Invoice" : f.tipoDoc,
    honorarios: f.tipoDoc === "Invoice" ? false : !!f.honorarios,
    iva: f.tipoDoc === "Invoice" ? false : !!f.iva,
    cobranzaEstado: f.cobranzaEstado || "Pendiente de pago",
    fechaPago: cobranzaState(f) === "Pagado" ? (f.fechaPago || today()) : "",
    ivaVal: ivaV,
    total,
    projectedTotal,
  });

  return {
    f,
    setF,
    u,
    canPrograms,
    canPres,
    canContracts,
    applyPresupuesto,
    mn,
    ivaV,
    total,
    recurringMonths,
    projectedTotal,
    ausValidos,
    contratosEntidad,
    buildPayload,
  };
}
