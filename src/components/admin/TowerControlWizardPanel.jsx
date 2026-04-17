import { useEffect, useState } from "react";
import { Btn, Card, FG, FI, FSl, R2, R3 } from "../../lib/ui/components";
import { DEFAULT_SELF_SERVE_SETTINGS, normalizeSelfServeSettings, SELF_SERVE_SETTINGS_KEY } from "../../lib/config/selfServeAdminConfig";
import { getSelfServeAddonCatalog } from "../../lib/config/selfServeCatalog";

export function WizardAdminPanel({ dbGet, dbSet }) {
  const [selfServeSettings, setSelfServeSettings] = useState(DEFAULT_SELF_SERVE_SETTINGS);
  const [selfServeSaving, setSelfServeSaving] = useState(false);
  const addonCatalog = getSelfServeAddonCatalog(selfServeSettings);

  useEffect(() => {
    let cancelled = false;
    const loadSettings = async () => {
      try {
        const stored = await dbGet?.(SELF_SERVE_SETTINGS_KEY);
        if (!cancelled) setSelfServeSettings(normalizeSelfServeSettings(stored || DEFAULT_SELF_SERVE_SETTINGS));
      } catch {
        if (!cancelled) setSelfServeSettings(DEFAULT_SELF_SERVE_SETTINGS);
      }
    };
    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [dbGet]);

  const persistSelfServeSettings = async () => {
    if (!dbSet) return false;
    setSelfServeSaving(true);
    try {
      await dbSet(SELF_SERVE_SETTINGS_KEY, normalizeSelfServeSettings(selfServeSettings));
      return true;
    } finally {
      setSelfServeSaving(false);
    }
  };

  return <div>
    <Card title="Wizard comercial" sub="Pricing y narrativa pública del self-serve">
      <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
        Aquí gobernamos la oferta pública del wizard. El `Starter` mantiene su estructura fija; desde esta consola solo administramos modalidad, promo y copy comercial de cada addon.
      </div>
      <R3>
        <FG label="Nombre del plan">
          <FI value={selfServeSettings.basePlanLabel} onChange={e => setSelfServeSettings(prev => ({ ...prev, basePlanLabel: e.target.value }))} placeholder="Plan Starter" />
        </FG>
        <FG label="Alias corto">
          <FI value={selfServeSettings.basePlanShortLabel} onChange={e => setSelfServeSettings(prev => ({ ...prev, basePlanShortLabel: e.target.value }))} placeholder="Starter" />
        </FG>
        <FG label="Cierre del wizard">
          <FSl value={selfServeSettings.assistedOnly ? "assisted" : "checkout"} onChange={e => setSelfServeSettings(prev => ({ ...prev, assistedOnly: e.target.value !== "checkout" }))}>
            <option value="assisted">Solo asistido</option>
            <option value="checkout">Con checkout habilitado</option>
          </FSl>
        </FG>
      </R3>
      <R3>
        <FG label="Plan base desde mes normal">
          <FI type="number" min="0" step="0.1" value={selfServeSettings.baseMonthlyUF} onChange={e => setSelfServeSettings(prev => ({ ...prev, baseMonthlyUF: Number(e.target.value || 0) }))} placeholder="1" />
        </FG>
        <FG label="Promo base mensual">
          <FI type="number" min="0" step="0.1" value={selfServeSettings.promoMonthlyUF} onChange={e => setSelfServeSettings(prev => ({ ...prev, promoMonthlyUF: Number(e.target.value || 0) }))} placeholder="0" />
        </FG>
        <FG label="Meses promo">
          <FI type="number" min="0" step="1" value={selfServeSettings.promoMonths} onChange={e => setSelfServeSettings(prev => ({ ...prev, promoMonths: Number(e.target.value || 0) }))} placeholder="3" />
        </FG>
      </R3>
      <R2>
        <FG label="Tipo de cambio UF (CLP)">
          <FI
            type="number"
            min="0"
            step="1"
            value={selfServeSettings.ufValueClp}
            onChange={e => setSelfServeSettings(prev => ({ ...prev, ufValueClp: Number(e.target.value || 0) }))}
            placeholder="39000"
          />
        </FG>
        <FG label="Referencia comercial">
          <FI value="Usado para mostrar equivalentes en CLP dentro del wizard" disabled />
        </FG>
      </R2>
      <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--sur)", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 10 }}>Catálogo de addons</div>
        <div style={{ display: "grid", gap: 10 }}>
          {addonCatalog.map((addon) => (
            <div key={addon.code} style={{ padding: "12px 12px 10px", borderRadius: 14, border: "1px solid var(--bdr2)", background: "var(--card)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 140px", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{addon.label}</div>
                  <div style={{ fontSize: 11, color: "var(--gr2)" }}>{addon.group} · {addon.badge}</div>
                </div>
                <FI
                  type="number"
                  min="0"
                  step="0.1"
                  value={Number(selfServeSettings.addonPrices?.[addon.code] ?? addon.monthlyUF)}
                  onChange={e => setSelfServeSettings(prev => ({
                    ...prev,
                    addonPrices: {
                      ...(prev.addonPrices || {}),
                      [addon.code]: Number(e.target.value || 0),
                    },
                  }))}
                  placeholder="0"
                />
              </div>
              <R2>
                <FG label="Nombre comercial">
                  <FI value={selfServeSettings.addonOverrides?.[addon.code]?.label ?? addon.label} onChange={e => setSelfServeSettings(prev => ({ ...prev, addonOverrides: { ...(prev.addonOverrides || {}), [addon.code]: { ...(prev.addonOverrides?.[addon.code] || {}), label: e.target.value } } }))} placeholder={addon.label} />
                </FG>
                <FG label="Badge">
                  <FI value={selfServeSettings.addonOverrides?.[addon.code]?.badge ?? addon.badge} onChange={e => setSelfServeSettings(prev => ({ ...prev, addonOverrides: { ...(prev.addonOverrides || {}), [addon.code]: { ...(prev.addonOverrides?.[addon.code] || {}), badge: e.target.value } } }))} placeholder={addon.badge} />
                </FG>
              </R2>
              <FG label="Audiencia">
                <FI value={selfServeSettings.addonOverrides?.[addon.code]?.audience ?? addon.audience} onChange={e => setSelfServeSettings(prev => ({ ...prev, addonOverrides: { ...(prev.addonOverrides || {}), [addon.code]: { ...(prev.addonOverrides?.[addon.code] || {}), audience: e.target.value } } }))} placeholder={addon.audience} />
              </FG>
              <FG label="Descripción comercial">
                <FI value={selfServeSettings.addonOverrides?.[addon.code]?.description ?? addon.description} onChange={e => setSelfServeSettings(prev => ({ ...prev, addonOverrides: { ...(prev.addonOverrides || {}), [addon.code]: { ...(prev.addonOverrides?.[addon.code] || {}), description: e.target.value } } }))} placeholder={addon.description} />
              </FG>
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid var(--cm)", background: "var(--cg)", marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 8 }}>Vista previa</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, fontSize: 12 }}>
          <span>{selfServeSettings.basePlanLabel}</span>
          <strong style={{ color: "var(--cy)" }}>{selfServeSettings.promoMonthlyUF === 0 && selfServeSettings.promoMonths > 0 ? `$0 por ${selfServeSettings.promoMonths} meses` : `${selfServeSettings.promoMonthlyUF} UF / mes`}</strong>
          <span>Luego</span>
          <strong>{selfServeSettings.baseMonthlyUF} UF / mes</strong>
          <span>UF referencial</span>
          <strong>${Number(selfServeSettings.ufValueClp || 0).toLocaleString("es-CL")} CLP</strong>
          <span>Modalidad</span>
          <strong>{selfServeSettings.assistedOnly ? "Asistida" : "Checkout habilitado"}</strong>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Btn onClick={() => { void persistSelfServeSettings(); }} disabled={selfServeSaving}>
          {selfServeSaving ? "Guardando..." : "Guardar configuración del wizard"}
        </Btn>
      </div>
    </Card>
  </div>;
}
