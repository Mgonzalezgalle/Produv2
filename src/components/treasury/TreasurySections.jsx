import React from "react";
import { FilterSel, GBtn, Paginator } from "../../lib/ui/components";
import { notifyUserFacingError } from "../../lib/ui/userFacingErrors";
import {
  exportTreasuryRowsCSV,
  exportTreasuryRowsPDF,
  exportTreasuryRowsXLS,
} from "../../lib/utils/exports";
import { fmtM } from "../../lib/utils/helpers";
import { formatTreasuryMoney } from "../../lib/utils/treasury";
import { MiniKpiCard } from "./TreasuryShared";
import {
  IssuedOrdersTable,
  PaymentLogTable,
  PayablesTable,
  PortfolioTable,
  PurchaseOrdersTable,
  ReceivablesTable,
  TableToolbar,
} from "./TreasuryTables";
import { ProvidersPanel } from "./TreasuryDetails";
import { SectionCard } from "./TreasuryCore";
import { TreasuryPaymentModal } from "./TreasuryPaymentModal";

function selectedOrFilteredRows(tableState, getId = row => row?.id) {
  const selectedIds = Array.isArray(tableState?.selectedIds) ? tableState.selectedIds : [];
  const rows = Array.isArray(tableState?.filteredRows) ? tableState.filteredRows : [];
  if (!selectedIds.length) return rows;
  const selected = new Set(selectedIds);
  return rows.filter(row => selected.has(getId(row)));
}

function TreasuryExportActions({ tableState, columns, fileName, title, subtitle, empresa, getId }) {
  const rows = selectedOrFilteredRows(tableState, getId);
  const exportLabel = tableState?.selectedIds?.length ? "seleccionados" : "vista";
  const exportPayload = { rows, columns, fileName, title, subtitle, empresa, accent: "#1a1a2e" };
  return (
    <div className="treasury-export-actions" aria-label={`Descargar ${exportLabel}`}>
      <GBtn sm onClick={() => exportTreasuryRowsXLS(exportPayload)}>XLS</GBtn>
      <GBtn sm onClick={() => exportTreasuryRowsCSV(exportPayload)}>CSV</GBtn>
      <GBtn sm onClick={() => { void exportTreasuryRowsPDF(exportPayload); }}>PDF</GBtn>
    </div>
  );
}

const receivableExportColumns = [
  { label: "Documento", value: row => row?.correlativo || "—" },
  { label: "Entidad", value: row => row?.entidad || "—" },
  { label: "Tipo", value: row => row?.tipoDoc || "Documento" },
  { label: "Emisión", value: row => row?.fechaEmision || "—" },
  { label: "Vencimiento", value: row => row?.fechaVencimiento || "—" },
  { label: "Cobranza", value: row => row?.cobranza || "—" },
  { label: "Total", value: row => fmtM(row?.total || 0) },
  { label: "Pendiente", value: row => fmtM(row?.pending || 0) },
];

const purchaseOrderExportColumns = [
  { label: "OC", value: row => row?.number || "—" },
  { label: "Cliente", value: row => row?.clientName || "—" },
  { label: "Fecha", value: row => row?.issueDate || "—" },
  { label: "Estado OC", value: row => row?.status || "—" },
  { label: "Estado factura", value: row => row?.billingStatus || "—" },
  { label: "Monto", value: row => fmtM(row?.amount || 0) },
  { label: "Pendiente OC", value: row => fmtM(row?.pendingAmount || 0) },
];

const paymentLogExportColumns = [
  { label: "Fecha", value: row => row?.date || "—" },
  { label: "Documento", value: row => row?.targetLabel || "—" },
  { label: "Contraparte", value: row => row?.counterpartyLabel || "—" },
  { label: "Método", value: row => row?.method || "—" },
  { label: "Referencia", value: row => row?.reference || "—" },
  { label: "Monto", value: row => fmtM(row?.amount || 0) },
];

