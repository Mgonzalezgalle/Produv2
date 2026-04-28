import React from "react";
import { FilterSel, GBtn, Paginator } from "../../lib/ui/components";
import { exportTreasuryPayablesCSV } from "../../lib/utils/exports";
import { fmtM } from "../../lib/utils/helpers";
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

export function TreasuryReceivablesSection({
  canManageTreasury,
  deleteMany,
  deleteReceipt,
  facturas,
  openPortfolioDetail,
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
  saveFacturaDoc,
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
      <SectionCard title="Cuentas por Cobrar" subtitle="Gestiona documentos, cobranza, pagos manuales y estado real del cobro desde una sola vista">
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
          canManage={false}
        />
        <ReceivablesTable
          rows={receivableTable.pageRows}
          onAddPayment={canManageTreasury ? openReceiptCreate : () => {}}
          onUpdateCobranza={canManageTreasury && saveFacturaDoc
            ? (row, nextState) =>
              saveFacturaDoc({
                ...((facturas || []).find(doc => doc.id === row.id) || row),
                cobranzaEstado: nextState,
                fechaPago:
                  nextState === "Pagado"
                    ? (((facturas || []).find(doc => doc.id === row.id) || row).fechaPago || new Date().toISOString().slice(0, 10))
                    : "",
              })
            : null}
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
            if (!doc) return;
            const link = String(doc?.mercadoPago?.initPoint || "").trim();
            if (link) {
              sendPaymentLinkEmail?.(doc, entity);
              return;
            }
            void generateMercadoPagoPaymentLink(doc, entity).then((result) => {
              if (!result?.ok) {
                window.alert(result?.message || "No pudimos generar el link de pago.");
                return;
              }
              sendPaymentLinkEmail?.(result?.doc || doc, entity);
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
            if (!doc) return;
            const link = String(doc?.mercadoPago?.initPoint || "").trim();
            if (link) {
              sendPaymentLinkWhatsApp?.(doc, entity);
              return;
            }
            void generateMercadoPagoPaymentLink(doc, entity).then((result) => {
              if (!result?.ok) {
                window.alert(result?.message || "No pudimos generar el link de pago.");
                return;
              }
              sendPaymentLinkWhatsApp?.(result?.doc || doc, entity);
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
            if (!doc) return;
            void generateMercadoPagoPaymentLink(doc, entity).then((result) => {
              if (!result?.ok) {
                window.alert(result?.message || "No pudimos generar el link de Mercado Pago.");
                return;
              }
              const emailDoc = result?.doc || doc;
              if (sendBillingEmail) sendBillingEmail(emailDoc, entity);
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
            <FilterSel key="receipt-period" value={receiptPeriodFilter} onChange={setReceiptPeriodFilter} options={receiptPeriodOptions} placeholder="Todos los períodos" />,
          ]}
          selectedCount={receiptTable.selectedIds.length}
          onDeleteSelected={canManageTreasury ? async () => { await deleteMany(receiptTable.selectedIds, deleteReceipt); receiptTable.clearSelection(); } : null}
          onClearSelection={receiptTable.clearSelection}
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
  handleSupplierWhatsApp,
  issuedOrderSummary,
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
  openPayableCreate,
  openPayableEdit,
  openProviderCreate,
  openProviderEdit,
  payablePeriodFilter,
  payablePeriodOptions,
  payableSupplierFilter,
  payableSupplierOptions,
  payableTable,
  payablesSummary,
  payablesTab,
  providerTable,
  providers,
  setDisbursementPeriodFilter,
  setDisbursementSupplierFilter,
  setIssuedSupplierFilter,
  setPayablePeriodFilter,
  setPayableSupplierFilter,
  setPayablesTab,
}) {
  return (
    <>
      <SectionCard title="Cuentas por Pagar" subtitle="Gestiona tus deudas, tus proveedores y los pagos realizados en un mismo contexto">
        <div className="treasury-subtabs">
          <button className={`treasury-subtab ${payablesTab === "documentos" ? "active" : ""}`} onClick={() => setPayablesTab("documentos")}>Documentos</button>
          <button className={`treasury-subtab ${payablesTab === "proveedores" ? "active" : ""}`} onClick={() => setPayablesTab("proveedores")}>Proveedores</button>
        </div>
        {payablesTab === "documentos" ? (
          <>
            <div className="treasury-compact-grid">
              <MiniKpiCard color="#a78bfa" label="Documentos" value={payablesSummary.docs} />
              <MiniKpiCard color="#ffcc44" label="Pendiente" value={fmtM(payablesSummary.pending)} />
              <MiniKpiCard color="var(--red)" label="Vencido" value={fmtM(payablesSummary.overdue)} />
            </div>
            <TableToolbar
              searchValue={payableTable.query}
              onSearchChange={payableTable.setQuery}
              searchPlaceholder="Buscar proveedor o documento..."
              filters={[
                <FilterSel key="payable-supplier" value={payableSupplierFilter} onChange={setPayableSupplierFilter} options={payableSupplierOptions} placeholder="Todos los proveedores" />,
                <FilterSel key="payable-period" value={payablePeriodFilter} onChange={setPayablePeriodFilter} options={payablePeriodOptions} placeholder="Todos los períodos" />,
              ]}
              statusValue={payableTable.status}
              onStatusChange={payableTable.setStatus}
              statusOptions={payableTable.statusOptions}
              selectedCount={payableTable.selectedIds.length}
              onDeleteSelected={canManageTreasury ? async () => { await deleteMany(payableTable.selectedIds, deletePayable); payableTable.clearSelection(); } : null}
              onClearSelection={payableTable.clearSelection}
              exportAction={<GBtn onClick={() => exportTreasuryPayablesCSV(payableTable.filteredRows, "cxp_documentos")}>Descargar Excel / CSV</GBtn>}
              createAction={canManageTreasury ? <GBtn onClick={openPayableCreate}>+ Nuevo documento</GBtn> : null}
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
          />
        )}
      </SectionCard>

      <SectionCard title="Órdenes de Compra Emitidas" subtitle="Trazabilidad de OC emitidas a proveedores" action={canManageTreasury ? <GBtn onClick={openIssuedOrderCreate}>+ Nueva OC emitida</GBtn> : null} withTopBorder>
        <div className="treasury-compact-grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}>
          <MiniKpiCard color="var(--cy)" label="OC emitidas" value={issuedOrderSummary.docs} />
          <MiniKpiCard color="#00e08a" label="Monto emitido" value={fmtM(issuedOrderSummary.total)} />
        </div>
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
            <FilterSel key="disbursement-period" value={disbursementPeriodFilter} onChange={setDisbursementPeriodFilter} options={disbursementPeriodOptions} placeholder="Todos los períodos" />,
          ]}
          selectedCount={disbursementTable.selectedIds.length}
          onDeleteSelected={canManageTreasury ? async () => { await deleteMany(disbursementTable.selectedIds, deleteDisbursement); disbursementTable.clearSelection(); } : null}
          onClearSelection={disbursementTable.clearSelection}
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
