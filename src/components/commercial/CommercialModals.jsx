import React, { useEffect, useRef, useState } from "react";
import {
  FG,
  FI,
  FSl,
  FTA,
  MFoot,
  Modal,
  MultiSelect,
  R2,
  R3,
} from "../../lib/ui/components";
import { DEFAULT_LISTAS, fmtM, hasAddon, today } from "../../lib/utils/helpers";

export function MCt({open,data,empresa,clientes,producciones,programas,piezas,presupuestos,facturas,listas,onClose,onSave}){
  const [f,setF]=useState({});
  const canPrograms = hasAddon(empresa, "television");
  const canSocial = hasAddon(empresa, "social");
  const canPres = hasAddon(empresa, "presupuestos");
  const canFact = hasAddon(empresa, "facturacion");
  useEffect(()=>{
    setF(data?.id
      ? {...data, pids:data.pids||[], facturaIds:data.facturaIds||[], alertaDias:data.alertaDias||30}
      : {nom:"",cliId:data?.cliId||"",tip:"Producción",est:"Borrador",mon:"",ini:"",vig:"",arc:"",not:"",pids:[],presupuestoId:"",facturaIds:[],alertaDias:30,renovacionAuto:false}
    );
  },[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const opts=[
    ...(producciones||[]).map(p=>({value:"p:"+p.id,label:"📽 "+p.nom})),
    ...(canPrograms ? (programas||[]).map(p=>({value:"pg:"+p.id,label:"📺 "+p.nom})) : []),
    ...(canSocial ? (piezas||[]).map(p=>({value:"pz:"+p.id,label:"📱 "+p.nom})) : []),
  ];
  const presupuestosCli = (presupuestos||[]).filter(p => !f.cliId || p.cliId === f.cliId);
  const facturasCli = (facturas||[]).filter(x => !f.cliId || x.entidadId === f.cliId);
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Contrato":"Nuevo Contrato"} sub="Documento legal">
    <R2><FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Contrato de Proyecto Q2"/></FG><FG label="Cliente"><FSl value={f.cliId||""} onChange={e=>u("cliId",e.target.value)}><option value="">— Sin cliente —</option>{(clientes||[]).map(c=><option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG></R2>
    <FG label="Asociaciones"><MultiSelect options={opts} value={f.pids||[]} onChange={v=>u("pids",v)} placeholder={canSocial?"Proyectos, producciones y campañas...":canPrograms?"Proyectos y producciones...":"Proyectos vinculados..."}/></FG>
    <R2><FG label="Tipo"><FSl value={f.tip||""} onChange={e=>u("tip",e.target.value)}>{(listas?.tiposCt||DEFAULT_LISTAS.tiposCt).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Estado"><FSl value={f.est||""} onChange={e=>u("est",e.target.value)}>{(listas?.estadosCt||DEFAULT_LISTAS.estadosCt).map(o=><option key={o}>{o}</option>)}</FSl></FG></R2>
    <R3>
      <FG label="Monto Total (CLP)"><FI type="number" value={f.mon||""} onChange={e=>u("mon",e.target.value)} placeholder="0"/></FG>
      <FG label="Inicio"><FI type="date" value={f.ini||""} onChange={e=>u("ini",e.target.value)}/></FG>
      <FG label="Vigencia"><FI type="date" value={f.vig||""} onChange={e=>u("vig",e.target.value)}/></FG>
    </R3>
    <R2>
      <FG label="Alerta previa (días)"><FI type="number" value={f.alertaDias||30} onChange={e=>u("alertaDias",e.target.value)} min="0" placeholder="30"/></FG>
      <FG label="Renovación"><FSl value={f.renovacionAuto?"true":"false"} onChange={e=>u("renovacionAuto",e.target.value==="true")}><option value="false">Manual</option><option value="true">Automática</option></FSl></FG>
    </R2>
    {canPres && <FG label="Presupuesto asociado">
      <FSl value={f.presupuestoId||""} onChange={e=>u("presupuestoId",e.target.value)}>
        <option value="">— Sin presupuesto asociado —</option>
        {presupuestosCli.map(p=><option key={p.id} value={p.id}>{p.correlativo||p.titulo} · {fmtM(p.total||0)}</option>)}
      </FSl>
    </FG>}
    {canFact && <FG label="Órdenes de factura asociadas">
      <MultiSelect options={facturasCli.map(x=>({value:x.id,label:`${x.correlativo||"Sin correlativo"} · ${fmtM(x.total||0)}`}))} value={f.facturaIds||[]} onChange={v=>u("facturaIds",v)} placeholder="Seleccionar órdenes..."/>
    </FG>}
    <FG label="Archivo / URL"><FI value={f.arc||""} onChange={e=>u("arc",e.target.value)} placeholder="URL del documento"/></FG>
    <FG label="Notas"><FTA value={f.not||""} onChange={e=>u("not",e.target.value)} placeholder="Condiciones especiales..."/></FG>
    <MFoot onClose={onClose} onSave={()=>{if(!f.nom?.trim())return;onSave(f);}}/>
  </Modal>;
}

export function MMov({open,data,listas,onClose,onSave}){
  const [f,setF]=useState({});
  const formRef = useRef(null);
  useEffect(()=>{setF({tipo:data?.tipo||"ingreso",mon:"",des:"",cat:"General",fec:today(),not:"",eid:data?.eid||"",et:data?.et||""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const handleSave = () => {
    const formData = formRef.current ? new FormData(formRef.current) : null;
    const tipo = String(formData?.get("tipo") ?? f.tipo ?? data?.tipo ?? "ingreso");
    const monRaw = String(formData?.get("mon") ?? f.mon ?? "");
    const des = String(formData?.get("des") ?? f.des ?? "");
    const cat = String(formData?.get("cat") ?? f.cat ?? "General");
    const fec = String(formData?.get("fec") ?? f.fec ?? today());
    if (!monRaw || !des.trim()) return;
    onSave({
      ...f,
      tipo,
      mon: Number(monRaw),
      des,
      cat,
      fec,
      eid: f.eid || data?.eid || "",
      et: f.et || data?.et || "",
    });
  };
  return <Modal open={open} onClose={onClose} title="Registrar Movimiento" sub="Ingreso o gasto">
    <form ref={formRef} onSubmit={e => { e.preventDefault(); handleSave(); }}>
      <R2><FG label="Tipo *"><FSl name="tipo" value={f.tipo} onChange={e=>u("tipo",e.target.value)}><option value="ingreso">💰 Ingreso</option><option value="gasto">💸 Gasto / Egreso</option></FSl></FG><FG label="Monto (CLP) *"><FI name="mon" type="number" value={f.mon} onChange={e=>u("mon",e.target.value)} placeholder="0" min="0"/></FG></R2>
      <FG label="Descripción *"><FI name="des" value={f.des} onChange={e=>u("des",e.target.value)} placeholder="Ej: Pago cuota 1, Arriendo..."/></FG>
      <R2><FG label="Categoría"><FSl name="cat" value={f.cat} onChange={e=>u("cat",e.target.value)}>{(listas?.catMov||DEFAULT_LISTAS.catMov).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Fecha"><FI name="fec" type="date" value={f.fec} onChange={e=>u("fec",e.target.value)}/></FG></R2>
      <MFoot onClose={onClose} onSave={handleSave} label="Registrar"/>
    </form>
  </Modal>;
}
