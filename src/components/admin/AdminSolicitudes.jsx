import { useEffect, useState } from "react";
import { Badge, Empty, GBtn } from "../../lib/ui/components";
import { requestConfirm } from "../../lib/ui/confirmService";

export function SolicitudesAdmin({ users, onSaveUsers, dbGet, dbSet, uid, sha256Hex }) {
  const [sols, setSols] = useState([]);

  useEffect(() => {
    dbGet("produ:solicitudes").then(v => setSols(v || []));
  }, [dbGet]);

  const aprobar = async s => {
    const pw = prompt(`Contraseña temporal para ${s.nombre}:`, "produ2024");
    if (!pw) return;
    const newUser = { id: uid(), name: s.nombre, email: s.email, passwordHash: await sha256Hex(pw), role: "productor", empId: "", active: true };
    onSaveUsers([...(users || []), newUser]);
    const upd = sols.map(x => x.id === s.id ? { ...x, estado: "aprobada" } : x);
    setSols(upd);
    await dbSet("produ:solicitudes", upd);
    alert(`✓ Usuario creado. Contraseña: ${pw}. Recuerda asignarle una empresa.`);
  };

  const rechazar = async s => {
    const confirmed = await requestConfirm({
      title: "Rechazar solicitud",
      message: `¿Rechazar solicitud de ${s.nombre}?`,
      confirmLabel: "Rechazar",
    });
    if (!confirmed) return;
    const upd = sols.map(x => x.id === s.id ? { ...x, estado: "rechazada" } : x);
    setSols(upd);
    await dbSet("produ:solicitudes", upd);
  };

  const pendientes = sols.filter(s => s.estado === "pendiente");

  return <div>
    <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 16 }}>
      {pendientes.length > 0 ? <span style={{ color: "#fbbf24", fontWeight: 600 }}>{pendientes.length} solicitud{pendientes.length !== 1 ? "es" : ""} pendiente{pendientes.length !== 1 ? "s" : ""}</span> : "Sin solicitudes pendientes"}
    </div>
    {sols.length === 0 && <Empty text="Aún no hay solicitudes de acceso" />}
    {sols.map(s => (
      <div key={s.id} style={{ background: "var(--sur)", border: `1px solid ${s.estado === "pendiente" ? "#fbbf2440" : s.estado === "aprobada" ? "#4ade8030" : "#ff556630"}`, borderRadius: 10, padding: 16, marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700 }}>{s.nombre}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 2 }}>✉ {s.email}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)" }}>🏢 {s.productora}</div>
            {s.mensaje && <div style={{ fontSize: 12, color: "var(--gr3)", marginTop: 4, fontStyle: "italic" }}>"{s.mensaje}"</div>}
            <div style={{ fontSize: 11, color: "var(--gr)", marginTop: 4 }}>Enviada: {s.fecha}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
            <Badge label={s.estado === "pendiente" ? "Pendiente" : s.estado === "aprobada" ? "Aprobada" : "Rechazada"} color={s.estado === "aprobada" ? "green" : s.estado === "rechazada" ? "red" : "yellow"} sm />
            {s.estado === "pendiente" && <>
              <GBtn sm onClick={() => aprobar(s)}>✓ Aprobar</GBtn>
              <GBtn sm onClick={() => rechazar(s)}>✕ Rechazar</GBtn>
            </>}
          </div>
        </div>
      </div>
    ))}
  </div>;
}
