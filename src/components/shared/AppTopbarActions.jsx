import { Btn } from "../../lib/ui/components";

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
      {curEmp && (
        <button
          onClick={() => {
            setSystemOpen(!systemOpen);
            setAlertasOpen(false);
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
          onClick={() => setAlertasOpen(!alertasOpen)}
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
