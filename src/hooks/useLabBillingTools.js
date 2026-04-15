import { useCallback, useMemo } from "react";
import { billingContact, openMailto, openWhatsApp } from "../lib/utils/helpers";
import { resolveTransactionalEmailTemplate } from "../lib/integrations/transactionalEmailTemplates";
import { buildMercadoPagoInvoicePaymentDraft, buildMercadoPagoPreferenceRequest } from "../lib/integrations/mercadoPagoPaymentsProvider";
import { getMercadoPagoPaymentsConfig } from "../lib/integrations/mercadoPagoPaymentsConfig";

export function useLabBillingTools({
  allDocs,
  movimientos,
  setFacturas,
  saveFacturaDoc,
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
  treasuryReceipts = [],
  setTreasuryReceipts = null,
}) {
  const invoices = useMemo(() => allDocs.filter((f) => f.tipoDoc === "Invoice"), [allDocs]);
  const mercadoPagoConfig = getMercadoPagoPaymentsConfig();
  const mercadoPagoGovernance = empresa?.integrationConfigs?.mercadoPago?.governance || {};
  const mercadoPagoTenant = empresa?.integrationConfigs?.mercadoPago?.tenant || {};
  const mercadoPagoEnabled = mercadoPagoGovernance.mode && mercadoPagoGovernance.mode !== "disabled";
  const mercadoPagoConnected = mercadoPagoTenant.status === "connected" || mercadoPagoTenant.status === "draft";
  const mercadoPagoDefaultExpirationDays = Math.max(1, Number(mercadoPagoTenant?.defaultExpirationDays || 7));
  const mercadoPagoMarketplace = String(mercadoPagoTenant?.marketplace || mercadoPagoConfig.marketplace || "MLC").trim();
  const mercadoPagoAccessToken = String(mercadoPagoTenant?.accessToken || "").trim();
  const mercadoPagoWebhookSecret = String(mercadoPagoTenant?.webhookSecret || "").trim();
  const mercadoPagoSellerAccountLabel = String(mercadoPagoTenant?.sellerAccountLabel || "").trim();
  const mercadoPagoPaymentsApi = platformApi?.payments;

  const appendMercadoPagoHistory = useCallback((currentMercadoPago = {}, entry = {}) => {
    const history = Array.isArray(currentMercadoPago?.history) ? currentMercadoPago.history : [];
    return {
      ...currentMercadoPago,
      history: [
        {
          id: uid(),
          at: new Date().toISOString(),
          ...entry,
        },
        ...history,
      ].slice(0, 12),
    };
  }, [uid]);

  const persistFacturaUpdate = useCallback(async (nextDoc) => {
    if (!nextDoc) return false;
    if (typeof saveFacturaDoc === "function") {
      const saved = await saveFacturaDoc(nextDoc);
      if (saved) return true;
    }
    if (typeof setFacturas === "function") {
      await setFacturas((current = []) => (Array.isArray(current) ? current : []).map(item => item.id === nextDoc.id ? nextDoc : item));
      return true;
    }
    return false;
  }, [saveFacturaDoc, setFacturas]);

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
  }, [empresa, fmtD, fmtM]);

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
  }, [cobranzaState, empresa, fmtD, fmtM]);

  const createBillingEmailDraft = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc?.tipo);
    if (!contact.email) {
      return { ok: false, message: "La entidad no tiene email de cobranza registrado." };
    }
    const templateKey = "billing_invoice_collection";
    const resolved = resolveTransactionalEmailTemplate(empresa, templateKey, {
      contactName: contact.nombre || "",
      companyName: empresa?.nombre || "Produ",
      documentNumber: doc?.correlativo || "",
      totalFormatted: fmtM(doc?.total || 0),
      dueDate: doc?.fechaVencimiento ? fmtD(doc.fechaVencimiento) : "sin vencimiento definido",
      bankInfo: empresa?.bankInfo || "",
      entityLabel: contact.entidad || "",
      paymentLink: "",
    });
    const subject = resolved.subject;
    const body = resolved.body;
    return {
      ok: true,
      draft: {
        tenantId: empresa?.id || "",
        templateKey,
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
          paymentLink: "",
        },
      },
    };
  }, [empresa, fmtD, fmtM]);

  const createPaymentLinkEmailDraft = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc?.tipo);
    if (!contact.email) {
      return { ok: false, message: "La entidad no tiene email de cobranza registrado." };
    }
    const paymentLink = String(doc?.mercadoPago?.initPoint || "").trim();
    if (!paymentLink) {
      return { ok: false, message: "Primero debes generar el link de pago para este documento." };
    }
    const resolved = resolveTransactionalEmailTemplate(empresa, "billing_invoice_payment_link", {
      contactName: contact.nombre || "",
      companyName: empresa?.nombre || "Produ",
      documentNumber: doc?.correlativo || "",
      totalFormatted: fmtM(doc?.total || 0),
      dueDate: doc?.fechaVencimiento ? fmtD(doc.fechaVencimiento) : "sin vencimiento definido",
      bankInfo: empresa?.bankInfo || "",
      entityLabel: contact.entidad || "",
      paymentLink,
    });
    return {
      ok: true,
      draft: {
        tenantId: empresa?.id || "",
        templateKey: "billing_invoice_payment_link",
        subject: resolved.subject,
        to: contact.email,
        body: resolved.body,
        entityType: "invoice",
        entityId: doc?.id || "",
        metadata: {
          companyName: empresa?.nombre || empresa?.nom || "Produ",
          contactName: contact.nombre || "",
          entityLabel: contact.entidad || "",
          documentNumber: doc?.correlativo || "",
          documentType: doc?.tipoDoc || doc?.documentTypeCode || "Invoice",
          paymentLink,
        },
      },
    };
  }, [empresa, fmtD, fmtM]);

  const createMercadoPagoPaymentLinkDraft = useCallback((doc, entity) => {
    if (!mercadoPagoEnabled) {
      return { ok: false, message: "Mercado Pago no está habilitado para este tenant desde Torre de Control." };
    }
    if (!mercadoPagoConnected) {
      return { ok: false, message: "El tenant todavía no tiene configurada su cuenta de Mercado Pago en Panel Administrador." };
    }
    const providerDraft = buildMercadoPagoInvoicePaymentDraft({
      invoice: {
        ...doc,
        saldoPendiente: Number(doc?.pending ?? doc?.saldoPendiente ?? (Number(doc?.total || 0) - Number(doc?.paid || 0))),
      },
      empresa,
      customer: entity,
      currentUser: { email: senderReplyTo },
    });
    const request = buildMercadoPagoPreferenceRequest(providerDraft);
    if (!request?.ok) {
      return { ok: false, message: request?.error || request?.validation?.errors?.[0] || "No pudimos preparar el link de pago." };
    }
    return {
      ok: true,
      draft: providerDraft,
      request,
    };
  }, [empresa, mercadoPagoConnected, mercadoPagoEnabled, senderReplyTo]);

  const generateMercadoPagoPaymentLink = useCallback(async (doc, entity) => {
    const built = createMercadoPagoPaymentLinkDraft(doc, entity);
    if (!built.ok) {
      ntf?.(built.message || "No pudimos preparar el link de pago.", "warn");
      return built;
    }
    const existing = doc?.mercadoPago || {};
    if (existing?.initPoint && existing?.status === "active") {
      ntf?.("Este documento ya tiene un link Mercado Pago activo.");
      return {
        ok: true,
        message: "Este documento ya tiene un link activo.",
        paymentLink: existing,
        doc: { ...doc, mercadoPago: existing },
        reused: true,
      };
    }
    const expiresAt = new Date(Date.now() + mercadoPagoDefaultExpirationDays * 24 * 60 * 60 * 1000).toISOString();
    const remoteResult = await mercadoPagoPaymentsApi?.createMercadoPagoPaymentLink?.({
      ...built.request,
      ...built.draft,
      tenantConfig: {
        accessToken: mercadoPagoAccessToken,
        sellerAccountLabel: mercadoPagoSellerAccountLabel,
        marketplace: mercadoPagoMarketplace,
      },
      payload: {
        ...(built.request.payload || {}),
        expires: true,
        expiration_date_to: expiresAt,
      },
    });
    if (remoteResult?.ok && remoteResult?.paymentLink) {
      const nextMercadoPago = appendMercadoPagoHistory(remoteResult.paymentLink, {
        kind: "payment_link_created",
        label: "Link generado",
        status: remoteResult.paymentLink?.status || "active",
        amount: Number(remoteResult.paymentLink?.amount || built.draft.amount || 0),
        reference: remoteResult.paymentLink?.preferenceId || built.request.preferenceKey || "",
      });
      const nextDoc = { ...doc, mercadoPago: nextMercadoPago };
      await persistFacturaUpdate(nextDoc);
      ntf?.(`Link Mercado Pago generado para ${doc?.correlativo || "documento"} ✓`);
      return {
        ok: true,
        message: "Link Mercado Pago generado.",
        paymentLink: remoteResult.paymentLink,
        doc: nextDoc,
      };
    }
    if (remoteResult?.ok === false && remoteResult?.message) {
      ntf?.(remoteResult.message, "warn");
      return {
        ok: false,
        message: remoteResult.message,
        error: remoteResult.error || "mercadopago_preference_failed",
        source: remoteResult.source || "remote",
      };
    }
    const failureMessage = remoteResult?.message || "Mercado Pago no respondió con un link válido.";
    ntf?.(failureMessage, "warn");
    return {
      ok: false,
      message: failureMessage,
      error: remoteResult?.error || "mercadopago_link_unavailable",
      source: remoteResult?.source || "remote",
    };
  }, [
    appendMercadoPagoHistory,
    createMercadoPagoPaymentLinkDraft,
    mercadoPagoAccessToken,
    mercadoPagoDefaultExpirationDays,
    mercadoPagoMarketplace,
    mercadoPagoPaymentsApi,
    mercadoPagoSellerAccountLabel,
    ntf,
    persistFacturaUpdate,
  ]);

  const applyMercadoPagoPaymentResult = useCallback(async (doc, paymentResult = {}) => {
    const currentDoc = doc || {};
    const approved = paymentResult?.approved === true || paymentResult?.status === "approved";
    const existingHistory = Array.isArray(currentDoc?.mercadoPago?.history) ? currentDoc.mercadoPago.history : [];
    const existingReceipts = Array.isArray(treasuryReceipts) ? treasuryReceipts : [];
    const alreadyApproved = (
      Number(currentDoc?.pending || 0) <= 0
      || currentDoc?.cobranzaEstado === "Pagado"
      || existingHistory.some(item => item?.kind === "payment_approved")
      || existingReceipts.some(item => item?.invoiceId === currentDoc?.id && item?.method === "Mercado Pago")
    );
    const effectiveApproved = approved || alreadyApproved;
    const effectiveStatus = effectiveApproved ? "approved" : (paymentResult?.status || currentDoc?.mercadoPago?.status || "pending");
    const nextMercadoPago = appendMercadoPagoHistory({
      ...(currentDoc?.mercadoPago || {}),
      status: effectiveStatus,
      lastPaymentId: paymentResult?.paymentId || currentDoc?.mercadoPago?.lastPaymentId || "",
      lastPaymentStatus: paymentResult?.status || currentDoc?.mercadoPago?.lastPaymentStatus || "",
      lastWebhookAt: new Date().toISOString(),
    }, {
      kind: effectiveApproved ? "payment_approved" : "payment_status_updated",
      label: effectiveApproved
        ? (approved ? "Pago aprobado" : "Pago aprobado ya registrado")
        : `Estado ${paymentResult?.status || "pendiente"}`,
      status: effectiveStatus,
      amount: Number(paymentResult?.amount || currentDoc?.pending || currentDoc?.saldoPendiente || currentDoc?.total || 0),
      reference: paymentResult?.paymentId || paymentResult?.preferenceId || "",
    });
    let nextDoc = {
      ...currentDoc,
      mercadoPago: nextMercadoPago,
    };
    if (effectiveApproved) {
      const amount = Number(paymentResult?.amount || currentDoc?.pending || currentDoc?.saldoPendiente || currentDoc?.total || 0);
      const receiptReference = paymentResult?.paymentId || paymentResult?.preferenceId || "";
      const receipt = {
        id: uid(),
        empId: empresa?.id || currentDoc?.empId || "",
        invoiceId: currentDoc?.id || "",
        date: String(paymentResult?.paidAt || new Date().toISOString()).slice(0, 10),
        method: "Mercado Pago",
        reference: receiptReference,
        amount,
        notes: `Pago confirmado por Mercado Pago${paymentResult?.externalReference ? ` · ${paymentResult.externalReference}` : ""}`,
      };
      const receiptExists = existingReceipts.some(item =>
        item?.invoiceId === receipt.invoiceId
        && item?.method === "Mercado Pago"
        && String(item?.reference || "").trim() === String(receiptReference || "").trim()
      );
      if (typeof setTreasuryReceipts === "function" && !receiptExists) {
        await setTreasuryReceipts([...existingReceipts, receipt]);
      }
      const total = Number(currentDoc?.total || 0);
      const paid = receiptExists
        ? Number(currentDoc?.paid || 0)
        : Number(currentDoc?.paid || 0) + amount;
      const pending = Math.max(0, total - paid);
      nextDoc = {
        ...nextDoc,
        cobranzaEstado: pending <= 0 ? "Pagado" : (currentDoc?.cobranzaEstado || "Pendiente de pago"),
        fechaPago: pending <= 0 ? String(paymentResult?.paidAt || new Date().toISOString()).slice(0, 10) : (currentDoc?.fechaPago || ""),
        paid,
        pending,
      };
      ntf?.(
        approved
          ? `Pago Mercado Pago registrado en Tesorería para ${currentDoc?.correlativo || "documento"} ✓`
          : `El documento ${currentDoc?.correlativo || "documento"} ya tenía un pago Mercado Pago aprobado registrado.`
      );
    } else {
      ntf?.(`Mercado Pago reportó ${paymentResult?.status || "pendiente"} y no cambió el estado financiero.`);
    }
    await persistFacturaUpdate(nextDoc);
    return { ok: true, doc: nextDoc };
  }, [appendMercadoPagoHistory, empresa?.id, ntf, persistFacturaUpdate, setTreasuryReceipts, treasuryReceipts, uid]);

  const simulateMercadoPagoPayment = useCallback(async (doc, status = "approved") => {
    const remoteResult = await mercadoPagoPaymentsApi?.handleMercadoPagoPayment?.({
      tenantId: empresa?.id || doc?.empId || "",
      invoiceId: doc?.id || "",
      paymentId: `mp_pay_${Math.random().toString(36).slice(2, 10)}`,
      preferenceId: doc?.mercadoPago?.preferenceId || "",
      externalReference: doc?.mercadoPago?.externalReference || "",
      amount: Number(doc?.mercadoPago?.amount || doc?.pending || doc?.saldoPendiente || doc?.total || 0),
      currency: doc?.mercadoPago?.currency || doc?.moneda || "CLP",
      status,
      tenantConfig: {
        accessToken: mercadoPagoAccessToken,
        webhookSecret: mercadoPagoWebhookSecret,
      },
      metadata: {
        documentNumber: doc?.correlativo || "",
      },
    });
    const paymentResult = remoteResult?.paymentResult || {
      status,
      approved: status === "approved",
      paymentId: `mp_pay_${Math.random().toString(36).slice(2, 10)}`,
      amount: Number(doc?.mercadoPago?.amount || doc?.pending || doc?.saldoPendiente || doc?.total || 0),
      currency: doc?.mercadoPago?.currency || doc?.moneda || "CLP",
      externalReference: doc?.mercadoPago?.externalReference || "",
      paidAt: new Date().toISOString(),
    };
    return applyMercadoPagoPaymentResult(doc, paymentResult);
  }, [applyMercadoPagoPaymentResult, empresa?.id, mercadoPagoAccessToken, mercadoPagoPaymentsApi, mercadoPagoWebhookSecret]);

  const refreshMercadoPagoPaymentStatus = useCallback(async (doc) => {
    const hasPaymentReference = Boolean(
      String(doc?.mercadoPago?.preferenceId || "").trim() ||
      String(doc?.mercadoPago?.externalReference || "").trim() ||
      String(doc?.mercadoPago?.lastPaymentId || "").trim()
    );
    if (!hasPaymentReference) {
      const message = "Este documento todavía no tiene referencias suficientes de Mercado Pago para revisar el pago.";
      ntf?.(message, "warn");
      return { ok: false, message, error: "missing_payment_reference" };
    }
    const remoteResult = await mercadoPagoPaymentsApi?.handleMercadoPagoPayment?.({
      tenantId: empresa?.id || doc?.empId || "",
      invoiceId: doc?.id || "",
      preferenceId: doc?.mercadoPago?.preferenceId || "",
      externalReference: doc?.mercadoPago?.externalReference || "",
      currency: doc?.mercadoPago?.currency || doc?.moneda || "CLP",
      tenantConfig: {
        accessToken: mercadoPagoAccessToken,
        webhookSecret: mercadoPagoWebhookSecret,
      },
      metadata: {
        documentNumber: doc?.correlativo || "",
      },
    });
    if (!remoteResult?.ok || !remoteResult?.paymentResult) {
      ntf?.(remoteResult?.message || "No pudimos consultar el pago en Mercado Pago.", "warn");
      return remoteResult || { ok: false, message: "No pudimos consultar el pago en Mercado Pago." };
    }
    return applyMercadoPagoPaymentResult(doc, remoteResult.paymentResult);
  }, [applyMercadoPagoPaymentResult, empresa?.id, mercadoPagoAccessToken, mercadoPagoPaymentsApi, mercadoPagoWebhookSecret, ntf]);

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
  }, [cobranzaState, empresa, fmtD, fmtM]);

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
    } catch (error) {
      console.error("[billing-tools] Falló el envío remoto de correo", error);
    }
    if (Array.isArray(draft?.attachments) && draft.attachments.length) {
      window.alert("Abriremos tu cliente de correo como respaldo, pero los adjuntos no viajarán automáticamente por mailto.");
    }
    openMailto(recipients.join(","), subject, body);
    ntf?.(`Abrimos tu cliente de correo para ${recipients.join(", ")}.`);
    return { ok: true, source: "mailto_fallback", warning: "remote_delivery_failed" };
  }, [empresa?.id, ntf, platformApi, senderReplyTo]);

  const sendBillingEmail = useCallback((doc, entity) => {
    const built = createBillingEmailDraft(doc, entity);
    if (!built.ok) {
      alert(built.message || "No pudimos preparar el correo.");
      return;
    }
    void deliverEmailDraft(built.draft);
  }, [createBillingEmailDraft, deliverEmailDraft]);

  const sendPaymentLinkEmail = useCallback((doc, entity) => {
    const built = createPaymentLinkEmailDraft(doc, entity);
    if (!built.ok) {
      alert(built.message || "No pudimos preparar el correo.");
      return;
    }
    void deliverEmailDraft(built.draft);
  }, [createPaymentLinkEmailDraft, deliverEmailDraft]);

  const sendBillingWhatsApp = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc.tipo);
    if (!contact.tel) {
      alert("La entidad no tiene teléfono registrado.");
      return;
    }
    openWhatsApp(contact.tel, billingMessage(doc, entity));
  }, [billingMessage]);

  const sendPaymentLinkWhatsApp = useCallback((doc, entity) => {
    const contact = billingContact(entity, doc?.tipo);
    if (!contact.tel) {
      alert("La entidad no tiene teléfono registrado.");
      return;
    }
    const paymentLink = String(doc?.mercadoPago?.initPoint || "").trim();
    if (!paymentLink) {
      alert("Primero debes generar el link de pago.");
      return;
    }
    openWhatsApp(contact.tel, `Hola ${contact.nombre || contact.entidad || ""},\n\nTe compartimos el link de pago de la factura ${doc?.correlativo || ""} emitida por ${empresa?.nombre || "Produ"}.\n\n${paymentLink}\n\nQuedamos atentos.`);
  }, [empresa?.nombre]);

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
  }, [statementMessage]);

  return {
    invoices,
    seriesList,
    pauseSeries,
    cutSeries,
    regenerateSeries,
    createBillingEmailDraft,
    createPaymentLinkEmailDraft,
    createStatementEmailDraft,
    createMercadoPagoPaymentLinkDraft,
    generateMercadoPagoPaymentLink,
    simulateMercadoPagoPayment,
    refreshMercadoPagoPaymentStatus,
    deliverEmailDraft,
    sendBillingEmail,
    sendPaymentLinkEmail,
    sendBillingWhatsApp,
    sendPaymentLinkWhatsApp,
    sendStatementEmail,
    sendStatementWhatsApp,
    fmtMonthPeriod,
  };
}
