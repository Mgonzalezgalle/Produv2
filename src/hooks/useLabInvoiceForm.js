import { useEffect, useMemo, useState } from "react";
import { contractsForReference } from "../lib/utils/helpers";
import {
  getDefaultProduBillingReferenceReason,
  requiresProduBillingReferences,
  resolveProduBillingDocumentType,
  supportsProduDocumentHonorarios,
  supportsProduDocumentVat,
} from "../lib/integrations/billingDomain";

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
  const itemFactory = () => ({ id: crypto.randomUUID?.() || `it_${Math.random().toString(36).slice(2, 9)}`, desc: "", qty: 1, precio: 0, und: "Unidad" });
  const canPrograms = hasAddon(empresa, "television");
  const canPres = hasAddon(empresa, "presupuestos");
  const canContracts = hasAddon(empresa, "contratos");

  useEffect(() => {
    const requestedType = resolveProduBillingDocumentType(
      data?.documentTypeCode || data?.tipoDocumento || data?.tipoDoc || "factura_afecta",
    );
    const base = {
      correlativo: "",
      tipoDoc: requestedType.label,
      documentTypeCode: requestedType.code,
      tipoDocumento: requestedType.code,
      tipo: "cliente",
      entidadId: "",
      proId: "",
      tipoRef: "",
      items: [],
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
      referenceKind: "",
      referenceCodeSii: "",
      relatedDocumentId: "",
      relatedDocumentFolio: "",
      relatedDocumentTypeCode: "",
      relatedDocumentDate: "",
      relatedDocumentReason: "",
      relatedExternalDocumentId: "",
      relatedExternalReturnId: "",
      obs: "",
      obs2: "",
      recurring: false,
      recMonths: "6",
      recStart: today(),
    };
    const initial = data?.id ? { ...base, ...data } : { ...base, ...(data || {}) };
    const effectiveType = resolveProduBillingDocumentType(
      initial.recurring ? "invoice" : (initial.documentTypeCode || initial.tipoDocumento || initial.tipoDoc || "factura_afecta"),
    );
    setF({
      ...initial,
      referenceKind: initial.referenceKind || (initial.treasuryPurchaseOrderId ? "purchase_order" : ""),
      referenceCodeSii: initial.referenceCodeSii || (initial.treasuryPurchaseOrderId ? "801" : ""),
      tipoDoc: effectiveType.label,
      documentTypeCode: effectiveType.code,
      tipoDocumento: effectiveType.code,
      iva: supportsProduDocumentVat(effectiveType.code) ? !!initial.iva : false,
      honorarios: supportsProduDocumentHonorarios(effectiveType.code) ? !!initial.honorarios : false,
      relatedDocumentReason: requiresProduBillingReferences(effectiveType.code)
        ? (initial.relatedDocumentReason || getDefaultProduBillingReferenceReason(effectiveType.code))
        : (initial.relatedDocumentReason || ""),
    });
  }, [data, open, today]);

  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const applyPresupuesto = (presId) => {
    const pres = (presupuestos || []).find((p) => p.id === presId);
    if (!pres) {
      u("presupuestoId", "");
      return;
    }
    const currentType = resolveProduBillingDocumentType(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    );
    setF((prev) => ({
      ...prev,
      presupuestoId: pres.id,
      entidadId: pres.cliId || prev.entidadId,
      tipo: "cliente",
      tipoRef: pres.tipo || prev.tipoRef,
      proId: pres.refId || prev.proId,
      montoNeto: Number(pres.subtotal || pres.total || 0),
      iva: supportsProduDocumentVat(currentType.code) ? !!pres.iva : false,
      honorarios: supportsProduDocumentHonorarios(currentType.code) ? !!pres.honorarios : false,
      contratoId: pres.contratoId || prev.contratoId,
      items: Array.isArray(pres.items) ? pres.items.map((it) => ({
        id: it.id || itemFactory().id,
        desc: it.desc || "",
        qty: Number(it.qty || 1),
        precio: Number(it.precio || 0),
        und: it.und || "Unidad",
      })) : prev.items,
      obs: prev.obs || "",
      obs2: prev.obs2 || pres.obs || "",
      estado: prev.estado || "Emitida",
      cobranzaEstado: prev.cobranzaEstado || "Pendiente de pago",
      recurring: typeof prev.recurring === "boolean" ? prev.recurring : !!pres.recurring,
      recMonths: prev.recMonths || String(pres.recMonths || "6"),
      recStart: prev.recStart || pres.recStart || prev.fechaEmision || today(),
    }));
  };

  const addItem = () => setF((p) => ({ ...p, items: [...(p.items || []), itemFactory()] }));
  const updItem = (i, k, v) => setF((p) => ({
    ...p,
    items: (p.items || []).map((it, idx) => (idx === i ? { ...it, [k]: v } : it)),
  }));
  const delItem = (i) => setF((p) => ({
    ...p,
    items: (p.items || []).filter((_, idx) => idx !== i),
  }));

  const itemsSubtotal = (f.items || []).reduce((sum, item) => (
    sum + (Number(item.qty || 0) * Number(item.precio || 0))
  ), 0);
  const mn = (f.items || []).length ? itemsSubtotal : Number(f.montoNeto || 0);
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
    tipoDoc: resolveProduBillingDocumentType(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    )?.label || "Factura Afecta",
    documentTypeCode: resolveProduBillingDocumentType(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    )?.code || "factura_afecta",
    tipoDocumento: resolveProduBillingDocumentType(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    )?.code || "factura_afecta",
    honorarios: supportsProduDocumentHonorarios(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    ) ? !!f.honorarios : false,
    iva: supportsProduDocumentVat(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    ) ? !!f.iva : false,
    cobranzaEstado: f.cobranzaEstado || "Pendiente de pago",
    fechaPago: cobranzaState(f) === "Pagado" ? (f.fechaPago || today()) : "",
    relatedDocumentId: (
      requiresProduBillingReferences(
        f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
      ) || f.referenceKind === "purchase_order"
    ) ? (f.relatedDocumentId || "") : "",
    referenceKind: f.referenceKind || "",
    referenceCodeSii: f.referenceCodeSii || "",
    treasuryPurchaseOrderId: f.referenceKind === "purchase_order" ? (f.treasuryPurchaseOrderId || "") : "",
    relatedDocumentFolio: (
      requiresProduBillingReferences(
        f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
      ) || f.referenceKind === "purchase_order"
    ) ? (f.relatedDocumentFolio || "") : "",
    relatedDocumentTypeCode: (
      requiresProduBillingReferences(
        f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
      ) || f.referenceKind === "purchase_order"
    ) ? (f.relatedDocumentTypeCode || "") : "",
    relatedDocumentDate: (
      requiresProduBillingReferences(
        f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
      ) || f.referenceKind === "purchase_order"
    ) ? (f.relatedDocumentDate || "") : "",
    relatedDocumentReason: (
      requiresProduBillingReferences(
        f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
      ) || f.referenceKind === "purchase_order"
    )
      ? (f.relatedDocumentReason || getDefaultProduBillingReferenceReason(
        f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
      ))
      : "",
    relatedExternalDocumentId: requiresProduBillingReferences(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    ) ? (f.relatedExternalDocumentId || "") : "",
    relatedExternalReturnId: requiresProduBillingReferences(
      f.recurring ? "invoice" : (f.documentTypeCode || f.tipoDocumento || f.tipoDoc || "factura_afecta"),
    ) ? (f.relatedExternalReturnId || "") : "",
    items: (f.items || []).map((item) => ({
      ...item,
      qty: Number(item.qty || 0),
      precio: Number(item.precio || 0),
    })),
    montoNeto: mn,
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
    addItem,
    updItem,
    delItem,
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
