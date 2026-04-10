import React, { useEffect, useRef, useState } from "react";
import { Btn, Card, Empty, GBtn, ModuleHeader } from "../../lib/ui/components";

export function ViewTareas({
  empresa,
  user,
  tareas,
  producciones,
  programas,
  piezas,
  crmOpps,
  crew,
  openM,
  canDo,
  setTareas,
  TareaCard,
  COLS_TAREAS,
  normalizeTaskAssignees,
  getAssignedIds,
}) {
  const empId = empresa?.id;
  const canManageTasks = !!(canDo && canDo("tareas"));
  const [filtro, setFiltro] = useState("mis");
  const [filtroRef, setFiltroRef] = useState("");
  const [dragId, setDragId] = useState(null);
  const [dropCol, setDropCol] = useState("");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth <= 768 : false);
  const [mobileCol, setMobileCol] = useState("Pendiente");
  const dragIdRef = useRef(null);
  const safeTareas = Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object") : [];
  const normalizedTareas = safeTareas.map(normalizeTaskAssignees);

  useEffect(() => {
    const onResize = () => setIsMobile(typeof window !== "undefined" ? window.innerWidth <= 768 : false);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const misTareas = normalizedTareas.filter(t => t.empId === empId);
  const tareasVis = filtro === "mis"
    ? misTareas.filter(t => getAssignedIds(t).includes(user?.id) || !getAssignedIds(t).length)
    : misTareas;
  const tareasFilt = filtroRef
    ? tareasVis.filter(t => `${t.refTipo || ""}:${t.refId || ""}` === filtroRef)
    : tareasVis;

  const porColumna = col => tareasFilt.filter(t => (t.estado || "Pendiente") === col);

  const changeEstado = async (id, nuevoEstado) => {
    if (!canManageTasks) return;
    const next = normalizedTareas.map(t => String(t.id) === String(id) ? { ...t, estado: nuevoEstado } : t);
    await setTareas(next);
  };

  const handleDrop = async (event, nuevoEstado) => {
    const droppedId = event?.dataTransfer?.getData("text/plain") || dragIdRef.current || dragId;
    if (!droppedId) return;
    await changeEstado(droppedId, nuevoEstado);
    setDragId(null);
    dragIdRef.current = null;
    setDropCol("");
  };

  const deleteTarea = id => {
    if (!canManageTasks) return;
    if (!confirm("¿Eliminar tarea?")) return;
    setTareas(normalizedTareas.filter(t => t.id !== id));
  };

  const colColors = { Pendiente: "var(--bdr2)", "En Progreso": "#60a5fa", "En Revisión": "#fbbf24", Completada: "#4ade80" };
  const mobileItems = porColumna(mobileCol);

  return <div>
    <ModuleHeader
      module="Tareas"
      title="Pipeline de Tareas"
      description="Organiza pendientes, responsables y estados de avance en un pipeline simple para el equipo."
      actions={<div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
        <div style={{ display: "flex", background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 8, overflow: "hidden" }}>
          {[["mis", "Mis Tareas"], ["todas", "Todas"]].map(([v, l]) => (
            <button key={v} onClick={() => setFiltro(v)} style={{ padding: "7px 14px", border: "none", background: filtro === v ? "var(--cy)" : "transparent", color: filtro === v ? "var(--bg)" : "var(--gr2)", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: ".15s" }}>{l}</button>
          ))}
        </div>
        <select value={filtroRef} onChange={e => setFiltroRef(e.target.value)} style={{ padding: "7px 12px", background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 8, color: "var(--gr3)", fontSize: 12, cursor: "pointer", minWidth: isMobile ? 0 : 200, flex: isMobile ? 1 : "initial" }}>
          <option value="">Todos los vínculos</option>
          <optgroup label="Proyectos">{(producciones || []).filter(p => p.empId === empId).map(p => <option key={p.id} value={`pro:${p.id}`}>{p.nom}</option>)}</optgroup>
          <optgroup label="Producciones">{(programas || []).filter(p => p.empId === empId).map(p => <option key={p.id} value={`pg:${p.id}`}>{p.nom}</option>)}</optgroup>
          <optgroup label="Contenidos">{(piezas || []).filter(p => p.empId === empId).map(p => <option key={p.id} value={`pz:${p.id}`}>{p.nom}</option>)}</optgroup>
          <optgroup label="Crew">{(crew || []).filter(c => c.empId === empId).map(c => <option key={c.id} value={`crew:${c.id}`}>{c.nom}</option>)}</optgroup>
        </select>
        {canManageTasks && <Btn onClick={() => openM("tarea", {})}>+ Nueva Tarea</Btn>}
      </div>}
    />

    {isMobile ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginBottom: 16 }}>
        {COLS_TAREAS.map(col => {
          const count = porColumna(col).length;
          const active = mobileCol === col;
          return <button key={col} onClick={() => setMobileCol(col)} style={{ textAlign: "left", padding: "12px 12px", borderRadius: 12, border: `1px solid ${active ? colColors[col] : "var(--bdr2)"}`, background: active ? "color-mix(in srgb, var(--cy) 8%, transparent)" : "var(--sur)", cursor: "pointer" }}>
            <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 5 }}>{col}</div>
            <div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: active ? colColors[col] : "var(--wh)" }}>{count}</div>
          </button>;
        })}
      </div>
      <Card title={mobileCol} sub={`${mobileItems.length} tarea${mobileItems.length !== 1 ? "s" : ""}`} action={canManageTasks ? { label: "+ Tarea", fn: () => openM("tarea", { estado: mobileCol }) } : null}>
        {mobileItems.length === 0
          ? <Empty text="Sin tareas en este estado" sub="Cambia de estado o crea una tarea nueva." />
          : mobileItems.map(t => (
            <TareaCard key={t.id} tarea={t} producciones={producciones} programas={programas} piezas={piezas} oportunidades={crmOpps} crew={crew}
              onEdit={canManageTasks ? item => openM("tarea", item) : undefined}
              onDelete={deleteTarea}
              onChangeEstado={changeEstado}
              onOpen={canManageTasks ? item => openM("tarea", item) : undefined}
            />
          ))
        }
      </Card>
    </> : <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, alignItems: "start" }}>
      {COLS_TAREAS.map(col => {
        const items = porColumna(col);
        return (
          <div
            key={col}
            onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dropCol !== col) setDropCol(col); }}
            onDragLeave={() => setDropCol(prev => prev === col ? "" : prev)}
            onDrop={async e => { e.preventDefault(); await handleDrop(e, col); }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: dropCol === col ? "var(--cg)" : "var(--sur)", border: `1px solid ${dropCol === col ? "var(--cy)" : "var(--bdr2)"}`, borderRadius: 10, marginBottom: 12, borderTop: `3px solid ${colColors[col]}`, transition: ".12s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{col}</span>
                <span style={{ fontSize: 11, background: "var(--bdr2)", color: "var(--gr2)", padding: "1px 7px", borderRadius: 10, fontFamily: "var(--fm)", fontWeight: 600 }}>{items.length}</span>
              </div>
              {canManageTasks && <GBtn sm onClick={() => openM("tarea", { estado: col })}>+</GBtn>}
            </div>
            <div
              onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dropCol !== col) setDropCol(col); }}
              onDrop={async e => { e.preventDefault(); e.stopPropagation(); await handleDrop(e, col); }}
              style={{ minHeight: 80, padding: dropCol === col ? 6 : 0, borderRadius: 10, background: dropCol === col ? "var(--cg)" : "transparent", transition: ".12s" }}
            >
              {items.length === 0
                ? <div style={{ padding: 16, textAlign: "center", color: "var(--gr)", fontSize: 12, fontStyle: "italic", border: "1px dashed var(--bdr)", borderRadius: 10 }}>Sin tareas</div>
                : items.map(t => (
                  <div key={t.id} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dropCol !== col) setDropCol(col); }} onDrop={async e => { e.preventDefault(); e.stopPropagation(); await handleDrop(e, col); }}>
                    <TareaCard tarea={t} producciones={producciones} programas={programas} piezas={piezas} oportunidades={crmOpps} crew={crew}
                      onEdit={canManageTasks ? item => openM("tarea", item) : undefined}
                      onDelete={deleteTarea}
                      onChangeEstado={changeEstado}
                      onOpen={canManageTasks ? item => openM("tarea", item) : undefined}
                      draggable
                      onDragStart={(e, tarea) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(tarea.id || "")); setDragId(tarea.id); dragIdRef.current = tarea.id; }}
                      onDragEnd={() => { setDragId(null); dragIdRef.current = null; setDropCol(""); }}
                    />
                  </div>
                ))
              }
            </div>
          </div>
        );
      })}
    </div>}
  </div>;
}
