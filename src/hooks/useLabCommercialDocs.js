import { useCallback } from "react";
import { appendOperationalAuditEntry } from "../lib/operations/operationalAudit";

const EMITTED_FACTURA_PROTECTED_FIELDS = [
  "correlativo",
  "tipoDoc",
  "documentTypeCode",
  "tipoDocumento",
  "tipo",
  "entidadId",
  "proId",
  "tipoRef",
  "items",
  "montoNeto",
  "iva",
  "honorarios",
  "ivaVal",
  "total",
  "estado",
  "fechaEmision",
  "fechaVencimiento",
  "presupuestoId",
  "contratoId",
  "referenceKind",
  "referenceCodeSii",
  "relatedDocumentId",
  "relatedDocumentFolio",
  "relatedDocumentTypeCode",
  "relatedDocumentDate",
  "relatedDocumentReason",
  "relatedExternalDocumentId",
  "relatedExternalReturnId",
  "treasuryPurchaseOrderId",
  "recurring",
  "recMonths",
  "recStart",
  "projectedTotal",
  "externalSync",
];

function normalizeReferencePayload(fact = {}) {
  const referenceCodeSii = String(fact.referenceCodeSii || "").trim();
  const referenceKind = String(fact.referenceKind || "").trim();
  if (!referenceCodeSii && !referenceKind) {
    return {
      ...fact,
      referenceKind: "",
      referenceCodeSii: "",
      relatedDocumentId: "",
      relatedDocumentFolio: "",
      relatedDocumentTypeCode: "",
      relatedDocumentDate: "",
      relatedDocumentReason: "",
      relatedExternalDocumentId: "",
      relatedExternalReturnId: "",
      treasuryPurchaseOrderId: "",
    };
  }
  if (referenceCodeSii === "801" || referenceKind === "purchase_order") {
    return {
      ...fact,
      referenceKind: "purchase_order",
      referenceCodeSii: "801",
      relatedDocumentId: "",
      relatedDocumentTypeCode: "orden_compra",
      relatedExternalDocumentId: "",
      relatedExternalReturnId: "",
    };
  }
  if (referenceCodeSii === "document" || referenceKind === "document") {
    return {
      ...fact,
      referenceKind: "document",
      referenceCodeSii: "document",
      treasuryPurchaseOrderId: "",
    };
  }
  return {
    ...fact,
    referenceKind: "tax_reference",
    relatedDocumentId: "",
    relatedDocumentTypeCode: "",
    relatedExternalDocumentId: "",
    relatedExternalReturnId: "",
    treasuryPurchaseOrderId: "",
  };
}

function normalizeProtectedFacturaPayload(existingFact = {}, nextFact = {}) {
  if (!existingFact?.externalSync) return nextFact;
  const merged = { ...nextFact, externalSync: existingFact.externalSync };
  EMITTED_FACTURA_PROTECTED_FIELDS.forEach((field) => {
    if (existingFact[field] !== undefined) merged[field] = existingFact[field];
  });
  return merged;
}

