import { useState } from "react";
import { Btn, Card, Empty, FG, FTA, GBtn, XBtn } from "../../lib/ui/components";
import { COLS_TAREAS, getAssignedIds, PRIO_BG, PRIO_COLORS } from "../../lib/utils/tasks";
import { TaskErrorBoundary } from "../shared/CoreFeedback";

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
            <GBtn sm onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onEdit(tarea);}}>✏</GBtn>
            <XBtn onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onDelete(tarea.id);}}/>
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
      {canEdit&&<div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
        {COLS_TAREAS.filter(c=>c!==tarea.estado).map(c=>(
          <button key={c} type="button" onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onChangeEstado(tarea.id,c);}}
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
  const crewMap = Object.fromEntries((crewOptions||[]).filter(c=>c&&c.id).map(c=>[c.id,c]));
  const resetForm=()=>{setTxt("");setEditingId(null);setPasarATarea(false);setAssignedIds([]);setAttachments([]);};
  const loadAttachments=async files=>{
    const nextAttachments = await Promise.all(Array.from(files||[]).slice(0,6).map(commentAttachmentFromFile));
    setAttachments(prev=>[...prev,...nextAttachments.filter(Boolean)].slice(0,6));
  };
  const toggleAssigned = id => setAssignedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const submit=async()=>{
    const val=txt.trim();
    if(!val) return;
    const prevItem=editingId?items.find(it=>it.id===editingId):null;
    const normalizedAssigned = [...new Set(assignedIds.filter(Boolean))];
    const normalizedAttachments = normalizeCommentAttachments({ attachments });
    const commentItem=editingId
      ? {...prevItem,text:val,pasarATarea,assignedIds:normalizedAssigned,asignadoA:normalizedAssigned[0]||"",attachments:normalizedAttachments,photos:normalizedAttachments.filter(att=>att.type==="image"),upd:today()}
      : {id:uid(),text:val,pasarATarea,assignedIds:normalizedAssigned,asignadoA:normalizedAssigned[0]||"",attachments:normalizedAttachments,photos:normalizedAttachments.filter(att=>att.type==="image"),cr:today(),authorId:currentUser?.id||"",authorName:currentUser?.name||"Usuario"};
    const next=editingId ? items.map(it=>it.id===editingId?commentItem:it) : [commentItem,...items];
    await onSave(next);
    if(pasarATarea && onCreateTask && !prevItem?.pasarATarea) await onCreateTask(commentItem);
    resetForm();
  };
  const editItem=it=>{setTxt(it.text||"");setEditingId(it.id);setPasarATarea(it.pasarATarea===true);setAssignedIds(getAssignedIds(it));setAttachments(normalizeCommentAttachments(it));};
  const delItem=async id=>{
    if(!confirm("¿Eliminar comentario?")) return;
    await onSave(items.filter(it=>it.id!==id));
    if(editingId===id) resetForm();
  };
  return <Card title={title}>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      {!!items.length&&<GBtn sm onClick={()=>exportComentariosCSV(items,title)}>⬇ Exportar CSV</GBtn>}
      {!!items.length&&<GBtn sm onClick={()=>exportComentariosPDF(items,title,empresa)}>⬇ Exportar PDF</GBtn>}
    </div>
    {canEdit&&<div style={{marginBottom:16}}>
      <FTA value={txt} onChange={e=>setTxt(e.target.value)} placeholder="Escribe una nota o comentario relevante..."/>
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
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:8}}>
        {editingId&&<GBtn sm onClick={resetForm}>Cancelar</GBtn>}
        <Btn sm onClick={submit}>{editingId?"Actualizar comentario":"Agregar comentario"}</Btn>
      </div>
    </div>}
    {items.length?items.map(it=><div key={it.id} style={{padding:"12px 0",borderTop:"1px solid var(--bdr)"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
        <div style={{flex:1}}>
          {it.pasarATarea&&<div style={{fontSize:10,fontWeight:700,color:"var(--cy)",marginBottom:6,letterSpacing:.6,textTransform:"uppercase"}}>Pasar a tarea</div>}
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:"var(--wh)"}}>{it.authorName||"Usuario"}</span>
            <span style={{fontSize:10,color:"var(--gr2)"}}>{it.upd?`Editado ${fmtD(it.upd)}`:it.cr?`Creado ${fmtD(it.cr)}`:""}</span>
          </div>
          <div style={{fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line",lineHeight:1.6}}>{it.text}</div>
          {!!normalizeCommentAttachments(it).length&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8,marginTop:10}}>
            {normalizeCommentAttachments(it).map(att=><a key={att.id||att.src} href={att.src} target="_blank" rel="noreferrer" download={att.name||true} style={{display:"block",borderRadius:12,overflow:"hidden",border:"1px solid var(--bdr)",textDecoration:"none",background:"var(--sur)"}}>
              {att.type==="pdf"
                ? <div style={{display:"grid",placeItems:"center",height:110,padding:10,textAlign:"center"}}>
                    <div style={{fontSize:30,marginBottom:8}}>📄</div>
                    <div style={{fontSize:10,color:"var(--gr3)",lineHeight:1.4,wordBreak:"break-word"}}>{att.name||"Documento PDF"}</div>
                    <div style={{fontSize:10,color:"var(--cy)",marginTop:6,fontWeight:700}}>Abrir / Descargar</div>
                  </div>
                : <div style={{position:"relative"}}>
                    <img src={att.src} alt={att.name||"Foto comentario"} style={{display:"block",width:"100%",height:110,objectFit:"cover"}}/>
                    <div style={{position:"absolute",left:8,bottom:8,padding:"4px 8px",borderRadius:999,background:"rgba(15,23,42,.72)",color:"#fff",fontSize:10,fontWeight:700}}>Abrir</div>
                  </div>}
            </a>)}
          </div>}
          {!!getAssignedIds(it).length&&<div style={{fontSize:11,color:"var(--cy)",marginTop:8}}>
            Asignado a: {getAssignedIds(it).map(id=>crewMap[id]?.nom).filter(Boolean).join(", ")}
          </div>}
        </div>
        {canEdit&&<div style={{display:"flex",gap:4,flexShrink:0}}><GBtn sm onClick={()=>editItem(it)}>✏</GBtn><XBtn onClick={()=>delItem(it.id)}/></div>}
      </div>
    </div>):<Empty text="Sin comentarios" sub={canEdit?"Agrega la primera nota para este registro":""}/>}
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
      if(!confirm("¿Eliminar tarea?")) return;
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
