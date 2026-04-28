import { useState } from "react";
import { Btn, Card, Empty, FG, FTA, GBtn, XBtn } from "../../lib/ui/components";
import { COLS_TAREAS, getAssignedIds, PRIO_BG, PRIO_COLORS, taskRecurrenceLabel } from "../../lib/utils/tasks";
import { requestConfirm } from "../../lib/ui/confirmService";
import { TaskErrorBoundary } from "../shared/CoreFeedback";
import { ActivityTimelineCard } from "../shared/ActivityTimelineCard";

const COMMENT_KIND_OPTIONS = [
  { value: "note", label: "Nota", tone: "var(--gr2)" },
  { value: "follow_up", label: "Seguimiento", tone: "var(--cy)" },
  { value: "decision", label: "Acuerdo", tone: "#00e08a" },
  { value: "risk", label: "Riesgo", tone: "#ff5566" },
  { value: "meeting", label: "Reunión", tone: "#a78bfa" },
];

function commentKindMeta(kind = "note") {
  return COMMENT_KIND_OPTIONS.find(option => option.value === kind) || COMMENT_KIND_OPTIONS[0];
}

function commentSortDate(item = {}) {
  return String(item?.upd || item?.cr || "");
}

function normalizeCommentItem(item = {}, normalizeCommentAttachments) {
  const source = String(item?.source || "").trim();
  const assigned = [...new Set(getAssignedIds(item).filter(Boolean))];
  return {
    ...item,
    kind: item?.kind || (source === "diio" ? "meeting" : "note"),
    important: item?.important === true,
    assignedIds: assigned,
    asignadoA: assigned[0] || item?.asignadoA || "",
    attachments: normalizeCommentAttachments(item),
    source,
  };
}

export function TareaCard({ tarea, producciones, programas, piezas, oportunidades, crew, onEdit, onDelete, onChangeEstado, onOpen, canEdit=true, draggable=false, onDragStart, onDragEnd }) {
  const ref = tarea.refTipo==="pro"
    ? (producciones||[]).find(x=>x.id===tarea.refId)
    : tarea.refTipo==="pg"
      ? (programas||[]).find(x=>x.id===tarea.refId)
      : tarea.refTipo==="pz"
        ? (piezas||[]).find(x=>x.id===tarea.refId)
        : tarea.refTipo==="crm"
          ? (oportunidades||[]).find(x=>x.id===tarea.refId)
          : tarea.refTipo==="crew"
            ? (crew||[]).find(x=>x.id===tarea.refId)
            : null;
  const asigs = getAssignedIds(tarea).map(id => (crew||[]).find(x=>x.id===id)).filter(Boolean);
  const isDone = ["Completada", "Finalizada"].includes(tarea.estado);
  const venc = tarea.fechaLimite ? Math.ceil((new Date(tarea.fechaLimite+"T12:00:00") - new Date()) / (1000*60*60*24)) : null;
  const vencColor = isDone ? "#00e08a" : venc===null ? "var(--gr2)" : venc<0 ? "#ff5566" : venc<=2 ? "#fbbf24" : "var(--gr2)";
  const refLabel = ref?.nom || ref?.name || ref?.titulo || "Referencia";
  return (
    <div
      draggable={draggable}
      onDragStart={e=>onDragStart&&onDragStart(e,tarea)}
      onDragEnd={e=>onDragEnd&&onDragEnd(e,tarea)}
      onClick={()=>onOpen&&onOpen(tarea)}
      style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:14,marginBottom:10,cursor:onOpen?"pointer":"default",transition:".15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--cy)"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}
    >
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:PRIO_BG[tarea.prioridad]||"var(--bdr)",color:PRIO_COLORS[tarea.prioridad]||"var(--gr2)"}}>{tarea.prioridad||"Media"}</span>
        <div style={{display:"flex",gap:4}}>
          {canEdit&&<>
            <GBtn sm onClick={e=>{e.stopPropagation();onEdit(tarea);}}>✏</GBtn>
            <XBtn onClick={e=>{e.stopPropagation();onDelete(tarea.id);}}/>
          </>}
        </div>
      </div>
      <div style={{fontSize:13,fontWeight:600,color:"var(--wh)",marginBottom:6,lineHeight:1.4}}>{tarea.titulo}</div>
      {tarea.desc&&<div style={{fontSize:11,color:"var(--gr2)",marginBottom:8,lineHeight:1.5}}>{tarea.desc}</div>}
      {ref&&<div style={{fontSize:11,color:"var(--cy)",marginBottom:6}}>
        {tarea.refTipo==="pro"?"📽":tarea.refTipo==="pg"?"📺":tarea.refTipo==="pz"?"📱":tarea.refTipo==="crm"?"🧲":"🎬"} {refLabel}
      </div>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid var(--bdr)"}}>
        {asigs.length
          ? <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{display:"flex",alignItems:"center"}}>
                {asigs.slice(0,3).map((asig,idx)=><div key={asig.id} style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--bg)",flexShrink:0,marginLeft:idx? -6:0,border:"2px solid var(--card)"}}>{asig.nom?.charAt(0)||"?"}</div>)}
              </div>
              <span style={{fontSize:11,color:"var(--gr2)"}}>{asigs.map(x=>x.nom).join(", ")}</span>
            </div>
          : <span style={{fontSize:11,color:"var(--gr)",fontStyle:"italic"}}>Sin asignar</span>}
        {venc!==null&&<span style={{fontSize:10,fontWeight:600,color:vencColor}}>
          {isDone ? "Finalizada" : venc<0?`Vencida hace ${Math.abs(venc)}d`:venc===0?"Vence hoy":venc===1?"Vence mañana":`${venc}d`}
        </span>}
      </div>
      {taskRecurrenceLabel(tarea) && (
        <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "var(--cy)", letterSpacing: 0.4, textTransform: "uppercase" }}>
          {taskRecurrenceLabel(tarea)}
        </div>
      )}
      {canEdit&&<div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
        {COLS_TAREAS.filter(c=>c!==tarea.estado).map(c=>(
          <button key={c} onClick={e=>{e.stopPropagation();onChangeEstado(tarea.id,c);}}
            style={{fontSize:10,padding:"2px 8px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr2)",cursor:"pointer",transition:".1s"}}
            onMouseEnter={e=>{e.target.style.borderColor="var(--cy)";e.target.style.color="var(--cy)";}}
            onMouseLeave={e=>{e.target.style.borderColor="var(--bdr2)";e.target.style.color="var(--gr2)";}}>
            → {c}
          </button>
        ))}
      </div>}
    </div>
  );
}

