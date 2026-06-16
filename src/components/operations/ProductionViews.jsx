import React, { useState } from "react";
import { ContactBtns } from "../shared/ContactButtons";
import { ConfirmActionDialog } from "../shared/ConfirmActionDialog";
import {
  Badge,
  Btn,
  Card,
  DetHeader,
  DBtn,
  Empty,
  FilterSel,
  FI,
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

function resolvePiecePrimaryPreview(piece = {}) {
  return piece.previewAssetUrl || piece.finalLink || piece.link || "";
}

function isImagePreviewUrl(value = "") {
  const normalized = String(value || "").toLowerCase();
  return normalized.startsWith("data:image/") || /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/.test(normalized);
}

function CrewTab({ crew, empId, asignados, onAdd, onRem, onHonorario, canEdit, ini, fmtM }) {
  const safeCrew = (Array.isArray(crew) ? crew : []).filter(x => x && typeof x === "object" && x.id);
  const safeAssigned = Array.isArray(asignados) ? asignados.filter(Boolean) : [];
  const todos = safeCrew.filter(x => x.empId === empId);
  const asig = todos.filter(x => safeAssigned.includes(x.id));
  const disp = todos.filter(x => !safeAssigned.includes(x.id) && x.active !== false);
  return <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
    <Card title={`Crew Asignado (${asig.length})`}>
      {asig.length ? asig.map(m => <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--bdr)" }}>
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,var(--cy),var(--cy2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#ffffff", flexShrink: 0 }}>{ini(m.nom)}</div>
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
  useBal, fmtM, fmtD, isMobile = false,
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
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [vista, setVista] = useState(() => (isMobile ? "cards" : "list"));
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
  return <div style={{ width: "100%", minWidth: 0 }}>
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
    {!!selectedIds.length && vista === "list" && <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 14, background: "linear-gradient(180deg,#ffffff,#f7fbff)", boxShadow: "0 10px 24px rgba(15,23,42,.05)" }}>
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
      {canManageProjects && <DBtn sm onClick={() => setBulkDeleteConfirmOpen(true)}>Eliminar seleccionados</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(p => {
          const c = (clientes || []).find(x => x.id === p.cliId);
          const b = bal(p.id);
          return <div key={p.id} onClick={() => navTo("pro-det", p.id)} style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 18, cursor: "pointer", transition: ".15s", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}>
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
              <span style={{ color: "var(--cy2)", fontWeight: 700 }}>Ver →</span>
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
    <ConfirmActionDialog
      open={bulkDeleteConfirmOpen}
      title="Eliminar proyectos"
      message={`¿Eliminar ${selectedIds.length} proyecto${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`}
      confirmLabel="Eliminar seleccionados"
      onClose={() => setBulkDeleteConfirmOpen(false)}
      onConfirm={() => {
        setBulkDeleteConfirmOpen(false);
        setProducciones((producciones || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}
    />
  </div>;
}

export function ViewProDet(props) {
  const {
    id, empresa, user, clientes, producciones, programas, piezas, contratos, movimientos, crew, eventos, tareas, navTo, openM, canDo, cDel, saveMov, delMov, setProducciones, setEventos, setTareas, ntf,
    useBal, fmtM, fmtD, ini, ComentariosBlock, MovBlock, MiniCal, TareasContexto, exportMovCSV, exportMovPDF, normalizeTaskAssignees, getAssignedIds,
    today = helperToday, uid = helperUid,
  } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const canManageProjects = !!(canDo && canDo("producciones"));
  const canManageMoves = !!(canDo && canDo("movimientos"));
  const canManageCalendar = !!(canDo && canDo("calendario"));
  const bal = useBal(movimientos, empId);
  const [tab, setTab] = useState(0);
  const [deleteProjectConfirmOpen, setDeleteProjectConfirmOpen] = useState(false);
  const p = (producciones || []).find(x => x.id === id); if (!p) return <Empty text="No encontrado" />;
  const c = (clientes || []).find(x => x.id === p.cliId);
  const contratosRel = contractsForReference(contratos || [], p.cliId, "produccion", id);
  const b = bal(id); const mv = (movimientos || []).filter(m => m.eid === id);
  const pCrew = (crew || []).filter(x => x.empId === empId && (p.crewIds || []).includes(x.id));
  const cContacto = (c?.contactos || [])[0];
  const addCrew = async crId => { if (!canManageProjects) return; const next = (producciones || []).map(x => x.id === id ? { ...x, crewIds: [...(x.crewIds || []), crId] } : x); await setProducciones(next); };
  const remCrew = async crId => { if (!canManageProjects) return; const next = (producciones || []).map(x => x.id === id ? { ...x, crewIds: (x.crewIds || []).filter(i => i !== crId) } : x); await setProducciones(next); };
  return <div style={{ width: "100%", minWidth: 0 }}>
    <DetHeader title={p.nom} tag={p.tip} badges={[<Badge key={0} label={p.est} />]} meta={[c && `Cliente: ${c.nom}`, p.ini && `Inicio: ${fmtD(p.ini)}`, p.fin && `Entrega: ${fmtD(p.fin)}`].filter(Boolean)} des={p.des}
      actions={canManageProjects && <><GBtn onClick={() => openM("pro", p)}>✏ Editar</GBtn><DBtn onClick={() => { if (!canManageProjects) return; setDeleteProjectConfirmOpen(true); }}>🗑</DBtn></>} />
    {cContacto && <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", background: "var(--sur)", border: "1px solid var(--bdr)", borderRadius: 8, marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
      <span style={{ fontSize: 12, color: "var(--gr2)" }}>Contacto: <b style={{ color: "var(--wh)" }}>{cContacto.nom}</b> {cContacto.car ? `· ${cContacto.car}` : ""}</span>
      <ContactBtns tel={cContacto.tel} ema={cContacto.ema} nombre={cContacto.nom} origen={empresa?.nombre || "tu empresa"} mensaje={`Hola ${cContacto.nom}, te contactamos desde ${empresa?.nombre || "tu empresa"}.`} />
    </div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Ingresos" value={fmtM(b.i)} sub={`${mv.filter(m => m.tipo === "ingreso").length} reg.`} accent="#00e08a" vc="#00e08a" />
      <Stat label="Gastos" value={fmtM(b.g)} sub={`${mv.filter(m => m.tipo === "gasto").length} reg.`} accent="#ff5566" vc="#ff5566" />
      <Stat label="Balance" value={fmtM(b.b)} accent={b.b >= 0 ? "#00e08a" : "#ff5566"} vc={b.b >= 0 ? "#00e08a" : "#ff5566"} />
      <Stat label="Crew" value={pCrew.length} sub="asignados" accent="var(--cy2)" vc="var(--cy2)" />
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
      <MiniCal refId={id} eventos={eventos || []} onAdd={() => openM("evento", { ref: id, refTipo: "produccion" })} onEdit={ev => openM("evento", ev)} onDel={async evId => { if (!canManageCalendar) return; await setEventos((eventos || []).filter(x => x.id !== evId)); }} canEdit={canManageCalendar} titulo={p.nom} />
    </div>}
    {tab === 5 && <Card title="Contratos Relacionados" action={canDo && canDo("contratos") ? { label: "+ Nuevo", fn: () => openM("ct", { cliId: p.cliId, pids: [`p:${id}`], tip: "Producción", nom: `Contrato ${p.nom}` }) } : null}>
      {contratosRel.map(ct => <div key={ct.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--bdr)" }}><span style={{ fontSize: 18 }}>📄</span><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{ct.nom}</div><div style={{ fontSize: 11, color: "var(--gr2)" }}>{ct.tip}{ct.vig ? ` · ${fmtD(ct.vig)}` : ""}</div></div><Badge label={ct.est} />{ct.mon && <span style={{ fontFamily: "var(--fm)", fontSize: 12 }}>{fmtM(ct.mon)}</span>}</div>)}
      {!contratosRel.length && <Empty text="Sin contratos relacionados" />}
    </Card>}
    {tasksEnabled && tab === 6 && <TareasContexto title="Tareas del Proyecto" refTipo="pro" refId={id} tareas={Array.isArray(tareas) ? tareas.filter(t => t && typeof t === "object" && t.empId === empId) : []} producciones={producciones} programas={programas} piezas={piezas} crew={crew} openM={openM} setTareas={setTareas} canEdit={canDo && canDo("producciones")} />}
    <ConfirmActionDialog
      open={deleteProjectConfirmOpen}
      title="Eliminar proyecto"
      message={`Vamos a eliminar el proyecto ${p.nom || ""} del laboratorio.`}
      confirmLabel="Sí, eliminar proyecto"
      onClose={() => setDeleteProjectConfirmOpen(false)}
      onConfirm={() => {
        setDeleteProjectConfirmOpen(false);
        cDel(producciones, setProducciones, id, () => navTo("producciones"), "Proyecto eliminado");
      }}
    />
  </div>;
}

export function ViewPgs({
  empresa, programas, episodios, auspiciadores, movimientos, navTo, openM, canDo, listas, setProgramas,
  useBal, fmtM, isMobile = false,
}) {
  const empId = empresa?.id;
  const canManagePrograms = !!(canDo && canDo("programas"));
  const bal = useBal(movimientos, empId);
  const [q, setQ] = useState("");
  const [fe, setFe] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [vista, setVista] = useState(() => (isMobile ? "cards" : "list"));
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
  return <div style={{ width: "100%", minWidth: 0 }}>
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
      {canManagePrograms && <DBtn sm onClick={() => setBulkDeleteConfirmOpen(true)}>Eliminar seleccionadas</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    {vista === "cards" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
      {fd.slice((pg - 1) * PP, pg * PP).map(pg_ => {
        const eps = (episodios || []).filter(e => e.pgId === pg_.id);
        const pub = eps.filter(e => e.estado === "Publicado").length;
        const aus = (auspiciadores || []).filter(a => (a.pids || []).includes(pg_.id)).length;
        const b = bal(pg_.id);
        return <div key={pg_.id} onClick={() => navTo("pg-det", pg_.id)} style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 20, cursor: "pointer", position: "relative", overflow: "hidden", transition: ".15s", boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg,var(--cy),var(--cy2))" }} />
          <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "var(--cy2)", marginBottom: 8, fontWeight: 700 }}>{pg_.tip}</div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 18, fontWeight: 800, marginBottom: 5, lineHeight: 1.2 }}>{pg_.nom}</div>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 10 }}>{pg_.can || "Sin canal"} · {pg_.fre || ""}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}><Badge label={pg_.est} />{pg_.totalEp && <Badge label={`${pg_.totalEp} ep.`} color="gray" />}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, paddingTop: 12, borderTop: "1px solid var(--bdr)" }}>
            {[["Total", eps.length, "var(--wh)"], ["Pub.", pub, "#00e08a"], ["Aus.", aus, "var(--cy2)"]].map(([l, v, c]) => <div key={l} style={{ textAlign: "center" }}><div style={{ fontFamily: "var(--fm)", fontSize: 18, fontWeight: 700, color: c }}>{v}</div><div style={{ fontSize: 9, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>{l}</div></div>)}
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
    <ConfirmActionDialog
      open={bulkDeleteConfirmOpen}
      title="Eliminar producciones"
      message={`¿Eliminar ${selectedIds.length} producción${selectedIds.length === 1 ? "" : "es"} seleccionada${selectedIds.length === 1 ? "" : "s"}?`}
      confirmLabel="Eliminar seleccionadas"
      onClose={() => setBulkDeleteConfirmOpen(false)}
      onConfirm={() => {
        setBulkDeleteConfirmOpen(false);
        setProgramas((programas || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}
    />
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
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
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
      <DBtn sm onClick={() => setBulkDeleteConfirmOpen(true)}>Eliminar seleccionadas</DBtn>
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
      <Stat label="Planificadas" value={totalPlanned} accent="var(--cy2)" vc="var(--cy2)" />
      <Stat label="Creadas" value={totalCreated} accent="#7c5cff" vc="#7c5cff" />
      <Stat label="Programadas" value={totalScheduled} accent="#38bdf8" vc="#38bdf8" />
      <Stat label="Publicadas" value={totalPublished} accent="#00e08a" vc="#00e08a" />
    </div>
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(pz => { const c = (clientes || []).find(x => x.id === pz.cliId); const b = bal(pz.id); return <div key={pz.id} onClick={() => navTo("contenido-det", pz.id)} style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid var(--bdr)", borderRadius: 18, padding: 18, cursor: "pointer", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 12px 28px rgba(15,23,42,.06)" }}>
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
    <ConfirmActionDialog
      open={bulkDeleteConfirmOpen}
      title="Eliminar campañas"
      message={`¿Eliminar ${selectedIds.length} campaña${selectedIds.length === 1 ? "" : "s"} seleccionada${selectedIds.length === 1 ? "" : "s"}?`}
      confirmLabel="Eliminar seleccionadas"
      onClose={() => setBulkDeleteConfirmOpen(false)}
      onConfirm={() => {
        setBulkDeleteConfirmOpen(false);
        if (!canDo || !canDo("contenidos")) return;
        setPiezas((piezas || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}
    />
  </div>;
}

export function ViewContenidoDet(props) {
  const {
    id, empresa, user, clientes, piezas, movimientos, crew, eventos, tareas, navTo, openM, canDo, cDel, saveMov, delMov, setPiezas, setEventos, setTareas, ntf, producciones, programas,
    useBal, fmtM, fmtD, countCampaignPieces, ComentariosBlock, MovBlock, MiniCal, TareasContexto, exportMovCSV, exportMovPDF, normalizeTaskAssignees, getAssignedIds, normalizeSocialPiece,
    today = helperToday, uid = helperUid,
  } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const canManageContent = !!(canDo && canDo("contenidos"));
  const canManageMoves = !!(canDo && canDo("movimientos"));
  const canManageCalendar = !!(canDo && canDo("calendario"));
  const portalDecisionSummary = decision => {
    if (!decision) return "";
    return [decision.requestedChanges, decision.comment, decision.additionalBrief, decision.brief].filter(Boolean)[0] || "";
  };
  const clientPortalBadge = decision => {
    if (!decision?.status) return null;
    return <Badge label={decision.status === "approved" ? "Cliente aprobó" : "Cliente pidió cambios"} color={decision.status === "approved" ? "green" : "orange"} sm />;
  };
  const pieceCommentsCount = piece => (Array.isArray(piece?.comentarios) ? piece.comentarios.filter(Boolean).length : 0);
  const pieceLatestComment = piece => {
    const items = Array.isArray(piece?.comentarios) ? piece.comentarios.filter(Boolean) : [];
    if (!items.length) return null;
    return [...items].sort((a, b) => String(b?.upd || b?.createdAt || b?.cr || "").localeCompare(String(a?.upd || a?.createdAt || a?.cr || "")))[0] || null;
  };
  const pieceHasClientFeedback = piece => (Array.isArray(piece?.comentarios) ? piece.comentarios : []).some(comment => String(comment?.source || "").trim() === "client_portal");
  const pieceLatestClientFeedback = piece => {
    const items = (Array.isArray(piece?.comentarios) ? piece.comentarios : []).filter(comment => String(comment?.source || "").trim() === "client_portal");
    if (!items.length) return null;
    return [...items].sort((a, b) => String(b?.upd || b?.createdAt || b?.cr || "").localeCompare(String(a?.upd || a?.createdAt || a?.cr || "")))[0] || null;
  };
  const bal = useBal(movimientos, empId);
  const [tab, setTab] = useState(0);
  const [piezaQ, setPiezaQ] = useState("");
  const [piezaEstado, setPiezaEstado] = useState("");
  const [piezaMes, setPiezaMes] = useState("");
  const [piezaResp, setPiezaResp] = useState("");
  const [piezaSort, setPiezaSort] = useState("name-asc");
  const [deletePieceConfirmId, setDeletePieceConfirmId] = useState(null);
  const [deleteCampaignConfirmOpen, setDeleteCampaignConfirmOpen] = useState(false);
  const pz = (piezas || []).find(x => x.id === id); if (!pz) return <Empty text="No encontrado" />;
  const cli = (clientes || []).find(x => x.id === pz.cliId);
  const b = bal(id); const mv = (movimientos || []).filter(m => m.eid === id);
  const pCrew = (crew || []).filter(x => x.empId === empId && (pz.crewIds || []).includes(x.id));
  const piezasCamp = (pz.piezas || []).filter(pc => (pc.nom || "").toLowerCase().includes(piezaQ.toLowerCase()) && (!piezaEstado || pc.est === piezaEstado));
  const piezasFiltradas = piezasCamp.filter(pc => (!piezaMes || pc.mes === piezaMes) && (!piezaResp || pc.responsableId === piezaResp)).sort((a, b) => {
    if (piezaSort === "name-desc") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (piezaSort === "date-desc") return String(b.publishDate || b.fin || "").localeCompare(String(a.publishDate || a.fin || ""));
    if (piezaSort === "date-asc") return String(a.publishDate || a.fin || "").localeCompare(String(b.publishDate || b.fin || ""));
    if (piezaSort === "status-desc") return String(b.est || "").localeCompare(String(a.est || ""));
    if (piezaSort === "status-asc") return String(a.est || "").localeCompare(String(b.est || ""));
    return String(a.nom || "").localeCompare(String(b.nom || ""));
  });
  const piezasAgrupadasPorMes = piezasFiltradas.reduce((acc, pc) => {
    const mesKey = pc.mes || "Sin mes";
    if (!acc[mesKey]) acc[mesKey] = [];
    acc[mesKey].push(pc);
    return acc;
  }, {});
  const piezasMesOrden = Object.keys(piezasAgrupadasPorMes).sort((a, b) => {
    if (a === "Sin mes") return 1;
    if (b === "Sin mes") return -1;
    return MESES.indexOf(a) - MESES.indexOf(b);
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
    const next = (piezas || []).map(x => x.id !== id ? x : { ...x, piezas: (x.piezas || []).filter(p => p.id !== pieceId) });
    await setPiezas(next);
    ntf && ntf("Pieza eliminada", "warn");
  };
  const updatePieceQuick = async (pieceId, patch = {}) => {
    if (!canManageContent) return;
    const base = (pz.piezas || []).find(pc => pc.id === pieceId);
    if (!base) return;
    await savePiece({ ...base, ...patch });
  };
  return <div>
    <DetHeader title={pz.nom} tag="Campaña" badges={[<Badge key={0} label={pz.est || "Planificada"} />]} meta={[cli && `Cliente: ${cli.nom}`, pz.plataforma && `Plataforma: ${pz.plataforma}`, [pz.mes, pz.ano].filter(Boolean).join(" "), pz.fin && `Cierre: ${fmtD(pz.fin)}`].filter(Boolean)} des={pz.des}
      actions={canManageContent && <><GBtn onClick={() => openM("contenido", pz)}>✏ Editar</GBtn><DBtn onClick={() => setDeleteCampaignConfirmOpen(true)}>🗑</DBtn></>} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Ingresos" value={fmtM(b.i)} sub={`${mv.filter(m => m.tipo === "ingreso").length} reg.`} accent="#00e08a" vc="#00e08a" />
      <Stat label="Gastos" value={fmtM(b.g)} sub={`${mv.filter(m => m.tipo === "gasto").length} reg.`} accent="#ff5566" vc="#ff5566" />
      <Stat label="Piezas" value={countCampaignPieces(pz)} sub={`${piezasPub} publicadas`} accent="var(--cy2)" vc="var(--cy2)" />
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
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid var(--bdr)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 10px 24px rgba(15,23,42,.05)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Publicadas</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#00e08a" }}>{piezasPub}</div></div>
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid var(--bdr)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 10px 24px rgba(15,23,42,.05)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Programadas</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "var(--cy2)" }}>{piezasProgramadas}</div></div>
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid var(--bdr)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 10px 24px rgba(15,23,42,.05)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>En revisión</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#ffcc44" }}>{piezasRevision}</div></div>
        <div style={{ background: "linear-gradient(180deg,#ffffff,#f8fbff)", border: "1px solid var(--bdr)", borderRadius: 16, padding: "12px 14px", boxShadow: "0 10px 24px rgba(15,23,42,.05)" }}><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1 }}>Aprobadas</div><div style={{ fontFamily: "var(--fm)", fontSize: 22, fontWeight: 700, color: "#7cffa6" }}>{piezasAprobadas}</div></div>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar value={piezaQ} onChange={v => setPiezaQ(v)} placeholder="Buscar pieza..." />
        <FilterSel value={piezaEstado} onChange={setPiezaEstado} options={DEFAULT_LISTAS.estadosPieza || []} placeholder="Todo estados" />
        <FilterSel value={piezaMes} onChange={setPiezaMes} options={MESES} placeholder="Todos los meses" />
        <FilterSel value={piezaResp} onChange={setPiezaResp} options={pCrew.map(m => ({ value: m.id, label: m.nom }))} placeholder="Todos los responsables" />
        {canManageContent && <Btn onClick={() => openM("pieza", { campId: id, plataforma: pz.plataforma, ini: pz.ini, fin: pz.fin, mes: pz.mes })}>+ Nueva Pieza</Btn>}
      </div>
      <Card>
        <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><TH onClick={() => setPiezaSort(piezaSort === "name-asc" ? "name-desc" : "name-asc")} active={piezaSort === "name-asc" || piezaSort === "name-desc"} dir={piezaSort === "name-desc" ? "desc" : "asc"}>Pieza</TH><TH>Formato</TH><TH>Mes</TH><TH>Responsable</TH><TH onClick={() => setPiezaSort(piezaSort === "status-asc" ? "status-desc" : "status-asc")} active={piezaSort === "status-asc" || piezaSort === "status-desc"} dir={piezaSort === "status-desc" ? "desc" : "asc"}>Estado</TH><TH>Aprobación</TH><TH onClick={() => setPiezaSort(piezaSort === "date-asc" ? "date-desc" : "date-asc")} active={piezaSort === "date-asc" || piezaSort === "date-desc"} dir={piezaSort === "date-desc" ? "desc" : "asc"}>Publicación</TH><TH>Enlace</TH><TH></TH></tr></thead>
          <tbody>
            {piezasMesOrden.flatMap(mes => [
              <tr key={`month-${mes}`}>
                <td colSpan={9} style={{ padding: "12px 14px", background: "color-mix(in srgb, #ffffff 82%, var(--cy2) 18%)", borderTop: "1px solid var(--bdr)", borderBottom: "1px solid var(--bdr)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--gr4)", textTransform: "uppercase", letterSpacing: 1 }}>{mes}</div>
                    <div style={{ fontSize: 11, color: "var(--gr2)" }}>{piezasAgrupadasPorMes[mes].length} {piezasAgrupadasPorMes[mes].length === 1 ? "pieza" : "piezas"}</div>
                  </div>
                </td>
              </tr>,
              ...piezasAgrupadasPorMes[mes].map(pc => <tr key={pc.id} onClick={() => navTo("pieza-det", pc.id)} style={{ cursor: "pointer" }}>
                <TD bold>
                  <div style={{ color: "var(--cy2)" }}>{pc.nom}</div>
                  <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 4 }}>{pc.objetivo || pc.plataforma || "—"}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
                    {pieceCommentsCount(pc) ? <Badge label={`${pieceCommentsCount(pc)} comentario${pieceCommentsCount(pc) === 1 ? "" : "s"}`} color="gray" sm /> : null}
                    {clientPortalBadge(pc.clientPortalDecision)}
                    {pieceHasClientFeedback(pc) ? <Badge label="Nuevo feedback cliente" color="orange" sm /> : null}
                  </div>
                  {pc.clientPortalDecision?.status ? <div style={{ fontSize: 10, color: "var(--org)", marginTop: 6, lineHeight: 1.5 }}>{portalDecisionSummary(pc.clientPortalDecision) || "Hay feedback del cliente en esta pieza."}</div> : null}
                  {pieceLatestClientFeedback(pc)?.text ? <div style={{ fontSize: 10, color: "var(--cy2)", marginTop: 6, lineHeight: 1.5 }}>Cliente: {String(pieceLatestClientFeedback(pc).text).slice(0, 110)}</div> : null}
                  {pieceLatestComment(pc)?.text ? <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 6, lineHeight: 1.5 }}>Último comentario: {String(pieceLatestComment(pc).text).slice(0, 110)}</div> : null}
                </TD>
                <TD><Badge label={pc.formato || "Pieza"} color="gray" sm /></TD>
                <TD>{pc.mes || <span style={{ color: "var(--gr2)" }}>—</span>}</TD>
                <TD>{pc.responsableId && crewMap[pc.responsableId] ? crewMap[pc.responsableId].nom : <span style={{ color: "var(--gr2)" }}>—</span>}</TD>
                <TD onClick={e => e.stopPropagation()}>
                  <FSl value={pc.est || "Planificado"} onChange={e => updatePieceQuick(pc.id, { est: e.target.value })} disabled={!canManageContent}>
                    {(DEFAULT_LISTAS.estadosPieza || []).map(o => <option key={o}>{o}</option>)}
                  </FSl>
                </TD>
                <TD>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <Badge label={pc.approval || "Pendiente"} color={(pc.approval || "Pendiente") === "Aprobada" ? "green" : (pc.approval || "Pendiente") === "Observada" ? "red" : (pc.approval || "Pendiente") === "En revisión" ? "yellow" : "gray"} sm />
                  </div>
                </TD>
                <TD mono style={{ fontSize: 11 }}>{pc.publishDate ? fmtD(pc.publishDate) : pc.fin ? fmtD(pc.fin) : "—"}{pc.publishedAt && <div style={{ fontSize: 10, color: "#00e08a", marginTop: 4 }}>Publicado {fmtD(pc.publishedAt)}</div>}</TD>
                <TD style={{ fontSize: 11 }}>
                  {pc.link ? <a href={pc.link} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", fontWeight: 700, textDecoration: "none" }}>Pieza ↗</a> : <span style={{ color: "var(--gr2)" }}>—</span>}
                </TD>
                <TD onClick={e => e.stopPropagation()}><div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                  <GBtn sm onClick={() => navTo("pieza-det", pc.id)}>Ver</GBtn>
                  {canManageContent && <><GBtn sm onClick={() => openM("pieza", { ...pc, campId: id })}>✏</GBtn><XBtn onClick={() => deletePiece(pc.id)} /></>}
                </div></TD>
              </tr>),
            ])}
            {!piezasFiltradas.length && <tr><td colSpan={9}><Empty text="Sin piezas" sub="Crea la primera para esta campaña" /></td></tr>}
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
    {tab === 6 && <MiniCal refId={id} eventos={eventos || []} onAdd={() => openM("evento", { ref: id, refTipo: "contenido" })} onEdit={ev => openM("evento", ev)} onDel={async evId => { if (!canManageCalendar) return; await setEventos((eventos || []).filter(x => x.id !== evId)); }} canEdit={canManageCalendar} titulo={pz.nom} />}
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
    <ConfirmActionDialog
      open={Boolean(deletePieceConfirmId)}
      title="Eliminar pieza"
      message="¿Eliminar pieza?"
      confirmLabel="Eliminar pieza"
      onClose={() => setDeletePieceConfirmId(null)}
      onConfirm={() => {
        if (!deletePieceConfirmId) return;
        void deletePiece(deletePieceConfirmId);
        setDeletePieceConfirmId(null);
      }}
    />
    <ConfirmActionDialog
      open={deleteCampaignConfirmOpen}
      title="Eliminar campaña"
      message="¿Eliminar campaña?"
      confirmLabel="Eliminar campaña"
      onClose={() => setDeleteCampaignConfirmOpen(false)}
      onConfirm={() => {
        setDeleteCampaignConfirmOpen(false);
        if (!canManageContent) return;
        cDel(piezas, setPiezas, id, () => navTo("contenidos"), "Campaña eliminada");
      }}
    />
  </div>;
}

export function ViewEpDet(props) {
  const {
    id, empresa, user, episodios, programas, movimientos, crew, navTo, openM, canDo, cDel, delMov, setEpisodios,
    useBal, fmtM, fmtD, ComentariosBlock, MovBlock,
  } = props;
  const empId = empresa?.id;
  const canManagePrograms = !!(canDo && canDo("programas"));
  const bal = useBal(movimientos, empId);
  const [tab, setTab] = useState(0);
  const [deleteEpisodeConfirmOpen, setDeleteEpisodeConfirmOpen] = useState(false);
  const ep = (episodios || []).find(x => x.id === id); if (!ep) return <Empty text="No encontrado" />;
  const pg_ = (programas || []).find(x => x.id === ep.pgId);
  const mv = (movimientos || []).filter(m => m.eid === id); const b = bal(id);
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
        {canDo && canDo("programas") && <><GBtn onClick={() => openM("ep", ep)}>✏ Editar</GBtn><DBtn onClick={() => setDeleteEpisodeConfirmOpen(true)}>🗑</DBtn></>}
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
    <ConfirmActionDialog
      open={deleteEpisodeConfirmOpen}
      title="Eliminar episodio"
      message="¿Eliminar episodio?"
      confirmLabel="Eliminar episodio"
      onClose={() => setDeleteEpisodeConfirmOpen(false)}
      onConfirm={() => {
        setDeleteEpisodeConfirmOpen(false);
        cDel(episodios, setEpisodios, id, () => navTo("pg-det", ep.pgId), "Episodio eliminado");
      }}
    />
  </div>;
}

export function ViewPiezaDet(props) {
  const {
    id, empresa, user, clientes, piezas, movimientos, crew, navTo, openM, canDo, cDel, setPiezas,
    useBal, fmtM, fmtD, ComentariosBlock,
  } = props;
  const empId = empresa?.id;
  const canManageContent = !!(canDo && canDo("contenidos"));
  const bal = useBal(movimientos, empId);
  const [tab, setTab] = useState(0);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const campaign = (piezas || []).find(item => (Array.isArray(item?.piezas) ? item.piezas : []).some(piece => piece.id === id));
  const piece = (Array.isArray(campaign?.piezas) ? campaign.piezas : []).find(item => item.id === id);
  if (!campaign || !piece) return <Empty text="No encontrado" />;
  const cli = (clientes || []).find(item => item.id === campaign.cliId);
  const b = bal(campaign.id);
  const pCrew = (crew || []).filter(item => item.empId === empId && (campaign.crewIds || []).includes(item.id));
  const crewMap = Object.fromEntries((crew || []).filter(item => item && item.id).map(item => [item.id, item]));
  const portalDecision = piece.clientPortalDecision || null;
  const previewUrl = resolvePiecePrimaryPreview(piece);
  const previewIsImage = isImagePreviewUrl(previewUrl);
  const clientPortalBadge = decision => {
    if (!decision?.status) return null;
    return <Badge label={decision.status === "approved" ? "Cliente aprobó" : "Cliente pidió cambios"} color={decision.status === "approved" ? "green" : "orange"} sm />;
  };
  const savePiece = async nextPiece => {
    if (!canManageContent) return;
    const next = (piezas || []).map(item => item.id !== campaign.id ? item : {
      ...item,
      piezas: (item.piezas || []).map(row => row.id === nextPiece.id ? nextPiece : row),
    });
    await setPiezas(next);
  };
  const deletePiece = async () => {
    if (!canManageContent) return;
    const next = (piezas || []).map(item => item.id !== campaign.id ? item : {
      ...item,
      piezas: (item.piezas || []).filter(row => row.id !== id),
    });
    await setPiezas(next);
    navTo("contenido-det", campaign.id);
  };
  return <div>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 52, height: 52, background: "var(--cg)", border: "1px solid var(--cm)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ fontSize: 8, color: "var(--cy)", fontWeight: 700, letterSpacing: 1 }}>PZA</div>
          <div style={{ fontFamily: "var(--fm)", fontSize: 18, fontWeight: 700, color: "var(--cy)", lineHeight: 1 }}>{String(piece.mes || campaign.mes || "—").slice(0, 3).toUpperCase()}</div>
        </div>
        <div>
          <div style={{ fontFamily: "var(--fh)", fontSize: 22, fontWeight: 800 }}>{piece.nom}</div>
          <div style={{ fontSize: 12, color: "var(--gr2)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span onClick={() => navTo("contenido-det", campaign.id)} style={{ color: "var(--cy)", cursor: "pointer" }}>{campaign.nom}</span>
            <Badge label={piece.est || "Planificado"} />
            {clientPortalBadge(portalDecision)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <GBtn onClick={() => navTo("contenido-det", campaign.id)}>← Volver a campaña</GBtn>
        {canManageContent && <><GBtn onClick={() => openM("pieza", { ...piece, campId: campaign.id })}>✏ Editar</GBtn><DBtn onClick={() => setDeleteConfirmOpen(true)}>🗑</DBtn></>}
      </div>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
      <Stat label="Estado" value={piece.est || "Planificado"} accent="var(--cy)" />
      <Stat label="Aprobación" value={piece.approval || "Pendiente"} accent={(piece.approval || "Pendiente") === "Aprobada" ? "#00e08a" : (piece.approval || "Pendiente") === "Observada" ? "#ff5566" : "#ffcc44"} vc={(piece.approval || "Pendiente") === "Aprobada" ? "#00e08a" : (piece.approval || "Pendiente") === "Observada" ? "#ff5566" : "#ffcc44"} />
      <Stat label="Publicación" value={piece.publishDate ? fmtD(piece.publishDate) : "—"} accent="#8b5cf6" />
      <Stat label="Campaña" value={campaign.piezas?.length || 0} sub={`${campaign.piezas?.length || 0} pieza(s) en ${campaign.nom}`} accent="#4f7cff" vc="#4f7cff" />
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(320px,.8fr)", gap: 16, marginBottom: 20 }}>
      <Card title="Vista principal" sub="La versión que hoy estamos usando para revisión y conversación con el cliente.">
        <div style={{ display: "grid", gap: 14 }}>
          {previewUrl ? (
            previewIsImage ? (
              <img src={previewUrl} alt={piece.nom} style={{ width: "100%", minHeight: 300, maxHeight: 520, objectFit: "cover", borderRadius: 18, border: "1px solid var(--bdr)" }} />
            ) : (
              <div style={{ borderRadius: 18, border: "1px solid var(--bdr)", background: "linear-gradient(180deg,var(--sur),var(--card2))", minHeight: 260, display: "grid", placeItems: "center", padding: 24 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 42, marginBottom: 10 }}>PDF</div>
                  <div style={{ fontSize: 13, color: "var(--gr2)", marginBottom: 10 }}>{piece.previewAssetName || "Documento de revisión"}</div>
                  <a href={previewUrl} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", fontWeight: 700, textDecoration: "none" }}>Abrir archivo ↗</a>
                </div>
              </div>
            )
          ) : (
            <div style={{ borderRadius: 18, border: "1px dashed var(--bdr2)", background: "linear-gradient(180deg,var(--sur),var(--card2))", minHeight: 260, display: "grid", placeItems: "center", padding: 24, color: "var(--gr2)", textAlign: "center" }}>
              <div>
                <div style={{ fontSize: 38, marginBottom: 10, opacity: 0.45 }}>◫</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--gr3)" }}>Todavía no hay preview cargado</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Puedes subir una imagen o PDF desde editar pieza para que el portal cliente vea esta versión.</div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {piece.previewAssetUrl ? <GBtn onClick={() => window.open(piece.previewAssetUrl, "_blank", "noreferrer")}>Abrir preview portal</GBtn> : null}
            {piece.link ? <GBtn onClick={() => window.open(piece.link, "_blank", "noreferrer")}>Abrir trabajo</GBtn> : null}
            {piece.finalLink ? <GBtn onClick={() => window.open(piece.finalLink, "_blank", "noreferrer")}>Abrir final</GBtn> : null}
            {canManageContent ? <Btn onClick={() => openM("pieza", { ...piece, campId: campaign.id })}>Actualizar pieza</Btn> : null}
          </div>
        </div>
      </Card>
      <Card title="Estado de revisión" sub="Lo más importante para saber dónde está esta pieza hoy.">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "var(--sur)", border: "1px solid var(--bdr)" }}>
            <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, fontWeight: 700 }}>Estado interno</div>
            <div style={{ marginTop: 8 }}><Badge label={piece.est || "Planificado"} /></div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "var(--sur)", border: "1px solid var(--bdr)" }}>
            <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, fontWeight: 700 }}>Aprobación</div>
            <div style={{ marginTop: 8 }}><Badge label={piece.approval || "Pendiente"} color={(piece.approval || "Pendiente") === "Aprobada" ? "green" : (piece.approval || "Pendiente") === "Observada" ? "red" : (piece.approval || "Pendiente") === "En revisión" ? "yellow" : "gray"} /></div>
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "var(--sur)", border: "1px solid var(--bdr)" }}>
            <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, fontWeight: 700 }}>Respuesta del cliente</div>
            <div style={{ marginTop: 8 }}>{clientPortalBadge(portalDecision) || <span style={{ fontSize: 12, color: "var(--gr2)" }}>Sin respuesta todavía</span>}</div>
            {portalDecision?.comment ? <div style={{ fontSize: 12, color: "var(--gr2)", lineHeight: 1.6, marginTop: 10 }}>{portalDecision.comment}</div> : null}
            {portalDecision?.requestedChanges ? <div style={{ fontSize: 12, color: "var(--org)", lineHeight: 1.6, marginTop: 10 }}>{portalDecision.requestedChanges}</div> : null}
          </div>
          <div style={{ padding: "14px 16px", borderRadius: 16, background: "color-mix(in srgb, var(--card) 82%, var(--cy) 18%)", border: "1px solid var(--bdr)" }}>
            <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.1, fontWeight: 700 }}>Responsable y tiempos</div>
            <div style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.7, marginTop: 8 }}>
              <div><b style={{ color: "var(--wh)" }}>Responsable:</b> {piece.responsableId && crewMap[piece.responsableId] ? crewMap[piece.responsableId].nom : "Sin responsable"}</div>
              <div><b style={{ color: "var(--wh)" }}>Entrega:</b> {piece.fin ? fmtD(piece.fin) : "Por definir"}</div>
              <div><b style={{ color: "var(--wh)" }}>Publicación:</b> {piece.publishDate ? fmtD(piece.publishDate) : "Sin fecha"}</div>
            </div>
          </div>
        </div>
      </Card>
    </div>
    <Tabs tabs={["Resumen", "Brief y texto", "Comentarios"]} active={tab} onChange={setTab} />
    {tab === 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Resumen">
        <KV label="Cliente" value={cli?.nom || "—"} />
        <KV label="Campaña" value={campaign.nom || "—"} />
        <KV label="Formato" value={piece.formato || "—"} />
        <KV label="Plataforma" value={piece.plataforma || "—"} />
        <KV label="Mes" value={piece.mes || campaign.mes || "—"} />
        <KV label="Responsable" value={piece.responsableId && crewMap[piece.responsableId] ? crewMap[piece.responsableId].nom : "—"} />
        <KV label="Respuesta cliente" value={clientPortalBadge(portalDecision) || "Sin respuesta todavía"} />
      </Card>
      <Card title="Fechas y enlaces">
        <KV label="Inicio" value={piece.ini ? fmtD(piece.ini) : "—"} />
        <KV label="Entrega" value={piece.fin ? fmtD(piece.fin) : "—"} />
        <KV label="Publicación estimada" value={piece.publishDate ? fmtD(piece.publishDate) : "—"} />
        <KV label="Publicación real" value={piece.publishedAt ? fmtD(piece.publishedAt) : "—"} />
        <KV label="Preview portal" value={piece.previewAssetUrl ? <a href={piece.previewAssetUrl} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", textDecoration: "none", fontWeight: 700 }}>{piece.previewAssetName || "Abrir archivo"} ↗</a> : "—"} />
        <KV label="Link de trabajo" value={piece.link ? <a href={piece.link} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", textDecoration: "none", fontWeight: 700 }}>Abrir ↗</a> : "—"} />
        <KV label="Link final" value={piece.finalLink ? <a href={piece.finalLink} target="_blank" rel="noreferrer" style={{ color: "var(--cy)", textDecoration: "none", fontWeight: 700 }}>Abrir ↗</a> : "—"} />
      </Card>
    </div>}
    {tab === 1 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <Card title="Brief">
        <KV label="Objetivo" value={piece.objetivo || "—"} />
        <KV label="CTA" value={piece.cta || "—"} />
        <div style={{ fontSize: 12, color: "var(--gr3)", whiteSpace: "pre-line", lineHeight: 1.6, marginTop: 12 }}>{piece.brief || piece.des || "—"}</div>
        {portalDecision?.status ? <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 12, background: "var(--sur)", border: "1px solid var(--bdr)", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--wh)" }}>Respuesta del cliente</div>
            {clientPortalBadge(portalDecision)}
          </div>
          {portalDecision.additionalBrief ? <div><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Brief adicional</div><div style={{ fontSize: 12, color: "var(--gr2)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{portalDecision.additionalBrief}</div></div> : null}
          {portalDecision.comment ? <div><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Comentario</div><div style={{ fontSize: 12, color: "var(--gr2)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{portalDecision.comment}</div></div> : null}
          {portalDecision.requestedChanges ? <div><div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Corrección solicitada</div><div style={{ fontSize: 12, color: "var(--gr2)", whiteSpace: "pre-line", lineHeight: 1.6 }}>{portalDecision.requestedChanges}</div></div> : null}
        </div> : null}
      </Card>
      <Card title="Texto y publicación">
        <KV label="Hashtags" value={piece.hashtags || "—"} />
        <div style={{ fontSize: 12, color: "var(--gr3)", whiteSpace: "pre-line", lineHeight: 1.6, marginTop: 12 }}>{piece.copy || "—"}</div>
      </Card>
    </div>}
    {tab === 2 && <ComentariosBlock
      items={piece.comentarios || []}
      onSave={async comentarios => {
        if (!canManageContent) return;
        await savePiece({ ...piece, comentarios });
      }}
      crewOptions={pCrew}
      canEdit={canManageContent}
      title="Comentarios de la pieza"
      empresa={empresa}
      currentUser={user}
    />}
    <ConfirmActionDialog
      open={deleteConfirmOpen}
      title="Eliminar pieza"
      message="¿Eliminar pieza?"
      confirmLabel="Eliminar pieza"
      onClose={() => setDeleteConfirmOpen(false)}
      onConfirm={() => {
        setDeleteConfirmOpen(false);
        void deletePiece();
      }}
    />
  </div>;
}

export function ViewPgDet(props) {
  const {
    id, empresa, user, clientes, producciones, programas, piezas, episodios, auspiciadores, movimientos, crew, eventos, tareas, navTo, openM, canDo, cDel, saveMov, delMov, setProgramas, setEventos, setTareas, ntf,
    useBal, fmtM, fmtD, ini, ComentariosBlock, MovBlock, MiniCal, TareasContexto, exportMovCSV, exportMovPDF, exportEpisodiosPDF, normalizeTaskAssignees, getAssignedIds, AusCard,
    today = helperToday, uid = helperUid,
  } = props;
  const empId = empresa?.id;
  const tasksEnabled = hasAddon(empresa, "tareas");
  const canManagePrograms = !!(canDo && canDo("programas"));
  const canManageMoves = !!(canDo && canDo("movimientos"));
  const canManageCalendar = !!(canDo && canDo("calendario"));
  const bal = useBal(movimientos, empId);
  const [tab, setTab] = useState(0);
  const [deleteProgramConfirmOpen, setDeleteProgramConfirmOpen] = useState(false);
  const [epQ, setEpQ] = useState(""); const [epF, setEpF] = useState(""); const [epSort, setEpSort] = useState("num-asc"); const [epPg, setEpPg] = useState(1); const EPP = 8;
  const [exportingEpisodesPdf, setExportingEpisodesPdf] = useState(false);
  const pg_ = (programas || []).find(x => x.id === id); if (!pg_) return <Empty text="No encontrado" />;
  const eps = (episodios || []).filter(e => e.pgId === id).sort((a, b) => a.num - b.num);
  const aus = (auspiciadores || []).filter(a => (a.pids || []).includes(id));
  const b = bal(id); const mv = (movimientos || []).filter(m => m.eid === id);
  const tauz = aus.reduce((s, a) => s + Number(a.mon || 0), 0);
  const epStats = { plan: eps.filter(e => e.estado === "Planificado").length, grab: eps.filter(e => e.estado === "Grabado").length, edit: eps.filter(e => e.estado === "En Edición").length, prog: eps.filter(e => e.estado === "Programado").length, pub: eps.filter(e => e.estado === "Publicado").length, can: eps.filter(e => e.estado === "Cancelado").length };
  const fdEps = eps.filter(e => (!epF || e.estado === epF) && (e.titulo.toLowerCase().includes(epQ.toLowerCase()) || (e.invitado || "").toLowerCase().includes(epQ.toLowerCase()))).sort((a, b) => {
    if (epSort === "title-asc") return String(a.titulo || "").localeCompare(String(b.titulo || ""));
    if (epSort === "title-desc") return String(b.titulo || "").localeCompare(String(a.titulo || ""));
    if (epSort === "date-desc") return String(b.fechaGrab || b.fechaEmision || "").localeCompare(String(a.fechaGrab || a.fechaEmision || ""));
    if (epSort === "date-asc") return String(a.fechaGrab || a.fechaEmision || "").localeCompare(String(b.fechaGrab || b.fechaEmision || ""));
    if (epSort === "num-desc") return Number(b.num || 0) - Number(a.num || 0);
    return Number(a.num || 0) - Number(b.num || 0);
  });
  const downloadEpisodesPdf = async () => {
    if (!exportEpisodiosPDF || exportingEpisodesPdf) return;
    setExportingEpisodesPdf(true);
    try {
      await exportEpisodiosPDF(fdEps, pg_, empresa);
      ntf && ntf("PDF de episodios descargado");
    } catch (error) {
      console.error("No se pudo descargar el PDF de episodios", error);
      ntf && ntf("No se pudo generar el PDF de episodios");
    } finally {
      setExportingEpisodesPdf(false);
    }
  };
  const pCrew = (crew || []).filter(x => x.empId === empId && (pg_.crewIds || []).includes(x.id));
  const addCrew = async crId => { if (!canManagePrograms) return; const next = (programas || []).map(x => x.id === id ? { ...x, crewIds: [...(x.crewIds || []), crId] } : x); await setProgramas(next); };
  const remCrew = async crId => { if (!canManagePrograms) return; const next = (programas || []).map(x => x.id === id ? { ...x, crewIds: (x.crewIds || []).filter(i => i !== crId) } : x); await setProgramas(next); };
  const cliAsoc = (clientes || []).find(x => x.id === pg_.cliId);
  return <div>
    <DetHeader title={pg_.nom} tag={pg_.tip} badges={[<Badge key={0} label={pg_.est} />]} meta={[pg_.can, pg_.fre, pg_.temporada && `Temp: ${pg_.temporada}`, pg_.conductor && `🎙 ${pg_.conductor}`, cliAsoc && `Cliente: ${cliAsoc.nom}`].filter(Boolean)} des={pg_.des}
      actions={canManagePrograms && <><GBtn onClick={() => openM("pg", pg_)}>✏ Editar</GBtn><DBtn onClick={() => setDeleteProgramConfirmOpen(true)}>🗑</DBtn></>} />
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
        <GBtn sm onClick={downloadEpisodesPdf}>{exportingEpisodesPdf ? "Generando..." : "⬇ PDF estado"}</GBtn>
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
    {tab === 6 && <MiniCal refId={id} eventos={eventos || []} onAdd={() => openM("evento", { ref: id, refTipo: "programa" })} onEdit={ev => openM("evento", ev)} onDel={async evId => { if (!canManageCalendar) return; await setEventos((eventos || []).filter(x => x.id !== evId)); }} canEdit={canManageCalendar} titulo={pg_.nom} />}
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
    <ConfirmActionDialog
      open={deleteProgramConfirmOpen}
      title="Eliminar producción"
      message="¿Eliminar producción y episodios?"
      confirmLabel="Eliminar producción"
      onClose={() => setDeleteProgramConfirmOpen(false)}
      onConfirm={() => {
        setDeleteProgramConfirmOpen(false);
        if (!canManagePrograms) return;
        cDel(programas, setProgramas, id, () => navTo("programas"), "Eliminado");
      }}
    />
  </div>;
}

export function ViewAus(props) {
  const { empresa, clientes, auspiciadores, programas, openM, canDo, cDel, setAuspiciadores, listas, fmtM, fmtD, AusCard, isMobile = false } = props;
  const empId = empresa?.id;
  const canManageSponsors = !!(canDo && canDo("auspiciadores"));
  const [q, setQ] = useState("");
  const [ft, setFt] = useState("");
  const [fp, setFp] = useState("");
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [vista, setVista] = useState(() => (isMobile ? "cards" : "list"));
  const [pg, setPg] = useState(1);
  const [detailId, setDetailId] = useState("");
  const PP = 9;
  const fd = (auspiciadores || []).filter(x => x.empId === empId).filter(a => {
    const linkedClient = (clientes || []).find(client => client.id === (a.clientId || a.cliId || a.linkedClientId));
    return (
      a.nom.toLowerCase().includes(q.toLowerCase())
      || (a.con || "").toLowerCase().includes(q.toLowerCase())
      || (linkedClient?.nom || "").toLowerCase().includes(q.toLowerCase())
    ) && (!ft || a.tip === ft) && (!fp || (a.pids || []).includes(fp));
  }).sort((a, b) => {
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
      <DBtn sm onClick={() => setBulkDeleteConfirmOpen(true)}>Eliminar seleccionados</DBtn>
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    {vista === "cards" ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 12 }}>
      {fd.slice((pg - 1) * PP, pg * PP).map(a => {
        const pgs = (a.pids || []).map(pid => (programas || []).find(x => x.id === pid)).filter(Boolean);
        const linkedClient = (clientes || []).find(client => client.id === (a.clientId || a.cliId || a.linkedClientId));
        return <div key={a.id} onClick={() => setDetailId(a.id)} style={{ cursor: "pointer" }}><AusCard a={a} pgs={pgs} linkedClientName={linkedClient?.nom || ""} onEdit={canManageSponsors ? () => openM("aus", a) : null} onDel={canManageSponsors ? () => cDel(auspiciadores, setAuspiciadores, a.id, null, "Auspiciador eliminado") : null} /></div>;
      })}
    </div> : <Card>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleAll(e.target.checked); }} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Auspiciador</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Producciones</TH><TH>Contacto</TH><TH onClick={() => setSortMode(sortMode === "amount-desc" ? "amount-asc" : "amount-desc")} active={sortMode === "amount-desc" || sortMode === "amount-asc"} dir={sortMode === "amount-desc" ? "desc" : "asc"}>Monto</TH><TH onClick={() => setSortMode(sortMode === "oldest" ? "recent" : "oldest")} active={sortMode === "recent" || sortMode === "oldest"} dir={sortMode === "recent" ? "desc" : "asc"}>Vigencia</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg - 1) * PP, pg * PP).map(a => { const pgs = (a.pids || []).map(pid => (programas || []).find(x => x.id === pid)?.nom).filter(Boolean); const linkedClient = (clientes || []).find(client => client.id === (a.clientId || a.cliId || a.linkedClientId)); return <tr key={a.id} onClick={e => { if (e.target.closest("input,button,select,label,a")) return; setDetailId(a.id); }} style={{ cursor: "pointer" }}>
            <TD onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(a.id)} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onChange={e => { e.stopPropagation(); toggleSelected(a.id); }} /></TD>
            <TD bold style={{ color: "var(--cy)" }}>{a.nom}</TD>
            <TD style={{ fontSize: 11 }}>{linkedClient?.nom || "Sin cliente vinculado"}</TD>
            <TD><Badge label={a.tip} sm /></TD>
            <TD style={{ fontSize: 11 }}>{pgs.join(", ") || "—"}</TD>
            <TD style={{ fontSize: 11 }}>{[a.con, a.ema].filter(Boolean).join(" · ") || "—"}</TD>
            <TD style={{ fontFamily: "var(--fm)", fontSize: 12, color: "var(--cy)" }}>{a.mon ? fmtM(a.mon) : "—"}</TD>
            <TD style={{ fontSize: 11 }}>{a.vig ? fmtD(a.vig) : "—"}</TD>
            <TD onClick={e => e.stopPropagation()}><div style={{ display: "flex", gap: 4 }}><GBtn sm onClick={() => setDetailId(a.id)}>Ver</GBtn>{canManageSponsors && <><GBtn sm onClick={e => { e.stopPropagation(); openM("aus", a); }}>✏</GBtn><XBtn onClick={e => { e.stopPropagation(); cDel(auspiciadores, setAuspiciadores, a.id, null, "Auspiciador eliminado"); }} /></>}</div></TD>
          </tr>; })}
          {!fd.length && <tr><td colSpan={9}><Empty text="Sin auspiciadores" /></td></tr>}
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
            <KV label="Cliente vinculado" value={(clientes || []).find(client => client.id === (detail.clientId || detail.cliId || detail.linkedClientId))?.nom || "Sin cliente vinculado"} />
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
    <ConfirmActionDialog
      open={bulkDeleteConfirmOpen}
      title="Eliminar auspiciadores"
      message={`¿Eliminar ${selectedIds.length} auspiciador${selectedIds.length === 1 ? "" : "es"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`}
      confirmLabel="Eliminar seleccionados"
      onClose={() => setBulkDeleteConfirmOpen(false)}
      onConfirm={() => {
        setBulkDeleteConfirmOpen(false);
        if (!canDo || !canDo("auspiciadores")) return;
        setAuspiciadores((auspiciadores || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}
    />
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
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
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
  const canEditMember = () => canManageCrew;
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
      {canManageCrew && <DBtn sm onClick={() => setBulkDeleteConfirmOpen(true)}>Eliminar seleccionados</DBtn>}
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
    <ConfirmActionDialog
      open={bulkDeleteConfirmOpen}
      title="Eliminar miembros"
      message={(() => {
        const removable = (crew || []).filter(item => selectedIds.includes(item.id) && !item?.managedByUser);
        if (!removable.length) return "No hay seleccionados eliminables.";
        return `¿Eliminar ${removable.length} miembro${removable.length === 1 ? "" : "s"} seleccionado${removable.length === 1 ? "" : "s"}?`;
      })()}
      confirmLabel="Eliminar seleccionados"
      onClose={() => setBulkDeleteConfirmOpen(false)}
      onConfirm={() => {
        const removable = (crew || []).filter(item => selectedIds.includes(item.id) && !item?.managedByUser);
        setBulkDeleteConfirmOpen(false);
        if (!removable.length) return;
        setCrew((crew || []).filter(item => !removable.some(rem => rem.id === item.id)));
        setSelectedIds([]);
      }}
    />
  </div>;
}

export function ViewActivos(props) {
  const { empresa, activos, crew = [], users = [], listas, openM, canDo, cDel, setActivos, setCrew, setListas, fmtM, fmtD } = props;
  const empId = empresa?.id;
  const canManageAssets = !!(canDo && canDo("activos"));
  const [q, setQ] = useState("");
  const [fc, setFc] = useState("");
  const [fe, setFe] = useState("");
  const [fs, setFs] = useState("");
  const [fp, setFp] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [newCollaborator, setNewCollaborator] = useState({ nom: "", rol: "", ema: "", tel: "" });
  const [sortMode, setSortMode] = useState("recent");
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkEstado, setBulkEstado] = useState("");
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [vista, setVista] = useState("list");
  const [pg, setPg] = useState(1);
  const PP = 10;
  const CATS = listas?.catActivos || DEFAULT_LISTAS.catActivos;
  const ESTADOS = listas?.estadosActivos || DEFAULT_LISTAS.estadosActivos;
  const currentAssets = (activos || []).filter(x => x.empId === empId);
  const resolveAssetPerson = asset => {
    const personId = asset?.assignedPersonId || asset?.personaId || "";
    const personType = asset?.assignedPersonType || asset?.personaTipo || "";
    const fromCrew = (crew || []).find(item => String(item.id) === String(personId));
    const fromUser = (users || []).find(item => String(item.id) === String(personId));
    const person = personType === "user" ? fromUser || fromCrew : fromCrew || fromUser;
    return asset?.collaboratorName || asset?.assignedPersonName || asset?.personaNombre || person?.nom || person?.name || person?.email || "";
  };
  const branchOptions = Array.from(new Set([
    ...(listas?.sucursalesActivos || DEFAULT_LISTAS.sucursalesActivos || []),
    ...currentAssets.map(item => item.sucursal || item.branchName || item.location),
  ].map(item => String(item || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const collaboratorOptions = Array.from(new Set(currentAssets.map(item => resolveAssetPerson(item)).map(item => String(item || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const fd = currentAssets.filter(a => {
    const personName = resolveAssetPerson(a);
    const branchName = a.sucursal || a.branchName || a.location || "";
    const haystack = [a.nom, a.marca, a.modelo, a.serial, personName, branchName].join(" ").toLowerCase();
    return haystack.includes(q.toLowerCase()) && (!fc || a.categoria === fc) && (!fe || a.estado === fe) && (!fs || branchName === fs) && (!fp || personName === fp);
  }).sort((a, b) => {
    if (sortMode === "az") return String(a.nom || "").localeCompare(String(b.nom || ""));
    if (sortMode === "za") return String(b.nom || "").localeCompare(String(a.nom || ""));
    if (sortMode === "value-desc") return Number(b.valorCompra || 0) - Number(a.valorCompra || 0);
    if (sortMode === "value-asc") return Number(a.valorCompra || 0) - Number(b.valorCompra || 0);
    if (sortMode === "oldest") return String(a.fechaCompra || a.cr || "").localeCompare(String(b.fechaCompra || b.cr || ""));
    return String(b.fechaCompra || b.cr || "").localeCompare(String(a.fechaCompra || a.cr || ""));
  });
  const totalValor = fd.reduce((s, a) => s + Number(a.valorCompra || 0), 0);
  const dispCount = fd.filter(a => a.estado === "Disponible").length;
  const assignedCount = fd.filter(a => (a.estado === "Asignado" || a.estado === "En Uso" || resolveAssetPerson(a))).length;
  const branchCount = new Set(fd.map(a => a.sucursal || a.branchName || a.location).filter(Boolean)).size;
  const statColor = s => ({ Disponible: "#00e08a", Asignado: "var(--cy)", "En Uso": "var(--cy)", "En Mantención": "#ffcc44", Dañado: "#ff8844", Baja: "#ff5566", "Dado de Baja": "#ff5566" }[s] || "var(--gr2)");
  const toggleSelected = id => setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleAll = checked => setSelectedIds(checked ? fd.slice((pg - 1) * PP, pg * PP).map(item => item.id) : []);
  const addBranch = () => {
    const name = String(newBranchName || "").trim();
    if (!name || !setListas) return;
    setListas(prev => {
      const base = prev || listas || {};
      const nextBranches = Array.from(new Set([...(base.sucursalesActivos || DEFAULT_LISTAS.sucursalesActivos || []), name]));
      return { ...base, sucursalesActivos: nextBranches };
    });
    setNewBranchName("");
  };
  const addCollaborator = () => {
    const name = String(newCollaborator.nom || "").trim();
    if (!name || !setCrew) return;
    const member = {
      id: helperUid(),
      empId,
      nom: name,
      rol: String(newCollaborator.rol || "").trim() || "Colaborador",
      area: "Operación",
      tipo: "interno",
      ema: String(newCollaborator.ema || "").trim(),
      tel: String(newCollaborator.tel || "").trim(),
      dis: "",
      tarifa: "",
      not: "Creado desde Gestión de Activos.",
      active: true,
      source: "assets",
    };
    setCrew(prev => [...(Array.isArray(prev) ? prev : crew || []), member]);
    setNewCollaborator({ nom: "", rol: "", ema: "", tel: "" });
  };
  return <div>
    <ModuleHeader
      module="Activos"
      title="Gestión de activos"
      description="Controla licencias, equipos, computadores y entregables por sucursal, estado y colaborador asignado."
      actions={canManageAssets ? <Btn onClick={() => openM("activo", {})}>+ Nuevo Activo</Btn> : null}
    />
    {canManageAssets && <Card title="Maestros de activos" sub="Crea sucursales y colaboradores antes de asignar activos." style={{ marginBottom: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        <div style={{ border: "1px solid var(--bdr2)", borderRadius: 16, padding: 14, background: "linear-gradient(180deg,#ffffff,#f8fbff)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--wh)", marginBottom: 8 }}>Sucursales</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <FI value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="Ej: Casa matriz, Bodega, Oficina Lima" />
            <GBtn sm onClick={addBranch}>Crear</GBtn>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {branchOptions.slice(0, 10).map(branch => <Badge key={branch} label={branch} color="blue" sm />)}
            {!branchOptions.length && <span style={{ fontSize: 11, color: "var(--gr2)" }}>Aún no hay sucursales creadas.</span>}
          </div>
        </div>
        <div style={{ border: "1px solid var(--bdr2)", borderRadius: 16, padding: 14, background: "linear-gradient(180deg,#ffffff,#f8fbff)" }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--wh)", marginBottom: 8 }}>Colaboradores</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 8 }}>
            <FI value={newCollaborator.nom} onChange={e => setNewCollaborator(prev => ({ ...prev, nom: e.target.value }))} placeholder="Nombre" />
            <FI value={newCollaborator.rol} onChange={e => setNewCollaborator(prev => ({ ...prev, rol: e.target.value }))} placeholder="Rol" />
            <FI value={newCollaborator.ema} onChange={e => setNewCollaborator(prev => ({ ...prev, ema: e.target.value }))} placeholder="Correo" />
            <FI value={newCollaborator.tel} onChange={e => setNewCollaborator(prev => ({ ...prev, tel: e.target.value }))} placeholder="Teléfono" />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 10 }}>
            <span style={{ fontSize: 11, color: "var(--gr2)" }}>Se crea activo y sincronizado con Crew.</span>
            <GBtn sm onClick={addCollaborator}>Crear colaborador</GBtn>
          </div>
        </div>
      </div>
    </Card>}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 20 }}>
      <Stat label="Total Activos" value={fd.length} accent="var(--cy)" vc="var(--cy)" />
      <Stat label="Disponibles" value={dispCount} accent="#00e08a" vc="#00e08a" />
      <Stat label="Asignados" value={assignedCount} accent="var(--cy)" vc="var(--cy)" />
      <Stat label="Sucursales" value={branchCount} accent="#9d6cff" vc="#9d6cff" />
      <Stat label="Valor Total" value={fmtM(totalValor)} accent="#ffcc44" vc="#ffcc44" />
    </div>
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
      <SearchBar value={q} onChange={v => { setQ(v); setPg(1); }} placeholder="Buscar activo, marca, sucursal o colaborador..." />
      <FilterSel value={fc} onChange={v => { setFc(v); setPg(1); }} options={CATS} placeholder="Todas categorías" />
      <FilterSel value={fe} onChange={v => { setFe(v); setPg(1); }} options={ESTADOS} placeholder="Todo estados" />
      <FilterSel value={fs} onChange={v => { setFs(v); setPg(1); }} options={branchOptions} placeholder="Todas sucursales" />
      <FilterSel value={fp} onChange={v => { setFp(v); setPg(1); }} options={collaboratorOptions} placeholder="Todos colaboradores" />
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
      {canManageAssets && <DBtn sm onClick={() => setBulkDeleteConfirmOpen(true)}>Eliminar seleccionados</DBtn>}
      <GBtn sm onClick={() => setSelectedIds([])}>Limpiar selección</GBtn>
    </div>}
    <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      {ESTADOS.map(s => { const cnt = (activos || []).filter(a => a.empId === empId && a.estado === s).length; return <div key={s} onClick={() => setFe(fe === s ? "" : s)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, border: `1px solid ${fe === s ? statColor(s) : "var(--bdr2)"}`, background: fe === s ? statColor(s) + "22" : "transparent", cursor: "pointer", fontSize: 11, fontWeight: 600, color: fe === s ? statColor(s) : "var(--gr3)" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: statColor(s), flexShrink: 0 }} />{s} ({cnt})</div>; })}
    </div>
    {vista === "cards" ? <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 12 }}>
        {fd.slice((pg - 1) * PP, pg * PP).map(a => { const personName = resolveAssetPerson(a); const branchName = a.sucursal || a.branchName || a.location || ""; return <div key={a.id} style={{ background: "var(--card)", border: "1px solid var(--bdr)", borderRadius: 14, padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25 }}>{a.nom}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{[a.marca, a.modelo].filter(Boolean).join(" · ") || "Sin marca/modelo"}</div>
            </div>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: statColor(a.estado) + "22", color: statColor(a.estado), border: `1px solid ${statColor(a.estado)}40` }}>{a.estado || "—"}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <Badge label={a.categoria || "Sin categoría"} color="gray" sm />
            <Badge label={branchName || "Sin sucursal"} color="blue" sm />
            {a.serial && <Badge label={`SN ${a.serial}`} color="cyan" sm />}
          </div>
          <div style={{ fontSize: 11, color: "var(--gr2)", display: "grid", gap: 5 }}>
            <span>Colaborador: {personName || "Sin colaborador asignado"}</span>
            <span>Sucursal: {branchName || "Sin sucursal"}</span>
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
          <thead><tr><TH style={{ width: 36 }}><input type="checkbox" checked={fd.slice((pg - 1) * PP, pg * PP).length > 0 && fd.slice((pg - 1) * PP, pg * PP).every(item => selectedIds.includes(item.id))} onChange={e => toggleAll(e.target.checked)} /></TH><TH onClick={() => setSortMode(sortMode === "az" ? "za" : "az")} active={sortMode === "az" || sortMode === "za"} dir={sortMode === "za" ? "desc" : "asc"}>Nombre</TH><TH>Categoría</TH><TH>Sucursal</TH><TH>Marca/Modelo</TH><TH>N° Serie</TH><TH>Estado</TH><TH>Colaborador</TH><TH onClick={() => setSortMode(sortMode === "value-desc" ? "value-asc" : "value-desc")} active={sortMode === "value-desc" || sortMode === "value-asc"} dir={sortMode === "value-desc" ? "desc" : "asc"}>Valor</TH><TH></TH></tr></thead>
          <tbody>
            {fd.slice((pg - 1) * PP, pg * PP).map(a => { const personName = resolveAssetPerson(a); const branchName = a.sucursal || a.branchName || a.location || ""; return <tr key={a.id}>
              <TD><input type="checkbox" checked={selectedIds.includes(a.id)} onChange={() => toggleSelected(a.id)} /></TD>
              <TD bold>{a.nom}</TD>
              <TD><Badge label={a.categoria || "—"} color="gray" sm /></TD>
              <TD style={{ fontSize: 12 }}>{branchName || <span style={{ color: "var(--gr)" }}>Sin sucursal</span>}</TD>
              <TD style={{ fontSize: 12 }}>{[a.marca, a.modelo].filter(Boolean).join(" · ") || "—"}</TD>
              <TD mono style={{ fontSize: 11 }}>{a.serial || "—"}</TD>
              <TD><span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: statColor(a.estado) + "22", color: statColor(a.estado), border: `1px solid ${statColor(a.estado)}40` }}>{a.estado || "—"}</span></TD>
              <TD style={{ fontSize: 12 }}>{personName || <span style={{ color: "var(--gr)" }}>Sin colaborador</span>}</TD>
              <TD mono style={{ fontSize: 12 }}>{a.valorCompra ? fmtM(a.valorCompra) : "—"}</TD>
              <TD><div style={{ display: "flex", gap: 4 }}>
                {canManageAssets && <><GBtn sm onClick={() => openM("activo", a)}>✏</GBtn><XBtn onClick={() => cDel(activos, setActivos, a.id, null, "Activo eliminado")} /></>}
              </div></TD>
            </tr>; })}
            {!fd.length && <tr><td colSpan={10}><Empty text="Sin activos registrados" sub={canDo && canDo("activos") ? "Registra el primero con el botón superior" : ""} /></td></tr>}
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
    <ConfirmActionDialog
      open={bulkDeleteConfirmOpen}
      title="Eliminar activos"
      message={`¿Eliminar ${selectedIds.length} activo${selectedIds.length === 1 ? "" : "s"} seleccionado${selectedIds.length === 1 ? "" : "s"}?`}
      confirmLabel="Eliminar seleccionados"
      onClose={() => setBulkDeleteConfirmOpen(false)}
      onConfirm={() => {
        setBulkDeleteConfirmOpen(false);
        setActivos((activos || []).filter(item => !selectedIds.includes(item.id)));
        setSelectedIds([]);
      }}
    />
  </div>;
}
