import React, { useState } from "react";
import { ContactBtns } from "../shared/ContactButtons";
import {
  Badge,
  Btn,
  Card,
  DetHeader,
  DBtn,
  Empty,
  FilterSel,
  FSl,
  GBtn,
  KV,
  ModuleHeader,
  Modal,
  Paginator,
  SearchBar,
  Sep,
  Stat,
  Tabs,
  TD,
  TH,
  ViewModeToggle,
  XBtn,
} from "../../lib/ui/components";
import { DEFAULT_LISTAS, contractsForReference, hasAddon, today as helperToday, uid as helperUid } from "../../lib/utils/helpers";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function parseTarifa(t) {
  return parseInt(String(t || 0).replace(/[^0-9]/g, ""), 10) || 0;
}

function CrewTab({ crew, empId, asignados, onAdd, onRem, onHonorario, canEdit, ini, fmtM }) {
  const todos = (crew || []).filter(x => x.empId === empId);
  const asig = todos.filter(x => asignados.includes(x.id));
  const disp = todos.filter(x => !asignados.includes(x.id) && x.active !== false);
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    <Card title={`Crew Asignado (${asig.length})`}>
      {asig.length ? asig.map(m => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bdr)" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--cy),var(--cy2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--bg)", flexShrink: 0 }}>{ini(m.nom)}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{m.nom}</div><div style={{ fontSize: 11, color: "var(--gr2)" }}>{m.rol}{m.tarifa && m.tipo !== "interno" ? ` · ${fmtM(Number(String(m.tarifa).replace(/[^0-9]/g, "")))}` : ""}</div></div>
        {canEdit && onHonorario && m.tipo !== "interno" && m.tarifa && <button onClick={() => onHonorario(m)} title="Registrar honorario" style={{ background: "#4ade8018", border: "1px solid #4ade8040", borderRadius: 6, color: "#4ade80", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: "2px 8px", whiteSpace: "nowrap" }}>💰</button>}
        {canEdit && <XBtn onClick={() => onRem(m.id)} />}
      </div>) : <Empty text="Sin crew asignado" />}
    </Card>
    <Card title={`Disponibles (${disp.length})`}>
      {disp.map(m => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bdr)" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bdr)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--gr2)", flexShrink: 0 }}>{ini(m.nom)}</div>
        <div style={{ flex: 1 }}><div style={{ fontSize: 12, fontWeight: 600 }}>{m.nom}</div><div style={{ fontSize: 11, color: "var(--gr2)" }}>{m.rol}</div></div>
        {canEdit && <GBtn sm onClick={() => onAdd(m.id)}>+ Asignar</GBtn>}
      </div>)}
      {!disp.length && <Empty text="Sin crew disponible" />}
    </Card>
  </div>;
}

export function ViewPros({
  empresa, clientes, producciones, movimientos, navTo, openM, canDo, listas, setProducciones,
  useBal, fmtM, fmtD,
}) {
  const empId = empresa?.id;
  const canManageProjects = !!(canDo && canDo("producciones"));
  const bal = useBal(movimientos, empId);
  const [q, setQ] = useState("");
  const [fe, setFe] = useState("");
  const [ft, setFt] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [vista, setVista] = useState("list");
  const [pg, setPg] = useState(1);
  const PP = 10;
  const fd = (producciones || []).filter(p => p.empId === empId).filter(p => {
    const c = (clientes || []).find(x => x.id === p.cliId);
    return (p.nom.toLowerCase().includes(q.toLowerCase()) || (c && c.nom.toLowerCase().includes(q.toLowerCase()))) && (!fe || p.est === fe) && (!ft || p.tip === ft);
  }).sort((a, b) => {
    if (sortMode === "az") return String(a.nom || "").localeCompare(String(b.nom || ""));
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "oldest") return String(a.cr || a.ini || "").localeCompare(String(b.cr || b.ini || ""));
    return String(b.cr || b.ini || "").localeCompare(String(a.cr || a.ini || ""));
  });
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  return <div>
    <ModuleHeader
      module="Proyectos"
      title="Proyectos"
      description="Controla proyectos únicos, su estado operativo y el balance financiero asociado."
      actions={canManageProjects ? <Btn onClick={() => openM("pro", {})}>+ Nuevo Proyecto</Btn> : null}
    />
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar producción o cliente..." />
      <FilterSel value={fe} onChange={v => { setFe(v); setPg(1); }} options={listas?.estadosPro || DEFAULT_LISTAS.estadosPro} placeholder="Todo estados" />
      <FilterSel value={ft} onChange={v => { setFt(v); setPg(1); }} options={listas?.tiposPro || DEFAULT_LISTAS.tiposPro} placeholder="Todo tipos" />
      <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }, { value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }]} placeholder="Ordenar" />
      <ViewModeToggle value={vista} onChange={setVista} />
    </div>
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}</div>
      <FSl value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} style={{ maxWidth: 200 }}>
        <option value="">Cambiar estado...</option>
        {(listas?.estadosPro || DEFAULT_LISTAS.estadosPro).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={() => {
        if (!canManageProjects) return;
        if (!bulkEstado) return;
        setProducciones((producciones || []).map(item => selectedIds.includes(item.id) ? { ...item, est: bulkEstado } : item));
        setSelectedIds([]);
      }}>Aplicar estado</GBtn>
      {canManageProjects && <DBtn sm onClick={() => {
        if (!confirm(`¿Eliminar ${selectedIds.length} proyecto${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`)) return;
        setProducciones((producciones || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}>Eliminar seleccionados</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(p => {
          const c = (clientes || []).find(x => x.id === p.cliId);
          const b = bal(p.id);
          return <div key={p.id} onClick={() => navTo("pro-det", p.id)} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18, cursor: "pointer", transition: ".15s", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{p.nom}</div>
                <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{c?.nom || "Sin cliente"}</div>
              </div>
              <Badge label={p.est} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <Badge label={p.tip || "Sin tipo"} color="gray" sm />
              {p.ini && <Badge label={`Ini ${fmtD(p.ini)}`} color="cyan" sm />}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
              <div><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Ingresos</div><div style={{ fontFamily: "var(--fm)", fontSize: 14, color: "#00e08a", marginTop: 4 }}>{fmtM(b.i)}</div></div>
              <div><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Balance</div><div style={{ fontFamily: "var(--fm)", fontSize: 14, color: b.b >= 0 ? "#00e08a" : "#ff5566", marginTop: 4 }}>{fmtM(b.b)}</div></div>
            </div>
            <div style={{ fontSize: 11, color: "var(--gr2)", display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
              <span>{p.fin ? `Entrega ${fmtD(p.fin)}` : "Sin entrega"}</span>
              <span style={{ color: "var(--cy)", fontWeight: 700 }}>Ver →</span>
            </div>
          </div>;
        })}
      </div>
      {!fd.length && <Empty text="Sin proyectos" sub="Crea el primero con el botón superior" />}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    </> : <Card>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleAll(e.target.checked); }} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Proyecto</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Estado</TH><TH onClick={() => setSortMode(sortMode === "oldest" ? "recent" : "oldest")} active={sortMode === "recent" || sortMode === "oldest"} dir={sortMode === "recent" ? "desc" : "asc"}>Inicio</TH><TH>Entrega</TH><TH>Ingresos</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg - 1) * PP, pg * PP).map(p => { const c = (clientes || []).find(x => x.id === p.cliId); const b = bal(p.id); return <tr key={p.id} onClick={e => { if (e.target.closest("input,button,select,label,a")) return; navTo("pro-det", p.id); }}>
            <TD onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(p.id)} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleSelected(p.id); }} /></TD>
            <TD bold>{p.nom}</TD><TD>{c ? c.nom : "—"}</TD><TD><Badge label={p.tip} color="gray" sm /></TD><TD><Badge label={p.est} /></TD>
            <TD mono style={{ fontSize: 11 }}>{p.ini ? fmtD(p.ini) : "—"}</TD>
            <TD mono style={{ fontSize: 11 }}>{p.fin ? fmtD(p.fin) : "—"}</TD>
            <TD style={{ color: "#00e08a", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(b.i)}</TD>
            <TD style={{ color: b.b >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(b.b)}</TD>
            <TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("pro-det", p.id); }}>Ver →</GBtn></TD>
          </tr>; })}
          {!fd.length && <tr><td colSpan={10}><Empty text="Sin proyectos" sub="Crea el primero con el botón superior" /></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    </Card>}
  </div>;
}

