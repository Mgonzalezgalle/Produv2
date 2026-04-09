import { useEffect } from "react";

export function useLabCrmGuards({
  curEmp,
  ldCrmStages,
  crmStages,
  setCrmStages,
  normalizeCrmStages,
  recoverPreferredCrmStages,
  CRM_STAGE_SEED,
  ldCrmOpps,
  crmOpps,
  setCrmOpps,
  crmNormalizeOpportunity,
  ldCrmActivities,
  crmActivities,
  setCrmActivities,
  crmNormalizeActivities,
  crmSavingRef,
}) {
  useEffect(() => {
    if (!curEmp?.id || ldCrmStages) return;
    if (crmSavingRef?.current) return;
    if (crmStages == null || (Array.isArray(crmStages) && !crmStages.length)) {
      setCrmStages(normalizeCrmStages(CRM_STAGE_SEED.map(stage => ({ ...stage, empId: curEmp.id }))));
      return;
    }
    const recovered = recoverPreferredCrmStages(crmStages, curEmp.id);
    const normalized = normalizeCrmStages(recovered).map((stage, idx) => ({
      ...stage,
      empId: curEmp.id,
      order: idx + 1,
    }));
    if (JSON.stringify(normalized) !== JSON.stringify(crmStages || [])) {
      setCrmStages(normalized);
    }
  }, [curEmp?.id, ldCrmStages, crmStages, setCrmStages, normalizeCrmStages, recoverPreferredCrmStages, CRM_STAGE_SEED, crmSavingRef]);

  useEffect(() => {
    if (!curEmp?.id || ldCrmOpps || ldCrmStages || !Array.isArray(crmStages) || !crmStages.length) return;
    const normalized = (Array.isArray(crmOpps) ? crmOpps : []).map(opp => crmNormalizeOpportunity(opp, crmStages));
    if (JSON.stringify(normalized) !== JSON.stringify(crmOpps || [])) setCrmOpps(normalized);
  }, [curEmp?.id, ldCrmOpps, ldCrmStages, crmOpps, crmStages, setCrmOpps, crmNormalizeOpportunity]);

  useEffect(() => {
    if (!curEmp?.id || ldCrmActivities) return;
    const normalized = crmNormalizeActivities(crmActivities);
    if (JSON.stringify(normalized) !== JSON.stringify(crmActivities || [])) setCrmActivities(normalized);
  }, [curEmp?.id, ldCrmActivities, crmActivities, setCrmActivities, crmNormalizeActivities]);
}
