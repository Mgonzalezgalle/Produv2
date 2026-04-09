import React from "react";
import { CrmOpportunityModal } from "./crm/CrmOpportunityModal";

export function CrmModalRouter({
  mOpen,
  mData,
  closeM,
  crmStages,
  users,
  onSaveCrmOpp,
}) {
  return (
    <CrmOpportunityModal
      open={mOpen==="crm-opp"}
      data={mData}
      crmStages={crmStages}
      users={users}
      onClose={closeM}
      onSave={onSaveCrmOpp}
    />
  );
}
