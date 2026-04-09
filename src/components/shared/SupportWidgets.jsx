import { useEffect, useRef, useState } from "react";

const supportThreadPreviewText = (thread = null) => {
  const messages = Array.isArray(thread?.messages) ? thread.messages : [];
  return messages[messages.length - 1]?.text || "Todavía no hay mensajes en esta conversación.";
};

export function SupportChatWidget({
  empresa,
  user,
  users = [],
  supportThreads = [],
  supportSettings = {},
  onSaveThreads,
  helpers,
}) {
  const {
    buildSupportSettings,
    normalizeSupportThreads,
    ensureSupportThread,
    supportAttachmentFromFile,
    uid,
    nowIso,
    fmtDT,
    ini,
  } = helpers;
  const supportEnabled = empresa?.supportChatEnabled !== false;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [helpQuery, setHelpQuery] = useState("");
  const creatingThreadRef = useRef(false);
  const settings = buildSupportSettings(supportSettings, users);
  const currentThread = normalizeSupportThreads(supportThreads, [empresa], users, settings).find(thread => thread.empId === empresa?.id) || null;
  const activeAdmins = (currentThread?.assignedAdminIds?.length ? currentThread.assignedAdminIds : settings.teamIds)
    .map(id => (users || []).find(u => u.id === id))
    .filter(Boolean)
    .slice(0, 3);

  useEffect(() => {
    if (!open || !empresa?.id || !supportEnabled || currentThread || creatingThreadRef.current) return;
    creatingThreadRef.current = true;
    const ensured = ensureSupportThread(supportThreads, empresa.id, empresa, users, settings);
    if (ensured.created) {
      Promise.resolve(onSaveThreads?.(ensured.threads)).finally(() => {
        creatingThreadRef.current = false;
      });
    } else {
      creatingThreadRef.current = false;
    }
  }, [open, empresa?.id, supportEnabled, currentThread, supportThreads, users, supportSettings]);

  const loadAttachments = async files => {
    const list = Array.from(files || []).slice(0, Math.max(0, 4 - attachments.length));
    const next = [];
    for (const file of list) {
      const att = await supportAttachmentFromFile(file);
      if (att) next.push(att);
    }
    if (next.length) setAttachments(prev => [...prev, ...next].slice(0, 4));
  };

  const sendMessage = async () => {
    if (!empresa?.id || (!draft.trim() && !attachments.length)) return;
    const ensured = currentThread ? { threads: supportThreads, thread: currentThread, created: false } : ensureSupportThread(supportThreads, empresa.id, empresa, users, settings);
    const baseThreads = normalizeSupportThreads(ensured.threads, [empresa], users, settings);
    const target = ensured.thread || baseThreads.find(thread => thread.empId === empresa.id);
    if (!target) return;
    const msg = {
      id: uid(),
      authorType: "tenant",
      authorId: user?.id || "",
      authorName: user?.name || "Usuario",
      text: draft.trim(),
      attachments,
      createdAt: nowIso(),
    };
    const nextMessages = [...(target.messages || []), msg];
    if (settings.autoAckEnabled) {
      nextMessages.push({
        id: uid(),
        authorType: "system",
        authorId: "",
        authorName: "Soporte Produ",
        text: settings.autoAckMessage,
        attachments: [],
        automated: true,
        createdAt: nowIso(),
      });
    }
    const stamp = nowIso();
    const nextThreads = baseThreads.map(thread => thread.id === target.id ? {
      ...thread,
      status: "open",
      updatedAt: stamp,
      lastMessageAt: stamp,
      createdBy: thread.createdBy || user?.id || "",
      messages: nextMessages,
    } : thread);
    await onSaveThreads?.(nextThreads);
    setDraft("");
    setAttachments([]);
  };

  if (!empresa?.id || !user || !supportEnabled) return null;

  const thread = currentThread;
  const messages = thread?.messages || [];
  const helpItems = [
    `${settings.helpSearchPlaceholder}: pagos, accesos, módulos`,
    "Estado de activación de empresa",
    "Configuración de addons e impresos",
  ].filter(item => !helpQuery || item.toLowerCase().includes(helpQuery.toLowerCase()));

  return <>
    <button onClick={() => setOpen(v => !v)} style={{position:"fixed",right:20,bottom:20,zIndex:310,width:58,height:58,borderRadius:"50%",border:"none",background:"linear-gradient(180deg,#4f8df5,#3b82f6)",color:"#fff",boxShadow:"0 18px 34px rgba(59,130,246,.35)",cursor:"pointer",fontSize:26,fontWeight:800}}>
      {open ? "×" : "⌄"}
    </button>
    {open && <div style={{position:"fixed",right:20,bottom:92,zIndex:310,width:"min(390px,calc(100vw - 24px))",maxHeight:"min(720px,calc(100vh - 120px))",borderRadius:26,overflow:"hidden",background:"#fff",boxShadow:"0 26px 70px rgba(15,23,42,.28)",display:"grid",gridTemplateRows:"auto 1fr"}}>
      <div style={{padding:"22px 22px 18px",background:"linear-gradient(180deg,#4f8df5,#5ea0ff)",color:"#fff"}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"var(--fh)",fontSize:18,fontWeight:800,marginBottom:4}}>produ</div>
            <div style={{fontSize:11,opacity:.85}}>Soporte a empresas usuarias</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            {activeAdmins.map(admin => <div key={admin.id} title={admin.name} style={{width:34,height:34,borderRadius:"50%",background:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center",color:"#1d4ed8",fontSize:11,fontWeight:800,border:"2px solid rgba(255,255,255,.65)"}}>{ini(admin.name)}</div>)}
          </div>
        </div>
        <div style={{fontSize:13,opacity:.88,marginBottom:6}}>Hola {user?.name?.split(" ")[0] || "equipo"} 👋</div>
        <div style={{fontSize:18,fontWeight:800,lineHeight:1.15}}>¿Cómo podemos ayudarte?</div>
        <div style={{marginTop:14,padding:"10px 12px",borderRadius:16,background:"rgba(255,255,255,.16)",fontSize:12,lineHeight:1.45}}>
          {activeAdmins.length ? `Te atenderá ${activeAdmins.map(admin => admin.name.split(" ")[0]).join(", ")}.` : "Te atenderá un administrador de Produ."}
        </div>
      </div>
      <div style={{padding:18,background:"#f8fafc",overflowY:"auto",display:"grid",gap:12}}>
        <div style={{padding:14,borderRadius:18,background:"#fff",border:"1px solid #e5e7eb",boxShadow:"0 8px 24px rgba(15,23,42,.08)"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#111827",marginBottom:10}}>Mensaje reciente</div>
          <div style={{fontSize:13,color:"#111827",fontWeight:700,marginBottom:4}}>{supportThreadPreviewText(thread)}</div>
          <div style={{fontSize:11,color:"#64748b"}}>{thread ? `Última actualización: ${fmtDT(thread.lastMessageAt)}` : "Abriremos un hilo nuevo cuando escribas."}</div>
        </div>
        <div style={{padding:14,borderRadius:18,background:"#fff",border:"1px solid #e5e7eb",boxShadow:"0 8px 24px rgba(15,23,42,.08)"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#111827",marginBottom:10}}>Mensajes</div>
          <div style={{display:"grid",gap:8,maxHeight:190,overflowY:"auto",paddingRight:4}}>
            {messages.map(msg => {
              const mine = msg.authorType === "tenant";
              return <div key={msg.id} style={{justifySelf:mine?"end":"stretch",maxWidth:"88%"}}>
                <div style={{padding:"10px 12px",borderRadius:16,background:mine?"#dbeafe":"#eef2ff",border:`1px solid ${mine?"#bfdbfe":"#dbe4ff"}`}}>
                  <div style={{fontSize:10,fontWeight:800,color:mine?"#1d4ed8":"#334155",marginBottom:4}}>{msg.authorName}</div>
                  <div style={{fontSize:12,color:"#0f172a",lineHeight:1.45,whiteSpace:"pre-line"}}>{msg.text || "Adjunto"}</div>
                  {!!msg.attachments?.length && <div style={{display:"grid",gap:6,marginTop:8}}>
                    {msg.attachments.map(att => <button key={att.id} onClick={() => window.open(att.src, "_blank")} style={{textAlign:"left",padding:"7px 9px",borderRadius:10,border:"1px solid #dbe4ff",background:"#fff",cursor:"pointer",fontSize:11,color:"#1e3a8a"}}>
                      {att.type === "pdf" ? "PDF" : "Archivo"} · {att.name}
                    </button>)}
                  </div>}
                </div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:4,textAlign:mine?"right":"left"}}>{fmtDT(msg.createdAt)}</div>
              </div>;
            })}
            {!messages.length && <div style={{fontSize:12,color:"#64748b"}}>Sin conversación todavía.</div>}
          </div>
        </div>
        <div style={{padding:14,borderRadius:18,background:"#fff",border:"1px solid #e5e7eb",boxShadow:"0 8px 24px rgba(15,23,42,.08)"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#111827",marginBottom:8}}>Envíanos un mensaje</div>
          <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Describe tu solicitud, incidencia o archivo a revisar..." style={{width:"100%",minHeight:88,border:"1px solid #dbe3f0",borderRadius:14,padding:"12px 14px",fontFamily:"var(--fb)",fontSize:13,resize:"vertical",color:"#0f172a",background:"#f8fafc"}}/>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginTop:10,flexWrap:"wrap"}}>
            <label style={{padding:"8px 12px",borderRadius:12,border:"1px solid #dbe3f0",background:"#fff",fontSize:12,color:"#475569",cursor:"pointer"}}>
              Adjuntar archivo
              <input type="file" accept="image/*,application/pdf" multiple style={{display:"none"}} onChange={async e=>{ await loadAttachments(e.target.files); e.target.value=""; }}/>
            </label>
            <button onClick={sendMessage} style={{padding:"9px 14px",borderRadius:12,border:"none",background:"#3b82f6",color:"#fff",fontSize:12,fontWeight:800,cursor:"pointer"}}>Enviar ↗</button>
          </div>
          {!!attachments.length && <div style={{display:"grid",gap:6,marginTop:10}}>
            {attachments.map(att => <div key={att.id} style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center",padding:"8px 10px",borderRadius:12,background:"#eff6ff",border:"1px solid #bfdbfe",fontSize:11,color:"#1d4ed8"}}>
              <span style={{minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</span>
              <span onClick={()=>setAttachments(prev=>prev.filter(item=>item.id!==att.id))} style={{cursor:"pointer",fontWeight:800}}>×</span>
            </div>)}
          </div>}
        </div>
        <div style={{padding:14,borderRadius:18,background:"#fff",border:"1px solid #e5e7eb",boxShadow:"0 8px 24px rgba(15,23,42,.08)"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#111827",marginBottom:8}}>{settings.helpLinkLabel}</div>
          {settings.helpLinkUrl
            ? <button onClick={()=>window.open(settings.helpLinkUrl, "_blank")} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",padding:"10px 12px",borderRadius:12,border:"1px solid #dbe3f0",background:"#fff",cursor:"pointer",fontSize:12,color:"#334155"}}><span>{settings.helpLinkLabel}</span><span>↗</span></button>
            : <div style={{fontSize:11,color:"#64748b"}}>Configura un enlace de ayuda desde Super Admin &gt; Soporte.</div>}
        </div>
        <div style={{padding:14,borderRadius:18,background:"#fff",border:"1px solid #e5e7eb",boxShadow:"0 8px 24px rgba(15,23,42,.08)"}}>
          <div style={{fontSize:12,fontWeight:800,color:"#111827",marginBottom:8}}>Buscar ayuda</div>
          <input value={helpQuery} onChange={e=>setHelpQuery(e.target.value)} placeholder={settings.helpSearchPlaceholder} style={{width:"100%",padding:"10px 12px",borderRadius:12,border:"1px solid #e2e8f0",background:"#f8fafc",fontSize:12,color:"#0f172a"}}/>
          <div style={{display:"grid",gap:6,marginTop:10}}>
            {helpItems.map(item => <div key={item} style={{padding:"8px 10px",borderRadius:10,background:"#f8fafc",fontSize:11,color:"#475569"}}>{item}</div>)}
          </div>
        </div>
      </div>
    </div>}
  </>;
}

export function FreshdeskWidget({ empresa, user }) {
  useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      try {
        if (!window.fcWidget) return;
        if (empresa?.freshdeskEnabled === true && user?.role !== "superadmin") window.fcWidget.show?.();
        else window.fcWidget.hide?.();
      } catch {}
      if (tries > 20) window.clearInterval(timer);
    }, 400);
    return () => window.clearInterval(timer);
  }, [empresa?.freshdeskEnabled, user?.role]);
  return null;
}