export function ViewProDet(props) {
  const {
    id, empresa, user, clientes, producciones, programas, piezas, contratos, movimientos, crew, eventos, tareas, navTo, openM, canDo, cSave, cDel, saveMov, delMov, setProducciones, setMovimientos, setTareas, ntf,
    useBal, fmtM, fmtD, ini, ComentariosBlock, MovBlock, MiniCal, TareasContexto, exportMovCSV, exportMovPDF, normalizeTaskAssignees, getAssignedIds,
    today = helperToday, uid = helperUid,
  } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const canManageProjects = !!(canDo && canDo("producciones"));
  const canManageMoves = !!(canDo && canDo("movimientos"));
  const canManageCalendar = !!(canDo && canDo("calendario"));
  const bal = useBal(movimientos, empId);
  const p = (producciones || []).find(x => x.id === id); if (!p) return <Empty text="No encontrado" />;
  const c = (clientes || []).find(x => x.id === p.cliId);
  const contratosRel = contractsForReference(contratos || [], p.cliId, "produccion", id);
  const b = bal(id); const mv = (movimientos || []).filter(m => m.eid === id);
  const pCrew = (crew || []).filter(x => x.empId === empId && (p.crewIds || []).includes(x.id));
  const cContacto = (c?.contactos || [])[0];
  const [tab, setTab] = useState(0);
  const addCrew = async crId => { if (!canManageProjects) return; const next = (producciones || []).map(x => x.id === id ? { ...x, crewIds: [...(x.crewIds || []), crId] } : x); await setProducciones(next); };
  const remCrew = async crId => { if (!canManageProjects) return; const next = (producciones || []).map(x => x.id === id ? { ...x, crewIds: (x.crewIds || []).filter(i => i !== crId) } : x); await setProducciones(next); };
  return <div>
    <DetHeader title={p.nom} tag={p.tip} badges={[<Badge key={0} label={p.est} />]} meta={[c && `Cliente: ${c.nom}`, p.ini && `Inicio: ${fmtD(p.ini)}`, p.fin && `Entrega: ${fmtD(p.fin)}`].filter(Boolean)} des={p.des}
      actions={canManageProjects && <><GBtn onClick={() => openM("pro", p)}>✏ Editar</GBtn><DBtn onClick={() => { if (!canManageProjects) return; if (!confirm("¿Eliminar?")) return; cDel(producciones, setProducciones, id, () => navTo("producciones"), "Proyecto eliminado"); }}>🗑</DBtn></>} />
    {cContacto && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--sur)", border: "1px solid var(--bdr)", borderRadius: 8, marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--gr2)" }}>Contacto: <b style={{ color: "var(--wh)" }}>{cContacto.nom}</b> {cContacto.car ? `· ${cContacto.car}` : ""}</span>
      <ContactBtns tel={cContacto.tel} ema={cContacto.ema} nombre={cContacto.nom} origen={empresa?.nombre || "tu empresa"} mensaje={`Hola ${cContacto.nom}, te contactamos desde ${empresa?.nombre || "tu empresa"}.`} />
    </div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Ingresos" value={fmtM(b.i)} sub={`${mv.filter(m => m.tipo === "ingreso").length} reg.`} accent="#00e08a" vc="#00e08a" />
      <Stat label="Gastos" value={fmtM(b.g)} sub={`${mv.filter(m => m.tipo === "gasto").length} reg.`} accent="#ff5566" vc="#ff5566" />
      <Stat label="Balance" value={fmtM(b.b)} accent={b.b >= 0 ? "#00e08a" : "#ff5566"} vc={b.b >= 0 ? "#00e08a" : "#ff5566"} />
      <Stat label="Crew" value={pCrew.length} sub="asignados" accent="var(--cy)" vc="var(--cy)" />
    </div>
    <Tabs tabs={["Comentarios", "Ingresos", "Gastos", "Crew", "Fechas", "Contratos", ...(tasksEnabled ? ["Tareas"] : [])]} active={tab} onChange={setTab} />
    {(tab === 1 || tab === 2) && <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <GBtn sm onClick={() => exportMovCSV(mv.filter(m => tab === 1 ? m.tipo === "ingreso" : m.tipo === "gasto"), p.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={() => exportMovPDF(mv.filter(m => tab === 1 ? m.tipo === "ingreso" : m.tipo === "gasto"), p.nom, empresa, tab === 1 ? "Ingresos" : "Gastos")}>⬇ PDF</GBtn>
    </div>}
    {tab === 0 && <ComentariosBlock items={p.comentarios || []} onSave={async comentarios => { if (!canManageProjects) return; await setProducciones((producciones || []).map(x => x.id === id ? { ...x, comentarios } : x)); }} onCreateTask={tasksEnabled ? async comment => { if (!canManageProjects) return; const task = normalizeTaskAssignees({ id: uid(), empId, cr: today(), titulo: comment.text?.split("\n")[0]?.slice(0, 80) || `Seguimiento ${p.nom}`, desc: comment.text || "", estado: "Pendiente", prioridad: "Media", fechaLimite: "", refTipo: "pro", refId: id, assignedIds: getAssignedIds(comment), asignadoA: getAssignedIds(comment)[0] || "" }); await setTareas([...(Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object") : []), task]); ntf && ntf("Comentario guardado y tarea creada ✓"); } : null} crewOptions={pCrew} canEdit={canManageProjects} title="Comentarios del Proyecto" empresa={empresa} currentUser={user} />}
    {tab === 1 && <MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pro" onAdd={(eid, et, tipo) => openM("mov", { eid, et, tipo })} onDel={delMov} canEdit={canDo && canDo("movimientos")} />}
    {tab === 2 && <MovBlock movimientos={mv} tipo="gasto" eid={id} etype="pro" onAdd={(eid, et, tipo) => openM("mov", { eid, et, tipo })} onDel={delMov} canEdit={canDo && canDo("movimientos")} />}
    {tab === 3 && <CrewTab crew={crew || []} empId={empId} asignados={p.crewIds || []} onAdd={addCrew} onRem={remCrew} canEdit={canManageProjects} onHonorario={m => { if (!canManageMoves) return; saveMov({ eid: id, et: "pro", tipo: "gasto", cat: "Honorarios", des: `Honorarios ${m.nom}`, mon: parseTarifa(m.tarifa), fec: today() }); }} ini={ini} fmtM={fmtM} />}
    {tab === 4 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
      <Card title="Fechas Base del Proyecto" action={canDo && canDo("producciones") ? { label: "✏ Editar Fechas", fn: () => openM("pro", p) } : null}>
        <KV label="Inicio" value={p.ini ? fmtD(p.ini) : "Por definir"} />
        <KV label="Entrega" value={p.fin ? fmtD(p.fin) : "Por definir"} />
      </Card>
      <MiniCal refId={id} eventos={eventos || []} onAdd={() => openM("evento", { ref: id, refTipo: "produccion" })} onEdit={ev => openM("evento", ev)} onDel={async evId => { if (!canManageCalendar) return; await cSave((eventos || []).filter(x => x.id !== evId), () => { }, {}); }} canEdit={canManageCalendar} titulo={p.nom} />
    </div>}
    {tab === 5 && <Card title="Contratos Relacionados" action={canDo && canDo("contratos") ? { label: "+ Nuevo", fn: () => openM("ct", { cliId: p.cliId, pids: [`p:${id}`], tip: "Producción", nom: `Contrato ${p.nom}` }) } : null}>
      {contratosRel.map(ct => <div key={ct.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}><span style={{ fontSize: 18 }}>📄</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{ct.nom}</div><div style={{ fontSize: 11, color: "var(--gr2)" }}>{ct.tip}{ct.vig ? ` · ${fmtD(ct.vig)}` : ""}</div></div><Badge label={ct.est} />{ct.mon && <span style={{ fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(ct.mon)}</span>}</div>)}
      {!contratosRel.length && <Empty text="Sin contratos relacionados" />}
    </Card>}
    {tasksEnabled && tab === 6 && <TareasContexto title="Tareas del Proyecto" refTipo="pro" refId={id} tareas={Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object" && t.empId === empId) : []} producciones={producciones} programas={programas} piezas={piezas} crew={crew} openM={openM} setTareas={setTareas} canEdit={canDo && canDo("producciones")} />}
  </div>;
}

export function ViewPgs({
  empresa, programas, episodios, auspiciadores, movimientos, navTo, openM, canDo, listas, setProgramas,
  useBal, fmtM,
}) {
  const empId = empresa?.id;
  const canManagePrograms = !!(canDo && canDo("programas"));
  const bal = useBal(movimientos, empId);
  const [q, setQ] = useState("");
  const [fe, setFe] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [vista, setVista] = useState("cards");
  const [pg, setPg] = useState(1);
  const PP = 9;
  const fd = (programas || []).filter(x => x.empId === empId).filter(p => (p.nom.toLowerCase().includes(q.toLowerCase()) || p.tip.toLowerCase().includes(q.toLowerCase())) && (!fe || p.est === fe)).sort((a, b) => {
    if (sortMode === "az") return String(a.nom || "").localeCompare(String(b.nom || ""));
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "oldest") return String(a.cr || "").localeCompare(String(b.cr || ""));
    return String(b.cr || "").localeCompare(String(a.cr || ""));
  });
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  return <div>
    <ModuleHeader
      module="Producciones"
      title="Producciones"
      description="Supervisa producciones recurrentes, episodios, auspicios y balance operativo desde una sola vista."
      actions={canManagePrograms ? <Btn onClick={() => openM("pg", {})}>+ Nueva Producción</Btn> : null}
    />
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar producción..." />
      <FilterSel value={fe} onChange={v => { setFe(v); setPg(1); }} options={listas?.estadosPg || DEFAULT_LISTAS.estadosPg} placeholder="Todo estados" />
      <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }, { value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }]} placeholder="Ordenar" />
      <ViewModeToggle value={vista} onChange={setVista} />
    </div>
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionada{selectedIds.length === 1 ? "" : "s"}</div>
      <FSl value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} style={{ maxWidth: 200 }}>
        <option value="">Cambiar estado...</option>
        {(listas?.estadosPg || DEFAULT_LISTAS.estadosPg).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={() => {
        if (!canManagePrograms) return;
        if (!bulkEstado) return;
        setProgramas((programas || []).map(item => selectedIds.includes(item.id) ? { ...item, est: bulkEstado } : item));
        setSelectedIds([]);
      }}>Aplicar estado</GBtn>
      {canManagePrograms && <DBtn sm onClick={() => {
        if (!confirm(`¿Eliminar ${selectedIds.length} producción${selectedIds.length === 1 ? "" : "es"} seleccionada${selectedIds.length === 1 ? "" : "s"}?`)) return;
        setProgramas((programas || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}>Eliminar seleccionadas</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    {vista === "cards" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
      {fd.slice((pg - 1) * PP, pg * PP).map(pg_ => {
        const eps = (episodios || []).filter(e => e.pgId === pg_.id);
        const pub = eps.filter(e => e.estado === "Publicado").length;
        const aus = (auspiciadores || []).filter(a => (a.pids || []).includes(pg_.id)).length;
        const b = bal(pg_.id);
        return <div key={pg_.id} onClick={() => navTo("pg-det", pg_.id)} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 10, padding: 20, cursor: "pointer", position: "relative", overflow: "hidden", transition: ".15s" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,var(--cy),var(--cy2))" }} />
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--cy)", marginBottom: 8, fontWeight: 600 }}>{pg_.tip}</div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800, marginBottom: 5, lineHeight: 1.2 }}>{pg_.nom}</div>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 10 }}>{pg_.can || "Sin canal"} · {pg_.fre || ""}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}><Badge label={pg_.est} />{pg_.totalEp && <Badge label={`${pg_.totalEp} ep.`} color="gray" />}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
            {[["Total", eps.length, "var(--wh)"], ["Pub.", pub, "#00e08a"], ["Aus.", aus, "var(--cy)"]].map(([l, v, c]) => <div key={l} style={{ textAlign: "center" }}><div style={{ fontFamily: "var(--fm)", fontSize: 18, fontWeight: 700, color: c }}>{v}</div><div style={{ fontSize: 9, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>{l}</div></div>)}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginTop: 10 }}>
            <span style={{ color: "var(--gr2)" }}>Balance</span>
            <span style={{ color: b.b >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)" }}>{fmtM(b.b)}</span>
          </div>
        </div>;
      })}
    </div> : <Card>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleAll(e.target.checked); }} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Producción</TH><TH>Canal</TH><TH>Estado</TH><TH>Episodios</TH><TH>Publicados</TH><TH>Auspiciadores</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg - 1) * PP, pg * PP).map(pg_ => { const eps = (episodios || []).filter(e => e.pgId === pg_.id); const pub = eps.filter(e => e.estado === "Publicado").length; const aus = (auspiciadores || []).filter(a => (a.pids || []).includes(pg_.id)).length; const b = bal(pg_.id); return <tr key={pg_.id} onClick={e => { if (e.target.closest("input,button,select,label,a")) return; navTo("pg-det", pg_.id); }}>
            <TD onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(pg_.id)} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleSelected(pg_.id); }} /></TD>
            <TD bold>{pg_.nom}</TD>
            <TD>{[pg_.can, pg_.fre].filter(Boolean).join(" · ") || "—"}</TD>
            <TD><Badge label={pg_.est} /></TD>
            <TD mono style={{ fontSize: 11 }}>{eps.length}</TD>
            <TD mono style={{ fontSize: 11, color: "#00e08a" }}>{pub}</TD>
            <TD mono style={{ fontSize: 11 }}>{aus}</TD>
            <TD style={{ color: b.b >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(b.b)}</TD>
            <TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("pg-det", pg_.id); }}>Ver →</GBtn></TD>
          </tr>; })}
          {!fd.length && <tr><td colSpan={9}><Empty text="Sin producciones" sub="Crea la primera con el botón superior" /></td></tr>}
        </tbody>
      </table></div>
    </Card>}
    {!fd.length && vista === "cards" && <Empty text="Sin producciones" sub="Crea la primera con el botón superior" />}
    <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
  </div>;
}

export function ViewContenidos({
  empresa, clientes, piezas, movimientos, navTo, openM, canDo, setPiezas,
  useBal, fmtM, countCampaignPieces,
}) {
  const empId = empresa?.id;
  const canManageContent = !!(canDo && canDo("contenidos"));
  const bal = useBal(movimientos, empId);
  const [q, setQ] = useState("");
  const [fe, setFe] = useState("");
  const [fm, setFm] = useState("");
  const [fp, setFp] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [vista, setVista] = useState("list");
  const [pg, setPg] = useState(1);
  const PP = 10;
  const estadosCamp = DEFAULT_LISTAS.estadosCamp || [];
  const plataformas = DEFAULT_LISTAS.plataformasContenido || [];
  const fd = (piezas || []).filter(x => x.empId === empId).filter(p => {
    const c = (clientes || []).find(x => x.id === p.cliId);
    return (p.nom || "").toLowerCase().includes(q.toLowerCase()) || ((c?.nom || "").toLowerCase().includes(q.toLowerCase()));
  }).filter(p => (!fe || p.est === fe) && (!fm || p.mes === fm) && (!fp || p.plataforma === fp)).sort((a, b) => {
    if (sortMode === "az") return String(a.nom || "").localeCompare(String(b.nom || ""));
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "oldest") return String(a.cr || a.ini || "").localeCompare(String(b.cr || b.ini || ""));
    return String(b.cr || b.ini || "").localeCompare(String(a.cr || a.ini || ""));
  });
  const totalPlanned = fd.reduce((s, p) => s + Number(p.plannedPieces || 0), 0);
  const totalCreated = fd.reduce((s, p) => s + countCampaignPieces(p), 0);
  const totalPublished = fd.reduce((s, p) => s + (p.piezas || []).filter(pc => pc.est === "Publicado").length, 0);
  const totalScheduled = fd.reduce((s, p) => s + (p.piezas || []).filter(pc => pc.est === "Programado").length, 0);
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  return <div>
    <ModuleHeader
      module="Contenidos"
      title="Contenidos"
      description="Organiza campañas, piezas y calendario editorial para mantener bajo control la operación digital."
      actions={canManageContent ? <Btn onClick={() => openM("contenido", {})}>+ Nueva Campaña</Btn> : null}
    />
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar campaña o cliente..." />
      <FilterSel value={fe} onChange={v => { setFe(v); setPg(1); }} options={estadosCamp} placeholder="Todo estados" />
      <FilterSel value={fm} onChange={v => { setFm(v); setPg(1); }} options={MESES} placeholder="Todos los meses" />
      <FilterSel value={fp} onChange={v => { setFp(v); setPg(1); }} options={plataformas} placeholder="Todas las plataformas" />
      <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }, { value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }]} placeholder="Ordenar" />
      <ViewModeToggle value={vista} onChange={setVista} />
    </div>
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionada{selectedIds.length === 1 ? "" : "s"}</div>
      <FSl value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} style={{ maxWidth: 180 }}>
        <option value="">Cambiar estado...</option>
        {estadosCamp.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={() => {
        if (!canManageContent) return;
        if (!bulkEstado) return;
        setPiezas((piezas || []).map(item => selectedIds.includes(item.id) ? { ...item, est: bulkEstado } : item));
        setSelectedIds([]);
      }}>Aplicar estado</GBtn>
      <DBtn sm onClick={() => {
        if (!canDo || !canDo("contenidos")) return;
        if (!confirm(`¿Eliminar ${selectedIds.length} campaña${selectedIds.length === 1 ? "" : "s"} seleccionada${selectedIds.length === 1 ? "" : "s"}?`)) return;
        setPiezas((piezas || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}>Eliminar seleccionadas</DBtn>
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
      <Stat label="Planificadas" value={totalPlanned} accent="var(--cy)" vc="var(--cy)" />
      <Stat label="Creadas" value={totalCreated} accent="#7c5cff" vc="#7c5cff" />
      <Stat label="Programadas" value={totalScheduled} accent="#38bdf8" vc="#38bdf8" />
      <Stat label="Publicadas" value={totalPublished} accent="#00e08a" vc="#00e08a" />
    </div>
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(pz => { const c = (clientes || []).find(x => x.id === pz.cliId); const b = bal(pz.id); return <div key={pz.id} onClick={() => navTo("contenido-det", pz.id)} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{pz.nom}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{c?.nom || "Sin cliente"}</div>
            </div>
            <Badge label={pz.est || "Planificada"} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Badge label={[pz.mes, pz.ano].filter(Boolean).join(" ") || "Sin mes"} color="cyan" sm />
            <Badge label={pz.plataforma || "Multi-plataforma"} color="gray" sm />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
            <div><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Piezas</div><div style={{ fontFamily: "var(--fm)", fontSize: 14, marginTop: 4 }}>{countCampaignPieces(pz)}/{pz.plannedPieces || countCampaignPieces(pz)}</div></div>
            <div><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Balance</div><div style={{ fontFamily: "var(--fm)", fontSize: 14, color: b.b >= 0 ? "#00e08a" : "#ff5566", marginTop: 4 }}>{fmtM(b.b)}</div></div>
          </div>
        </div>; })}
      </div>
      {!fd.length && <Empty text="Sin campañas" sub="Crea la primera con el botón superior" />}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    </> : <Card>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleAll(e.target.checked); }} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Campaña</TH><TH>Cliente</TH><TH>Mes</TH><TH>Piezas</TH><TH>Plataforma</TH><TH>Estado</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg - 1) * PP, pg * PP).map(pz => { const c = (clientes || []).find(x => x.id === pz.cliId); const b = bal(pz.id); return <tr key={pz.id} onClick={e => { if (e.target.closest("input,button,select,label,a")) return; navTo("contenido-det", pz.id); }}>
            <TD onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(pz.id)} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleSelected(pz.id); }} /></TD>
            <TD bold>{pz.nom}</TD>
            <TD>{c?.nom || "—"}</TD>
            <TD>{[pz.mes, pz.ano].filter(Boolean).join(" ") || "—"}</TD>
            <TD><Badge label={`${countCampaignPieces(pz)}/${pz.plannedPieces || countCampaignPieces(pz)} piezas`} color="gray" sm /></TD>
            <TD><Badge label={pz.plataforma || "Multi-plataforma"} color="gray" sm /></TD>
            <TD><Badge label={pz.est || "Planificada"} /></TD>
            <TD style={{ color: b.b >= 0 ? "#00e08a" : "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(b.b)}</TD>
            <TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("contenido-det", pz.id); }}>Ver →</GBtn></TD>
          </tr>; })}
          {!fd.length && <tr><td colSpan={9}><Empty text="Sin campañas" sub="Crea la primera con el botón superior" /></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    </Card>}
  </div>;
}

