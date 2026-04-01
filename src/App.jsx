// ============================================================
//  PRODU — Gestión de Productoras
//  src/App.jsx  |  Parte 1 de 4: Core + Auth + Layout
// ============================================================
import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE ─────────────────────────────────────────────────
const SB_URL = "https://zpgxbmlzoxxgymsschrd.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwZ3hibWx6b3h4Z3ltc3NjaHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4MTkxODksImV4cCI6MjA5MDM5NTE4OX0.HWIkm-Vm255FFrj07pf3JIYE5MNuZ8tukiLYUDCuZK8";
const sb = createClient(SB_URL, SB_KEY);

async function dbGet(key) {
  try {
    const { data, error } = await sb.from("storage").select("value").eq("key", key).maybeSingle();
    if (error || !data) return null;
    return JSON.parse(data.value);
  } catch { return null; }
}
async function dbSet(key, val) {
  try { await sb.from("storage").upsert({ key, value: JSON.stringify(val) }, { onConflict:"key" }); } catch {}
}

// ── UTILS ────────────────────────────────────────────────────
const uid   = () => "_" + Math.random().toString(36).slice(2,10);
const today = () => new Date().toISOString().split("T")[0];
const ini   = (s="") => s.split(" ").filter(Boolean).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const fmtM  = n => "$" + Number(n||0).toLocaleString("es-CL");
const fmtD  = d => { try { return new Date(d+"T12:00:00").toLocaleDateString("es-CL",{day:"2-digit",month:"short",year:"numeric"}); } catch { return d||"—"; } };

// ── ROLES ────────────────────────────────────────────────────
const ROLES = {
  superadmin:{ label:"Super Admin",   color:"#ff5566" },
  admin:     { label:"Administrador", color:"#00d4e8" },
  productor: { label:"Productor",     color:"#00e08a" },
  comercial: { label:"Comercial",     color:"#ffcc44" },
  viewer:    { label:"Visualizador",  color:"#7c7c8a" },
};
const PERMS = {
  productor:["clientes","producciones","programas","crew","calendario","movimientos","eventos"],
  comercial:["clientes","auspiciadores","contratos","presupuestos","facturacion"],
};
function canDo(user, action) {
  if (!user) return false;
  if (user.role==="superadmin"||user.role==="admin") return true;
  if (user.role==="viewer") return false;
  return PERMS[user.role]?.includes(action)??false;
}

const ADDONS = {
  television:  { label:"Televisión",     icon:"📺" },
  presupuestos:{ label:"Presupuestos",   icon:"📋" },
  facturacion: { label:"Facturación",    icon:"🧾" },
  activos:     { label:"Gestión Activos",icon:"📦" },
  contratos:   { label:"Contratos",      icon:"📄" },
  crew:        { label:"Equipo / Crew",  icon:"🎬" },
};

// ── LISTAS ADMINISTRABLES — valores por defecto ─────────────
const DEFAULT_LISTAS = {
  tiposPro:    ["Programa de TV","Podcast","Contenido Audiovisual","Spot Publicitario","Documental","Web Series","Videoclip","Evento","Otro"],
  catMov:      ["General","Honorarios","Equipamiento","Locación","Post-Producción","Transporte","Alimentación","Marketing","Producción","Impuestos","Otros"],
  industriasCli:["Retail","Tecnología","Salud","Educación","Entretenimiento","Gastronomía","Inmobiliaria","Servicios","Media","Gobierno","Banca","Energía","Otro"],
  catActivos:  ["Cámara","Lente","Iluminación","Sonido","Estabilizador","Monitor","Storage","Computación","Transporte","Set Dressing","Drone","Accesorio","Otro"],
};

// ── SEED ─────────────────────────────────────────────────────
const SEED_EMPRESAS = [
  { id:"emp1", nombre:"Play Media SpA",        rut:"78.118.348-2", dir:"Av. Providencia 1234, Santiago", tel:"+56 2 2345 6789", ema:"contacto@playmedia.cl",  logo:"", color:"#00d4e8", addons:["television","presupuestos","facturacion","activos","contratos","crew"], active:true, plan:"pro",     cr:today() },
  { id:"emp2", nombre:"González & Asociados",  rut:"78.171.372-4", dir:"Las Condes 456, Santiago",       tel:"+56 9 8765 4321", ema:"info@gonzalez.cl",       logo:"", color:"#00e08a", addons:["presupuestos"],                        active:true, plan:"starter", cr:today() },
];
const SEED_USERS = [
  { id:"u0", name:"Super Admin Produ", email:"super@produ.cl",      password:"super123", role:"superadmin", empId:null,   active:true },
  { id:"u1", name:"Admin Play Media",  email:"admin@playmedia.cl",  password:"admin123", role:"admin",      empId:"emp1", active:true },
  { id:"u2", name:"María Productora",  email:"maria@playmedia.cl",  password:"prod123",  role:"productor",  empId:"emp1", active:true },
  { id:"u3", name:"Carlos Comercial",  email:"carlos@playmedia.cl", password:"com123",   role:"comercial",  empId:"emp1", active:true },
  { id:"u4", name:"Admin González",    email:"admin@gonzalez.cl",   password:"gonz123",  role:"admin",      empId:"emp2", active:true },
];
const SEED_DATA = (empId) => ({
  clientes: empId==="emp1"?[
    { id:"c1",empId,nom:"BancoSeguro S.A.", rut:"96.543.210-0",ind:"Servicios", dir:"Huérfanos 1234",not:"Cliente desde 2023",contactos:[{id:"cc1",nom:"Andrea Morales",car:"Gerente Mktg",ema:"amorales@bancoseguro.cl",tel:"+56 9 8765 4321",not:""}]},
    { id:"c2",empId,nom:"FoodTech Chile",   rut:"77.123.456-7",ind:"Gastronomía",dir:"Providencia 456",not:"",contactos:[{id:"cc2",nom:"Carlos Ibáñez",car:"CEO",ema:"carlos@foodtech.cl",tel:"+56 9 9876 5432",not:""}]},
    { id:"c3",empId,nom:"EduFutura S.A.",   rut:"65.432.100-1",ind:"Educación", dir:"Las Condes 789", not:"Contrato anual",contactos:[{id:"cc3",nom:"Valentina Ríos",car:"Dir. Comunicaciones",ema:"v.rios@edufutura.cl",tel:"+56 9 1234 5678",not:"Contacto principal"}]},
  ]:[
    { id:"c10",empId,nom:"Cliente González 1",rut:"11.111.111-1",ind:"Tecnología",dir:"",not:"",contactos:[{id:"cc10",nom:"Juan Pérez",car:"Gerente",ema:"juan@cliente.cl",tel:"+56 9 0000 0001",not:""}]},
  ],
  producciones: empId==="emp1"?[
    { id:"p1",empId,nom:"Podcast BancoSeguro",cliId:"c1",tip:"Podcast",            est:"En Curso",       ini:"2025-03-01",fin:"2025-06-30",des:"8 episodios sobre finanzas.",crewIds:[]},
    { id:"p2",empId,nom:"Spots FoodTech Q2",  cliId:"c2",tip:"Spot Publicitario",  est:"Post-Producción",ini:"2025-04-01",fin:"2025-05-15",des:"3 spots 30 seg.",crewIds:[]},
    { id:"p3",empId,nom:"Pack EduFutura",      cliId:"c3",tip:"Contenido Audiovisual",est:"En Curso",    ini:"2025-01-01",fin:"2025-12-31",des:"4 videos + reels/mes.",crewIds:[]},
  ]:[],
  programas: empId==="emp1"?[
    { id:"pg1",empId,nom:"Chile Emprende",tip:"Programa de TV",can:"Canal 24H", est:"Activo",totalEp:24,fre:"Semanal",temporada:"T1 2025",conductor:"Roberto Gómez",prodEjec:"María González",des:"Emprendimiento e innovación.",cliId:"",crewIds:[]},
    { id:"pg2",empId,nom:"El Ágora",      tip:"Podcast",       can:"Spotify",   est:"Activo",totalEp:52,fre:"Semanal",temporada:"T1 2025",conductor:"Ana Ruiz",       prodEjec:"Carlos Pérez",   des:"Cultura y sociedad.",        cliId:"",crewIds:[]},
  ]:[],
  episodios: empId==="emp1"?[
    {id:"ep1",empId,pgId:"pg1",num:1,titulo:"Los nuevos emprendedores",  estado:"Publicado",  fechaGrab:"2025-01-10",fechaEmision:"2025-01-15",invitado:"Pedro Vargas",  locacion:"Estudio A",duracion:"45",notas:"",crewIds:[]},
    {id:"ep2",empId,pgId:"pg1",num:2,titulo:"Financiamiento pymes",       estado:"Publicado",  fechaGrab:"2025-01-17",fechaEmision:"2025-01-22",invitado:"Laura Méndez",  locacion:"Estudio A",duracion:"42",notas:"",crewIds:[]},
    {id:"ep3",empId,pgId:"pg1",num:3,titulo:"Marketing digital",          estado:"Grabado",    fechaGrab:"2025-01-24",fechaEmision:"2025-01-29",invitado:"Andrés Solís",   locacion:"Estudio B",duracion:"38",notas:"Pendiente color.",crewIds:[]},
    {id:"ep4",empId,pgId:"pg1",num:4,titulo:"E-commerce LATAM",           estado:"En Edición", fechaGrab:"2025-01-31",fechaEmision:"2025-02-05",invitado:"Carmen Torres",  locacion:"Estudio A",duracion:"50",notas:"",crewIds:[]},
    {id:"ep5",empId,pgId:"pg1",num:5,titulo:"Startups sociales",          estado:"Planificado", fechaGrab:"2025-02-07",fechaEmision:"2025-02-12",invitado:"Por confirmar",  locacion:"Estudio A",duracion:"45",notas:"",crewIds:[]},
    {id:"ep6",empId,pgId:"pg2",num:1,titulo:"¿Qué es ciudadanía?",        estado:"Publicado",  fechaGrab:"2025-02-03",fechaEmision:"2025-02-07",invitado:"Prof. I. Matta", locacion:"Estudio P",duracion:"62",notas:"",crewIds:[]},
    {id:"ep7",empId,pgId:"pg2",num:2,titulo:"Humanidades s.XXI",          estado:"Planificado", fechaGrab:"2025-02-17",fechaEmision:"2025-02-21",invitado:"Por confirmar",  locacion:"Estudio P",duracion:"60",notas:"",crewIds:[]},
  ]:[],
  auspiciadores: empId==="emp1"?[
    {id:"a1",empId,nom:"Banco Estado",tip:"Auspiciador Principal",  con:"Pablo Muñoz",  ema:"pmunoz@bce.cl",   tel:"",pids:["pg1"],       mon:"2500000",vig:"2025-12-31",est:"Activo",frecPago:"Mensual",   not:"Logo + menciones"},
    {id:"a2",empId,nom:"Entel",       tip:"Auspiciador Secundario", con:"Lucía Torres", ema:"ltorres@entel.cl",tel:"",pids:["pg1","pg2"],mon:"1200000",vig:"2025-06-30",est:"Activo",frecPago:"Semestral", not:"Banner + mención"},
  ]:[],
  contratos: empId==="emp1"?[
    {id:"ct1",empId,nom:"Podcast BancoSeguro 2025",cliId:"c1",tip:"Producción",est:"Firmado",mon:"9000000", vig:"2025-06-30",arc:"",not:"8 episodios, 2 cuotas"},
    {id:"ct2",empId,nom:"EduFutura Anual 2025",     cliId:"c3",tip:"Servicio",  est:"Vigente",mon:"14400000",vig:"2025-12-31",arc:"",not:"12 meses"},
  ]:[],
  movimientos: empId==="emp1"?[
    {id:"m1",empId,eid:"p1",et:"pro",tipo:"ingreso",mon:4500000,des:"Cuota 1 BancoSeguro",cat:"General",   fec:"2025-03-15"},
    {id:"m2",empId,eid:"p1",et:"pro",tipo:"ingreso",mon:4500000,des:"Cuota 2 BancoSeguro",cat:"General",   fec:"2025-04-15"},
    {id:"m3",empId,eid:"p1",et:"pro",tipo:"gasto",  mon:800000, des:"Arriendo estudio",   cat:"Locación",  fec:"2025-03-20"},
    {id:"m4",empId,eid:"p2",et:"pro",tipo:"ingreso",mon:6000000,des:"Anticipo 50%",        cat:"General",   fec:"2025-04-05"},
    {id:"m5",empId,eid:"p2",et:"pro",tipo:"gasto",  mon:1200000,des:"Equipo cámara 4K",   cat:"Equip.",    fec:"2025-04-08"},
    {id:"m6",empId,eid:"p3",et:"pro",tipo:"ingreso",mon:1200000,des:"Mensualidad Enero",   cat:"General",   fec:"2025-01-31"},
    {id:"m7",empId,eid:"p3",et:"pro",tipo:"ingreso",mon:1200000,des:"Mensualidad Febrero", cat:"General",   fec:"2025-02-28"},
    {id:"m8",empId,eid:"pg1",et:"pg",tipo:"ingreso",mon:2500000,des:"Auspicio BCE Q1",    cat:"General",   fec:"2025-01-15"},
    {id:"m9",empId,eid:"pg1",et:"pg",tipo:"ingreso",mon:1200000,des:"Auspicio Entel Q1",  cat:"General",   fec:"2025-01-20"},
    {id:"m10",empId,eid:"pg1",et:"pg",tipo:"gasto", mon:600000, des:"Prod. eps 1-4",       cat:"Honorarios",fec:"2025-01-30"},
    {id:"m11",empId,eid:"ep1",et:"ep",tipo:"gasto", mon:180000, des:"Maquillaje ep.1",     cat:"Producción",fec:"2025-01-10"},
    {id:"m12",empId,eid:"ep1",et:"ep",tipo:"gasto", mon:120000, des:"Catering ep.1",       cat:"Alimentación",fec:"2025-01-10"},
  ]:[],
  crew: empId==="emp1"?[
    {id:"cr1",empId,nom:"Roberto Gómez",rol:"Conductor",         area:"Producción",tel:"+56 9 1111 2222",ema:"roberto@playmedia.cl",dis:"Lun-Vie",tarifa:"$200.000/día",not:"Host Chile Emprende",active:true},
    {id:"cr2",empId,nom:"Felipe Mora",  rol:"Director de Cámara",area:"Técnica",   tel:"+56 9 3333 4444",ema:"felipe@playmedia.cl", dis:"Lun-Sáb",tarifa:"$150.000/día",not:"",active:true},
    {id:"cr3",empId,nom:"Carla Vega",   rol:"Editora",            area:"Postprod.", tel:"+56 9 4444 5555",ema:"carla@playmedia.cl",  dis:"Mar-Vie",tarifa:"$120.000/día",not:"DaVinci Resolve",active:true},
    {id:"cr4",empId,nom:"Martín Díaz",  rol:"Sonidista",          area:"Técnica",   tel:"+56 9 5555 6666",ema:"martin@playmedia.cl", dis:"Lun-Vie",tarifa:"$100.000/día",not:"",active:true},
  ]:[],
  eventos:[],presupuestos:[],facturas:[],activos:[],
});

// ── DB HOOK ──────────────────────────────────────────────────
function useDB(key, initial=null) {
  const [data,setData]=useState(initial);
  const [loading,setLoading]=useState(true);
  const saving=useRef(false);
  const loaded=useRef(false);
  useEffect(()=>{
    if(!key) return;
    if(loaded.current) return;
    loaded.current=true;
    setLoading(true);
    dbGet(key).then(v=>{ if(v!==null) setData(v); setLoading(false); });
  },[key]);
  const save=useCallback(async d=>{
    saving.current=true; setData(d);
    await dbSet(key,d);
    await new Promise(r=>setTimeout(r,1500));
    saving.current=false;
  },[key]);
  return [data,save,saving,loading];
}
function usePoll(key,setter,savingRef,ms=20000){
  useEffect(()=>{
    if(!key) return;
    const t=setInterval(async()=>{ if(savingRef?.current) return; const v=await dbGet(key); if(v!==null) setter(v); },ms);
    return()=>clearInterval(t);
  },[key]);
}

// ── CSS ──────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
:root{
  --bg:#080809;--sur:#0f0f11;--card:#141416;--card2:#1a1a1e;
  --bdr:#1e1e24;--bdr2:#28282f;--cy:#00d4e8;--cy2:#00b8c8;
  --cg:#00d4e820;--cm:#00d4e840;--wh:#f4f4f6;
  --gr:#52525e;--gr2:#7c7c8a;--gr3:#a8a8b8;
  --red:#ff5566;--grn:#00e08a;--yel:#ffcc44;--org:#ff8844;--pur:#a855f7;
  --fh:'Syne',sans-serif;--fb:'Manrope',sans-serif;--fm:'JetBrains Mono',monospace;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{font-size:14px;-webkit-font-smoothing:antialiased}
body{background:var(--bg);color:var(--wh);font-family:var(--fb);min-height:100vh}
::-webkit-scrollbar{width:3px;height:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:var(--bdr2);border-radius:2px}
input:focus,select:focus,textarea:focus{outline:none!important;border-color:var(--cy)!important;box-shadow:0 0 0 3px var(--cg)!important}
tbody tr{cursor:pointer;transition:.1s}tbody tr:hover td{background:var(--card2)!important}
@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes modalIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes slideIn{from{transform:translateX(110%);opacity:0}to{transform:translateX(0);opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes spin{to{transform:rotate(360deg)}}
.va{animation:fadeUp .2s ease}
body.light{--bg:#f0f2f5;--sur:#fff;--card:#fff;--card2:#f8f9fb;--bdr:#e2e4e9;--bdr2:#d0d3da;--wh:#111;--gr:#888;--gr2:#666;--gr3:#444}
@media(max-width:768px){
  aside{transform:translateX(-100%);transition:transform .25s ease!important;width:260px!important;z-index:300!important}
  aside.mob-open{transform:translateX(0)!important}
  main{margin-left:0!important;width:100%!important}
  .ham-btn{display:flex!important}
  .modal-wrap{align-items:flex-end!important;padding:0!important}
  .modal-box{border-radius:16px 16px 0 0!important;width:100%!important;max-width:100%!important;max-height:92vh!important}
  input,select,textarea{font-size:16px!important}
}
@media(min-width:769px){
  .mob-overlay{display:none!important}
  .ham-btn{display:none!important}
}
`;

// ── UI PRIMITIVES ────────────────────────────────────────────
const StyleTag=()=><style dangerouslySetInnerHTML={{__html:CSS}}/>
;

// ── SKELETON LOADER ──────────────────────────────────────────
function Skeleton({w="100%",h=14,r=6,mb=8}){
  return <div style={{width:w,height:h,borderRadius:r,marginBottom:mb,background:"linear-gradient(90deg,var(--bdr) 25%,var(--bdr2) 50%,var(--bdr) 75%)",backgroundSize:"200% 100%",animation:"shimmer 1.4s infinite"}}/>
}
function SkeletonCard(){
  return <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20}}>
    <Skeleton h={18} w="60%" mb={12}/>
    <Skeleton h={12} w="90%" mb={8}/>
    <Skeleton h={12} w="75%" mb={8}/>
    <Skeleton h={12} w="80%"/>
  </div>;
}
function LoadingScreen(){
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:16}}>
    <div style={{width:48,height:48,border:"3px solid var(--bdr2)",borderTop:"3px solid var(--cy)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div style={{fontSize:13,color:"var(--gr2)"}}>Cargando datos...</div>
  </div>;
}

function Toast({msg,type,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,2800);return()=>clearTimeout(t);},[]);
  const c={ok:"var(--cy)",err:"var(--red)",warn:"var(--yel)"}[type]||"var(--cy)";
  return <div style={{position:"fixed",bottom:20,right:20,zIndex:9999,background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:10,padding:"12px 18px",display:"flex",alignItems:"center",gap:10,boxShadow:"0 8px 32px #0007",animation:"slideIn .2s ease",maxWidth:340,fontSize:13,color:"var(--wh)"}}><div style={{width:8,height:8,borderRadius:"50%",background:c,boxShadow:`0 0 8px ${c}`,flexShrink:0}}/>{msg}</div>;
}

const BP={cyan:["var(--cg)","var(--cy)","var(--cm)"],green:["#00e08a18","#00e08a","#00e08a35"],red:["#ff556618","#ff5566","#ff556635"],yellow:["#ffcc4418","#ffcc44","#ffcc4435"],orange:["#ff884418","#ff8844","#ff884435"],purple:["#a855f718","#a855f7","#a855f735"],gray:["var(--bdr)","var(--gr2)","var(--bdr2)"]};
const SM={"En Curso":"cyan","Pre-Producción":"yellow","Post-Producción":"orange","Finalizado":"green","Pausado":"gray","Activo":"green","En Desarrollo":"yellow","Vigente":"green","Borrador":"gray","En Revisión":"yellow","Firmado":"cyan","Vencido":"red","Planificado":"yellow","Grabado":"cyan","En Edición":"cyan","Publicado":"green","Cancelado":"red","Negociación":"yellow","Aceptado":"green","Rechazado":"red","Pagado":"green","Pendiente":"yellow","Vencida":"red","Auspiciador Principal":"cyan","Auspiciador Secundario":"yellow","Colaborador":"green","Canje":"orange","Media Partner":"gray"};
function Badge({label,color,sm}){const P=BP[color||SM[label]||"gray"];return <span style={{display:"inline-flex",alignItems:"center",padding:sm?"2px 7px":"3px 10px",borderRadius:20,fontSize:sm?9:10,fontWeight:700,letterSpacing:.5,textTransform:"uppercase",whiteSpace:"nowrap",background:P[0],color:P[1],border:`1px solid ${P[2]}`}}>{label}</span>;}

function Paginator({page,total,perPage,onChange}){
  const pages=Math.ceil(total/perPage)||1; if(total<=perPage) return null;
  const from=(page-1)*perPage+1,to=Math.min(page*perPage,total);
  const nums=[]; for(let i=1;i<=pages;i++){if(i===1||i===pages||Math.abs(i-page)<=1)nums.push(i);else if(Math.abs(i-page)===2)nums.push("…");}
  const dd=nums.filter((v,i,a)=>v!=="…"||a[i-1]!=="…");
  const bs=on=>({width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:`1px solid ${on?"var(--cy)":"var(--bdr2)"}`,background:on?"var(--cy)":"transparent",color:on?"var(--bg)":"var(--gr2)",fontFamily:"var(--fm)"});
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:16,paddingTop:14,borderTop:"1px solid var(--bdr)"}}><span style={{fontSize:12,color:"var(--gr2)"}}>Mostrando <b style={{color:"var(--wh)"}}>{from}–{to}</b> de <b style={{color:"var(--wh)"}}>{total}</b></span><div style={{display:"flex",gap:4}}><button style={bs(false)} disabled={page<=1} onClick={()=>onChange(page-1)}>‹</button>{dd.map((v,i)=>v==="…"?<span key={i} style={{color:"var(--gr)",padding:"0 4px",fontSize:11,alignSelf:"center"}}>…</span>:<button key={v} style={bs(v===page)} onClick={()=>onChange(v)}>{v}</button>)}<button style={bs(false)} disabled={page>=pages} onClick={()=>onChange(page+1)}>›</button></div></div>;
}

function Modal({open,onClose,title,sub,children,wide,extraWide}){
  useEffect(()=>{const h=e=>{if(e.key==="Escape")onClose();};document.addEventListener("keydown",h);return()=>document.removeEventListener("keydown",h);},[onClose]);
  useEffect(()=>{if(open){document.body.style.overflow="hidden";}else{document.body.style.overflow="";}return()=>{document.body.style.overflow="";};},[open]);
  if(!open) return null;
  const mob = window.innerWidth <= 768;
  return <div onClick={e=>{if(e.target===e.currentTarget&&!mob)onClose();}} style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,.8)",backdropFilter:"blur(6px)",display:"flex",alignItems:mob?"flex-end":"center",justifyContent:"center",padding:mob?0:20}}>
    <div style={{background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:mob?"16px 16px 0 0":14,width:mob?"100%":extraWide?900:wide?700:600,maxWidth:"100%",maxHeight:"92vh",overflowY:"auto",padding:mob?"20px 16px":28,animation:mob?"slideIn .25s ease":"modalIn .2s ease"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:20}}>
        <div><div style={{fontFamily:"var(--fh)",fontSize:mob?18:20,fontWeight:800,color:"var(--wh)"}}>{title}</div>{sub&&<div style={{fontSize:12,color:"var(--gr2)",marginTop:3}}>{sub}</div>}</div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",padding:4,borderRadius:4,fontSize:20,lineHeight:1}}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

const FS={width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontFamily:"var(--fb)",fontSize:13,outline:"none"};
const FG=({label,children})=><div style={{marginBottom:14}}><label style={{display:"block",fontSize:11,fontWeight:600,color:"var(--gr3)",marginBottom:6,letterSpacing:.3}}>{label}</label>{children}</div>;
const FI=p=><input style={FS} {...p}/>;
const FSl=({children,...p})=><select style={{...FS,cursor:"pointer"}} {...p}>{children}</select>;
const FTA=p=><textarea style={{...FS,resize:"vertical",minHeight:80}} {...p}/>;
const R2=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>{children}</div>;
const R3=({children})=><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{children}</div>;
const MFoot=({onClose,onSave,label="Guardar"})=><div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:22,paddingTop:18,borderTop:"1px solid var(--bdr)"}}><button onClick={onClose} style={{padding:"8px 16px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:600}}>Cancelar</button><button onClick={onSave} style={{padding:"8px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>{label}</button></div>;
const Btn=({onClick,children,sm,s={}})=><button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:6,padding:sm?"6px 12px":"9px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:sm?11:12,fontWeight:700,whiteSpace:"nowrap",...s}}>{children}</button>;
const GBtn=({onClick,children,sm,s={}})=><button onClick={onClick} style={{padding:sm?"5px 11px":"7px 14px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:sm?11:12,fontWeight:600,...s}}>{children}</button>;
const DBtn=({onClick,children,sm})=><button onClick={onClick} style={{padding:sm?"4px 9px":"7px 12px",borderRadius:6,border:"1px solid #ff556625",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:sm?10:12,fontWeight:600}}>{children}</button>;
const XBtn=({onClick})=><button onClick={onClick} style={{padding:"3px 8px",borderRadius:4,border:"1px solid #ff556625",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:10,fontWeight:600}}>✕</button>;

function Stat({label,value,sub,accent="var(--cy)",vc}){return <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:"18px 20px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:accent}}/><div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--gr2)",marginBottom:10,fontWeight:600}}>{label}</div><div style={{fontFamily:"var(--fm)",fontSize:22,fontWeight:500,color:vc||"var(--wh)"}}>{value}</div>{sub&&<div style={{fontSize:11,color:"var(--gr2)",marginTop:6}}>{sub}</div>}</div>;}
const TH=({children})=><th style={{textAlign:"left",padding:"10px 14px",fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--gr)",borderBottom:"1px solid var(--bdr)",fontWeight:600,whiteSpace:"nowrap"}}>{children}</th>;
const TD=({children,bold,mono,style:s={}})=><td style={{padding:"11px 14px",fontSize:12.5,color:bold?"var(--wh)":"var(--gr3)",borderBottom:"1px solid var(--bdr)",fontFamily:mono?"var(--fm)":"inherit",fontWeight:bold?600:400,verticalAlign:"middle",...s}}>{children}</td>;
function Card({title,sub,action,children,style:s={}}){return <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20,...s}}>{title&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}><div><div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700}}>{title}</div>{sub&&<div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{sub}</div>}</div>{action&&<button onClick={action.fn} style={{padding:"5px 11px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:11,fontWeight:600}}>{action.label}</button>}</div>}{children}</div>;}
const Empty=({text,sub})=><div style={{textAlign:"center",padding:"40px 20px",color:"var(--gr2)"}}><div style={{fontSize:32,marginBottom:12,opacity:.3}}>◻</div><p style={{fontSize:13}}>{text}</p>{sub&&<small style={{fontSize:11,color:"var(--gr)",marginTop:4,display:"block"}}>{sub}</small>}</div>;
const Sep=()=><hr style={{border:"none",borderTop:"1px solid var(--bdr)",margin:"16px 0"}}/>;
const Tabs=({tabs,active,onChange})=><div style={{display:"flex",borderBottom:"1px solid var(--bdr)",marginBottom:20}}>{tabs.map((t,i)=><div key={t} onClick={()=>onChange(i)} style={{padding:"9px 18px",fontSize:12,fontWeight:600,cursor:"pointer",borderBottom:`2px solid ${active===i?"var(--cy)":"transparent"}`,marginBottom:-1,color:active===i?"var(--cy)":"var(--gr2)",whiteSpace:"nowrap"}}>{t}</div>)}</div>;
const KV=({label,value})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{fontSize:12,color:"var(--gr2)"}}>{label}</span><span style={{fontSize:13,textAlign:"right",maxWidth:"60%"}}>{value}</span></div>;
function SearchBar({value,onChange,placeholder}){return <div style={{display:"flex",alignItems:"center",gap:8,background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,padding:"9px 13px",maxWidth:300,flex:1}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gr2)" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{background:"none",border:"none",color:"var(--wh)",fontFamily:"var(--fb)",fontSize:13,flex:1,outline:"none"}}/>{value&&<span onClick={()=>onChange("")} style={{cursor:"pointer",color:"var(--gr2)",fontSize:14}}>×</span>}</div>;}
function FilterSel({value,onChange,options,placeholder}){return <select value={value} onChange={e=>onChange(e.target.value)} style={{padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr3)",fontFamily:"var(--fb)",fontSize:12,cursor:"pointer",outline:"none"}}><option value="">{placeholder}</option>{options.map(o=>typeof o==="object"?<option key={o.value} value={o.value}>{o.label}</option>:<option key={o}>{o}</option>)}</select>;}
function MultiSelect({options,value=[],onChange,placeholder="Seleccionar..."}){
  const [open,setOpen]=useState(false);const ref=useRef();
  useEffect(()=>{const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);},[]);
  const toggle=v=>onChange(value.includes(v)?value.filter(x=>x!==v):[...value,v]);
  return <div ref={ref} style={{position:"relative"}}><div onClick={()=>setOpen(!open)} style={{minHeight:40,padding:"7px 12px",background:"var(--sur)",border:`1px solid ${open?"var(--cy)":"var(--bdr2)"}`,borderRadius:6,cursor:"pointer",display:"flex",flexWrap:"wrap",gap:4,alignItems:"center"}}>{!value.length?<span style={{color:"var(--gr)",fontSize:12}}>{placeholder}</span>:value.map(v=>{const l=options.find(o=>o.value===v)?.label||v;return <span key={v} style={{background:"var(--cm)",color:"var(--cy)",borderRadius:4,padding:"2px 8px",fontSize:11,fontWeight:600,display:"flex",alignItems:"center",gap:4}}>{l}<span onClick={e=>{e.stopPropagation();toggle(v);}} style={{cursor:"pointer",opacity:.7}}>×</span></span>;})}</div>{open&&<div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:6,zIndex:600,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 24px #0007"}}>{options.map(o=><div key={o.value} onClick={()=>toggle(o.value)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",cursor:"pointer",fontSize:12.5,color:value.includes(o.value)?"var(--cy)":"var(--gr3)",background:value.includes(o.value)?"var(--cg)":"transparent"}}><div style={{width:14,height:14,border:`1px solid ${value.includes(o.value)?"var(--cy)":"var(--bdr2)"}`,borderRadius:3,background:value.includes(o.value)?"var(--cy)":"var(--sur)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:9,fontWeight:700,color:"var(--bg)"}}>{value.includes(o.value)?"✓":""}</div>{o.label}</div>)}{!options.length&&<div style={{padding:12,color:"var(--gr)",fontSize:12,textAlign:"center"}}>Sin opciones</div>}</div>}</div>;
}
const DetHeader=({title,tag,badges=[],meta=[],actions,des})=><div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}><div>{tag&&<div style={{fontSize:10,letterSpacing:2,textTransform:"uppercase",color:"var(--cy)",fontWeight:700,marginBottom:6}}>{tag}</div>}<div style={{fontFamily:"var(--fh)",fontSize:24,fontWeight:800}}>{title}</div><div style={{fontSize:12,color:"var(--gr2)",marginTop:6,display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>{badges.map((b,i)=><span key={i}>{b}</span>)}{meta.filter(Boolean).map((m,i)=><span key={i}>{m}</span>)}</div>{des&&<div style={{fontSize:12,color:"var(--gr2)",marginTop:8,maxWidth:580}}>{des}</div>}</div>{actions&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{actions}</div>}</div>;
function useBal(movimientos,empId){return useCallback(id=>{const mv=(movimientos||[]).filter(m=>m.eid===id&&m.empId===empId);const i=mv.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+Number(m.mon),0);const g=mv.filter(m=>m.tipo==="gasto").reduce((s,m)=>s+Number(m.mon),0);return{i,g,b:i-g};},[movimientos,empId]);}

// ── LOGIN ────────────────────────────────────────────────────
function Login({users,onLogin}){
  const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [load,setLoad]=useState(false);
  const login=async()=>{setLoad(true);setErr("");await new Promise(r=>setTimeout(r,400));const u=(users||[]).find(u=>u.email.toLowerCase()===email.toLowerCase()&&u.password===pass&&u.active);if(u)onLogin(u);else setErr("Email o contraseña incorrectos");setLoad(false);};
  const GRID="linear-gradient(var(--bdr) 1px,transparent 1px),linear-gradient(90deg,var(--bdr) 1px,transparent 1px)";
  return <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,position:"relative",overflow:"hidden"}}>
    <div style={{position:"absolute",inset:0,backgroundImage:GRID,backgroundSize:"44px 44px",opacity:.4}}/>
    <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 60% 50% at 50% 50%,var(--cg) 0%,transparent 70%)"}}/>
    <div style={{position:"relative",width:440,background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:16,padding:40,boxShadow:"0 24px 80px #0009"}}>
      <div style={{textAlign:"center",marginBottom:32}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:8}}>
          <div style={{width:48,height:48,borderRadius:12,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 24px var(--cm)"}}>
            <svg viewBox="0 0 24 24" fill="var(--bg)" width="22" height="22"><polygon points="5,3 20,12 5,21"/></svg>
          </div>
          <div style={{textAlign:"left"}}>
            <div style={{fontFamily:"var(--fh)",fontSize:32,fontWeight:800,color:"var(--cy)",letterSpacing:-1,lineHeight:1}}>produ</div>
            <div style={{fontSize:10,color:"var(--gr2)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Gestión de Productoras</div>
          </div>
        </div>
      </div>
      <div style={{fontSize:17,fontWeight:700,fontFamily:"var(--fh)",marginBottom:4,textAlign:"center"}}>Bienvenido de vuelta</div>
      <div style={{fontSize:12,color:"var(--gr2)",textAlign:"center",marginBottom:24}}>Ingresa a tu espacio de trabajo</div>
      <FG label="Email"><FI type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.cl" onKeyDown={e=>e.key==="Enter"&&login()}/></FG>
      <FG label="Contraseña"><FI type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" onKeyDown={e=>e.key==="Enter"&&login()}/></FG>
      {err&&<div style={{background:"#ff556615",border:"1px solid #ff556635",borderRadius:6,padding:"8px 12px",color:"var(--red)",fontSize:12,marginBottom:12}}>{err}</div>}
      <button onClick={login} disabled={load} style={{width:"100%",padding:12,borderRadius:8,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:14,fontWeight:700,opacity:load?.7:1,marginBottom:20}}>{load?"Verificando...":"Ingresar →"}</button>

    </div>
  </div>;
}

// ── EMPRESA SELECTOR ─────────────────────────────────────────
function EmpresaSelector({empresas,onSelect}){
  const [q,setQ]=useState("");
  const fd=(empresas||[]).filter(e=>e.nombre.toLowerCase().includes(q.toLowerCase()));
  return <div style={{minHeight:"100vh",background:"var(--bg)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:20}}>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6,justifyContent:"center"}}>
      <div style={{width:44,height:44,borderRadius:10,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px var(--cm)"}}>
        <svg viewBox="0 0 24 24" fill="var(--bg)" width="20" height="20"><polygon points="5,3 20,12 5,21"/></svg>
      </div>
      <div>
        <div style={{fontFamily:"var(--fh)",fontSize:32,fontWeight:800,color:"var(--cy)",letterSpacing:-1,lineHeight:1}}>produ</div>
        <div style={{fontSize:10,color:"var(--gr2)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Gestión de Productoras</div>
      </div>
    </div>
    <div style={{fontSize:12,color:"var(--gr2)",letterSpacing:1,textTransform:"uppercase",marginBottom:28,textAlign:"center"}}>Super Admin · Seleccionar empresa</div>
    <div style={{width:460}}>
      <SearchBar value={q} onChange={setQ} placeholder="Buscar empresa..."/>
      <div style={{marginTop:12}}>
        {fd.map(emp=>(
          <div key={emp.id} onClick={()=>onSelect(emp)} style={{display:"flex",alignItems:"center",gap:14,background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:"14px 18px",marginBottom:8,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor="var(--cy)"} onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}>
            <div style={{width:46,height:46,borderRadius:10,background:emp.color+"30",border:`2px solid ${emp.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:17,fontWeight:800,color:emp.color,flexShrink:0,overflow:"hidden"}}>
              {emp.logo ? <img src={emp.logo} style={{width:46,height:46,objectFit:"contain",borderRadius:8}} alt={emp.nombre}/> : ini(emp.nombre)}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{emp.nombre}</div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>{emp.rut}</div>
              <div style={{fontSize:10,color:"var(--gr)",marginTop:3}}>Addons: {emp.addons?.join(", ")||"ninguno"}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:5,alignItems:"flex-end"}}>
              <Badge label={emp.active?"Activa":"Inactiva"} color={emp.active?"green":"red"} sm/>
              <Badge label={emp.plan} color="gray" sm/>
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop:12,padding:"12px 16px",background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:12,color:"var(--gr2)"}}>Panel de control global</span>
        <Btn onClick={()=>onSelect("__super__")} sm>⚙ Panel SuperAdmin</Btn>
      </div>
    </div>
  </div>;
}



