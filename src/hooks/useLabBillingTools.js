import { useCallback, useMemo } from "react";
import { billingContact, openMailto, openWhatsApp } from "../lib/utils/helpers";

export function useLabBillingTools({
  allDocs,
  movimientos,
  setFacturas,
  setMovimientos,
  canEdit = false,
  ntf,
  empresa,
  clientes,
  auspiciadores,
  invoiceEntityName,
  cobranzaState,
  fmtD,
  fmtM,
  fmtMonthPeriod,
  today,
  addMonths,
  uid,
}) {
  const invoices = useMemo(() => allDocs.filter((f) => f.tipoDoc === "Invoice"), [allDocs]);

  const seriesList = useMemo(() => Object.values(allDocs.filter((f) => f.seriesId).reduce((acc, f) => {
    const key = f.seriesId;
    const bucket = acc[key] || { id: key, docs: [] };
    bucket.docs.push(f);
    acc[key] = bucket;
    return acc;
  }, {})).map((bucket) => {
    const docs = [...bucket.docs].sort((a, b) => Number(a.seriesIndex || 0) - Number(b.seriesIndex || 0) || String(a.fechaEmision || "").localeCompare(String(b.fechaEmision || "")));
    const first = docs[0] || {};
    const entityName = invoiceEntityName(first, clientes, auspiciadores);
    const activeDocs = docs.filter((d) => d.recurringStatus !== "Pausada" && d.recurringStatus !== "Cancelada");
    const status = docs.some((d) => d.recurringStatus === "Pausada") ? "Pausada" : docs.some((d) => d.recurringStatus === "Cancelada") ? "Cancelada" : "Activa";
    return {
      ...bucket,
      docs,
      first,
      status,
      entityName,
      totalMonths: Math.max(...docs.map((d) => Number(d.seriesTotal || d.recMonths || docs.length)), docs.length),
      projected: docs.reduce((s, d) => s + Number(d.total || 0), 0),
      nextDate: activeDocs.find((d) => !d.fechaPago && (d.estado === "Pendiente" || d.estado === "Emitida"))?.fechaEmision || docs.find((d) => d.fechaEmision)?.fechaEmision || "",
    };
  }).sort((a, b) => String(a.nextDate || "9999-12-31").localeCompare(String(b.nextDate || "9999-12-31"))), [allDocs, auspiciadores, clientes, invoiceEntityName]);

  const persistSeries = useCallback(async (nextFacts, removedIds = []) => {
    if (!canEdit) return false;
    await setFacturas(nextFacts);
    if (removedIds.length) {
      await setMovimientos((Array.isArray(movimientos) ? movimientos : []).filter((m) => !removedIds.includes(m.facturaId)));
    }
    return true;
  }, [canEdit, movimientos, setFacturas, setMovimientos]);

  const pauseSeries = useCallback(async (series) => {
    const nextFacts = allDocs.map((doc) => doc.seriesId === series.id ? { ...doc, recurringStatus: doc.recurringStatus === "Pausada" ? "Activa" : "Pausada" } : doc);
    await persistSeries(nextFacts);
    ntf?.(series.status === "Pausada" ? "Serie reactivada ✓" : "Serie pausada ✓");
  }, [allDocs, ntf, persistSeries]);

  const cutSeries = useCallback(async (series) => {
    const cutoff = today();
    const keepDocs = allDocs.filter((doc) => doc.seriesId !== series.id || String(doc.fechaEmision || "") <= cutoff);
    const removed = allDocs.filter((doc) => doc.seriesId === series.id && String(doc.fechaEmision || "") > cutoff);
    const keptCount = keepDocs.filter((doc) => doc.seriesId === series.id).length;
    const normalized = keepDocs.map((doc) => doc.seriesId === series.id ? { ...doc, recurringStatus: "Cancelada", recMonths: keptCount, seriesTotal: keptCount } : doc);
    await persistSeries(normalized, removed.map((doc) => doc.id));
    ntf?.(`Serie recortada ✓ (${removed.length} documento${removed.length === 1 ? "" : "s"} futuro${removed.length === 1 ? "" : "s"} eliminado${removed.length === 1 ? "" : "s"})`);
  }, [allDocs, ntf, persistSeries, today]);

  const regenerateSeries = useCallback(async (series) => {
    const base = series.docs[0];
    if (!base) return;
    const targetTotal = Math.max(Number(base.seriesTotal || base.recMonths || series.totalMonths || series.docs.length), series.docs.length);
    const existingByIndex = new Map(series.docs.map((doc) => [Number(doc.seriesIndex || 1), doc]));
    const newDocs = [];
    for (let idx = 1; idx <= targetTotal; idx += 1) {
      if (existingByIndex.has(idx)) continue;
      const fechaEmision = addMonths(base.recStart || base.fechaEmision || today(), idx - 1);
      const fechaVencimiento = base.fechaVencimiento ? addMonths(base.fechaVencimiento, idx - 1) : "";
      newDocs.push({
        ...base,
        id: uid(),
        cr: today(),
        estado: base.estado === "Anulada" ? "Borrador" : (base.estado || "Emitida"),
        cobranzaEstado: "Pendiente de pago",
        fechaPago: "",
        fechaEmision,
        fechaVencimiento,
        recurring: true,
        recurringStatus: "Activa",
        recStart: base.recStart || base.fechaEmision || today(),
        recMonths: targetTotal,
        seriesTotal: targetTotal,
        seriesIndex: idx,
        correlativo: base.correlativo
          ? `${base.correlativo.replace(/-\\d{2}$/, "")}-${String(idx).padStart(2, "0")}`
          : "",
      });
    }
    const nextFacts = [
      ...allDocs.map((doc) => doc.seriesId === series.id ? { ...doc, recurringStatus: "Activa", recMonths: targetTotal, seriesTotal: targetTotal } : doc),
      ...newDocs,
    ];
    await persistSeries(nextFacts);
    ntf?.(newDocs.length ? `Serie regenerada ✓ (${newDocs.length} mes${newDocs.length === 1 ? "" : "es"} nuevo${newDocs.length === 1 ? "" : "s"})` : "La serie ya estaba completa ✓");
  }, [addMonths, allDocs, ntf, persistSeries, today, uid]);

  const billingMessage = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    const due = doc.fechaVencimiento ? fmtD(doc.fechaVencimiento) : "sin vencimiento definido";
    return `Hola ${contact.nombre || ""}, te escribimos desde ${empresa?.nombre || "Produ"} por el invoice ${doc.correlativo || ""} por ${fmtM(doc.total || 0)}, con vencimiento ${due}. Quedamos atentos a tu confirmación de pago.\n\n${empresa?.bankInfo || ""}`.trim();
  }, [billingContact, empresa?.bankInfo, empresa?.nombre, fmtD, fmtM]);

  const statementMessage = useCallback((docs, entity, type) => {
    const contact = billingContact(entity, type);
    const lines = docs.map((doc) => `- ${doc.correlativo || "Invoice"} · ${fmtM(doc.total || 0)} · ${cobranzaState(doc)}${doc.fechaVencimiento ? ` · vence ${fmtD(doc.fechaVencimiento)}` : ""}`);
    return `Hola ${contact.nombre || ""}, te compartimos tu estado de cuenta con ${empresa?.nombre || "Produ"}.\n\n${lines.join("\n")}\n\nTotal pendiente: ${fmtM(docs.filter((doc) => cobranzaState(doc) !== "Pagado").reduce((s, doc) => s + Number(doc.total || 0), 0))}\n\n${empresa?.bankInfo || ""}`.trim();
  }, [billingContact, cobranzaState, empresa?.bankInfo, empresa?.nombre, fmtD, fmtM]);

  const sendBillingEmail = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    if (!contact.email) {
      alert("La entidad no tiene email de cobranza registrado.");
      return;
    }
    openMailto(contact.email, `Cobranza invoice ${doc.correlativo || ""}`, billingMessage(doc, entity));
  }, [billingContact, billingMessage, openMailto]);

  const sendBillingWhatsApp = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    if (!contact.tel) {
      alert("La entidad no tiene teléfono registrado.");
      return;
    }
    openWhatsApp(contact.tel, billingMessage(doc, entity));
  }, [billingContact, billingMessage, openWhatsApp]);

  const sendStatementEmail = useCallback((docs, entity, type) => {
    const contact = billingContact(entity, type);
    if (!contact.email) {
      alert("La entidad no tiene email de cobranza registrado.");
      return;
    }
    openMailto(contact.email, `Estado de cuenta ${contact.entidad || ""}`.trim(), statementMessage(docs, entity, type));
  }, [billingContact, openMailto, statementMessage]);

  const sendStatementWhatsApp = useCallback((docs, entity, type) => {
    const contact = billingContact(entity, type);
    if (!contact.tel) {
      alert("La entidad no tiene teléfono registrado.");
      return;
    }
    openWhatsApp(contact.tel, statementMessage(docs, entity, type));
  }, [billingContact, openWhatsApp, statementMessage]);

  return {
    invoices,
    seriesList,
    pauseSeries,
    cutSeries,
    regenerateSeries,
    sendBillingEmail,
    sendBillingWhatsApp,
    sendStatementEmail,
    sendStatementWhatsApp,
    fmtMonthPeriod,
  };
}
