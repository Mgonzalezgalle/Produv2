import { useState } from "react";
import { requestConfirm } from "../../lib/ui/confirmService";

export function ListasEditor({ listas, saveListas, defaultListas }) {
  const mergeListValues = (base = {}, overrides = {}) => {
    const keys = new Set([...Object.keys(base || {}), ...Object.keys(overrides || {})]);
    const next = {};
    keys.forEach(key => {
      const baseArr = Array.isArray(base?.[key]) ? base[key] : [];
      const overrideArr = Array.isArray(overrides?.[key]) ? overrides[key] : [];
      next[key] = [...new Set([...baseArr, ...overrideArr].filter(v => String(v || "").trim()))];
    });
    return next;
  };

  const L = mergeListValues(defaultListas, listas || {});
  const [active, setActive] = useState("tiposPro");
  const [newVal, setNewVal] = useState("");

  const GROUPS = [
    { key: "tiposPro", label: "Tipos de Proyecto" },
    { key: "estadosPro", label: "Estados de Proyecto" },
    { key: "tiposPg", label: "Tipos de Producción" },
    { key: "estadosPg", label: "Estados de Producción" },
    { key: "freqsPg", label: "Frecuencias de Producción" },
    { key: "estadosEp", label: "Estados de Episodio" },
    { key: "tiposAus", label: "Tipos de Auspiciador" },
    { key: "frecPagoAus", label: "Frecuencias de Pago" },
    { key: "estadosAus", label: "Estados de Auspiciador" },
    { key: "tiposCt", label: "Tipos de Contrato" },
    { key: "estadosCt", label: "Estados de Contrato" },
    { key: "catMov", label: "Categorías de Movimientos" },
    { key: "industriasCli", label: "Industrias de Clientes" },
    { key: "estadosCamp", label: "Estados de Campaña" },
    { key: "plataformasContenido", label: "Plataformas de Contenido" },
    { key: "formatosPieza", label: "Formatos de Pieza" },
    { key: "estadosPieza", label: "Estados de Pieza" },
    { key: "areasCrew", label: "Áreas de Crew" },
    { key: "rolesCrew", label: "Roles de Crew" },
    { key: "tiposPres", label: "Tipos de Presupuesto" },
    { key: "estadosPres", label: "Estados de Presupuesto" },
    { key: "monedas", label: "Monedas" },
    { key: "impuestos", label: "Impuestos" },
    { key: "estadosFact", label: "Estados de Facturación" },
    { key: "tiposEntidadFact", label: "Tipos de Entidad Factura" },
    { key: "tiposDocPagar", label: "Tipos de Documento por Pagar" },
    { key: "catActivos", label: "Categorías de Activos" },
    { key: "estadosActivos", label: "Estados de Activos" },
    { key: "prioridadesTarea", label: "Prioridades de Tarea" },
    { key: "estadosTarea", label: "Estados de Tarea" },
  ];

  const items = L[active] || [];
  const persistLists = next => saveListas(mergeListValues(defaultListas, next || {}));

  const addItem = () => {
    if (!newVal.trim() || items.includes(newVal.trim())) return;
    persistLists({ ...L, [active]: [...items, newVal.trim()] });
    setNewVal("");
  };

  const delItem = val => persistLists({ ...L, [active]: items.filter(x => x !== val) });

  const moveItem = (val, dir) => {
    const arr = [...items];
    const i = arr.indexOf(val);
    if (dir === -1 && i === 0) return;
    if (dir === 1 && i === arr.length - 1) return;
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    persistLists({ ...L, [active]: arr });
  };

  const resetGroup = async () => {
    const confirmed = await requestConfirm({
      title: "Restaurar lista",
      message: "¿Restaurar valores por defecto para esta lista?",
      confirmLabel: "Restaurar",
    });
    if (!confirmed) return;
    persistLists({ ...L, [active]: defaultListas[active] });
  };

  return (
    <div>
      <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 16 }}>
        Administra las opciones que aparecen en los formularios. Los cambios se aplican de inmediato.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16, alignItems: "start" }}>
        <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 8, overflow: "hidden" }}>
          {GROUPS.map(g => (
            <div key={g.key} onClick={() => { setActive(g.key); setNewVal(""); }}
              style={{ padding: "11px 14px", cursor: "pointer", fontSize: 12, fontWeight: active === g.key ? 700 : 400, color: active === g.key ? "var(--cy)" : "var(--gr3)", background: active === g.key ? "var(--cg)" : "transparent", borderLeft: active === g.key ? "3px solid var(--cy)" : "3px solid transparent", borderBottom: "1px solid var(--bdr)" }}>
              {g.label}
              <span style={{ float: "right", background: "var(--bdr2)", borderRadius: 20, padding: "1px 7px", fontSize: 10, color: "var(--gr2)", fontFamily: "var(--fm)" }}>{(L[g.key] || []).length}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700 }}>{GROUPS.find(g => g.key === active)?.label}</div>
            <button onClick={resetGroup} style={{ fontSize: 11, color: "var(--gr2)", background: "transparent", border: "1px solid var(--bdr2)", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>↺ Restaurar defaults</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input value={newVal} onChange={e => setNewVal(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()} placeholder="Agregar nueva opción..." style={{ width: "100%", padding: "9px 12px", background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 6, color: "var(--wh)", fontFamily: "var(--fb)", fontSize: 13, outline: "none", flex: 1 }}/>
            <button onClick={addItem} style={{ padding: "9px 16px", borderRadius: 6, border: "none", background: "var(--cy)", color: "var(--bg)", cursor: "pointer", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>+ Agregar</button>
          </div>
          <div style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 8, overflow: "hidden" }}>
            {items.length > 0 ? items.map((val, i) => (
              <div key={val} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", borderBottom: i < items.length - 1 ? "1px solid var(--bdr)" : "none", background: "transparent" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <button onClick={() => moveItem(val, -1)} disabled={i === 0} style={{ background: "none", border: "none", color: i === 0 ? "var(--bdr2)" : "var(--gr2)", cursor: i === 0 ? "default" : "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
                  <button onClick={() => moveItem(val, 1)} disabled={i === items.length - 1} style={{ background: "none", border: "none", color: i === items.length - 1 ? "var(--bdr2)" : "var(--gr2)", cursor: i === items.length - 1 ? "default" : "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
                </div>
                <span style={{ flex: 1, fontSize: 13, color: "var(--wh)" }}>{val}</span>
                <button onClick={() => delItem(val)} style={{ background: "none", border: "1px solid #ff556625", borderRadius: 4, color: "var(--red)", cursor: "pointer", fontSize: 10, fontWeight: 600, padding: "2px 8px" }}>✕</button>
              </div>
            )) : (
              <div style={{ padding: 20, textAlign: "center", color: "var(--gr2)", fontSize: 12 }}>Sin opciones. Agrega la primera arriba.</div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--gr)", marginTop: 8 }}>{items.length} opciones · Los cambios se guardan automáticamente</div>
        </div>
      </div>
    </div>
  );
}
