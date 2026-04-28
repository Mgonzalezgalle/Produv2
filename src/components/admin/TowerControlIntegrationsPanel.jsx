import { useEffect, useState } from "react";
import { Badge, Btn, Card, Empty, FG, FI, FSl, FilterSel, GBtn, KV, R2, R3 } from "../../lib/ui/components";
import { getRemoteBsaleSnapshot, getRemoteProvisionedModules } from "./towerControlHealth";
import { getTransactionalEmailProviderSnapshot } from "../../lib/integrations/transactionalEmailConfig";
import { getGoogleCalendarProviderSnapshot } from "../../lib/integrations/googleCalendarConfig";
import { getMercadoPagoPaymentsProviderSnapshot } from "../../lib/integrations/mercadoPagoPaymentsConfig";
import { getDiioProviderSnapshot, normalizeDiioGovernanceConfig } from "../../lib/integrations/diioIntegration";

export function IntegracionesAdminPanel({
  empresas,
  integrationEmpId,
  setIntegrationEmpId,
  selectedIntegrationEmp,
  companyGoogleCalendarEnabled,
  onSave,
  saveIntegrationProvisioning,
  platformServices,
}) {
  const [remoteSnapshot, setRemoteSnapshot] = useState(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const selectedBsale = selectedIntegrationEmp?.integrationConfigs?.bsale || {};
  const bsaleGovernance = selectedBsale?.governance || {};
  const bsaleSandbox = selectedBsale?.sandbox || {};
  const bsaleMode = bsaleGovernance.mode || "disabled";
  const bsaleProvisioned = bsaleMode !== "disabled";
  const remoteModules = getRemoteProvisionedModules(remoteSnapshot || {});
  const remoteBsale = getRemoteBsaleSnapshot(remoteSnapshot || {});
  const emailProvisioning = selectedIntegrationEmp?.integrationConfigs?.transactionalEmail || {};
  const emailGovernance = emailProvisioning?.governance || {};
  const emailMode = emailGovernance.mode || "disabled";
  const emailEnabled = emailMode !== "disabled";
  const emailProviderSnapshot = getTransactionalEmailProviderSnapshot();
  const googleCalendarProvisioning = selectedIntegrationEmp?.integrationConfigs?.googleCalendar || {};
  const googleCalendarGovernance = googleCalendarProvisioning?.governance || {};
  const googleCalendarMode = googleCalendarGovernance.mode || (companyGoogleCalendarEnabled(selectedIntegrationEmp) ? "oauth" : "disabled");
  const googleCalendarSnapshot = getGoogleCalendarProviderSnapshot();
  const mercadoPagoProvisioning = selectedIntegrationEmp?.integrationConfigs?.mercadoPago || {};
  const mercadoPagoGovernance = mercadoPagoProvisioning?.governance || {};
  const mercadoPagoMode = mercadoPagoGovernance.mode || "disabled";
  const mercadoPagoEnabled = mercadoPagoMode !== "disabled";
  const mercadoPagoSnapshot = getMercadoPagoPaymentsProviderSnapshot();
  const diioProvisioning = normalizeDiioGovernanceConfig(selectedIntegrationEmp?.integrationConfigs?.diio || {});
  const diioGovernance = diioProvisioning.governance;
  const diioMapping = diioProvisioning.mapping;
  const diioMode = diioGovernance.mode || "disabled";
  const diioEnabled = diioGovernance.enabled;
  const diioSnapshot = getDiioProviderSnapshot();
  const freshdeskEnabled = selectedIntegrationEmp?.freshdeskEnabled === true;
  const supportChatEnabled = selectedIntegrationEmp?.supportChatEnabled === true;
  const freshdeskMode = freshdeskEnabled || supportChatEnabled ? "enabled" : "disabled";
  const localModules = Array.isArray(selectedIntegrationEmp?.addons) ? selectedIntegrationEmp.addons : [];
  const modulesAligned = JSON.stringify([...localModules].sort()) === JSON.stringify([...remoteModules].sort());
  const bsaleAligned = (remoteBsale?.governanceMode || "disabled") === bsaleMode;

  useEffect(() => {
    if (!selectedIntegrationEmp?.id || !platformServices?.getTenantPlatformSnapshot) {
      queueMicrotask(() => {
        setRemoteSnapshot(null);
        setRemoteLoading(false);
      });
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setRemoteLoading(true);
    });
    Promise.resolve(platformServices.getTenantPlatformSnapshot(selectedIntegrationEmp.id))
      .then(snapshot => {
        if (!cancelled) setRemoteSnapshot(snapshot || null);
      })
      .catch(() => {
        if (!cancelled) setRemoteSnapshot(null);
      })
      .finally(() => {
        if (!cancelled) setRemoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedIntegrationEmp?.id, platformServices]);

  const persistIntegration = async (updater, audit = {}) => {
    if (selectedIntegrationEmp?.id && saveIntegrationProvisioning) {
      const result = await saveIntegrationProvisioning(selectedIntegrationEmp.id, updater, audit);
      if (platformServices?.getTenantPlatformSnapshot) {
        try {
          const snapshot = await platformServices.getTenantPlatformSnapshot(selectedIntegrationEmp.id);
          setRemoteSnapshot(snapshot || null);
        } catch {
          setRemoteSnapshot(null);
        }
      }
      return result;
    }
    return onSave("empresas", (empresas || []).map(emp => emp.id === selectedIntegrationEmp.id ? updater(emp) : emp));
  };

  return <div>
    <div style={{ fontSize: 12, color: "var(--gr3)", marginBottom: 14 }}>
      Aquí la Torre de Control gobierna módulos e integraciones por tenant. El tenant luego solo opera lo ya provisionado, para no mezclar producto, negocio y configuración local.
    </div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <FilterSel value={integrationEmpId} onChange={setIntegrationEmpId} options={(empresas || []).map(e => ({ value: e.id, label: e.nombre }))} placeholder="Selecciona una empresa" />
    </div>
    {selectedIntegrationEmp ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 16 }}>
      <Card title="Motor tributario" sub={selectedIntegrationEmp.nombre}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge label={bsaleProvisioned ? "Provisionada" : "No provisionada"} color={bsaleProvisioned ? "green" : "gray"} sm />
          <Badge label={bsaleMode === "production" ? "Producción" : bsaleMode === "sandbox" ? "Sandbox" : "Desactivada"} color={bsaleMode === "production" ? "purple" : bsaleMode === "sandbox" ? "cyan" : "gray"} sm />
          <Badge label={bsaleSandbox?.token ? "Credencial cargada" : "Sin credencial"} color={bsaleSandbox?.token ? "green" : "yellow"} sm />
        </div>
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
          Produ factura; el proveedor externo solo opera como motor tributario. Desde Torre de Control decidimos si este tenant tiene acceso a facturación electrónica y en qué entorno.
        </div>
        <R3>
          <FG label="Provisionamiento">
            <FSl
              value={bsaleMode}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  bsale: {
                    ...((emp.integrationConfigs || {}).bsale || {}),
                    governance: {
                      ...(((emp.integrationConfigs || {}).bsale || {}).governance || {}),
                      mode: e.target.value,
                      enabled: e.target.value !== "disabled",
                    },
                  },
                },
              }), { action: "tenant_bsale_governance_updated", integration: "bsale", field: "governance.mode", value: e.target.value })}
            >
              <option value="disabled">Desactivada</option>
              <option value="sandbox">Sandbox</option>
              <option value="production">Producción</option>
            </FSl>
          </FG>
          <FG label="Estado credencial">
            <FSl
              value={bsaleSandbox?.status || "draft"}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  bsale: {
                    ...((emp.integrationConfigs || {}).bsale || {}),
                    sandbox: {
                      ...(((((emp.integrationConfigs || {}).bsale) || {}).sandbox) || {}),
                      status: e.target.value,
                    },
                  },
                },
              }), { action: "tenant_bsale_sandbox_updated", integration: "bsale", field: "sandbox.status", value: e.target.value })}
            >
              <option value="draft">draft</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
            </FSl>
          </FG>
          <FG label="Office id">
            <FI
              value={bsaleSandbox?.officeId || ""}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  bsale: {
                    ...((emp.integrationConfigs || {}).bsale || {}),
                    sandbox: {
                      ...(((((emp.integrationConfigs || {}).bsale) || {}).sandbox) || {}),
                      officeId: e.target.value,
                    },
                  },
                },
              }), { action: "tenant_bsale_sandbox_updated", integration: "bsale", field: "sandbox.officeId", value: e.target.value })}
              placeholder="Opcional"
            />
          </FG>
        </R3>
        <R2>
          <FG label="Token sandbox">
            <FI
              type="password"
              value={bsaleSandbox?.token || ""}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  bsale: {
                    ...((emp.integrationConfigs || {}).bsale || {}),
                    sandbox: {
                      ...(((((emp.integrationConfigs || {}).bsale) || {}).sandbox) || {}),
                      token: e.target.value,
                    },
                  },
                },
              }), { action: "tenant_bsale_sandbox_updated", integration: "bsale", field: "sandbox.token", value: e.target.value ? "configured" : "empty" })}
              placeholder="Token sandbox del tenant"
            />
          </FG>
          <FG label="Document type id por defecto">
            <FI
              value={bsaleSandbox?.documentTypeId || ""}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  bsale: {
                    ...((emp.integrationConfigs || {}).bsale || {}),
                    sandbox: {
                      ...(((((emp.integrationConfigs || {}).bsale) || {}).sandbox) || {}),
                      documentTypeId: e.target.value,
                    },
                  },
                },
              }), { action: "tenant_bsale_sandbox_updated", integration: "bsale", field: "sandbox.documentTypeId", value: e.target.value })}
              placeholder="Opcional"
            />
          </FG>
        </R2>
      </Card>
      <Card title="Foundation remota" sub="Lectura resumida del tenant sincronizado en Supabase">
        {remoteLoading
          ? <div style={{ fontSize: 12, color: "var(--gr2)" }}>Actualizando snapshot remoto…</div>
          : <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <Badge label={remoteSnapshot?.tenant ? "Tenant remoto detectado" : "Sin snapshot remoto"} color={remoteSnapshot?.tenant ? "green" : "yellow"} sm />
                <Badge label={(remoteSnapshot?.auditLogs || []).length ? "Con audit log" : "Sin audit log"} color={(remoteSnapshot?.auditLogs || []).length ? "cyan" : "gray"} sm />
                <Badge label={modulesAligned ? "Módulos alineados" : "Módulos por revisar"} color={modulesAligned ? "green" : "yellow"} sm />
                <Badge label={bsaleAligned ? "Tributario alineado" : "Tributario por revisar"} color={bsaleAligned ? "green" : "yellow"} sm />
              </div>
              <KV label="Tenant code remoto" value={remoteSnapshot?.tenant?.tenant_code || "—"} />
              <KV label="Estado remoto" value={remoteSnapshot?.tenant?.status || "—"} />
              <KV label="Activo remoto" value={remoteSnapshot?.tenant?.active ? "Sí" : "No"} />
              <KV label="Billing status remoto" value={remoteSnapshot?.tenant?.billing_status || "—"} />
              <KV label="Módulos locales / remotos" value={`${localModules.length} / ${remoteModules.length}`} />
              <KV label="Provisionamiento Bsale local / remoto" value={`${bsaleMode} / ${remoteBsale?.governanceMode || "disabled"}`} />
              <KV label="Audit logs remotos" value={`${(remoteSnapshot?.auditLogs || []).length}`} />
            </>}
      </Card>
      <Card title="Google Calendar" sub={selectedIntegrationEmp.nombre}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge label={companyGoogleCalendarEnabled(selectedIntegrationEmp) ? "Activa" : "Desactivada"} color={companyGoogleCalendarEnabled(selectedIntegrationEmp) ? "green" : "gray"} sm />
          <Badge label={googleCalendarSnapshot.ready ? "OAuth listo" : "OAuth incompleto"} color={googleCalendarSnapshot.ready ? "green" : "yellow"} sm />
          <Badge label="Conexión futura por usuario" color="purple" sm />
          <Badge label={googleCalendarSnapshot.redirectMatchesSupabaseCallback ? "Callback alineado" : "Callback por alinear"} color={googleCalendarSnapshot.redirectMatchesSupabaseCallback ? "green" : "yellow"} sm />
        </div>
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
          La integración está modelada para multiempresa y conexión individual por usuario. En esta etapa dejamos lista la base OAuth y el estado del proveedor, pero sin exponer todavía sincronización real dentro del calendario.
        </div>
        <R2>
          <FG label="Provisionamiento">
            <FSl
              value={googleCalendarMode}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                googleCalendarEnabled: e.target.value !== "disabled",
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  googleCalendar: {
                    ...((emp.integrationConfigs || {}).googleCalendar || {}),
                    governance: {
                      ...(((emp.integrationConfigs || {}).googleCalendar || {}).governance || {}),
                      mode: e.target.value,
                      enabled: e.target.value !== "disabled",
                    },
                  },
                },
              }), { action: "tenant_google_calendar_governance_updated", integration: "google_calendar", field: "governance.mode", value: e.target.value })}
            >
              <option value="disabled">Desactivado</option>
              <option value="oauth">OAuth</option>
            </FSl>
          </FG>
          <FG label="Google client id">
            <FI value={googleCalendarSnapshot.clientConfigured ? "Configurado" : ""} readOnly placeholder="Sin client id" />
          </FG>
        </R2>
        <KV label="Redirect URI configurada" value={googleCalendarSnapshot.redirectUri || "No configurada"} />
        <KV label="Redirect URI esperada" value={googleCalendarSnapshot.expectedCallbackUri || "No disponible"} />
        <KV label="Scopes" value={googleCalendarSnapshot.scopes.join(", ")} />
        <KV label="Uso inicial" value="Agenda, rodajes y entregas por usuario" />
      </Card>
      <Card title="Mercado Pago" sub={selectedIntegrationEmp.nombre}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge label={mercadoPagoEnabled ? "Habilitado" : "Deshabilitado"} color={mercadoPagoEnabled ? "green" : "gray"} sm />
          <Badge label={mercadoPagoSnapshot.usesOAuth ? "OAuth seller" : mercadoPagoSnapshot.isMock ? "Mock" : "Conexión manual/API"} color={mercadoPagoSnapshot.usesOAuth ? "purple" : mercadoPagoSnapshot.isMock ? "cyan" : "yellow"} sm />
          <Badge label={mercadoPagoSnapshot.ready ? "Provider listo" : "Provider base"} color={mercadoPagoSnapshot.ready ? "green" : "yellow"} sm />
        </div>
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
          Torre de Control define si este tenant puede usar cobros online con Mercado Pago. La conexión operativa de la cuenta se completa dentro del Panel Administrador del tenant.
        </div>
        <R2>
          <FG label="Provisionamiento">
            <FSl
              value={mercadoPagoMode}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  mercadoPago: {
                    ...((emp.integrationConfigs || {}).mercadoPago || {}),
                    governance: {
                      ...(((emp.integrationConfigs || {}).mercadoPago || {}).governance || {}),
                      mode: e.target.value,
                      enabled: e.target.value !== "disabled",
                    },
                  },
                },
              }), { action: "tenant_mercadopago_governance_updated", integration: "mercadopago_payments", field: "governance.mode", value: e.target.value })}
            >
              <option value="disabled">Desactivado</option>
              <option value="mock">Mock</option>
              <option value="oauth">OAuth seller</option>
              <option value="api">API manual</option>
            </FSl>
          </FG>
          <FG label="Marketplace">
            <FI value={mercadoPagoSnapshot.marketplace || "MLC"} readOnly placeholder="MLC" />
          </FG>
        </R2>
        <KV label="Uso inicial" value="Links de pago por factura desde Cobranza" />
        <KV label="Conciliación" value="Solo pagos aprobados registran Tesorería" />
        <KV label="Operación" value="Credenciales y cuenta seller se configuran en Administrador" />
      </Card>
      <Card title="Diio" sub={selectedIntegrationEmp.nombre}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge label={diioEnabled ? "Provisionado" : "No provisionado"} color={diioEnabled ? "green" : "gray"} sm />
          <Badge label={diioMode === "webhook" ? "Webhook" : diioMode === "manual" ? "Manual / asistido" : "Desactivado"} color={diioMode === "webhook" ? "purple" : diioMode === "manual" ? "cyan" : "gray"} sm />
          <Badge label={diioGovernance.sellable ? "Comercializable" : "Uso interno"} color={diioGovernance.sellable ? "green" : "yellow"} sm />
          <Badge label={diioSnapshot.ready ? "Provider listo" : "Provider base"} color={diioSnapshot.ready ? "green" : "yellow"} sm />
        </div>
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
          Diio alimenta comentarios inteligentes e historial de interacción en CRM, Producciones, Proyectos y Contenidos. La asociación operativa queda asistida para evitar que una reunión termine en el módulo equivocado.
        </div>
        <R3>
          <FG label="Provisionamiento">
            <FSl
              value={diioMode}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  diio: {
                    ...normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {}),
                    governance: {
                      ...normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {}).governance,
                      mode: e.target.value,
                      enabled: e.target.value !== "disabled",
                    },
                  },
                },
              }), { action: "tenant_diio_governance_updated", integration: "diio", field: "governance.mode", value: e.target.value })}
            >
              <option value="disabled">Desactivado</option>
              <option value="manual">Manual / asistido</option>
              <option value="webhook">Webhook</option>
            </FSl>
          </FG>
          <FG label="Comercialización">
            <FSl
              value={diioGovernance.sellable ? "sellable" : "internal"}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  diio: {
                    ...normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {}),
                    governance: {
                      ...normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {}).governance,
                      sellable: e.target.value === "sellable",
                    },
                  },
                },
              }), { action: "tenant_diio_governance_updated", integration: "diio", field: "governance.sellable", value: e.target.value })}
            >
              <option value="sellable">Comercializable</option>
              <option value="internal">Uso interno</option>
            </FSl>
          </FG>
          <FG label="Estrategia de asociación">
            <FSl
              value={diioMapping.strategy}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  diio: {
                    ...normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {}),
                    mapping: {
                      ...normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {}).mapping,
                      strategy: e.target.value,
                    },
                  },
                },
              }), { action: "tenant_diio_mapping_updated", integration: "diio", field: "mapping.strategy", value: e.target.value })}
            >
              <option value="assisted">Asistida</option>
              <option value="manual">Manual</option>
              <option value="auto">Automática</option>
            </FSl>
          </FG>
        </R3>
        <R2>
          <FG label="Cobertura por módulo">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
              {[
                ["crm", "CRM"],
                ["productions", "Producciones"],
                ["projects", "Proyectos"],
                ["content", "Contenidos"],
              ].map(([key, label]) => (
                <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--gr3)" }}>
                  <input
                    type="checkbox"
                    checked={diioGovernance.modules?.[key] !== false}
                    onChange={e => persistIntegration(emp => {
                      const current = normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {});
                      return {
                        ...emp,
                        integrationConfigs: {
                          ...(emp.integrationConfigs || {}),
                          diio: {
                            ...current,
                            governance: {
                              ...current.governance,
                              modules: {
                                ...current.governance.modules,
                                [key]: e.target.checked,
                              },
                            },
                          },
                        },
                      };
                    }, { action: "tenant_diio_governance_updated", integration: "diio", field: `governance.modules.${key}`, value: e.target.checked ? "enabled" : "disabled" })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </FG>
          <FG label="Confianza mínima">
            <FI
              type="number"
              min="0.5"
              max="0.99"
              step="0.01"
              value={diioMapping.minConfidence}
              onChange={e => persistIntegration(emp => {
                const current = normalizeDiioGovernanceConfig((emp.integrationConfigs || {}).diio || {});
                return {
                  ...emp,
                  integrationConfigs: {
                    ...(emp.integrationConfigs || {}),
                    diio: {
                      ...current,
                      mapping: {
                        ...current.mapping,
                        minConfidence: Number(e.target.value || 0.82),
                      },
                    },
                  },
                };
              }, { action: "tenant_diio_mapping_updated", integration: "diio", field: "mapping.minConfidence", value: e.target.value })}
            />
          </FG>
        </R2>
        <KV label="Webhook base" value={diioSnapshot.webhookBase || "No configurada en Produ"} />
        <KV label="Operación visible" value="Inbox Diio de la empresa, al lado de mensajes y alertas" />
        <KV label="Destino operativo" value="Comentarios e historial por oportunidad, producción general, campaña y proyecto" />
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: "1px solid var(--bdr)", background: "var(--sur)", fontSize: 12, color: "var(--gr2)", lineHeight: 1.6 }}>
          Torre de Control gobierna la activación, la comercialización y el estado técnico de Diio. Las interacciones reales viven en el inbox global de la empresa para que cualquier usuario operativo pueda confirmarlas sin depender de administración.
        </div>
      </Card>
      <Card title="Correo transaccional" sub={selectedIntegrationEmp.nombre}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge label={emailEnabled ? "Provisionado" : "No provisionado"} color={emailEnabled ? "green" : "gray"} sm />
          <Badge label={emailProviderSnapshot.provider === "resend" ? "Resend" : emailProviderSnapshot.provider === "mock" ? "Mock" : "Sin proveedor"} color={emailProviderSnapshot.provider === "resend" ? "purple" : emailProviderSnapshot.provider === "mock" ? "cyan" : "gray"} sm />
          <Badge label={emailProviderSnapshot.ready ? "Gateway listo" : "Gateway incompleto"} color={emailProviderSnapshot.ready ? "green" : "yellow"} sm />
        </div>
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
          Resend queda como proveedor base del correo transaccional de Produ. Esta provisión habilita el carril para onboarding, recuperación y documentos comerciales, pero el envío real seguirá pasando por backend.
        </div>
        <R2>
          <FG label="Provisionamiento">
            <FSl
              value={emailMode}
              onChange={e => persistIntegration(emp => ({
                ...emp,
                integrationConfigs: {
                  ...(emp.integrationConfigs || {}),
                  transactionalEmail: {
                    ...((emp.integrationConfigs || {}).transactionalEmail || {}),
                    governance: {
                      ...(((emp.integrationConfigs || {}).transactionalEmail || {}).governance || {}),
                      mode: e.target.value,
                      enabled: e.target.value !== "disabled",
                    },
                  },
                },
              }), { action: "tenant_transactional_email_governance_updated", integration: "transactional_email", field: "governance.mode", value: e.target.value })}
            >
              <option value="disabled">Desactivado</option>
              <option value="mock">Mock</option>
              <option value="resend">Resend</option>
            </FSl>
          </FG>
          <FG label="Remitente configurado">
            <FI value={emailProviderSnapshot.fromEmail || ""} readOnly placeholder="Sin remitente" />
          </FG>
        </R2>
        <KV label="Modo del provider" value={emailProviderSnapshot.mode || "disabled"} />
        <KV label="Reply-to" value={emailProviderSnapshot.replyTo || "—"} />
        <KV label="Uso inicial" value="Recuperación, invitación y documentos" />
      </Card>
      <Card title="Freshdesk" sub={selectedIntegrationEmp.nombre}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <Badge label={freshdeskMode === "enabled" ? "Habilitado" : "Deshabilitado"} color={freshdeskMode === "enabled" ? "green" : "gray"} sm />
          <Badge label={freshdeskEnabled ? "Provider listo" : "Provider apagado"} color={freshdeskEnabled ? "purple" : "gray"} sm />
          <Badge label={supportChatEnabled ? "Chat visible" : "Chat oculto"} color={supportChatEnabled ? "green" : "yellow"} sm />
        </div>
        <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginBottom: 14 }}>
          Freshdesk vive como widget de soporte por tenant. Desde Torre de Control definimos si el provider queda habilitado y si el chat puede mostrarse a usuarios normales de esa empresa.
        </div>
        <R2>
          <FG label="Provisionamiento">
            <FSl
              value={freshdeskMode}
              onChange={e => {
                const enabled = e.target.value === "enabled";
                return persistIntegration(emp => ({
                  ...emp,
                  freshdeskEnabled: enabled,
                  supportChatEnabled: enabled,
                }), {
                  action: "tenant_freshdesk_governance_updated",
                  integration: "freshdesk_support",
                  field: "enabled",
                  value: enabled ? "enabled" : "disabled",
                });
              }}
            >
              <option value="disabled">Desactivado</option>
              <option value="enabled">Habilitado</option>
            </FSl>
          </FG>
          <FG label="Estado widget">
            <FI value={freshdeskMode === "enabled" ? "Visible para usuarios tenant" : ""} readOnly placeholder="No visible" />
          </FG>
        </R2>
        <KV label="Regla de visibilidad" value="Solo usuarios tenant activos, no superadmin" />
        <KV label="Snippet" value="fw-cdn.com/16062405/7053033.js" />
      </Card>
      <Card title="Gobierno SaaS" sub="Qué decide Torre de Control para este tenant">
        <KV label="Motor tributario" value={bsaleProvisioned ? (bsaleMode === "production" ? "Activo en producción" : "Activo en sandbox") : "Desactivado"} />
        <KV label="Operación en tenant" value={bsaleProvisioned ? "Visible solo como operación" : "Oculto / sin emisión electrónica"} />
        <KV label="Responsable de activación" value="Torre de Control" />
        <KV label="Modelo" value="Produ factura, proveedor externo invisible" />
      </Card>
      <Card title="Estado operativo" sub="Lo que ya queda resuelto en el producto">
        <KV label="Visibilidad en Calendario" value={companyGoogleCalendarEnabled(selectedIntegrationEmp) ? "Oculta hasta tener sync real" : "Oculta"} />
        <KV label="Visibilidad Mercado Pago" value={mercadoPagoEnabled ? "Disponible para conexión del tenant" : "Oculta en administrador"} />
        <KV label="Gobierno" value="Torre de Control" />
        <KV label="Conexión futura" value="Usuario individual" />
        <KV label="Modelo" value="Multiempresa / multiusuario" />
      </Card>
    </div> : <Empty text="Selecciona una empresa para administrar integraciones" />}
  </div>;
}
