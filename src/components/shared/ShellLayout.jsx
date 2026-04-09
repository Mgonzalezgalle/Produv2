import { useState } from "react";
import { canDo, getRoleConfig } from "../../lib/auth/authorization";
import { buildSidebarNavigation } from "../../lib/modules/moduleRegistry";
import { Badge } from "../../lib/ui/components";

export function BrandLockup({
  size="md",
  subtitleColor="rgba(255,255,255,.88)",
  wordColor="var(--cy)",
  align="left",
  glow=true,
}){
  const presets={
    sm:{ icon:34, iconRadius:8, iconGlyph:16, gap:10, title:17, subtitle:8.2, subtitleOffset:2, subtitleWeight:500 },
    md:{ icon:48, iconRadius:12, iconGlyph:22, gap:14, title:32, subtitle:11.8, subtitleOffset:4, subtitleWeight:500 },
    lg:{ icon:56, iconRadius:14, iconGlyph:24, gap:16, title:36, subtitle:12.8, subtitleOffset:4, subtitleWeight:500 },
  }[size] || {
    icon:48, iconRadius:12, iconGlyph:22, gap:14, title:32, subtitle:11.8, subtitleOffset:4, subtitleWeight:500,
  };
  return <div style={{display:"flex",alignItems:"center",justifyContent:align==="center"?"center":"flex-start",gap:presets.gap}}>
    <div style={{width:presets.icon,height:presets.icon,borderRadius:presets.iconRadius,background:"linear-gradient(180deg,var(--cy) 0%, var(--cy2) 100%)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:glow?"0 0 24px var(--cm)":"none",flexShrink:0}}>
      <svg viewBox="0 0 24 24" fill="var(--bg)" width={presets.iconGlyph} height={presets.iconGlyph}><polygon points="5,3 20,12 5,21"/></svg>
    </div>
    <div style={{display:"flex",flexDirection:"column",alignItems:"flex-start",justifyContent:"center",width:"fit-content",textAlign:"left"}}>
      <div style={{fontFamily:"var(--fh)",fontSize:presets.title,fontWeight:800,color:wordColor,letterSpacing:-1.2,lineHeight:.92}}>Produ</div>
      <div style={{fontSize:presets.subtitle,color:subtitleColor,letterSpacing:0,fontWeight:presets.subtitleWeight,lineHeight:1,marginTop:presets.subtitleOffset,whiteSpace:"nowrap"}}>Gestión de Productoras</div>
    </div>
  </div>;
}

export function LoadingScreen({ title="Cargando datos...", sub="En los proximos segundos estaremos al aire" }){
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:"60vh",gap:18,textAlign:"center",padding:"24px 16px"}}>
    <BrandLockup size="md" subtitleColor="var(--gr2)" />
    <div style={{width:54,height:54,border:"3px solid var(--bdr2)",borderTop:"3px solid var(--cy)",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
    <div>
      <div style={{fontFamily:"var(--fh)",fontSize:16,fontWeight:700,color:"var(--wh)",marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:"var(--gr2)"}}>{sub}</div>
    </div>
  </div>;
}

function NavGroups({ NAV, base, collapsed, onNav, user, empresa, flatSidebar, counts }) {
  const initOpen = () => {
    const o = {};
    NAV.forEach(g => { o[g.group] = true; });
    return o;
  };
  const [open, setOpen] = useState(initOpen);
  const toggle = g => setOpen(p => ({ ...p, [g]: !p[g] }));

  if (collapsed) {
    return <div style={{ padding:"8px 8px 12px" }}>
      {NAV.map(grp => {
        const items = grp.items.filter(n => !n.need || canDo(user, n.need, empresa) || user?.role==="admin" || user?.role==="superadmin");
        if (!items.length) return null;
        return <div key={grp.group} style={{marginBottom:10}}>
          <div style={{width:28,height:1,background:"var(--bdr2)",margin:"0 auto 8px",opacity:.7}}/>
          {items.map(n => {
            const active = base === n.id;
            return <div key={n.id} onClick={() => onNav(n.id)} title={n.label}
              style={{ display:"flex",alignItems:"center",justifyContent:"center",width:42,height:42,borderRadius:12,cursor:"pointer",background:active?"linear-gradient(180deg,var(--cg),transparent)":"transparent",border:active?"1px solid var(--cm)":"1px solid transparent",boxShadow:active?"inset 0 0 0 1px var(--cg)":"none",margin:"0 auto 4px",transition:".1s",position:"relative" }}>
              <span style={{ fontSize:18,filter:active?"drop-shadow(0 0 8px var(--cm))":"none" }}>{n.icon}</span>
              {n.cnt>0&&<span style={{position:"absolute",top:3,right:3,minWidth:16,height:16,borderRadius:20,background:active?"var(--cy)":"var(--bdr2)",color:active?"var(--bg)":"var(--gr3)",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px",fontFamily:"var(--fm)"}}>{n.cnt>9?"9+":n.cnt}</span>}
            </div>;
          })}
        </div>;
      })}
    </div>;
  }

  return <div style={{ padding:"4px 0" }}>
    {NAV.map(grp => {
      const items = grp.items.filter(n => !n.need || canDo(user, n.need, empresa) || user?.role==="admin" || user?.role==="superadmin");
      if (!items.length) return null;
      const isOpen = open[grp.group] !== false;
      return <div key={grp.group} style={{ margin:"0 8px 10px",background:"transparent",border:"none",borderRadius:12,overflow:"hidden" }}>
        <div onClick={() => toggle(grp.group)}
          style={{ display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px 8px",cursor:"pointer",userSelect:"none",background:flatSidebar?"transparent":"linear-gradient(180deg,var(--card2),transparent)" }}>
          <span style={{ fontSize:10,letterSpacing:1.7,textTransform:"uppercase",fontWeight:800,color:flatSidebar?"#94a3b8":"var(--gr2)" }}>{grp.group}</span>
          <span style={{ fontSize:10,color:flatSidebar?"#94a3b8":"var(--gr2)",transition:"transform .2s",display:"inline-block",transform:isOpen?"rotate(180deg)":"rotate(0deg)" }}>▾</span>
        </div>
        {isOpen && <div style={{ padding:"0 6px 8px" }}>
          {items.map(n => {
            const active = base === n.id;
            return <div key={n.id} onClick={() => onNav(n.id)}
              style={{ display:"flex",alignItems:"center",gap:10,padding:"10px 12px",cursor:"pointer",color:active?"var(--cy)":flatSidebar?"#e5edf7":"var(--gr3)",fontSize:13,fontWeight:active?700:500,background:active?"linear-gradient(90deg,var(--cg),transparent)":"transparent",border:`1px solid ${active?"var(--cm)":"transparent"}`,borderRadius:10,transition:".1s",marginBottom:4 }}>
              <span style={{ fontSize:16,flexShrink:0,width:22,textAlign:"center",filter:active?"drop-shadow(0 0 8px var(--cm))":"none" }}>{n.icon}</span>
              <span style={{ flex:1,whiteSpace:"nowrap",textAlign:"left" }}>{n.label}</span>
              {n.cnt !== undefined && <span style={{ background:active?"var(--cm)":flatSidebar?"rgba(255,255,255,.08)":"var(--bdr2)",color:active?"var(--cy)":flatSidebar?"#cbd5e1":"var(--gr2)",fontSize:10,padding:"1px 7px",borderRadius:20,fontFamily:"var(--fm)",fontWeight:600 }}>{n.cnt}</span>}
            </div>;
          })}
        </div>}
      </div>;
    })}
  </div>;
}

export function Sidebar({user,empresa,view,onNav,onAdmin,onLogout,onChangeEmp,counts,collapsed,onToggle,syncPulse,isMobile,ini,includeTreasury=true}){
  const sbBg="var(--sidebar-bg)";
  const sbPanel="var(--sidebar-panel)";
  const sbText="var(--sidebar-text)";
  const sbMuted="var(--sidebar-muted)";
  const base=view==="contenido-det"?"contenidos":view.split("-")[0];
  const NAV=buildSidebarNavigation({empresa,counts,includeTreasury});
  const SW=collapsed?64:240;
  return <aside className="app-sidebar" style={{width:SW,minHeight:"100vh",background:sbBg,display:"flex",flexDirection:"column",position:"fixed",left:0,top:0,bottom:0,zIndex:200,transition:"width .2s",overflow:"hidden"}}>
    <div style={{padding:"14px 14px",borderBottom:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"space-between",minHeight:64}}>
      {!collapsed?<>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <BrandLockup size="sm" subtitleColor={sbMuted} wordColor="var(--wh)" glow={false} />
        </div>
        <button onClick={onToggle} style={{background:"none",border:"none",color:sbMuted,cursor:"pointer",padding:4,borderRadius:4,fontSize:13}}>{isMobile?"✕":"‹"}</button>
      </>:
        <div onClick={onToggle} style={{width:34,height:34,borderRadius:8,background:"var(--cy)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto",cursor:"pointer",boxShadow:"0 0 14px var(--cm)"}}>
          <svg viewBox="0 0 24 24" fill="var(--bg)" width="16" height="16"><polygon points="5,3 20,12 5,21"/></svg>
        </div>}
    </div>
    {!collapsed&&empresa&&<div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.08)",background:"transparent"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:28,height:28,borderRadius:6,background:sbPanel,border:`1px solid rgba(255,255,255,.08)`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
          {empresa.logo
            ? <img src={empresa.logo} style={{width:28,height:28,objectFit:"contain",borderRadius:6}} alt={empresa.nombre}/>
            : <span style={{fontFamily:"var(--fh)",fontSize:10,fontWeight:800,color:empresa.color}}>{ini(empresa.nombre)}</span>}
        </div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:700,color:sbText,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{empresa.nombre}</div><div style={{fontSize:9,color:sbMuted}}>{empresa.rut}</div></div>
        {user?.role==="superadmin"&&<button onClick={onChangeEmp} title="Cambiar empresa" style={{background:"none",border:"none",color:sbMuted,cursor:"pointer",fontSize:13,padding:2}}>⇄</button>}
      </div>
    </div>}
    <nav style={{flex:1,padding:"8px 0",overflowY:"auto"}}>
      <NavGroups NAV={NAV} base={base} collapsed={collapsed} onNav={onNav} user={user} empresa={empresa} flatSidebar={true}/>
    </nav>
    {!collapsed&&<div style={{padding:"10px 8px 12px",borderTop:"1px solid rgba(255,255,255,.08)",background:"transparent"}}>
      {(user?.role==="admin"||user?.role==="superadmin")&&<div onClick={onAdmin} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:10,cursor:"pointer",border:"1px solid rgba(255,255,255,.08)",background:sbPanel,color:sbText,fontSize:12,fontWeight:700,marginBottom:8,transition:".1s"}}><span>⚙</span>Panel Admin</div>}
      <div style={{display:"flex",alignItems:"center",gap:6,padding:"2px 8px",marginBottom:8}}>
        <div style={{width:6,height:6,borderRadius:"50%",background:"var(--cy)",flexShrink:0,animation:syncPulse?"pulse 1s infinite":undefined}}/>
        <span style={{fontSize:9,color:sbMuted}}>Sincronizado · Supabase</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",borderRadius:12,background:sbPanel,border:"1px solid rgba(255,255,255,.08)"}}>
        <div style={{width:26,height:26,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(user?.name||"")}</div>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:11,fontWeight:600,color:sbText,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.name}</div><Badge label={getRoleConfig(user?.role, empresa).label} color={getRoleConfig(user?.role, empresa).badge} sm/></div>
        <button onClick={onLogout} title="Cerrar sesión" style={{background:"none",border:"none",color:sbMuted,cursor:"pointer",fontSize:14,padding:2}}>⏏</button>
      </div>
    </div>}
  </aside>;
}