export function ComentariosBlock({ items = [], onSave, canEdit, title = "Comentarios", onCreateTask, crewOptions = [], empresa, currentUser, helpers }) {
  const { commentAttachmentFromFile, normalizeCommentAttachments, getAssignedIds, uid, today, fmtD, exportComentariosCSV, exportComentariosPDF } = helpers;
  const [txt,setTxt]=useState("");
  const [editingId,setEditingId]=useState(null);
  const [pasarATarea,setPasarATarea]=useState(false);
  const [assignedIds,setAssignedIds]=useState([]);
  const [attachments,setAttachments]=useState([]);
  const [kind,setKind]=useState("note");
  const [important,setImportant]=useState(false);
  const [query,setQuery]=useState("");
  const [kindFilter,setKindFilter]=useState("");
  const [assignedFilter,setAssignedFilter]=useState("");
  const [importantOnly,setImportantOnly]=useState(false);
  const crewMap = Object.fromEntries((crewOptions||[]).filter(c=>c&&c.id).map(c=>[c.id,c]));
  const normalizedItems = (items||[]).map(item => normalizeCommentItem(item, normalizeCommentAttachments));
  const sortedItems = [...normalizedItems].sort((a,b)=>{
    if (a.important !== b.important) return a.important ? -1 : 1;
    return commentSortDate(b).localeCompare(commentSortDate(a));
  });
  const filteredItems = sortedItems.filter(item => {
    const haystack = [item.text, item.authorName, item.source === "diio" ? "diio" : ""].join(" ").toLowerCase();
    const matchesQuery = !query || haystack.includes(query.toLowerCase());
    const matchesKind = !kindFilter || item.kind === kindFilter;
    const matchesAssigned = !assignedFilter || item.assignedIds.includes(assignedFilter);
    const matchesImportant = !importantOnly || item.important;
    return matchesQuery && matchesKind && matchesAssigned && matchesImportant;
  });
  const summary = normalizedItems.reduce((acc, item) => {
    acc.total += 1;
    if (item.important) acc.important += 1;
    if ((item.attachments || []).length) acc.withAttachments += 1;
    if (item.assignedIds.length) acc.assigned += 1;
    return acc;
  }, { total: 0, important: 0, withAttachments: 0, assigned: 0 });
  const resetForm=()=>{setTxt("");setEditingId(null);setPasarATarea(false);setAssignedIds([]);setAttachments([]);setKind("note");setImportant(false);};
  const loadAttachments=async files=>{
    const nextAttachments = await Promise.all(Array.from(files||[]).slice(0,6).map(commentAttachmentFromFile));
    setAttachments(prev=>[...prev,...nextAttachments.filter(Boolean)].slice(0,6));
  };
  const toggleAssigned = id => setAssignedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const submit=async()=>{
    const val=txt.trim();
    if(!val) return;
    const prevItem=editingId?normalizedItems.find(it=>it.id===editingId):null;
    const normalizedAssigned = [...new Set(assignedIds.filter(Boolean))];
    const normalizedAttachments = normalizeCommentAttachments({ attachments });
    const commentItem=editingId
      ? {...prevItem,text:val,kind,important,pasarATarea,assignedIds:normalizedAssigned,asignadoA:normalizedAssigned[0]||"",attachments:normalizedAttachments,photos:normalizedAttachments.filter(att=>att.type==="image"),upd:today()}
      : {id:uid(),text:val,kind,important,pasarATarea,assignedIds:normalizedAssigned,asignadoA:normalizedAssigned[0]||"",attachments:normalizedAttachments,photos:normalizedAttachments.filter(att=>att.type==="image"),cr:today(),authorId:currentUser?.id||"",authorName:currentUser?.name||"Usuario"};
    const next=editingId ? normalizedItems.map(it=>it.id===editingId?commentItem:it) : [commentItem,...normalizedItems];
    await onSave(next);
    if(pasarATarea && onCreateTask && !prevItem?.pasarATarea) await onCreateTask(commentItem);
    resetForm();
  };
  const editItem=it=>{setTxt(it.text||"");setEditingId(it.id);setPasarATarea(it.pasarATarea===true);setAssignedIds(getAssignedIds(it));setAttachments(normalizeCommentAttachments(it));setKind(it.kind||"note");setImportant(it.important===true);};
  const delItem=async id=>{
    const confirmed = await requestConfirm({
      title: "Eliminar comentario",
      message: "¿Eliminar comentario?",
      confirmLabel: "Eliminar",
    });
    if(!confirmed) return;
    await onSave(normalizedItems.filter(it=>it.id!==id));
    if(editingId===id) resetForm();
  };
  return <Card title={title}>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      {!!normalizedItems.length&&<GBtn sm onClick={()=>exportComentariosCSV(normalizedItems,title)}>⬇ Exportar CSV</GBtn>}
      {!!normalizedItems.length&&<GBtn sm onClick={()=>exportComentariosPDF(normalizedItems,title,empresa)}>⬇ Exportar PDF</GBtn>}
    </div>
    {!!normalizedItems.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:8,marginBottom:14}}>
      <div style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",fontWeight:700}}>Total</div><div style={{fontSize:18,fontWeight:800,color:"var(--wh)"}}>{summary.total}</div></div>
      <div style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",fontWeight:700}}>Importantes</div><div style={{fontSize:18,fontWeight:800,color:"#ffcc44"}}>{summary.important}</div></div>
      <div style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",fontWeight:700}}>Con adjuntos</div><div style={{fontSize:18,fontWeight:800,color:"var(--cy)"}}>{summary.withAttachments}</div></div>
      <div style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}><div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",fontWeight:700}}>Asignados</div><div style={{fontSize:18,fontWeight:800,color:"#00e08a"}}>{summary.assigned}</div></div>
    </div>}
    {!!normalizedItems.length&&<div style={{display:"grid",gridTemplateColumns:"minmax(220px,1fr) repeat(2,minmax(160px,.6fr)) auto",gap:8,marginBottom:14,alignItems:"center"}}>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por texto o autor..." style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--wh)"}} />
      <select value={kindFilter} onChange={e=>setKindFilter(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--wh)"}}>
        <option value="">Todos los tipos</option>
        {COMMENT_KIND_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <select value={assignedFilter} onChange={e=>setAssignedFilter(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--wh)"}}>
        <option value="">Todos los asignados</option>
        {(crewOptions||[]).map(member=><option key={member.id} value={member.id}>{member.nom}</option>)}
      </select>
      <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:11,color:"var(--gr2)",cursor:"pointer",justifySelf:"end"}}>
        <input type="checkbox" checked={importantOnly} onChange={e=>setImportantOnly(e.target.checked)}/>
        Solo importantes
      </label>
    </div>}
    {canEdit&&<div style={{marginBottom:16}}>
      <FTA value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Escribe una nota o comentario relevante..."/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:10}}>
        <FG label="Tipo de comentario">
          <select value={kind} onChange={e=>setKind(e.target.value)} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--wh)"}}>
            {COMMENT_KIND_OPTIONS.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </FG>
        <FG label="Visibilidad interna">
          <div style={{display:"flex",alignItems:"center",height:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid var(--bdr2)",background:"var(--sur)",color:"var(--gr3)",fontSize:12}}>
            Operativo interno de Produ
          </div>
        </FG>
      </div>
      <div style={{marginTop:10}}>
        <FG label="Asignar comentario a">
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {(crewOptions||[]).map(member=>{
              const active = assignedIds.includes(member.id);
              return <button key={member.id} type="button" onClick={()=>toggleAssigned(member.id)} style={{padding:"8px 10px",borderRadius:999,border:`1px solid ${active?"var(--cy)":"var(--bdr)"}`,background:active?"color-mix(in srgb, var(--cy) 14%, transparent)":"var(--sur)",color:active?"var(--cy)":"var(--gr3)",fontSize:11,fontWeight:700,cursor:"pointer"}}>
                {active?"✓ ":""}{member.nom}
              </button>;
            })}
          </div>
        </FG>
      </div>
      <div style={{marginTop:10}}>
        <FG label="Adjuntos del comentario">
          <input type="file" accept="image/*,application/pdf" multiple onChange={async e=>{await loadAttachments(e.target.files);e.target.value="";}}/>
        </FG>
        {!!attachments.length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:8,marginTop:10}}>
          {attachments.map(att=><div key={att.id} style={{position:"relative",borderRadius:12,overflow:"hidden",border:"1px solid var(--bdr)",background:"var(--sur)"}}>
            {att.type==="pdf"
              ? <div style={{display:"grid",placeItems:"center",height:100,padding:10,textAlign:"center"}}>
                  <div style={{fontSize:28,marginBottom:6}}>📄</div>
                  <div style={{fontSize:10,color:"var(--gr3)",lineHeight:1.4,wordBreak:"break-word"}}>{att.name||"PDF"}</div>
                </div>
              : <img src={att.src} alt={att.name||"Foto comentario"} style={{display:"block",width:"100%",height:100,objectFit:"cover"}}/>}
            <button onClick={()=>setAttachments(prev=>prev.filter(p=>p.id!==att.id))} style={{position:"absolute",top:6,right:6,width:24,height:24,borderRadius:"50%",border:"none",background:"rgba(15,23,42,.84)",color:"#fff",cursor:"pointer"}}>×</button>
          </div>)}
        </div>}
        <div style={{fontSize:10,color:"var(--gr2)",marginTop:6}}>Puedes adjuntar hasta 6 archivos entre imágenes y PDF. Al hacer click en un adjunto guardado se abrirá o descargará.</div>
      </div>
      {!!onCreateTask&&<label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:11,color:"var(--gr2)",marginTop:10,cursor:"pointer"}}>
        <input type="checkbox" checked={pasarATarea} onChange={e=>setPasarATarea(e.target.checked)}/>
        Marcar para pasar a tarea
      </label>}
      <label style={{display:"inline-flex",alignItems:"center",gap:8,fontSize:11,color:"var(--gr2)",marginTop:10,marginLeft:onCreateTask?12:0,cursor:"pointer"}}>
        <input type="checkbox" checked={important} onChange={e=>setImportant(e.target.checked)}/>
        Marcar como importante
      </label>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        {editingId&&<GBtn sm onClick={resetForm}>Cancelar</GBtn>}
        <Btn sm onClick={submit}>{editingId?"Actualizar comentario":"Agregar comentario"}</Btn>
      </div>
    </div>}
    {filteredItems.length?filteredItems.map(it=>{ const kindMeta = commentKindMeta(it.kind); return <div key={it.id} style={{padding:"12px 0",borderTop:"1px solid var(--bdr)"}}>
      <ActivityTimelineCard
        meta={{ label: kindMeta.label, eyebrow: it.source === "diio" ? "Interacción" : "Comentario", accent: kindMeta.tone }}
        headline={it.text?.split("\n")[0]?.trim() || "Comentario sin detalle"}
        secondary={it.authorName ? `Registrado por ${it.authorName}` : "Registro interno"}
        preview={it.text}
        attachments={normalizeCommentAttachments(it)}
        dateLabel={it.upd ? `Editado ${fmtD(it.upd)}` : it.cr ? `Creado ${fmtD(it.cr)}` : ""}
        authorLabel={it.authorName || "Usuario"}
        extraBadges={<>
          {it.pasarATarea&&<span style={{fontSize:10,fontWeight:700,color:"var(--cy)",letterSpacing:.6,textTransform:"uppercase"}}>Pasar a tarea</span>}
          {it.important&&<span style={{fontSize:10,fontWeight:800,padding:"4px 8px",borderRadius:999,background:"rgba(251,191,36,.12)",color:"#fbbf24",border:"1px solid rgba(251,191,36,.4)"}}>Importante</span>}
          {it.source==="diio"&&<span style={{fontSize:10,fontWeight:700,padding:"4px 8px",borderRadius:999,background:"rgba(79,124,255,.12)",color:"#4f7cff",border:"1px solid rgba(79,124,255,.35)"}}>Diio</span>}
        </>}
        footer={!!getAssignedIds(it).length&&<div style={{fontSize:11,color:"var(--cy)"}}>
          Asignado a: {getAssignedIds(it).map(id=>crewMap[id]?.nom).filter(Boolean).join(", ")}
        </div>}
        actions={canEdit&&<div style={{display:"flex",gap:4,flexShrink:0}}><GBtn sm onClick={()=>editItem(it)}>✏</GBtn><XBtn onClick={()=>delItem(it.id)}/></div>}
      />
    </div>; }):<Empty text={normalizedItems.length?"Sin resultados para este filtro":"Sin comentarios"} sub={normalizedItems.length?"Ajusta búsqueda o filtros para ver más comentarios.":canEdit?"Agrega la primera nota para este registro":""}/>}
  </Card>;
}

