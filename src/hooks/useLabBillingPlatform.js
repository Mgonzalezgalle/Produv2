import { useCallback } from "react";
import {
  buildBsaleBillingApiContract,
  buildProduBillingAmountsFromBsaleDocument,
  buildBsaleReturnAnnulmentRequest,
  buildExternalSyncFromBsaleAnnulment,
  buildExternalSyncFromBsaleDocument,
  buildExternalSyncFromBsaleReturn,
  buildBsaleReturnRequest,
  createBsaleClient,
  createBsaleDocument,
  createBsaleReturnAnnulment,
  createBsaleReturn,
  ensureBsaleServiceCatalogItems,
  getBsaleBillingConfig,
  getBsaleBillingTenantConfig,
  getBsaleDocument,
  getBsaleDocumentDetails,
  listBsalePayments,
  listBsalePaymentTypes,
  mapBsalePaymentsToProduReceipts,
  getBsaleReturn,
  listBsaleClients,
  listBsaleDocumentTypes,
  listBsaleOffices,
  listBsaleTaxes,
  resolveBsaleTaxFromCatalog,
  resolveBsaleDocumentTypeIdFromCatalog,
  resolveBsaleOfficeIdFromCatalog,
  updateBsaleClient,
} from "../lib/integrations/bsaleBilling";
import {
  evaluateProduBillingBsaleReadiness,
  getProduBillingDocumentTypeLabel,
  resolveProduBillingDocumentType,
  validateProduBillingReferencePayload,
} from "../lib/integrations/billingDomain";
import { buildBsaleInvoiceSyncDraft, mapProduInvoiceToBsale } from "../lib/integrations/bsaleBillingMapper";
import { loadBsaleEmissionSessions, saveBsaleEmissionSessions } from "../lib/lab/bsaleMockApi";

