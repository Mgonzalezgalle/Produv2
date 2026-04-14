import { Badge } from "../../lib/ui/components";

export function TenantHealthBadgeRow({ health, compact = false }) {
  if (!health) return null;
  const tributaryLabel = health.remoteBsale?.governanceMode === "production"
    ? "Tributario prod"
    : health.remoteBsale?.governanceMode === "sandbox"
      ? "Tributario sandbox"
      : "Sin tributario";
  const tributaryColor = health.remoteBsale?.governanceMode === "production"
    ? "purple"
    : health.remoteBsale?.governanceMode === "sandbox"
      ? "cyan"
      : "gray";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <Badge label={health.foundationReady ? "Foundation OK" : "Sin foundation"} color={health.foundationReady ? "green" : "gray"} sm />
      <Badge label={health.identityAligned ? "Identidad alineada" : "Identidad parcial"} color={health.identityAligned ? "green" : "yellow"} sm />
      {!compact && <Badge label={tributaryLabel} color={tributaryColor} sm />}
    </div>
  );
}

export function GovernanceSyncStatus({ sync }) {
  if (!sync) return null;
  const syncLabel = sync.syncSource === "remote" ? "Sync remoto" : sync.syncSource === "fallback" ? "Sync fallback" : "Sync degradado";
  const syncColor = sync.syncSource === "remote" ? "green" : sync.syncSource === "fallback" ? "yellow" : "red";
  const auditLabel = sync.auditSource === "remote" ? "Audit remoto" : sync.auditSource === "fallback" ? "Audit fallback" : "Audit degradado";
  const auditColor = sync.auditSource === "remote" ? "cyan" : sync.auditSource === "fallback" ? "yellow" : "red";
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Badge label={syncLabel} color={syncColor} sm />
        <Badge label={auditLabel} color={auditColor} sm />
      </div>
      <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 10, lineHeight: 1.6 }}>
        Última acción: <span style={{ color: "var(--gr3)", fontWeight: 700 }}>{String(sync.action || "governance_update").replaceAll("_", " ")}</span>
        {" · "}
        tenant <span style={{ color: "var(--gr3)", fontWeight: 700 }}>{sync.tenantId || "—"}</span>
        {" · "}
        {sync.updatedAt ? new Date(sync.updatedAt).toLocaleString("es-CL") : "sin hora"}
      </div>
    </>
  );
}
