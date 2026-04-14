import { useCallback, useMemo } from "react";
import { billingContact, openMailto, openWhatsApp } from "../lib/utils/helpers";
import { resolveTransactionalEmailTemplate } from "../lib/integrations/transactionalEmailTemplates";

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
  platformApi = null,
  senderReplyTo = "",
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
    return resolveTransactionalEmailTemplate(empresa, "billing_invoice_collection", {
      contactName: contact.nombre || "",
      companyName: empresa?.nombre || "Produ",
      documentNumber: doc.correlativo || "",
      totalFormatted: fmtM(doc.total || 0),
      dueDate: due,
      bankInfo: empresa?.bankInfo || "",
      entityLabel: contact.entidad || "",
    }).body;
  }, [billingContact, empresa, fmtD, fmtM]);

  const statementMessage = useCallback((docs, entity, type) => {
    const contact = billingContact(entity, type);
    const lines = docs.map((doc) => `- ${doc.correlativo || "Invoice"} · ${fmtM(doc.total || 0)} · ${cobranzaState(doc)}${doc.fechaVencimiento ? ` · vence ${fmtD(doc.fechaVencimiento)}` : ""}`);
    return resolveTransactionalEmailTemplate(empresa, "billing_statement", {
      contactName: contact.nombre || "",
      entityLabel: contact.entidad || "",
      companyName: empresa?.nombre || "Produ",
      documentLines: lines.join("\n"),
      pendingTotalFormatted: fmtM(docs.filter((doc) => cobranzaState(doc) !== "Pagado").reduce((s, doc) => s + Number(doc.total || 0), 0)),
      bankInfo: empresa?.bankInfo || "",
    }).body;
  }, [billingContact, cobranzaState, empresa, fmtD, fmtM]);

  const createBillingEmailDraft = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc?.tipo);
    if (!contact.email) {
      return { ok: false, message: "La entidad no tiene email de cobranza registrado." };
    }
    const resolved = resolveTransactionalEmailTemplate(empresa, "billing_invoice_collection", {
      contactName: contact.nombre || "",
      companyName: empresa?.nombre || "Produ",
      documentNumber: doc?.correlativo || "",
      totalFormatted: fmtM(doc?.total || 0),
      dueDate: doc?.fechaVencimiento ? fmtD(doc.fechaVencimiento) : "sin vencimiento definido",
      bankInfo: empresa?.bankInfo || "",
      entityLabel: contact.entidad || "",
    });
    const subject = resolved.subject;
    const body = resolved.body;
    return {
      ok: true,
      draft: {
        tenantId: empresa?.id || "",
        templateKey: "billing_invoice_collection",
        subject,
        to: contact.email,
        body,
        entityType: "invoice",
        entityId: doc?.id || "",
        metadata: {
          companyName: empresa?.nombre || empresa?.nom || "Produ",
          contactName: contact.nombre || "",
          entityLabel: contact.entidad || "",
          documentNumber: doc?.correlativo || "",
          documentType: doc?.tipoDoc || doc?.documentTypeCode || "Invoice",
        },
      },
    };
  }, [billingContact, empresa, fmtD, fmtM]);

  const createStatementEmailDraft = useCallback((docs, entity, type) => {
    const contact = billingContact(entity, type);
    if (!contact.email) {
      return { ok: false, message: "La entidad no tiene email de cobranza registrado." };
    }
    const lines = docs.map((doc) => `- ${doc.correlativo || "Invoice"} · ${fmtM(doc.total || 0)} · ${cobranzaState(doc)}${doc.fechaVencimiento ? ` · vence ${fmtD(doc.fechaVencimiento)}` : ""}`);
    const resolved = resolveTransactionalEmailTemplate(empresa, "billing_statement", {
      contactName: contact.nombre || "",
      entityLabel: contact.entidad || "",
      companyName: empresa?.nombre || "Produ",
      documentLines: lines.join("\n"),
      pendingTotalFormatted: fmtM(docs.filter((doc) => cobranzaState(doc) !== "Pagado").reduce((s, doc) => s + Number(doc.total || 0), 0)),
      bankInfo: empresa?.bankInfo || "",
    });
    const subject = resolved.subject;
    const body = resolved.body;
    return {
      ok: true,
      draft: {
        tenantId: empresa?.id || "",
        templateKey: "billing_statement",
        subject,
        to: contact.email,
        body,
        entityType: "statement",
        entityId: entity?.id || "",
        metadata: {
          companyName: empresa?.nombre || empresa?.nom || "Produ",
          contactName: contact.nombre || "",
          entityLabel: contact.entidad || "",
          documentCount: Array.isArray(docs) ? docs.length : 0,
          type: type || "",
        },
      },
    };
  }, [billingContact, cobranzaState, empresa, fmtD, fmtM]);

  const deliverEmailDraft = useCallback(async (draft = {}) => {
    const recipients = String(draft?.to || "")
      .split(",")
      .map(item => item.trim())
      .filter(Boolean);
    if (!recipients.length) {
      return { ok: false, message: "Debes indicar al menos un destinatario." };
    }
    const subject = String(draft?.subject || "").trim();
    const body = String(draft?.body || "").trim();
    if (!subject || !body) {
      return { ok: false, message: "El asunto y el cuerpo del correo son obligatorios." };
    }
    const payload = {
      tenantId: draft?.tenantId || empresa?.id || "",
      templateKey: draft?.templateKey || "generic_notification",
      subject,
      to: recipients,
      text: body,
      html: `<p>${body.replace(/\n/g, "<br />")}</p>`,
      replyTo: String(draft?.replyTo || senderReplyTo || "").trim() || undefined,
      attachments: Array.isArray(draft?.attachments) ? draft.attachments : [],
      entityType: draft?.entityType || "",
      entityId: draft?.entityId || "",
      metadata: draft?.metadata || {},
    };
    try {
      const remoteResult = await platformApi?.notifications?.sendTransactionalEmail?.(payload);
      if (remoteResult?.ok) {
        ntf?.(`Correo enviado a ${recipients.join(", ")} ✓`);
        return remoteResult;
      }
      if (remoteResult?.message) {
        window.alert(`Resend no pudo entregar este correo todavía.\n\n${remoteResult.message}`);
      }
    } catch {}
    if (Array.isArray(draft?.attachments) && draft.attachments.length) {
      window.alert("Abriremos tu cliente de correo como respaldo, pero los adjuntos no viajarán automáticamente por mailto.");
    }
    openMailto(recipients.join(","), subject, body);
    ntf?.(`Abrimos tu cliente de correo para ${recipients.join(", ")}.`);
    return { ok: true, source: "mailto_fallback", warning: "remote_delivery_failed" };
  }, [empresa?.id, ntf, openMailto, platformApi, senderReplyTo]);

  const sendBillingEmail = useCallback((doc, entity) => {
    const built = createBillingEmailDraft(doc, entity);
    if (!built.ok) {
      alert(built.message || "No pudimos preparar el correo.");
      return;
    }
    void deliverEmailDraft(built.draft);
  }, [createBillingEmailDraft, deliverEmailDraft]);

  const sendBillingWhatsApp = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    if (!contact.tel) {
      alert("La entidad no tiene teléfono registrado.");
      return;
    }
    openWhatsApp(contact.tel, billingMessage(doc, entity));
  }, [billingContact, billingMessage, openWhatsApp]);

  const sendStatementEmail = useCallback((docs, entity, type) => {
    const built = createStatementEmailDraft(docs, entity, type);
    if (!built.ok) {
      alert(built.message || "No pudimos preparar el correo.");
      return;
    }
    void deliverEmailDraft(built.draft);
  }, [createStatementEmailDraft, deliverEmailDraft]);

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
    createBillingEmailDraft,
    createStatementEmailDraft,
    deliverEmailDraft,
    sendBillingEmail,
    sendBillingWhatsApp,
    sendStatementEmail,
    sendStatementWhatsApp,
    fmtMonthPeriod,
  };
}