export function useLabBillingPlatform({
  curEmp,
  facturas,
  clientes,
  auspiciadores,
  platformGateway,
  platformApi,
  setFacturas,
  ntf,
  dbGet,
  dbSet,
  platformServices,
}) {
  const ensureBsaleClient = useCallback(async ({ config, clientePayload }) => {
    const code = String(clientePayload?.rut || "").trim();
    const company = String(
      clientePayload?.nom
      || clientePayload?.nombre
      || clientePayload?.razonSocial
      || ""
    ).trim();
    if (!company) throw new Error("Cliente incompleto para Bsale: falta Razón social / nombre.");

    const clientBody = {
      company,
      code,
      city: String(clientePayload?.ciudad || "").trim() || undefined,
      municipality: String(clientePayload?.comuna || "").trim() || undefined,
      address: String(clientePayload?.dir || clientePayload?.direccion || "").trim() || undefined,
      activity: String(clientePayload?.giro || "").trim() || undefined,
      email: String(clientePayload?.ema || clientePayload?.email || "").trim() || undefined,
      phone: String(clientePayload?.tel || clientePayload?.telefono || "").trim() || undefined,
      companyOrPerson: 1,
    };

    if (code) {
      const listed = await listBsaleClients({ code, config });
      const items = Array.isArray(listed?.items) ? listed.items : [];
      const existing = items.find(item => String(item?.code || "").trim() === code);
      if (existing?.id) {
        await updateBsaleClient(existing.id, clientBody, config);
        return Number(existing.id);
      }
    }

    const created = await createBsaleClient(clientBody, config);
    return Number(created?.id || 0) || null;
  }, []);

  const emitFacturaToBsale = useCallback(async (factura) => {
    if (!curEmp || !factura?.id) return false;
    const documentType = resolveProduBillingDocumentType(factura.documentTypeCode || factura.tipoDocumento || factura.tipoDoc);
    const readiness = evaluateProduBillingBsaleReadiness(factura);
    if (readiness.status === "not_applicable") {
      ntf(`${getProduBillingDocumentTypeLabel(documentType?.code)} no requiere emisión en Bsale.`, "warn");
      return false;
    }
    if (readiness.status !== "ready") {
      ntf(`${getProduBillingDocumentTypeLabel(documentType?.code)}: ${readiness.reason}.`, "warn");
      return false;
    }
    const referenceValidation = validateProduBillingReferencePayload(factura);
    if (!referenceValidation.ok) {
      ntf(`${getProduBillingDocumentTypeLabel(documentType?.code)}: ${referenceValidation.reason}`, "warn");
      return false;
    }

    const cliente = factura?.tipo === "auspiciador"
      ? (auspiciadores || []).find(item => item.id === factura.entidadId)
      : (clientes || []).find(item => item.id === factura.entidadId);
    const entityName = String(
      cliente?.nom
      || cliente?.nombre
      || cliente?.razonSocial
      || factura?.clienteNombre
      || factura?.razonSocial
      || factura?.entidad
      || factura?.nom
      || ""
    ).trim();
    const clientePayload = {
      ...(cliente || {}),
      nom: entityName || cliente?.nom || "",
      nombre: entityName || cliente?.nombre || "",
      razonSocial: entityName || cliente?.razonSocial || "",
    };

    const facturaItems = Array.isArray(factura?.items) ? factura.items : [];
    const lineItems = facturaItems.length
      ? facturaItems.map((item, index) => ({
        quantity: Number(item.qty || 0),
        netUnitValue: Number(item.precio || 0),
        descripcion: String(item.desc || `Item ${index + 1}`).trim(),
      })).filter((item) => item.quantity > 0 && item.netUnitValue > 0)
      : [];
    const montoNeto = lineItems.length
      ? lineItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.netUnitValue || 0)), 0)
      : Number(
        factura?.montoNeto || factura?.subtotal || factura?.neto || factura?.total || 0,
      );
    let effectiveLineItems = lineItems.length ? lineItems : [{
      quantity: 1,
      netUnitValue: montoNeto,
      descripcion: factura?.obs || `${factura?.tipoDoc || "Factura"} ${factura?.correlativo || ""}`.trim(),
    }];

    const references = factura?.treasuryPurchaseOrderId
      ? [{
        number: factura.relatedDocumentFolio || factura.treasuryPurchaseOrderNumber || factura.treasuryPurchaseOrderId,
        referenceDate: factura.relatedDocumentDate || factura.fechaEmision || factura.fecha || "",
        reason: factura.relatedDocumentReason || (factura.relatedDocumentFolio ? `Orden de Compra ${factura.relatedDocumentFolio}` : "Orden de Compra"),
        documentTypeCode: "orden_compra",
      }]
      : [];
    if (factura?.relatedDocumentId || factura?.relatedDocumentFolio) {
      references.push({
        number: factura.relatedDocumentFolio || factura.relatedDocumentId,
        referenceDate: factura.relatedDocumentDate || factura.fechaEmision || factura.fecha || "",
        reason: factura.relatedDocumentReason || "Documento de referencia",
        documentTypeCode: factura.relatedDocumentTypeCode || "",
        sourceDocumentId: factura.relatedDocumentId || "",
      });
    }

    const config = getBsaleBillingTenantConfig(curEmp, getBsaleBillingConfig());

    if (config.hasCredentials) {
      try {
        const [documentTypesCatalog, officesCatalog, taxesCatalog] = await Promise.all([
          listBsaleDocumentTypes(config),
          listBsaleOffices(config),
          listBsaleTaxes(config),
        ]);
        const resolvedOfficeId = resolveBsaleOfficeIdFromCatalog(officesCatalog, config.officeId);
        const resolvedTax = resolveBsaleTaxFromCatalog({ factura, taxesPayload: taxesCatalog });
        const resolvedConfig = {
          ...config,
          officeId: resolvedOfficeId,
          documentTypeId: resolveBsaleDocumentTypeIdFromCatalog(factura.tipoDoc || factura.tipoDocumento || factura.documentTypeCode, documentTypesCatalog, config.documentTypeId),
        };
        const bsaleClientId = await ensureBsaleClient({
          config: resolvedConfig,
          clientePayload,
        });
        effectiveLineItems = effectiveLineItems.map((item) => ({
          ...item,
          taxId: item.taxId || undefined,
          taxes: item.taxes || (resolvedTax ? [{
            code: resolvedTax.code,
            percentage: resolvedTax.percentage,
          }] : undefined),
        }));
        if (effectiveLineItems.length) {
          try {
            const catalogItems = await ensureBsaleServiceCatalogItems({
              lineItems: effectiveLineItems,
              config: resolvedConfig,
            });
            if (catalogItems.length) effectiveLineItems = catalogItems;
          } catch (catalogError) {
            console.warn("Bsale service catalog sync failed", {
              facturaId: factura?.id,
              error: catalogError?.message || String(catalogError),
            });
          }
        }

        if (documentType?.code === "nota_credito") {
          const sourceFactura = (Array.isArray(facturas) ? facturas : []).find(item => item.id === factura.relatedDocumentId);
          const referenceExternalId = Number(
            sourceFactura?.externalSync?.externalDocumentId
            || factura?.relatedExternalDocumentId
            || 0,
          ) || null;
          if (!referenceExternalId) {
            ntf("La Nota de Crédito necesita que el documento origen ya esté emitido en Bsale.", "warn");
            return false;
          }
          const [referenceDocument, referenceDetailsPayload] = await Promise.all([
            getBsaleDocument(referenceExternalId, resolvedConfig),
            getBsaleDocumentDetails(referenceExternalId, resolvedConfig),
          ]);
          const referenceDetails = Array.isArray(referenceDetailsPayload?.items) ? referenceDetailsPayload.items : [];
          const returnPayload = buildBsaleReturnRequest({
            factura,
            empresa: curEmp,
            cliente: clientePayload,
            referenceDocument,
            referenceDetails,
            config: {
              ...resolvedConfig,
              documentTypeId: resolveBsaleDocumentTypeIdFromCatalog("nota_credito", documentTypesCatalog, resolvedConfig.documentTypeId),
            },
          });
          if (bsaleClientId) returnPayload.clientId = bsaleClientId;
          returnPayload.client = {
            ...(returnPayload.client || {}),
            company: entityName,
            code: String(clientePayload?.rut || returnPayload.client?.code || "").trim(),
          };
          const bsaleReturn = await createBsaleReturn(returnPayload, resolvedConfig);
          const bsaleReturnDetail = await getBsaleReturn(bsaleReturn.id, resolvedConfig);
          const creditNoteId = Number(
            bsaleReturnDetail?.credit_note?.id
            || bsaleReturn?.credit_note?.id
            || 0,
          ) || null;
          const creditNoteDocument = creditNoteId
            ? await getBsaleDocument(creditNoteId, resolvedConfig)
            : {};
          const sessionId = `bsale_return_${Math.random().toString(36).slice(2, 10)}`;
          const now = new Date().toISOString();
          const externalSync = buildExternalSyncFromBsaleReturn(bsaleReturnDetail || bsaleReturn, creditNoteDocument, {
            sessionId,
            requestedAt: now,
          });
          externalSync.source = "bsale";
          const amountPatch = buildProduBillingAmountsFromBsaleDocument(creditNoteDocument, factura);
          const record = {
            id: sessionId,
            provider: "bsale",
            mode: "manual",
            status: externalSync.status,
            facturaId: factura.id,
            empId: curEmp.id || factura.empId || "",
            request: returnPayload,
            response: bsaleReturnDetail || bsaleReturn,
            contract: buildBsaleBillingApiContract(resolvedConfig),
            createdAt: now,
            updatedAt: now,
            externalDocumentId: externalSync.externalDocumentId,
            externalFolio: externalSync.externalFolio,
            externalReturnId: externalSync.externalReturnId,
            providerStatus: externalSync.providerStatus,
          };
          if (platformServices?.upsertBsaleSyncSession) {
            await platformServices.upsertBsaleSyncSession(curEmp.id, {
              ...record,
              sourceDocumentId: factura.id,
              sessionKey: sessionId,
            });
          } else {
            const currentSessions = await loadBsaleEmissionSessions(dbGet);
            await saveBsaleEmissionSessions(dbSet, [...currentSessions, record]);
          }
          await setFacturas(prev => (Array.isArray(prev) ? prev : []).map(item => (
            item.id === factura.id ? { ...item, ...amountPatch, externalSync } : item
          )));
          ntf("Nota de Crédito emitida en Bsale sandbox ✓");
          return true;
        }

        if (documentType?.code === "nota_debito") {
          const sourceFactura = (Array.isArray(facturas) ? facturas : []).find(item => item.id === factura.relatedDocumentId);
          const sourceReturnId = Number(
            sourceFactura?.externalSync?.externalReturnId
            || factura?.relatedExternalReturnId
            || 0,
          ) || null;
          const sourceCreditNoteId = Number(
            sourceFactura?.externalSync?.externalDocumentId
            || factura?.relatedExternalDocumentId
            || 0,
          ) || null;
          if (!sourceReturnId || !sourceCreditNoteId) {
            ntf("La Nota de Débito necesita una Nota de Crédito emitida previamente en el motor tributario.", "warn");
            return false;
          }
          const creditNoteDocument = await getBsaleDocument(sourceCreditNoteId, resolvedConfig);
          const annulmentPayload = buildBsaleReturnAnnulmentRequest({
            factura,
            creditNoteDocument,
            config: {
              ...resolvedConfig,
              documentTypeId: resolveBsaleDocumentTypeIdFromCatalog("nota_debito", documentTypesCatalog, resolvedConfig.documentTypeId),
            },
          });
          const bsaleAnnulment = await createBsaleReturnAnnulment(sourceReturnId, annulmentPayload, resolvedConfig);
          const debitNoteId = Number(bsaleAnnulment?.debit_note?.id || 0) || null;
          const debitNoteDocument = debitNoteId
            ? await getBsaleDocument(debitNoteId, resolvedConfig)
            : {};
          const sessionId = `bsale_annulment_${Math.random().toString(36).slice(2, 10)}`;
          const now = new Date().toISOString();
          const externalSync = buildExternalSyncFromBsaleAnnulment(bsaleAnnulment, debitNoteDocument, {
            sessionId,
            requestedAt: now,
            externalReturnId: String(sourceReturnId),
          });
          externalSync.source = "bsale";
          const amountPatch = buildProduBillingAmountsFromBsaleDocument(debitNoteDocument, factura);
          const record = {
            id: sessionId,
            provider: "bsale",
            mode: "manual",
            status: externalSync.status,
            facturaId: factura.id,
            empId: curEmp.id || factura.empId || "",
            request: annulmentPayload,
            response: bsaleAnnulment,
            contract: buildBsaleBillingApiContract(resolvedConfig),
            createdAt: now,
            updatedAt: now,
            externalDocumentId: externalSync.externalDocumentId,
            externalFolio: externalSync.externalFolio,
            externalReturnId: externalSync.externalReturnId,
            externalAnnulmentId: externalSync.externalAnnulmentId,
            providerStatus: externalSync.providerStatus,
          };
          if (platformServices?.upsertBsaleSyncSession) {
            await platformServices.upsertBsaleSyncSession(curEmp.id, {
              ...record,
              sourceDocumentId: factura.id,
              sessionKey: sessionId,
            });
          } else {
            const currentSessions = await loadBsaleEmissionSessions(dbGet);
            await saveBsaleEmissionSessions(dbSet, [...currentSessions, record]);
          }
          await setFacturas(prev => (Array.isArray(prev) ? prev : []).map(item => (
            item.id === factura.id ? { ...item, ...amountPatch, externalSync } : item
          )));
          ntf("Nota de Débito emitida en motor tributario ✓");
          return true;
        }

        const mapped = mapProduInvoiceToBsale({
          factura: {
            ...factura,
            clientId: bsaleClientId || factura.clientId || "",
          },
          empresa: curEmp,
          cliente: clientePayload,
          lineItems: effectiveLineItems,
          references,
          config: resolvedConfig,
          documentTypesCatalog,
        });
        mapped.payload.clientId = bsaleClientId || mapped.payload.clientId || "";
        if (!mapped.payload.clientId) {
          mapped.payload.client = {
            ...(mapped.payload.client || {}),
            company: entityName,
            code: String(clientePayload?.rut || mapped.payload.client?.code || "").trim(),
          };
        } else {
          delete mapped.payload.client;
        }

        let document;
        try {
          document = await createBsaleDocument(mapped.payload, resolvedConfig);
        } catch (err) {
          if (String(err?.message || "").toLowerCase().includes("invalid office") && mapped.payload?.officeId) {
            const retryPayload = { ...mapped.payload };
            delete retryPayload.officeId;
            document = await createBsaleDocument(retryPayload, { ...resolvedConfig, officeId: "" });
            mapped.payload = retryPayload;
          } else {
            throw err;
          }
        }
        const sessionId = `bsale_real_${Math.random().toString(36).slice(2, 10)}`;
        const now = new Date().toISOString();
        const syncDraft = buildBsaleInvoiceSyncDraft({
          factura,
          empresa: curEmp,
          cliente: clientePayload,
          lineItems: effectiveLineItems,
          references,
          config: resolvedConfig,
          documentTypesCatalog,
        });
        const externalSync = buildExternalSyncFromBsaleDocument(document, {
          sessionId,
          requestedAt: now,
        });
        externalSync.source = "bsale";
        const amountPatch = buildProduBillingAmountsFromBsaleDocument(document, factura);
        const record = {
          id: sessionId,
          provider: "bsale",
          mode: "manual",
          status: externalSync.status,
          facturaId: factura.id,
          empId: curEmp.id || factura.empId || "",
          request: mapped.payload,
          response: document,
          syncDraft,
          contract: buildBsaleBillingApiContract(resolvedConfig),
          createdAt: now,
          updatedAt: now,
          externalDocumentId: externalSync.externalDocumentId,
          externalFolio: externalSync.externalFolio,
          providerStatus: externalSync.providerStatus,
        };
        if (platformServices?.upsertBsaleSyncSession) {
          await platformServices.upsertBsaleSyncSession(curEmp.id, {
            ...record,
            sourceDocumentId: factura.id,
            sessionKey: sessionId,
          });
        } else {
          const currentSessions = await loadBsaleEmissionSessions(dbGet);
          await saveBsaleEmissionSessions(dbSet, [...currentSessions, record]);
        }

        await setFacturas(prev => (Array.isArray(prev) ? prev : []).map(item => (
          item.id === factura.id ? { ...item, ...amountPatch, externalSync } : item
        )));

        ntf("Documento emitido en Bsale sandbox ✓");
        return true;
      } catch (err) {
        console.warn("Bsale real emission failed", {
          facturaId: factura?.id,
          correlativo: factura?.correlativo || "",
          documentType: documentType?.code || "",
          entidadId: factura?.entidadId || "",
          entityName,
          clientPayload: {
            company: clientePayload?.nom || clientePayload?.nombre || clientePayload?.razonSocial || "",
            rut: clientePayload?.rut || "",
            dir: clientePayload?.dir || clientePayload?.direccion || "",
            ciudad: clientePayload?.ciudad || "",
            comuna: clientePayload?.comuna || "",
          },
          error: err?.message || String(err),
        });
        ntf(`${err?.message || "Bsale sandbox falló."}${entityName ? ` · Cliente: ${entityName}` : ""}`, "warn");
        return false;
      }
    }

    const result = await platformGateway.emitBillingDocumentManual({
      factura,
      empresa: curEmp,
      cliente,
      lineItems: effectiveLineItems,
      references,
    });

    if (!result?.ok) {
      ntf(result?.error || "No pudimos preparar la emisión en Bsale.", "warn");
      return false;
    }

    await setFacturas(prev => (Array.isArray(prev) ? prev : []).map(item => (
      item.id === factura.id ? { ...item, ...result.facturaPatch } : item
    )));

    ntf("Emisión Bsale preparada en modo mock ✓");
    return true;
  }, [auspiciadores, clientes, curEmp, dbGet, dbSet, facturas, ntf, platformGateway, platformServices, setFacturas]);

  const syncFacturaWithBsale = useCallback(async (factura) => {
    if (!factura?.id) return false;
    const config = getBsaleBillingTenantConfig(curEmp, getBsaleBillingConfig());
    if (config.hasCredentials && factura?.externalSync?.externalDocumentId) {
      try {
        const returnId = Number(factura?.externalSync?.externalReturnId || 0) || null;
        const [document, bsaleReturn] = await Promise.all([
          getBsaleDocument(factura.externalSync.externalDocumentId, config),
          returnId ? getBsaleReturn(returnId, config) : Promise.resolve(null),
        ]);
        const externalSync = bsaleReturn
          ? buildExternalSyncFromBsaleReturn(bsaleReturn, document, factura.externalSync || {})
          : buildExternalSyncFromBsaleDocument(document, factura.externalSync || {});
        externalSync.source = factura?.externalSync?.source || "bsale";
        const amountPatch = buildProduBillingAmountsFromBsaleDocument(document, factura);
        if (platformServices?.upsertBsaleSyncSession) {
          await platformServices.upsertBsaleSyncSession(curEmp?.id || factura.empId || "", {
            id: factura.externalSync?.sessionId || `bsale_sync_${factura.id}`,
            sessionKey: factura.externalSync?.sessionId || `bsale_sync_${factura.id}`,
            sourceDocumentId: factura.id,
            status: externalSync.status,
            externalDocumentId: externalSync.externalDocumentId,
            externalFolio: externalSync.externalFolio,
            externalReturnId: externalSync.externalReturnId || "",
            providerStatus: externalSync.providerStatus,
            response: bsaleReturn ? { return: bsaleReturn, document } : document,
            metadata: {
              pdfUrl: externalSync.pdfUrl || "",
              publicViewUrl: externalSync.publicViewUrl || "",
              returnCode: externalSync.returnCode || "",
            },
          });
        }
        await setFacturas(prev => (Array.isArray(prev) ? prev : []).map(item => (
          item.id === factura.id ? { ...item, ...amountPatch, externalSync } : item
        )));
        ntf("Estado Bsale sincronizado ✓");
        return true;
      } catch (err) {
        ntf(err?.message || "No pudimos consultar el estado real en Bsale. Probamos el mock local.", "warn");
      }
    }

    const result = await (
      platformApi?.billing?.getDocumentStatus
        ? platformApi.billing.getDocumentStatus({ documentId: factura.id })
        : platformGateway.getBillingDocumentStatus({ facturaId: factura.id })
    );

    if (!result?.ok) {
      ntf(result?.error || "No pudimos consultar el estado en Bsale.", "warn");
      return false;
    }

    await setFacturas(prev => (Array.isArray(prev) ? prev : []).map(item => (
      item.id === factura.id ? { ...item, externalSync: result.externalSync } : item
    )));

    ntf("Estado Bsale sincronizado ✓");
    return true;
  }, [curEmp?.id, ntf, platformApi, platformGateway, platformServices, setFacturas]);

  const inspectFacturaBsaleSync = useCallback(async (factura) => {
    if (!factura?.id) return [];
    if (platformServices?.listBsaleSyncSessions) {
      return platformServices.listBsaleSyncSessions(curEmp?.id || factura.empId || "", factura.id);
    }
    const currentSessions = await loadBsaleEmissionSessions(dbGet);
    return currentSessions.filter((session) => String(session.facturaId || session.sourceDocumentId || "") === String(factura.id));
  }, [curEmp?.id, dbGet, platformServices]);

  const syncFacturaPaymentsFromBsale = useCallback(async (factura) => {
    if (!factura?.id || !factura?.externalSync?.externalDocumentId) return [];
    const config = getBsaleBillingTenantConfig(curEmp, getBsaleBillingConfig());
    if (!config.hasCredentials) return [];
    const [paymentsPayload, paymentTypesPayload] = await Promise.all([
      listBsalePayments({
        documentId: factura.externalSync.externalDocumentId,
        config,
      }),
      listBsalePaymentTypes(config),
    ]);
    const receipts = mapBsalePaymentsToProduReceipts({
      paymentsPayload,
      factura,
      empId: curEmp?.id || factura.empId || "",
    }).map((receipt) => {
      const enrichedType = (Array.isArray(paymentTypesPayload?.items) ? paymentTypesPayload.items : []).find(
        (item) => String(item.id || "") === String(receipt?.externalSync?.paymentTypeId || ""),
      );
      return enrichedType
        ? {
            ...receipt,
            method: enrichedType.name || receipt.method,
            externalSync: {
              ...receipt.externalSync,
              paymentGroup: enrichedType.group || "",
              isCash: Number(enrichedType.isCash || 0) === 1,
              isCreditNote: Number(enrichedType.isCreditNote || 0) === 1,
            },
          }
        : receipt;
    });
    return receipts;
  }, [curEmp]);

  return {
    emitFacturaToBsale,
    syncFacturaWithBsale,
    inspectFacturaBsaleSync,
    syncFacturaPaymentsFromBsale,
  };
}