const payableExportColumns = [
  { label: "Proveedor", value: row => row?.supplier || "—" },
  { label: "Documento", value: row => row?.folio || "—" },
  { label: "Tipo", value: row => row?.docType || "Documento" },
  { label: "Categoría", value: row => row?.category || "—" },
  { label: "Emisión", value: row => row?.issueDate || "—" },
  { label: "Vencimiento", value: row => row?.dueDate || "—" },
  { label: "Pago estimado", value: row => row?.paymentDate || "—" },
  { label: "Estado", value: row => row?.status || "Pendiente" },
  { label: "Total", value: row => formatTreasuryMoney(row?.total || 0, row?.currency) },
  { label: "Pagado", value: row => formatTreasuryMoney(row?.paid || 0, row?.currency) },
  { label: "Pendiente", value: row => formatTreasuryMoney(row?.pending || 0, row?.currency) },
];

const providerExportColumns = [
  { label: "Proveedor", value: row => row?.name || "—" },
  { label: "RUT", value: row => row?.rut || "—" },
  { label: "Email", value: row => row?.email || row?.contactos?.[0]?.email || row?.contactos?.[0]?.ema || "—" },
  { label: "Teléfono", value: row => row?.telefono || row?.contactos?.[0]?.telefono || row?.contactos?.[0]?.tel || "—" },
  { label: "Documentos", value: row => row?.payables?.length || 0 },
  { label: "OC emitidas", value: row => row?.issuedOrders?.length || 0 },
  { label: "Cartera proveedor", value: row => fmtM(row?.totalDebt || 0) },
  { label: "Pendiente", value: row => fmtM(row?.pending || 0) },
];

const issuedOrderExportColumns = [
  { label: "OC", value: row => row?.number || "—" },
  { label: "Proveedor", value: row => row?.supplier || "—" },
  { label: "Fecha", value: row => row?.issueDate || "—" },
  { label: "Categoría", value: row => row?.category || "—" },
  { label: "Centro de costo", value: row => row?.costCenter || "—" },
  { label: "Monto", value: row => fmtM(row?.amount || 0) },
  { label: "Enviada a", value: row => row?.lastSentTo || "—" },
];

