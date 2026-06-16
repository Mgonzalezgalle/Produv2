import React, { useEffect, useState } from "react";
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

const providerDisplayName = provider => String(provider?.name || provider?.razonSocial || provider?.nom || provider?.nombre || "").trim();

export function MCt({open,data,empresa,clientes,providers,producciones,programas,piezas,presupuestos,facturas,listas,onClose,onSave}){
  const [f,setF]=useState({});
  const providerOptions = (Array.isArray(providers) ? providers : []).filter(item => item?.id || providerDisplayName(item));
  const canPrograms = hasAddon(empresa, "television");
  const canSocial = hasAddon(empresa, "social");
  const canPres = hasAddon(empresa, "presupuestos");
  const canFact = hasAddon(empresa, "facturacion");
  useEffect(()=>{
    setF(data?.id
      ? {...data, pids:data.pids||[], facturaIds:data.facturaIds||[], alertaDias:data.alertaDias||30}
      : {nom:"",providerId:data?.providerId||"",providerName:data?.providerName||"",cliId:"",tip:"Servicio",est:"Borrador",mon:"",ini:"",vig:"",arc:"",not:"",pids:[],presupuestoId:"",facturaIds:[],alertaDias:30,renovacionAuto:false}
    );
  },[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const updateProvider = id => {
    const provider = providerOptions.find(item => String(item.id || providerDisplayName(item)) === String(id));
    setF(prev => ({ ...prev, providerId:provider?.id || "", providerName:providerDisplayName(provider), cliId:"" }));
  };
  const opts=[
    ...(producciones||[]).map(p=>({value:"p:"+p.id,label:"📽 "+p.nom})),
    ...(canPrograms ? (programas||[]).map(p=>({value:"pg:"+p.id,label:"📺 "+p.nom})) : []),
    ...(canSocial ? (piezas||[]).map(p=>({value:"pz:"+p.id,label:"📱 "+p.nom})) : []),
  ];
  const legacyClient = (clientes||[]).find(c => c.id === f.cliId);
  const presupuestosCli = (presupuestos||[]).filter(p => !f.cliId || p.cliId === f.cliId);
  const facturasCli = (facturas||[]).filter(x => !f.cliId || x.entidadId === f.cliId);
  return <Modal open={open} onClose={onClose} title={data?.id?"Editar Contrato":"Nuevo Contrato"} sub="Contrato de proveedor">
    <R2>
      <FG label="Nombre *"><FI value={f.nom||""} onChange={e=>u("nom",e.target.value)} placeholder="Contrato de servicio Q2"/></FG>
      <FG label="Proveedor">
        <FSl value={f.providerId||""} onChange={e=>updateProvider(e.target.value)}>
          <option value="">— Sin proveedor seleccionado —</option>
          {providerOptions.map(provider=><option key={provider.id || providerDisplayName(provider)} value={provider.id || providerDisplayName(provider)}>{providerDisplayName(provider)}</option>)}
        </FSl>
      </FG>
    </R2>
    <FG label="Nombre proveedor externo"><FI value={f.providerName||""} onChange={e=>u("providerName",e.target.value)} placeholder="Si no está creado en Tesorería, escríbelo aquí"/></FG>
    {legacyClient && <div style={{ marginBottom: 14, padding: "10px 12px", border: "1px solid var(--bdr2)", borderRadius: 12, background: "var(--sur)", color: "var(--gr2)", fontSize: 12 }}>
      Este contrato histórico venía asociado al cliente {legacyClient.nom}. Desde ahora los contratos se gestionan por proveedor.
    </div>}
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
  useEffect(()=>{setF({tipo:data?.tipo||"ingreso",mon:"",des:"",cat:"General",fec:today(),not:"",eid:data?.eid||"",et:data?.et||""});},[data,open]);
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const handleSave = () => {
    if (!f.mon) return;
    const des = String(f.des || "").trim() || `${f.tipo === "gasto" ? "Gasto" : "Ingreso"} · ${f.cat || "General"}`;
    onSave({ ...f, des, mon:Number(f.mon) });
  };
  return <Modal open={open} onClose={onClose} title="Registrar Movimiento" sub="Ingreso o gasto">
    <R2><FG label="Tipo *"><FSl value={f.tipo} onChange={e=>u("tipo",e.target.value)}><option value="ingreso">💰 Ingreso</option><option value="gasto">💸 Gasto / Egreso</option></FSl></FG><FG label="Monto (CLP) *"><FI type="number" value={f.mon} onChange={e=>u("mon",e.target.value)} placeholder="0" min="0"/></FG></R2>
    <FG label="Descripción"><FI value={f.des} onChange={e=>u("des",e.target.value)} placeholder="Opcional. Si la dejas vacía, se generará automáticamente."/></FG>
    <R2><FG label="Categoría"><FSl value={f.cat} onChange={e=>u("cat",e.target.value)}>{(listas?.catMov||DEFAULT_LISTAS.catMov).map(o=><option key={o}>{o}</option>)}</FSl></FG><FG label="Fecha"><FI type="date" value={f.fec} onChange={e=>u("fec",e.target.value)}/></FG></R2>
    <MFoot onClose={onClose} onSave={handleSave} label="Registrar"/>
  </Modal>;
}