export function useLabCommercialDocs({
  curEmp,
  facturas,
  movimientos,
  setFacturas,
  setMovimientos,
  treasuryPurchaseOrders,
  setTreasuryPurchaseOrders,
  closeM,
  ntf,
  cobranzaState,
  addMonths,
  today,
  uid,
  canDo,
  currentUser = null,
  platformServices = null,
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
    try {
      const currentFacts = Array.isArray(facturas) ? facturas : [];
      const existingFact = currentFacts.find((item) => item.id === fact?.id) || null;
      const safeFact = normalizeProtectedFacturaPayload(existingFact, normalizeReferencePayload(fact));
      const isNew = !fact.id;
      const recurringEnabled = !!safeFact.recurring && isNew;
      const recurringMonths = Math.max(1, Number(safeFact.recMonths || 1));
      const seriesId = safeFact.seriesId || uid();
      const baseDate = safeFact.recStart || safeFact.fechaEmision || today();
      const series = recurringEnabled
        ? Array.from({ length: recurringMonths }, (_, idx) => {
            const fechaEmision = addMonths(baseDate, idx);
            const fechaVencimiento = safeFact.fechaVencimiento ? addMonths(safeFact.fechaVencimiento, idx) : "";
            const fechaPago = cobranzaState(safeFact) === "Pagado" && safeFact.fechaPago
              ? addMonths(safeFact.fechaPago, idx)
              : cobranzaState(safeFact) === "Pagado"
                ? fechaEmision
                : "";
            return {
              ...safeFact,
              empId: safeFact.empId || curEmp?.id,
              id: uid(),
              cr: idx === 0 ? (safeFact.cr || today()) : today(),
              tipoDoc: "Invoice",
              estado: safeFact.estado || "Emitida",
              cobranzaEstado: cobranzaState(safeFact),
              recurring: true,
              recurringStatus: safeFact.recurringStatus || "Activa",
              recMonths: recurringMonths,
              recStart: baseDate,
              seriesId,
              seriesIndex: idx + 1,
              seriesTotal: recurringMonths,
              fechaEmision,
              fechaVencimiento,
              fechaPago,
              correlativo: safeFact.correlativo
                ? (recurringMonths > 1 ? `${safeFact.correlativo}-${String(idx + 1).padStart(2, "0")}` : safeFact.correlativo)
                : "",
            };
          })
        : [{
            ...safeFact,
            empId: safeFact.empId || curEmp?.id,
            id: safeFact.id || uid(),
            cr: safeFact.cr || today(),
            estado: safeFact.estado || "Emitida",
            cobranzaEstado: cobranzaState(safeFact),
          }];

      const itemsById = new Map(currentFacts.map((x) => [x.id, x]));
      series.forEach((item) => itemsById.set(item.id, item));
      const nextFacts = Array.from(itemsById.values());
      await setFacturas(nextFacts);

      const createdItems = series.filter(item => item?.treasuryPurchaseOrderId);
      if (createdItems.length && typeof setTreasuryPurchaseOrders === "function") {
        const createdByOrder = createdItems.reduce((acc, item) => {
          const key = item.treasuryPurchaseOrderId;
          if (!key) return acc;
          acc.set(key, [...(acc.get(key) || []), item.id]);
          return acc;
        }, new Map());
        const nextOrders = (Array.isArray(treasuryPurchaseOrders) ? treasuryPurchaseOrders : []).map(order => {
          const extraIds = createdByOrder.get(order.id);
          if (!extraIds?.length) return order;
          const linkedInvoiceIds = Array.from(new Set([...(Array.isArray(order.linkedInvoiceIds) ? order.linkedInvoiceIds : []), ...extraIds]));
          return { ...order, linkedInvoiceIds };
        });
        await setTreasuryPurchaseOrders(nextOrders);
      }

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
      await appendOperationalAuditEntry({
        empId: curEmp?.id,
        area: "facturacion",
        action: isNew ? "created" : "updated",
        entityType: "factura",
        entityId: recurringEnabled ? seriesId : (series[0]?.id || safeFact.id || ""),
        actor: currentUser,
        payload: {
          recurring: recurringEnabled,
          recurringMonths,
          documentsAffected: series.map(item => item.id),
          total: series.reduce((sum, item) => sum + Number(item.total || 0), 0),
          documentType: safeFact.documentTypeCode || safeFact.tipoDocumento || safeFact.tipoDoc || "",
          entityId: safeFact.entidadId || "",
          entityType: safeFact.tipo || "",
        },
        platformServices,
      });
      closeM();
      ntf(recurringEnabled ? `Serie mensual creada ✓ (${recurringMonths} documento${recurringMonths === 1 ? "" : "s"})` : "Documento guardado ✓");
      return true;
    } catch (error) {
      console.error("[facturacion] No pudimos persistir el documento", error);
      ntf("No pudimos guardar el documento", "error");
      return false;
    }
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
    setTreasuryPurchaseOrders,
    today,
    treasuryPurchaseOrders,
    uid,
    currentUser,
    platformServices,
  ]);

  return {
    saveMov,
    delMov,
    saveFacturaDoc,
  };
}
