import { useEffect, useState } from "react";
import { Badge } from "../../lib/ui/components";

export function SolicitudesPanel({ onAceptar, onRechazar, empresas, dbGet, fmtD, addons }) {
  const [sols, setSols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    dbGet("produ:solicitudes").then(v => {
      setSols(v || []);
      setLoading(false);
    });
  }, [dbGet]);

  const pendientes = sols.filter(s => s.estado === "pendiente");

  if (loading) {
    return <div style={{ padding: 20, color: "var(--gr2)" }}>Cargando...</div>;
  }

  if (!pendientes.length) {
    return <div style={{ padding: 20, textAlign: "center", color: "var(--gr2)" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
      <div style={{ fontSize: 14 }}>Sin solicitudes pendientes</div>
    </div>;
  }

  return <div>
    {feedback && <div style={{ padding: "12px 14px", marginBottom: 14, borderRadius: 12, border: `1px solid ${feedback.type === "error" ? "#ff556640" : "#22c55e35"}`, background: feedback.type === "error" ? "#ff556615" : "#22c55e12", color: feedback.type === "error" ? "var(--red)" : "#22c55e", fontSize: 12, lineHeight: 1.6 }}>
      {feedback.message}
    </div>}
    <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 16 }}>
      {pendientes.length} solicitud{pendientes.length !== 1 ? "es" : ""} pendiente{pendientes.length !== 1 ? "s" : ""}
    </div>
    {pendientes.map(sol => (
      <div key={sol.id} style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10, padding: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{sol.nom}</div>
            <div style={{ fontSize: 12, color: "var(--gr2)" }}>{sol.ema} · {sol.emp}</div>
            <div style={{ fontSize: 11, color: "var(--gr)", marginTop: 4 }}>
              {sol.tipo === "empresa"
                ? `Empresa solicitante · ${sol.customerType || "productora"} · ${fmtD(sol.fecha)}`
                : `Rol: ${sol.rol} · ${fmtD(sol.fecha)}`}
            </div>
            {sol.tel && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>Teléfono: {sol.tel}</div>}
            {sol.teamSize && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>Equipo: {sol.teamSize}</div>}
            {!!(sol.requestedModules || []).length && <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {(sol.requestedModules || []).map(mod => <Badge key={mod} label={addons?.[mod]?.label || mod} color="gray" sm />)}
            </div>}
            {sol.msg && <div style={{ fontSize: 12, color: "var(--gr3)", marginTop: 6, fontStyle: "italic" }}>"{sol.msg}"</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge label="Pendiente" color="yellow" sm />
            {sol.tipo === "empresa" && <Badge label="Empresa solicitante" color="cyan" sm />}
            {sol.referred && <Badge label="Referido" color="purple" sm />}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sol.tipo !== "empresa" && <div style={{ flex: 1, minWidth: 120 }}>
            <select defaultValue="" style={{ width: "100%", padding: "7px 10px", background: "var(--card)", border: "1px solid var(--bdr2)", borderRadius: 6, color: "var(--wh)", fontSize: 12 }} id={`emp-${sol.id}`}>
              <option value="">Asignar a empresa...</option>
              {(empresas || []).map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>}
          <button disabled={busyId === sol.id} onClick={async () => {
            const empId = document.getElementById(`emp-${sol.id}`)?.value || "";
            setBusyId(sol.id);
            try {
              const result = await onAceptar(sol, empId);
              if (result?.message) setFeedback({ type: result?.ok === false ? "error" : "success", message: result.message });
              if (result?.error) setFeedback({ type: "error", message: result.error });
              const next = await dbGet("produ:solicitudes");
              setSols(next || []);
            } finally {
              setBusyId("");
            }
          }} style={{ padding: "7px 16px", borderRadius: 6, border: "none", background: "#4ade80", color: "#ffffff", cursor: busyId === sol.id ? "wait" : "pointer", fontSize: 12, fontWeight: 700, opacity: busyId === sol.id ? 0.7 : 1 }}>{busyId === sol.id ? "Procesando..." : "✓ Aceptar"}</button>
          <button disabled={busyId === sol.id} onClick={async () => {
            setBusyId(sol.id);
            try {
              const result = await onRechazar(sol);
              if (result?.message) setFeedback({ type: result?.ok === false ? "error" : "success", message: result.message });
              if (result?.error) setFeedback({ type: "error", message: result.error });
              const next = await dbGet("produ:solicitudes");
              setSols(next || []);
            } finally {
              setBusyId("");
            }
          }} style={{ padding: "7px 16px", borderRadius: 6, border: "1px solid #ff556640", background: "transparent", color: "var(--red)", cursor: busyId === sol.id ? "wait" : "pointer", fontSize: 12, fontWeight: 700, opacity: busyId === sol.id ? 0.7 : 1 }}>✕ Rechazar</button>
        </div>
      </div>
    ))}
  </div>;
}