export function TreasuryReceivablesSection({
  canManageTreasury,
  deleteMany,
  deleteReceipt,
  facturas,
  openPortfolioDetail,
  openBulkImporter,
  openPurchaseOrderEdit,
  openReceiptCreate,
  openReceiptEdit,
  props,
  purchaseOrderSummary,
  receiptClientFilter,
  receiptClientOptions,
  receiptPeriodFilter,
  receiptPeriodOptions,
  receiptTable,
  receivableTable,
  onUpdateReceivableStatus,
  sendBillingEmail,
  sendBillingWhatsApp,
  sendPaymentLinkEmail,
  sendPaymentLinkWhatsApp,
  generateMercadoPagoPaymentLink,
  refreshMercadoPagoPaymentStatus,
  simulateMercadoPagoPayment,
  sendStatementEmail,
  sendStatementWhatsApp,
  setReceiptClientFilter,
  setReceiptPeriodFilter,
  portfolioTable,
  receiptOpen,
  receiptDraft,
  closeReceipt,
  saveReceipt,
}) {
  return (
    <>
      <SectionCard title="Cuentas por Cobrar" subtitle="Gestiona documentos, cobranza, pagos manuales, anulaciones y estado real del cobro desde una sola vista">
        <TableToolbar
          searchValue={receivableTable.query}
          onSearchChange={receivableTable.setQuery}
          searchPlaceholder="Buscar documento o cliente..."
          statusValue={receivableTable.status}
          onStatusChange={receivableTable.setStatus}
          statusOptions={receivableTable.statusOptions}
          selectedCount={receivableTable.selectedIds.length}
          onDeleteSelected={null}
          onClearSelection={receivableTable.clearSelection}
          exportAction={
            <TreasuryExportActions
              tableState={receivableTable}
              columns={receivableExportColumns}
              fileName="cuentas_por_cobrar"
              title="Cuentas por Cobrar"
              subtitle="Documentos de cobranza"
              empresa={props.empresa}
            />
          }
          createAction={canManageTreasury ? <GBtn onClick={openBulkImporter}>Importar</GBtn> : null}
          canManage={false}
        />
        <ReceivablesTable
          rows={receivableTable.pageRows}
          onAddPayment={canManageTreasury ? openReceiptCreate : () => {}}
          onUpdateCobranza={canManageTreasury && onUpdateReceivableStatus ? onUpdateReceivableStatus : null}
          onBillingEmail={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            const entity = doc?.tipo === "auspiciador"
              ? (props.auspiciadores || []).find(item => item.id === doc.entidadId)
              : (props.clientes || []).find(item => item.id === doc?.entidadId);
            if (doc) sendBillingEmail(doc, entity);
          }}
          onPaymentLinkEmail={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            const entity = doc?.tipo === "auspiciador"
              ? (props.auspiciadores || []).find(item => item.id === doc.entidadId)
              : (props.clientes || []).find(item => item.id === doc?.entidadId);
            if (!doc) {
              props.ntf?.("No encontramos el documento para generar el link de pago.", "warn");
              return;
            }
            const link = String(doc?.mercadoPago?.initPoint || "").trim();
            if (link) {
              sendPaymentLinkEmail?.(doc, entity);
              return;
            }
            void generateMercadoPagoPaymentLink(doc, entity).then((result) => {
              if (!result?.ok) {
                notifyUserFacingError(props.ntf, result, "No pudimos generar el link de pago.");
                return;
              }
              sendPaymentLinkEmail?.(result?.doc || doc, entity);
            }).catch(error => {
              notifyUserFacingError(props.ntf, error, "No pudimos generar el link de pago.");
            });
          }}
          onBillingWhatsApp={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            const entity = doc?.tipo === "auspiciador"
              ? (props.auspiciadores || []).find(item => item.id === doc.entidadId)
              : (props.clientes || []).find(item => item.id === doc?.entidadId);
            if (doc) sendBillingWhatsApp(doc, entity);
          }}
          onPaymentLinkWhatsApp={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            const entity = doc?.tipo === "auspiciador"
              ? (props.auspiciadores || []).find(item => item.id === doc.entidadId)
              : (props.clientes || []).find(item => item.id === doc?.entidadId);
            if (!doc) {
              props.ntf?.("No encontramos el documento para generar el link de pago.", "warn");
              return;
            }
            const link = String(doc?.mercadoPago?.initPoint || "").trim();
            if (link) {
              sendPaymentLinkWhatsApp?.(doc, entity);
              return;
            }
            void generateMercadoPagoPaymentLink(doc, entity).then((result) => {
              if (!result?.ok) {
                notifyUserFacingError(props.ntf, result, "No pudimos generar el link de pago.");
                return;
              }
              sendPaymentLinkWhatsApp?.(result?.doc || doc, entity);
            }).catch(error => {
              notifyUserFacingError(props.ntf, error, "No pudimos generar el link de pago.");
            });
          }}
          onStatementEmail={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            if (!doc) return;
            const entity = doc.tipo === "auspiciador"
              ? (props.auspiciadores || []).find(item => item.id === doc.entidadId)
              : (props.clientes || []).find(item => item.id === doc.entidadId);
            const entityDocs = (facturas || []).filter(
              item =>
                item.empId === props.empresa?.id &&
                item.tipo === doc.tipo &&
                item.entidadId === doc.entidadId
            );
            sendStatementEmail(entityDocs, entity, doc.tipo);
          }}
          onStatementWhatsApp={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            if (!doc) return;
            const entity = doc.tipo === "auspiciador"
              ? (props.auspiciadores || []).find(item => item.id === doc.entidadId)
              : (props.clientes || []).find(item => item.id === doc.entidadId);
            const entityDocs = (facturas || []).filter(
              item =>
                item.empId === props.empresa?.id &&
                item.tipo === doc.tipo &&
                item.entidadId === doc.entidadId
            );
            sendStatementWhatsApp(entityDocs, entity, doc.tipo);
          }}
          onGeneratePaymentLink={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            const entity = doc?.tipo === "auspiciador"
              ? (props.auspiciadores || []).find(item => item.id === doc.entidadId)
              : (props.clientes || []).find(item => item.id === doc?.entidadId);
            if (!doc) {
              props.ntf?.("No encontramos el documento para generar el link de Mercado Pago.", "warn");
              return;
            }
            void generateMercadoPagoPaymentLink(doc, entity).then((result) => {
              if (!result?.ok) {
                notifyUserFacingError(props.ntf, result, "No pudimos generar el link de Mercado Pago.");
              }
            }).catch(error => {
              notifyUserFacingError(props.ntf, error, "No pudimos generar el link de Mercado Pago.");
            });
          }}
          onCopyPaymentLink={row => {
            const paymentLink = String(row?.mercadoPago?.initPoint || "").trim();
            if (!paymentLink) return;
            if (navigator?.clipboard?.writeText) {
              navigator.clipboard.writeText(paymentLink);
              props.ntf?.("Link Mercado Pago copiado ✓");
              return;
            }
            window.prompt("Copia el link de pago:", paymentLink);
          }}
          onApprovePaymentLink={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            if (doc) void simulateMercadoPagoPayment(doc, "approved");
          }}
          onRefreshPaymentLink={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            if (doc) void refreshMercadoPagoPaymentStatus(doc);
          }}
          onRejectPaymentLink={row => {
            const doc = (facturas || []).find(item => item.id === row.id);
            if (doc) void simulateMercadoPagoPayment(doc, "rejected");
          }}
          canManage={canManageTreasury}
          selectedIds={receivableTable.selectedIds}
          toggleSelected={receivableTable.toggleSelected}
          toggleAll={receivableTable.toggleAll}
          pageIds={receivableTable.pageIds}
        />
        <Paginator
          page={receivableTable.page}
          total={receivableTable.filteredRows.length}
          perPage={receivableTable.pageSize}
          onChange={receivableTable.setPage}
        />
      </SectionCard>

      <SectionCard title="Cartera por Cliente" subtitle="Ahora el detalle abre en un modal independiente para revisar deuda, concentración y documentos" emphasis>
        <TableToolbar
          searchValue={portfolioTable.query}
          onSearchChange={portfolioTable.setQuery}
          searchPlaceholder="Buscar cliente..."
          selectedCount={portfolioTable.selectedIds.length}
          onClearSelection={portfolioTable.clearSelection}
        />
        <PortfolioTable
          rows={portfolioTable.pageRows}
          onOpen={openPortfolioDetail}
          selectedIds={portfolioTable.selectedIds}
          toggleSelected={portfolioTable.toggleSelected}
          toggleAll={portfolioTable.toggleAll}
          pageIds={portfolioTable.pageIds}
        />
        <Paginator
          page={portfolioTable.page}
          total={portfolioTable.filteredRows.length}
          perPage={portfolioTable.pageSize}
          onChange={portfolioTable.setPage}
        />
      </SectionCard>

      <SectionCard title="Órdenes de Compra Recibidas" subtitle="Aquí ves si la OC fue facturada, qué factura quedó ligada y si esa factura ya fue pagada" action={canManageTreasury ? <GBtn onClick={props.openPurchaseOrderCreate}>+ Nueva OC</GBtn> : null} withTopBorder>
        <div className="treasury-compact-grid">
          <MiniKpiCard color="var(--cy)" label="OC recibidas" value={purchaseOrderSummary.docs} />
          <MiniKpiCard color="#00e08a" label="Monto OC" value={fmtM(purchaseOrderSummary.total)} />
          <MiniKpiCard color="#ffcc44" label="Pendiente Match ⚠" value={fmtM(purchaseOrderSummary.pending)} />
        </div>
        <TableToolbar
          searchValue={props.poTable.query}
          onSearchChange={props.poTable.setQuery}
          searchPlaceholder="Buscar OC o cliente..."
          statusValue={props.poTable.status}
          onStatusChange={props.poTable.setStatus}
          statusOptions={props.poTable.statusOptions}
          selectedCount={props.poTable.selectedIds.length}
          onDeleteSelected={canManageTreasury ? async () => { await props.deleteMany(props.poTable.selectedIds, props.deletePurchaseOrder); props.poTable.clearSelection(); } : null}
          onClearSelection={props.poTable.clearSelection}
          exportAction={
            <TreasuryExportActions
              tableState={props.poTable}
              columns={purchaseOrderExportColumns}
              fileName="ordenes_de_compra_recibidas"
              title="Órdenes de Compra Recibidas"
              subtitle="Documentos recibidos de clientes"
              empresa={props.empresa}
            />
          }
          canManage={canManageTreasury}
        />
        <PurchaseOrdersTable
          rows={props.poTable.pageRows}
          onEdit={canManageTreasury ? openPurchaseOrderEdit : () => {}}
          onDelete={canManageTreasury ? props.deletePurchaseOrder : () => {}}
          selectedIds={props.poTable.selectedIds}
          toggleSelected={props.poTable.toggleSelected}
          toggleAll={props.poTable.toggleAll}
          pageIds={props.poTable.pageIds}
        />
        <Paginator
          page={props.poTable.page}
          total={props.poTable.filteredRows.length}
          perPage={props.poTable.pageSize}
          onChange={props.poTable.setPage}
        />
      </SectionCard>

      <SectionCard title="Pagos recibidos" subtitle="Registro manual y editable de pagos efectivos en cuentas por cobrar">
        <TableToolbar
          searchValue={receiptTable.query}
          onSearchChange={receiptTable.setQuery}
          searchPlaceholder="Buscar pago, cliente o método..."
          filters={[
            <FilterSel key="receipt-client" value={receiptClientFilter} onChange={setReceiptClientFilter} options={receiptClientOptions} placeholder="Todos los clientes" />,
            <FilterSel key="receipt-period" value={receiptPeriodFilter} onChange={setReceiptPeriodFilter} options={receiptPeriodOptions} placeholder="Mes del pago" />,
          ]}
          selectedCount={receiptTable.selectedIds.length}
          onDeleteSelected={canManageTreasury ? async () => { await deleteMany(receiptTable.selectedIds, deleteReceipt); receiptTable.clearSelection(); } : null}
          onClearSelection={receiptTable.clearSelection}
          exportAction={
            <TreasuryExportActions
              tableState={receiptTable}
              columns={paymentLogExportColumns}
              fileName="pagos_recibidos"
              title="Pagos recibidos"
              subtitle="Pagos registrados en cuentas por cobrar"
              empresa={props.empresa}
            />
          }
          canManage={canManageTreasury}
        />
        <PaymentLogTable
          rows={receiptTable.pageRows}
          emptyText="Sin pagos recibidos registrados"
          targetLabel="Documento"
          counterpartyLabel="Cliente"
          onEdit={canManageTreasury ? openReceiptEdit : null}
          onDelete={canManageTreasury ? deleteReceipt : null}
          selectedIds={receiptTable.selectedIds}
          toggleSelected={receiptTable.toggleSelected}
          toggleAll={receiptTable.toggleAll}
          pageIds={receiptTable.pageIds}
        />
        <Paginator
          page={receiptTable.page}
          total={receiptTable.filteredRows.length}
          perPage={receiptTable.pageSize}
          onChange={receiptTable.setPage}
        />
      </SectionCard>

      <TreasuryPaymentModal
        open={receiptOpen}
        title="Registrar pago recibido"
        subtitle="Asocia el pago al documento de cuentas por cobrar"
        data={receiptDraft}
        onClose={closeReceipt}
        onSave={saveReceipt}
      />
    </>
  );
}