export function TareasContexto({ title, refTipo, refId, tareas, producciones, programas, piezas, oportunidades, crew, openM, setTareas, canEdit, TareaCardComponent, helpers }) {
  const { uid } = helpers;
  try{
    const safeTareas=Array.isArray(tareas)?tareas.filter(t=>t&&typeof t==="object"):[];
    const items=safeTareas.filter(t=>t.refTipo===refTipo&&t.refId===refId).sort((a,b)=>String(b.cr||"").localeCompare(String(a.cr||"")));
    const changeEstado=async(id,nuevoEstado)=>{
      const next=safeTareas.map(t=>t.id===id?{...t,estado:nuevoEstado}:t);
      await setTareas(next);
    };
    const deleteTarea=async(id)=>{
      const confirmed = await requestConfirm({
        title: "Eliminar tarea",
        message: "¿Eliminar tarea?",
        confirmLabel: "Eliminar",
      });
      if(!confirmed) return;
      const next=safeTareas.filter(t=>t.id!==id);
      await setTareas(next);
    };
    return <TaskErrorBoundary title={title}>
      <Card title={title} action={canEdit?{label:"+ Tarea",fn:()=>openM("tarea",{estado:"Pendiente",refTipo,refId})}:null}>
        {items.length?items.map(t=><TareaCardComponent key={t.id||uid()} tarea={t} producciones={producciones||[]} programas={programas||[]} piezas={piezas||[]} oportunidades={oportunidades||[]} crew={crew||[]} onEdit={canEdit?x=>openM("tarea",x):()=>{}} onDelete={canEdit?deleteTarea:()=>{}} onChangeEstado={canEdit?changeEstado:()=>{}} onOpen={canEdit?x=>openM("tarea",x):undefined} canEdit={canEdit}/>):<Empty text="Sin tareas asociadas" sub={canEdit?"Crea una tarea para darle seguimiento a este registro":""}/>}
      </Card>
    </TaskErrorBoundary>;
  }catch{
    return <Card title={title}>
      <Empty text="No pudimos cargar este bloque de tareas" sub="Usa el módulo general de Tareas mientras normalizamos estos datos."/>
    </Card>;
  }
}
