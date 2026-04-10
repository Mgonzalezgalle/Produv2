import React, { useState } from "react";
import { Badge } from "../../lib/ui/components";

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