export function TreasuryPayablesSection({
  canManageTreasury,
  deleteMany,
  deleteDisbursement,
  deleteIssuedOrder,
  deletePayable,
  deleteProvider,
  disbursementPeriodFilter,
  disbursementPeriodOptions,
  disbursementSupplierFilter,
  disbursementSupplierOptions,
  disbursementTable,
  handlePayableUpdate,
  handleSupplierEmail,
  handleSupplierStatementEmail,
  handleSupplierWhatsApp,
  sendIssuedOrderEmail,
  openIssuedOrderPdf,
  openIssuedOrderDetail,
  issuedSupplierFilter,
  issuedSupplierOptions,
  issuedTable,
  openDisbursementCreate,
  openDisbursementEdit,
  openIssuedOrderCreate,
  openIssuedOrderEdit,
  openBulkImporter,
  openPayableCreate,
  openPayableEdit,
  openProviderCreate,
  openProviderEdit,
  payablePeriodFilter,
  payablePeriodOptions,
  payableSupplierFilter,
  payableSupplierOptions,
  payableTable,
  payablesTab,
  providerTable,
  providers,
  setDisbursementPeriodFilter,
  setDisbursementSupplierFilter,
  setIssuedSupplierFilter,
  setPayablePeriodFilter,
  setPayableSupplierFilter,
  setPayablesTab,
  empresa = null,
  isMobile = false,
}) {
  return (
    <>
      <SectionCard title="Cuentas por Pagar" subtitle="Gestiona deudas, proveedores, pagos, documentos anulados y salida de caja en un mismo contexto">
        <div className="treasury-subtabs">
          <button className={`treasury-subtab ${payablesTab === "documentos" ? "active" : ""}`} onClick={() => setPayablesTab("documentos")}>Documentos</button>
          <button className={`treasury-subtab ${payablesTab === "proveedores" ? "active" : ""}`} onClick={() => setPayablesTab("proveedores")}>Proveedores</button>
        </div>
        {payablesTab === "documentos" ? (
          <>
            <TableToolbar
              searchValue={payableTable.query}
              onSearchChange={payableTable.setQuery}
              searchPlaceholder="Buscar proveedor o documento..."
              filters={[
                <FilterSel key="payable-supplier" value={payableSupplierFilter} onChange={setPayableSupplierFilter} options={payableSupplierOptions} placeholder="Todos los proveedores" />,
                <FilterSel key="payable-period" value={payablePeriodFilter} onChange={setPayablePeriodFilter} options={payablePeriodOptions} placeholder="Mes del documento" />,
              ]}
              statusValue={payableTable.status}
              onStatusChange={payableTable.setStatus}
              statusOptions={payableTable.statusOptions}
              selectedCount={payableTable.selectedIds.length}
              onDeleteSelected={canManageTreasury ? async () => { await deleteMany(payableTable.selectedIds, deletePayable); payableTable.clearSelection(); } : null}
              onClearSelection={payableTable.clearSelection}
              exportAction={
                <TreasuryExportActions
                  tableState={payableTable}
                  columns={payableExportColumns}
                  fileName="cuentas_por_pagar"
                  title="Cuentas por Pagar"
                  subtitle="Documentos de proveedores"
                  empresa={empresa}
                />
              }
              createAction={canManageTreasury ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <GBtn onClick={openBulkImporter}>Importar</GBtn>
                  <GBtn onClick={openPayableCreate}>+ Nuevo documento</GBtn>
                </div>
              ) : null}
              canManage={canManageTreasury}
            />
            <PayablesTable
              rows={payableTable.pageRows}
              providers={providers}
              onAddPayment={canManageTreasury ? openDisbursementCreate : () => {}}
              onEdit={canManageTreasury ? openPayableEdit : () => {}}
              onDelete={canManageTreasury ? deletePayable : () => {}}
              onUpdatePayable={handlePayableUpdate}
              onSupplierEmail={handleSupplierEmail}
              onSupplierStatementEmail={handleSupplierStatementEmail}
              onSupplierWhatsApp={handleSupplierWhatsApp}
              canManage={canManageTreasury}
              selectedIds={payableTable.selectedIds}
              toggleSelected={payableTable.toggleSelected}
              toggleAll={payableTable.toggleAll}
              pageIds={payableTable.pageIds}
            />
            <Paginator
              page={payableTable.page}
              total={payableTable.filteredRows.length}
              perPage={payableTable.pageSize}
              onChange={payableTable.setPage}
            />
          </>
        ) : (
          <ProvidersPanel
            providers={providers}
            pageRows={providerTable.pageRows}
            totalRows={providerTable.filteredRows.length}
            query={providerTable.query}
            setQuery={providerTable.setQuery}
            page={providerTable.page}
            setPage={providerTable.setPage}
            pageSize={providerTable.pageSize}
            onOpen={canManageTreasury ? openProviderEdit : () => {}}
            onCreate={canManageTreasury ? openProviderCreate : () => {}}
            onDelete={canManageTreasury ? async () => { await deleteMany(providerTable.selectedIds, deleteProvider); providerTable.clearSelection(); } : null}
            canManage={canManageTreasury}
            selectedIds={providerTable.selectedIds}
            toggleSelected={providerTable.toggleSelected}
            toggleAll={providerTable.toggleAll}
            pageIds={providerTable.pageIds}
            exportAction={
              <TreasuryExportActions
                tableState={providerTable}
                columns={providerExportColumns}
                fileName="proveedores"
                title="Proveedores"
                subtitle="Listado de proveedores"
                empresa={empresa}
              />
            }
            importAction={canManageTreasury ? <GBtn onClick={openBulkImporter}>Importar</GBtn> : null}
            isMobile={isMobile}
          />
        )}
      </SectionCard>

      <SectionCard title="Órdenes de Compra Emitidas" subtitle="Trazabilidad de OC emitidas a proveedores" action={canManageTreasury ? <GBtn onClick={openIssuedOrderCreate}>+ Nueva OC emitida</GBtn> : null} withTopBorder>
        <TableToolbar
          searchValue={issuedTable.query}
          onSearchChange={issuedTable.setQuery}
          searchPlaceholder="Buscar OC emitida o proveedor..."
          filters={[
            <FilterSel key="issued-supplier" value={issuedSupplierFilter} onChange={setIssuedSupplierFilter} options={issuedSupplierOptions} placeholder="Todos los proveedores" />,
          ]}
          selectedCount={issuedTable.selectedIds.length}
          onDeleteSelected={canManageTreasury ? async () => { await deleteMany(issuedTable.selectedIds, deleteIssuedOrder); issuedTable.clearSelection(); } : null}
          onClearSelection={issuedTable.clearSelection}
          exportAction={
            <TreasuryExportActions
              tableState={issuedTable}
              columns={issuedOrderExportColumns}
              fileName="ordenes_de_compra_emitidas"
              title="Órdenes de Compra Emitidas"
              subtitle="Documentos emitidos a proveedores"
              empresa={empresa}
            />
          }
          canManage={canManageTreasury}
        />
        <IssuedOrdersTable
          rows={issuedTable.pageRows}
          onEdit={canManageTreasury ? openIssuedOrderEdit : () => {}}
          onDelete={canManageTreasury ? deleteIssuedOrder : () => {}}
          onSupplierEmail={sendIssuedOrderEmail}
          onOpenPdf={openIssuedOrderPdf}
          onOpenDetail={openIssuedOrderDetail}
          selectedIds={issuedTable.selectedIds}
          toggleSelected={issuedTable.toggleSelected}
          toggleAll={issuedTable.toggleAll}
          pageIds={issuedTable.pageIds}
        />
        <Paginator
          page={issuedTable.page}
          total={issuedTable.filteredRows.length}
          perPage={issuedTable.pageSize}
          onChange={issuedTable.setPage}
        />
      </SectionCard>

      <SectionCard title="Pagos realizados" subtitle="Registro manual, editable y trazable de egresos y abonos hechos a proveedores">
        <TableToolbar
          searchValue={disbursementTable.query}
          onSearchChange={disbursementTable.setQuery}
          searchPlaceholder="Buscar pago, proveedor o método..."
          filters={[
            <FilterSel key="disbursement-supplier" value={disbursementSupplierFilter} onChange={setDisbursementSupplierFilter} options={disbursementSupplierOptions} placeholder="Todos los proveedores" />,
            <FilterSel key="disbursement-period" value={disbursementPeriodFilter} onChange={setDisbursementPeriodFilter} options={disbursementPeriodOptions} placeholder="Mes del pago" />,
          ]}
          selectedCount={disbursementTable.selectedIds.length}
          onDeleteSelected={canManageTreasury ? async () => { await deleteMany(disbursementTable.selectedIds, deleteDisbursement); disbursementTable.clearSelection(); } : null}
          onClearSelection={disbursementTable.clearSelection}
          exportAction={
            <TreasuryExportActions
              tableState={disbursementTable}
              columns={paymentLogExportColumns}
              fileName="pagos_realizados"
              title="Pagos realizados"
              subtitle="Pagos registrados en cuentas por pagar"
              empresa={empresa}
            />
          }
          canManage={canManageTreasury}
        />
        <PaymentLogTable
          rows={disbursementTable.pageRows}
          emptyText="Sin pagos realizados registrados"
          targetLabel="Cuenta"
          counterpartyLabel="Proveedor"
          onEdit={canManageTreasury ? openDisbursementEdit : null}
          onDelete={canManageTreasury ? deleteDisbursement : null}
          selectedIds={disbursementTable.selectedIds}
          toggleSelected={disbursementTable.toggleSelected}
          toggleAll={disbursementTable.toggleAll}
          pageIds={disbursementTable.pageIds}
        />
        <Paginator
          page={disbursementTable.page}
          total={disbursementTable.filteredRows.length}
          perPage={disbursementTable.pageSize}
          onChange={disbursementTable.setPage}
        />
      </SectionCard>
    </>
  );
}
