import { Btn } from "../../lib/ui/components";
import diioLogo from "../../assets/diio-logo.png";

export function AppTopbarActions({
  view,
  detId,
  curEmp,
  curUser,
  canDo,
  openM,
  setSystemOpen,
  systemOpen,
  unreadSystemCount,
  setAlertasOpen,
  alertasOpen,
  alertas,
  alertasLeidas,
  alertasOcultas,
  diioEnabled,
  diioOpen,
  setDiioOpen,
  diioPendingCount,
}) {
  return (
    <>
      {(view === "pro-det" || view === "pg-det" || view === "contenido-det") && canDo(curUser, "movimientos", curEmp) && (
        <Btn onClick={() => openM("mov", { eid: detId, et: view === "pro-det" ? "pro" : view === "pg-det" ? "pg" : "pz" })} sm>
          + Movimiento
        </Btn>
      )}
      {view === "ep-det" && canDo(curUser, "movimientos", curEmp) && (
        <Btn onClick={() => openM("mov", { eid: detId, et: "ep", tipo: "gasto" })} sm>
          + Gasto
        </Btn>
      )}
      {curEmp && curUser?.role !== "superadmin" && diioEnabled && (
        <button
          onClick={() => {
            setDiioOpen(!diioOpen);
            setSystemOpen(false);
            setAlertasOpen(false);
          }}
          style={{
            position: "relative",
            background: diioOpen ? "rgba(255,153,51,.16)" : "var(--sur)",
            border: `1px solid ${diioOpen ? "#ff9933" : "var(--bdr2)"}`,
            borderRadius: 10,
            padding: "7px 12px",
            cursor: "pointer",
            color: diioOpen ? "#ffb366" : "var(--gr3)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
            minWidth: 104,
          }}
          title="Bandeja de Diio"
        >
          <span
            style={{
              height: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2px 6px",
              borderRadius: 999,
              background: diioOpen ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.04)",
            }}
          >
            <img src={diioLogo} alt="Diio" style={{ height: 12, display: "block", objectFit: "contain" }} />
          </span>
          <span>Diio</span>
          {diioPendingCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#ff9933",
                fontSize: 9,
                fontWeight: 700,
                color: "#1d2340",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {diioPendingCount}
            </span>
          )}
        </button>
      )}
      {curEmp && (
        <button
          onClick={() => {
            setSystemOpen(!systemOpen);
            setAlertasOpen(false);
            setDiioOpen(false);
          }}
          style={{
            position: "relative",
            background: systemOpen ? "var(--cg)" : "var(--sur)",
            border: `1px solid ${systemOpen ? "var(--cy)" : "var(--bdr2)"}`,
            borderRadius: 10,
            padding: "7px 12px",
            cursor: "pointer",
            color: systemOpen ? "var(--cy)" : "var(--gr3)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 16 }}>💬</span>
          <span>Mensajes</span>
          {unreadSystemCount > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "var(--cy)",
                fontSize: 9,
                fontWeight: 700,
                color: "var(--bg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {unreadSystemCount}
            </span>
          )}
        </button>
      )}
      {curEmp && (
        <button
          onClick={() => {
            setAlertasOpen(!alertasOpen);
            setSystemOpen(false);
            setDiioOpen(false);
          }}
          style={{
            position: "relative",
            background: alertasOpen ? "var(--cg)" : "var(--sur)",
            border: `1px solid ${alertasOpen ? "var(--cy)" : "var(--bdr2)"}`,
            borderRadius: 10,
            padding: "7px 12px",
            cursor: "pointer",
            color: alertasOpen ? "var(--cy)" : "var(--gr3)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 16 }}>🔔</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            Alertas
            {alertas.filter(a => a.tipo === "urgente" && !alertasLeidas.includes(a.id) && !alertasOcultas.includes(a.id)).length > 0 && (
              <span style={{ fontSize: 10, color: "#ff5566" }}>Urgente</span>
            )}
          </span>
          {alertas.filter(a => !alertasLeidas.includes(a.id) && !alertasOcultas.includes(a.id)).length > 0 && (
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -4,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#ff5566",
                fontSize: 9,
                fontWeight: 700,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {alertas.filter(a => !alertasLeidas.includes(a.id) && !alertasOcultas.includes(a.id)).length}
            </span>
          )}
        </button>
      )}
    </>
  );
}