// ── EXPORT FUNCTIONS ─────────────────────────────────────────
function exportMovCSV(movs, nombre) {
  const headers = ["Fecha","Tipo","Categoría","Descripción","Monto"];
  const rows = (movs||[]).map(m => [
    m.fecha||"",
    m.tipo==="ingreso"?"Ingreso":"Gasto",
    m.cat||"—",
    (m.desc||"").replace(/,/g," "),
    m.monto||0
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob(["﻿"+csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre.replace(/\s+/g,"_")}_movimientos.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportMovPDF(movs, nombre, empresa, tipo) {
  const ac = empresa?.color || "#00d4e8";
  const total = (movs||[]).reduce((s,m) => s + Number(m.monto||0), 0);
  const logoHtml = empresa?.logo
    ? `<img src="${empresa.logo}" style="max-height:60px;object-fit:contain;display:block;margin-bottom:6px;">`
    : `<div style="font-size:22px;font-weight:900;color:${ac}">${empresa?.nombre||""}</div>`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${tipo} — ${nombre}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;color:#1a1a2e;padding:40px}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid ${ac}}
.title{font-size:22px;font-weight:800;color:#1a1a2e;margin-bottom:16px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
thead tr{background:${ac}}
thead th{padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:#fff;letter-spacing:.5px;text-transform:uppercase}
thead th.r{text-align:right}
tbody tr:nth-child(even){background:#f8f9fc}
tbody td{padding:9px 14px;font-size:12px;border-bottom:1px solid #eee}
tbody td.r{text-align:right;font-family:monospace}
.total-row{display:flex;justify-content:flex-end;margin-top:4px}
.total-box{background:${ac};color:#fff;padding:10px 20px;border-radius:8px;font-size:15px;font-weight:700}
.footer{text-align:center;font-size:10px;color:#aaa;margin-top:32px;padding-top:16px;border-top:1px solid #eee}
@media print{body{padding:20px}}
</style></head><body>
<div class="header">
  <div>${logoHtml}<div style="font-size:12px;color:#555;margin-top:4px">${empresa?.nombre||""} · ${empresa?.rut||""}</div></div>
  <div style="text-align:right">
    <div style="font-size:10px;color:#888;letter-spacing:2px;text-transform:uppercase;margin-bottom:4px">${tipo}</div>
    <div style="font-size:11px;color:#666">Generado: ${new Date().toLocaleDateString("es-CL")}</div>
  </div>
</div>
<div class="title">${nombre}</div>
<table>
  <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th class="r">Monto</th></tr></thead>
  <tbody>
    ${(movs||[]).map(m=>`<tr>
      <td>${m.fecha?new Date(m.fecha+"T12:00:00").toLocaleDateString("es-CL"):"—"}</td>
      <td>${m.cat||"—"}</td>
      <td>${m.desc||"—"}</td>
      <td class="r">${Number(m.monto||0).toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0})}</td>
    </tr>`).join("")}
  </tbody>
</table>
<div class="total-row">
  <div class="total-box">Total ${tipo}: ${total.toLocaleString("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0})}</div>
</div>
<div class="footer">${empresa?.nombre||""} · Generado con Produ</div>
</body></html>`;

  const w = window.open("","_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),600);
}

// ── NAV GROUPS — Menú colapsable por grupo ───────────────────
function NavGroups({ NAV, base, collapsed, onNav, user }) {
  // Inicializa todos los grupos abiertos
  const initOpen = () => {
    const o = {};
    NAV.forEach(g => { o[g.group] = true; });
    return o;
  };
  const [open, setOpen] = useState(initOpen);
  const toggle = g => setOpen(p => ({ ...p, [g]: !p[g] }));

  if (collapsed) {
    // Modo colapsado — solo iconos centrados
    return <div style={{ padding:"4px 8px" }}>
      {NAV.map(grp => {
        const items = grp.items.filter(n => !n.need || canDo(user, n.need) || user?.role==="admin" || user?.role==="superadmin");
        if (!items.length) return null;
        return items.map(n => {
          const active = base === n.id;
          return <div key={n.id} onClick={() => onNav(n.id)} title={n.label}
            style={{ display:"flex",alignItems:"center",justifyContent:"center",width:40,height:40,borderRadius:8,cursor:"pointer",background:active?"var(--cg)":"transparent",border:active?"1px solid var(--cm)":"1px solid transparent",margin:"2px auto",transition:".1s" }}>
            <span style={{ fontSize:18 }}>{n.icon}</span>
          </div>;
        });
      })}
    </div>;
  }

  return <div style={{ padding:"4px 0" }}>
    {NAV.map(grp => {
      const items = grp.items.filter(n => !n.need || canDo(user, n.need) || user?.role==="admin" || user?.role==="superadmin");
      if (!items.length) return null;
      const isOpen = open[grp.group] !== false;
      return <div key={grp.group} style={{ marginBottom:2 }}>
        {/* Group header */}
        <div onClick={() => toggle(grp.group)}
          style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 16px 6px",cursor:"pointer",userSelect:"none" }}>
          <span style={{ fontSize:11,letterSpacing:1.5,textTransform:"uppercase",fontWeight:800,color:"var(--wh)" }}>{grp.group}</span>
          <span style={{ fontSize:10,color:"var(--gr2)",transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
        </div>
        {/* Items */}
        {isOpen && <div style={{ paddingBottom:6 }}>
          {items.map(n => {
            const active = base === n.id;
            return <div key={n.id} onClick={() => onNav(n.id)}
              style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 16px",cursor:"pointer",color:active?"var(--cy)":"var(--gr3)",fontSize:13,fontWeight:active?600:400,background:active?"var(--cg)":"transparent",borderLeft:active?"3px solid var(--cy)":"3px solid transparent",transition:".1s",marginBottom:1 }}>
              <span style={{ fontSize:16,flexShrink:0,width:22,textAlign:"center" }}>{n.icon}</span>
              <span style={{ flex:1,whiteSpace:"nowrap",textAlign:"left" }}>{n.label}</span>
              {n.cnt !== undefined && <span style={{ background:active?"var(--cm)":"var(--bdr2)",color:active?"var(--cy)":"var(--gr2)",fontSize:10,padding:"1px 7px",borderRadius:20,fontFamily:"var(--fm)",fontWeight:600 }}>{n.cnt}</span>}
            </div>;
          })}
        </div>}
      </div>;
    })}
  </div>;
}

// ── SIDEBAR ──────────────────────────────────────────────────
function Sidebar({user,empresa,view,onNav,onAdmin,onLogout,onChangeEmp,counts,collapsed,onToggle,syncPulse}){
  const base=view.split("-")[0];
  const rcol={superadmin:"red",admin:"cyan",productor:"green",comercial:"yellow",viewer:"gray"};
  const NAV=[
    {group:"General",items:[{id:"dashboard",icon:"⊞",label:"Dashboard"},{id:"calendario",icon:"📅",label:"Calendario"},{id:"tareas",icon:"✅",label:"Mis Tareas",cnt:counts.tar}]},
    {group:"Negocio",items:[{id:"clientes",icon:"👥",label:"Clientes",need:"clientes",cnt:counts.cli},{id:"producciones",icon:"▶",label:"Producciones",need:"producciones",cnt:counts.pro}]},
    {group:"Comercial",items:[
      ...(empresa?.addons?.includes("presupuestos")?[{id:"presupuestos",icon:"📋",label:"Presupuestos",need:"presupuestos",cnt:counts.pres}]:[]),
    ]},
    ...(empresa?.addons?.some(a=>["television","facturacion","activos","contratos","crew"].includes(a))?[{group:"Addons",items:[
      ...(empresa?.addons?.includes("television")?[{id:"programas",icon:"📺",label:"Programas TV",need:"programas",cnt:counts.pg},{id:"auspiciadores",icon:"⭐",label:"Auspiciadores",need:"auspiciadores",cnt:counts.aus}]:[]),
      ...(empresa?.addons?.includes("facturacion")?[{id:"facturacion",icon:"🧾",label:"Facturación",need:"facturacion",cnt:counts.fact}]:[]),
      ...(empresa?.addons?.includes("activos")?[{id:"activos",icon:"📦",label:"Activos",need:"activos",cnt:counts.act}]:[]),
      ...(empresa?.addons?.includes("contratos")?[{id:"contratos",icon:"📄",label:"Contratos",need:"contratos",cnt:counts.ct}]:[]),
      ...(empresa?.addons?.includes("crew")?[{id:"crew",icon:"🎬",label:"Equipo / Crew",need:"crew",cnt:counts.crew}]:[]),
    ]}]:[]),
  ];
  const SW=collapsed?64:240;
  return <aside style={{width:SW,minHeight:"100vh",background:"var(--sur)",borderRight:"1px solid var(--bdr)",display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,bottom:0,zIndex:200,transition:"width .2s",overflow:"hidden"}}>
    {/* Logo Produ */}
    <div style={{padding:"14px 14px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:64}}>
      {!collapsed?<>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:8,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 16px var(--cm)",flexShrink:0}}>
            <svg viewBox="0 0 24 24" fill="var(--bg)" width="16" height="16"><polygon points="5,3 20,12 5,21"/></svg>
          </div>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:17,fontWeight:800,letterSpacing:-.5,lineHeight:1,color:"var(--cy)"}}>produ</div>
            <div style={{fontSize:8,color:"var(--gr2)",letterSpacing:2,textTransform:"uppercase",marginTop:2}}>Gestión de Productoras</div>
          </div>
        </div>
        <button onClick={onToggle} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",padding:4,borderRadius:4,fontSize:13}}>‹</button>
      </>:
        <div onClick={onToggle} style={{width:34,height:34,borderRadius:8,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",cursor:"pointer",boxShadow:"0 0 14px var(--cm)"}}>
          <svg viewBox="0 0 24 24" fill="var(--bg)" width="16" height="16"><polygon points="5,3 20,12 5,21"/></svg>
        </div>}
    </div>
    {/* Empresa chip */}
    {!collapsed&&empresa&&<div style={{padding:"9px 12px",borderBottom:"1px solid var(--bdr)",background:"var(--cg)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:28,height:28,borderRadius:6,background:empresa.color+"30",border:`1px solid ${empresa.color}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
          {empresa.logo
            ? <img src={empresa.logo} style={{width:28,height:28,objectFit:"contain",borderRadius:6}} alt={empresa.nombre}/>
            : <span style={{fontFamily:"var(--fh)",fontSize:10,fontWeight:800,color:empresa.color}}>{ini(empresa.nombre)}</span>}
        </div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{empresa.nombre}</div><div style={{fontSize:9,color:"var(--gr2)"}}>{empresa.rut}</div></div>
        {user?.role==="superadmin"&&<button onClick={onChangeEmp} title="Cambiar empresa" style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:13,padding:2}}>⇄</button>}
      </div>
    </div>}
    {/* Nav */}
    <nav style={{flex:1,padding:"8px 0",overflowY:"auto"}}>
      <NavGroups NAV={NAV} base={base} collapsed={collapsed} onNav={onNav} user={user}/>
    </nav>
    {/* Footer */}
    {!collapsed&&<div style={{padding:"8px",borderTop:"1px solid var(--bdr)"}}>
      {(user?.role==="admin"||user?.role==="superadmin")&&<div onClick={onAdmin} style={{display:"flex",alignItems:"center",gap:8,padding:8,borderRadius:6,cursor:"pointer",border:"1px solid var(--bdr2)",color:"var(--gr2)",fontSize:12,fontWeight:600,marginBottom:6,transition:".1s"}}><span>⚙</span>Panel Admin</div>}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",marginBottom:4}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:"var(--cy)",flexShrink:0,animation:syncPulse?"pulse 1s infinite":undefined}}/>
        <span style={{fontSize:9,color:"var(--gr2)"}}>Sincronizado · Supabase</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:8,borderRadius:6}}>
        <div style={{width:26,height:26,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(user?.name||"")}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name}</div><Badge label={ROLES[user?.role]?.label||user?.role} color={rcol[user?.role]||"gray"} sm/></div>
        <button onClick={onLogout} title="Cerrar sesión" style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:14,padding:2}}>⏏</button>
      </div>
    </div>}
  </aside>;
}


// ── CONTACT BUTTONS — WhatsApp y Email ───────────────────────
function ContactBtns({ tel, ema, nombre, mensaje }) {
  const waMsg = mensaje || `Hola ${nombre||""}, te contactamos desde Produ.`;
  const waNum = (tel||"").replace(/[^0-9]/g,"");
  const waUrl = `https://wa.me/${waNum.startsWith("56")?waNum:"56"+waNum}?text=${encodeURIComponent(waMsg)}`;
  const mailUrl = `mailto:${ema||""}?subject=Contacto desde Produ&body=${encodeURIComponent(waMsg)}`;
  if (!tel && !ema) return null;
  return (
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
      {tel&&<a href={waUrl} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,background:"#25D36618",border:"1px solid #25D36640",color:"#25D366",fontSize:12,fontWeight:600,textDecoration:"none"}}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.122 1.528 5.855L0 24l6.335-1.51A11.955 11.955 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.886 0-3.66-.498-5.193-1.37l-.371-.22-3.863.921.976-3.769-.242-.388A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
        WhatsApp
      </a>}
      {ema&&<a href={mailUrl} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:6,background:"var(--cg)",border:"1px solid var(--cm)",color:"var(--cy)",fontSize:12,fontWeight:600,textDecoration:"none"}}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="var(--cy)" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email
      </a>}
    </div>
  );
}

// ── ALERTAS — Fechas de grabación próximas ────────────────────
function calcAlertas(episodios, programas, eventos, empId) {
  const hoy = new Date();
  const alerts = [];

  // Desde episodios con fechaGrab
  (episodios||[]).filter(e=>e.empId===empId).forEach(ep => {
    if (!ep.fechaGrab) return;
    const d = new Date(ep.fechaGrab + "T12:00:00");
    const pg = (programas||[]).find(x=>x.id===ep.pgId);
    const diff = Math.ceil((d - hoy) / (1000*60*60*24));
    if (diff < 0) return;
    if (diff <= 2)  alerts.push({ id:ep.id+"_ep", tipo:"urgente", icon:"🔴", titulo:`Grabación HOY/MAÑANA: Ep.${ep.num} — ${ep.titulo}`, sub:pg?.nom||"Episodio", fecha:ep.fechaGrab, diff });
    else if (diff <= 7)  alerts.push({ id:ep.id+"_ep", tipo:"pronto", icon:"🟡", titulo:`Grabación en ${diff} días: Ep.${ep.num} — ${ep.titulo}`, sub:pg?.nom||"Episodio", fecha:ep.fechaGrab, diff });
    else if (diff <= 30) alerts.push({ id:ep.id+"_ep", tipo:"info",    icon:"🔵", titulo:`Grabación en ${diff} días: Ep.${ep.num} — ${ep.titulo}`, sub:pg?.nom||"Episodio", fecha:ep.fechaGrab, diff });
  });

  // Desde eventos de calendario tipo "grabacion"
  (eventos||[]).filter(e=>e.empId===empId&&e.tipo==="grabacion"&&e.fecha).forEach(ev => {
    const d = new Date(ev.fecha + "T12:00:00");
    const diff = Math.ceil((d - hoy) / (1000*60*60*24));
    if (diff < 0) return;
    const sub = ev.hora ? `${ev.hora}${ev.desc?" · "+ev.desc:""}` : (ev.desc||"Calendario");
    if (diff <= 2)  alerts.push({ id:ev.id+"_ev", tipo:"urgente", icon:"🔴", titulo:`Grabación HOY/MAÑANA: ${ev.titulo}`, sub, fecha:ev.fecha, diff });
    else if (diff <= 7)  alerts.push({ id:ev.id+"_ev", tipo:"pronto", icon:"🟡", titulo:`Grabación en ${diff} días: ${ev.titulo}`, sub, fecha:ev.fecha, diff });
    else if (diff <= 30) alerts.push({ id:ev.id+"_ev", tipo:"info",   icon:"🔵", titulo:`Grabación en ${diff} días: ${ev.titulo}`, sub, fecha:ev.fecha, diff });
  });

  return alerts.sort((a,b)=>a.diff-b.diff);
}
function useAlertas(episodios, programas, eventos, empId) {
  const [alerts, setAlerts] = useState([]);
  const epLen = (episodios||[]).length;
  const evLen = (eventos||[]).length;
  useEffect(() => {
    setAlerts(calcAlertas(episodios, programas, eventos, empId));
  }, [epLen, evLen, empId]); // use lengths not arrays to avoid infinite loop
  return alerts;
}

function AlertasPanel({ alertas, leidas=[], onMarcar, onMarcarTodas, onClose }) {
  const noLeidas = alertas.filter(a=>!leidas.includes(a.id));
  const siLeidas = alertas.filter(a=>leidas.includes(a.id));
  return (
    <div style={{position:"fixed",top:70,right:20,zIndex:888,width:380,background:"var(--card)",border:"1px solid var(--bdr2)",borderRadius:12,boxShadow:"0 12px 40px #0009",animation:"slideIn .25s ease",overflow:"hidden"}}>
      <div style={{padding:"14px 16px",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🔔</span>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Alertas de Grabación</div>
            <div style={{fontSize:10,color:"var(--gr2)"}}>{noLeidas.length} sin leer · {alertas.length} total</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {noLeidas.length>0&&<button onClick={onMarcarTodas} style={{fontSize:10,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"3px 8px",cursor:"pointer",whiteSpace:"nowrap"}}>✓ Marcar todas</button>}
          <button onClick={onClose} style={{background:"none",border:"none",color:"var(--gr2)",cursor:"pointer",fontSize:18,padding:2}}>✕</button>
        </div>
      </div>
      <div style={{maxHeight:420,overflowY:"auto"}}>
        {alertas.length===0&&<div style={{padding:24,textAlign:"center",color:"var(--gr2)",fontSize:13}}>Sin grabaciones próximas</div>}
        {noLeidas.map(a=>{
          const colores={urgente:["#ff556615","#ff5566"],pronto:["#ffcc4415","#ffcc44"],info:["var(--cg)","var(--cy)"]};
          const [bg,color]=colores[a.tipo]||["var(--cg)","var(--cy)"];
          return <div key={a.id} style={{display:"flex",gap:10,padding:"12px 16px",borderBottom:"1px solid var(--bdr)",background:bg,alignItems:"flex-start"}}>
            <span style={{fontSize:16,flexShrink:0,marginTop:1}}>{a.icon}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:600,color:"var(--wh)",lineHeight:1.3}}>{a.titulo}</div>
              <div style={{fontSize:11,color:"var(--gr2)",marginTop:3}}>{a.sub} · {fmtD(a.fecha)}</div>
            </div>
            <button onClick={()=>onMarcar(a.id)} title="Marcar como leída" style={{background:"none",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--gr2)",cursor:"pointer",fontSize:11,padding:"2px 7px",flexShrink:0,whiteSpace:"nowrap"}}>✓ Leída</button>
          </div>;
        })}
        {siLeidas.length>0&&<><div style={{padding:"8px 16px",fontSize:10,color:"var(--gr)",letterSpacing:1,textTransform:"uppercase",fontWeight:600,borderBottom:"1px solid var(--bdr)"}}>Ya leídas</div>
        {siLeidas.map(a=><div key={a.id} style={{display:"flex",gap:10,padding:"10px 16px",borderBottom:"1px solid var(--bdr)",opacity:.5,alignItems:"center"}}>
          <span style={{fontSize:14,flexShrink:0}}>✓</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,color:"var(--gr3)",textDecoration:"line-through"}}>{a.titulo}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{a.sub} · {fmtD(a.fecha)}</div>
          </div>
        </div>)}</>}
      </div>
      {noLeidas.length===0&&alertas.length>0&&<div style={{padding:"10px 16px",background:"var(--sur)",borderTop:"1px solid var(--bdr)",textAlign:"center",fontSize:12,color:"var(--gr2)"}}>✓ Todas las alertas están leídas</div>}
    </div>
  );
}


// ── TAREAS — Pipeline Kanban ──────────────────────────────────
const COLS_TAREAS = ["Pendiente","En Progreso","En Revisión","Completada"];
const PRIO_COLORS = { Alta:"#ff5566", Media:"#fbbf24", Baja:"#60a5fa" };
const PRIO_BG    = { Alta:"#ff556618", Media:"#fbbf2418", Baja:"#60a5fa18" };

function MTarea({ open, data, producciones, programas, crew, onClose, onSave }) {
  const empty = { titulo:"", desc:"", estado:"Pendiente", prioridad:"Media", fechaLimite:"", refTipo:"", refId:"", asignadoA:"" };
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? { ...data } : { ...empty }); }, [data, open]);
  const u = (k,v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title={data?.id ? "Editar Tarea" : "Nueva Tarea"}>
      <FG label="Título *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Descripción breve de la tarea"/></FG>
      <FG label="Descripción"><FTA value={f.desc||""} onChange={e=>u("desc",e.target.value)} placeholder="Detalle opcional..."/></FG>
      <R2>
        <FG label="Prioridad"><FSl value={f.prioridad||"Media"} onChange={e=>u("prioridad",e.target.value)}>
          <option>Alta</option><option>Media</option><option>Baja</option>
        </FSl></FG>
        <FG label="Estado"><FSl value={f.estado||"Pendiente"} onChange={e=>u("estado",e.target.value)}>
          {COLS_TAREAS.map(c=><option key={c}>{c}</option>)}
        </FSl></FG>
      </R2>
      <R2>
        <FG label="Fecha límite"><FI type="date" value={f.fechaLimite||""} onChange={e=>u("fechaLimite",e.target.value)}/></FG>
        <FG label="Asignar a"><FSl value={f.asignadoA||""} onChange={e=>u("asignadoA",e.target.value)}>
          <option value="">— Sin asignar —</option>
          {(crew||[]).map(c=><option key={c.id} value={c.id}>{c.nom} · {c.rol||"Crew"}</option>)}
        </FSl></FG>
      </R2>
      <R2>
        <FG label="Asociar a"><FSl value={f.refTipo||""} onChange={e=>{u("refTipo",e.target.value);u("refId","");}}>
          <option value="">— Sin asociar —</option>
          <option value="pro">Producción</option>
          <option value="pg">Programa TV</option>
        </FSl></FG>
        {f.refTipo==="pro"&&<FG label="Producción"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(producciones||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
        </FSl></FG>}
        {f.refTipo==="pg"&&<FG label="Programa"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          {(programas||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
        </FSl></FG>}
      </R2>
      <MFoot onClose={onClose} onSave={()=>{ if(!f.titulo) return; onSave(f); }}/>
    </Modal>
  );
}

function TareaCard({ tarea, producciones, programas, crew, onEdit, onDelete, onChangeEstado }) {
  const ref = tarea.refTipo==="pro" ? (producciones||[]).find(x=>x.id===tarea.refId) : (programas||[]).find(x=>x.id===tarea.refId);
  const asig = (crew||[]).find(x=>x.id===tarea.asignadoA);
  const venc = tarea.fechaLimite ? Math.ceil((new Date(tarea.fechaLimite+"T12:00:00") - new Date()) / (1000*60*60*24)) : null;
  const vencColor = venc===null?"var(--gr2)":venc<0?"#ff5566":venc<=2?"#fbbf24":"var(--gr2)";
  return (
    <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:14,marginBottom:10,cursor:"pointer",transition:".15s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor="var(--cy)"}
      onMouseLeave={e=>e.currentTarget.style.borderColor="var(--bdr)"}
    >
      {/* Prioridad badge */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:10,background:PRIO_BG[tarea.prioridad]||"var(--bdr)",color:PRIO_COLORS[tarea.prioridad]||"var(--gr2)"}}>{tarea.prioridad||"Media"}</span>
        <div style={{display:"flex",gap:4}}>
          <GBtn sm onClick={e=>{e.stopPropagation();onEdit(tarea);}}>✏</GBtn>
          <XBtn onClick={e=>{e.stopPropagation();onDelete(tarea.id);}}/>
        </div>
      </div>
      {/* Título */}
      <div style={{fontSize:13,fontWeight:600,color:"var(--wh)",marginBottom:6,lineHeight:1.4}}>{tarea.titulo}</div>
      {tarea.desc&&<div style={{fontSize:11,color:"var(--gr2)",marginBottom:8,lineHeight:1.5}}>{tarea.desc}</div>}
      {/* Ref */}
      {ref&&<div style={{fontSize:11,color:"var(--cy)",marginBottom:6}}>
        {tarea.refTipo==="pro"?"📽":"📺"} {ref.nom}
      </div>}
      {/* Footer */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,paddingTop:8,borderTop:"1px solid var(--bdr)"}}>
        {asig
          ? <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:22,height:22,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{asig.nom?.charAt(0)}</div>
              <span style={{fontSize:11,color:"var(--gr2)"}}>{asig.nom}</span>
            </div>
          : <span style={{fontSize:11,color:"var(--gr)",fontStyle:"italic"}}>Sin asignar</span>
        }
        {venc!==null&&<span style={{fontSize:10,fontWeight:600,color:vencColor}}>
          {venc<0?`Vencida hace ${Math.abs(venc)}d`:venc===0?"Vence hoy":venc===1?"Vence mañana":`${venc}d`}
        </span>}
      </div>
      {/* Mover columna */}
      <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
        {COLS_TAREAS.filter(c=>c!==tarea.estado).map(c=>(
          <button key={c} onClick={e=>{e.stopPropagation();onChangeEstado(tarea.id,c);}}
            style={{fontSize:10,padding:"2px 8px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr2)",cursor:"pointer",transition:".1s"}}
            onMouseEnter={e=>{e.target.style.borderColor="var(--cy)";e.target.style.color="var(--cy)";}}
            onMouseLeave={e=>{e.target.style.borderColor="var(--bdr2)";e.target.style.color="var(--gr2)";}}>
            → {c}
          </button>
        ))}
      </div>
    </div>
  );
}

