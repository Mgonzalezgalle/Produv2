import { normalizeEmpresasModel, uid } from "../utils/helpers";

export function createTenantBootstrapMockService({ dbGet, dbSet, nextTenantCode, today }) {
  return {
    async createPendingTenant({
      companyDraft = {},
      requestedModules = [],
      customerType = "productora",
      teamSize = "1-3",
    } = {}) {
      const currentEmpresas = normalizeEmpresasModel((await dbGet("produ:empresas")) || []);
      const tenantId = companyDraft.id || `emp_${uid().slice(1, 7)}`;
      const tenantDraft = normalizeEmpresasModel([{
        id: tenantId,
        tenantCode: companyDraft.tenantCode || nextTenantCode(currentEmpresas),
        nombre: companyDraft.nombre || "",
        rut: companyDraft.rut || "",
        dir: companyDraft.dir || "",
        tel: companyDraft.tel || "",
        ema: companyDraft.ema || "",
        logo: companyDraft.logo || "",
        color: companyDraft.color || "#1a1a2e",
        addons: [],
        active: false,
        pendingActivation: true,
        requestType: "self_serve",
        customerType,
        teamSize,
        requestedModules,
        plan: "",
        theme: companyDraft.theme || { preset: "brand", mode: "light" },
        googleCalendarEnabled: false,
        migratedTasksAddon: false,
        migratedCrmAddon: false,
        systemMessages: [],
        systemBanner: { active: false, tone: "info", text: "" },
        billingCurrency: "UF",
        billingMonthly: Number(companyDraft.billingMonthly || 0),
        billingDiscountPct: 0,
        billingDiscountNote: "",
        billingStatus: "Pendiente",
        billingDueDay: 0,
        billingLastPaidAt: "",
        clientPortalUrl: "",
        referredByEmpId: companyDraft.referredByEmpId || "",
        referredByName: companyDraft.referredByName || "",
        referred: !!companyDraft.referredByEmpId || !!companyDraft.referred,
        contractOwner: companyDraft.contractOwner || "",
        cr: today(),
      }])[0];

      await dbSet("produ:empresas", [...currentEmpresas, tenantDraft]);
      return tenantDraft;
    },
  };
}
