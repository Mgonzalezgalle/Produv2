export const BILLING_FISCAL_COUNTRIES = [
  { code: "CL", label: "Chile", currency: "CLP", taxCode: "iva_19", taxLabel: "IVA 19%", taxRate: 0.19 },
  { code: "PE", label: "Perú", currency: "PEN", taxCode: "igv_18", taxLabel: "IGV 18%", taxRate: 0.18 },
];

const COUNTRY_ALIASES = {
  chile: "CL",
  cl: "CL",
  peru: "PE",
  "perú": "PE",
  pe: "PE",
};

const TAX_ALIASES = {
  none: "none",
  "sin impuesto": "none",
  iva: "iva_19",
  iva_19: "iva_19",
  "iva 19": "iva_19",
  "iva 19%": "iva_19",
  igv: "igv_18",
  igv_18: "igv_18",
  "igv 18": "igv_18",
  "igv 18%": "igv_18",
};

export function normalizeBillingCountry(value = "CL") {
  const raw = String(value || "CL").trim();
  return COUNTRY_ALIASES[raw.toLowerCase()] || raw.toUpperCase();
}

export function getBillingFiscalProfile(value = "CL") {
  const countryCode = normalizeBillingCountry(value);
  return BILLING_FISCAL_COUNTRIES.find(item => item.code === countryCode) || BILLING_FISCAL_COUNTRIES[0];
}

export function getBillingFiscalProfileForClient(client = {}, fallbackCountry = "CL") {
  return getBillingFiscalProfile(client?.billingCountry || client?.pais || client?.country || fallbackCountry);
}

export function normalizeBillingTaxCode(value = "", fallback = "iva_19") {
  const raw = String(value || fallback || "iva_19").trim().toLowerCase();
  return TAX_ALIASES[raw] || raw;
}

export function getBillingTaxRate(value = "iva_19") {
  const taxCode = normalizeBillingTaxCode(value);
  const profile = BILLING_FISCAL_COUNTRIES.find(item => item.taxCode === taxCode);
  return profile?.taxRate ?? 0;
}

export function getBillingTaxLabel(value = "iva_19") {
  const taxCode = normalizeBillingTaxCode(value);
  if (taxCode === "none") return "Sin impuesto";
  const profile = BILLING_FISCAL_COUNTRIES.find(item => item.taxCode === taxCode);
  return profile?.taxLabel || "Impuesto";
}
