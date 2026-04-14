import { useEffect, useMemo, useState } from "react";
import { Badge, Btn, DBtn, Empty, FG, FI, FSl, R3 } from "../../lib/ui/components";
import { getCustomRoles, PERMS, ROLE_COLOR_MAP, ROLE_PERMISSION_GROUPS, ROLES } from "../../lib/auth/authorization";

export function RolesEditor({ empresa, empresas, users, saveEmpresas, platformServices, ntf, uid, canManageAdmin=true }) {
  const [activeKey,setActiveKey]=useState("");
  const [draft,setDraft]=useState({label:"",color:"#7c7c8a",badge:"gray",permissions:[]});
  const customRoles=getCustomRoles(empresa);
  const roleList=useMemo(
    ()=>[
      ...Object.entries(ROLES).filter(([k])=>k!=="superadmin").map(([key,val])=>({key,base:true,label:val.label,color:val.color,badge:ROLE_COLOR_MAP[key]||"gray",permissions:PERMS[key]||[]})),
      ...customRoles.map(r=>({...r,base:false})),
    ],
    [customRoles],
  );

  useEffect(()=>{
    const first=roleList[0]?.key||"";
    if(!activeKey && first) setActiveKey(first);
  },[roleList.length, activeKey, roleList]);

  useEffect(()=>{
    const selected=roleList.find(r=>r.key===activeKey);
    if(selected) setDraft({label:selected.label||"",color:selected.color||"#7c7c8a",badge:selected.badge||"gray",permissions:[...(selected.permissions||[])]});
  },[activeKey, roleList]);

  const selected=roleList.find(r=>r.key===activeKey);
  const tenantUsers=(users||[]).filter(u=>u.empId===empresa?.id);
  const selectedAssignedUsers=tenantUsers.filter(u=>u.role===selected?.key);

  const persistRoles=nextCustomRoles=>{
    if(!canManageAdmin) return;
    saveEmpresas((empresas||[]).map(em=>em.id===empresa.id?{...em,customRoles:nextCustomRoles}:em));
  };

  const applyRoleList = nextRoles => {
    if (!Array.isArray(nextRoles)) return;
    persistRoles(nextRoles);
  };

  const createRole=async()=>{
    const nextRole={key:`custom_${uid().slice(1,7)}`,label:"Nuevo rol",color:"#7c7c8a",badge:"gray",permissions:[]};
    if (platformServices?.createTenantRole) {
      const nextRoles = await platformServices.createTenantRole(empresa.id, nextRole);
      applyRoleList(nextRoles);
    } else persistRoles([...(customRoles||[]),nextRole]);
    setActiveKey(nextRole.key);
    ntf("Rol creado ✓");
  };

  const saveRole=async()=>{
    if(!selected || selected.base || !draft.label?.trim()) return;
    if (platformServices?.updateTenantRole) {
      const nextRoles = await platformServices.updateTenantRole(empresa.id, selected.key, {
        label:draft.label.trim(),
        color:draft.color,
        badge:draft.badge,
        permissions:[...(draft.permissions||[])],
      });
      applyRoleList(nextRoles);
    } else {
      const nextCustomRoles=(customRoles||[]).map(r=>r.key===selected.key?{...r,label:draft.label.trim(),color:draft.color,badge:draft.badge,permissions:[...(draft.permissions||[])]}:r);
      persistRoles(nextCustomRoles);
    }
    ntf("Rol actualizado ✓");
  };

  const deleteRole=async()=>{
    if(!selected || selected.base) return;
    if(selectedAssignedUsers.length) {
      ntf("No puedes eliminar un rol asignado a usuarios activos","warn");
      return;
    }
    if(!confirm("¿Eliminar este rol personalizado?")) return;
    if (platformServices?.deleteTenantRole) {
      const nextRoles = await platformServices.deleteTenantRole(empresa.id, selected.key);
      applyRoleList(nextRoles);
    }
    else persistRoles((customRoles||[]).filter(r=>r.key!==selected.key));
    setActiveKey(roleList.find(r=>r.key!==selected.key)?.key||"");
    ntf("Rol eliminado","warn");
  };

  const togglePerm=perm=>setDraft(p=>({...p,permissions:p.permissions.includes(perm)?p.permissions.filter(x=>x!==perm):[...p.permissions,perm]}));

  return <div>
    <div style={{fontSize:12,color:"var(--gr2)",marginBottom:16}}>Crea roles personalizados por empresa y define qué módulos puede usar cada perfil. Los roles base se pueden revisar, pero no eliminar.</div>
    <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16,alignItems:"start"}}>
      <div style={{background:"var(--sur)",border:"1px solid var(--bdr2)",borderRadius:10,overflow:"hidden"}}>
        {roleList.map(role=><div key={role.key} onClick={()=>setActiveKey(role.key)} style={{padding:"11px 14px",cursor:"pointer",borderBottom:"1px solid var(--bdr)",background:activeKey===role.key?"var(--cg)":"transparent",borderLeft:activeKey===role.key?"3px solid var(--cy)":"3px solid transparent"}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
            <span style={{fontSize:12,fontWeight:700,color:activeKey===role.key?"var(--cy)":"var(--gr3)"}}>{role.label}</span>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",justifyContent:"flex-end"}}>
              <Badge label={`${tenantUsers.filter(u=>u.role===role.key).length} usuarios`} color="gray" sm/>
              {role.base?<Badge label="Base" color="gray" sm/>:<Badge label="Custom" color="cyan" sm/>}
            </div>
          </div>
          <div style={{fontSize:10,color:"var(--gr2)",marginTop:4}}>{(role.permissions||[]).length} permisos</div>
        </div>)}
        <div style={{padding:12}}><Btn onClick={createRole} sm>+ Nuevo rol</Btn></div>
      </div>
      {selected?<div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:10,padding:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:4}}>Rol: {selected.label}</div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Badge label={selected.base?"Rol base":"Rol personalizado"} color={selected.base?"gray":"cyan"} sm/>
              <Badge label={`${selectedAssignedUsers.length} usuario${selectedAssignedUsers.length===1?"":"s"} asignado${selectedAssignedUsers.length===1?"":"s"}`} color="gray" sm/>
            </div>
          </div>
          {!selected.base&&<DBtn onClick={deleteRole} sm>Eliminar rol</DBtn>}
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginBottom:14}}>
          {selected.base
            ? "Los roles base se pueden revisar, pero no editar ni eliminar desde el tenant."
            : selectedAssignedUsers.length
              ? "Este rol está asignado a usuarios. Puedes editarlo, pero para eliminarlo primero debes reasignar esos usuarios a otro rol."
              : "Puedes editar permisos, renombrar este rol o eliminarlo si ya no lo necesitas."}
        </div>
        <R3>
          <FG label="Nombre del rol"><FI value={draft.label||""} onChange={e=>setDraft(p=>({...p,label:e.target.value}))} disabled={selected.base}/></FG>
          <FG label="Color label"><FI type="color" value={draft.color||"#7c7c8a"} onChange={e=>setDraft(p=>({...p,color:e.target.value}))} disabled={selected.base}/></FG>
          <FG label="Badge"><FSl value={draft.badge||"gray"} onChange={e=>setDraft(p=>({...p,badge:e.target.value}))} disabled={selected.base}>{["gray","cyan","green","yellow","red","purple"].map(c=><option key={c} value={c}>{c}</option>)}</FSl></FG>
        </R3>
        <div style={{display:"grid",gap:12,marginTop:8}}>
          {ROLE_PERMISSION_GROUPS.map(group=><div key={group.label} style={{background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:10,padding:12}}>
            <div style={{fontSize:11,fontWeight:800,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1.4,marginBottom:10}}>{group.label}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
              {group.items.map(([perm,label])=><label key={perm} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:"var(--card)",border:`1px solid ${draft.permissions.includes(perm)?"var(--cy)":"var(--bdr2)"}`,borderRadius:8,cursor:selected.base?"default":"pointer",opacity:selected.base?0.75:1}}>
                <input type="checkbox" checked={draft.permissions.includes(perm)} disabled={selected.base} onChange={()=>togglePerm(perm)}/>
                <span style={{fontSize:12,color:"var(--wh)"}}>{label}</span>
              </label>)}
            </div>
          </div>)}
        </div>
        <div style={{display:"flex",gap:8,marginTop:16}}>
          {!selected.base&&<Btn onClick={saveRole}>Guardar cambios del rol</Btn>}
          {selected.base&&<div style={{fontSize:11,color:"var(--gr2)"}}>Los roles base se usan como referencia y no se editan desde aquí.</div>}
        </div>
      </div>:<Empty text="Selecciona un rol para editar"/>}
    </div>
  </div>;
}