export function ViewContenidoDet(props) {
  const {
    id, empresa, user, clientes, piezas, movimientos, crew, eventos, tareas, navTo, openM, canDo, cSave, cDel, saveMov, delMov, setPiezas, setMovimientos, setTareas, ntf, producciones, programas,
    useBal, fmtM, fmtD, countCampaignPieces, ComentariosBlock, MovBlock, MiniCal, TareasContexto, exportMovCSV, exportMovPDF, normalizeTaskAssignees, getAssignedIds, normalizeSocialPiece,
    today = helperToday, uid = helperUid,
  } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const canManageContent = !!(canDo && canDo("contenidos"));
  const canManageMoves = !!(canDo && canDo("movimientos"));
  const canManageCalendar = !!(canDo && canDo("calendario"));
  const bal = useBal(movimientos, empId);
  const pz = (piezas || []).find(x => x.id === id); if (!pz) return <Empty text="No encontrado" />;
  const cli = (clientes || []).find(x => x.id === pz.cliId);
  const b = bal(id); const mv = (movimientos || []).filter(m => m.eid === id);
  const pCrew = (crew || []).filter(x => x.empId === empId && (pz.crewIds || []).includes(x.id));
  const [tab, setTab] = useState(0);
  const [piezaQ, setPiezaQ] = useState("");
  const [piezaEstado, setPiezaEstado] = useState("");
  const [piezaResp, setPiezaResp] = useState("");
  const [piezaSort, setPiezaSort] = useState("name-asc");
  const [piezaDetailId, setPiezaDetailId] = useState("");
  const piezasCamp = (pz.piezas || []).filter(pc => (pc.nom || "").toLowerCase().includes(piezaQ.toLowerCase()) && (!piezaEstado || pc.est === piezaEstado));
  const piezasFiltradas = piezasCamp.filter(pc => (!piezaResp || pc.responsableId === piezaResp)).sort((a, b) => {
    if (piezaSort === "name-desc") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (piezaSort === "date-desc") return String(b.publishDate || b.fin || "").localeCompare(String(a.publishDate || a.fin || ""));
    if (piezaSort === "date-asc") return String(a.publishDate || a.fin || "").localeCompare(String(b.publishDate || b.fin || ""));
    if (piezaSort === "status-desc") return String(b.est || "").localeCompare(String(a.est || ""));
    if (piezaSort === "status-asc") return String(a.est || "").localeCompare(String(b.est || ""));
    return String(a.nom || "").localeCompare(String(b.nom || ""));
  });
  const piezasPub = (pz.piezas || []).filter(pc => pc.est === "Publicado").length;
  const piezasProgramadas = (pz.piezas || []).filter(pc => pc.est === "Programado").length;
  const piezasRevision = (pz.piezas || []).filter(pc => (pc.approval || "Pendiente") === "En revisión" || pc.est === "Correcciones").length;
  const piezasAprobadas = (pz.piezas || []).filter(pc => (pc.approval || "Pendiente") === "Aprobada").length;
  const crewMap = Object.fromEntries((crew || []).filter(c => c && c.id).map(c => [c.id, c]));
  const editorialPendientes = (pz.piezas || []).filter(pc => pc.publishDate && pc.publishDate >= today() && pc.est !== "Publicado").sort((a, b) => (a.publishDate || "").localeCompare(b.publishDate || ""));
  const editorialAtrasadas = (pz.piezas || []).filter(pc => pc.publishDate && pc.publishDate < today() && pc.est !== "Publicado").sort((a, b) => (a.publishDate || "").localeCompare(b.publishDate || ""));
  const editorialPublicadas = (pz.piezas || []).filter(pc => pc.publishedAt || pc.est === "Publicado").sort((a, b) => (b.publishedAt || b.publishDate || "").localeCompare(a.publishedAt || a.publishDate || ""));
  const addCrew = async crId => { if (!canManageContent) return; const next = (piezas || []).map(x => x.id === id ? { ...x, crewIds: [...(x.crewIds || []), crId] } : x); await setPiezas(next); };
  const remCrew = async crId => { if (!canManageContent) return; const next = (piezas || []).map(x => x.id === id ? { ...x, crewIds: (x.crewIds || []).filter(i => i !== crId) } : x); await setPiezas(next); };
  const savePiece = async piece => {
    if (!canManageContent) return;
    const next = (piezas || []).map(x => x.id !== id ? x : { ...x, piezas: (x.piezas || []).some(p => p.id === piece.id) ? (x.piezas || []).map(p => p.id === piece.id ? normalizeSocialPiece(piece, x) : p) : [...(x.piezas || []), normalizeSocialPiece(piece, x)] });
    await setPiezas(next);
  };
  const deletePiece = async pieceId => {
    if (!canManageContent) return;
    if (!confirm("¿Eliminar pieza?")) return;
    const next = (piezas || []).map(x => x.id !== id ? x : { ...x, piezas: (x.piezas || []).filter(p => p.id !== pieceId) });
    await setPiezas(next);
    ntf && ntf("Pieza eliminada", "warn");
  };
  const pieceDetail = (pz.piezas || []).find(pc => pc.id === piezaDetailId) || null;
  const updatePieceQuick = async (pieceId, patch = {}) => {
    if (!canManageContent) return;
    const base = (pz.piezas || []).find(pc => pc.id === pieceId);
    if (!base) return;
    await savePiece({ ...base, ...patch });
  };
  return <div>
    <DetHeader title={pz.nom} tag="Campaña" badges={[<Badge key={0} label={pz.est || "Planificada"} />]} meta={[cli && `Cliente: ${cli.nom}`, pz.plataforma && `Plataforma: ${pz.plataforma}`, [pz.mes, pz.ano].filter(Boolean).join(" "), pz.fin && `Cierre: ${fmtD(pz.fin)}`].filter(Boolean)} des={pz.des}
      actions={canManageContent && <><GBtn onClick={() => openM("contenido", pz)}>✏ Editar</GBtn><DBtn onClick={() => { if (!canManageContent) return; if (!confirm("¿Eliminar campaña?")) return; cDel(piezas, setPiezas, id, () => navTo("contenidos"), "Campaña eliminada"); }}>🗑</DBtn></>} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Ingresos" value={fmtM(b.i)} sub={`${mv.filter(m => m.tipo === "ingreso").length} reg.`} accent="#00e08a" vc="#00e08a" />
      <Stat label="Gastos" value={fmtM(b.g)} sub={`${mv.filter(m => m.tipo === "gasto").length} reg.`} accent="#ff5566" vc="#ff5566" />
      <Stat label="Piezas" value={countCampaignPieces(pz)} sub={`${piezasPub} publicadas`} accent="var(--cy)" vc="var(--cy)" />
      <Stat label="Balance" value={fmtM(b.b)} accent={b.b >= 0 ? "#00e08a" : "#ff5566"} vc={b.b >= 0 ? "#00e08a" : "#ff5566"} />
    </div>
    <Tabs tabs={["Comentarios", "Piezas", "Editorial", "Ingresos", "Gastos", "Crew", "Fechas", "Info", ...(tasksEnabled ? ["Tareas"] : [])]} active={tab} onChange={setTab} />
    {(tab === 3 || tab === 4) && <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <GBtn sm onClick={() => exportMovCSV(mv.filter(m => tab === 3 ? m.tipo === "ingreso" : m.tipo === "gasto"), pz.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={() => exportMovPDF(mv.filter(m => tab === 3 ? m.tipo === "ingreso" : m.tipo === "gasto"), pz.nom, empresa, tab === 3 ? "Ingresos" : "Gastos")}>⬇ PDF</GBtn>
    </div>}
    {tab === 0 && <ComentariosBlock items={pz.comentarios || []} onSave={async comentarios => { if (!canManageContent) return; await setPiezas((piezas || []).map(x => x.id === id ? { ...x, comentarios } : x)); }} onCreateTask={tasksEnabled ? async comment => { if (!canManageContent) return; const task = normalizeTaskAssignees({ id: uid(), empId, cr: today(), titulo: comment.text?.split("\n")[0]?.slice(0, 80) || `Seguimiento ${pz.nom}`, desc: comment.text || "", estado: "Pendiente", prioridad: "Media", fechaLimite: "", refTipo: "pz", refId: id, assignedIds: getAssignedIds(comment), asignadoA: getAssignedIds(comment)[0] || "" }); await setTareas([...(Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object") : []), task]); ntf && ntf("Comentario guardado y tarea creada ✓"); } : null} crewOptions={pCrew} canEdit={canManageContent} title="Comentarios de la Campaña" empresa={empresa} currentUser={user} />}
    {tab === 1 && <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 12, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Publicadas</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#00e08a" }}>{piezasPub}</div></div>
        <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 12, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Programadas</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "var(--cy)" }}>{piezasProgramadas}</div></div>
        <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 12, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>En revisión</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#ffcc44" }}>{piezasRevision}</div></div>
        <div style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 12, padding: "12px 14px" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Aprobadas</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#7cffa6" }}>{piezasAprobadas}</div></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={piezaQ} onChange={v => setPiezaQ(v)} placeholder="Buscar pieza..." />
        <FilterSel value={piezaEstado} onChange={setPiezaEstado} options={DEFAULT_LISTAS.estadosPieza || []} placeholder="Todo estados" />
        <FilterSel value={piezaResp} onChange={setPiezaResp} options={pCrew.map(m => ({ value: m.id, label: m.nom }))} placeholder="Todos los responsables" />
        {canManageContent && <Btn onClick={() => openM("pieza", { campId: id, plataforma: pz.plataforma, ini: pz.ini, fin: pz.fin })}>+ Nueva Pieza</Btn>}
      </div>
      <Card>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH onClick={() => setPiezaSort(piezaSort === "name-asc" ? "name-desc" : "name-asc")} active={piezaSort === "name-asc" || piezaSort === "name-desc"} dir={piezaSort === "name-desc" ? "desc" : "asc"}>Pieza</TH><TH>Formato</TH><TH>Responsable</TH><TH onClick={() => setPiezaSort(piezaSort === "status-asc" ? "status-desc" : "status-asc")} active={piezaSort === "status-asc" || piezaSort === "status-desc"} dir={piezaSort === "status-desc" ? "desc" : "asc"}>Estado</TH><TH>Aprobación</TH><TH onClick={() => setPiezaSort(piezaSort === "date-asc" ? "date-desc" : "date-asc")} active={piezaSort === "date-asc" || piezaSort === "date-desc"} dir={piezaSort === "date-desc" ? "desc" : "asc"}>Publicación</TH><TH>Enlace</TH><TH></TH></tr></thead>
          <tbody>
            {piezasFiltradas.map(pc => <tr key={pc.id} onClick={() => setPiezaDetailId(pc.id)} style={{ cursor: "pointer" }}>
              <TD bold><div style={{ color: "var(--cy)" }}>{pc.nom}</div><div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 4 }}>{pc.objetivo || pc.plataforma || "—"}</div></TD>
              <TD><Badge label={pc.formato || "Pieza"} color="gray" sm /></TD>
              <TD>{pc.responsableId && crewMap[pc.responsableId] ? crewMap[pc.responsableId].nom : <span style={{ color: "var(--gr2)" }}>—</span>}</TD>
              <TD onClick={e => e.stopPropagation()}>
                <FSl value={pc.est || "Planificado"} onChange={e => updatePieceQuick(pc.id, { est: e.target.value })} disabled={!canManageContent}>
                  {(DEFAULT_LISTAS.estadosPieza || []).map(o => <option key={o}>{o}</option>)}
                </FSl>
              </TD>
              <TD><Badge label={pc.approval || "Pendiente"} color={(pc.approval || "Pendiente") === "Aprobada" ? "green" : (pc.approval || "Pendiente") === "Observada" ? "red" : (pc.approval || "Pendiente") === "En revisión" ? "yellow" : "gray"} sm /></TD>
              <TD mono style={{ fontSize: 11 }}>{pc.publishDate ? fmtD(pc.publishDate) : pc.fin ? fmtD(pc.fin) : "—"}{pc.publishedAt && <div style={{ fontSize: 10, color: "#00e08a", marginTop: 4 }}>Publicado {fmtD(pc.publishedAt)}</div>}</TD>
              <TD style={{ fontSize: 11 }}>
                {pc.link ? <a href={pc.link} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", fontWeight: 700, textDecoration: "none" }}>Pieza ↗</a> : <span style={{ color: "var(--gr2)" }}>—</span>}
              </TD>
              <TD onClick={e => e.stopPropagation()}><div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                <GBtn sm onClick={() => setPiezaDetailId(pc.id)}>Ver</GBtn>
                {canManageContent && <><GBtn sm onClick={() => openM("pieza", { ...pc, campId: id })}>✏</GBtn><XBtn onClick={() => deletePiece(pc.id)} /></>}
              </div></TD>
            </tr>)}
            {!piezasFiltradas.length && <tr><td colSpan={8}><Empty text="Sin piezas" sub="Crea la primera para esta campaña" /></td></tr>}
          </tbody>
        </table></div>
      </Card>
    </div>}
    {tab === 2 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Calendario editorial" sub="Qué se viene, qué está atrasado y qué ya salió.">
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "#ff5566", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Atrasadas</div>
            {editorialAtrasadas.length ? editorialAtrasadas.map(pc => <div key={pc.id} style={{ padding: "10px 0", borderTop: "1px solid var(--bdr)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{pc.nom}</div>
                  <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{pc.publishDate ? fmtD(pc.publishDate) : "—"} · {crewMap[pc.responsableId]?.nom || "Sin responsable"}</div>
                </div>
                <Badge label={pc.est || "Pendiente"} color="red" sm />
              </div>
            </div>) : <div style={{ fontSize: 12, color: "var(--gr2)" }}>No hay piezas atrasadas.</div>}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--cy)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Próximas publicaciones</div>
            {editorialPendientes.length ? editorialPendientes.slice(0, 8).map(pc => <div key={pc.id} style={{ padding: "10px 0", borderTop: "1px solid var(--bdr)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{pc.nom}</div>
                  <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{pc.publishDate ? fmtD(pc.publishDate) : "—"} · {pc.plataforma || "—"}</div>
                </div>
                <Badge label={pc.approval || "Pendiente"} sm color={(pc.approval || "Pendiente") === "Aprobada" ? "green" : "gray"} />
              </div>
            </div>) : <div style={{ fontSize: 12, color: "var(--gr2)" }}>No hay publicaciones próximas.</div>}
          </div>
        </div>
      </Card>
      <Card title="Publicado recientemente" sub="Seguimiento del cierre editorial de la campaña.">
        {editorialPublicadas.length ? editorialPublicadas.slice(0, 8).map(pc => <div key={pc.id} style={{ padding: "10px 0", borderTop: "1px solid var(--bdr)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{pc.nom}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{pc.publishedAt ? fmtD(pc.publishedAt) : pc.publishDate ? fmtD(pc.publishDate) : "—"} · {pc.finalLink ? "Con link final" : "Sin link final"}</div>
            </div>
            {pc.finalLink ? <a href={pc.finalLink} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--cy)", fontWeight: 700, textDecoration: "none" }}>Final ↗</a> : <Badge label="Pendiente link" color="yellow" sm />}
          </div>
        </div>) : <Empty text="Aún no hay piezas publicadas" sub="Cuando publiques contenido, lo verás aquí." />}
      </Card>
    </div>}
    {tab === 3 && <MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pz" onAdd={(eid, et, tipo) => openM("mov", { eid, et, tipo })} onDel={delMov} canEdit={canDo && canDo("movimientos")} />}
    {tab === 4 && <MovBlock movimientos={mv} tipo="gasto" eid={id} etype="pz" onAdd={(eid, et, tipo) => openM("mov", { eid, et, tipo })} onDel={delMov} canEdit={canDo && canDo("movimientos")} />}
    {tab === 5 && <CrewTab crew={crew || []} empId={empId} asignados={pz.crewIds || []} onAdd={addCrew} onRem={remCrew} canEdit={canManageContent} onHonorario={m => { if (!canManageMoves) return; saveMov({ eid: id, et: "pz", tipo: "gasto", cat: "Honorarios", des: `Honorarios ${m.nom}`, mon: parseTarifa(m.tarifa), fec: today() }); }} ini={(name="")=>String(name||"").split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase()} fmtM={fmtM} />}
    {tab === 6 && <MiniCal refId={id} eventos={eventos || []} onAdd={() => openM("evento", { ref: id, refTipo: "contenido" })} onEdit={ev => openM("evento", ev)} onDel={async evId => { if (!canManageCalendar) return; await cSave((eventos || []).filter(x => x.id !== evId), () => {}, {}); }} canEdit={canManageCalendar} titulo={pz.nom} />}
    {tab === 7 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Datos de la Campaña">
        {[["Cliente", cli?.nom || "—"], ["Plataforma", pz.plataforma || "—"], ["Mes", pz.mes || "—"], ["Año", pz.ano || "—"], ["Estado", <Badge key={0} label={pz.est || "Planificada"} />], ["Piezas creadas", countCampaignPieces(pz)], ["Piezas mensuales", pz.plannedPieces || countCampaignPieces(pz)]].map(([l, v]) => <KV key={l} label={l} value={v} />)}
      </Card>
      <Card title="Timeline">
        {[["Inicio", pz.ini ? fmtD(pz.ini) : "—"], ["Cierre", pz.fin ? fmtD(pz.fin) : "—"], ["Crew", pCrew.length]].map(([l, v]) => <KV key={l} label={l} value={v} />)}
        {pz.des && <><Sep /><div style={{ fontSize: 12, color: "var(--gr3)" }}>{pz.des}</div></>}
      </Card>
    </div>}
    {tasksEnabled && tab === 8 && <TareasContexto title="Tareas de la Campaña" refTipo="pz" refId={id} tareas={Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object" && t.empId === empId) : []} producciones={producciones} programas={programas} piezas={piezas} crew={crew} openM={openM} setTareas={setTareas} canEdit={canDo && canDo("contenidos")} />}
    <Modal open={!!pieceDetail} onClose={() => setPiezaDetailId("")} title={pieceDetail?.nom || "Pieza"} sub="Revisión completa de la pieza" wide>
      {pieceDetail && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card title="Resumen">
            <KV label="Estado" value={<Badge label={pieceDetail.est || "Planificado"} />} />
            <KV label="Formato" value={pieceDetail.formato || "—"} />
            <KV label="Plataforma" value={pieceDetail.plataforma || "—"} />
            <KV label="Responsable" value={pieceDetail.responsableId && crewMap[pieceDetail.responsableId] ? crewMap[pieceDetail.responsableId].nom : "—"} />
            <KV label="Aprobación" value={<Badge label={pieceDetail.approval || "Pendiente"} color={(pieceDetail.approval || "Pendiente") === "Aprobada" ? "green" : (pieceDetail.approval || "Pendiente") === "Observada" ? "red" : (pieceDetail.approval || "Pendiente") === "En revisión" ? "yellow" : "gray"} sm />} />
          </Card>
          <Card title="Fechas y enlaces">
            <KV label="Inicio" value={pieceDetail.ini ? fmtD(pieceDetail.ini) : "—"} />
            <KV label="Entrega" value={pieceDetail.fin ? fmtD(pieceDetail.fin) : "—"} />
            <KV label="Publicación estimada" value={pieceDetail.publishDate ? fmtD(pieceDetail.publishDate) : "—"} />
            <KV label="Publicación real" value={pieceDetail.publishedAt ? fmtD(pieceDetail.publishedAt) : "—"} />
            <KV label="Link de trabajo" value={pieceDetail.link ? <a href={pieceDetail.link} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", textDecoration: "none", fontWeight: 700 }}>Abrir ↗</a> : "—"} />
            <KV label="Link final" value={pieceDetail.finalLink ? <a href={pieceDetail.finalLink} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", textDecoration: "none", fontWeight: 700 }}>Abrir ↗</a> : "—"} />
          </Card>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          <Card title="Brief">
            <KV label="Objetivo" value={pieceDetail.objetivo || "—"} />
            <KV label="CTA" value={pieceDetail.cta || "—"} />
            <div style={{ fontSize: 12, color: "var(--gr3)", whiteSpace: "pre-line", lineHeight: 1.6, marginTop: 12 }}>{pieceDetail.brief || pieceDetail.des || "—"}</div>
          </Card>
          <Card title="Texto">
            <KV label="Hashtags" value={pieceDetail.hashtags || "—"} />
            <div style={{ fontSize: 12, color: "var(--gr3)", whiteSpace: "pre-line", lineHeight: 1.6, marginTop: 12 }}>{pieceDetail.copy || "—"}</div>
          </Card>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <GBtn onClick={() => setPiezaDetailId("")}>Cerrar</GBtn>
          {canManageContent && <Btn onClick={() => { setPiezaDetailId(""); openM("pieza", { ...pieceDetail, campId: id }); }}>Editar pieza</Btn>}
        </div>
      </>}
    </Modal>
  </div>;
}

export function ViewEpDet(props) {
  const {
    id, empresa, user, episodios, programas, movimientos, crew, eventos, navTo, openM, canDo, cSave, cDel, saveMov, delMov, setEpisodios, setMovimientos,
    useBal, fmtM, fmtD, ComentariosBlock, MovBlock,
  } = props;
  const empId = empresa?.id;
  const canManagePrograms = !!(canDo && canDo("programas"));
  const bal = useBal(movimientos, empId);
  const ep = (episodios || []).find(x => x.id === id); if (!ep) return <Empty text="No encontrado" />;
  const pg_ = (programas || []).find(x => x.id === ep.pgId);
  const mv = (movimientos || []).filter(m => m.eid === id); const b = bal(id);
  const [tab, setTab] = useState(0);
  const NEXT = { Planificado: "Grabado", Grabado: "En Edición", "En Edición": "Programado", Programado: "Publicado" };
  const STATUS = ["Planificado", "Grabado", "En Edición", "Programado", "Publicado", "Cancelado"];
  const changeStatus = async s => { if (!canManagePrograms) return; const next = (episodios || []).map(x => x.id === id ? { ...x, estado: s } : x); await setEpisodios(next); };
  const pCrew = (crew || []).filter(x => x.empId === empId && (ep.crewIds || []).includes(x.id));
  const addCrew = async crId => { if (!canManagePrograms) return; const next = (episodios || []).map(x => x.id === id ? { ...x, crewIds: [...(x.crewIds || []), crId] } : x); await setEpisodios(next); };
  const remCrew = async crId => { if (!canManagePrograms) return; const next = (episodios || []).map(x => x.id === id ? { ...x, crewIds: (x.crewIds || []).filter(i => i !== crId) } : x); await setEpisodios(next); };
  return <div>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 52, height: 52, background: "var(--cg)", border: "1px solid var(--cm)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: "var(--cy)", fontWeight: 700, letterSpacing: 1 }}>EP.</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: "var(--cy)", lineHeight: 1 }}>{String(ep.num).padStart(2, "0")}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 22, fontWeight: 800 }}>{ep.titulo}</div>
          <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {pg_ && <span onClick={() => navTo("pg-det", pg_.id)} style={{ color: "var(--cy)", cursor: "pointer" }}>{pg_.nom}</span>}
            <Badge label={ep.estado} />
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {canDo && canDo("programas") && NEXT[ep.estado] && <Btn onClick={() => changeStatus(NEXT[ep.estado])}>→ {NEXT[ep.estado]}</Btn>}
        {canDo && canDo("programas") && <><GBtn onClick={() => openM("ep", ep)}>✏ Editar</GBtn><DBtn onClick={() => { if (!confirm("¿Eliminar?")) return; cDel(episodios, setEpisodios, id, () => navTo("pg-det", ep.pgId), "Episodio eliminado"); }}>🗑</DBtn></>}
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Gastos Ep." value={fmtM(b.g)} sub={`${mv.filter(m => m.tipo === "gasto").length} ítems`} accent="#ff5566" vc="#ff5566" />
      <Stat label="Grabación" value={ep.fechaGrab ? fmtD(ep.fechaGrab) : "—"} accent="var(--cy)" />
      <Stat label="Emisión" value={ep.fechaEmision ? fmtD(ep.fechaEmision) : "—"} accent="#00e08a" />
      <Stat label="Duración" value={ep.duracion ? `${ep.duracion} min` : "—"} />
    </div>
    <Tabs tabs={["Comentarios", "Información", "Gastos", "Crew"]} active={tab} onChange={setTab} />
    {tab === 0 && <ComentariosBlock items={ep.comentarios || []} onSave={async comentarios => { if (!canManagePrograms) return; const next = (episodios || []).map(x => x.id === id ? { ...x, comentarios } : x); await setEpisodios(next); }} crewOptions={pCrew} canEdit={canManagePrograms} title="Comentarios del Episodio" empresa={empresa} currentUser={user} />}
    {tab === 1 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Datos del Episodio">
        {[["Número", `#${String(ep.num).padStart(2, "0")}`], ["Invitado / Tema", ep.invitado || "—"], ["Locación", ep.locacion || "—"], ["Descripción", ep.descripcion || "—"], ["Notas", ep.notas || "—"]].map(([l, v]) => <KV key={l} label={l} value={v} />)}
      </Card>
      <Card title="Estado y Fechas">
        {[["Estado", <Badge key={0} label={ep.estado} />], ["Grabación", ep.fechaGrab ? fmtD(ep.fechaGrab) : "Por confirmar"], ["Emisión", ep.fechaEmision ? fmtD(ep.fechaEmision) : "—"], ["Duración", ep.duracion ? `${ep.duracion} min` : "—"]].map(([l, v]) => <KV key={l} label={l} value={v} />)}
        {canDo && canDo("programas") && <><Sep /><div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>Cambiar estado:</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{STATUS.map(s => <button key={s} onClick={() => changeStatus(s)} style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${ep.estado === s ? "var(--cy)" : "var(--bdr2)"}`, background: ep.estado === s ? "var(--cg)" : "transparent", color: ep.estado === s ? "var(--cy)" : "var(--gr2)", cursor: "pointer", fontSize: 10, fontWeight: 600 }}>{s}</button>)}</div>
        </>}
      </Card>
    </div>}
    {tab === 2 && <MovBlock movimientos={mv} tipo="gasto" eid={id} etype="ep" onAdd={(eid, et, tipo) => openM("mov", { eid, et, tipo })} onDel={delMov} canEdit={canDo && canDo("movimientos")} />}
    {tab === 3 && <CrewTab crew={crew || []} empId={empId} asignados={ep.crewIds || []} onAdd={addCrew} onRem={remCrew} canEdit={canManagePrograms} />}
  </div>;
}

export function ViewPgDet(props) {
  const {
    id, empresa, user, clientes, producciones, programas, piezas, episodios, auspiciadores, movimientos, crew, eventos, tareas, navTo, openM, canDo, cSave, cDel, saveMov, delMov, setProgramas, setEpisodios, setMovimientos, setTareas, ntf,
    useBal, fmtM, fmtD, ini, ComentariosBlock, MovBlock, MiniCal, TareasContexto, exportMovCSV, exportMovPDF, normalizeTaskAssignees, getAssignedIds, AusCard,
    today = helperToday, uid = helperUid,
  } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const canManagePrograms = !!(canDo && canDo("programas"));
  const canManageMoves = !!(canDo && canDo("movimientos"));
  const canManageCalendar = !!(canDo && canDo("calendario"));
  const bal = useBal(movimientos, empId);
  const pg_ = (programas || []).find(x => x.id === id); if (!pg_) return <Empty text="No encontrado" />;
  const eps = (episodios || []).filter(e => e.pgId === id).sort((a, b) => a.num - b.num);
  const aus = (auspiciadores || []).filter(a => (a.pids || []).includes(id));
  const b = bal(id); const mv = (movimientos || []).filter(m => m.eid === id);
  const tauz = aus.reduce((s, a) => s + Number(a.mon || 0), 0);
  const [tab, setTab] = useState(0);
  const [epQ, setEpQ] = useState(""); const [epF, setEpF] = useState(""); const [epSort, setEpSort] = useState("num-asc"); const [epPg, setEpPg] = useState(1); const EPP = 8;
  const epStats = { plan: eps.filter(e => e.estado === "Planificado").length, grab: eps.filter(e => e.estado === "Grabado").length, edit: eps.filter(e => e.estado === "En Edición").length, prog: eps.filter(e => e.estado === "Programado").length, pub: eps.filter(e => e.estado === "Publicado").length, can: eps.filter(e => e.estado === "Cancelado").length };
  const fdEps = eps.filter(e => (!epF || e.estado === epF) && (e.titulo.toLowerCase().includes(epQ.toLowerCase()) || (e.invitado || "").toLowerCase().includes(epQ.toLowerCase()))).sort((a, b) => {
    if (epSort === "title-asc") return String(a.titulo || "").localeCompare(String(b.titulo || ""));
    if (epSort === "title-desc") return String(b.titulo || "").localeCompare(String(a.titulo || ""));
    if (epSort === "date-desc") return String(b.fechaGrab || b.fechaEmision || "").localeCompare(String(a.fechaGrab || a.fechaEmision || ""));
    if (epSort === "date-asc") return String(a.fechaGrab || a.fechaEmision || "").localeCompare(String(b.fechaGrab || b.fechaEmision || ""));
    if (epSort === "num-desc") return Number(b.num || 0) - Number(a.num || 0);
    return Number(a.num || 0) - Number(b.num || 0);
  });
  const pCrew = (crew || []).filter(x => x.empId === empId && (pg_.crewIds || []).includes(x.id));
  const addCrew = async crId => { if (!canManagePrograms) return; const next = (programas || []).map(x => x.id === id ? { ...x, crewIds: [...(x.crewIds || []), crId] } : x); await setProgramas(next); };
  const remCrew = async crId => { if (!canManagePrograms) return; const next = (programas || []).map(x => x.id === id ? { ...x, crewIds: (x.crewIds || []).filter(i => i !== crId) } : x); await setProgramas(next); };
  const cliAsoc = (clientes || []).find(x => x.id === pg_.cliId);
  return <div>
    <DetHeader title={pg_.nom} tag={pg_.tip} badges={[<Badge key={0} label={pg_.est} />]} meta={[pg_.can, pg_.fre, pg_.temporada && `Temp: ${pg_.temporada}`, pg_.conductor && `🎙 ${pg_.conductor}`, cliAsoc && `Cliente: ${cliAsoc.nom}`].filter(Boolean)} des={pg_.des}
      actions={canManagePrograms && <><GBtn onClick={() => openM("pg", pg_)}>✏ Editar</GBtn><DBtn onClick={() => { if (!canManagePrograms) return; if (!confirm("¿Eliminar producción y episodios?")) return; cDel(programas, setProgramas, id, () => navTo("programas"), "Eliminado"); }}>🗑</DBtn></>} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Episodios" value={eps.length} sub={`${epStats.plan} planificados`} />
      <Stat label="Publicados" value={epStats.pub} accent="#00e08a" vc="#00e08a" sub={`${epStats.grab} grabados`} />
      <Stat label="Balance" value={fmtM(b.b)} accent={b.b >= 0 ? "#00e08a" : "#ff5566"} vc={b.b >= 0 ? "#00e08a" : "#ff5566"} />
      <Stat label="Auspicios" value={fmtM(tauz)} accent="#ffcc44" vc="#ffcc44" sub={`${aus.length} auspiciadores`} />
    </div>
    {pg_.conductor && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--sur)", border: "1px solid var(--bdr)", borderRadius: 8, marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--gr2)" }}>Conductor: <b style={{ color: "var(--wh)" }}>{pg_.conductor}</b>{pg_.prodEjec ? ` · Prod: ${pg_.prodEjec}` : ""}</span>
      {cliAsoc && (cliAsoc.contactos || []).slice(0, 1).map(co => <ContactBtns key={co.id} tel={co.tel} ema={co.ema} nombre={co.nom} origen={empresa?.nombre || "tu empresa"} mensaje={`Hola ${co.nom}, te contactamos desde ${empresa?.nombre || "tu empresa"}.`} />)}
    </div>}
    <Tabs tabs={["Comentarios", "Episodios", "Ingresos", "Gastos", "Auspiciadores", "Crew", "Fechas", "Info", ...(tasksEnabled ? ["Tareas"] : [])]} active={tab} onChange={setTab} />
    {(tab === 2 || tab === 3) && <div style={{ display: "flex", gap: 8, margin: "10px 0" }}>
      <GBtn sm onClick={() => exportMovCSV(mv.filter(m => tab === 2 ? m.tipo === "ingreso" : m.tipo === "gasto"), pg_.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={() => exportMovPDF(mv.filter(m => tab === 2 ? m.tipo === "ingreso" : m.tipo === "gasto"), pg_.nom, empresa, tab === 2 ? "Ingresos" : "Gastos")}>⬇ PDF</GBtn>
    </div>}
    {tab === 0 && <ComentariosBlock items={pg_.comentarios || []} onSave={async comentarios => { if (!canManagePrograms) return; await setProgramas((programas || []).map(x => x.id === id ? { ...x, comentarios } : x)); }} onCreateTask={tasksEnabled ? async comment => { if (!canManagePrograms) return; const task = normalizeTaskAssignees({ id: uid(), empId, cr: today(), titulo: comment.text?.split("\n")[0]?.slice(0, 80) || `Seguimiento ${pg_.nom}`, desc: comment.text || "", estado: "Pendiente", prioridad: "Media", fechaLimite: "", refTipo: "pg", refId: id, assignedIds: getAssignedIds(comment), asignadoA: getAssignedIds(comment)[0] || "" }); await setTareas([...(Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object") : []), task]); ntf && ntf("Comentario guardado y tarea creada ✓"); } : null} crewOptions={pCrew} canEdit={canManagePrograms} title="Comentarios de la Producción" empresa={empresa} currentUser={user} />}
    {tab === 1 && <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={epQ} onChange={v => { setEpQ(v); setEpPg(1); }} placeholder="Buscar episodio..." />
        <FilterSel value={epF} onChange={v => { setEpF(v); setEpPg(1); }} options={["Planificado", "Grabado", "En Edición", "Programado", "Publicado", "Cancelado"]} placeholder="Todo estados" />
        {canDo && canDo("programas") && <Btn onClick={() => openM("ep", { pgId: id, num: eps.length ? Math.max(...eps.map(e => e.num)) + 1 : 1 })}>+ Nuevo Episodio</Btn>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8, marginBottom: 16 }}>
        {[["Planificado", epStats.plan, "#ffcc44"], ["Grabado", epStats.grab, "var(--cy)"], ["En Edición", epStats.edit, "var(--cy)"], ["Programado", epStats.prog, "#a855f7"], ["Publicado", epStats.pub, "#00e08a"], ["Cancelado", epStats.can, "#ff5566"]].map(([s, cnt, c]) => (
          <div key={s} onClick={() => setEpF(epF === s ? "" : s)} style={{ background: "var(--card)", border: `1px solid ${epF === s ? c : "var(--bdr)"}`, borderRadius: 8, padding: "10px 14px", cursor: "pointer" }}>
            <div style={{ fontFamily: "var(--fm)", fontSize: 18, fontWeight: 700, color: c }}>{cnt}</div>
            <div style={{ fontSize: 10, color: "var(--gr2)" }}>{s}</div>
          </div>
        ))}
      </div>
      <Card>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH onClick={() => setEpSort(epSort === "num-asc" ? "num-desc" : "num-asc")} active={epSort === "num-asc" || epSort === "num-desc"} dir={epSort === "num-desc" ? "desc" : "asc"}>N°</TH><TH onClick={() => setEpSort(epSort === "title-asc" ? "title-desc" : "title-asc")} active={epSort === "title-asc" || epSort === "title-desc"} dir={epSort === "title-desc" ? "desc" : "asc"}>Título</TH><TH>Invitado</TH><TH onClick={() => setEpSort(epSort === "date-asc" ? "date-desc" : "date-asc")} active={epSort === "date-asc" || epSort === "date-desc"} dir={epSort === "date-desc" ? "desc" : "asc"}>Grabación</TH><TH>Emisión</TH><TH>Estado</TH><TH>Gastos</TH><TH></TH></tr></thead>
          <tbody>
            {fdEps.slice((epPg - 1) * EPP, epPg * EPP).map(ep => { const eg = bal(ep.id); return <tr key={ep.id} onClick={() => navTo("ep-det", ep.id)}>
              <TD style={{ color: "var(--cy)", fontFamily: "var(--fm)", fontWeight: 700, fontSize: 13 }}>#{String(ep.num).padStart(2, "0")}</TD>
              <TD bold>{ep.titulo}</TD>
              <TD style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>{ep.invitado || "—"}</TD>
              <TD mono style={{ fontSize: 11 }}>{ep.fechaGrab ? fmtD(ep.fechaGrab) : "Por confirmar"}</TD>
              <TD mono style={{ fontSize: 11 }}>{ep.fechaEmision ? fmtD(ep.fechaEmision) : "—"}</TD>
              <TD><Badge label={ep.estado} /></TD>
              <TD style={{ color: "#ff5566", fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(eg.g)}</TD>
              <TD><GBtn sm onClick={e => { e.stopPropagation(); navTo("ep-det", ep.id); }}>Ver →</GBtn></TD>
            </tr>; })}
            {!fdEps.length && <tr><td colSpan={8}><Empty text="Sin episodios" sub={canDo && canDo("programas") ? "Crea el primero arriba" : ""} /></td></tr>}
          </tbody>
        </table></div>
        <Paginator page={epPg} total={fdEps.length} perPage={EPP} onChange={setEpPg} />
      </Card>
    </div>}
    {tab === 2 && <MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pg" onAdd={(eid, et, tipo) => openM("mov", { eid, et, tipo })} onDel={delMov} canEdit={canDo && canDo("movimientos")} />}
    {tab === 3 && <MovBlock movimientos={mv} tipo="gasto" eid={id} etype="pg" onAdd={(eid, et, tipo) => openM("mov", { eid, et, tipo })} onDel={delMov} canEdit={canDo && canDo("movimientos")} />}
    {tab === 4 && <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>{canDo && canDo("auspiciadores") && <Btn onClick={() => openM("aus", { pids: [id] })}>+ Auspiciador</Btn>}</div>
      {aus.length ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>{aus.map(a => <AusCard key={a.id} a={a} pgs={[pg_]} onEdit={canDo && canDo("auspiciadores") ? () => openM("aus", a) : null} />)}</div> : <Empty text="Sin auspiciadores" />}
    </div>}
    {tab === 5 && <CrewTab crew={crew || []} empId={empId} asignados={pg_.crewIds || []} onAdd={addCrew} onRem={remCrew} canEdit={canManagePrograms} onHonorario={m => { if (!canManageMoves) return; saveMov({ eid: id, et: "pg", tipo: "gasto", cat: "Honorarios", des: `Honorarios ${m.nom}`, mon: parseTarifa(m.tarifa), fec: today() }); }} ini={ini} fmtM={fmtM} />}
    {tab === 6 && <MiniCal refId={id} eventos={eventos || []} onAdd={() => openM("evento", { ref: id, refTipo: "programa" })} onEdit={ev => openM("evento", ev)} onDel={async evId => { if (!canManageCalendar) return; await cSave((eventos || []).filter(x => x.id !== evId), () => { }, {}); }} canEdit={canManageCalendar} titulo={pg_.nom} />}
    {tab === 7 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Datos de la Producción">
        {[["Tipo", pg_.tip], ["Canal", pg_.can || "—"], ["Frecuencia", pg_.fre || "—"], ["Temporada", pg_.temporada || "—"], ["Total Ep.", pg_.totalEp || "—"], ["Estado", <Badge key={0} label={pg_.est} />], ["Cliente", cliAsoc?.nom || "—"]].map(([l, v]) => <KV key={l} label={l} value={v} />)}
      </Card>
      <Card title="Equipo">
        {[["Conductor / Host", pg_.conductor || "—"], ["Prod. Ejecutivo", pg_.prodEjec || "—"]].map(([l, v]) => <KV key={l} label={l} value={v} />)}
        {pg_.des && <div style={{ fontSize: 12, color: "var(--gr3)", marginTop: 12 }}>{pg_.des}</div>}
      </Card>
    </div>}
    {tasksEnabled && tab === 8 && <TareasContexto title="Tareas de la Producción" refTipo="pg" refId={id} tareas={Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object" && t.empId === empId) : []} producciones={producciones} programas={programas} piezas={piezas} crew={crew} openM={openM} setTareas={setTareas} canEdit={canDo && canDo("programas")} />}
  </div>;
}

export function ViewAus(props) {
  const { empresa, auspiciadores, programas, openM, canDo, cDel, setAuspiciadores, listas, fmtM, fmtD, AusCard } = props;
  const empId = empresa?.id;
  const canManageSponsors = !!(canDo && canDo("auspiciadores"));
  const [q, setQ] = useState("");
  const [ft, setFt] = useState("");
  const [fp, setFp] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [vista, setVista] = useState("cards");
  const [pg, setPg] = useState(1);
  const [detailId, setDetailId] = useState("");
  const PP = 9;
  const fd = (auspiciadores || []).filter(x => x.empId === empId).filter(a => (a.nom.toLowerCase().includes(q.toLowerCase()) || (a.con || "").toLowerCase().includes(q.toLowerCase())) && (!ft || a.tip === ft) && (!fp || (a.pids || []).includes(fp))).sort((a, b) => {
    if (sortMode === "az") return String(a.nom || "").localeCompare(String(b.nom || ""));
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "amount-desc") return Number(b.mon || 0) - Number(a.mon || 0);
    if (sortMode === "amount-asc") return Number(a.mon || 0) - Number(b.mon || 0);
    if (sortMode === "oldest") return String(a.cr || a.vig || "").localeCompare(String(b.cr || b.vig || ""));
    return String(b.cr || b.vig || "").localeCompare(String(a.cr || a.vig || ""));
  });
  const pgOpts = (programas || []).filter(x => x.empId === empId).map(p => ({ value: p.id, label: p.nom }));
  const detail = (auspiciadores || []).find(a => a.id === detailId) || null;
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  return <div>
    <ModuleHeader
      module="Auspiciadores"
      title="Auspiciadores"
      description="Gestiona marcas auspiciadoras, contactos, montos comprometidos y su relación con las producciones activas."
      actions={canManageSponsors ? <Btn onClick={() => openM("aus", {})}>+ Nuevo Auspiciador</Btn> : null}
    />
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar auspiciador..." />
      <FilterSel value={ft} onChange={v => { setFt(v); setPg(1); }} options={listas?.tiposAus || DEFAULT_LISTAS.tiposAus} placeholder="Todo tipos" />
      <FilterSel value={fp} onChange={v => { setFp(v); setPg(1); }} options={pgOpts} placeholder="Todas producciones" />
      <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }, { value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }, { value: "amount-desc", label: "Mayor monto" }, { value: "amount-asc", label: "Menor monto" }]} placeholder="Ordenar" />
      <ViewModeToggle value={vista} onChange={setVista} />
    </div>
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionada{selectedIds.length === 1 ? "" : "s"}</div>
      <FSl value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} style={{ maxWidth: 200 }}>
        <option value="">Cambiar estado...</option>
        {(listas?.estadosAus || DEFAULT_LISTAS.estadosAus).map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={() => {
        if (!canManageSponsors) return;
        if (!bulkEstado) return;
        setAuspiciadores((auspiciadores || []).map(item => selectedIds.includes(item.id) ? { ...item, est: bulkEstado } : item));
        setSelectedIds([]);
      }}>Aplicar estado</GBtn>
      <DBtn sm onClick={() => {
        if (!canDo || !canDo("auspiciadores")) return;
        if (!confirm(`¿Eliminar ${selectedIds.length} auspiciador${selectedIds.length === 1 ? "" : "es"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`)) return;
        setAuspiciadores((auspiciadores || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}>Eliminar seleccionados</DBtn>
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    {vista === "cards" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
      {fd.slice((pg - 1) * PP, pg * PP).map(a => {
        const pgs = (a.pids || []).map(pid => (programas || []).find(x => x.id === pid)).filter(Boolean);
        return <div key={a.id} onClick={() => setDetailId(a.id)} style={{ cursor: "pointer" }}><AusCard a={a} pgs={pgs} onEdit={canManageSponsors ? () => openM("aus", a) : null} onDel={canManageSponsors ? () => cDel(auspiciadores, setAuspiciadores, a.id, null, "Auspiciador eliminado") : null} /></div>;
      })}
    </div> : <Card>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleAll(e.target.checked); }} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Auspiciador</TH><TH>Tipo</TH><TH>Producciones</TH><TH>Contacto</TH><TH onClick={() => setSortMode(sortMode === "amount-desc" ? "amount-asc" : "amount-desc")} active={sortMode === "amount-desc" || sortMode === "amount-asc"} dir={sortMode === "amount-desc" ? "desc" : "asc"}>Monto</TH><TH onClick={() => setSortMode(sortMode === "oldest" ? "recent" : "oldest")} active={sortMode === "recent" || sortMode === "oldest"} dir={sortMode === "recent" ? "desc" : "asc"}>Vigencia</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg - 1) * PP, pg * PP).map(a => { const pgs = (a.pids || []).map(pid => (programas || []).find(x => x.id === pid)?.nom).filter(Boolean); return <tr key={a.id} onClick={e => { if (e.target.closest("input,button,select,label,a")) return; setDetailId(a.id); }} style={{ cursor: "pointer" }}>
            <TD onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(a.id)} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleSelected(a.id); }} /></TD>
            <TD bold style={{ color: "var(--cy)" }}>{a.nom}</TD>
            <TD><Badge label={a.tip} sm /></TD>
            <TD style={{ fontSize: 11 }}>{pgs.join(", ") || "—"}</TD>
            <TD style={{ fontSize: 11 }}>{[a.con, a.ema].filter(Boolean).join(" · ") || "—"}</TD>
            <TD style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--cy)" }}>{a.mon ? fmtM(a.mon) : "—"}</TD>
            <TD style={{ fontSize: 11 }}>{a.vig ? fmtD(a.vig) : "—"}</TD>
            <TD onClick={e => e.stopPropagation()}><div style={{ display: "flex", gap: 4 }}><GBtn sm onClick={() => setDetailId(a.id)}>Ver</GBtn>{canManageSponsors && <><GBtn sm onClick={e => { e.stopPropagation(); openM("aus", a); }}>✏</GBtn><XBtn onClick={e => { e.stopPropagation(); cDel(auspiciadores, setAuspiciadores, a.id, null, "Auspiciador eliminado"); }} /></>}</div></TD>
          </tr>; })}
          {!fd.length && <tr><td colSpan={8}><Empty text="Sin auspiciadores" /></td></tr>}
        </tbody>
      </table></div>
    </Card>}
    {!fd.length && vista === "cards" && <Empty text="Sin auspiciadores" />}
    <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    <Modal open={!!detail} onClose={() => setDetailId("")} title={detail?.nom || "Auspiciador"} sub="Ficha de auspiciador" wide>
      {detail && <>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card title="Información general">
            <KV label="Tipo" value={<Badge label={detail.tip || "—"} sm />} />
            <KV label="Estado" value={<Badge label={detail.est || "Activo"} color={(detail.est || "Activo") === "Activo" ? "green" : "gray"} sm />} />
            <KV label="Monto" value={detail.mon ? fmtM(detail.mon) : "—"} />
            <KV label="Frecuencia de pago" value={detail.frecPago || "—"} />
            <KV label="Vigencia" value={detail.vig ? fmtD(detail.vig) : "—"} />
          </Card>
          <Card title="Contacto">
            <KV label="Contacto" value={detail.con || "—"} />
            <KV label="Email" value={detail.ema || "—"} />
            <KV label="Teléfono" value={detail.tel || "—"} />
            <div style={{ marginTop: 12 }}><ContactBtns tel={detail.tel} ema={detail.ema} nombre={detail.con || detail.nom} origen={empresa?.nombre || "tu empresa"} mensaje={`Hola ${detail.con || detail.nom}, te contactamos desde ${empresa?.nombre || "tu empresa"}.`} /></div>
          </Card>
        </div>
        <Card title="Producciones asociadas" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{(detail.pids || []).map(pid => (programas || []).find(x => x.id === pid)).filter(Boolean).map(pgItem => <Badge key={pgItem.id} label={pgItem.nom} color="cyan" sm />)}</div>
          {!(detail.pids || []).length && <div style={{ fontSize: 12, color: "var(--gr2)" }}>Sin producciones asociadas.</div>}
          {detail.not && <><Sep /><div style={{ fontSize: 12, color: "var(--gr3)", whiteSpace: "pre-line" }}>{detail.not}</div></>}
        </Card>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <GBtn onClick={() => setDetailId("")}>Cerrar</GBtn>
          {canManageSponsors && <Btn onClick={() => { setDetailId(""); openM("aus", detail); }}>Editar auspiciador</Btn>}
        </div>
      </>}
    </Modal>
  </div>;
}

export function ViewCrew(props) {
  const { empresa, crew, openM, canDo, cDel, setCrew, listas, ini } = props;
  const empId = empresa?.id;
  const canManageCrew = !!(canDo && canDo("crew"));
  const [q, setQ] = useState("");
  const [fa, setFa] = useState("");
  const [sortMode, setSortMode] = useState("az");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [vista, setVista] = useState("list");
  const [pg, setPg] = useState(1);
  const PP = 10;
  const AREAS = listas?.areasCrew || DEFAULT_LISTAS.areasCrew;
  const fd = (crew || []).filter(x => x.empId === empId).filter(c => (c.nom.toLowerCase().includes(q.toLowerCase()) || (c.rol || "").toLowerCase().includes(q.toLowerCase())) && (!fa || c.area === fa)).sort((a, b) => {
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "oldest") return String(a.cr || "").localeCompare(String(b.cr || ""));
    if (sortMode === "recent") return String(b.cr || "").localeCompare(String(a.cr || ""));
    return String(a.nom || "").localeCompare(String(b.nom || ""));
  });
  const canEditMember = m => canManageCrew;
  const canDeleteMember = m => canManageCrew && !m?.managedByUser;
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  const exportCSV = () => {
    const header = "Nombre,Rol,Área,Email,Teléfono,Disponibilidad,Tarifa,Estado";
    const rows = fd.map(m => [m.nom, m.rol, m.area, m.ema, m.tel, m.dis, m.tarifa, m.active !== false ? "Activo" : "Inactivo"].map(v => `"${v || ""}"`).join(","));
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "crew_produ.csv"; a.click();
  };
  return <div>
    <ModuleHeader
      module="Crew"
      title="Crew"
      description="Administra equipo interno y externo, su disponibilidad, área y costos operativos."
      actions={canManageCrew ? <Btn onClick={() => openM("crew", {})}>+ Agregar Miembro</Btn> : null}
    />
    <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar por nombre o rol..." />
      <FilterSel value={fa} onChange={v => { setFa(v); setPg(1); }} options={AREAS} placeholder="Todas las áreas" />
      <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }, { value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }]} placeholder="Ordenar" />
      <ViewModeToggle value={vista} onChange={setVista} />
      <GBtn onClick={exportCSV}>⬇ Exportar CSV</GBtn>
    </div>
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}</div>
      <FSl value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} style={{ maxWidth: 180 }}>
        <option value="">Cambiar estado...</option>
        <option value="Activo">Activo</option>
        <option value="Inactivo">Inactivo</option>
      </FSl>
      <GBtn sm onClick={() => {
        if (!canManageCrew) return;
        if (!bulkEstado) return;
        setCrew((crew || []).map(item => selectedIds.includes(item.id) ? { ...item, active: bulkEstado === "Activo" } : item));
        setSelectedIds([]);
      }}>Aplicar estado</GBtn>
      {canManageCrew && <DBtn sm onClick={() => {
        const removable = (crew || []).filter(item => selectedIds.includes(item.id) && !item?.managedByUser);
        if (!removable.length) { alert("No hay seleccionados eliminables."); return; }
        if (!confirm(`¿Eliminar ${removable.length} miembro${removable.length === 1 ? "" : "s"} seleccionado${removable.length === 1 ? "" : "s"}?`)) return;
        setCrew((crew || []).filter(item => !removable.some(rem => rem.id === item.id)));
        setSelectedIds([]);
      }}>Eliminar seleccionados</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 16 }}>El crew interno proviene de `Usuarios`. Desde aquí puedes completar sus datos operativos; para cambiar nombre, cargo o estado base, usa `Panel Administrador &gt; Usuarios`.</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 10, marginBottom: 20 }}>
      {AREAS.slice(0, 6).map(a => { const cnt = (crew || []).filter(x => x.empId === empId && x.area === a).length; return <div key={a} onClick={() => setFa(fa === a ? "" : a)} style={{ background: "var(--card)", border: `1px solid ${fa === a ? "var(--cy)" : "var(--bdr)"}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer", textAlign: "center" }}><div style={{ fontFamily: "var(--fm)", fontSize: 18, fontWeight: 700, color: fa === a ? "var(--cy)" : "var(--wh)" }}>{cnt}</div><div style={{ fontSize: 9, color: "var(--gr2)", marginTop: 2 }}>{a}</div></div>; })}
    </div>
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(m => <div key={m.id} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg,var(--cy),var(--cy2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--bg)", flexShrink: 0 }}>{ini(m.nom)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>{m.nom}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{m.rol || "Sin rol"}</div>
            </div>
            <Badge label={m.active !== false ? "Activo" : "Inactivo"} color={m.active !== false ? "green" : "red"} sm />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Badge label={m.area || "Sin área"} color="gray" sm />
            <Badge label={m.tipo === "interno" ? "Planta" : "Externo"} color={m.tipo === "interno" ? "green" : "yellow"} sm />
            {m.managedByUser && <Badge label="Usuario" color="cyan" sm />}
          </div>
          <div style={{ fontSize: 11, color: "var(--gr2)", display: "grid", gap: 5 }}>
            <span>✉ {m.ema || "—"}</span>
            <span>☎ {m.tel || "—"}</span>
            <span>Disponibilidad: {m.dis || "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--bdr)" }}>
            <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--cy)" }}>{m.tarifa || "—"}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {canEditMember(m) && <GBtn sm onClick={() => openM("crew", m)}>✏</GBtn>}
              {canDeleteMember(m) && <XBtn onClick={() => cDel(crew, setCrew, m.id, null, "Miembro eliminado")} />}
            </div>
          </div>
        </div>)}
      </div>
      {!fd.length && <Empty text="Sin miembros" sub={canDo && canDo("crew") ? "Agrega el primero arriba" : ""} />}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    </> :
      <Card>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onChange={e => toggleAll(e.target.checked)} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Nombre</TH><TH>Rol</TH><TH>Área</TH><TH>Email</TH><TH>Teléfono</TH><TH>Disponibilidad</TH><TH>Tarifa</TH><TH>Estado</TH><TH></TH></tr></thead>
          <tbody>
            {fd.slice((pg - 1) * PP, pg * PP).map(m => <tr key={m.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(m.id)} onChange={() => toggleSelected(m.id)} /></TD>
              <TD bold><div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--cy),var(--cy2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--bg)", flexShrink: 0 }}>{ini(m.nom)}</div>{m.nom}
              </div></TD>
              <TD>{m.rol || "—"}</TD><TD><Badge label={m.area || "—"} color="gray" sm /> <Badge label={m.tipo === "interno" ? "Planta" : "Externo"} color={m.tipo === "interno" ? "green" : "yellow"} sm /> {m.managedByUser && <Badge label="Usuario" color="cyan" sm />}</TD>
              <TD style={{ fontSize: 11 }}>{m.ema || "—"}</TD><TD style={{ fontSize: 11 }}>{m.tel || "—"}</TD>
              <TD style={{ fontSize: 11, color: "var(--gr2)" }}>{m.dis || "—"}</TD>
              <TD mono style={{ fontSize: 11 }}>{m.tarifa || "—"}</TD>
              <TD><Badge label={m.active !== false ? "Activo" : "Inactivo"} color={m.active !== false ? "green" : "red"} sm /></TD>
              <TD><div style={{ display: "flex", gap: 4 }}>
                {canEditMember(m) && <GBtn sm onClick={() => openM("crew", m)}>✏</GBtn>}
                {canDeleteMember(m) && <XBtn onClick={() => cDel(crew, setCrew, m.id, null, "Miembro eliminado")} />}
              </div></TD>
            </tr>)}
            {!fd.length && <tr><td colSpan={10}><Empty text="Sin miembros" sub={canDo && canDo("crew") ? "Agrega el primero arriba" : ""} /></td></tr>}
          </tbody>
        </table></div>
        <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
      </Card>}
  </div>;
}

export function ViewActivos(props) {
  const { empresa, activos, producciones, listas, openM, canDo, cDel, setActivos, fmtM, fmtD } = props;
  const empId = empresa?.id;
  const canManageAssets = !!(canDo && canDo("activos"));
  const [q, setQ] = useState("");
  const [fc, setFc] = useState("");
  const [fe, setFe] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [vista, setVista] = useState("list");
  const [pg, setPg] = useState(1);
  const PP = 10;
  const CATS = listas?.catActivos || DEFAULT_LISTAS.catActivos;
  const ESTADOS = listas?.estadosActivos || DEFAULT_LISTAS.estadosActivos;
  const fd = (activos || []).filter(x => x.empId === empId).filter(a => (a.nom.toLowerCase().includes(q.toLowerCase()) || (a.marca || "").toLowerCase().includes(q.toLowerCase())) && (!fc || a.categoria === fc) && (!fe || a.estado === fe)).sort((a, b) => {
    if (sortMode === "az") return String(a.nom || "").localeCompare(String(b.nom || ""));
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "value-desc") return Number(b.valorCompra || 0) - Number(a.valorCompra || 0);
    if (sortMode === "value-asc") return Number(a.valorCompra || 0) - Number(b.valorCompra || 0);
    if (sortMode === "oldest") return String(a.fechaCompra || a.cr || "").localeCompare(String(b.fechaCompra || b.cr || ""));
    return String(b.fechaCompra || b.cr || "").localeCompare(String(a.fechaCompra || a.cr || ""));
  });
  const totalValor = fd.reduce((s, a) => s + Number(a.valorCompra || 0), 0);
  const dispCount = fd.filter(a => a.estado === "Disponible").length;
  const enUsoCount = fd.filter(a => a.estado === "En Uso").length;
  const statColor = s => ({ Disponible: "#00e08a", "En Uso": "var(--cy)", "En Mantención": "#ffcc44", Dañado: "#ff8844", "Dado de Baja": "#ff5566" }[s] || "var(--gr2)");
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  return <div>
    <ModuleHeader
      module="Activos"
      title="Activos"
      description="Mantén control del equipamiento, su estado, valor y asignación dentro de la operación."
      actions={canManageAssets ? <Btn onClick={() => openM("activo", {})}>+ Nuevo Activo</Btn> : null}
    />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Total Activos" value={fd.length} accent="var(--cy)" vc="var(--cy)" />
      <Stat label="Disponibles" value={dispCount} accent="#00e08a" vc="#00e08a" />
      <Stat label="En Uso" value={enUsoCount} accent="var(--cy)" vc="var(--cy)" />
      <Stat label="Valor Total" value={fmtM(totalValor)} accent="#ffcc44" vc="#ffcc44" />
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar activo o marca..." />
      <FilterSel value={fc} onChange={v => { setFc(v); setPg(1); }} options={CATS} placeholder="Todas categorías" />
      <FilterSel value={fe} onChange={v => { setFe(v); setPg(1); }} options={ESTADOS} placeholder="Todo estados" />
      <FilterSel value={sortMode} onChange={v => { setSortMode(v); setPg(1); }} options={[{ value: "recent", label: "Más reciente" }, { value: "oldest", label: "Más antiguo" }, { value: "az", label: "A-Z" }, { value: "za", label: "Z-A" }, { value: "value-desc", label: "Mayor valor" }, { value: "value-asc", label: "Menor valor" }]} placeholder="Ordenar" />
      <ViewModeToggle value={vista} onChange={setVista} />
    </div>
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)" }}>{selectedIds.length} seleccionado{selectedIds.length === 1 ? "" : "s"}</div>
      <FSl value={bulkEstado} onChange={e => setBulkEstado(e.target.value)} style={{ maxWidth: 200 }}>
        <option value="">Cambiar estado...</option>
        {ESTADOS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </FSl>
      <GBtn sm onClick={() => {
        if (!canManageAssets) return;
        if (!bulkEstado) return;
        setActivos((activos || []).map(item => selectedIds.includes(item.id) ? { ...item, estado: bulkEstado } : item));
        setSelectedIds([]);
      }}>Aplicar estado</GBtn>
      {canManageAssets && <DBtn sm onClick={() => {
        if (!confirm(`¿Eliminar ${selectedIds.length} activo${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`)) return;
        setActivos((activos || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}>Eliminar seleccionados</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {ESTADOS.map(s => { const cnt = (activos || []).filter(a => a.empId === empId && a.estado === s).length; return <div key={s} onClick={() => setFe(fe === s ? "" : s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: `1px solid ${fe === s ? statColor(s) : "var(--bdr2)"}`, background: fe === s ? statColor(s) + "22" : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: fe === s ? statColor(s) : "var(--gr3)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: statColor(s), flexShrink: 0 }} />{s} ({cnt})</div>; })}
    </div>
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(a => { const pro = (producciones || []).find(x => x.id === a.asignadoA); return <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{a.nom}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{[a.marca, a.modelo].filter(Boolean).join(" · ") || "Sin marca/modelo"}</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: statColor(a.estado) + "22", color: statColor(a.estado), border: `1px solid ${statColor(a.estado)}40` }}>{a.estado || "—"}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Badge label={a.categoria || "Sin categoría"} color="gray" sm />
            {a.serial && <Badge label={`SN ${a.serial}`} color="cyan" sm />}
          </div>
          <div style={{ fontSize: 11, color: "var(--gr2)", display: "grid", gap: 5 }}>
            <span>Asignado: {pro ? pro.nom : "Sin asignar"}</span>
            <span>Compra: {a.fechaCompra ? fmtD(a.fechaCompra) : "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", paddingTop: 10, borderTop: "1px solid var(--bdr)" }}>
            <span style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--cy)" }}>{a.valorCompra ? fmtM(a.valorCompra) : "—"}</span>
            <div style={{ display: "flex", gap: 4 }}>{canManageAssets && <><GBtn sm onClick={() => openM("activo", a)}>✏</GBtn><XBtn onClick={() => cDel(activos, setActivos, a.id, null, "Activo eliminado")} /></>}</div>
          </div>
        </div>; })}
      </div>
      {!fd.length && <Empty text="Sin activos registrados" sub={canDo && canDo("activos") ? "Registra el primero con el botón superior" : ""} />}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
    </> :
      <Card>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onChange={e => toggleAll(e.target.checked)} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Nombre</TH><TH>Categoría</TH><TH>Marca/Modelo</TH><TH>N° Serie</TH><TH>Estado</TH><TH>Asignado a</TH><TH onClick={() => setSortMode(sortMode === "value-desc" ? "value-asc" : "value-desc")} active={sortMode === "value-desc" || sortMode === "value-asc"} dir={sortMode === "value-desc" ? "desc" : "asc"}>Valor</TH><TH></TH></tr></thead>
          <tbody>
            {fd.slice((pg - 1) * PP, pg * PP).map(a => { const pro = (producciones || []).find(x => x.id === a.asignadoA); return <tr key={a.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleSelected(a.id)} /></TD>
              <TD bold>{a.nom}</TD>
              <TD><Badge label={a.categoria || "—"} color="gray" sm /></TD>
              <TD style={{ fontSize: 12 }}>{[a.marca, a.modelo].filter(Boolean).join(" · ") || "—"}</TD>
              <TD mono style={{ fontSize: 11 }}>{a.serial || "—"}</TD>
              <TD><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: statColor(a.estado) + "22", color: statColor(a.estado), border: `1px solid ${statColor(a.estado)}40` }}>{a.estado || "—"}</span></TD>
              <TD style={{ fontSize: 12 }}>{pro ? pro.nom : <span style={{ color: "var(--gr)" }}>Sin asignar</span>}</TD>
              <TD mono style={{ fontSize: 12 }}>{a.valorCompra ? fmtM(a.valorCompra) : "—"}</TD>
              <TD><div style={{ display: "flex", gap: 4 }}>
                {canManageAssets && <><GBtn sm onClick={() => openM("activo", a)}>✏</GBtn><XBtn onClick={() => cDel(activos, setActivos, a.id, null, "Activo eliminado")} /></>}
              </div></TD>
            </tr>; })}
            {!fd.length && <tr><td colSpan={9}><Empty text="Sin activos registrados" sub={canDo && canDo("activos") ? "Registra el primero con el botón superior" : ""} /></td></tr>}
          </tbody>
        </table></div>
        <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg} />
      </Card>}
    {CATS.filter(c => (activos || []).some(a => a.empId === empId && a.categoria === c)).length > 0 && <div style={{ marginTop: 16 }}>
      <div style={{ fontFamily: "var(--fh)", fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Por Categoría</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
        {CATS.filter(c => (activos || []).some(a => a.empId === empId && a.categoria === c)).map(c => {
          const items = (activos || []).filter(a => a.empId === empId && a.categoria === c);
          const val = items.reduce((s, a) => s + Number(a.valorCompra || 0), 0);
          return <div key={c} onClick={() => setFc(fc === c ? "" : c)} style={{ background: "var(--card)", border: `1px solid ${fc === c ? "var(--cy)" : "var(--bdr)"}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer", transition: ".1s" }}>
            <div style={{ fontFamily: "var(--fm)", fontSize: 20, fontWeight: 700, color: fc === c ? "var(--cy)" : "var(--wh)" }}>{items.length}</div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 2 }}>{c}</div>
            {val > 0 && <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 4 }}>{fmtM(val)}</div>}
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
