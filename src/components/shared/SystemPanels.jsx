import React, { useState } from "react";
import { Badge } from "../../lib/ui/components";
import { suggestDiioInteractionTargets } from "../../lib/integrations/diioIntegration";
import diioLogoDark from "../../assets/diio-logo-dark.avif";

export function AlertasPanel({ alertas, leidas = [], onMarcar, onMarcarTodas, onOcultar, onOcultarTodas, onClose, fmtD }) {
  const noLeidas = alertas.filter(a=>!leidas.includes(a.id));
  const siLeidas = alertas.filter(a=>leidas.includes(a.id));
  const [filtro,setFiltro]=useState("todas");
  const filteredUnread=noLeidas.filter(a=>filtro==="todas"||a.tipo===filtro||a.area===filtro);
  const counters={
    urgentes:noLeidas.filter(a=>a.tipo==="urgente").length,
    equipo:noLeidas.filter(a=>a.area==="equipo").length,
    comercial:noLeidas.filter(a=>a.area==="comercial").length,
  };
  return (
    <div style={{position:"fixed",top:70,right:20,zIndex:888,width:410,maxWidth:"calc(100vw - 24px)",background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:14,boxShadow:"0 12px 40px #0009",animation:"slideIn .25s ease",overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🔔</span>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Centro de Alertas</div>
            <div style={{fontSize:10,color:"var(--gr2)"}}>{noLeidas.length} sin leer · {alertas.length} total</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {noLeidas.length>0&&<button onClick={onMarcarTodas} style={{fontSize:10,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>✓ Marcar todas</button>}
          {siLeidas.length>0&&<button onClick={onOcultarTodas} style={{fontSize:10,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>🗑 Limpiar leídas</button>}
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:18,padding:2}}>✕</button>
        </div>
      </div>
      <div style={{padding:"12px 16px",borderBottom:"1px solid var(--bdr)",display:"flex",gap:8,flexWrap:"wrap"}}>
        {[["todas","Todas",noLeidas.length],["urgente","Urgentes",counters.urgentes],["equipo","Equipo",counters.equipo],["comercial","Comercial",counters.comercial]].map(([key,label,count])=><button key={key} onClick={()=>setFiltro(key)} style={{padding:"6px 10px",borderRadius:999,border:`1px solid ${filtro===key?"var(--cy)":"var(--bdr2)"}`,background:filtro===key?"var(--cg)":"transparent",color:filtro===key?"var(--cy)":"var(--gr3)",fontSize:11,fontWeight:700,cursor:"pointer"}}>{label} {count?`(${count})`:""}</button>)}
      </div>
      <div style={{maxHeight:420,overflowY:"auto"}}>
        {alertas.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--gr2)",fontSize:13}}>Sin alertas activas</div>}
        {filteredUnread.map(a=>{
          const colores={urgente:["#ff556615","#ff5566"],pronto:["#ffcc4415","#ffcc44"],info:["var(--cg)","var(--cy)"]};
          const [bg]=colores[a.tipo]||["var(--cg)","var(--cy)"];
          return <div key={a.id} style={{display:"flex",gap:10,padding:"12px 16px",borderBottom:"1px solid var(--bdr)",background:bg,alignItems:"flex-start"}}>
            <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{a.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--wh)",lineHeight:1.3}}>{a.titulo}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:3}}>{a.sub} · {fmtD(a.fecha)}</div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                <Badge label={a.area==="comercial"?"Comercial":a.area==="equipo"?"Equipo":"Operación"} color={a.area==="comercial"?"red":a.area==="equipo"?"purple":"cyan"} sm/>
                <Badge label={a.tipo==="urgente"?"Urgente":a.tipo==="pronto"?"Próxima":"Info"} color={a.tipo==="urgente"?"red":a.tipo==="pronto"?"yellow":"gray"} sm/>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
              <button onClick={()=>onMarcar(a.id)} title="Marcar como leída" style={{background:"none",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr2)",cursor:"pointer",fontSize:11,padding:"2px 7px",whiteSpace:"nowrap"}}>✓ Leída</button>
              <button onClick={()=>onOcultar(a.id)} title="Quitar alerta" style={{background:"none",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr2)",cursor:"pointer",fontSize:11,padding:"2px 7px",whiteSpace:"nowrap"}}>🗑 Quitar</button>
            </div>
          </div>;
        })}
        {filteredUnread.length===0&&noLeidas.length>0&&<div style={{padding:18,textAlign:"center",color:"var(--gr2)",fontSize:12}}>No hay alertas en este filtro.</div>}
        {siLeidas.length>0&&<><div style={{padding:"8px 16px",fontSize:10,color:"var(--gr)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,borderBottom:"1px solid var(--bdr)"}}>Ya leídas</div>
        {siLeidas.map(a=><div key={a.id} style={{display:"flex",gap:10,padding:"10px 16px",borderBottom:"1px solid var(--bdr)",opacity:.5,alignItems:"center"}}>
          <span style={{fontSize:14,flexShrink:0}}>✓</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:"var(--gr3)",textDecoration:"line-through"}}>{a.titulo}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{a.sub} · {fmtD(a.fecha)}</div>
          </div>
          <button onClick={()=>onOcultar(a.id)} title="Quitar alerta" style={{background:"none",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr2)",cursor:"pointer",fontSize:11,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>🗑 Quitar</button>
        </div>)}</>}
      </div>
      {noLeidas.length===0&&alertas.length>0&&<div style={{padding:"10px 16px",background:"var(--sur)",borderTop:"1px solid var(--bdr)",textAlign:"center",fontSize:12,color:"var(--gr2)"}}>✓ Todas las alertas están leídas</div>}
    </div>
  );
}

export function SystemMessagesPanel({ empresa, mensajes = [], leidas = [], onMarcar, onMarcarTodas, onClose, fmtD, RichTextBlock }) {
  const noLeidas=(mensajes||[]).filter(m=>!leidas.includes(m.id));
  const leidasMsgs=(mensajes||[]).filter(m=>leidas.includes(m.id));
  const sorted=[...noLeidas,...leidasMsgs].sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  return <div style={{position:"fixed",top:70,right:20,zIndex:887,width:410,maxWidth:"calc(100vw - 24px)",background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:14,boxShadow:"0 12px 40px #0009",animation:"slideIn .25s ease",overflow:"hidden"}}>
    <div style={{padding:"14px 16px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>💬</span>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Mensajes del Sistema</div>
          <div style={{fontSize:10,color:"var(--gr2)"}}>{empresa?.nombre||"Empresa"} · {noLeidas.length} sin leer</div>
        </div>
      </div>
      <div style={{display:"flex",gap:6,alignItems:"center"}}>
        {noLeidas.length>0&&<button onClick={onMarcarTodas} style={{fontSize:10,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>✓ Marcar todas</button>}
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:18,padding:2}}>✕</button>
      </div>
    </div>
    <div style={{maxHeight:420,overflowY:"auto"}}>
      {!sorted.length&&<div style={{padding:24,textAlign:"center",color:"var(--gr2)",fontSize:13}}>Sin mensajes de sistema</div>}
      {sorted.map(m=><div key={m.id} style={{display:"flex",gap:10,padding:"12px 16px",borderBottom:"1px solid var(--bdr)",background:leidas.includes(m.id)?"transparent":"var(--cg)",opacity:leidas.includes(m.id)?0.62:1}}>
        <div style={{width:10,height:10,borderRadius:"50%",background:leidas.includes(m.id)?"var(--bdr2)":"var(--cy)",marginTop:5,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
            <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{m.title||"Mensaje del sistema"}</div>
            <div style={{fontSize:10,color:"var(--gr2)",whiteSpace:"nowrap"}}>{m.createdAt?fmtD(m.createdAt):"—"}</div>
          </div>
          <RichTextBlock text={m.body||""} style={{fontSize:11,color:"var(--gr3)",marginTop:6,lineHeight:1.5}} color="var(--gr3)"/>
        </div>
        {!leidas.includes(m.id)&&<button onClick={()=>onMarcar(m.id)} style={{background:"none",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr2)",cursor:"pointer",fontSize:11,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>✓ Leído</button>}
      </div>)}
    </div>
  </div>;
}

function getDiioSummary(interaction = {}) {
  const summary = String(interaction?.summary || "").trim();
  return summary || "Sin apunte";
}

function getDiioPlaybookLabel(interaction = {}) {
  const playbook = Array.isArray(interaction?.playbook) ? interaction.playbook[0] : null;
  if (!playbook) return "";
  if (typeof playbook === "string") return playbook.trim();
  return String(playbook?.name || playbook?.title || playbook?.label || "").trim();
}

function formatDiioCommitmentLabel(item = {}, fmtD = value => value) {
  if (typeof item === "string") return item;
  const title = String(item?.title || item?.text || item?.value || item?.description || "").trim();
  const owner = [item?.user?.name, item?.user?.email].filter(Boolean).join(" · ");
  const parts = [title];
  if (owner) parts.push(`Responsable: ${owner}`);
  if (item?.deadline) {
    const safeDate = String(item.deadline).slice(0, 10);
    parts.push(`Fecha límite: ${fmtD ? fmtD(safeDate) : safeDate}`);
  }
  if (item?.done === true) parts.push("Realizado");
  return parts.filter(Boolean).join(" · ");
}

export function DiioInboxPanel({
  empresa,
  tenantDiioConnection = {},
  interactions = [],
  targets = {},
  onConfirm,
  onDismiss,
  onRefresh,
  onClose,
  fmtD,
}) {
  const formatParticipantLabel = (participant = {}) => {
    const bits = [];
    const identity = [participant?.name, participant?.email].filter(Boolean).join(" · ");
    if (identity) bits.push(identity);
    if (participant?.role) bits.push(participant.role);
    if (participant?.show === false) bits.push("no asistió");
    if (participant?.speakTime) bits.push(`${participant.speakTime}s hablando`);
    return bits.join(" · ");
  };

  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("pending");
  const normalizedInteractions = (Array.isArray(interactions) ? interactions : []).map(item => ({
    ...item,
    suggestedTargets: item?.suggestedTargets?.length ? item.suggestedTargets : suggestDiioInteractionTargets({
      interaction: item,
      crmOpps: targets.crmOpps,
      producciones: targets.producciones,
      programas: targets.programas,
      piezas: targets.piezas,
    }),
  }));
  const filteredInteractions = normalizedInteractions.filter(item => {
    if (filter === "all") return true;
    if (filter === "confirmed") return item?.matchStatus === "confirmed";
    return item?.matchStatus !== "confirmed";
  });
  const selected = filteredInteractions.find(item => item.id === selectedId) || filteredInteractions[0] || null;
  const pendingCount = normalizedInteractions.filter(item => item?.matchStatus !== "confirmed").length;
  const confirmedCount = normalizedInteractions.filter(item => item?.matchStatus === "confirmed").length;
  const manualTargets = [
    ...((targets.crmOpps || []).map(item => ({ entityType: "crm_opportunity", entityId: item?.id || "", entityLabel: item?.nom || item?.empresaMarca || "Oportunidad CRM", score: 0 }))),
    ...((targets.producciones || []).map(item => ({ entityType: "project", entityId: item?.id || "", entityLabel: item?.nombre || item?.nom || "Proyecto", score: 0 }))),
    ...((targets.programas || []).map(item => ({ entityType: "production", entityId: item?.id || "", entityLabel: item?.nombre || item?.nom || "Producción", score: 0 }))),
    ...((targets.piezas || []).map(item => ({ entityType: "content_campaign", entityId: item?.id || "", entityLabel: item?.nombre || item?.nom || "Campaña", score: 0 }))),
  ].filter(item => item.entityId);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 889, background: "rgba(5,10,18,.62)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "min(1180px, calc(100vw - 32px))", maxHeight: "calc(100vh - 48px)", background: "var(--card)", border: "1px solid var(--bdr2)", borderRadius: 22, boxShadow: "0 30px 90px #000b", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ height: 26, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,.05)", border: "1px solid var(--bdr)" }}>
              <img src={diioLogoDark} alt="Diio" style={{ height: 15, display: "block", objectFit: "contain" }} />
            </span>
            <div>
              <div style={{ fontFamily: "var(--fh)", fontSize: 15, fontWeight: 800 }}>Inbox Diio</div>
              <div style={{ fontSize: 11, color: "var(--gr2)" }}>{empresa?.nombre || "Empresa"} · {pendingCount} pendientes · {confirmedCount} confirmadas</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--gr2)", cursor: "pointer", fontSize: 20, padding: 2, flexShrink: 0 }}>✕</button>
        </div>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--bdr)", fontSize: 12, color: "var(--gr2)", lineHeight: 1.6 }}>
          Diio trae reuniones y llamadas a la empresa. Aquí podemos revisar la sugerencia, confirmar el destino correcto y dejar la interacción en comentarios del módulo adecuado.
        </div>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--bdr)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setFilter("pending")} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${filter === "pending" ? "#ff9933" : "var(--bdr2)"}`, background: filter === "pending" ? "rgba(255,153,51,.14)" : "transparent", color: filter === "pending" ? "#ffcc99" : "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Pendientes</button>
          <button onClick={() => setFilter("confirmed")} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${filter === "confirmed" ? "#ff9933" : "var(--bdr2)"}`, background: filter === "confirmed" ? "rgba(255,153,51,.14)" : "transparent", color: filter === "confirmed" ? "#ffcc99" : "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Confirmadas</button>
          <button onClick={() => setFilter("all")} style={{ padding: "6px 10px", borderRadius: 999, border: `1px solid ${filter === "all" ? "#ff9933" : "var(--bdr2)"}`, background: filter === "all" ? "rgba(255,153,51,.14)" : "transparent", color: filter === "all" ? "#ffcc99" : "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Todas</button>
          <button onClick={() => void onRefresh?.()} style={{ marginLeft: "auto", borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr2)", fontWeight: 700, fontSize: 12, padding: "7px 10px", cursor: "pointer" }}>Actualizar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 0, flex: 1, overflow: "hidden" }}>
          <div style={{ borderRight: "1px solid var(--bdr)", overflowY: "auto", background: "var(--sur)" }}>
            {!filteredInteractions.length && <div style={{ padding: 18, fontSize: 12, color: "var(--gr2)", textAlign: "center" }}>Sin interacciones en este filtro.</div>}
            {filteredInteractions.map(item => {
              const active = selected?.id === item.id;
              const primary = item?.suggestedTargets?.[0] || null;
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  style={{ width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid var(--bdr)", background: active ? "rgba(255,153,51,.12)" : "transparent", padding: 12, cursor: "pointer" }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)", lineHeight: 1.35 }}>{item.title || "Interacción Diio"}</div>
                  <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 4 }}>{item.recordedAt ? fmtD(String(item.recordedAt).slice(0, 10)) : "Sin fecha"} · {item.sourceType || "meeting.finished"}</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                    <Badge label={item.matchStatus === "confirmed" ? "Confirmada" : "Pendiente"} color={item.matchStatus === "confirmed" ? "green" : "yellow"} sm />
                    {primary && <Badge label={`${Math.round((primary.score || 0) * 100)}%`} color="orange" sm />}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    {primary && item.matchStatus !== "confirmed" && (
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          void onConfirm?.(item, primary);
                        }}
                        style={{ borderRadius: 7, border: "1px solid #ff9933", background: "rgba(255,153,51,.14)", color: "#ffcc99", fontWeight: 700, fontSize: 10, padding: "4px 7px", cursor: "pointer" }}
                      >
                        Confirmar sugerida
                      </button>
                    )}
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDismiss?.(item.id);
                      }}
                      style={{ borderRadius: 7, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr2)", fontWeight: 700, fontSize: 10, padding: "4px 7px", cursor: "pointer" }}
                    >
                      Eliminar
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
          <div style={{ padding: 18, overflowY: "auto", minHeight: 0 }}>
            {!selected && <div style={{ fontSize: 12, color: "var(--gr2)" }}>Selecciona una interacción para ver el detalle.</div>}
            {selected && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--wh)", lineHeight: 1.25 }}>{selected.title || "Interacción Diio"}</div>
                    <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{selected.sourceType || "meeting.finished"} · {selected.recordedAt ? fmtD(String(selected.recordedAt).slice(0, 10)) : "Sin fecha"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <Badge label={selected.matchStatus === "confirmed" ? "Confirmada" : "Pendiente"} color={selected.matchStatus === "confirmed" ? "green" : "yellow"} sm />
                    {selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#8dc7ff", textDecoration: "none", fontWeight: 700 }}>Abrir fuente</a>}
                  </div>
                </div>
                {!!getDiioPlaybookLabel(selected) && (
                  <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>
                    Playbook: <span style={{ color: "var(--cy)", fontWeight: 700 }}>{getDiioPlaybookLabel(selected)}</span>
                  </div>
                )}
                <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 6 }}>Apunte de la reunión</div>
                <div style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 14 }}>{getDiioSummary(selected)}</div>
                {!!selected.commitments?.length && (
                  <>
                    <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>Compromisos detectados</div>
                    <div style={{ display: "grid", gap: 6, marginBottom: 14 }}>
                      {selected.commitments.map((item, index) => (
                        <div key={`${selected.id}:commitment:${index}`} style={{ border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 10px", background: "var(--sur)", fontSize: 12, color: "var(--wh)" }}>
                          {formatDiioCommitmentLabel(item, fmtD) || "Compromiso"}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>Participantes</div>
                <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
                  {(selected.participants || []).length
                    ? (selected.participants || []).map((item, index) => (
                        <div key={`${selected.id}:participant:${index}`} style={{ border: "1px solid var(--bdr)", borderRadius: 10, padding: "8px 10px", background: "var(--sur)", fontSize: 12, color: "var(--wh)" }}>
                          {formatParticipantLabel(item) || "Participante Diio"}
                        </div>
                      ))
                    : <div style={{ fontSize: 12, color: "var(--gr2)" }}>Sin participantes reconocidos</div>}
                </div>
                <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>Sugerencias de asociación</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {(selected.suggestedTargets || []).map(target => (
                    <div key={`${target.entityType}:${target.entityId}`} style={{ border: "1px solid var(--bdr)", borderRadius: 12, padding: 12, background: "var(--sur)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wh)" }}>{target.entityLabel}</div>
                          <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{target.entityType} · confianza {Math.round((target.score || 0) * 100)}%</div>
                        </div>
                        <button
                          onClick={() => void onConfirm?.(selected, target)}
                          style={{ borderRadius: 8, border: "1px solid #ff9933", background: "rgba(255,153,51,.15)", color: "#ffcc99", fontWeight: 700, fontSize: 12, padding: "7px 10px", cursor: "pointer" }}
                        >
                          Confirmar
                        </button>
                      </div>
                    </div>
                  ))}
                  {!(selected.suggestedTargets || []).length && <div style={{ fontSize: 12, color: "var(--gr2)", padding: 12, border: "1px dashed var(--bdr2)", borderRadius: 12 }}>Todavía no encontramos un match claro. Puedes asociarla manualmente más abajo.</div>}
                </div>
                <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 16, marginBottom: 8 }}>Asociación manual</div>
                <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto", paddingRight: 4 }}>
                  {manualTargets.map(target => (
                    <div key={`manual:${target.entityType}:${target.entityId}`} style={{ border: "1px solid var(--bdr)", borderRadius: 12, padding: 12, background: "transparent" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wh)" }}>{target.entityLabel}</div>
                          <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 4 }}>{target.entityType}</div>
                        </div>
                        <button
                          onClick={() => void onConfirm?.(selected, target)}
                          style={{ borderRadius: 8, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", fontWeight: 700, fontSize: 12, padding: "7px 10px", cursor: "pointer" }}
                        >
                          Asociar
                        </button>
                      </div>
                    </div>
                  ))}
                  {!manualTargets.length && <div style={{ fontSize: 12, color: "var(--gr2)", padding: 12, border: "1px dashed var(--bdr2)", borderRadius: 12 }}>Esta empresa todavía no tiene registros disponibles para asociar manualmente.</div>}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                  <button onClick={() => void onDismiss?.(selected.id)} style={{ borderRadius: 8, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr2)", fontWeight: 700, fontSize: 12, padding: "7px 10px", cursor: "pointer" }}>Eliminar interacción</button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
