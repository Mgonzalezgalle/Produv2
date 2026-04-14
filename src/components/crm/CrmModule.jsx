import React from "react";
import { CRM_STATUS_OPTIONS, crmCanPassToClient, crmEntityLabel, crmStageMeta } from "../../lib/utils/crm";
import { ModuleHeader } from "../../lib/ui/components";
import { CrmBoard } from "./CrmBoard";
import { CrmDetailModal } from "./CrmDetailModal";
import { CrmStageModal } from "./CrmStageModal";
import { useLabCrmModule } from "../../hooks/useLabCrmModule";
import { TransactionalEmailComposerModal } from "../shared/TransactionalEmailComposerModal";
import { resolveTransactionalEmailTemplate } from "../../lib/integrations/transactionalEmailTemplates";

export function CrmModule({
  empresa,
  user,
  crmOpps,
  crmActivities,
  crmStages,
  clientes,
  auspiciadores,
  tareas,
  users,
  openM,
  ntf,
  setClientes,
  setAuspiciadores,
  setCrmOpps,
  setCrmActivities,
  setCrmStages,
  setTareas,
  crmSavingRef,
  TareaCard,
  getRoleConfig,
  uid,
  fmtM,
  fmtD,
  canDo,
  platformApi,
}) {
  const [emailComposerOpen, setEmailComposerOpen] = React.useState(false);
  const [emailComposerDraft, setEmailComposerDraft] = React.useState(null);
  const [emailComposerSending, setEmailComposerSending] = React.useState(false);
  const {
    isMobile,
    tab,
    setTab,
    q,
    setQ,
    tipo,
    setTipo,
    estado,
    setEstado,
    stageFilter,
    setStageFilter,
    nextActionFilter,
    setNextActionFilter,
    sortKey,
    setSortKey,
    pg,
    setPg,
    selectedIds,
    bulkResponsible,
    setBulkResponsible,
    bulkTipoNegocio,
    setBulkTipoNegocio,
    detail,
    detailActivities,
    detailTasks,
    stagesById,
    activeMobileStageId,
    setMobileStageId,
    mobileStage,
    mobileStageItems,
    activityForm,
    setActivityForm,
    scopedStages,
    scopedOpps,
    tenantUsers,
    nextActionTone,
    sorted,
    paged,
    selectedItems,
    collapsedStages,
    setDetailId,
    setLocalStages,
    setStagesChanged,
    setStagesOpen,
    toggleStageCollapsed,
    updateStage,
    toggleAllVisible,
    toggleSelected,
    updateQuickField,
    exportTarget,
    clearSelection,
    bulkAssignTipoNegocio,
    bulkAssignResponsible,
    bulkDeleteSelected,
    saveStageConfig,
    removeStage,
    stagesOpen,
    localStages,
    passToEntity,
    saveOpp,
    addActivity,
    tasksEnabled,
    canManageCrm,
    canManageTasks,
    PP,
  } = useLabCrmModule({
    empresa,
    user,
    crmOpps,
    crmActivities,
    crmStages,
    clientes,
    auspiciadores,
    tareas,
    users,
    ntf,
    setClientes,
    setAuspiciadores,
    setCrmOpps,
    setCrmActivities,
    setCrmStages,
    setTareas,
    crmSavingRef,
    fmtD,
    canDo,
  });

  const openCrmEmailComposer = React.useCallback((opportunity, activity) => {
    const recipient = String(opportunity?.email || "").trim();
    if (!recipient) {
      window.alert("Esta oportunidad no tiene correo registrado.");
      return;
    }
    const contactName = opportunity?.contacto || opportunity?.empresaMarca || opportunity?.nombre || "";
    const resolved = resolveTransactionalEmailTemplate(empresa, "crm_followup", {
      contactName,
      companyName: empresa?.nombre || "Produ",
      companyLabel: opportunity?.empresaMarca || opportunity?.nombre || "oportunidad",
      opportunityName: opportunity?.nombre || "esta oportunidad",
    });
    const defaultBody = String(activity?.text || "").trim() || resolved.body;
    setEmailComposerDraft({
      tenantId: empresa?.id || "",
      templateKey: "crm_followup",
      subject: resolved.subject,
      to: recipient,
      body: defaultBody,
      entityType: "crm_opportunity",
      entityId: opportunity?.id || "",
      metadata: {
        companyName: empresa?.nombre || empresa?.nom || "Produ",
        entityLabel: opportunity?.empresaMarca || opportunity?.nombre || "",
        contactName,
        activityType: activity?.type || "email",
      },
    });
    setEmailComposerOpen(true);
  }, [empresa?.id, empresa?.nombre]);

  const closeEmailComposer = React.useCallback(() => {
    if (emailComposerSending) return;
    setEmailComposerOpen(false);
    setEmailComposerDraft(null);
  }, [emailComposerSending]);

  const sendCrmEmail = React.useCallback(async (draft) => {
    const recipients = String(draft?.to || "").split(",").map(item => item.trim()).filter(Boolean);
    if (!recipients.length) {
      window.alert("Debes indicar al menos un destinatario.");
      return;
    }
    if (!String(draft?.subject || "").trim() || !String(draft?.body || "").trim()) {
      window.alert("El asunto y el cuerpo del correo son obligatorios.");
      return;
    }
    setEmailComposerSending(true);
    try {
      const payload = {
        tenantId: draft?.tenantId || empresa?.id || "",
        templateKey: draft?.templateKey || "crm_followup",
        subject: String(draft?.subject || "").trim(),
        to: recipients,
        text: String(draft?.body || "").trim(),
        html: `<p>${String(draft?.body || "").trim().replace(/\n/g, "<br />")}</p>`,
        replyTo: String(user?.email || "").trim() || undefined,
        attachments: Array.isArray(draft?.attachments) ? draft.attachments : [],
        entityType: draft?.entityType || "crm_opportunity",
        entityId: draft?.entityId || "",
        metadata: draft?.metadata || {},
      };
      const remoteResult = await platformApi?.notifications?.sendTransactionalEmail?.(payload);
      if (!remoteResult?.ok) {
        if (remoteResult?.message) {
          window.alert(`Resend no pudo entregar este correo todavía.\n\n${remoteResult.message}`);
        }
        if (Array.isArray(draft?.attachments) && draft.attachments.length) {
          window.alert("Abriremos tu cliente de correo como respaldo, pero los adjuntos no viajarán automáticamente por mailto.");
        }
        window.location.href = `mailto:${encodeURIComponent(recipients.join(","))}?subject=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.text)}`;
        ntf?.(`Abrimos tu cliente de correo para ${recipients.join(", ")}.`);
      } else {
        ntf?.(`Correo enviado a ${recipients.join(", ")} ✓`);
      }
      if (draft?.entityId) {
        await addActivity(draft.entityId, payload.text, "email", {
          subject: payload.subject,
          to: recipients.join(", "),
          attachments: payload.attachments,
          delivery: remoteResult?.ok ? (remoteResult.delivery || null) : null,
        });
      }
      setActivityForm({ type: "note", text: "" });
      setEmailComposerOpen(false);
      setEmailComposerDraft(null);
    } finally {
      setEmailComposerSending(false);
    }
  }, [addActivity, empresa?.id, ntf, platformApi, setActivityForm]);

  return <div>
    <ModuleHeader
      module="CRM"
      title="CRM Comercial"
      description="Gestiona prospectos, etapas, próximas acciones y conversiones a cliente o auspiciador desde un solo pipeline."
    />
    <CrmBoard
      scopedOpps={scopedOpps}
      scopedStages={scopedStages}
      tenantUsers={tenantUsers}
      q={q}
      setQ={setQ}
      tipo={tipo}
      setTipo={setTipo}
      estado={estado}
      setEstado={setEstado}
      stageFilter={stageFilter}
      setStageFilter={setStageFilter}
      nextActionFilter={nextActionFilter}
      setNextActionFilter={setNextActionFilter}
      sortKey={sortKey}
      setSortKey={setSortKey}
      openM={openM}
      setLocalStages={setLocalStages}
      setStagesChanged={setStagesChanged}
      setStagesOpen={setStagesOpen}
      exportTarget={exportTarget}
      selectedItems={selectedItems}
      tab={tab}
      setTab={setTab}
      bulkTipoNegocio={bulkTipoNegocio}
      setBulkTipoNegocio={setBulkTipoNegocio}
      bulkResponsible={bulkResponsible}
      setBulkResponsible={setBulkResponsible}
      bulkAssignTipoNegocio={bulkAssignTipoNegocio}
      bulkAssignResponsible={bulkAssignResponsible}
      bulkDeleteSelected={bulkDeleteSelected}
      clearSelection={clearSelection}
      isMobile={isMobile}
      activeMobileStageId={activeMobileStageId}
      setMobileStageId={setMobileStageId}
      mobileStage={mobileStage}
      mobileStageItems={mobileStageItems}
      fmtM={fmtM}
      setDetailId={setDetailId}
      crmEntityLabel={crmEntityLabel}
      nextActionTone={nextActionTone}
      fmtD={fmtD}
      sorted={sorted}
      collapsedStages={collapsedStages}
      toggleStageCollapsed={toggleStageCollapsed}
      updateStage={updateStage}
      paged={paged}
      selectedIds={selectedIds}
      toggleAllVisible={toggleAllVisible}
      toggleSelected={toggleSelected}
      updateQuickField={updateQuickField}
      CRM_STATUS_OPTIONS={CRM_STATUS_OPTIONS}
      pg={pg}
      setPg={setPg}
      PP={PP}
      crmStageMeta={crmStageMeta}
      canManageCrm={canManageCrm}
    />

    <CrmDetailModal
      detail={detail}
      setDetailId={setDetailId}
      setActivityForm={setActivityForm}
      crmEntityLabel={crmEntityLabel}
      stagesById={stagesById}
      fmtM={fmtM}
      fmtD={fmtD}
      tenantUsers={tenantUsers}
      empresa={empresa}
      crmCanPassToClient={crmCanPassToClient}
      scopedStages={scopedStages}
      passToEntity={passToEntity}
      saveOpp={saveOpp}
      detailActivities={detailActivities}
      activityForm={activityForm}
      addActivity={addActivity}
      ntf={ntf}
      tasksEnabled={tasksEnabled}
      canManageCrm={canManageCrm}
      canManageTasks={canManageTasks}
      openM={openM}
      detailTasks={detailTasks}
      TareaCard={TareaCard}
      scopedOpps={scopedOpps}
      getRoleConfig={getRoleConfig}
      onComposeEmail={openCrmEmailComposer}
    />

    <CrmStageModal
      open={stagesOpen}
      onClose={() => { setStagesOpen(false); setStagesChanged(false); }}
      localStages={localStages}
      scopedStages={scopedStages}
      setLocalStages={setLocalStages}
      setStagesChanged={setStagesChanged}
      removeStage={removeStage}
      saveStageConfig={saveStageConfig}
      createStage={order => ({ id: uid(), name: "Nueva etapa", order, convertToClient: false, closedWon: false, closedLost: false })}
    />
    <TransactionalEmailComposerModal
      open={emailComposerOpen}
      draft={emailComposerDraft}
      sending={emailComposerSending}
      onClose={closeEmailComposer}
      onSend={sendCrmEmail}
    />
  </div>;
}