function ViewTareas({ empresa, user, tareas, producciones, programas, crew, openM, canDo, cDel, setTareas, saveTareas }) {
  const empId = empresa?.id;
  const [filtro, setFiltro] = useState("mis"); // "mis" | "todas"
  const [filtroRef, setFiltroRef] = useState("");

  const misTareas = (tareas||[]).filter(t => t.empId===empId);
  const tareasVis = filtro==="mis"
    ? misTareas.filter(t => t.asignadoA===user?.id || !t.asignadoA)
    : misTareas;
  const tareasFilt = filtroRef
    ? tareasVis.filter(t => t.refId===filtroRef)
    : tareasVis;

  const porColumna = col => tareasFilt.filter(t => (t.estado||"Pendiente")===col);

  const changeEstado = async (id, nuevoEstado) => {
    const next = (tareas||[]).map(t => t.id===id ? {...t, estado:nuevoEstado} : t);
    await setTareas(next);
  };

  const deleteTarea = (id) => {
    if(!confirm("¿Eliminar tarea?")) return;
    setTareas((tareas||[]).filter(t => t.id!==id));
  };

  const colColors = { Pendiente:"var(--bdr2)", "En Progreso":"#60a5fa", "En Revisión":"#fbbf24", Completada:"#4ade80" };

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800}}>Pipeline de Tareas</div>
          <div style={{fontSize:12,color:"var(--gr2)",marginTop:2}}>{tareasFilt.length} tarea{tareasFilt.length!==1?"s":""} · {tareasFilt.filter(t=>t.estado==="Completada").length} completadas</div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{display:"flex",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden"}}>
            {[["mis","Mis Tareas"],["todas","Todas"]].map(([v,l])=>(
              <button key={v} onClick={()=>setFiltro(v)} style={{padding:"7px 14px",border:"none",background:filtro===v?"var(--cy)":"transparent",color:filtro===v?"var(--bg)":"var(--gr2)",cursor:"pointer",fontSize:12,fontWeight:600,transition:".15s"}}>{l}</button>
            ))}
          </div>
          <select value={filtroRef} onChange={e=>setFiltroRef(e.target.value)} style={{padding:"7px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,color:"var(--gr3)",fontSize:12,cursor:"pointer"}}>
            <option value="">Todas las producciones</option>
            <optgroup label="Producciones">{(producciones||[]).filter(p=>p.empId===empId).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</optgroup>
            <optgroup label="Programas TV">{(programas||[]).filter(p=>p.empId===empId).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</optgroup>
          </select>
          <Btn onClick={()=>openM("tarea",{})}>+ Nueva Tarea</Btn>
        </div>
      </div>

      {/* Kanban Board */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,alignItems:"start"}}>
        {COLS_TAREAS.map(col => {
          const items = porColumna(col);
          return (
            <div key={col}>
              {/* Column header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,marginBottom:12,borderTop:`3px solid ${colColors[col]}`}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{col}</span>
                  <span style={{fontSize:11,background:"var(--bdr2)",color:"var(--gr2)",padding:"1px 7px",borderRadius:10,fontFamily:"var(--fm)",fontWeight:600}}>{items.length}</span>
                </div>
                <GBtn sm onClick={()=>openM("tarea",{estado:col})}>+</GBtn>
              </div>
              {/* Cards */}
              {items.length===0
                ? <div style={{padding:16,textAlign:"center",color:"var(--gr)",fontSize:12,fontStyle:"italic",border:"1px dashed var(--bdr)",borderRadius:10}}>Sin tareas</div>
                : items.map(t=>(
                  <TareaCard key={t.id} tarea={t} producciones={producciones} programas={programas} crew={crew}
                    onEdit={t=>openM("tarea",t)}
                    onDelete={deleteTarea}
                    onChangeEstado={changeEstado}
                  />
                ))
              }
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── DASHBOARD ────────────────────────────────────────────────
function ViewDashboard({empresa,user,clientes,producciones,programas,episodios,auspiciadores,movimientos,presupuestos,facturas,activos,alertas,navTo}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const mvs=(movimientos||[]).filter(m=>m.empId===empId);
  const ti=mvs.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+Number(m.mon),0);
  const tg=mvs.filter(m=>m.tipo==="gasto").reduce((s,m)=>s+Number(m.mon),0);
  const clis=(clientes||[]).filter(x=>x.empId===empId);
  const pros=(producciones||[]).filter(x=>x.empId===empId);
  const pgs=(programas||[]).filter(x=>x.empId===empId);
  const eps=(episodios||[]).filter(x=>x.empId===empId);
  return <div className="va">
    <div style={{marginBottom:12}}><span style={{fontSize:12,color:"var(--gr2)"}}>Bienvenido, <b style={{color:"var(--wh)"}}>{user?.name}</b> · <span style={{color:"var(--cy)"}}>{empresa?.nombre}</span></span></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Clientes"     value={clis.length}  sub="registrados"      accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Producciones" value={pros.length}   sub={`${pros.filter(p=>p.est==="En Curso").length} en curso`}/>
      <Stat label="Ingresos"     value={fmtM(ti)}      sub="todos proyectos"  accent="#00e08a"   vc="#00e08a"/>
      <Stat label="Balance"      value={fmtM(ti-tg)}   sub={`gastos: ${fmtM(tg)}`} accent={ti-tg>=0?"#00e08a":"#ff5566"} vc={ti-tg>=0?"#00e08a":"#ff5566"}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card title="Producciones Recientes" action={{label:"Ver todas →",fn:()=>navTo("producciones")}}>
        {pros.length>0?<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Nombre</TH><TH>Estado</TH><TH>Balance</TH></tr></thead><tbody>
          {[...pros].reverse().slice(0,5).map(p=>{const b=bal(p.id);return<tr key={p.id} onClick={()=>navTo("pro-det",p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.est}/></TD><TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD></tr>;})}
        </tbody></table>:<Empty text="Sin producciones"/>}
      </Card>
      <Card title="Episodios Pendientes" action={{label:"Ver programas →",fn:()=>navTo("programas")}}>
        {eps.filter(e=>["Planificado","En Edición"].includes(e.estado)).slice(0,5).map(ep=>{const pg=pgs.find(x=>x.id===ep.pgId);return<div key={ep.id} onClick={()=>navTo("ep-det",ep.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid var(--bdr)",cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:600}}>Ep.{ep.num}: {ep.titulo}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{pg?.nom}{ep.fechaGrab?` · ${fmtD(ep.fechaGrab)}`:""}</div></div><Badge label={ep.estado}/></div>;})}
        {!eps.filter(e=>["Planificado","En Edición"].includes(e.estado)).length&&<Empty text="Sin episodios pendientes"/>}
      </Card>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card title="Programas Activos" action={{label:"Ver todos →",fn:()=>navTo("programas")}}>
        {pgs.filter(p=>p.est==="Activo").map(pg=>{const pe=eps.filter(e=>e.pgId===pg.id);const pub=pe.filter(e=>e.estado==="Publicado").length;return<div key={pg.id} onClick={()=>navTo("pg-det",pg.id)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)",cursor:"pointer"}}><div><div style={{fontSize:13,fontWeight:600}}>{pg.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{pg.tip} · {pub}/{pe.length} ep.</div></div><div style={{textAlign:"right"}}><div style={{fontSize:10,color:"var(--gr2)"}}>Balance</div><div style={{color:bal(pg.id).b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(bal(pg.id).b)}</div></div></div>;})}
        {!pgs.filter(p=>p.est==="Activo").length&&<Empty text="Sin programas activos"/>}
      </Card>
      <Card title="Auspiciadores Activos">
        {(auspiciadores||[]).filter(a=>a.empId===empId&&a.est==="Activo").slice(0,4).map(a=>{const progs=(a.pids||[]).map(pid=>pgs.find(x=>x.id===pid)).filter(Boolean);return<div key={a.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}><div><div style={{fontSize:13,fontWeight:600}}>{a.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{progs.map(p=>p.nom).join(", ")||"Sin programa"}</div></div><div style={{textAlign:"right"}}><Badge label={a.tip} sm/>{a.mon&&<div style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:11,marginTop:3}}>{fmtM(a.mon)}</div>}</div></div>;})}
        {!(auspiciadores||[]).filter(a=>a.empId===empId&&a.est==="Activo").length&&<Empty text="Sin auspiciadores activos"/>}
      </Card>
    </div>
    {/* Alertas en dashboard */}
    {alertas&&alertas.length>0&&<div style={{marginBottom:16}}>
      <Card title="🔔 Próximas Grabaciones" sub={`${alertas.length} fecha${alertas.length!==1?"s":""} próxima${alertas.length!==1?"s":""}`}>
        {alertas.slice(0,5).map(a=>{
          const colores={urgente:"#ff5566",pronto:"#ffcc44",info:"var(--cy)"};
          return <div key={a.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:colores[a.tipo],flexShrink:0,boxShadow:`0 0 6px ${colores[a.tipo]}`}}/>
            <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{a.titulo.replace(/^[^:]+:\s/,"")}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{a.sub} · {fmtD(a.fecha)}</div></div>
            <Badge label={a.diff===0?"Hoy":a.diff===1?"Mañana":`${a.diff} días`} color={a.tipo==="urgente"?"red":a.tipo==="pronto"?"yellow":"cyan"} sm/>
          </div>;
        })}
        {alertas.length>5&&<div style={{fontSize:11,color:"var(--gr2)",paddingTop:8,textAlign:"center"}}>+{alertas.length-5} más</div>}
      </Card>
    </div>}
    {/* Addons summary */}
    {empresa?.addons?.length>0&&<div style={{display:"grid",gridTemplateColumns:`repeat(${Math.min(empresa.addons.length,3)},1fr)`,gap:16}}>
      {empresa.addons?.includes("presupuestos")&&<Card title="📋 Presupuestos" action={{label:"Ver →",fn:()=>navTo("presupuestos")}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[["Borrador",(presupuestos||[]).filter(p=>p.empId===empId&&p.estado==="Borrador").length,"gray"],["Aceptado",(presupuestos||[]).filter(p=>p.empId===empId&&p.estado==="Aceptado").length,"green"],["Total",(presupuestos||[]).filter(p=>p.empId===empId).length,"cyan"]].map(([l,v,c])=><div key={l} style={{textAlign:"center",padding:10,background:"var(--card2)",borderRadius:8}}><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:c==="green"?"#00e08a":c==="cyan"?"var(--cy)":"var(--gr2)"}}>{v}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{l}</div></div>)}
        </div>
      </Card>}
      {empresa.addons?.includes("facturacion")&&<Card title="🧾 Facturación" action={{label:"Ver →",fn:()=>navTo("facturacion")}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["Pendiente",(facturas||[]).filter(p=>p.empId===empId&&p.estado==="Pendiente").length,"yellow"],["Pagada",(facturas||[]).filter(p=>p.empId===empId&&p.estado==="Pagada").length,"green"]].map(([l,v,c])=><div key={l} style={{textAlign:"center",padding:10,background:"var(--card2)",borderRadius:8}}><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:c==="green"?"#00e08a":"#ffcc44"}}>{v}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{l}</div></div>)}
        </div>
      </Card>}
      {empresa.addons?.includes("activos")&&<Card title="📦 Activos" action={{label:"Ver →",fn:()=>navTo("activos")}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {[["Total",(activos||[]).filter(a=>a.empId===empId).length,"cyan"],["Asignados",(activos||[]).filter(a=>a.empId===empId&&a.asignadoA).length,"green"]].map(([l,v,c])=><div key={l} style={{textAlign:"center",padding:10,background:"var(--card2)",borderRadius:8}}><div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:c==="cyan"?"var(--cy)":"#00e08a"}}>{v}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{l}</div></div>)}
        </div>
      </Card>}
    </div>}
  </div>;
}

// ── SUPER ADMIN PANEL ─────────────────────────────────────────
function SuperAdminPanel({empresas,users,onSave}){
  const [tab,setTab]=useState(0);
  const [ef,setEf]=useState({});const [eid,setEid]=useState(null);
  const saveEmp=()=>{
    if(!ef.nombre?.trim()) return;
    const id=eid||uid();
    const obj={id,nombre:ef.nombre,rut:ef.rut||"",dir:ef.dir||"",tel:ef.tel||"",ema:ef.ema||"",logo:"",color:ef.color||"#00d4e8",addons:ef.addons||[],active:ef.active!==false,plan:ef.plan||"starter",cr:today()};
    onSave("empresas",eid?empresas.map(e=>e.id===eid?obj:e):[...empresas,obj]);
    setEf({});setEid(null);
  };
  return <div>
    <Tabs tabs={["Empresas","Usuarios del sistema"]} active={tab} onChange={setTab}/>
    {tab===0&&<div>
      <div style={{marginBottom:14}}>
        {(empresas||[]).map(emp=><div key={emp.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:8,marginBottom:6}}>
          <div style={{width:34,height:34,borderRadius:8,background:emp.color+"30",border:`2px solid ${emp.color}`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:13,fontWeight:800,color:emp.color,flexShrink:0,overflow:"hidden"}}>
            {emp.logo ? <img src={emp.logo} style={{width:34,height:34,objectFit:"contain",borderRadius:6}} alt={emp.nombre}/> : ini(emp.nombre)}
          </div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{emp.nombre}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{emp.rut} · Addons: {emp.addons?.join(", ")||"ninguno"}</div></div>
          <Badge label={emp.active?"Activa":"Inactiva"} color={emp.active?"green":"red"} sm/>
          <Badge label={emp.plan} color="gray" sm/>
          <GBtn sm onClick={()=>{setEid(emp.id);setEf({...emp});}}>✏</GBtn>
          <GBtn sm onClick={()=>onSave("empresas",empresas.map(e=>e.id===emp.id?{...e,active:!e.active}:e))}>{emp.active?"Desactivar":"Activar"}</GBtn>
        </div>)}
      </div>
      <div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:8,padding:16}}>
        <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:14}}>{eid?"Editar Empresa":"Nueva Empresa"}</div>
        <R2><FG label="Nombre *"><FI value={ef.nombre||""} onChange={e=>setEf(p=>({...p,nombre:e.target.value}))} placeholder="Play Media SpA"/></FG><FG label="RUT"><FI value={ef.rut||""} onChange={e=>setEf(p=>({...p,rut:e.target.value}))} placeholder="78.118.348-2"/></FG></R2>
        <R2><FG label="Email"><FI value={ef.ema||""} onChange={e=>setEf(p=>({...p,ema:e.target.value}))} placeholder="contacto@empresa.cl"/></FG><FG label="Plan"><FSl value={ef.plan||"starter"} onChange={e=>setEf(p=>({...p,plan:e.target.value}))}><option value="starter">Starter</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></FSl></FG></R2>
        <FG label="Addons activados"><MultiSelect options={Object.entries(ADDONS).map(([v,a])=>({value:v,label:a.icon+" "+a.label}))} value={ef.addons||[]} onChange={v=>setEf(p=>({...p,addons:v}))} placeholder="Seleccionar addons..."/></FG>
        <R2><FG label="Color acento"><FI type="color" value={ef.color||"#00d4e8"} onChange={e=>setEf(p=>({...p,color:e.target.value}))}/></FG><FG label="Estado"><FSl value={ef.active===false?"false":"true"} onChange={e=>setEf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activa</option><option value="false">Inactiva</option></FSl></FG></R2>
        <div style={{display:"flex",gap:8}}><Btn onClick={saveEmp}>{eid?"Actualizar":"Crear Empresa"}</Btn>{eid&&<GBtn onClick={()=>{setEid(null);setEf({});}}>Cancelar</GBtn>}</div>
      </div>
    </div>}
    {tab===1&&<div>
      <div style={{fontSize:12,color:"var(--gr3)",marginBottom:12}}>Usuarios del sistema. Cada empresa gestiona sus propios usuarios desde el Panel Admin.</div>
      {(users||[]).map(u=><div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:6,marginBottom:6}}>
        <div style={{width:30,height:30,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(u.name)}</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{u.email}</div></div>
        <Badge label={ROLES[u.role]?.label||u.role} color={{superadmin:"red",admin:"cyan",productor:"green",comercial:"yellow",viewer:"gray"}[u.role]||"gray"} sm/>
        <Badge label={u.active?"Activo":"Inactivo"} color={u.active?"green":"red"} sm/>
      </div>)}
    </div>}
  </div>;
}

// ── ADMIN PANEL ───────────────────────────────────────────────

// ── LISTAS EDITOR — administración de desplegables ───────────
function ListasEditor({ listas, saveListas }) {
  const L = listas || DEFAULT_LISTAS;
  const [active, setActive] = useState("tiposPro");
  const [newVal, setNewVal] = useState("");

  const GROUPS = [
    { key:"tiposPro",      label:"Tipos de Producción" },
    { key:"catMov",        label:"Categorías de Movimientos" },
    { key:"industriasCli", label:"Industrias de Clientes" },
    { key:"catActivos",    label:"Categorías de Activos" },
  ];

  const items = L[active] || [];

  const addItem = () => {
    if (!newVal.trim() || items.includes(newVal.trim())) return;
    saveListas({ ...L, [active]: [...items, newVal.trim()] });
    setNewVal("");
  };

  const delItem = val => {
    saveListas({ ...L, [active]: items.filter(x => x !== val) });
  };

  const moveItem = (val, dir) => {
    const arr = [...items];
    const i = arr.indexOf(val);
    if (dir === -1 && i === 0) return;
    if (dir === 1 && i === arr.length - 1) return;
    [arr[i], arr[i + dir]] = [arr[i + dir], arr[i]];
    saveListas({ ...L, [active]: arr });
  };

  const resetGroup = () => {
    if (!confirm("¿Restaurar valores por defecto para esta lista?")) return;
    saveListas({ ...L, [active]: DEFAULT_LISTAS[active] });
  };

  return (
    <div>
      <div style={{ fontSize:12,color:"var(--gr2)",marginBottom:16 }}>
        Administra las opciones que aparecen en los formularios. Los cambios se aplican de inmediato.
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"200px 1fr",gap:16,alignItems:"start" }}>
        {/* Selector de lista */}
        <div style={{ background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden" }}>
          {GROUPS.map(g => (
            <div key={g.key} onClick={() => { setActive(g.key); setNewVal(""); }}
              style={{ padding:"11px 14px",cursor:"pointer",fontSize:12,fontWeight:active===g.key?700:400,color:active===g.key?"var(--cy)":"var(--gr3)",background:active===g.key?"var(--cg)":"transparent",borderLeft:active===g.key?"3px solid var(--cy)":"3px solid transparent",borderBottom:"1px solid var(--bdr)" }}>
              {g.label}
              <span style={{ float:"right",background:"var(--bdr2)",borderRadius:20,padding:"1px 7px",fontSize:10,color:"var(--gr2)",fontFamily:"var(--fm)" }}>{(L[g.key]||[]).length}</span>
            </div>
          ))}
        </div>
        {/* Editor de ítems */}
        <div>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12 }}>
            <div style={{ fontFamily:"var(--fh)",fontSize:13,fontWeight:700 }}>{GROUPS.find(g=>g.key===active)?.label}</div>
            <button onClick={resetGroup} style={{ fontSize:11,color:"var(--gr2)",background:"transparent",border:"1px solid var(--bdr2)",borderRadius:6,padding:"4px 10px",cursor:"pointer" }}>↺ Restaurar defaults</button>
          </div>
          {/* Add new */}
          <div style={{ display:"flex",gap:8,marginBottom:14 }}>
            <input value={newVal} onChange={e=>setNewVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Agregar nueva opción..." style={{...{width:"100%",padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,color:"var(--wh)",fontFamily:"var(--fb)",fontSize:13,outline:"none"},flex:1}}/>
            <button onClick={addItem} style={{ padding:"9px 16px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700,whiteSpace:"nowrap" }}>+ Agregar</button>
          </div>
          {/* Lista de ítems */}
          <div style={{ background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden" }}>
            {items.length > 0 ? items.map((val, i) => (
              <div key={val} style={{ display:"flex",alignItems:"center",gap:8,padding:"9px 12px",borderBottom:i<items.length-1?"1px solid var(--bdr)":"none",background:"transparent" }}>
                <div style={{ display:"flex",flexDirection:"column",gap:2 }}>
                  <button onClick={()=>moveItem(val,-1)} disabled={i===0} style={{ background:"none",border:"none",color:i===0?"var(--bdr2)":"var(--gr2)",cursor:i===0?"default":"pointer",fontSize:10,padding:0,lineHeight:1 }}>▲</button>
                  <button onClick={()=>moveItem(val,1)} disabled={i===items.length-1} style={{ background:"none",border:"none",color:i===items.length-1?"var(--bdr2)":"var(--gr2)",cursor:i===items.length-1?"default":"pointer",fontSize:10,padding:0,lineHeight:1 }}>▼</button>
                </div>
                <span style={{ flex:1,fontSize:13,color:"var(--wh)" }}>{val}</span>
                <button onClick={()=>delItem(val)} style={{ background:"none",border:"1px solid #ff556625",borderRadius:4,color:"var(--red)",cursor:"pointer",fontSize:10,fontWeight:600,padding:"2px 8px" }}>✕</button>
              </div>
            )) : (
              <div style={{ padding:20,textAlign:"center",color:"var(--gr2)",fontSize:12 }}>Sin opciones. Agrega la primera arriba.</div>
            )}
          </div>
          <div style={{ fontSize:11,color:"var(--gr)",marginTop:8 }}>{items.length} opciones · Los cambios se guardan automáticamente</div>
        </div>
      </div>
    </div>
  );
}


// ── EMPRESA EDIT — editar datos de empresa desde Admin ───────
function EmpresaEdit({ empresa, empresas, saveEmpresas, ntf }) {
  const [ef, setEf] = useState({});
  const [editing, setEditing] = useState(false);
  useEffect(() => { setEf({ nombre: empresa.nombre||"", rut: empresa.rut||"", ema: empresa.ema||"", tel: empresa.tel||"", dir: empresa.dir||"" }); }, [empresa.id]);
  const save = () => {
    const updated = { ...empresa, ...ef };
    saveEmpresas((empresas||[]).map(em => em.id === empresa.id ? updated : em));
    ntf("Datos guardados ✓");
    setEditing(false);
  };
  if (!editing) return (
    <div style={{ background:"var(--sur)", border:"1px solid var(--bdr2)", borderRadius:10, padding:16 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div style={{ fontFamily:"var(--fh)", fontSize:13, fontWeight:700 }}>Datos de la Empresa</div>
        <GBtn sm onClick={() => setEditing(true)}>✏ Editar</GBtn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
        {[["Nombre", empresa.nombre],["RUT", empresa.rut],["Email", empresa.ema||"—"],["Teléfono", empresa.tel||"—"],["Dirección", empresa.dir||"—"],["Plan", empresa.plan],["Addons", empresa.addons?.join(", ")||"ninguno"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </div>
    </div>
  );
  return (
    <div style={{ background:"var(--sur)", border:"1px solid var(--cy)", borderRadius:10, padding:16 }}>
      <div style={{ fontFamily:"var(--fh)", fontSize:13, fontWeight:700, marginBottom:14 }}>Editar Datos de la Empresa</div>
      <R2>
        <FG label="Nombre empresa"><FI value={ef.nombre} onChange={e=>setEf(p=>({...p,nombre:e.target.value}))} placeholder="Mi Productora SpA"/></FG>
        <FG label="RUT"><FI value={ef.rut} onChange={e=>setEf(p=>({...p,rut:e.target.value}))} placeholder="78.118.348-2"/></FG>
      </R2>
      <R2>
        <FG label="Email"><FI value={ef.ema} onChange={e=>setEf(p=>({...p,ema:e.target.value}))} placeholder="contacto@empresa.cl"/></FG>
        <FG label="Teléfono"><FI value={ef.tel} onChange={e=>setEf(p=>({...p,tel:e.target.value}))} placeholder="+56 9 1234 5678"/></FG>
      </R2>
      <FG label="Dirección"><FI value={ef.dir} onChange={e=>setEf(p=>({...p,dir:e.target.value}))} placeholder="Av. Principal 123, Santiago"/></FG>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <Btn onClick={save}>✓ Guardar</Btn>
        <GBtn onClick={() => setEditing(false)}>Cancelar</GBtn>
      </div>
    </div>
  );
}

function AdminPanel({open,onClose,theme,onSaveTheme,empresa,user,users,empresas,saveUsers,saveEmpresas,listas,saveListas,onPurge,ntf}){
  const [tab,setTab]=useState(0);
  const [lt,setLt]=useState(theme||{});
  const [uf,setUf]=useState({});const [uid2,setUid2]=useState(null);
  useEffect(()=>setLt(theme||{}),[theme]);
  const FIELDS=[["bg","Fondo principal"],["surface","Fondo lateral"],["card","Tarjetas"],["border","Bordes"],["accent","Acento"],["white","Texto"],["gray","Texto secundario"]];
  const rcol={superadmin:"red",admin:"cyan",productor:"green",comercial:"yellow",viewer:"gray"};
  const empUsers=(users||[]).filter(u=>u.empId===empresa?.id||user?.role==="superadmin");
  const saveUser=()=>{
    if(!uf.name||!uf.email) return;
    const id=uid2||uid();
    const obj={id,name:uf.name,email:uf.email,password:uf.password||(users||[]).find(x=>x.id===id)?.password||"",role:uf.role||"viewer",empId:empresa?.id||null,active:uf.active!==false};
    saveUsers(uid2?(users||[]).map(u=>u.id===uid2?obj:u):[...(users||[]),obj]);
    setUf({});setUid2(null);ntf("Usuario guardado");
  };
  return <Modal open={open} onClose={onClose} title="⚙ Panel Administrador" sub={`${empresa?.nombre||"Sistema"}`} wide>
    <Tabs tabs={["Colores","Usuarios","Empresa","Listas","Datos"]} active={tab} onChange={setTab}/>
    {tab===0&&<div>
      <div style={{fontSize:12,color:"var(--gr2)",marginBottom:14}}>Cambia los colores del sistema. Se aplican para todos los usuarios.</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {FIELDS.map(([k,lbl])=><div key={k} style={{display:"flex",alignItems:"center",gap:10,background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,padding:"8px 12px"}}>
          <input type="color" value={lt[k]||"#000"} onChange={e=>setLt(p=>({...p,[k]:e.target.value}))} style={{width:36,height:36,borderRadius:6,border:"none",background:"none",cursor:"pointer",flexShrink:0}}/>
          <div><div style={{fontSize:11,fontWeight:600}}>{lbl}</div><div style={{fontSize:10,color:"var(--gr2)",fontFamily:"var(--fm)"}}>{lt[k]}</div></div>
        </div>)}
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={(e)=>{e.stopPropagation();e.preventDefault();onSaveTheme(lt);ntf("Tema aplicado ✓");}} style={{padding:"9px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Aplicar</button>
        <button onClick={(e)=>{e.stopPropagation();const dt={bg:"#080809",surface:"#0f0f11",card:"#141416",border:"#1e1e24",accent:"#00d4e8",accent2:"#00b8c8",white:"#f4f4f6",gray:"#7c7c8a",mode:"dark"};setLt(dt);onSaveTheme(dt);ntf("Tema oscuro");}} style={{padding:"9px 14px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:600}}>🌙 Oscuro</button>
        <button onClick={(e)=>{e.stopPropagation();const lt2={bg:"#f0f2f5",surface:"#fff",card:"#fff",border:"#e2e4e9",accent:"#0099b8",accent2:"#007a94",white:"#111",gray:"#666",mode:"light"};setLt(lt2);onSaveTheme(lt2);ntf("Tema claro");}} style={{padding:"9px 14px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:600}}>☀ Claro</button>
      </div>
    </div>}
    {tab===1&&<div>
      <div style={{marginBottom:14}}>
        {empUsers.map(u=><div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:6,marginBottom:6}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(u.name)}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{u.email}</div></div>
          <Badge label={ROLES[u.role]?.label||u.role} color={rcol[u.role]||"gray"} sm/>
          <Badge label={u.active?"Activo":"Inactivo"} color={u.active?"green":"red"} sm/>
          <GBtn sm onClick={()=>{setUid2(u.id);setUf({...u});}}>✏</GBtn>
          <GBtn sm onClick={()=>saveUsers((users||[]).map(x=>x.id===u.id?{...x,active:!x.active}:x))}>{u.active?"Desactivar":"Activar"}</GBtn>
          {u.role!=="superadmin"&&<XBtn onClick={()=>{ if(!confirm("¿Eliminar usuario?")) return; saveUsers((users||[]).filter(x=>x.id!==u.id)); }}/>}
        </div>)}
      </div>
      <div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:8,padding:16}}>
        <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:14}}>{uid2?"Editar":"Agregar"} Usuario</div>
        <R2><FG label="Nombre"><FI value={uf.name||""} onChange={e=>setUf(p=>({...p,name:e.target.value}))} placeholder="Juan Pérez"/></FG><FG label="Email"><FI type="email" value={uf.email||""} onChange={e=>setUf(p=>({...p,email:e.target.value}))} placeholder="juan@empresa.cl"/></FG></R2>
        <R3><FG label="Contraseña"><FI type="password" value={uf.password||""} onChange={e=>setUf(p=>({...p,password:e.target.value}))} placeholder={uid2?"Nueva contraseña":"Contraseña"}/></FG><FG label="Rol"><FSl value={uf.role||"viewer"} onChange={e=>setUf(p=>({...p,role:e.target.value}))}>{Object.entries(ROLES).filter(([k])=>k!=="superadmin").map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</FSl></FG><FG label="Estado"><FSl value={uf.active===false?"false":"true"} onChange={e=>setUf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG></R3>
        <div style={{display:"flex",gap:8}}><Btn onClick={saveUser}>Guardar Usuario</Btn>{uid2&&<GBtn onClick={()=>{setUid2(null);setUf({});}}>Cancelar</GBtn>}</div>
      </div>
    </div>}
    {tab===2&&<div>
      <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Configura el logo y datos de tu empresa. El logo aparecerá en los presupuestos PDF.</div>
      {/* Logo Upload */}
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,padding:20,marginBottom:16}}>
        <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:14}}>Logo de la Empresa</div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{width:80,height:80,borderRadius:12,background:"var(--bdr)",border:"2px dashed var(--bdr2)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
            {empresa?.logo
              ? <img src={empresa.logo} style={{width:80,height:80,objectFit:"contain",borderRadius:10}} alt="Logo"/>
              : <div style={{textAlign:"center"}}><div style={{fontSize:24,marginBottom:4}}>🏢</div><div style={{fontSize:10,color:"var(--gr2)"}}>Sin logo</div></div>}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,color:"var(--gr3)",marginBottom:10}}>Sube el logo de {empresa?.nombre}. Aparecerá en los presupuestos PDF y en el selector de empresas.</div>
            <div style={{display:"flex",gap:8}}>
              <label style={{display:"inline-flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>
                📁 Subir logo
                <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                  const file=e.target.files[0]; if(!file) return;
                  const reader=new FileReader();
                  reader.onload=ev=>{
                    const logoData=ev.target.result;
                    const newEmp={...empresa,logo:logoData};
                    saveEmpresas((empresas||[]).map(em=>em.id===empresa.id?newEmp:em));
                    ntf("Logo guardado ✓");
                  };
                  reader.readAsDataURL(file);
                }}/>
              </label>
              {empresa?.logo&&<button onClick={()=>{saveEmpresas((empresas||[]).map(em=>em.id===empresa.id?{...em,logo:""}:em));ntf("Logo eliminado","warn");}} style={{padding:"8px 14px",borderRadius:6,border:"1px solid #ff556625",background:"transparent",color:"var(--red)",cursor:"pointer",fontSize:12,fontWeight:600}}>✕ Quitar</button>}
            </div>
            <div style={{fontSize:10,color:"var(--gr2)",marginTop:8}}>Formatos: JPG, PNG, SVG. Tamaño recomendado: 400×400px</div>
          </div>
        </div>
      </div>
      {/* Empresa data editable */}
      {empresa&&<EmpresaEdit empresa={empresa} empresas={empresas} saveEmpresas={saveEmpresas} ntf={ntf}/>}
    </div>}
    {tab===3&&<ListasEditor listas={listas} saveListas={saveListas}/>}
    {tab===4&&<div>
      <div style={{fontSize:12,color:"var(--gr2)",marginBottom:14}}>Acciones sobre la base de datos de esta empresa.</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
        <GBtn onClick={()=>{ if(!confirm("¿Restaurar datos demo?")) return; const sd=SEED_DATA(empresa?.id||"emp1"); Object.entries(sd).forEach(([k,v])=>dbSet(`produ:${empresa?.id}:${k}`,v)); ntf("Datos demo restaurados"); onClose(); }}>🔄 Restaurar Demo</GBtn>
        <button onClick={onPurge} style={{padding:"9px 18px",borderRadius:6,border:"1px solid #ff556640",background:"#ff556818",color:"var(--red)",cursor:"pointer",fontSize:12,fontWeight:700}}>🗑 Eliminar todos los datos</button>
      </div>
    </div>}
  </Modal>;
}

// ── APP ROOT ─────────────────────────────────────────────────
export default function App(){
  const [curUser,setCurUser]=useState(null);
  const [curEmp,setCurEmp]=useState(null);
  const [view,setView]=useState("dashboard");
  const [detId,setDetId]=useState(null);
  const [toast,setToast]=useState(null);
  const [mOpen,setMOpen]=useState("");
  const [mData,setMData]=useState({});
  const [adminOpen,setAdminOpen]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  const [syncPulse,setSyncPulse]=useState(false);
  const [superPanel,setSuperPanel]=useState(false);
  const [alertasOpen,setAlertasOpen]=useState(false);
  const [alertasLeidas,setAlertasLeidas]=useState([]);

  // Global data
  const [empresas,setEmpresasRaw,savEmpRef]=useDB("produ:empresas");
  const [users,setUsersRaw,savUsrRef]=useDB("produ:users");
  const [themeDB,setThemeDB]=useDB("produ:theme");

  // Per-empresa data
  const eId=curEmp?.id||"__none__";
  const [listas,setListas,savLst]=useDB(`produ:${eId}:listas`);
  const [tareas,setTareas,savTar]=useDB(`produ:${eId}:tareas`);
  const L = listas || DEFAULT_LISTAS; // listas activas con fallback a defaults
  const [clientes,setClientes,savCli,ldCli]=useDB(`produ:${eId}:clientes`);
  const [producciones,setProducciones,savPro,ldPro]=useDB(`produ:${eId}:producciones`);
  const [programas,setProgramas,savPg,ldPg]=useDB(`produ:${eId}:programas`);
  const [episodios,setEpisodios,savEp]=useDB(`produ:${eId}:episodios`);
  const [auspiciadores,setAuspiciadores,savAus]=useDB(`produ:${eId}:auspiciadores`);
  const [contratos,setContratos,savCt]=useDB(`produ:${eId}:contratos`);
  const [movimientos,setMovimientos,savMov]=useDB(`produ:${eId}:movimientos`);
  const [crew,setCrew,savCrew]=useDB(`produ:${eId}:crew`);
  const [eventos,setEventos,savEv]=useDB(`produ:${eId}:eventos`);
  const [presupuestos,setPresupuestos,savPres]=useDB(`produ:${eId}:presupuestos`);
  const [facturas,setFacturas,savFact]=useDB(`produ:${eId}:facturas`);
  const [activos,setActivos,savAct]=useDB(`produ:${eId}:activos`);
  const empId = curEmp?.id;
  const isLoading = curEmp && (ldCli || ldPro || ldPg);
  const alertas = useAlertas(episodios, programas, eventos||[], empId);

  // Polling
  usePoll(`produ:${eId}:clientes`,setClientes,savCli);
  usePoll(`produ:${eId}:producciones`,setProducciones,savPro);
  usePoll(`produ:${eId}:programas`,setProgramas,savPg);
  usePoll(`produ:${eId}:episodios`,setEpisodios,savEp);
  usePoll(`produ:${eId}:auspiciadores`,setAuspiciadores,savAus);
  usePoll(`produ:${eId}:contratos`,setContratos,savCt);
  usePoll(`produ:${eId}:movimientos`,setMovimientos,savMov);
  usePoll(`produ:${eId}:eventos`,setEventos,savEv);
  usePoll(`produ:${eId}:presupuestos`,setPresupuestos,savPres);
  usePoll(`produ:${eId}:facturas`,setFacturas,savFact);
  usePoll(`produ:${eId}:activos`,setActivos,savAct);
  usePoll(`produ:${eId}:crew`,setCrew,savCrew);
  usePoll(`produ:${eId}:listas`,setListas,savLst);
  usePoll(`produ:${eId}:tareas`,setTareas,savTar);

  // Init global data
  useEffect(()=>{
    dbGet("produ:empresas").then(v=>{ if(!v){setEmpresasRaw(SEED_EMPRESAS);dbSet("produ:empresas",SEED_EMPRESAS);}else setEmpresasRaw(v); });
    dbGet("produ:users").then(v=>{ if(!v){setUsersRaw(SEED_USERS);dbSet("produ:users",SEED_USERS);}else setUsersRaw(v); });
    dbGet("produ:theme").then(v=>{ applyTheme(v||DEFAULT_T); });
    try{const s=localStorage.getItem("produ_session");if(s){const p=JSON.parse(s);setCurUser(p.user);setCurEmp(p.emp);}}catch{}
  },[]);

  // Seed per-empresa data
  useEffect(()=>{
    if(!curEmp) return;
    const id=curEmp.id;
    const keys=["clientes","producciones","programas","episodios","auspiciadores","contratos","movimientos","crew","eventos","presupuestos","facturas","activos","listas","tareas"];
    const setters={tareas:setTareas,clientes:setClientes,producciones:setProducciones,programas:setProgramas,episodios:setEpisodios,auspiciadores:setAuspiciadores,contratos:setContratos,movimientos:setMovimientos,crew:setCrew,eventos:setEventos,presupuestos:setPresupuestos,facturas:setFacturas,activos:setActivos,listas:setListas};
    keys.forEach(async k=>{
      const v=await dbGet(`produ:${id}:${k}`);
      if(v===null){const seed=SEED_DATA(id)[k]||[];dbSet(`produ:${id}:${k}`,seed);setters[k]?.(seed);}
    });
  },[curEmp?.id]);

  const DEFAULT_T={mode:"dark",bg:"#080809",surface:"#0f0f11",card:"#141416",border:"#1e1e24",accent:"#00d4e8",accent2:"#00b8c8",white:"#f4f4f6",gray:"#7c7c8a"};
  const [theme,setThemeState]=useState(DEFAULT_T);
  const applyTheme=t=>{
    const merged={...DEFAULT_T,...t};
    setThemeState(merged);
    const r=document.documentElement;
    const map={"--bg":merged.bg,"--sur":merged.surface,"--card":merged.card,"--card2":merged.card,"--bdr":merged.border,"--bdr2":merged.border,"--cy":merged.accent,"--cy2":merged.accent2||merged.accent,"--cg":merged.accent+"20","--cm":merged.accent+"40","--wh":merged.white,"--gr":merged.gray,"--gr2":merged.gray,"--gr3":merged.white+"cc"};
    Object.entries(map).forEach(([k,v])=>r.style.setProperty(k,v));
    document.body.className=merged.mode==="light"?"light":"";
  };
  const saveTheme=t=>{applyTheme(t);dbSet("produ:theme",t);};

  const ntf=useCallback((msg,type="ok")=>{setToast({msg,type});setSyncPulse(true);setTimeout(()=>setSyncPulse(false),2000);},[]);
  const openM=(k,d={})=>{setMData(d);setMOpen(k);};
  const closeM=()=>{setMOpen("");setMData({});};
  const navTo=(v,id=null)=>{setView(v);setDetId(id);};

  const login=u=>{
    if(u.role==="superadmin"){setCurUser(u);setCurEmp(null);return;}
    const emp=(empresas||SEED_EMPRESAS).find(e=>e.id===u.empId);
    setCurUser(u);setCurEmp(emp||null);
    try{localStorage.setItem("produ_session",JSON.stringify({user:u,emp}));}catch{}
  };
  const logout=()=>{setCurUser(null);setCurEmp(null);try{localStorage.removeItem("produ_session");}catch{}};
  const selectEmp=emp=>{
    if(emp==="__super__"){setSuperPanel(true);return;}
    setCurEmp(emp);
    try{localStorage.setItem("produ_session",JSON.stringify({user:curUser,emp}));}catch{}
  };

  // CRUD
  const cSave=async(arr,setArr,item)=>{
    const withEmp=item.empId?item:{...item,empId:curEmp?.id};
    const idx=(arr||[]).findIndex(x=>x.id===withEmp.id);
    const next=idx>=0?(arr||[]).map((x,i)=>i===idx?withEmp:x):[...(arr||[]),{...withEmp,id:withEmp.id||uid(),cr:today()}];
    closeM();ntf("Guardado ✓");await setArr(next);
  };
  const cDel=async(arr,setArr,id,goFn,msg="Eliminado")=>{
    if(!confirm("¿Confirmar eliminación?")) return;
    ntf(msg,"warn");if(goFn)goFn();
    await setArr((arr||[]).filter(x=>x.id!==id));
  };
  const saveMov=async d=>{const next=[...(movimientos||[]),{...d,id:uid(),empId:curEmp?.id}];closeM();ntf("Registrado ✓");await setMovimientos(next);};
  const delMov=async id=>{await setMovimientos((movimientos||[]).filter(m=>m.id!==id));ntf("Eliminado","warn");};

  const saveUsers=u=>{setUsersRaw(u);dbSet("produ:users",u);};
  const saveEmpresas=e=>{setEmpresasRaw(e);dbSet("produ:empresas",e);};
  const saveSuperData=(key,data)=>{ if(key==="empresas"){saveEmpresas(data);}else if(key==="users"){saveUsers(data);} ntf("Guardado ✓");};

  const ef=arr=>(arr||[]).filter(x=>x.empId===empId);
  const counts={cli:ef(clientes).length,pro:ef(producciones).length,pg:ef(programas).length,crew:ef(crew).length,aus:ef(auspiciadores).length,ct:ef(contratos).length,pres:ef(presupuestos).length,fact:ef(facturas).length,act:ef(activos).length,tar:(tareas||[]).filter(t=>t.empId===empId&&t.asignadoA===curUser?.id&&t.estado!=="Completada").length};

  // Breadcrumb
  const buildBc=()=>{
    const L={dashboard:"DASHBOARD",calendario:"CALENDARIO",clientes:"CLIENTES",producciones:"PRODUCCIONES",programas:"PROGRAMAS TV",crew:"EQUIPO / CREW",auspiciadores:"AUSPICIADORES",contratos:"CONTRATOS",presupuestos:"PRESUPUESTOS",facturacion:"FACTURACIÓN",activos:"ACTIVOS",television:"TELEVISIÓN"};
    if(view==="cli-det"){const c=(clientes||[]).find(x=>x.id===detId);return [{l:"CLIENTES",fn:()=>navTo("clientes")},{l:c?.nom||"—"}];}
    if(view==="pro-det"){const p=(producciones||[]).find(x=>x.id===detId);return [{l:"PRODUCCIONES",fn:()=>navTo("producciones")},{l:p?.nom||"—"}];}
    if(view==="pg-det"){const pg=(programas||[]).find(x=>x.id===detId);return [{l:"PROGRAMAS TV",fn:()=>navTo("programas")},{l:pg?.nom||"—"}];}
    if(view==="ep-det"){const ep=(episodios||[]).find(x=>x.id===detId);const pg=(programas||[]).find(x=>x.id===ep?.pgId);return [{l:"PROGRAMAS TV",fn:()=>navTo("programas")},{l:pg?.nom||"—",fn:()=>navTo("pg-det",ep?.pgId)},{l:`Ep.${ep?.num}`}];}
    if(view==="pres-det"){const p=(presupuestos||[]).find(x=>x.id===detId);return [{l:"PRESUPUESTOS",fn:()=>navTo("presupuestos")},{l:p?.titulo||"—"}];}
    return [{l:L[view]||view.toUpperCase()}];
  };

  const VP={empresa:curEmp,user:curUser,listas:L,tareas:tareas||[],clientes:clientes||[],producciones:producciones||[],programas:programas||[],episodios:episodios||[],auspiciadores:auspiciadores||[],contratos:contratos||[],movimientos:movimientos||[],crew:crew||[],eventos:eventos||[],presupuestos:presupuestos||[],facturas:facturas||[],activos:activos||[],users:users||SEED_USERS,empresas:empresas||SEED_EMPRESAS,navTo,openM,cSave,cDel,saveMov,delMov,ntf,theme,canDo:(a)=>canDo(curUser,a)};
  const setters={setClientes,setProducciones,setProgramas,setEpisodios,setAuspiciadores,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setActivos,setMovimientos};

  const renderView=()=>{
    if(superPanel) return <><div style={{marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800}}>Panel Super Admin</div><GBtn onClick={()=>setSuperPanel(false)}>← Volver</GBtn></div><SuperAdminPanel empresas={empresas||[]} users={users||[]} onSave={saveSuperData}/></>;
    switch(view){
      case"dashboard":    return <ViewDashboard {...VP} alertas={alertas}/>;
    case"tareas":       return <ViewTareas {...VP} saveTareas={async t=>{await setTareas(t);}} cSave={cSave} cDel={cDel} setTareas={setTareas} openM={openM} canDo={canDo}/>;
      case"clientes":     return <ViewClientes     {...VP} setClientes={setClientes}/>;
      case"cli-det":      return <ViewCliDet        {...VP} id={detId} setClientes={setClientes} setContratos={setContratos}/>;
      case"producciones": return <ViewPros          {...VP} setProducciones={setProducciones}/>;
      case"pro-det":      return <ViewProDet        {...VP} id={detId} setProducciones={setProducciones} setMovimientos={setMovimientos}/>;
      case"programas":    return <ViewPgs           {...VP} setProgramas={setProgramas}/>;
      case"pg-det":       return <ViewPgDet         {...VP} id={detId} setProgramas={setProgramas} setEpisodios={setEpisodios} setMovimientos={setMovimientos}/>;
      case"ep-det":       return <ViewEpDet         {...VP} id={detId} setEpisodios={setEpisodios} setMovimientos={setMovimientos}/>;
      case"crew":         return <ViewCrew          {...VP} setCrew={setCrew}/>;
      case"calendario":   return <ViewCalendario    {...VP} setEventos={setEventos}/>;
      case"auspiciadores":return <ViewAus           {...VP} setAuspiciadores={setAuspiciadores}/>;
      case"contratos":    return <ViewCts           {...VP} setContratos={setContratos}/>;
      case"presupuestos": return <ViewPres          {...VP} setPresupuestos={setPresupuestos}/>;
      case"pres-det":     return <ViewPresDet       {...VP} id={detId} setPresupuestos={setPresupuestos} setProducciones={setProducciones} setProgramas={setProgramas}/>;
      case"facturacion":  return <ViewFact          {...VP} setFacturas={setFacturas}/>;
      case"activos":      return <ViewActivos       {...VP} setActivos={setActivos}/>;
      default: return <Empty text="Módulo no disponible"/>;
    }
  };

  // Screens
  if(!empresas||!users) return <div style={{background:"#080809",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",color:"#00d4e8",fontFamily:"monospace"}}><StyleTag/>Iniciando Produ...</div>;
  if(!curUser) return <><StyleTag/><Login users={users||SEED_USERS} onLogin={login}/></>;
  if(curUser.role==="superadmin"&&!curEmp&&!superPanel) return <><StyleTag/><EmpresaSelector empresas={empresas||SEED_EMPRESAS} onSelect={selectEmp}/></>;

  const SW=collapsed?64:240;
  const bc=buildBc();

  return <div style={{display:"flex",minHeight:"100vh"}}>
    <StyleTag/>
    {/* Mobile overlay */}
    <div id="mob-overlay" onClick={()=>{document.querySelector("aside")?.classList.remove("mob-open");document.getElementById("mob-overlay").style.display="none";}} style={{display:"none",position:"fixed",inset:0,zIndex:299,background:"rgba(0,0,0,.6)"}}/>
    <Sidebar user={curUser} empresa={curEmp} view={superPanel?"__super__":view} onNav={v=>{setSuperPanel(false);navTo(v);document.querySelector("aside")?.classList.remove("mob-open");const o=document.getElementById("mob-overlay");if(o)o.style.display="none";}} onAdmin={()=>{setAdminOpen(true);document.querySelector("aside")?.classList.remove("mob-open");}} onLogout={logout} onChangeEmp={curUser.role==="superadmin"?()=>{setCurEmp(null);setSuperPanel(false);document.querySelector("aside")?.classList.remove("mob-open");}:null} counts={counts} collapsed={collapsed} onToggle={()=>setCollapsed(!collapsed)} syncPulse={syncPulse}/>
    <main style={{marginLeft:SW,flex:1,display:"flex",flexDirection:"column",minHeight:"100vh",transition:"margin-left .2s"}}>
      {/* Topbar */}
      <div style={{height:58,background:"var(--sur)",borderBottom:"1px solid var(--bdr)",display:"flex",alignItems:"center",padding:"0 16px",gap:10,position:"sticky",top:0,zIndex:100,flexShrink:0}}>
        {/* Hamburger - solo visible en móvil via CSS */}
        <button className="ham-btn" onClick={()=>{const s=document.querySelector("aside");const o=document.getElementById("mob-overlay");if(s){s.classList.add("mob-open");}if(o){o.style.display="block";}}} style={{display:"none",background:"none",border:"none",color:"var(--wh)",cursor:"pointer",fontSize:22,padding:"4px 6px",flexShrink:0,alignItems:"center",lineHeight:1}}>☰</button>
        <div style={{display:"flex",alignItems:"center",gap:8,flex:1,overflow:"hidden"}}>
          {bc.map((b,i)=><span key={i} style={{display:"flex",alignItems:"center",gap:8}}>
            {i>0&&<span style={{color:"var(--bdr2)",fontSize:16}}>/</span>}
            <span onClick={b.fn} style={{fontFamily:"var(--fh)",fontWeight:700,fontSize:i===bc.length-1?15:11,letterSpacing:i===bc.length-1?1:2,textTransform:"uppercase",color:b.fn?"var(--gr2)":"var(--wh)",cursor:b.fn?"pointer":"default",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",}} onMouseEnter={e=>{if(b.fn)e.target.style.color="var(--cy)";}} onMouseLeave={e=>{if(b.fn)e.target.style.color="var(--gr2)";}}>{b.l}</span>
          </span>)}
        </div>
        <div style={{display:"flex",gap:8,flexShrink:0,alignItems:"center"}}>
          {(view==="pro-det"||view==="pg-det")&&canDo(curUser,"movimientos")&&<Btn onClick={()=>openM("mov",{eid:detId,et:view==="pro-det"?"pro":"pg"})} sm>+ Movimiento</Btn>}
          {view==="ep-det"&&canDo(curUser,"movimientos")&&<Btn onClick={()=>openM("mov",{eid:detId,et:"ep",tipo:"gasto"})} sm>+ Gasto</Btn>}
          {curEmp&&<button onClick={()=>setAlertasOpen(!alertasOpen)} style={{position:"relative",background:alertasOpen?"var(--cg)":"none",border:`1px solid ${alertasOpen?"var(--cy)":"var(--bdr2)"}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",color:alertasOpen?"var(--cy)":"var(--gr3)",fontSize:16,display:"flex",alignItems:"center",gap:6}}>
            🔔
            {alertas.filter(a=>!alertasLeidas.includes(a.id)).length>0&&<span style={{position:"absolute",top:-4,right:-4,width:18,height:18,borderRadius:"50%",background:"#ff5566",fontSize:9,fontWeight:700,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>{alertas.filter(a=>!alertasLeidas.includes(a.id)).length}</span>}
          </button>}
        </div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:24}}>
        <div className="va" key={view+detId+superPanel}>
          {isLoading ? <LoadingScreen/> : renderView()}
        </div>
      </div>
    </main>
    {alertasOpen&&<AlertasPanel alertas={alertas} leidas={alertasLeidas} onMarcar={id=>setAlertasLeidas(p=>[...p,id])} onMarcarTodas={()=>setAlertasLeidas(alertas.map(a=>a.id))} onClose={()=>setAlertasOpen(false)}/> }
        {toast&&<Toast msg={toast.msg} type={toast.type} onDone={()=>setToast(null)}/>}
    {mOpen&&<ModalRouter mOpen={mOpen} mData={mData} closeM={closeM} VP={VP} setters={setters} saveTheme={saveTheme} saveUsers={saveUsers} saveEmpresas={saveEmpresas} ntf={ntf} cSave={cSave} saveMov={saveMov}/>}
    {adminOpen&&<AdminPanel open={adminOpen} onClose={()=>setAdminOpen(false)} theme={theme} onSaveTheme={saveTheme} empresa={curEmp} user={curUser} users={users||[]} empresas={empresas||[]} saveUsers={saveUsers} saveEmpresas={saveEmpresas} listas={L} saveListas={async nl=>{await setListas(nl);ntf("Listas guardadas");}} onPurge={()=>{if(!confirm("¿Eliminar TODOS los datos de esta empresa?")) return; ["clientes","producciones","programas","episodios","auspiciadores","contratos","movimientos","crew","eventos","presupuestos","facturas","activos"].forEach(k=>dbSet(`produ:${empId}:${k}`,[]));ntf("Datos eliminados","warn");setAdminOpen(false);}} ntf={ntf}/>}
  </div>;
}

// ── HELPERS COMPARTIDOS ─────────────────────────────────────
function MovBlock({movimientos,tipo,eid,etype,onAdd,onDel,canEdit}){
  const lbl={ingreso:"Ingresos",gasto:"Gastos / Egresos",caja:"Movimientos de Caja"}[tipo];
  const items=(movimientos||[]).filter(m=>m.tipo===tipo&&m.eid===eid);
  const total=items.reduce((s,m)=>s+Number(m.mon),0);
  const mc=tipo==="ingreso"?"#00e08a":tipo==="gasto"?"#ff5566":"var(--wh)";
  const [pg,setPg]=useState(1);const PP=8;
  return <Card title={lbl} sub={`Total: `} action={canEdit?{label:"+ Agregar",fn:()=>onAdd(eid,etype,tipo)}:null}>
    <div style={{fontSize:11,color:"var(--gr2)",marginTop:-10,marginBottom:12}}>Total: <span style={{color:mc,fontFamily:"var(--fm)"}}>{fmtM(total)}</span></div>
    {items.length>0?<><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><TH>Descripción</TH><TH>Categoría</TH><TH>Fecha</TH><TH>Monto</TH>{canEdit&&<TH></TH>}</tr></thead>
      <tbody>{items.slice((pg-1)*PP,pg*PP).map(m=><tr key={m.id}>
        <TD bold>{m.des}</TD>
        <TD><Badge label={m.cat||"General"} color="gray" sm/></TD>
        <TD mono style={{fontSize:11}}>{m.fec?fmtD(m.fec):"—"}</TD>
        <TD style={{color:mc,fontFamily:"var(--fm)",fontSize:12}}>{fmtM(m.mon)}</TD>
        {canEdit&&<TD><XBtn onClick={()=>onDel(m.id)}/></TD>}
      </tr>)}</tbody>
    </table></div><Paginator page={pg} total={items.length} perPage={PP} onChange={setPg}/></>
    :<Empty text={`Sin ${lbl.toLowerCase()}`} sub={canEdit?'Clic en "+ Agregar" para comenzar':""}/>}
  </Card>;
}

function MiniCal({refId,eventos,onAdd,onDel,canEdit,titulo}){
  const propios=(eventos||[]).filter(e=>e.ref===refId);
  const [pg,setPg]=useState(1);const PP=8;
  const sorted=[...propios].sort((a,b)=>(a.fecha||"").localeCompare(b.fecha||""));
  const TIPOS=[{v:"grabacion",ico:"🎬",lbl:"Grabación",c:"var(--cy)"},{v:"emision",ico:"📡",lbl:"Emisión",c:"#00e08a"},{v:"reunion",ico:"💬",lbl:"Reunión",c:"#ffcc44"},{v:"entrega",ico:"✓",lbl:"Entrega",c:"#ff8844"},{v:"otro",ico:"📌",lbl:"Otro",c:"#7c7c8a"}];
  const tc=v=>TIPOS.find(t=>t.v===v)?.c||"#7c7c8a";
  const ti=v=>TIPOS.find(t=>t.v===v)?.ico||"📌";
  const tl=v=>TIPOS.find(t=>t.v===v)?.lbl||v;
  return <Card title={`📅 Fechas — ${titulo||""}`} action={canEdit?{label:"+ Evento",fn:onAdd}:null}>
    {sorted.length>0?<><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
      <thead><tr><TH>Tipo</TH><TH>Título</TH><TH>Fecha</TH><TH>Hora</TH><TH>Descripción</TH>{canEdit&&<TH></TH>}</tr></thead>
      <tbody>{sorted.slice((pg-1)*PP,pg*PP).map(ev=><tr key={ev.id}>
        <TD><span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:tc(ev.tipo)+"22",color:tc(ev.tipo),border:`1px solid ${tc(ev.tipo)}40`}}>{ti(ev.tipo)} {tl(ev.tipo)}</span></TD>
        <TD bold>{ev.titulo}</TD>
        <TD mono style={{fontSize:11}}>{ev.fecha?fmtD(ev.fecha):"—"}</TD>
        <TD style={{fontSize:12,color:"var(--gr2)"}}>{ev.hora||"—"}</TD>
        <TD style={{fontSize:12,color:"var(--gr3)",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.desc||"—"}</TD>
        {canEdit&&<TD><XBtn onClick={()=>onDel(ev.id)}/></TD>}
      </tr>)}</tbody>
    </table></div><Paginator page={pg} total={sorted.length} perPage={PP} onChange={setPg}/></>
    :<Empty text="Sin fechas registradas" sub={canEdit?"Agrega el primer evento con el botón arriba":""}/>}
  </Card>;
}

// ── MODALES DE FORMULARIO ─────────────────────────────────────

function MCli({open,data,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",rut:"",ind:"",dir:"",not:"",contactos:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const addContact=()=>setF(p=>({...p,contactos:[...(p.contactos||[]),{id:uid(),nom:"",car:"",ema:"",tel:"",not:""}]}));
  const updContact=(i,k,v)=>setF(p=>({...p,contactos:(p.contactos||[]).map((c,j)=>j===i?{...c,[k]:v}:c)}));
  const delContact=i=>setF(p=>({...p,contactos:(p.contactos||[]).filter((_,j)=>j!==i)}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Cliente":"Nuevo Cliente"} sub="Empresa o persona" wide>
    <R2><FG label="Nombre / Razón Social *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Empresa ABC S.A."/></FG><FG label="RUT"><FI value={f.rut||""} onChange={e=>u("rut",e.target.value)} placeholder="76.543.210-0"/></FG></R2>
    <R2><FG label="Industria"><FSl value={f.ind||""} onChange={e=>u("ind",e.target.value)}><option value="">Seleccionar...</option>{(listas?.industriasCli||DEFAULT_LISTAS.industriasCli).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Dirección"><FI value={f.dir||""} onChange={e=>u("dir",e.target.value)} placeholder="Av. Providencia 123"/></FG></R2>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Observaciones generales..."/></FG>
    <Sep/>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Contactos</div>
      <GBtn sm onClick={addContact}>+ Agregar Contacto</GBtn>
    </div>
    {(f.contactos||[]).map((c,i)=><div key={c.id} style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,padding:12,marginBottom:10,position:"relative"}}>
      <div style={{position:"absolute",top:8,right:8}}><XBtn onClick={()=>delContact(i)}/></div>
      <R2><FG label="Nombre"><FI value={c.nom||""} onChange={e=>updContact(i,"nom",e.target.value)} placeholder="Juan Pérez"/></FG><FG label="Cargo"><FI value={c.car||""} onChange={e=>updContact(i,"car",e.target.value)} placeholder="Gerente Marketing"/></FG></R2>
      <R2><FG label="Email"><FI type="email" value={c.ema||""} onChange={e=>updContact(i,"ema",e.target.value)} placeholder="juan@empresa.cl"/></FG><FG label="Teléfono"><FI value={c.tel||""} onChange={e=>updContact(i,"tel",e.target.value)} placeholder="+56 9 1234 5678"/></FG></R2>
      <FG label="Observaciones"><FI value={c.not||""} onChange={e=>updContact(i,"not",e.target.value)} placeholder="Notas sobre este contacto..."/></FG>
    </div>)}
    {!(f.contactos||[]).length&&<div style={{textAlign:"center",padding:"14px",color:"var(--gr2)",fontSize:12,border:"1px dashed var(--bdr2)",borderRadius:8,marginBottom:14}}>Sin contactos. Haz clic en "+ Agregar Contacto"</div>}
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MPro({open,data,clientes,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",cliId:data?.cliId||"",tip:"Podcast",est:"Pre-Producción",ini:"",fin:"",des:"",crewIds:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Producción":"Nueva Producción"} sub="Proyecto audiovisual">
    <FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Nombre del proyecto"/></FG>
    <R2><FG label="Cliente"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{(listas?.tiposPro||DEFAULT_LISTAS.tiposPro).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{["Pre-Producción","En Curso","Post-Producción","Finalizado","Pausado"].map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Fecha Inicio"><FI type="date" value={f.ini||""} onChange={e=>u("ini",e.target.value)}/></FG><FG label="Fecha Entrega"><FI type="date" value={f.fin||""} onChange={e=>u("fin",e.target.value)}/></FG></R2>
    <FG label="Descripción"><FTA value={f.des||""} onChange={e=>u("des",e.target.value)} placeholder="Descripción del proyecto..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MPg({open,data,clientes,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",tip:"Programa de TV",can:"",est:"Activo",totalEp:"",fre:"Semanal",temporada:"",conductor:"",prodEjec:"",des:"",cliId:"",crewIds:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Programa":"Nuevo Programa"} sub="TV, Podcast, Web Series…" wide>
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Nombre del programa"/></FG><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{["Programa de TV","Podcast","Web Series","Talk Show","Documental","Otro"].map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Canal / Plataforma"><FI value={f.can||""} onChange={e=>u("can",e.target.value)} placeholder="Canal 13, Spotify..."/></FG><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{["Activo","En Desarrollo","Pausado","Finalizado"].map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R3><FG label="Total Episodios"><FI type="number" value={f.totalEp||""} onChange={e=>u("totalEp",Number(e.target.value))} placeholder="24"/></FG><FG label="Frecuencia"><FSl value={f.fre||""} onChange={e=>u("fre",e.target.value)}>{["Diario","Semanal","Quincenal","Mensual","Irregular"].map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Temporada"><FI value={f.temporada||""} onChange={e=>u("temporada",e.target.value)} placeholder="T1 2025"/></FG></R3>
    <R2><FG label="Conductor / Host"><FI value={f.conductor||""} onChange={e=>u("conductor",e.target.value)} placeholder="Nombre del conductor"/></FG><FG label="Productor Ejecutivo"><FI value={f.prodEjec||""} onChange={e=>u("prodEjec",e.target.value)} placeholder="Nombre del productor"/></FG></R2>
    <FG label="Cliente asociado (opcional)"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG>
    <FG label="Descripción"><FTA value={f.des||""} onChange={e=>u("des",e.target.value)} placeholder="De qué trata el programa..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MEp({open,data,programas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{pgId:data?.pgId||"",num:data?.num||1,titulo:"",estado:"Planificado",fechaGrab:"",fechaEmision:"",invitado:"",descripcion:"",locacion:"",duracion:"",notas:"",crewIds:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Episodio":"Nuevo Episodio"} sub="Planificación de episodio" wide>
    <R3><FG label="Programa"><FSl value={f.pgId||""} onChange={e=>u("pgId",e.target.value)}><option value="">Seleccionar...</option>{(programas||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG><FG label="Número *"><FI type="number" value={f.num||""} onChange={e=>u("num",Number(e.target.value))} min="1" placeholder="1"/></FG><FG label="Estado"><FSl value={f.estado||""} onChange={e=>u("estado",e.target.value)}>{["Planificado","Grabado","En Edición","Publicado","Cancelado"].map(o=><option key={o}>{o}</option>)}</FSl></FG></R3>
    <FG label="Título del Episodio *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Título descriptivo del episodio"/></FG>
    <R2><FG label="Invitado / Tema"><FI value={f.invitado||""} onChange={e=>u("invitado",e.target.value)} placeholder="Nombre o tema principal"/></FG><FG label="Locación"><FI value={f.locacion||""} onChange={e=>u("locacion",e.target.value)} placeholder="Estudio A, Exteriores..."/></FG></R2>
    <R3><FG label="Fecha Grabación"><FI type="date" value={f.fechaGrab||""} onChange={e=>u("fechaGrab",e.target.value)}/></FG><FG label="Fecha Emisión"><FI type="date" value={f.fechaEmision||""} onChange={e=>u("fechaEmision",e.target.value)}/></FG><FG label="Duración (min)"><FI type="number" value={f.duracion||""} onChange={e=>u("duracion",e.target.value)} placeholder="45"/></FG></R3>
    <FG label="Descripción / Sinopsis"><FTA value={f.descripcion||""} onChange={e=>u("descripcion",e.target.value)} placeholder="Descripción del contenido..."/></FG>
    <FG label="Notas de Producción"><FTA value={f.notas||""} onChange={e=>u("notas",e.target.value)} placeholder="Notas internas, pendientes..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.titulo?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MAus({open,data,programas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",tip:"Auspiciador Principal",con:"",ema:"",tel:"",pids:data?.pids||[],mon:"",vig:"",est:"Activo",frecPago:"Mensual",not:""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Auspiciador":"Nuevo Auspiciador"} sub="Marca o colaborador">
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Banco Estado"/></FG><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{["Auspiciador Principal","Auspiciador Secundario","Colaborador","Canje","Media Partner"].map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Contacto"><FI value={f.con||""} onChange={e=>u("con",e.target.value)} placeholder="María González"/></FG><FG label="Email"><FI value={f.ema||""} onChange={e=>u("ema",e.target.value)} placeholder="mg@empresa.cl"/></FG></R2>
    <R2><FG label="Monto (CLP)"><FI type="number" value={f.mon||""} onChange={e=>u("mon",e.target.value)} placeholder="0"/></FG><FG label="Frecuencia de Pago"><FSl value={f.frecPago||"Mensual"} onChange={e=>u("frecPago",e.target.value)}><option>Mensual</option><option>Semestral</option><option>Anual</option><option>Único</option></FSl></FG></R2>
    <FG label="Programas Asociados"><MultiSelect options={(programas||[]).map(p=>({value:p.id,label:p.nom}))} value={f.pids||[]} onChange={v=>u("pids",v)} placeholder="Seleccionar programas..."/></FG>
    <R2><FG label="Vigencia"><FI type="date" value={f.vig||""} onChange={e=>u("vig",e.target.value)}/></FG><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{["Activo","Negociación","Vencido","Cancelado"].map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Menciones, logo en créditos..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MCt({open,data,clientes,producciones,programas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",cliId:data?.cliId||"",tip:"Producción",est:"Borrador",mon:"",vig:"",arc:"",not:"",pids:[]});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const opts=[...(producciones||[]).map(p=>({value:"p:"+p.id,label:"📽 "+p.nom})),...(programas||[]).map(p=>({value:"pg:"+p.id,label:"📺 "+p.nom}))];
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Contrato":"Nuevo Contrato"} sub="Documento legal">
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Contrato de Producción Q2"/></FG><FG label="Cliente"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG></R2>
    <FG label="Proyectos Asociados"><MultiSelect options={opts} value={f.pids||[]} onChange={v=>u("pids",v)} placeholder="Producciones y programas..."/></FG>
    <R2><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{["Producción","Auspicio","Servicio","Licencia","Confidencialidad","Otro"].map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{["Borrador","En Revisión","Firmado","Vigente","Vencido"].map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Monto Total (CLP)"><FI type="number" value={f.mon||""} onChange={e=>u("mon",e.target.value)} placeholder="0"/></FG><FG label="Vigencia"><FI type="date" value={f.vig||""} onChange={e=>u("vig",e.target.value)}/></FG></R2>
    <FG label="Archivo / URL"><FI value={f.arc||""} onChange={e=>u("arc",e.target.value)} placeholder="URL del documento"/></FG>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Condiciones especiales..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MMov({open,data,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF({tipo:data?.tipo||"ingreso",mon:"",des:"",cat:"General",fec:today(),not:"",eid:data?.eid||"",et:data?.et||""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal open={open} onClose={onClose} title="Registrar Movimiento" sub="Ingreso, gasto o caja">
    <R2><FG label="Tipo *"><FSl value={f.tipo} onChange={e=>u("tipo",e.target.value)}><option value="ingreso">💰 Ingreso</option><option value="gasto">💸 Gasto / Egreso</option><option value="caja">🏦 Caja</option></FSl></FG><FG label="Monto (CLP) *"><FI type="number" value={f.mon} onChange={e=>u("mon",e.target.value)} placeholder="0" min="0"/></FG></R2>
    <FG label="Descripción *"><FI value={f.des} onChange={e=>u("des",e.target.value)} placeholder="Ej: Pago cuota 1, Arriendo..."/></FG>
    <R2><FG label="Categoría"><FSl value={f.cat} onChange={e=>u("cat",e.target.value)}>{(listas?.catMov||DEFAULT_LISTAS.catMov).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Fecha"><FI type="date" value={f.fec} onChange={e=>u("fec",e.target.value)}/></FG></R2>
    <MFoot onClose={onClose} onSave={()=>{if(!f.mon||!f.des?.trim())return;onSave({...f,mon:Number(f.mon)});}} label="Registrar"/>
  </Modal>;
}

function MCrew({open,data,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",rol:"",area:"Producción",tipo:"externo",tel:"",ema:"",dis:"",tarifa:"",not:"",active:true});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const AREAS=["Producción","Técnica","Postprod.","Dirección","Arte","Sonido","Fotografía","Otro"];
  const ROLES_C=["Conductor","Conductora","Director","Productora General","Productor Ejecutivo","Director de Cámara","Camarógrafo","Sonidista","Iluminador","Editor","Colorista","Diseñador Gráfico","Asistente de Producción","Community Manager","Maquillaje","Vestuario","Otro"];
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Miembro":"Agregar al Equipo"} sub="Crew de producción">
    <FG label="Tipo de Crew"><FSl value={f.tipo||"externo"} onChange={e=>u("tipo",e.target.value)}><option value="externo">Externo — tarifa aplica a producciones</option><option value="interno">Interno — personal de planta</option></FSl></FG>
    <R2><FG label="Nombre completo *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Juan Pérez"/></FG><FG label="Rol / Cargo"><FSl value={f.rol||""} onChange={e=>u("rol",e.target.value)}><option value="">Seleccionar...</option>{ROLES_C.map(r=><option key={r}>{r}</option>)}</FSl></FG></R2>
    <R2><FG label="Área"><FSl value={f.area||""} onChange={e=>u("area",e.target.value)}>{AREAS.map(a=><option key={a}>{a}</option>)}</FSl></FG><FG label="Disponibilidad"><FI value={f.dis||""} onChange={e=>u("dis",e.target.value)} placeholder="Lun-Vie, Fines de semana..."/></FG></R2>
    <R2><FG label="Teléfono"><FI value={f.tel||""} onChange={e=>u("tel",e.target.value)} placeholder="+56 9 1234 5678"/></FG><FG label="Email"><FI type="email" value={f.ema||""} onChange={e=>u("ema",e.target.value)} placeholder="juan@email.cl"/></FG></R2>
    <R2><FG label="Tarifa"><FI value={f.tarifa||""} onChange={e=>u("tarifa",e.target.value)} placeholder="$150.000/día"/></FG><FG label="Estado"><FSl value={f.active!==false?"true":"false"} onChange={e=>u("active",e.target.value==="true")}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG></R2>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Especialidades, observaciones..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function MEvento({open,data,producciones,programas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{titulo:"",tipo:"grabacion",fecha:data?.fecha||"",hora:"",desc:"",ref:data?.ref||"",refTipo:data?.refTipo||""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const TIPOS=[{v:"grabacion",l:"🎬 Grabación"},{v:"emision",l:"📡 Emisión"},{v:"reunion",l:"💬 Reunión"},{v:"entrega",l:"✓ Entrega"},{v:"estreno",l:"🌟 Estreno"},{v:"otro",l:"📌 Otro"}];
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Evento":"Nuevo Evento de Calendario"} sub="Fecha de grabación, emisión, reunión u otro">
    <FG label="Título del evento *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Grabación Episodio 5, Reunión..."/></FG>
    <R2><FG label="Tipo"><FSl value={f.tipo||"grabacion"} onChange={e=>u("tipo",e.target.value)}>{TIPOS.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}</FSl></FG>
    <FG label="Vinculado a"><FSl value={f.ref||""} onChange={e=>{const opt=[...(producciones||[]).map(p=>({v:p.id,t:"produccion"})),...(programas||[]).map(p=>({v:p.id,t:"programa"}))].find(o=>o.v===e.target.value);u("ref",e.target.value);u("refTipo",opt?.t||"");}}>
      <option value="">Sin vinculación</option>
      <optgroup label="Producciones">{(producciones||[]).map(p=><option key={p.id} value={p.id}>📽 {p.nom}</option>)}</optgroup>
      <optgroup label="Programas">{(programas||[]).map(p=><option key={p.id} value={p.id}>📺 {p.nom}</option>)}</optgroup>
    </FSl></FG></R2>
    <R2><FG label="Fecha *"><FI type="date" value={f.fecha||""} onChange={e=>u("fecha",e.target.value)}/></FG><FG label="Hora"><FI type="time" value={f.hora||""} onChange={e=>u("hora",e.target.value)}/></FG></R2>
    <FG label="Descripción / Notas"><FTA value={f.desc||""} onChange={e=>u("desc",e.target.value)} placeholder="Detalles, ubicación, participantes..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.titulo?.trim()||!f.fecha)return;onSave(f);}}/>
  </Modal>;
}

// ── MODAL ROUTER ──────────────────────────────────────────────
function ModalRouter({mOpen,mData,closeM,VP,setters,saveTheme,saveUsers,saveEmpresas,ntf,cSave,saveMov}){
  const {empresa,clientes,producciones,programas,auspiciadores,contratos,crew,eventos}=VP;
  const {setClientes,setProducciones,setProgramas,setEpisodios,setAuspiciadores,setContratos,setCrew,setEventos,setPresupuestos,setFacturas,setActivos,setMovimientos}=setters;

  const empId=empresa?.id;
  const withEmp=d=>({...d,empId});

  return <>
    <MCli    open={mOpen==="cli"}    data={mData} listas={VP.listas} onClose={closeM} onSave={d=>cSave(clientes,setClientes,withEmp(d))}/>
    <MPro    open={mOpen==="pro"}    data={mData} clientes={clientes} listas={VP.listas} onClose={closeM} onSave={d=>cSave(producciones,setProducciones,withEmp(d))}/>
    <MPg     open={mOpen==="pg"}     data={mData} clientes={clientes} onClose={closeM} onSave={d=>cSave(programas,setProgramas,withEmp(d))}/>
    <MEp     open={mOpen==="ep"}     data={mData} programas={programas} onClose={closeM} onSave={d=>cSave(VP.episodios,setEpisodios,withEmp(d))}/>
    <MAus    open={mOpen==="aus"}    data={mData} programas={programas} onClose={closeM} onSave={d=>cSave(auspiciadores,setAuspiciadores,withEmp(d))}/>
    <MCt     open={mOpen==="ct"}     data={mData} clientes={clientes} producciones={producciones} programas={programas} onClose={closeM} onSave={d=>cSave(contratos,setContratos,withEmp(d))}/>
    <MMov    open={mOpen==="mov"}    data={mData} listas={VP.listas} onClose={closeM} onSave={saveMov}/>
    <MCrew   open={mOpen==="crew"}   data={mData} onClose={closeM} onSave={d=>cSave(crew,setCrew,withEmp(d))}/>
    <MEvento open={mOpen==="evento"} data={mData} producciones={producciones} programas={programas} onClose={closeM} onSave={d=>cSave(eventos,setEventos,withEmp(d))}/>
    <MPres   open={mOpen==="pres"}   data={mData} clientes={clientes} producciones={producciones} programas={programas} onClose={closeM} onSave={d=>cSave(VP.presupuestos,setPresupuestos,withEmp(d))} empresa={empresa}/>
    <MFact   open={mOpen==="fact"}   data={mData} clientes={clientes} auspiciadores={auspiciadores} producciones={producciones} programas={programas} onClose={closeM} onSave={d=>cSave(VP.facturas,setFacturas,withEmp(d))}/>
    <MActivo open={mOpen==="activo"} data={mData} producciones={producciones} listas={VP.listas} onClose={closeM} onSave={d=>cSave(VP.activos,setActivos,withEmp(d))}/>
    <MTarea  open={mOpen==="tarea"}  data={mData} producciones={producciones} programas={programas} crew={crew} onClose={closeM} onSave={d=>cSave(VP.tareas,setTareas,withEmp(d))}/>
  </>;
}

// ── CLIENTES ──────────────────────────────────────────────────
function ViewClientes({empresa,clientes,producciones,movimientos,navTo,openM,canDo:_cd}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const [q,setQ]=useState("");const [fi,setFi]=useState("");const [vista,setVista]=useState("cards");const [pg,setPg]=useState(1);const PP=9;
  const fd=(clientes||[]).filter(x=>x.empId===empId).filter(c=>(c.nom.toLowerCase().includes(q.toLowerCase())||(c.contactos||[]).some(co=>co.nom.toLowerCase().includes(q.toLowerCase())))&&(!fi||c.ind===fi));
  const canEdit=canDo({role:_cd?.user?.role||"admin"},"clientes");
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar cliente o contacto..."/>
      <FilterSel value={fi} onChange={v=>{setFi(v);setPg(1);}} options={["Retail","Tecnología","Salud","Educación","Entretenimiento","Gastronomía","Inmobiliaria","Servicios","Media","Gobierno","Otro"]} placeholder="Todas industrias"/>
      <div style={{display:"flex",gap:4,background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,padding:3}}>
        {[["cards","⊟"],["list","☰"]].map(([v,i])=><button key={v} onClick={()=>setVista(v)} style={{padding:"5px 10px",borderRadius:4,border:"none",background:vista===v?"var(--cy)":"transparent",color:vista===v?"var(--bg)":"var(--gr2)",cursor:"pointer",fontSize:13}}>{i}</button>)}
      </div>
      {_cd&&_cd("clientes")&&<Btn onClick={()=>openM("cli",{})}>+ Nuevo Cliente</Btn>}
    </div>
    {vista==="cards"?<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:12}}>
        {fd.slice((pg-1)*PP,pg*PP).map(c=>{
          const pr=(producciones||[]).filter(p=>p.cliId===c.id).length;
          let ti=0,tg=0;(producciones||[]).filter(p=>p.cliId===c.id).forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
          return <div key={c.id} onClick={()=>navTo("cli-det",c.id)} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20,cursor:"pointer",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform=""}>
            <div style={{width:44,height:44,background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:15,fontWeight:800,color:"var(--cy)",marginBottom:14}}>{ini(c.nom)}</div>
            <div style={{fontSize:14,fontWeight:700,marginBottom:3}}>{c.nom}</div>
            <div style={{fontSize:11,color:"var(--gr2)"}}>{c.ind||"Sin industria"}</div>
            {(c.contactos||[]).slice(0,2).map(co=><div key={co.id} style={{fontSize:11,color:"var(--gr2)",marginTop:5}}>👤 {co.nom}{co.car?" · "+co.car:""}</div>)}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:14,paddingTop:12,borderTop:"1px solid var(--bdr)"}}>
              <span style={{fontSize:11,color:"var(--cy)"}}>{pr} prod.</span>
              <span style={{fontSize:11,color:ti-tg>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)"}}>{fmtM(ti-tg)}</span>
            </div>
          </div>;
        })}
      </div>
      {!fd.length&&<Empty text="Sin clientes" sub="Crea el primero con el botón superior"/>}
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </>:
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Nombre</TH><TH>Industria</TH><TH>Contacto Principal</TH><TH>Email</TH><TH>Teléfono</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>{fd.slice((pg-1)*PP,pg*PP).map(c=>{
          let ti=0,tg=0;(producciones||[]).filter(p=>p.cliId===c.id).forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
          const pc=(c.contactos||[])[0];
          return <tr key={c.id} onClick={()=>navTo("cli-det",c.id)}>
            <TD bold>{c.nom}</TD><TD>{c.ind||"—"}</TD>
            <TD>{pc?pc.nom:"—"}</TD><TD style={{fontSize:11}}>{pc?.ema||"—"}</TD><TD style={{fontSize:11}}>{pc?.tel||"—"}</TD>
            <TD style={{color:ti-tg>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(ti-tg)}</TD>
            <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("cli-det",c.id);}}>Ver →</GBtn></TD>
          </tr>;
        })}</tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>}
  </div>;
}

function ViewCliDet({id,empresa,clientes,producciones,contratos,movimientos,navTo,openM,canDo:_cd,cSave,cDel,setClientes,setContratos}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const c=(clientes||[]).find(x=>x.id===id);if(!c) return <Empty text="No encontrado"/>;
  const prs=(producciones||[]).filter(p=>p.cliId===id);
  const cts=(contratos||[]).filter(x=>x.cliId===id);
  let ti=0,tg=0;prs.forEach(p=>{const b=bal(p.id);ti+=b.i;tg+=b.g;});
  return <div>
    <DetHeader title={c.nom} tag={c.ind} meta={[c.rut&&`RUT: ${c.rut}`,c.dir].filter(Boolean)}
      actions={_cd&&_cd("clientes")&&<><GBtn onClick={()=>openM("cli",c)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(clientes,setClientes,id,()=>navTo("clientes"),"Cliente eliminado");}}>🗑 Eliminar</DBtn></>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Producciones" value={prs.length} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Contratos"    value={cts.length}/>
      <Stat label="Ingresos"     value={fmtM(ti)}     accent="#00e08a" vc="#00e08a"/>
      <Stat label="Balance"      value={fmtM(ti-tg)}  accent={ti-tg>=0?"#00e08a":"#ff5566"} vc={ti-tg>=0?"#00e08a":"#ff5566"}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
      <Card title="Contactos">
        {(c.contactos||[]).length>0?(c.contactos||[]).map(co=><div key={co.id} style={{padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:"var(--cg)",border:"1px solid var(--cm)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--cy)",flexShrink:0}}>{ini(co.nom)}</div>
            <div><div style={{fontSize:13,fontWeight:600}}>{co.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{co.car||"—"}</div></div>
          </div>
          <div style={{fontSize:11,color:"var(--gr3)",paddingLeft:38,marginBottom:8}}>✉ {co.ema||"—"} &nbsp;·&nbsp; ☎ {co.tel||"—"}</div>
          {co.not&&<div style={{fontSize:11,color:"var(--gr2)",paddingLeft:38,marginBottom:8}}>{co.not}</div>}
          <div style={{paddingLeft:38}}><ContactBtns tel={co.tel} ema={co.ema} nombre={co.nom} mensaje={`Hola ${co.nom}, te contactamos desde Produ.`}/></div>
        </div>):<Empty text="Sin contactos registrados"/>}
      </Card>
      <Card title="Financiero">
        <KV label="Total Ingresos" value={<span style={{color:"#00e08a",fontFamily:"var(--fm)"}}>{fmtM(ti)}</span>}/>
        <KV label="Total Gastos"   value={<span style={{color:"#ff5566",fontFamily:"var(--fm)"}}>{fmtM(tg)}</span>}/>
        <Sep/>
        <KV label={<b>Balance</b>} value={<span style={{color:ti-tg>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:14}}>{fmtM(ti-tg)}</span>}/>
        {c.not&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)"}}>{c.not}</div></>}
      </Card>
    </div>
    <Card title={`Producciones (${prs.length})`} action={_cd&&_cd("producciones")?{label:"+ Nueva",fn:()=>openM("pro",{cliId:id})}:null} style={{marginBottom:16}}>
      {prs.length?<table style={{width:"100%",borderCollapse:"collapse"}}><thead><tr><TH>Nombre</TH><TH>Tipo</TH><TH>Estado</TH><TH>Inicio</TH><TH>Entrega</TH><TH>Balance</TH><TH></TH></tr></thead><tbody>
        {prs.map(p=>{const b=bal(p.id);return <tr key={p.id} onClick={()=>navTo("pro-det",p.id)}><TD bold>{p.nom}</TD><TD><Badge label={p.tip} color="gray" sm/></TD><TD><Badge label={p.est}/></TD><TD mono style={{fontSize:11}}>{p.ini?fmtD(p.ini):"—"}</TD><TD mono style={{fontSize:11}}>{p.fin?fmtD(p.fin):"—"}</TD><TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD><TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("pro-det",p.id);}}>Ver →</GBtn></TD></tr>;})}
      </tbody></table>:<Empty text="Sin producciones"/>}
    </Card>
    <Card title={`Contratos (${cts.length})`} action={_cd&&_cd("contratos")?{label:"+ Nuevo",fn:()=>openM("ct",{cliId:id})}:null}>
      {cts.map(ct=><div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{fontSize:18,flexShrink:0}}>📄</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{ct.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{ct.tip}{ct.vig?" · "+fmtD(ct.vig):""}</div></div><Badge label={ct.est}/>{ct.mon&&<span style={{fontFamily:"var(--fm)",fontSize:12}}>{fmtM(ct.mon)}</span>}</div>)}
      {!cts.length&&<Empty text="Sin contratos"/>}
    </Card>
  </div>;
}

// ── PRODUCCIONES ──────────────────────────────────────────────
function ViewPros({empresa,clientes,producciones,movimientos,navTo,openM,canDo:_cd}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [ft,setFt]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const fd=(producciones||[]).filter(p=>p.empId===empId).filter(p=>{const c=(clientes||[]).find(x=>x.id===p.cliId);return(p.nom.toLowerCase().includes(q.toLowerCase())||(c&&c.nom.toLowerCase().includes(q.toLowerCase())))&&(!fe||p.est===fe)&&(!ft||p.tip===ft);});
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar producción o cliente..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Pre-Producción","En Curso","Post-Producción","Finalizado","Pausado"]} placeholder="Todo estados"/>
      <FilterSel value={ft} onChange={v=>{setFt(v);setPg(1);}} options={["Programa de TV","Podcast","Contenido Audiovisual","Spot Publicitario","Documental","Web Series","Otro"]} placeholder="Todo tipos"/>
      {_cd&&_cd("producciones")&&<Btn onClick={()=>openM("pro",{})}>+ Nueva Producción</Btn>}
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Producción</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Estado</TH><TH>Inicio</TH><TH>Entrega</TH><TH>Ingresos</TH><TH>Balance</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(p=>{const c=(clientes||[]).find(x=>x.id===p.cliId);const b=bal(p.id);return<tr key={p.id} onClick={()=>navTo("pro-det",p.id)}>
            <TD bold>{p.nom}</TD><TD>{c?c.nom:"—"}</TD><TD><Badge label={p.tip} color="gray" sm/></TD><TD><Badge label={p.est}/></TD>
            <TD mono style={{fontSize:11}}>{p.ini?fmtD(p.ini):"—"}</TD>
            <TD mono style={{fontSize:11}}>{p.fin?fmtD(p.fin):"—"}</TD>
            <TD style={{color:"#00e08a",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.i)}</TD>
            <TD style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(b.b)}</TD>
            <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("pro-det",p.id);}}>Ver →</GBtn></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin producciones" sub="Crea la primera con el botón superior"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </div>;
}

function ViewProDet({id,empresa,clientes,producciones,contratos,movimientos,crew,eventos,navTo,openM,canDo:_cd,cSave,cDel,saveMov,delMov,setProducciones,setMovimientos}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const p=(producciones||[]).find(x=>x.id===id);if(!p) return <Empty text="No encontrado"/>;
  const c=(clientes||[]).find(x=>x.id===p.cliId);
  const b=bal(id);const mv=(movimientos||[]).filter(m=>m.eid===id);
  const pCrew=(crew||[]).filter(x=>x.empId===empId&&(p.crewIds||[]).includes(x.id));
  const cContacto=(c?.contactos||[])[0];
  const [tab,setTab]=useState(0);
  const addCrew=async crId=>{
    const next=(producciones||[]).map(x=>x.id===id?{...x,crewIds:[...(x.crewIds||[]),crId]}:x);
    await setProducciones(next);
    const cm=(crew||[]).find(x=>x.id===crId);
    if(cm&&cm.tipo!=="interno"){
      const tvRaw=cm.tarifa||cm.tar||0;
      const tvStr=String(tvRaw).split(".").join("").split(",").join("");
      const tv=parseFloat(tvStr)||0;
      if(tv>0){
        const g={id:uid(),empId,eid:id,et:"pro",tipo:"gasto",cat:"Honorarios",desc:"Honorarios "+cm.nom,monto:tv,fecha:today()};
        const eid2=empresa?.id||empId;
        const mkey=`produ:${eid2}:movimientos`;
        const cur=await dbGet(mkey)||[];
        const nxtMov=[...cur,g];
        await dbSet(mkey,nxtMov);
        setMovimientos(nxtMov);
      }
    }
  };
  const remCrew=async crId=>{const next=(producciones||[]).map(x=>x.id===id?{...x,crewIds:(x.crewIds||[]).filter(i=>i!==crId)}:x);await setProducciones(next);};
  return <div>
    <DetHeader title={p.nom} tag={p.tip} badges={[<Badge key={0} label={p.est}/>]} meta={[c&&`Cliente: ${c.nom}`,p.ini&&`Inicio: ${fmtD(p.ini)}`,p.fin&&`Entrega: ${fmtD(p.fin)}`].filter(Boolean)} des={p.des}
      actions={_cd&&_cd("producciones")&&<><GBtn onClick={()=>openM("pro",p)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(producciones,setProducciones,id,()=>navTo("producciones"),"Producción eliminada");}}>🗑</DBtn></>}/>
    {cContacto&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:8,marginBottom:14,flexWrap:"wrap",gap:8}}>
      <span style={{fontSize:12,color:"var(--gr2)"}}>Contacto: <b style={{color:"var(--wh)"}}>{cContacto.nom}</b> {cContacto.car?`· ${cContacto.car}`:""}</span>
      <ContactBtns tel={cContacto.tel} ema={cContacto.ema} nombre={cContacto.nom} mensaje={`Hola ${cContacto.nom}, te escribimos sobre el proyecto "${p.nom}".`}/>
    </div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Ingresos" value={fmtM(b.i)} sub={`${mv.filter(m=>m.tipo==="ingreso").length} reg.`} accent="#00e08a" vc="#00e08a"/>
      <Stat label="Gastos"   value={fmtM(b.g)} sub={`${mv.filter(m=>m.tipo==="gasto").length} reg.`}  accent="#ff5566" vc="#ff5566"/>
      <Stat label="Balance"  value={fmtM(b.b)} accent={b.b>=0?"#00e08a":"#ff5566"} vc={b.b>=0?"#00e08a":"#ff5566"}/>
      <Stat label="Crew"     value={pCrew.length} sub="asignados" accent="var(--cy)" vc="var(--cy)"/>
    </div>
    <Tabs tabs={["Ingresos","Gastos","Caja","Crew","Fechas","Contratos"]} active={tab} onChange={setTab}/>
    {(tab===0||tab===1)&&<div style={{display:"flex",gap:8,margin:"10px 0"}}>
      <GBtn sm onClick={()=>exportMovCSV(mv.filter(m=>tab===0?m.tipo==="ingreso":m.tipo==="gasto"),p.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={()=>exportMovPDF(mv.filter(m=>tab===0?m.tipo==="ingreso":m.tipo==="gasto"),p.nom,empresa,tab===0?"Ingresos":"Gastos")}>⬇ PDF</GBtn>
    </div>}
    {tab===0&&<MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pro" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===1&&<MovBlock movimientos={mv} tipo="gasto"   eid={id} etype="pro" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===2&&<MovBlock movimientos={mv} tipo="caja"    eid={id} etype="pro" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===3&&<CrewTab crew={crew||[]} empId={empId} asignados={p.crewIds||[]} onAdd={addCrew} onRem={remCrew} canEdit={_cd&&_cd("producciones")} onHonorario={m=>{saveMov({eid:id,et:"pg",tipo:"gasto",cat:"Honorarios",desc:"Honorarios "+m.nom,monto:Number(String(m.tarifa||0).replace(/[^0-9]/g,"")),fecha:today()});}}}
    {tab===4&&<MiniCal refId={id} eventos={eventos||[]} onAdd={()=>openM("evento",{ref:id,refTipo:"produccion"})} onDel={async evId=>{await cSave((eventos||[]).filter(x=>x.id!==evId),()=>{},{}); }} canEdit={_cd&&_cd("calendario")} titulo={p.nom}/>}
    {tab===5&&<Card title="Contratos del cliente" action={_cd&&_cd("contratos")?{label:"+ Nuevo",fn:()=>openM("ct",{cliId:p.cliId})}:null}>
      {(contratos||[]).filter(x=>x.cliId===p.cliId).map(ct=><div key={ct.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:"1px solid var(--bdr)"}}><span style={{fontSize:18}}>📄</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600}}>{ct.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{ct.tip}{ct.vig?" · "+fmtD(ct.vig):""}</div></div><Badge label={ct.est}/>{ct.mon&&<span style={{fontFamily:"var(--fm)",fontSize:12}}>{fmtM(ct.mon)}</span>}</div>)}
      {!(contratos||[]).filter(x=>x.cliId===p.cliId).length&&<Empty text="Sin contratos"/>}
    </Card>}
  </div>;
}

// helper tab crew
function CrewTab({crew,empId,asignados,onAdd,onRem,onHonorario,canEdit}){
  const todos=(crew||[]).filter(x=>x.empId===empId);
  const asig=todos.filter(x=>asignados.includes(x.id));
  const disp=todos.filter(x=>!asignados.includes(x.id)&&x.active!==false);
  return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
    <Card title={`Crew Asignado (${asig.length})`}>
      {asig.length?asig.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(m.nom)}</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{m.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{m.rol}{m.tarifa&&m.tipo!=="interno"?` · ${fmtM(Number(String(m.tarifa).replace(/[^0-9]/g,"")))}`:""}</div></div>
        {canEdit&&onHonorario&&m.tipo!=="interno"&&m.tarifa&&<button onClick={()=>onHonorario(m)} title="Registrar honorario" style={{background:"#4ade8018",border:"1px solid #4ade8040",borderRadius:6,color:"#4ade80",cursor:"pointer",fontSize:11,fontWeight:700,padding:"2px 8px",whiteSpace:"nowrap"}}>💰</button>}
        {canEdit&&<XBtn onClick={()=>onRem(m.id)}/>}
      </div>):<Empty text="Sin crew asignado"/>}
    </Card>
    <Card title={`Disponibles (${disp.length})`}>
      {disp.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:"1px solid var(--bdr)"}}>
        <div style={{width:30,height:30,borderRadius:"50%",background:"var(--bdr)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--gr2)",flexShrink:0}}>{ini(m.nom)}</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{m.nom}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{m.rol}</div></div>
        {canEdit&&<GBtn sm onClick={()=>onAdd(m.id)}>+ Asignar</GBtn>}
      </div>)}
      {!disp.length&&<Empty text="Sin crew disponible"/>}
    </Card>
  </div>;
}

// ── PROGRAMAS TV ──────────────────────────────────────────────
function ViewPgs({empresa,programas,episodios,auspiciadores,movimientos,navTo,openM,canDo:_cd}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [pg,setPg]=useState(1);const PP=9;
  const fd=(programas||[]).filter(x=>x.empId===empId).filter(p=>(p.nom.toLowerCase().includes(q.toLowerCase())||p.tip.toLowerCase().includes(q.toLowerCase()))&&(!fe||p.est===fe));
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar programa..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Activo","En Desarrollo","Pausado","Finalizado"]} placeholder="Todo estados"/>
      {_cd&&_cd("programas")&&<Btn onClick={()=>openM("pg",{})}>+ Nuevo Programa</Btn>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:12}}>
      {fd.slice((pg-1)*PP,pg*PP).map(pg_=>{
        const eps=(episodios||[]).filter(e=>e.pgId===pg_.id);
        const pub=eps.filter(e=>e.estado==="Publicado").length;
        const aus=(auspiciadores||[]).filter(a=>(a.pids||[]).includes(pg_.id)).length;
        const b=bal(pg_.id);
        return <div key={pg_.id} onClick={()=>navTo("pg-det",pg_.id)} style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20,cursor:"pointer",position:"relative",overflow:"hidden",transition:".15s"}} onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"} onMouseLeave={e=>e.currentTarget.style.transform=""}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,var(--cy),var(--cy2))"}}/>
          <div style={{fontSize:10,letterSpacing:1.5,textTransform:"uppercase",color:"var(--cy)",marginBottom:8,fontWeight:600}}>{pg_.tip}</div>
          <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:5,lineHeight:1.2}}>{pg_.nom}</div>
          <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10}}>{pg_.can||"Sin canal"} · {pg_.fre||""}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}><Badge label={pg_.est}/>{pg_.totalEp&&<Badge label={`${pg_.totalEp} ep.`} color="gray"/>}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,paddingTop:12,borderTop:"1px solid var(--bdr)"}}>
            {[["Total",eps.length,"var(--wh)"],["Pub.",pub,"#00e08a"],["Aus.",aus,"var(--cy)"]].map(([l,v,c])=><div key={l} style={{textAlign:"center"}}><div style={{fontFamily:"var(--fm)",fontSize:18,fontWeight:700,color:c}}>{v}</div><div style={{fontSize:9,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1}}>{l}</div></div>)}
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginTop:10}}>
            <span style={{color:"var(--gr2)"}}>Balance</span>
            <span style={{color:b.b>=0?"#00e08a":"#ff5566",fontFamily:"var(--fm)"}}>{fmtM(b.b)}</span>
          </div>
        </div>;
      })}
    </div>
    {!fd.length&&<Empty text="Sin programas" sub="Crea el primero con el botón superior"/>}
    <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
  </div>;
}

function ViewPgDet({id,empresa,clientes,programas,episodios,auspiciadores,movimientos,crew,eventos,navTo,openM,canDo:_cd,cSave,cDel,saveMov,delMov,setProgramas,setEpisodios,setMovimientos}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const pg_=(programas||[]).find(x=>x.id===id);if(!pg_) return <Empty text="No encontrado"/>;
  const eps=(episodios||[]).filter(e=>e.pgId===id).sort((a,b)=>a.num-b.num);
  const aus=(auspiciadores||[]).filter(a=>(a.pids||[]).includes(id));
  const b=bal(id);const mv=(movimientos||[]).filter(m=>m.eid===id);
  const tauz=aus.reduce((s,a)=>s+Number(a.mon||0),0);
  const [tab,setTab]=useState(0);
  const [epQ,setEpQ]=useState("");const [epF,setEpF]=useState("");const [epPg,setEpPg]=useState(1);const EPP=8;
  const epStats={plan:eps.filter(e=>e.estado==="Planificado").length,grab:eps.filter(e=>e.estado==="Grabado").length,edit:eps.filter(e=>e.estado==="En Edición").length,pub:eps.filter(e=>e.estado==="Publicado").length,can:eps.filter(e=>e.estado==="Cancelado").length};
  const fdEps=eps.filter(e=>(!epF||e.estado===epF)&&(e.titulo.toLowerCase().includes(epQ.toLowerCase())||(e.invitado||"").toLowerCase().includes(epQ.toLowerCase())));
  const pCrew=(crew||[]).filter(x=>x.empId===empId&&(pg_.crewIds||[]).includes(x.id));
  const addCrew=async crId=>{
    const next=(programas||[]).map(x=>x.id===id?{...x,crewIds:[...(x.crewIds||[]),crId]}:x);
    await setProgramas(next);
    const cm=(crew||[]).find(x=>x.id===crId);
    if(cm&&cm.tipo!=="interno"){
      const tvRaw2=cm.tarifa||cm.tar||0;
      const tvStr2=String(tvRaw2).split(".").join("").split(",").join("");
      const tv2=parseFloat(tvStr2)||0;
      if(tv2>0){
        const g={id:uid(),empId,eid:id,et:"pg",tipo:"gasto",cat:"Honorarios",desc:"Honorarios "+cm.nom,monto:tv2,fecha:today()};
        const key=`produ:${empId}:movimientos`;
        const cur=await dbGet(key)||[];
        const nxt=[...cur,g];
        await dbSet(key,nxt);
        setMovimientos(nxt);
      }
    }
  };
  const remCrew=async crId=>{const next=(programas||[]).map(x=>x.id===id?{...x,crewIds:(x.crewIds||[]).filter(i=>i!==crId)}:x);await setProgramas(next);};
  const cliAsoc=(clientes||[]).find(x=>x.id===pg_.cliId);
  return <div>
    <DetHeader title={pg_.nom} tag={pg_.tip} badges={[<Badge key={0} label={pg_.est}/>]} meta={[pg_.can,pg_.fre,pg_.temporada&&`Temp: ${pg_.temporada}`,pg_.conductor&&`🎙 ${pg_.conductor}`,cliAsoc&&`Cliente: ${cliAsoc.nom}`].filter(Boolean)} des={pg_.des}
      actions={_cd&&_cd("programas")&&<><GBtn onClick={()=>openM("pg",pg_)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar programa y episodios?"))return;cDel(programas,setProgramas,id,()=>navTo("programas"),"Eliminado");}}>🗑</DBtn></>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Episodios"   value={eps.length}    sub={`${epStats.plan} planificados`}/>
      <Stat label="Publicados"  value={epStats.pub}   accent="#00e08a" vc="#00e08a" sub={`${epStats.grab} grabados`}/>
      <Stat label="Balance"     value={fmtM(b.b)}     accent={b.b>=0?"#00e08a":"#ff5566"} vc={b.b>=0?"#00e08a":"#ff5566"}/>
      <Stat label="Auspicios"   value={fmtM(tauz)}    accent="#ffcc44" vc="#ffcc44" sub={`${aus.length} auspiciadores`}/>
    </div>
    {pg_.conductor&&<div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 14px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:8,marginBottom:14,flexWrap:"wrap",gap:8}}>
      <span style={{fontSize:12,color:"var(--gr2)"}}>Conductor: <b style={{color:"var(--wh)"}}>{pg_.conductor}</b>{pg_.prodEjec?` · Prod: ${pg_.prodEjec}`:""}</span>
      {cliAsoc&&(cliAsoc.contactos||[]).slice(0,1).map(co=><ContactBtns key={co.id} tel={co.tel} ema={co.ema} nombre={co.nom} mensaje={`Hola ${co.nom}, te contactamos sobre el programa "${pg_.nom}".`}/>)}
    </div>}
    <Tabs tabs={["Episodios","Ingresos","Gastos","Auspiciadores","Crew","Fechas","Info"]} active={tab} onChange={setTab}/>
    {(tab===1||tab===2)&&<div style={{display:"flex",gap:8,margin:"10px 0"}}>
      <GBtn sm onClick={()=>exportMovCSV(mv.filter(m=>tab===1?m.tipo==="ingreso":m.tipo==="gasto"),pg_.nom)}>⬇ CSV</GBtn>
      <GBtn sm onClick={()=>exportMovPDF(mv.filter(m=>tab===1?m.tipo==="ingreso":m.tipo==="gasto"),pg_.nom,empresa,tab===1?"Ingresos":"Gastos")}>⬇ PDF</GBtn>
    </div>}

    {tab===0&&<div>
      <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
        <SearchBar value={epQ} onChange={v=>{setEpQ(v);setEpPg(1);}} placeholder="Buscar episodio..."/>
        <FilterSel value={epF} onChange={v=>{setEpF(v);setEpPg(1);}} options={["Planificado","Grabado","En Edición","Publicado","Cancelado"]} placeholder="Todo estados"/>
        {_cd&&_cd("programas")&&<Btn onClick={()=>openM("ep",{pgId:id,num:eps.length?Math.max(...eps.map(e=>e.num))+1:1})}>+ Nuevo Episodio</Btn>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:16}}>
        {[["Planificado",epStats.plan,"#ffcc44"],["Grabado",epStats.grab,"var(--cy)"],["En Edición",epStats.edit,"var(--cy)"],["Publicado",epStats.pub,"#00e08a"],["Cancelado",epStats.can,"#ff5566"]].map(([s,cnt,c])=>(
          <div key={s} onClick={()=>setEpF(epF===s?"":s)} style={{background:"var(--card)",border:`1px solid ${epF===s?c:"var(--bdr)"}`,borderRadius:8,padding:"10px 14px",cursor:"pointer"}}>
            <div style={{fontFamily:"var(--fm)",fontSize:18,fontWeight:700,color:c}}>{cnt}</div>
            <div style={{fontSize:10,color:"var(--gr2)"}}>{s}</div>
          </div>
        ))}
      </div>
      <Card>
        <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH>N°</TH><TH>Título</TH><TH>Invitado</TH><TH>Grabación</TH><TH>Emisión</TH><TH>Estado</TH><TH>Gastos</TH><TH></TH></tr></thead>
          <tbody>
            {fdEps.slice((epPg-1)*EPP,epPg*EPP).map(ep=>{const eg=bal(ep.id);return<tr key={ep.id} onClick={()=>navTo("ep-det",ep.id)}>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontWeight:700,fontSize:13}}>#{String(ep.num).padStart(2,"0")}</TD>
              <TD bold>{ep.titulo}</TD>
              <TD style={{maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:12}}>{ep.invitado||"—"}</TD>
              <TD mono style={{fontSize:11}}>{ep.fechaGrab?fmtD(ep.fechaGrab):"Por confirmar"}</TD>
              <TD mono style={{fontSize:11}}>{ep.fechaEmision?fmtD(ep.fechaEmision):"—"}</TD>
              <TD><Badge label={ep.estado}/></TD>
              <TD style={{color:"#ff5566",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(eg.g)}</TD>
              <TD><GBtn sm onClick={e=>{e.stopPropagation();navTo("ep-det",ep.id);}}>Ver →</GBtn></TD>
            </tr>;})}
            {!fdEps.length&&<tr><td colSpan={8}><Empty text="Sin episodios" sub={_cd&&_cd("programas")?"Crea el primero arriba":""}/></td></tr>}
          </tbody>
        </table></div>
        <Paginator page={epPg} total={fdEps.length} perPage={EPP} onChange={setEpPg}/>
      </Card>
    </div>}
    {tab===1&&<MovBlock movimientos={mv} tipo="ingreso" eid={id} etype="pg" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===2&&<MovBlock movimientos={mv} tipo="gasto"   eid={id} etype="pg" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===3&&<div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:14}}>{_cd&&_cd("auspiciadores")&&<Btn onClick={()=>openM("aus",{pids:[id]})}>+ Auspiciador</Btn>}</div>
      {aus.length?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>{aus.map(a=><AusCard key={a.id} a={a} pgs={[pg_]} onEdit={_cd&&_cd("auspiciadores")?()=>openM("aus",a):null}/>)}</div>:<Empty text="Sin auspiciadores"/>}
    </div>}
    {tab===4&&<CrewTab crew={crew||[]} empId={empId} asignados={pg_.crewIds||[]} onAdd={addCrew} onRem={remCrew} canEdit={_cd&&_cd("programas")} onHonorario={m=>{saveMov({eid:id,et:"pg",tipo:"gasto",cat:"Honorarios",desc:"Honorarios "+m.nom,monto:Number(String(m.tarifa||0).replace(/[^0-9]/g,"")),fecha:today()});}}}
    {tab===5&&<MiniCal refId={id} eventos={eventos||[]} onAdd={()=>openM("evento",{ref:id,refTipo:"programa"})} onDel={async evId=>{await cSave((eventos||[]).filter(x=>x.id!==evId),()=>{},{});}} canEdit={_cd&&_cd("calendario")} titulo={pg_.nom}/>}
    {tab===6&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Datos del Programa">
        {[["Tipo",pg_.tip],["Canal",pg_.can||"—"],["Frecuencia",pg_.fre||"—"],["Temporada",pg_.temporada||"—"],["Total Ep.",pg_.totalEp||"—"],["Estado",<Badge key={0} label={pg_.est}/>],["Cliente",cliAsoc?.nom||"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Equipo">
        {[["Conductor / Host",pg_.conductor||"—"],["Prod. Ejecutivo",pg_.prodEjec||"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {pg_.des&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)"}}>{pg_.des}</div></>}
      </Card>
    </div>}
  </div>;
}

function AusCard({a,pgs,onEdit,onDel}){
  return <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:16}}>
    <div style={{display:"flex",gap:10,alignItems:"flex-start",marginBottom:10}}>
      <div style={{width:38,height:38,borderRadius:8,background:"var(--bdr)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"var(--fh)",fontSize:12,fontWeight:800,flexShrink:0}}>{ini(a.nom)}</div>
      <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700}}>{a.nom}</div><div style={{marginTop:4}}><Badge label={a.tip} sm/></div></div>
      {onEdit&&<GBtn sm onClick={onEdit}>✏</GBtn>}
      {onDel&&<XBtn onClick={onDel}/>}
    </div>
    {(pgs||[]).length>0&&<div style={{marginBottom:8,display:"flex",flexWrap:"wrap",gap:4}}>{pgs.map(p=><Badge key={p.id} label={p.nom} color="cyan" sm/>)}</div>}
    {a.con&&<div style={{fontSize:11,color:"var(--gr3)"}}>{a.con}{a.ema?" · "+a.ema:""}</div>}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:8}}>
      {a.mon&&Number(a.mon)>0?<span style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(a.mon)}</span>:<span/>}
      <div style={{display:"flex",gap:4,flexDirection:"column",alignItems:"flex-end"}}>
        {a.vig&&<span style={{fontSize:10,color:"var(--gr2)"}}>hasta {fmtD(a.vig)}</span>}
        {a.frecPago&&<span style={{fontSize:10,color:"var(--gr2)"}}>{a.frecPago}</span>}
      </div>
    </div>
  </div>;
}

// ── EPISODIO DETALLE ──────────────────────────────────────────
function ViewEpDet({id,empresa,episodios,programas,movimientos,crew,eventos,navTo,openM,canDo:_cd,cSave,cDel,saveMov,delMov,setEpisodios,setMovimientos}){
  const empId=empresa?.id;
  const bal=useBal(movimientos,empId);
  const ep=(episodios||[]).find(x=>x.id===id);if(!ep) return <Empty text="No encontrado"/>;
  const pg_=(programas||[]).find(x=>x.id===ep.pgId);
  const mv=(movimientos||[]).filter(m=>m.eid===id);const b=bal(id);
  const [tab,setTab]=useState(0);
  const NEXT={Planificado:"Grabado",Grabado:"En Edición","En Edición":"Publicado"};
  const STATUS=["Planificado","Grabado","En Edición","Publicado","Cancelado"];
  const changeStatus=async s=>{const next=(episodios||[]).map(x=>x.id===id?{...x,estado:s}:x);await setEpisodios(next);};
  const pCrew=(crew||[]).filter(x=>x.empId===empId&&(ep.crewIds||[]).includes(x.id));
  const addCrew=async crId=>{const next=(episodios||[]).map(x=>x.id===id?{...x,crewIds:[...(x.crewIds||[]),crId]}:x);await setEpisodios(next);};
  const remCrew=async crId=>{const next=(episodios||[]).map(x=>x.id===id?{...x,crewIds:(x.crewIds||[]).filter(i=>i!==crId)}:x);await setEpisodios(next);};
  return <div>
    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
      <div style={{display:"flex",alignItems:"center",gap:16}}>
        <div style={{width:52,height:52,background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <div style={{fontSize:8,color:"var(--cy)",fontWeight:700,letterSpacing:1}}>EP.</div>
          <div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:"var(--cy)",lineHeight:1}}>{String(ep.num).padStart(2,"0")}</div>
        </div>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:22,fontWeight:800}}>{ep.titulo}</div>
          <div style={{fontSize:12,color:"var(--gr2)",marginTop:4,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            {pg_&&<span onClick={()=>navTo("pg-det",pg_.id)} style={{color:"var(--cy)",cursor:"pointer"}}>{pg_.nom}</span>}
            <Badge label={ep.estado}/>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {_cd&&_cd("programas")&&NEXT[ep.estado]&&<Btn onClick={()=>changeStatus(NEXT[ep.estado])}>→ {NEXT[ep.estado]}</Btn>}
        {_cd&&_cd("programas")&&<><GBtn onClick={()=>openM("ep",ep)}>✏ Editar</GBtn><DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(episodios,setEpisodios,id,()=>navTo("pg-det",ep.pgId),"Episodio eliminado");}}>🗑</DBtn></>}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Gastos Ep." value={fmtM(b.g)} sub={`${mv.filter(m=>m.tipo==="gasto").length} ítems`} accent="#ff5566" vc="#ff5566"/>
      <Stat label="Grabación"  value={ep.fechaGrab?fmtD(ep.fechaGrab):"—"}   accent="var(--cy)"/>
      <Stat label="Emisión"    value={ep.fechaEmision?fmtD(ep.fechaEmision):"—"} accent="#00e08a"/>
      <Stat label="Duración"   value={ep.duracion?ep.duracion+" min":"—"}/>
    </div>
    <Tabs tabs={["Información","Gastos","Crew"]} active={tab} onChange={setTab}/>
    {tab===0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <Card title="Datos del Episodio">
        {[["Número","#"+String(ep.num).padStart(2,"0")],["Invitado / Tema",ep.invitado||"—"],["Locación",ep.locacion||"—"],["Descripción",ep.descripcion||"—"],["Notas",ep.notas||"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Estado y Fechas">
        {[["Estado",<Badge key={0} label={ep.estado}/>],["Grabación",ep.fechaGrab?fmtD(ep.fechaGrab):"Por confirmar"],["Emisión",ep.fechaEmision?fmtD(ep.fechaEmision):"—"],["Duración",ep.duracion?ep.duracion+" min":"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {_cd&&_cd("programas")&&<><Sep/><div style={{fontSize:11,color:"var(--gr2)",marginBottom:8}}>Cambiar estado:</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{STATUS.map(s=><button key={s} onClick={()=>changeStatus(s)} style={{padding:"4px 10px",borderRadius:20,border:`1px solid ${ep.estado===s?"var(--cy)":"var(--bdr2)"}`,background:ep.estado===s?"var(--cg)":"transparent",color:ep.estado===s?"var(--cy)":"var(--gr2)",cursor:"pointer",fontSize:10,fontWeight:600}}>{s}</button>)}</div>
        </>}
      </Card>
    </div>}
    {tab===1&&<MovBlock movimientos={mv} tipo="gasto" eid={id} etype="ep" onAdd={(eid,et,tipo)=>openM("mov",{eid,et,tipo})} onDel={delMov} canEdit={_cd&&_cd("movimientos")}/>}
    {tab===2&&<CrewTab crew={crew||[]} empId={empId} asignados={ep.crewIds||[]} onAdd={addCrew} onRem={remCrew} canEdit={_cd&&_cd("programas")}/>}
  </div>;
}

// ── CREW ──────────────────────────────────────────────────────
function ViewCrew({empresa,crew,producciones,programas,navTo,openM,canDo:_cd,cSave,cDel,setCrew}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fa,setFa]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const AREAS=["Producción","Técnica","Postprod.","Dirección","Arte","Sonido","Fotografía","Otro"];
  const fd=(crew||[]).filter(x=>x.empId===empId).filter(c=>(c.nom.toLowerCase().includes(q.toLowerCase())||(c.rol||"").toLowerCase().includes(q.toLowerCase()))&&(!fa||c.area===fa));
  const exportCSV=()=>{
    const header="Nombre,Rol,Área,Email,Teléfono,Disponibilidad,Tarifa,Estado";
    const rows=fd.map(m=>[m.nom,m.rol,m.area,m.ema,m.tel,m.dis,m.tarifa,m.active!==false?"Activo":"Inactivo"].map(v=>`"${v||""}"`).join(","));
    const blob=new Blob([[header,...rows].join("\n")],{type:"text/csv"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="crew_produ.csv";a.click();
  };
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar por nombre o rol..."/>
      <FilterSel value={fa} onChange={v=>{setFa(v);setPg(1);}} options={AREAS} placeholder="Todas las áreas"/>
      {_cd&&_cd("crew")&&<Btn onClick={()=>openM("crew",{})}>+ Agregar Miembro</Btn>}
      <GBtn onClick={exportCSV}>⬇ Exportar CSV</GBtn>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:20}}>
      {AREAS.slice(0,6).map(a=>{const cnt=(crew||[]).filter(x=>x.empId===empId&&x.area===a).length;return<div key={a} onClick={()=>setFa(fa===a?"":a)} style={{background:"var(--card)",border:`1px solid ${fa===a?"var(--cy)":"var(--bdr)"}`,borderRadius:8,padding:"10px 12px",cursor:"pointer",textAlign:"center"}}><div style={{fontFamily:"var(--fm)",fontSize:18,fontWeight:700,color:fa===a?"var(--cy)":"var(--wh)"}}>{cnt}</div><div style={{fontSize:9,color:"var(--gr2)",marginTop:2}}>{a}</div></div>;})}
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Nombre</TH><TH>Rol</TH><TH>Área</TH><TH>Email</TH><TH>Teléfono</TH><TH>Disponibilidad</TH><TH>Tarifa</TH><TH>Estado</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(m=><tr key={m.id}>
            <TD bold><div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:30,height:30,borderRadius:"50%",background:"linear-gradient(135deg,var(--cy),var(--cy2))",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(m.nom)}</div>{m.nom}
            </div></TD>
            <TD>{m.rol||"—"}</TD><TD><Badge label={m.area||"—"} color="gray" sm/> <Badge label={m.tipo==="interno"?"Planta":"Externo"} color={m.tipo==="interno"?"green":"yellow"} sm/></TD>
            <TD style={{fontSize:11}}>{m.ema||"—"}</TD><TD style={{fontSize:11}}>{m.tel||"—"}</TD>
            <TD style={{fontSize:11,color:"var(--gr2)"}}>{m.dis||"—"}</TD>
            <TD mono style={{fontSize:11}}>{m.tarifa||"—"}</TD>
            <TD><Badge label={m.active!==false?"Activo":"Inactivo"} color={m.active!==false?"green":"red"} sm/></TD>
            <TD><div style={{display:"flex",gap:4}}>
              {_cd&&_cd("crew")&&<><GBtn sm onClick={()=>openM("crew",m)}>✏</GBtn><XBtn onClick={()=>cDel(crew,setCrew,m.id,null,"Miembro eliminado")}/></>}
            </div></TD>
          </tr>)}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin miembros" sub={_cd&&_cd("crew")?"Agrega el primero arriba":""}/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </div>;
}

// ── AUSPICIADORES ─────────────────────────────────────────────
function ViewAus({empresa,auspiciadores,programas,openM,canDo:_cd,cSave,cDel,setAuspiciadores}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [ft,setFt]=useState("");const [fp,setFp]=useState("");const [pg,setPg]=useState(1);const PP=9;
  const fd=(auspiciadores||[]).filter(x=>x.empId===empId).filter(a=>(a.nom.toLowerCase().includes(q.toLowerCase())||(a.con||"").toLowerCase().includes(q.toLowerCase()))&&(!ft||a.tip===ft)&&(!fp||(a.pids||[]).includes(fp)));
  const pgOpts=(programas||[]).filter(x=>x.empId===empId).map(p=>({value:p.id,label:p.nom}));
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar auspiciador..."/>
      <FilterSel value={ft} onChange={v=>{setFt(v);setPg(1);}} options={["Auspiciador Principal","Auspiciador Secundario","Colaborador","Canje","Media Partner"]} placeholder="Todo tipos"/>
      <FilterSel value={fp} onChange={v=>{setFp(v);setPg(1);}} options={pgOpts} placeholder="Todos programas"/>
      {_cd&&_cd("auspiciadores")&&<Btn onClick={()=>openM("aus",{})}>+ Nuevo Auspiciador</Btn>}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,marginBottom:12}}>
      {fd.slice((pg-1)*PP,pg*PP).map(a=>{
        const pgs=(a.pids||[]).map(pid=>(programas||[]).find(x=>x.id===pid)).filter(Boolean);
        return <AusCard key={a.id} a={a} pgs={pgs} onEdit={_cd&&_cd("auspiciadores")?()=>openM("aus",a):null} onDel={_cd&&_cd("auspiciadores")?()=>cDel(auspiciadores,setAuspiciadores,a.id,null,"Auspiciador eliminado"):null}/>;
      })}
    </div>
    {!fd.length&&<Empty text="Sin auspiciadores"/>}
    <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
  </div>;
}

// ── CONTRATOS ─────────────────────────────────────────────────
function ViewCts({empresa,contratos,clientes,openM,canDo:_cd,cSave,cDel,setContratos}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const fd=(contratos||[]).filter(x=>x.empId===empId).filter(c=>c.nom.toLowerCase().includes(q.toLowerCase())&&(!fe||c.est===fe));
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar contrato..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Borrador","En Revisión","Firmado","Vigente","Vencido"]} placeholder="Todo estados"/>
      {_cd&&_cd("contratos")&&<Btn onClick={()=>openM("ct",{})}>+ Nuevo Contrato</Btn>}
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Contrato</TH><TH>Cliente</TH><TH>Tipo</TH><TH>Estado</TH><TH>Monto</TH><TH>Vigencia</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(ct=>{const c=(clientes||[]).find(x=>x.id===ct.cliId);return<tr key={ct.id}>
            <TD bold>{ct.nom}</TD><TD>{c?c.nom:"—"}</TD><TD><Badge label={ct.tip} color="gray" sm/></TD><TD><Badge label={ct.est}/></TD>
            <TD mono style={{fontSize:12}}>{ct.mon?fmtM(ct.mon):"—"}</TD>
            <TD mono style={{fontSize:11}}>{ct.vig?fmtD(ct.vig):"—"}</TD>
            <TD><div style={{display:"flex",gap:4}}>{_cd&&_cd("contratos")&&<><GBtn sm onClick={()=>openM("ct",ct)}>✏</GBtn><XBtn onClick={()=>cDel(contratos,setContratos,ct.id,null,"Contrato eliminado")}/></>}</div></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={7}><Empty text="Sin contratos"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </div>;
}

// ── CALENDARIO ────────────────────────────────────────────────
function ViewCalendario({empresa,episodios,programas,producciones,eventos,openM,canDo:_cd,cSave,cDel,setEventos}){
  const empId=empresa?.id;
  const [mes,setMes]=useState(()=>{const h=new Date();return{y:h.getFullYear(),m:h.getMonth()};});
  const [filtro,setFiltro]=useState("todos");
  const [diaSelec,setDiaSelec]=useState(null);
  const [vistaLista,setVistaLista]=useState(false);
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const DIAS=["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const addMes=delta=>setMes(prev=>{let m=prev.m+delta,y=prev.y;if(m>11){m=0;y++;}if(m<0){m=11;y--;}return{y,m};});
  const TIPOS=[{v:"grabacion",ico:"🎬",lbl:"Grabación",c:"var(--cy)"},{v:"emision",ico:"📡",lbl:"Emisión",c:"#00e08a"},{v:"reunion",ico:"💬",lbl:"Reunión",c:"#ffcc44"},{v:"entrega",ico:"✓",lbl:"Entrega",c:"#ff8844"},{v:"estreno",ico:"🌟",lbl:"Estreno",c:"#ff5566"},{v:"otro",ico:"📌",lbl:"Otro",c:"#7c7c8a"}];
  const tc=v=>TIPOS.find(t=>t.v===v)?.c||"#7c7c8a";
  const ti=v=>TIPOS.find(t=>t.v===v)?.ico||"📌";
  // Build events
  const todosEvs=[];
  (eventos||[]).filter(e=>e.empId===empId).forEach(ev=>{
    if(!ev.fecha) return;
    const d=new Date(ev.fecha+"T12:00:00");
    if(d.getFullYear()===mes.y&&d.getMonth()===mes.m){
      const ref=ev.refTipo==="produccion"?(producciones||[]).find(x=>x.id===ev.ref):(programas||[]).find(x=>x.id===ev.ref);
      todosEvs.push({id:ev.id,dia:d.getDate(),tipo:ev.tipo,label:`${ti(ev.tipo)} ${ev.titulo}`,sub:ref?ref.nom:"Sin vinculación",color:tc(ev.tipo),hora:ev.hora||"",custom:true,desc:ev.desc||""});
    }
  });
  (episodios||[]).filter(e=>e.empId===empId).forEach(ep=>{
    const pg=(programas||[]).find(x=>x.id===ep.pgId);
    if(ep.fechaGrab){const d=new Date(ep.fechaGrab+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:ep.id+"_g",dia:d.getDate(),tipo:"grabacion",label:`🎬 Ep.${ep.num}: ${ep.titulo}`,sub:pg?.nom||"",color:"var(--cy)",hora:"",auto:true});}
    if(ep.fechaEmision){const d=new Date(ep.fechaEmision+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:ep.id+"_e",dia:d.getDate(),tipo:"emision",label:`📡 Ep.${ep.num}: ${ep.titulo}`,sub:pg?.nom||"",color:"#00e08a",hora:"",auto:true});}
  });
  (producciones||[]).filter(p=>p.empId===empId).forEach(p=>{
    if(p.ini){const d=new Date(p.ini+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:p.id+"_ini",dia:d.getDate(),tipo:"otro",label:`▶ Inicio: ${p.nom}`,sub:"Producción",color:"#a855f7",hora:"",auto:true});}
    if(p.fin){const d=new Date(p.fin+"T12:00:00");if(d.getFullYear()===mes.y&&d.getMonth()===mes.m)todosEvs.push({id:p.id+"_fin",dia:d.getDate(),tipo:"entrega",label:`✓ Entrega: ${p.nom}`,sub:"Producción",color:"#ff8844",hora:"",auto:true});}
  });
  const evFiltrados=filtro==="todos"?todosEvs:todosEvs.filter(e=>e.tipo===filtro);
  const primerDia=new Date(mes.y,mes.m,1).getDay();
  const diasMes=new Date(mes.y,mes.m+1,0).getDate();
  const hoy=new Date();
  const esHoy=d=>hoy.getFullYear()===mes.y&&hoy.getMonth()===mes.m&&hoy.getDate()===d;
  const celdas=[];for(let i=0;i<primerDia;i++)celdas.push(null);for(let d=1;d<=diasMes;d++)celdas.push(d);
  const evsDelDia=d=>evFiltrados.filter(e=>e.dia===d).sort((a,b)=>(a.hora||"").localeCompare(b.hora||""));
  const evsDiaSel=diaSelec?evFiltrados.filter(e=>e.dia===diaSelec):[];
  const proximos=[...evFiltrados].sort((a,b)=>a.dia-b.dia);
  const delEvento=async evId=>{ await cDel(eventos,setEventos,evId,null,"Evento eliminado"); };
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:10}}>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button onClick={()=>addMes(-1)} style={{width:36,height:36,borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:18}}>‹</button>
        <div style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,minWidth:190,textAlign:"center"}}>{MESES[mes.m]} {mes.y}</div>
        <button onClick={()=>addMes(1)}  style={{width:36,height:36,borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:18}}>›</button>
        <button onClick={()=>setMes({y:hoy.getFullYear(),m:hoy.getMonth()})} style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:11,fontWeight:600}}>Hoy</button>
        <button onClick={()=>setVistaLista(!vistaLista)} style={{padding:"6px 12px",borderRadius:6,border:"1px solid var(--bdr2)",background:vistaLista?"var(--cg)":"transparent",color:vistaLista?"var(--cy)":"var(--gr3)",cursor:"pointer",fontSize:11,fontWeight:600}}>{vistaLista?"📅 Grilla":"☰ Lista"}</button>
      </div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
        {_cd&&_cd("calendario")&&<Btn onClick={()=>openM("evento",{})} sm>+ Nuevo Evento</Btn>}
        {["todos",...TIPOS.map(t=>t.v)].map(v=><button key={v} onClick={()=>setFiltro(v)} style={{padding:"5px 10px",borderRadius:20,border:`1px solid ${filtro===v?tc(v):"var(--bdr2)"}`,background:filtro===v?tc(v)+"22":"transparent",color:filtro===v?tc(v):"var(--gr3)",cursor:"pointer",fontSize:10,fontWeight:600}}>{v==="todos"?"Todos":ti(v)+" "+TIPOS.find(t=>t.v===v)?.lbl}</button>)}
      </div>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
      {[["Total",evFiltrados.length,"var(--cy)"],["Grabaciones",evFiltrados.filter(e=>e.tipo==="grabacion").length,"var(--cy)"],["Emisiones",evFiltrados.filter(e=>e.tipo==="emision").length,"#00e08a"],["Reuniones+",evFiltrados.filter(e=>!["grabacion","emision"].includes(e.tipo)).length,"#ffcc44"]].map(([l,v,c])=><Stat key={l} label={l} value={v} accent={c} vc={c} sub={MESES[mes.m]}/>)}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,alignItems:"start"}}>
      {!vistaLista?<div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:"1px solid var(--bdr)"}}>{DIAS.map(d=><div key={d} style={{padding:"10px 0",textAlign:"center",fontSize:11,fontWeight:600,color:"var(--gr2)",letterSpacing:1}}>{d}</div>)}</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {celdas.map((d,i)=>{const evs=d?evsDelDia(d):[];const isTod=d&&esHoy(d);const isSel=d&&diaSelec===d;return(
            <div key={i} onClick={()=>d&&setDiaSelec(diaSelec===d?null:d)} style={{minHeight:90,padding:"5px 3px",borderRight:i%7!==6?"1px solid var(--bdr)":"none",borderBottom:"1px solid var(--bdr)",background:isSel?"var(--am)":isTod?"var(--cg)":"transparent",cursor:d?"pointer":"default",transition:".1s"}}>
              {d&&<><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3,padding:"0 2px"}}>
                <span style={{fontSize:12,fontWeight:isTod||isSel?700:400,color:isTod||isSel?"var(--cy)":"var(--gr3)"}}>{d}</span>
                {_cd&&_cd("calendario")&&<span onClick={e=>{e.stopPropagation();openM("evento",{fecha:`${mes.y}-${String(mes.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`});}} style={{fontSize:10,color:"var(--gr)",cursor:"pointer",opacity:.6}}>+</span>}
              </div>
              {evs.slice(0,3).map(ev=><div key={ev.id} style={{fontSize:9,padding:"2px 4px",borderRadius:3,marginBottom:2,background:ev.color+"25",color:ev.color,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={ev.label+" · "+ev.sub+(ev.hora?" · "+ev.hora:"")}>{ev.hora?<span style={{opacity:.7}}>{ev.hora} </span>:""}{ev.label}</div>)}
              {evs.length>3&&<div style={{fontSize:9,color:"var(--gr2)",padding:"0 2px"}}>+{evs.length-3} más</div>}</>}
            </div>
          );})}
        </div>
      </div>:
      <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:20}}>
        <div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700,marginBottom:16}}>Todos los eventos — {MESES[mes.m]} {mes.y}</div>
        {proximos.length>0?proximos.map(ev=><div key={ev.id} style={{display:"flex",gap:12,padding:"10px 0",borderBottom:"1px solid var(--bdr)",alignItems:"flex-start"}}>
          <div style={{width:44,height:44,borderRadius:8,background:ev.color+"22",border:`1px solid ${ev.color}40`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:14}}>{ti(ev.tipo)}</span>
            <span style={{fontSize:9,fontFamily:"var(--fm)",fontWeight:700,color:ev.color}}>{String(ev.dia).padStart(2,"0")}</span>
          </div>
          <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,fontWeight:600}}>{ev.label}</div><div style={{fontSize:11,color:"var(--gr2)",marginTop:2}}>{ev.sub}{ev.hora?" · "+ev.hora:""}</div>{ev.desc&&<div style={{fontSize:11,color:"var(--gr3)",marginTop:3}}>{ev.desc}</div>}</div>
          {ev.custom&&_cd&&_cd("calendario")&&<XBtn onClick={()=>delEvento(ev.id)}/>}
        </div>):<Empty text="Sin eventos este mes"/>}
      </div>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {diaSelec&&<div style={{background:"var(--card)",border:"1px solid var(--cy)",borderRadius:10,padding:16}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700}}>{diaSelec} de {MESES[mes.m]}</div>
            {_cd&&_cd("calendario")&&<GBtn sm onClick={()=>openM("evento",{fecha:`${mes.y}-${String(mes.m+1).padStart(2,"0")}-${String(diaSelec).padStart(2,"0")}`})}>+ Agregar</GBtn>}
          </div>
          {evsDiaSel.length>0?evsDiaSel.map(ev=><div key={ev.id} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:"1px solid var(--bdr)",alignItems:"flex-start"}}>
            <span style={{fontSize:16,flexShrink:0}}>{ti(ev.tipo)}</span>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:ev.color}}>{ev.label.replace(/^[^\s]+\s/,"")}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{ev.sub}{ev.hora?" · "+ev.hora:""}</div>{ev.desc&&<div style={{fontSize:11,color:"var(--gr3)",marginTop:2}}>{ev.desc}</div>}</div>
            {ev.custom&&_cd&&_cd("calendario")&&<XBtn onClick={()=>delEvento(ev.id)}/>}
          </div>):<Empty text="Sin eventos este día" sub="Clic en '+' para agregar"/>}
        </div>}
        <Card title="Próximos" sub={`${MESES[mes.m]} ${mes.y}`}>
          {proximos.slice(0,8).map(ev=><div key={ev.id} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:"1px solid var(--bdr)",alignItems:"center"}}>
            <div style={{width:26,height:26,borderRadius:6,background:ev.color+"22",border:`1px solid ${ev.color}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontFamily:"var(--fm)",fontSize:10,fontWeight:700,color:ev.color}}>{String(ev.dia).padStart(2,"0")}</span></div>
            <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.label}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{ev.sub}</div></div>
          </div>)}
          {!proximos.length&&<Empty text="Sin eventos"/>}
        </Card>
        <div style={{background:"var(--card)",border:"1px solid var(--bdr)",borderRadius:10,padding:16}}>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:10}}>Leyenda</div>
          {TIPOS.map(t=><div key={t.v} style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}><div style={{width:10,height:10,borderRadius:3,background:t.c,flexShrink:0}}/><span style={{fontSize:11,color:"var(--gr3)"}}>{t.ico} {t.lbl}</span></div>)}
        </div>
      </div>
    </div>
  </div>;
}

// ── PRESUPUESTOS ─────────────────────────────────────────────

function MPres({open,data,clientes,producciones,programas,onClose,onSave,empresa}){
  const empty={titulo:"",cliId:"",tipo:"produccion",refId:"",estado:"Borrador",validez:"30",moneda:"CLP",iva:true,metodoPago:"",fechaPago:"",notasPago:"",obs:"",items:[]};
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data,items:data.items||[]}:{...empty});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const addItem=()=>setF(p=>({...p,items:[...(p.items||[]),{id:uid(),desc:"",qty:1,precio:0,und:"Unidad"}]}));
  const updItem=(i,k,v)=>setF(p=>({...p,items:(p.items||[]).map((it,j)=>j===i?{...it,[k]:v}:it)}));
  const delItem=i=>setF(p=>({...p,items:(p.items||[]).filter((_,j)=>j!==i)}));
  const subtotal=(f.items||[]).reduce((s,it)=>s+Number(it.qty||0)*Number(it.precio||0),0);
  const ivaVal=f.iva?Math.round(subtotal*0.19):f.honorarios?Math.round(subtotal*0.1525):0;
  const total=subtotal+ivaVal;
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Presupuesto":"Nuevo Presupuesto"} sub="Cotización comercial" extraWide>
    <R2>
      <FG label="Título / Descripción *"><FI value={f.titulo||""} onChange={e=>u("titulo",e.target.value)} placeholder="Producción Programa Q2 2025"/></FG>
      <FG label="N° Correlativo"><FI value={f.correlativo||""} onChange={e=>u("correlativo",e.target.value)} placeholder="PRES-2025-001"/></FG>
    </R2>
    <FG label="Cliente *"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Seleccionar cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG>
    <R2>
      <FG label="Tipo"><FSl value={f.tipo||"produccion"} onChange={e=>u("tipo",e.target.value)}><option value="produccion">Producción</option><option value="programa">Programa TV</option><option value="servicio">Servicio</option></FSl></FG>
      <FG label="Estado"><FSl value={f.estado||"Borrador"} onChange={e=>u("estado",e.target.value)}><option>Borrador</option><option>Enviado</option><option>En Revisión</option><option>Aceptado</option><option>Rechazado</option></FSl></FG>
    </R2>
    <R3>
      <FG label="Validez (días)"><FI type="number" value={f.validez||"30"} onChange={e=>u("validez",e.target.value)} placeholder="30"/></FG>
      <FG label="Moneda"><FSl value={f.moneda||"CLP"} onChange={e=>u("moneda",e.target.value)}><option>CLP</option><option>USD</option><option>EUR</option></FSl></FG>
      <FG label="Impuesto"><FSl value={f.honorarios?"hon":f.iva?"iva":"none"} onChange={e=>{const v=e.target.value;u("iva",v==="iva");u("honorarios",v==="hon");}}><option value="none">Sin impuesto</option><option value="iva">IVA 19%</option><option value="hon">Boleta Honorarios 15,25%</option></FSl></FG>
    </R3>
    <Sep/>
    {/* Items */}
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
      <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700}}>Ítems / Detalle Comercial</div>
      <GBtn sm onClick={addItem}>+ Agregar Ítem</GBtn>
    </div>
    {(f.items||[]).length>0&&<div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,overflow:"hidden",marginBottom:12}}>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr style={{background:"var(--bdr)"}}><th style={{padding:"8px 12px",textAlign:"left",fontSize:10,color:"var(--gr2)",fontWeight:600}}>Descripción</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:80}}>Qty</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Precio Unit.</th><th style={{padding:"8px 12px",textAlign:"right",fontSize:10,color:"var(--gr2)",fontWeight:600,width:120}}>Total</th><th style={{width:40}}></th></tr></thead>
        <tbody>{(f.items||[]).map((it,i)=><tr key={it.id} style={{borderTop:"1px solid var(--bdr)"}}>
          <td style={{padding:"6px 12px"}}><input value={it.desc||""} onChange={e=>updItem(i,"desc",e.target.value)} placeholder="Descripción del ítem" style={{...FS,padding:"6px 8px",fontSize:12}}/></td>
          <td style={{padding:"6px 8px"}}><input type="number" value={it.qty||""} onChange={e=>updItem(i,"qty",e.target.value)} min="1" style={{...FS,padding:"6px 8px",fontSize:12,textAlign:"right"}}/></td>
          <td style={{padding:"6px 8px"}}><input type="number" value={it.precio||""} onChange={e=>updItem(i,"precio",e.target.value)} min="0" style={{...FS,padding:"6px 8px",fontSize:12,textAlign:"right"}}/></td>
          <td style={{padding:"6px 12px",textAlign:"right",fontFamily:"var(--fm)",fontSize:12,color:"var(--wh)",whiteSpace:"nowrap"}}>{fmtM(Number(it.qty||0)*Number(it.precio||0))}</td>
          <td style={{padding:"6px 8px",textAlign:"center"}}><XBtn onClick={()=>delItem(i)}/></td>
        </tr>)}</tbody>
      </table>
    </div>}
    {!(f.items||[]).length&&<div style={{textAlign:"center",padding:14,color:"var(--gr2)",fontSize:12,border:"1px dashed var(--bdr2)",borderRadius:8,marginBottom:12}}>Sin ítems. Haz clic en "+ Agregar Ítem"</div>}
    {/* Totales */}
    <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:8,padding:"12px 16px",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"var(--gr2)"}}>Subtotal Neto</span><span style={{fontFamily:"var(--fm)",fontSize:13}}>{fmtM(subtotal)}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}><span style={{fontSize:12,color:"var(--gr2)"}}>IVA 19%</span><span style={{fontFamily:"var(--fm)",fontSize:13}}>{f.iva?fmtM(ivaVal):"—"}</span></div>
      <div style={{display:"flex",justifyContent:"space-between",paddingTop:8,borderTop:"1px solid var(--bdr)"}}><span style={{fontSize:13,fontWeight:700}}>Total Final</span><span style={{fontFamily:"var(--fm)",fontSize:15,fontWeight:700,color:"var(--cy)"}}>{fmtM(total)}</span></div>
    </div>
    <R2>
      <FG label="Método de Pago"><FI value={f.metodoPago||""} onChange={e=>u("metodoPago",e.target.value)} placeholder="Transferencia, cuotas..."/></FG>
      <FG label="Fecha de Pago"><FI type="date" value={f.fechaPago||""} onChange={e=>u("fechaPago",e.target.value)}/></FG>
    </R2>
    <FG label="Datos de Pago"><FTA value={f.notasPago||""} onChange={e=>u("notasPago",e.target.value)} placeholder="Banco, número de cuenta, RUT..."/></FG>
    <FG label="Observaciones"><FTA value={f.obs||""} onChange={e=>u("obs",e.target.value)} placeholder="Condiciones, notas adicionales..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.titulo?.trim()||!f.cliId)return;onSave({...f,subtotal,ivaVal,total});}}/>
  </Modal>;
}

// ── PDF GENERATOR — PRESUPUESTO ──────────────────────────────
function generarPDF(pres, cliente, empresa) {
  const contacto = (cliente?.contactos||[])[0];
  const subtotal  = Number(pres.subtotal||0);
  const ivaVal    = Number(pres.ivaVal||0);
  const total     = Number(pres.total||0);
  const ac        = empresa?.color || "#00d4e8";
  const acLight   = ac + "18";
  const correlativo = pres.correlativo || ("PRES-" + String(Date.now()).slice(-6));
  const estadoBadgeColor = {Borrador:"#f0f0f0,#888",Enviado:"#e0f0ff,#0066cc","En Revisión":"#fff3cd,#856404",Aceptado:"#d4edda,#155724",Rechazado:"#f8d7da,#721c24"}[pres.estado||"Borrador"]||"#f0f0f0,#888";
  const [badgeBg,badgeFg] = estadoBadgeColor.split(",");

  const logoHtml = empresa?.logo
    ? `<img src="${empresa.logo}" style="max-height:140px;max-width:300px;object-fit:contain;display:block;margin-bottom:10px;" alt="${empresa?.nombre||""}">`
    : `<div style="font-size:28px;font-weight:900;color:${ac};letter-spacing:-1px;margin-bottom:4px;">${empresa?.nombre||""}</div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Presupuesto ${correlativo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1e1e2e;background:#fff;padding:48px;line-height:1.5}
  /* HEADER */
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
  .header-left{}
  .empresa-name{font-size:13px;color:#555;margin-top:6px}
  .empresa-sub{font-size:11px;color:#888;margin-top:2px}
  .header-right{text-align:right}
  .doc-type{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ac};margin-bottom:6px}
  .doc-num{font-size:22px;font-weight:800;color:#1e1e2e;margin-bottom:12px}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:${badgeBg};color:${badgeFg};margin-bottom:12px}
  .meta{font-size:11px;color:#666;line-height:1.8}
  .meta strong{color:#1e1e2e;font-weight:600}
  /* DIVIDER */
  .divider{height:3px;background:linear-gradient(90deg,${ac},${ac}44);border-radius:2px;margin-bottom:32px}
  /* TÍTULO */
  .doc-title{font-size:18px;font-weight:700;color:#1e1e2e;margin-bottom:28px;padding-bottom:12px;border-bottom:1px solid #eee}
  /* GRID DATOS */
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px}
  .box{background:#f8f9fc;border-radius:10px;padding:18px;border-left:3px solid ${ac}}
  .box-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ac};margin-bottom:12px}
  .box-name{font-size:15px;font-weight:700;color:#1e1e2e;margin-bottom:8px}
  .box-line{font-size:12px;color:#555;margin-bottom:3px}
  /* TABLA */
  .table-wrap{margin-bottom:0}
  table{width:100%;border-collapse:collapse}
  thead tr{background:${ac}}
  thead th{padding:11px 14px;text-align:left;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#fff}
  thead th.r{text-align:right}
  tbody tr:nth-child(even){background:#f8f9fc}
  tbody tr{border-bottom:1px solid #eee}
  tbody td{padding:11px 14px;font-size:12px;color:#1e1e2e}
  tbody td.r{text-align:right;font-family:'Courier New',monospace;font-size:12px}
  /* TOTALES */
  .totals-wrap{display:flex;justify-content:flex-end;margin-top:0;margin-bottom:32px;border-top:1px solid #eee;padding-top:16px}
  .totals{width:280px}
  .tot-row{display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#555;border-bottom:1px solid #f0f0f0}
  .tot-row.final{background:${ac};border-radius:8px;padding:10px 14px;margin-top:8px;color:#fff;font-weight:700;font-size:15px;border:none}
  .tot-row.final span:last-child{font-family:'Courier New',monospace}
  /* SECCIONES */
  .section{margin-bottom:24px}
  .section-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ac};margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid ${acLight}}
  .section-content{font-size:12px;color:#444;line-height:1.8;white-space:pre-line}
  /* FIRMA */
  .firma-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px;margin-bottom:32px}
  .firma-box{border-top:2px solid #ddd;padding-top:10px;text-align:center}
  .firma-label{font-size:11px;color:#888;margin-top:4px}
  .firma-name{font-size:12px;font-weight:600;color:#1e1e2e;margin-top:2px}
  /* OBS */
  .obs-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-bottom:24px}
  .obs-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:8px}
  .obs-text{font-size:12px;color:#78350f}
  /* FOOTER */
  .footer{text-align:center;font-size:10px;color:#bbb;padding-top:20px;border-top:1px solid #eee;margin-top:16px}
  @media print{body{padding:24px}@page{margin:0}}
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="header-left">
    ${logoHtml}
    ${empresa?.logo ? `<div class="empresa-name">${empresa?.nombre||""}</div>` : ""}
    <div class="empresa-sub">${empresa?.rut||""}</div>
    <div class="empresa-sub">${empresa?.dir||""}</div>
    <div class="empresa-sub">${empresa?.ema||""} ${empresa?.tel ? "· " + empresa.tel : ""}</div>
  </div>
  <div class="header-right">
    <div class="doc-type">Presupuesto / Cotización</div>
    <div class="doc-num">${correlativo}</div>
    <div class="badge">${pres.estado||"Borrador"}</div>
    <div class="meta">
      <strong>Fecha emisión</strong><br>${fmtD(today())}<br>
      <strong>Válido por</strong><br>${pres.validez||30} días<br>
      ${pres.moneda ? `<strong>Moneda</strong><br>${pres.moneda}` : ""}
    </div>
  </div>
</div>

<div class="divider"></div>

<div class="doc-title">${pres.titulo||"Presupuesto"}</div>

<!-- DATOS EMISOR / CLIENTE -->
<div class="grid2">
  <div class="box">
    <div class="box-title">Datos del Emisor</div>
    <div class="box-name">${empresa?.nombre||""}</div>
    ${empresa?.rut ? `<div class="box-line">RUT: ${empresa.rut}</div>` : ""}
    ${empresa?.dir ? `<div class="box-line">${empresa.dir}</div>` : ""}
    ${empresa?.ema ? `<div class="box-line">${empresa.ema}</div>` : ""}
    ${empresa?.tel ? `<div class="box-line">${empresa.tel}</div>` : ""}
  </div>
  <div class="box">
    <div class="box-title">Datos del Cliente</div>
    <div class="box-name">${cliente?.nom||"—"}</div>
    ${cliente?.rut ? `<div class="box-line">RUT: ${cliente.rut}</div>` : ""}
    ${cliente?.dir ? `<div class="box-line">${cliente.dir}</div>` : ""}
    ${contacto ? `<div class="box-line">Contacto: ${contacto.nom}${contacto.car ? " · " + contacto.car : ""}</div>
    <div class="box-line">${contacto.ema||""} ${contacto.tel ? "· " + contacto.tel : ""}</div>` : ""}
  </div>
</div>

<!-- TABLA DE ÍTEMS -->
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th>Descripción</th>
        <th class="r" style="width:70px">Cant.</th>
        <th class="r" style="width:130px">Precio Unit.</th>
        <th class="r" style="width:140px">Total</th>
      </tr>
    </thead>
    <tbody>
      ${(pres.items||[]).length > 0
        ? (pres.items||[]).map(it => `<tr>
            <td>${it.desc||"—"}</td>
            <td class="r">${it.qty||0}</td>
            <td class="r">${fmtM(it.precio||0)}</td>
            <td class="r">${fmtM(Number(it.qty||0)*Number(it.precio||0))}</td>
          </tr>`).join("")
        : `<tr><td colspan="4" style="text-align:center;color:#aaa;padding:20px">Sin ítems</td></tr>`}
    </tbody>
  </table>
</div>

<!-- TOTALES -->
<div class="totals-wrap">
  <div class="totals">
    <div class="tot-row"><span>Subtotal Neto</span><span style="font-family:monospace">${fmtM(subtotal)}</span></div>
    <div class="tot-row"><span>${pres.honorarios?"Boleta Honorarios 15,25%":"IVA 19%"}</span><span style="font-family:monospace">${(pres.iva||pres.honorarios) ? fmtM(ivaVal) : "No aplica"}</span></div>
    <div class="tot-row final"><span>Total Final</span><span>${fmtM(total)}</span></div>
  </div>
</div>

<!-- PAGO -->
${pres.metodoPago || pres.notasPago ? '<div class="section"><div class="section-title">Información de Pago</div><div class="section-content">' + [pres.metodoPago ? "Método de pago: " + pres.metodoPago : "", pres.fechaPago ? "Fecha de pago: " + fmtD(pres.fechaPago) : "", pres.notasPago || ""].filter(Boolean).join(" · ") + '</div></div>' : ""}

<!-- OBSERVACIONES -->
${pres.obs ? `
<div class="obs-box">
  <div class="obs-title">Observaciones</div>
  <div class="obs-text">${pres.obs}</div>
</div>` : ""}

<!-- FIRMA -->
<div class="firma-grid">
  <div class="firma-box">
    <div style="height:50px"></div>
    <div class="firma-label">Firma y Timbre</div>
    <div class="firma-name">${empresa?.nombre||""}</div>
  </div>
  <div class="firma-box">
    <div style="height:50px"></div>
    <div class="firma-label">Firma de Aceptación</div>
    <div class="firma-name">${cliente?.nom||"Cliente"}</div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  ${empresa?.nombre||""} · ${empresa?.rut||""} · ${empresa?.ema||""} &nbsp;|&nbsp; Generado con Produ
</div>

</body>
</html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 800);
}

// ── PDF GENERATOR — FACTURA ───────────────────────────────────
function generarPDFFactura(fact, entidad, ref, empresa) {
  const ac       = empresa?.color || "#00d4e8";
  const acLight  = ac + "18";
  const correlativo = fact.correlativo || ("OC-" + String(Date.now()).slice(-6));
  const estadoBadgeColor = {Pendiente:"#fff3cd,#856404",Emitida:"#cce5ff,#004085",Pagada:"#d4edda,#155724",Vencida:"#f8d7da,#721c24",Anulada:"#e2e3e5,#383d41"}[fact.estado||"Pendiente"]||"#fff3cd,#856404";
  const [badgeBg,badgeFg] = estadoBadgeColor.split(",");
  const mn    = Number(fact.montoNeto||0);
  const ivaV  = fact.iva ? Math.round(mn*0.19) : 0;
  const total = mn + ivaV;

  const logoHtml = empresa?.logo
    ? `<img src="${empresa.logo}" style="max-height:140px;max-width:300px;object-fit:contain;display:block;margin-bottom:10px;" alt="${empresa?.nombre||""}">`
    : `<div style="font-size:28px;font-weight:900;color:${ac};letter-spacing:-1px;margin-bottom:4px;">${empresa?.nombre||""}</div>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Orden de Factura ${correlativo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Inter',Arial,sans-serif;font-size:13px;color:#1e1e2e;background:#fff;padding:48px;line-height:1.5}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
  .doc-type{font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ac};margin-bottom:6px}
  .doc-num{font-size:22px;font-weight:800;color:#1e1e2e;margin-bottom:12px}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;background:${badgeBg};color:${badgeFg};margin-bottom:12px}
  .meta{font-size:11px;color:#666;line-height:1.8}
  .meta strong{color:#1e1e2e;font-weight:600}
  .empresa-sub{font-size:11px;color:#888;margin-top:2px}
  .divider{height:3px;background:linear-gradient(90deg,${ac},${ac}44);border-radius:2px;margin-bottom:32px}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
  .box{background:#f8f9fc;border-radius:10px;padding:18px;border-left:3px solid ${ac}}
  .box-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ac};margin-bottom:12px}
  .box-name{font-size:15px;font-weight:700;color:#1e1e2e;margin-bottom:8px}
  .box-line{font-size:12px;color:#555;margin-bottom:3px}
  /* TABLA MONTO */
  .amount-section{background:#f8f9fc;border-radius:10px;padding:24px;margin-bottom:28px}
  .amount-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ac};margin-bottom:16px}
  .amount-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:13px;color:#555}
  .amount-row.total-row{background:${ac};border-radius:8px;padding:12px 16px;margin-top:12px;color:#fff;font-weight:700;font-size:16px;border:none}
  .amount-row.total-row span:last-child{font-family:'Courier New',monospace}
  /* REF */
  .ref-box{background:${acLight};border:1px solid ${ac}44;border-radius:10px;padding:16px;margin-bottom:28px;display:flex;align-items:center;gap:16px}
  .ref-icon{font-size:28px;flex-shrink:0}
  .ref-label{font-size:10px;color:${ac};font-weight:700;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px}
  .ref-name{font-size:14px;font-weight:700;color:#1e1e2e}
  .ref-type{font-size:11px;color:#666;margin-top:2px}
  /* PAGO */
  .pago-box{background:#f8f9fc;border-radius:10px;padding:20px;margin-bottom:28px}
  .pago-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${ac};margin-bottom:14px}
  .pago-content{font-size:12px;color:#444;line-height:1.9;white-space:pre-line}
  /* FIRMA */
  .firma-grid{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px;margin-bottom:28px}
  .firma-box{border-top:2px solid #ddd;padding-top:10px;text-align:center}
  .firma-label{font-size:11px;color:#888;margin-top:4px}
  .firma-name{font-size:12px;font-weight:600;color:#1e1e2e;margin-top:2px}
  /* OBS */
  .obs-box{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;margin-bottom:24px}
  .obs-title{font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#92400e;margin-bottom:8px}
  .obs-text{font-size:12px;color:#78350f}
  /* FOOTER */
  .footer{text-align:center;font-size:10px;color:#bbb;padding-top:20px;border-top:1px solid #eee;margin-top:16px}
  @media print{body{padding:24px}@page{margin:0}}
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div>
    ${logoHtml}
    ${empresa?.logo ? `<div style="font-size:13px;color:#555;margin-top:6px">${empresa?.nombre||""}</div>` : ""}
    <div class="empresa-sub">${empresa?.rut||""}</div>
    <div class="empresa-sub">${empresa?.dir||""}</div>
    <div class="empresa-sub">${empresa?.ema||""} ${empresa?.tel ? "· " + empresa.tel : ""}</div>
  </div>
  <div style="text-align:right">
    <div class="doc-type">Orden de Factura</div>
    <div class="doc-num">${correlativo}</div>
    <div class="badge">${fact.estado||"Pendiente"}</div>
    <div class="meta">
      <strong>Fecha emisión</strong><br>${fact.fechaEmision ? fmtD(fact.fechaEmision) : fmtD(today())}<br>
      ${fact.fechaVencimiento ? `<strong>Fecha vencimiento</strong><br>${fmtD(fact.fechaVencimiento)}<br>` : ""}
      <strong>Tipo</strong><br>${fact.tipo === "auspiciador" ? "Auspiciador" : "Cliente"}
    </div>
  </div>
</div>

<div class="divider"></div>

<!-- DATOS -->
<div class="grid2">
  <div class="box">
    <div class="box-title">Datos del Emisor</div>
    <div class="box-name">${empresa?.nombre||""}</div>
    ${empresa?.rut ? `<div class="box-line">RUT: ${empresa.rut}</div>` : ""}
    ${empresa?.dir ? `<div class="box-line">${empresa.dir}</div>` : ""}
    ${empresa?.ema ? `<div class="box-line">${empresa.ema}</div>` : ""}
    ${empresa?.tel ? `<div class="box-line">${empresa.tel}</div>` : ""}
  </div>
  <div class="box">
    <div class="box-title">${fact.tipo === "auspiciador" ? "Auspiciador" : "Cliente"}</div>
    <div class="box-name">${entidad?.nom||"—"}</div>
    ${entidad?.rut ? `<div class="box-line">RUT: ${entidad.rut}</div>` : ""}
    ${entidad?.con ? `<div class="box-line">Contacto: ${entidad.con}</div>` : ""}
    ${entidad?.ema ? `<div class="box-line">${entidad.ema}</div>` : ""}
    ${entidad?.tel ? `<div class="box-line">${entidad.tel}</div>` : ""}
  </div>
</div>

<!-- REFERENCIA -->
${ref ? `<div class="ref-box">
  <div class="ref-icon">${fact.tipoRef === "produccion" ? "📽" : "📺"}</div>
  <div>
    <div class="ref-label">${fact.tipoRef === "produccion" ? "Producción" : "Programa TV"} asociado</div>
    <div class="ref-name">${ref.nom||""}</div>
    ${ref.est ? `<div class="ref-type">Estado: ${ref.est}</div>` : ""}
  </div>
</div>` : ""}

<!-- MONTO -->
<div class="amount-section">
  <div class="amount-title">Detalle del Cobro</div>
  <div class="amount-row"><span>Monto Neto</span><span style="font-family:monospace">${fmtM(mn)}</span></div>
  <div class="amount-row"><span>IVA 19%</span><span style="font-family:monospace">${fact.iva ? fmtM(ivaV) : "No aplica"}</span></div>
  <div class="amount-row total-row"><span>Total a Pagar</span><span>${fmtM(total)}</span></div>
</div>

<!-- DATOS DE PAGO -->
${fact.obs ? `<div class="pago-box">
  <div class="pago-title">Datos de Pago / Instrucciones</div>
  <div class="pago-content">${fact.obs}</div>
</div>` : ""}

<!-- OBSERVACIONES -->
${fact.obs2 ? `<div class="obs-box">
  <div class="obs-title">Observaciones</div>
  <div class="obs-text">${fact.obs2}</div>
</div>` : ""}

<!-- FIRMA -->
<div class="firma-grid">
  <div class="firma-box">
    <div style="height:50px"></div>
    <div class="firma-label">Emitido por</div>
    <div class="firma-name">${empresa?.nombre||""}</div>
  </div>
  <div class="firma-box">
    <div style="height:50px"></div>
    <div class="firma-label">Recibido / Conforme</div>
    <div class="firma-name">${entidad?.nom||""}</div>
  </div>
</div>

<!-- FOOTER -->
<div class="footer">
  ${empresa?.nombre||""} · ${empresa?.rut||""} · ${empresa?.ema||""} &nbsp;|&nbsp; Generado con Produ
</div>

</body>
</html>`;

  const w = window.open("", "_blank");
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 800);
}

// ── VIEW PRESUPUESTOS ─────────────────────────────────────────
function ViewPres({empresa,presupuestos,clientes,producciones,programas,navTo,openM,canDo:_cd,cSave,cDel,setPresupuestos}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const fd=(presupuestos||[]).filter(x=>x.empId===empId).filter(p=>(p.titulo||"").toLowerCase().includes(q.toLowerCase())&&(!fe||p.estado===fe));
  const total=fd.reduce((s,p)=>s+Number(p.total||0),0);
  const aceptados=fd.filter(p=>p.estado==="Aceptado").reduce((s,p)=>s+Number(p.total||0),0);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Total"     value={fd.length}                                          accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Aceptados" value={fd.filter(p=>p.estado==="Aceptado").length}          accent="#00e08a"   vc="#00e08a"/>
      <Stat label="Monto Total"   value={fmtM(total)}    sub="todos"     accent="var(--cy)"/>
      <Stat label="Monto Aceptado" value={fmtM(aceptados)} sub="aceptados" accent="#00e08a" vc="#00e08a"/>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar presupuesto..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Borrador","Enviado","En Revisión","Aceptado","Rechazado"]} placeholder="Todo estados"/>
      {_cd&&_cd("presupuestos")&&<Btn onClick={()=>openM("pres",{})}>+ Nuevo Presupuesto</Btn>}
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Título</TH><TH>Cliente</TH><TH>Estado</TH><TH>Ítems</TH><TH>Subtotal</TH><TH>Total</TH><TH>Creado</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(p=>{const c=(clientes||[]).find(x=>x.id===p.cliId);return<tr key={p.id} onClick={()=>navTo("pres-det",p.id)}>
            <TD bold>{p.titulo}</TD>
            <TD>{c?c.nom:"—"}</TD>
            <TD><Badge label={p.estado||"Borrador"}/></TD>
            <TD mono style={{fontSize:11}}>{(p.items||[]).length}</TD>
            <TD mono style={{fontSize:12}}>{fmtM(p.subtotal||0)}</TD>
            <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(p.total||0)}</TD>
            <TD mono style={{fontSize:11}}>{p.cr?fmtD(p.cr):"—"}</TD>
            <TD><div style={{display:"flex",gap:4}}>
              <GBtn sm onClick={e=>{e.stopPropagation();navTo("pres-det",p.id);}}>Ver</GBtn>
              <GBtn sm onClick={e=>{e.stopPropagation();const c=(clientes||[]).find(x=>x.id===p.cliId);generarPDF(p,c,empresa);}} title="Descargar PDF">⬇</GBtn>
              <GBtn sm onClick={e=>{e.stopPropagation();const c=(clientes||[]).find(x=>x.id===p.cliId);const co=(c?.contactos||[])[0];if(!co?.tel){alert("Sin teléfono de contacto.");return;}generarPDF(p,c,empresa);setTimeout(()=>{const num=((co.tel||"").replace(/[^0-9]/g,""));const waNum=num.startsWith("56")?num:"56"+num;window.open("https://wa.me/"+waNum+"?text="+encodeURIComponent("Hola "+co.nom+", te adjunto el presupuesto por la producción "+p.titulo+". El PDF se abrió en tu pantalla para que lo descargues y adjuntes aquí."),"_blank");},1200);}} title="PDF + WhatsApp">💬</GBtn>
              {_cd&&_cd("presupuestos")&&<XBtn onClick={e=>{e.stopPropagation();cDel(presupuestos,setPresupuestos,p.id,null,"Presupuesto eliminado");}}/>}
            </div></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={8}><Empty text="Sin presupuestos" sub={_cd&&_cd("presupuestos")?"Crea el primero con el botón superior":""}/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </div>;
}

function ViewPresDet({id,empresa,presupuestos,clientes,producciones,programas,navTo,openM,canDo:_cd,cSave,cDel,setPresupuestos,setProducciones,setProgramas}){
  const empId=empresa?.id;
  const p=(presupuestos||[]).find(x=>x.id===id);if(!p) return <Empty text="No encontrado"/>;
  const c=(clientes||[]).find(x=>x.id===p.cliId);
  const [convOpen,setConvOpen]=useState(false);
  const [convTipo,setConvTipo]=useState("produccion");
  const [convNom,setConvNom]=useState(p.titulo||"");
  const convertir=async()=>{
    if(!convNom.trim()) return;
    const newId=uid();
    if(convTipo==="produccion"){
      const nuevo={id:newId,empId,nom:convNom,cliId:p.cliId,tip:"Contenido Audiovisual",est:"Pre-Producción",ini:today(),fin:"",des:p.titulo,crewIds:[]};
      await setProducciones([...(producciones||[]),nuevo]);
    } else {
      const nuevo={id:newId,empId,nom:convNom,tip:"Programa de TV",can:"",est:"En Desarrollo",totalEp:"",fre:"Semanal",temporada:"",conductor:"",prodEjec:"",des:p.titulo,cliId:p.cliId||"",crewIds:[]};
      await setProgramas([...(programas||[]),nuevo]);
    }
    // Crear ingreso automático con el total del presupuesto
    if(p.total){
      const ingresoAuto={id:uid(),empId,eid:newId,et:convTipo==="produccion"?"pro":"pg",tipo:"ingreso",cat:"Producción",desc:"Ingreso desde presupuesto: "+p.titulo,monto:p.total,fecha:today()};
      await setMovimientos(prev=>[...(prev||[]),ingresoAuto]);
    }
    // Mark presupuesto as converted
    await cSave(presupuestos,setPresupuestos,{...p,convertido:convTipo,convertidoNom:convNom});
    setConvOpen(false);
    navTo(convTipo==="produccion"?"producciones":"programas");
  };
  return <div>
    <DetHeader title={p.titulo} tag="Presupuesto" badges={[<Badge key={0} label={p.estado||"Borrador"}/>]} meta={[c&&`Cliente: ${c.nom}`,p.cr&&`Creado: ${fmtD(p.cr)}`,`Válido: ${p.validez||30} días`].filter(Boolean)}
      actions={<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={()=>generarPDF(p,c,empresa)}>⬇ Descargar PDF</Btn>
        <GBtn onClick={()=>{
          const co=(c?.contactos||[])[0];
          if(!co?.tel){alert("El cliente no tiene teléfono de contacto registrado.");return;}
          // Step 1: Generate and download PDF
          generarPDF(p,c,empresa);
          // Step 2: Open WhatsApp after short delay (PDF needs to open first)
          setTimeout(()=>{
            const num=((co.tel||"").replace(/[^0-9]/g,""));
            const waNum=num.startsWith("56")?num:"56"+num;
            const msg=encodeURIComponent("Hola "+co.nom+", te adjunto el presupuesto por la producción "+p.titulo+". El PDF se abrió en tu pantalla para que lo descargues y adjuntes aquí.");
            window.open("https://wa.me/"+waNum+"?text="+msg,"_blank");
          },1200);
        }}>💬 PDF + WhatsApp</GBtn>
        {_cd&&_cd("presupuestos")&&<GBtn onClick={()=>openM("pres",p)}>✏ Editar</GBtn>}
        {p.estado==="Aceptado"&&!p.convertido&&<Btn onClick={()=>setConvOpen(true)} s={{background:"#00e08a",color:"var(--bg)"}}>→ Convertir en Proyecto</Btn>}
        {_cd&&_cd("presupuestos")&&<DBtn onClick={()=>{if(!confirm("¿Eliminar?"))return;cDel(presupuestos,setPresupuestos,id,()=>navTo("presupuestos"),"Eliminado");}}>🗑</DBtn>}
      </div>}/>
    {p.convertido&&<div style={{background:"#00e08a18",border:"1px solid #00e08a35",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#00e08a"}}>✓ Convertido en {p.convertido==="produccion"?"producción":"programa TV"}: <b>{p.convertidoNom}</b></div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Subtotal Neto" value={fmtM(p.subtotal||0)}/>
      <Stat label={p.honorarios?"Boleta Hon. 15,25%":"IVA 19%"} value={p.iva||p.honorarios?fmtM(p.ivaVal||0):"No aplica"}/>
      <Stat label="Total Final"   value={fmtM(p.total||0)} accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Ítems"         value={(p.items||[]).length}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
      <Card title="Datos del Presupuesto">
        {[["Cliente",c?.nom||"—"],["Tipo",p.tipo||"—"],["Estado",<Badge key={0} label={p.estado||"Borrador"}/>],["Moneda",p.moneda||"CLP"],["IVA",p.iva?"19% incluido":"No aplica"],["Validez",`${p.validez||30} días`]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </Card>
      <Card title="Información de Pago">
        {[["Método",p.metodoPago||"—"],["Fecha pago",p.fechaPago?fmtD(p.fechaPago):"—"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
        {p.notasPago&&<><Sep/><div style={{fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line"}}>{p.notasPago}</div></>}
      </Card>
    </div>
    {/* Items table */}
    <Card title="Detalle de Ítems" style={{marginBottom:16}}>
      {(p.items||[]).length>0?<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Descripción</TH><TH>Cantidad</TH><TH>Precio Unit.</TH><TH>Total</TH></tr></thead>
        <tbody>{(p.items||[]).map(it=><tr key={it.id}><TD bold>{it.desc||"—"}</TD><TD mono>{it.qty||0}</TD><TD mono style={{fontSize:12}}>{fmtM(it.precio||0)}</TD><TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12}}>{fmtM(Number(it.qty||0)*Number(it.precio||0))}</TD></tr>)}</tbody>
      </table></div>:<Empty text="Sin ítems"/>}
      <div style={{marginTop:16,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:12,color:"var(--gr2)"}}><span>Subtotal Neto</span><span style={{fontFamily:"var(--fm)"}}>{fmtM(p.subtotal||0)}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:12,color:"var(--gr2)"}}><span>IVA 19%</span><span style={{fontFamily:"var(--fm)"}}>{p.iva||p.honorarios?fmtM(p.ivaVal||0):"—"}</span></div>
        <div style={{display:"flex",justifyContent:"space-between",width:260,fontSize:15,fontWeight:700,paddingTop:8,borderTop:"1px solid var(--bdr)"}}><span>Total Final</span><span style={{fontFamily:"var(--fm)",color:"var(--cy)"}}>{fmtM(p.total||0)}</span></div>
      </div>
    </Card>
    {p.obs&&<Card title="Observaciones"><p style={{fontSize:12,color:"var(--gr3)"}}>{p.obs}</p></Card>}
    {/* Modal convertir */}
    <Modal open={convOpen} onClose={()=>setConvOpen(false)} title="Convertir en Proyecto" sub="El presupuesto fue aceptado. Crea el proyecto correspondiente.">
      <FG label="Tipo de proyecto"><FSl value={convTipo} onChange={e=>setConvTipo(e.target.value)}><option value="produccion">📽 Nueva Producción</option><option value="programa">📺 Nuevo Programa TV</option></FSl></FG>
      <FG label="Nombre del proyecto"><FI value={convNom} onChange={e=>setConvNom(e.target.value)} placeholder="Nombre del proyecto"/></FG>
      <div style={{background:"#00e08a18",border:"1px solid #00e08a35",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#00e08a",marginBottom:16}}>Se creará {convTipo==="produccion"?"una producción":"un programa TV"} con los datos del cliente. Podrás editarlo desde el módulo correspondiente.</div>
      <MFoot onClose={()=>setConvOpen(false)} onSave={convertir} label="Crear Proyecto"/>
    </Modal>
  </div>;
}

// ── FACTURACIÓN ───────────────────────────────────────────────
function MFact({open,data,clientes,auspiciadores,producciones,programas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{correlativo:"",tipo:"cliente",entidadId:"",proId:"",tipoRef:"",montoNeto:0,iva:true,estado:"Pendiente",fechaEmision:today(),fechaVencimiento:"",obs:""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const mn=Number(f.montoNeto||0);const ivaV=f.iva?Math.round(mn*0.19):0;const total=mn+ivaV;
  // Solo auspiciadores principales y secundarios para programas
  const ausValidos=(auspiciadores||[]).filter(a=>["Auspiciador Principal","Auspiciador Secundario"].includes(a.tip));
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Orden de Factura":"Nueva Orden de Factura"} sub="Registro de cobro">
    <R3>
      <FG label="Correlativo Interno"><FI value={f.correlativo||""} onChange={e=>u("correlativo",e.target.value)} placeholder="OC-2025-001"/></FG>
      <FG label="Estado"><FSl value={f.estado||"Pendiente"} onChange={e=>u("estado",e.target.value)}><option>Pendiente</option><option>Emitida</option><option>Pagada</option><option>Vencida</option><option>Anulada</option></FSl></FG>
      <FG label="Tipo Entidad"><FSl value={f.tipo||"cliente"} onChange={e=>u("tipo",e.target.value)}><option value="cliente">Cliente</option><option value="auspiciador">Auspiciador</option></FSl></FG>
    </R3>
    <FG label={f.tipo==="auspiciador"?"Auspiciador (Principal o Secundario) *":"Cliente *"}>
      <FSl value={f.entidadId||""} onChange={e=>u("entidadId",e.target.value)}>
        <option value="">— Seleccionar —</option>
        {f.tipo==="auspiciador"
          ?ausValidos.map(a=><option key={a.id} value={a.id}>{a.nom} · {a.tip}</option>)
          :(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}
      </FSl>
    </FG>
    <R2>
      <FG label="Tipo Referencia"><FSl value={f.tipoRef||""} onChange={e=>u("tipoRef",e.target.value)}><option value="">Sin referencia</option><option value="produccion">Producción</option><option value="programa">Programa TV</option></FSl></FG>
      <FG label="Producción / Programa">
        <FSl value={f.proId||""} onChange={e=>u("proId",e.target.value)}>
          <option value="">— Seleccionar —</option>
          <optgroup label="Producciones">{(producciones||[]).map(p=><option key={p.id} value={p.id}>📽 {p.nom}</option>)}</optgroup>
          <optgroup label="Programas">{(programas||[]).map(p=><option key={p.id} value={p.id}>📺 {p.nom}</option>)}</optgroup>
        </FSl>
      </FG>
    </R2>
    <R3>
      <FG label="Monto Neto *"><FI type="number" value={f.montoNeto||""} onChange={e=>u("montoNeto",e.target.value)} placeholder="0" min="0"/></FG>
      <FG label="IVA 19%"><FSl value={f.iva?"true":"false"} onChange={e=>u("iva",e.target.value==="true")}><option value="true">Incluir IVA</option><option value="false">Sin IVA</option></FSl></FG>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:6,padding:"9px 12px"}}>
        <div style={{fontSize:10,color:"var(--gr2)",marginBottom:4,fontWeight:600}}>TOTAL</div>
        <div style={{fontFamily:"var(--fm)",fontSize:16,fontWeight:700,color:"var(--cy)"}}>{fmtM(total)}</div>
      </div>
    </R3>
    <R2>
      <FG label="Fecha Emisión"><FI type="date" value={f.fechaEmision||""} onChange={e=>u("fechaEmision",e.target.value)}/></FG>
      <FG label="Fecha Vencimiento"><FI type="date" value={f.fechaVencimiento||""} onChange={e=>u("fechaVencimiento",e.target.value)}/></FG>
    </R2>
    <FG label="Datos de Pago / Instrucciones"><FTA value={f.obs||""} onChange={e=>u("obs",e.target.value)} placeholder="Banco: BancoEstado&#10;Cuenta Corriente: 123456789&#10;RUT: 78.118.348-2&#10;Email: pagos@empresa.cl"/></FG>
    <FG label="Observaciones adicionales"><FTA value={f.obs2||""} onChange={e=>u("obs2",e.target.value)} placeholder="Notas internas, condiciones..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.entidadId||!f.montoNeto)return;onSave({...f,ivaVal:ivaV,total});}}/>
  </Modal>;
}

function ViewFact({empresa,facturas,clientes,auspiciadores,producciones,programas,openM,canDo:_cd,cSave,cDel,setFacturas}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fe,setFe]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const fd=(facturas||[]).filter(x=>x.empId===empId).filter(f=>{
    const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
    return((ent?.nom||"").toLowerCase().includes(q.toLowerCase())||(f.correlativo||"").toLowerCase().includes(q.toLowerCase()))&&(!fe||f.estado===fe);
  });
  const pendiente=fd.filter(f=>f.estado==="Pendiente").reduce((s,f)=>s+Number(f.total||0),0);
  const pagado=fd.filter(f=>f.estado==="Pagada").reduce((s,f)=>s+Number(f.total||0),0);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Total Facturas" value={fd.length}            accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Pendiente"      value={fmtM(pendiente)}      accent="#ffcc44"   vc="#ffcc44"/>
      <Stat label="Cobrado"        value={fmtM(pagado)}         accent="#00e08a"   vc="#00e08a"/>
      <Stat label="Vencidas"       value={fd.filter(f=>f.estado==="Vencida").length} accent="#ff5566" vc="#ff5566"/>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar factura o entidad..."/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={["Pendiente","Emitida","Pagada","Vencida","Anulada"]} placeholder="Todo estados"/>
      {_cd&&_cd("facturacion")&&<Btn onClick={()=>openM("fact",{})}>+ Nueva Orden</Btn>}
    </div>
    {/* Nota importante */}
    <div style={{background:"var(--cg)",border:"1px solid var(--cm)",borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"var(--cy)"}}>
      ℹ En Programas TV, la facturación solo incluye <b>Auspiciadores Principales y Secundarios</b>. No incluye canjes, colaboradores ni partners.
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Correlativo</TH><TH>Entidad</TH><TH>Referencia</TH><TH>Estado</TH><TH>Neto</TH><TH>Total</TH><TH>Emisión</TH><TH>Vencimiento</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(f=>{
            const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
            const ref=f.tipoRef==="produccion"?(producciones||[]).find(x=>x.id===f.proId):(programas||[]).find(x=>x.id===f.proId);
            return<tr key={f.id}>
              <TD bold>{f.correlativo||"—"}</TD>
              <TD><div>{ent?.nom||"—"}</div><div style={{fontSize:10,color:"var(--gr2)"}}>{f.tipo==="auspiciador"?"Auspiciador":"Cliente"}</div></TD>
              <TD style={{fontSize:11}}>{ref?`${f.tipoRef==="produccion"?"📽":"📺"} ${ref.nom}`:"—"}</TD>
              <TD><Badge label={f.estado||"Pendiente"}/></TD>
              <TD mono style={{fontSize:12}}>{fmtM(f.montoNeto||0)}</TD>
              <TD style={{color:"var(--cy)",fontFamily:"var(--fm)",fontSize:12,fontWeight:600}}>{fmtM(f.total||0)}</TD>
              <TD mono style={{fontSize:11}}>{f.fechaEmision?fmtD(f.fechaEmision):"—"}</TD>
              <TD mono style={{fontSize:11,color:f.estado==="Vencida"?"#ff5566":"inherit"}}>{f.fechaVencimiento?fmtD(f.fechaVencimiento):"—"}</TD>
              <TD><div style={{display:"flex",gap:4}}>
                {_cd&&_cd("facturacion")&&<><GBtn sm onClick={()=>openM("fact",f)}>✏</GBtn><XBtn onClick={()=>cDel(facturas,setFacturas,f.id,null,"Eliminada")}/></>}
                <GBtn sm onClick={()=>{
                  const ent=f.tipo==="auspiciador"?(auspiciadores||[]).find(x=>x.id===f.entidadId):(clientes||[]).find(x=>x.id===f.entidadId);
                  const ref=f.tipoRef==="produccion"?(producciones||[]).find(x=>x.id===f.proId):(programas||[]).find(x=>x.id===f.proId);
                  generarPDFFactura(f,ent,ref,empresa);
                }}>⬇ PDF</GBtn>
              </div></TD>
            </tr>;
          })}
          {!fd.length&&<tr><td colSpan={9}><Empty text="Sin órdenes de factura"/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
  </div>;
}

// ── ACTIVOS ───────────────────────────────────────────────────
function MActivo({open,data,producciones,listas,onClose,onSave}){
  const [f,setF]=useState({});
  useEffect(()=>{setF(data?.id?{...data}:{nom:"",categoria:"",marca:"",modelo:"",serial:"",valorCompra:"",fechaCompra:"",estado:"Disponible",asignadoA:"",obs:""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const CATS=listas?.catActivos||DEFAULT_LISTAS.catActivos;
  const ESTADOS=["Disponible","En Uso","En Mantención","Dañado","Dado de Baja"];
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Activo":"Nuevo Activo"} sub="Equipamiento o bien de la productora">
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Canon EOS R5"/></FG><FG label="Categoría"><FSl value={f.categoria||""} onChange={e=>u("categoria",e.target.value)}><option value="">Seleccionar...</option>{CATS.map(c=><option key={c}>{c}</option>)}</FSl></FG></R2>
    <R3><FG label="Marca"><FI value={f.marca||""} onChange={e=>u("marca",e.target.value)} placeholder="Canon, Sony..."/></FG><FG label="Modelo"><FI value={f.modelo||""} onChange={e=>u("modelo",e.target.value)} placeholder="EOS R5"/></FG><FG label="N° Serie"><FI value={f.serial||""} onChange={e=>u("serial",e.target.value)} placeholder="SN-00001"/></FG></R3>
    <R3><FG label="Valor Compra"><FI type="number" value={f.valorCompra||""} onChange={e=>u("valorCompra",e.target.value)} placeholder="0"/></FG><FG label="Fecha Compra"><FI type="date" value={f.fechaCompra||""} onChange={e=>u("fechaCompra",e.target.value)}/></FG><FG label="Estado"><FSl value={f.estado||"Disponible"} onChange={e=>u("estado",e.target.value)}>{ESTADOS.map(s=><option key={s}>{s}</option>)}</FSl></FG></R3>
    <FG label="Asignado a Producción"><FSl value={f.asignadoA||""} onChange={e=>u("asignadoA",e.target.value)}><option value="">— Sin asignar —</option>{(producciones||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG>
    <FG label="Observaciones"><FTA value={f.obs||""} onChange={e=>u("obs",e.target.value)} placeholder="Condición, accesorios incluidos..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

function ViewActivos({empresa,activos,producciones,listas,openM,canDo:_cd,cSave,cDel,setActivos}){
  const empId=empresa?.id;
  const [q,setQ]=useState("");const [fc,setFc]=useState("");const [fe,setFe]=useState("");const [pg,setPg]=useState(1);const PP=10;
  const CATS=listas?.catActivos||DEFAULT_LISTAS.catActivos;
  const ESTADOS=["Disponible","En Uso","En Mantención","Dañado","Dado de Baja"];
  const fd=(activos||[]).filter(x=>x.empId===empId).filter(a=>(a.nom.toLowerCase().includes(q.toLowerCase())||(a.marca||"").toLowerCase().includes(q.toLowerCase()))&&(!fc||a.categoria===fc)&&(!fe||a.estado===fe));
  const totalValor=fd.reduce((s,a)=>s+Number(a.valorCompra||0),0);
  const dispCount=fd.filter(a=>a.estado==="Disponible").length;
  const enUsoCount=fd.filter(a=>a.estado==="En Uso").length;
  const statColor=s=>({Disponible:"#00e08a","En Uso":"var(--cy)","En Mantención":"#ffcc44",Dañado:"#ff8844","Dado de Baja":"#ff5566"}[s]||"var(--gr2)");
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
      <Stat label="Total Activos"  value={fd.length}          accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Disponibles"    value={dispCount}           accent="#00e08a"   vc="#00e08a"/>
      <Stat label="En Uso"         value={enUsoCount}          accent="var(--cy)" vc="var(--cy)"/>
      <Stat label="Valor Total"    value={fmtM(totalValor)}    accent="#ffcc44"   vc="#ffcc44"/>
    </div>
    <div style={{display:"flex",gap:10,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={q} onChange={v=>{setQ(v);setPg(1);}} placeholder="Buscar activo o marca..."/>
      <FilterSel value={fc} onChange={v=>{setFc(v);setPg(1);}} options={CATS} placeholder="Todas categorías"/>
      <FilterSel value={fe} onChange={v=>{setFe(v);setPg(1);}} options={ESTADOS} placeholder="Todo estados"/>
      {_cd&&_cd("activos")&&<Btn onClick={()=>openM("activo",{})}>+ Nuevo Activo</Btn>}
    </div>
    {/* Chips por estado */}
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      {ESTADOS.map(s=>{const cnt=(activos||[]).filter(a=>a.empId===empId&&a.estado===s).length;return<div key={s} onClick={()=>setFe(fe===s?"":s)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:20,border:`1px solid ${fe===s?statColor(s):"var(--bdr2)"}`,background:fe===s?statColor(s)+"22":"transparent",cursor:"pointer",fontSize:11,fontWeight:600,color:fe===s?statColor(s):"var(--gr3)"}}><span style={{width:8,height:8,borderRadius:"50%",background:statColor(s),flexShrink:0}}/>{s} ({cnt})</div>;})}
    </div>
    <Card>
      <div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead><tr><TH>Nombre</TH><TH>Categoría</TH><TH>Marca/Modelo</TH><TH>N° Serie</TH><TH>Estado</TH><TH>Asignado a</TH><TH>Valor</TH><TH></TH></tr></thead>
        <tbody>
          {fd.slice((pg-1)*PP,pg*PP).map(a=>{const pro=(producciones||[]).find(x=>x.id===a.asignadoA);return<tr key={a.id}>
            <TD bold>{a.nom}</TD>
            <TD><Badge label={a.categoria||"—"} color="gray" sm/></TD>
            <TD style={{fontSize:12}}>{[a.marca,a.modelo].filter(Boolean).join(" · ")||"—"}</TD>
            <TD mono style={{fontSize:11}}>{a.serial||"—"}</TD>
            <TD><span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 9px",borderRadius:20,fontSize:10,fontWeight:700,background:statColor(a.estado)+"22",color:statColor(a.estado),border:`1px solid ${statColor(a.estado)}40`}}>{a.estado||"—"}</span></TD>
            <TD style={{fontSize:12}}>{pro?pro.nom:<span style={{color:"var(--gr)"}}>Sin asignar</span>}</TD>
            <TD mono style={{fontSize:12}}>{a.valorCompra?fmtM(a.valorCompra):"—"}</TD>
            <TD><div style={{display:"flex",gap:4}}>
              {_cd&&_cd("activos")&&<><GBtn sm onClick={()=>openM("activo",a)}>✏</GBtn><XBtn onClick={()=>cDel(activos,setActivos,a.id,null,"Activo eliminado")}/></>}
            </div></TD>
          </tr>;})}
          {!fd.length&&<tr><td colSpan={8}><Empty text="Sin activos registrados" sub={_cd&&_cd("activos")?"Registra el primero con el botón superior":""}/></td></tr>}
        </tbody>
      </table></div>
      <Paginator page={pg} total={fd.length} perPage={PP} onChange={setPg}/>
    </Card>
    {/* Panel por categoría */}
    {CATS.filter(c=>(activos||[]).some(a=>a.empId===empId&&a.categoria===c)).length>0&&<div style={{marginTop:16}}>
      <div style={{fontFamily:"var(--fh)",fontSize:14,fontWeight:700,marginBottom:12}}>Por Categoría</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        {CATS.filter(c=>(activos||[]).some(a=>a.empId===empId&&a.categoria===c)).map(c=>{
          const items=(activos||[]).filter(a=>a.empId===empId&&a.categoria===c);
          const val=items.reduce((s,a)=>s+Number(a.valorCompra||0),0);
          return <div key={c} onClick={()=>setFc(fc===c?"":c)} style={{background:"var(--card)",border:`1px solid ${fc===c?"var(--cy)":"var(--bdr)"}`,borderRadius:8,padding:"12px 14px",cursor:"pointer",transition:".1s"}}>
            <div style={{fontFamily:"var(--fm)",fontSize:20,fontWeight:700,color:fc===c?"var(--cy)":"var(--wh)"}}>{items.length}</div>
            <div style={{fontSize:11,fontWeight:600,marginTop:2}}>{c}</div>
            {val>0&&<div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{fmtM(val)}</div>}
          </div>;
        })}
      </div>
    </div>}
  </div>;
}
