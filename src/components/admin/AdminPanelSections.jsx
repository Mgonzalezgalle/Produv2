import React from "react";
import { Badge, Btn, Card, DBtn, Empty, FG, FI, FSl, FTA, FilterSel, GBtn, KV, R2, R3, SearchBar } from "../../lib/ui/components";
import { companyPaymentInfoText, companyPrintColor, PRINT_COLORS } from "../../lib/utils/helpers";
import { getTransactionalEmailTemplateDefinition, getTransactionalEmailTemplateDefinitions, getTenantTransactionalEmailTemplates, resolveTransactionalEmailTemplate } from "../../lib/integrations/transactionalEmailTemplates";

const companyPrintColorLabel = empresa => PRINT_COLORS.find(opt => opt.value === companyPrintColor(empresa))?.label || "Azul institucional";

export function EmpresaEditSection({
  empresa,
  empresas,
  saveEmpresas,
  ntf,
  addons,
  companyGoogleCalendarEnabled,
  canManageAdmin = true,
}) {
  const [ef, setEf] = React.useState({});
  const [editing, setEditing] = React.useState(false);

  React.useEffect(() => {
    const payment = {
      holder: empresa?.paymentDetails?.holder || empresa?.paymentHolder || empresa?.nombre || "",
      rut: empresa?.paymentDetails?.rut || empresa?.paymentRut || empresa?.rut || "",
      bank: empresa?.paymentDetails?.bank || empresa?.paymentBank || "",
      accountType: empresa?.paymentDetails?.accountType || empresa?.paymentAccountType || "",
      accountNumber: empresa?.paymentDetails?.accountNumber || empresa?.paymentAccountNumber || "",
      email: empresa?.paymentDetails?.email || empresa?.paymentEmail || empresa?.ema || "",
      notes: empresa?.paymentDetails?.notes || empresa?.paymentNotes || "",
    };
    setEf({
      nombre: empresa.nombre || "",
      rut: empresa.rut || "",
      ema: empresa.ema || "",
      tel: empresa.tel || "",
      dir: empresa.dir || "",
      logo: empresa.logo || "",
      bankInfo: empresa.bankInfo || "",
      paymentHolder: payment.holder || "",
      paymentRut: payment.rut || "",
      paymentBank: payment.bank || "",
      paymentAccountType: payment.accountType || "",
      paymentAccountNumber: payment.accountNumber || "",
      paymentEmail: payment.email || "",
      paymentNotes: payment.notes || "",
      printColor: companyPrintColor(empresa),
      active: empresa.active !== false,
      addons: Array.isArray(empresa.addons) ? empresa.addons : [],
      googleCalendarEnabled: companyGoogleCalendarEnabled(empresa),
    });
  }, [empresa, companyGoogleCalendarEnabled]);

  const save = () => {
    if (!canManageAdmin) return;
    const updated = {
      ...empresa,
      ...ef,
      paymentDetails: {
        holder: ef.paymentHolder || ef.nombre || "",
        rut: ef.paymentRut || ef.rut || "",
        bank: ef.paymentBank || "",
        accountType: ef.paymentAccountType || "",
        accountNumber: ef.paymentAccountNumber || "",
        email: ef.paymentEmail || "",
        notes: ef.paymentNotes || "",
      },
    };
    saveEmpresas((empresas || []).map(em => em.id === empresa.id ? updated : em));
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
        {[["Nombre", empresa.nombre],["RUT", empresa.rut],["Email", empresa.ema||"—"],["Teléfono", empresa.tel||"—"],["Dirección", empresa.dir||"—"],["Estado", empresa.active!==false?"Activa":"Inactiva"],["Color de impresos", companyPrintColorLabel(empresa)],["Google Calendar", companyGoogleCalendarEnabled(empresa)?"Habilitado por Torre de Control":"No habilitado"]].map(([l,v])=><KV key={l} label={l} value={v}/>)}
      </div>
      <div style={{marginTop:14}}>
        <div style={{fontSize:10,color:"var(--gr2)",textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Información bancaria</div>
        <div style={{background:"var(--card2)",border:"1px solid var(--bdr)",borderRadius:8,padding:"10px 12px",fontSize:12,color:"var(--gr3)",whiteSpace:"pre-line"}}>{companyPaymentInfoText(empresa,{intro:false}) || empresa.bankInfo || "Sin información bancaria configurada"}</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6,marginTop:12}}>{(empresa.addons||[]).length?(empresa.addons||[]).map(a=><Badge key={a} label={addons[a]?.label||a} color="gray" sm/>):<span style={{fontSize:11,color:"var(--gr2)"}}>Sin addons activos</span>}</div>
    </div>
  );

  return (
    <div style={{ background:"var(--sur)", border:"1px solid var(--cy)", borderRadius:10, padding:16 }}>
      <div style={{ fontFamily:"var(--fh)", fontSize:13, fontWeight:700, marginBottom:14 }}>Editar Datos de la Empresa</div>
      <R2>
        <FG label="Nombre empresa"><FI value={ef.nombre} onChange={e=>setEf(p=>({...p,nombre:e.target.value}))} placeholder="Mi Productora SpA"/></FG>
        <FG label="RUT"><FI value={ef.rut} onChange={e=>setEf(p=>({...p,rut:e.target.value}))} placeholder="78.118.348-2"/></FG>
      </R2>
      <div style={{padding:"12px 14px",border:"1px solid var(--bdr2)",borderRadius:10,background:"var(--card2)",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--wh)",marginBottom:10}}>Logo de la empresa</div>
        <div style={{display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <div style={{width:68,height:68,borderRadius:14,border:"1px solid var(--bdr2)",background:"var(--sur)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",flexShrink:0}}>
            {ef.logo
              ? <img src={ef.logo} alt={ef.nombre || empresa?.nombre || "Logo empresa"} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              : <span style={{fontFamily:"var(--fh)",fontSize:20,fontWeight:800,color:"var(--gr2)"}}>{(ef.nombre || empresa?.nombre || "?").slice(0,1).toUpperCase()}</span>}
          </div>
          <div style={{display:"grid",gap:8,flex:1,minWidth:220}}>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => setEf(p => ({ ...p, logo: String(reader.result || "") }));
                reader.readAsDataURL(file);
              }}
              style={{fontSize:12,color:"var(--gr3)"}}
            />
            <div style={{fontSize:11,color:"var(--gr2)"}}>Sube un logo en PNG, JPG, WEBP o SVG. Se usará en la identidad visual y en documentos.</div>
            {!!ef.logo && <div><GBtn sm onClick={() => setEf(p => ({ ...p, logo: "" }))}>Quitar logo</GBtn></div>}
          </div>
        </div>
      </div>
      <R2>
        <FG label="Email"><FI value={ef.ema} onChange={e=>setEf(p=>({...p,ema:e.target.value}))} placeholder="contacto@empresa.cl"/></FG>
        <FG label="Teléfono"><FI value={ef.tel} onChange={e=>setEf(p=>({...p,tel:e.target.value}))} placeholder="+56 9 1234 5678"/></FG>
      </R2>
      <FG label="Estado"><FSl value={ef.active!==false?"true":"false"} onChange={e=>setEf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activa</option><option value="false">Inactiva</option></FSl></FG>
      <FG label="Dirección"><FI value={ef.dir} onChange={e=>setEf(p=>({...p,dir:e.target.value}))} placeholder="Av. Principal 123, Santiago"/></FG>
      <FG label="Color de impresos">
        <FSl value={ef.printColor||"#172554"} onChange={e=>setEf(p=>({...p,printColor:e.target.value}))}>
          {PRINT_COLORS.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </FSl>
      </FG>
      <div style={{padding:"12px 14px",border:"1px solid var(--bdr2)",borderRadius:10,background:"var(--card2)",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"var(--wh)",marginBottom:10}}>Información bancaria / datos de pago</div>
        <R2>
          <FG label="Titular"><FI value={ef.paymentHolder||""} onChange={e=>setEf(p=>({...p,paymentHolder:e.target.value}))} placeholder="Razón social o titular"/></FG>
          <FG label="RUT para pagos"><FI value={ef.paymentRut||""} onChange={e=>setEf(p=>({...p,paymentRut:e.target.value}))} placeholder="78.118.348-2"/></FG>
        </R2>
        <R2>
          <FG label="Banco"><FI value={ef.paymentBank||""} onChange={e=>setEf(p=>({...p,paymentBank:e.target.value}))} placeholder="Banco de Chile"/></FG>
          <FG label="Tipo de cuenta"><FI value={ef.paymentAccountType||""} onChange={e=>setEf(p=>({...p,paymentAccountType:e.target.value}))} placeholder="Cuenta Corriente"/></FG>
        </R2>
        <R2>
          <FG label="Número de cuenta"><FI value={ef.paymentAccountNumber||""} onChange={e=>setEf(p=>({...p,paymentAccountNumber:e.target.value}))} placeholder="123456789"/></FG>
          <FG label="Correo para comprobantes"><FI value={ef.paymentEmail||""} onChange={e=>setEf(p=>({...p,paymentEmail:e.target.value}))} placeholder="pagos@empresa.cl"/></FG>
        </R2>
        <FG label="Notas adicionales de pago"><FTA value={ef.paymentNotes||""} onChange={e=>setEf(p=>({...p,paymentNotes:e.target.value}))} placeholder="Instrucciones extra para pagos o comprobantes."/></FG>
      </div>
      <FG label="Información bancaria adicional"><FTA value={ef.bankInfo||""} onChange={e=>setEf(p=>({...p,bankInfo:e.target.value}))} placeholder="Texto adicional opcional que también quieras mostrar en documentos."/></FG>
      <div style={{marginTop:12}}>
        <div style={{fontSize:11,fontWeight:600,color:"var(--gr3)",marginBottom:8}}>Módulos activos</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {(empresa.addons||[]).length ? (empresa.addons||[]).map(key=><Badge key={key} label={addons[key]?.label||key} color="gray" sm/>) : <span style={{fontSize:11,color:"var(--gr2)"}}>Sin módulos activos</span>}
        </div>
        <div style={{fontSize:11,color:"var(--gr2)",marginTop:8}}>La activación y desactivación de módulos se administra desde Torre de Control.</div>
      </div>
      <div style={{ display:"flex", gap:8, marginTop:8 }}>
        <Btn onClick={save}>✓ Guardar</Btn>
        <GBtn onClick={() => setEditing(false)}>Cancelar</GBtn>
      </div>
    </div>
  );
}

export function ThemeSettingsPanel({ lt, setLt, themePresets, onSaveTheme, ntf }) {
  return <div>
    <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 14 }}>Selecciona un preset visual curado para tu instancia. Conserva la identidad de Produ y evita combinaciones de color poco legibles.</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
      {Object.entries(themePresets).map(([key,preset])=>{
        const swatch=preset[lt.mode||"dark"]||preset.dark;
        const active=(lt.preset||"clasico")===key;
        return <button key={key} onClick={e=>{e.stopPropagation();setLt({...swatch,preset:key,mode:lt.mode||"dark"});}} style={{textAlign:"left",padding:"14px 16px",borderRadius:12,border:`1px solid ${active?"var(--cy)":"var(--bdr2)"}`,background:active?"linear-gradient(180deg,var(--cg),transparent)":"var(--sur)",cursor:"pointer"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,color:"var(--wh)"}}>{preset.label}</div>
            {active&&<Badge label="Activo" color="cyan" sm/>}
          </div>
          <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10,lineHeight:1.4}}>{preset.description}</div>
          <div style={{display:"flex",gap:8}}>
            {[swatch.bg,swatch.surface,swatch.card,swatch.accent].map((c, index)=><span key={`${key}-${index}-${c}`} style={{width:24,height:24,borderRadius:8,background:c,border:"1px solid var(--bdr2)"}}/>)}
          </div>
        </button>;
      })}
    </div>
    <FG label="Modo visual">
      <FSl value={lt.mode||"dark"} onChange={e=>{
        const mode=e.target.value;
        const presetKey=lt.preset||"clasico";
        const preset=themePresets[presetKey]||themePresets.clasico;
        setLt({...preset[mode],preset:presetKey,mode});
      }}>
        <option value="dark">Dark</option>
        <option value="light">Light</option>
      </FSl>
    </FG>
    <div style={{fontSize:11,color:"var(--gr2)",marginBottom:14}}>Los presets son fijos para mantener consistencia visual. Si más adelante quieres, podemos sumar nuevos estilos sin reabrir el selector libre de colores.</div>
    <div style={{display:"flex",gap:8}}>
      <button onClick={e=>{e.stopPropagation();e.preventDefault();onSaveTheme(lt);ntf("Tema aplicado ✓");}} style={{padding:"9px 18px",borderRadius:6,border:"none",background:"var(--cy)",color:"var(--bg)",cursor:"pointer",fontSize:12,fontWeight:700}}>✓ Aplicar</button>
      <button onClick={e=>{e.stopPropagation();const dt={...themePresets.clasico.dark,preset:"clasico",mode:"dark"};setLt(dt);onSaveTheme(dt);ntf("Produ Clásico Dark");}} style={{padding:"9px 14px",borderRadius:6,border:"1px solid var(--bdr2)",background:"transparent",color:"var(--gr3)",cursor:"pointer",fontSize:12,fontWeight:600}}>Reset clásico</button>
    </div>
  </div>;
}

export function TransactionalEmailTemplatesPanel({
  empresa,
  empresas,
  saveEmpresas,
  ntf,
  canManageAdmin = true,
}) {
  const definitions = React.useMemo(() => getTransactionalEmailTemplateDefinitions(), []);
  const [activeKey, setActiveKey] = React.useState(definitions[0]?.key || "billing_invoice_collection");
  const [form, setForm] = React.useState({ subject: "", body: "" });
  const templateVarPresets = React.useMemo(() => ({
    billing_invoice_collection: {
      contactName: "Finanzas Cliente",
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      documentNumber: "F-1024",
      totalFormatted: "$1.250.000",
      dueDate: "30/04/2026",
      entityLabel: "Play Media SpA",
    },
    invoice_manual_delivery: {
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      entityLabel: "Play Media SpA",
      issueDate: "13/04/2026",
      documentNumber: "F-1024",
      totalFormatted: "$1.250.000",
      pendingFormatted: "$1.250.000",
      dueDate: "30/04/2026",
      currency: "CLP",
    },
    billing_statement: {
      contactName: "Finanzas Cliente",
      entityLabel: "Play Media SpA",
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      documentLines: "- F-1024 · $1.250.000 · Pendiente de pago · vence 30/04/2026",
      pendingTotalFormatted: "$1.250.000",
      bankInfo: "Banco · Cuenta corriente · 123456789",
    },
    crm_followup: {
      contactName: "Matías",
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      companyLabel: "Play Media SpA",
      opportunityName: "propuesta comercial abril",
    },
    client_contact: {
      contactName: "Matías",
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      messageBody: "Queríamos tomar contacto para dar continuidad a la gestión.",
    },
    payables_supplier_contact: {
      contactName: "Proveedor",
      companyName: empresa?.nombre || empresa?.nom || "Produ",
      supplierName: "Servicios Post Uno",
      documentNumber: "SPU-882",
      paymentDate: "20/04/2026",
      totalFormatted: "$720.000",
    },
    password_reset: {
      contactName: "Usuario Produ",
      resetInstructions: "Usa el link seguro de recuperación para restablecer tu clave.",
    },
    access_updated: {
      contactName: "Usuario Produ",
      accessInstructions: "Tu acceso fue actualizado. Revisa tus nuevas credenciales.",
    },
  }), [empresa?.nombre, empresa?.nom]);

  React.useEffect(() => {
    const definition = getTransactionalEmailTemplateDefinition(activeKey);
    const tenantTemplates = getTenantTransactionalEmailTemplates(empresa);
    const current = tenantTemplates?.[activeKey] || {};
    setForm({
      subject: current.subject || definition?.defaultSubject || "",
      body: current.body || definition?.defaultBody || "",
    });
  }, [activeKey, empresa]);

  const saveTemplate = () => {
    if (!canManageAdmin) return;
    const currentTemplates = getTenantTransactionalEmailTemplates(empresa);
    const nextTemplates = {
      ...currentTemplates,
      [activeKey]: {
        subject: String(form.subject || "").trim(),
        body: String(form.body || "").trim(),
      },
    };
    saveEmpresas((empresas || []).map(item => item.id === empresa?.id ? { ...item, emailTemplates: nextTemplates } : item));
    ntf?.("Template de correo guardado ✓");
  };

  const resetTemplate = () => {
    const definition = getTransactionalEmailTemplateDefinition(activeKey);
    setForm({
      subject: definition?.defaultSubject || "",
      body: definition?.defaultBody || "",
    });
  };

  const activeDefinition = getTransactionalEmailTemplateDefinition(activeKey);
  const activeVars = templateVarPresets[activeKey] || {};
  const previewTemplate = React.useMemo(() => resolveTransactionalEmailTemplate({
    ...(empresa || {}),
    emailTemplates: {
      ...getTenantTransactionalEmailTemplates(empresa),
      [activeKey]: {
        subject: form.subject,
        body: form.body,
      },
    },
  }, activeKey, activeVars), [activeKey, activeVars, empresa, form.body, form.subject]);
  const variableKeys = React.useMemo(() => {
    const found = new Set();
    [form.subject, form.body, activeDefinition?.defaultSubject || "", activeDefinition?.defaultBody || ""].forEach(source => {
      String(source || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        found.add(String(key));
        return "";
      });
    });
    return Array.from(found);
  }, [activeDefinition?.defaultBody, activeDefinition?.defaultSubject, form.body, form.subject]);

  return <div>
    <div style={{ fontSize: 12, color: "var(--gr2)", marginBottom: 14 }}>
      Ajusta los presets de correo de este tenant. El pie institucional se agrega automáticamente al enviar: <b>Correo creado con ♥ por Produ</b> con link a `produ.cl`.
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
      <Card title="Templates">
        <div style={{ display: "grid", gap: 8 }}>
          {definitions.map(def => {
            const active = def.key === activeKey;
            return <button key={def.key} onClick={() => setActiveKey(def.key)} style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: `1px solid ${active ? "var(--cy)" : "var(--bdr2)"}`, background: active ? "color-mix(in srgb, var(--cy) 10%, transparent)" : "var(--sur)", cursor: "pointer" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--wh)", marginBottom: 4 }}>{def.label}</div>
              <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.45 }}>{def.description}</div>
            </button>;
          })}
        </div>
      </Card>
      <Card title={activeDefinition?.label || "Template"} sub={activeDefinition?.description || ""}>
        <FG label="Asunto base">
          <FI value={form.subject} onChange={e => setForm(prev => ({ ...prev, subject: e.target.value }))} placeholder="Asunto del correo" />
        </FG>
        <FG label="Cuerpo base">
          <textarea value={form.body} onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))} rows={12} placeholder="Escribe el cuerpo base del correo" style={{ width: "100%", resize: "vertical", padding: "12px 14px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", outline: "none", fontFamily: "inherit", fontSize: 13, lineHeight: 1.55 }} />
        </FG>
        <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--card2)", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wh)", marginBottom: 8 }}>Variables disponibles</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            {variableKeys.length
              ? variableKeys.map(key => <Badge key={key} label={`{{${key}}}`} color="gray" sm />)
              : <span style={{ fontSize: 11, color: "var(--gr2)" }}>Este template no usa variables dinámicas.</span>}
          </div>
          {!!variableKeys.length && <div style={{ display: "grid", gap: 6 }}>
            {variableKeys.map(key => <div key={`sample-${key}`} style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.45 }}>
              <b style={{ color: "var(--wh)" }}>{`{{${key}}}`}</b>: {String(activeVars[key] || "Sin ejemplo")}
            </div>)}
          </div>}
        </div>
        <div style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--sur)", marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--wh)", marginBottom: 8 }}>Vista previa</div>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 6 }}>Asunto</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--wh)", marginBottom: 12 }}>{previewTemplate.subject || "Sin asunto"}</div>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 6 }}>Mensaje</div>
          <div style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{previewTemplate.body || "Sin contenido"}</div>
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--bdr2)", fontSize: 11, color: "var(--gr2)" }}>{previewTemplate.footerNote}</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn onClick={saveTemplate}>Guardar template</Btn>
          <GBtn onClick={resetTemplate}>Restaurar default</GBtn>
        </div>
      </Card>
    </div>
  </div>;
}

export function UsersAdminSection({
  uq, setUq, uRole, setURole, uState, setUState, roleOptions, empresa, filteredUsers, ini, getRoleConfig,
  userGoogleCalendar, setUid2, setUf, resetAccess, toggleUserActive, deleteUser, uid2, uf, editableRoleOptions,
  saveUser, canManageAdmin,
}) {
  return <div>
    <div style={{display:"flex",gap:10,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <SearchBar value={uq} onChange={setUq} placeholder="Buscar usuario por nombre o email..."/>
      <FilterSel value={uRole} onChange={setURole} options={roleOptions(empresa)} placeholder="Todos los roles"/>
      <FilterSel value={uState} onChange={setUState} options={[{value:"active",label:"Activos"},{value:"inactive",label:"Inactivos"}].map(o=>o.label)} placeholder="Todos los estados"/>
    </div>
    <div style={{marginBottom:14}}>
      {filteredUsers.map(u=>{
        const restrictedBySuper = u.role==="superadmin";
        return <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"var(--sur)",border:"1px solid var(--bdr)",borderRadius:6,marginBottom:6}}>
          <div style={{width:28,height:28,background:"linear-gradient(135deg,var(--cy),var(--cy2))",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"var(--bg)",flexShrink:0}}>{ini(u.name)}</div>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{u.name}</div><div style={{fontSize:11,color:"var(--gr2)"}}>{u.email}</div></div>
          <Badge label={getRoleConfig(u.role, empresa).label} color={getRoleConfig(u.role, empresa).badge} sm/>
          {u.isCrew&&<Badge label={u.crewRole||"Crew"} color="cyan" sm/>}
          <Badge label={u.active?"Activo":"Inactivo"} color={u.active?"green":"red"} sm/>
          <Badge label={userGoogleCalendar(u).connected?"Google conectado":"Sin Google"} color={userGoogleCalendar(u).connected?"cyan":"gray"} sm/>
          {restrictedBySuper ? <Badge label="Gestiona Torre de Control" color="purple" sm/> : <>
            <GBtn sm onClick={()=>{setUid2(u.id);setUf({...u,password:""});}} s={{minWidth:74}}>Editar</GBtn>
            <GBtn sm onClick={()=>resetAccess(u)}>🔐 Reset</GBtn>
            <GBtn sm onClick={()=>toggleUserActive(u)}>{u.active?"Desactivar":"Activar"}</GBtn>
            {u.role!=="superadmin"&&<DBtn onClick={()=>{ if(!confirm(`¿Eliminar a ${u.name || "este usuario"}?`)) return; deleteUser(u); }} sm>Eliminar</DBtn>}
          </>}
        </div>;
      })}
      {!filteredUsers.length&&<Empty text="Sin usuarios para este filtro"/>}
    </div>
    <div style={{background:"var(--card2)",border:"1px solid var(--bdr2)",borderRadius:8,padding:16}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",marginBottom:14,flexWrap:"wrap"}}>
        <div>
          <div style={{fontFamily:"var(--fh)",fontSize:13,fontWeight:700,marginBottom:4}}>{uid2?"Editar usuario":"Agregar usuario"}</div>
          <div style={{fontSize:11,color:"var(--gr2)"}}>
            {uid2 ? "Modifica nombre, correo, rol, estado o acceso de este usuario del tenant." : "Crea un nuevo usuario para esta empresa y asígnale un rol disponible dentro del tenant."}
          </div>
        </div>
        {uid2&&<Badge label={`Editando ${uf.name || "usuario"}`} color="cyan" sm/>}
      </div>
      <R2><FG label="Nombre"><FI value={uf.name||""} onChange={e=>setUf(p=>({...p,name:e.target.value}))} placeholder="Juan Pérez"/></FG><FG label="Email"><FI type="email" value={uf.email||""} onChange={e=>setUf(p=>({...p,email:e.target.value}))} placeholder="juan@empresa.cl"/></FG></R2>
      <R3><FG label="Contraseña"><FI type="password" value={uf.password||""} onChange={e=>setUf(p=>({...p,password:e.target.value}))} placeholder={uid2?"Nueva contraseña opcional":"Contraseña inicial"}/></FG><FG label="Rol"><FSl value={editableRoleOptions.some(o=>o.value===(uf.role||"viewer"))?(uf.role||"viewer"):(editableRoleOptions[0]?.value||"viewer")} onChange={e=>setUf(p=>({...p,role:e.target.value}))}>{editableRoleOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</FSl></FG><FG label="Estado"><FSl value={uf.active===false?"false":"true"} onChange={e=>setUf(p=>({...p,active:e.target.value==="true"}))}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG></R3>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:10}}>
        <label style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"var(--gr3)",paddingTop:10}}>
          <input type="checkbox" checked={uf.isCrew===true} onChange={e=>setUf(p=>({...p,isCrew:e.target.checked,crewRole:e.target.checked?(p.crewRole||"Crew interno"):""}))}/>
          Este usuario pertenece al crew interno
        </label>
        {uf.isCrew===true&&<FG label="Cargo en crew"><FI value={uf.crewRole||""} onChange={e=>setUf(p=>({...p,crewRole:e.target.value}))} placeholder="Ej: Productor Ejecutivo, Editor, Community Manager"/></FG>}
      </div>
      <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10}}>Puedes dejar la contraseña vacía al editar si no quieres cambiar el acceso. Las cuentas `Admin` y `Super Admin` solo se crean o gestionan desde `Torre de Control &gt; Usuarios del sistema`.</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <Btn onClick={saveUser}>{uid2?"Guardar cambios":"Crear usuario"}</Btn>
        {uid2&&<GBtn onClick={()=>{setUid2(null);setUf({});}}>Cancelar edición</GBtn>}
      </div>
    </div>
  </div>;
}

export function PlatformFoundationPanel({
  planIdentityPromotions,
  platformPlanning,
  prepareIdentityMembershipBlueprints,
  platformPreparingMemberships,
  prepareMembershipTransitionQueue,
  platformQueueingMemberships,
  refreshPlatformSnapshot,
  platformLoading,
  platformSnapshot,
  remoteProvisionedModules,
  addons,
  identityHealthLabel,
  identityHealthColor,
  identityUsersAligned,
  identityRolesAligned,
  empUsers,
  remoteUserShadowCount,
  localCustomRoleCount,
  remoteCustomRoleCount,
  remoteIdentityCandidateCount,
  remoteBlueprintCount,
  remoteQueueCount,
  bsaleGovernanceMode,
  tenantBsaleConfig,
  remoteBsaleSnapshot,
  tenantCanEditBsaleConfig,
  empresa,
  getRoleConfig,
}) {
  return <div>
    <div style={{fontSize:12,color:"var(--gr2)",marginBottom:14}}>Esta vista muestra el estado remoto del tenant dentro de Supabase foundation. Es solo de inspección y nos ayuda a validar la migración backend sin tocar productivo.</div>
    <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
      <Btn onClick={planIdentityPromotions} disabled={platformPlanning}>{platformPlanning ? "Generando ruta..." : "Generar ruta de promoción"}</Btn>
      <GBtn onClick={prepareIdentityMembershipBlueprints} disabled={platformPreparingMemberships}>{platformPreparingMemberships ? "Preparando..." : "Preparar membresías"}</GBtn>
      <GBtn onClick={prepareMembershipTransitionQueue} disabled={platformQueueingMemberships}>{platformQueueingMemberships ? "Armando cola..." : "Preparar cola de transición"}</GBtn>
      <GBtn onClick={refreshPlatformSnapshot} disabled={platformLoading}>{platformLoading ? "Actualizando..." : "Actualizar snapshot"}</GBtn>
    </div>
    {platformLoading
      ? <Card title="Foundation remota"><div style={{fontSize:12,color:"var(--gr2)"}}>Cargando estado remoto…</div></Card>
      : platformSnapshot
        ? <div style={{display:"grid",gap:14}}>
            <Card title="Tenant remoto" sub="Estado principal en Supabase">
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
                <KV label="Tenant code" value={platformSnapshot?.tenant?.tenant_code || "—"} />
                <KV label="Estado" value={platformSnapshot?.tenant?.status || "—"} />
                <KV label="Activo" value={platformSnapshot?.tenant?.active ? "Sí" : "No"} />
                <KV label="Billing status" value={platformSnapshot?.tenant?.billing_status || "—"} />
                <KV label="Currency" value={platformSnapshot?.tenant?.billing_currency || "—"} />
                <KV label="Billing monthly" value={platformSnapshot?.tenant?.billing_monthly ?? "—"} />
              </div>
              <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--bdr2)"}}>
                <div style={{fontSize:11,color:"var(--gr2)",marginBottom:8}}>Módulos provisionados remotamente</div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {remoteProvisionedModules.length
                    ? remoteProvisionedModules.map(key => <Badge key={key} label={addons[key]?.label || key} color="gray" sm />)
                    : <span style={{fontSize:11,color:"var(--gr2)"}}>Foundation todavía no expone módulos provisionados para este tenant o aún no fueron sincronizados.</span>}
                </div>
              </div>
            </Card>
            <Card title="Consistencia de identidad" sub="Compara lo que vive hoy en el tenant con lo que foundation ya reconoce.">
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                <Badge label={`Estado ${identityHealthLabel}`} color={identityHealthColor} sm />
                <Badge label={identityUsersAligned ? "Usuarios alineados" : "Usuarios por revisar"} color={identityUsersAligned ? "green" : "yellow"} sm />
                <Badge label={identityRolesAligned ? "Roles alineados" : "Roles por revisar"} color={identityRolesAligned ? "green" : "yellow"} sm />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10}}>
                <KV label="Usuarios locales" value={empUsers.length} />
                <KV label="Shadows remotos" value={remoteUserShadowCount} />
                <KV label="Roles custom locales" value={localCustomRoleCount} />
                <KV label="Roles custom remotos" value={remoteCustomRoleCount} />
                <KV label="Identity candidates" value={remoteIdentityCandidateCount} />
                <KV label="Blueprints / cola" value={`${remoteBlueprintCount} / ${remoteQueueCount}`} />
              </div>
            </Card>
            <Card title="Motor tributario" sub="Estado operativo visible para el tenant. La provisión comercial se gobierna desde Torre de Control.">
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:10,marginBottom:12}}>
                <KV label="Provisionamiento" value={bsaleGovernanceMode === "production" ? "Producción" : bsaleGovernanceMode === "sandbox" ? "Sandbox" : "Desactivado"} />
                <KV label="Estado" value={tenantBsaleConfig?.status || "draft"} />
                <KV label="Origen actual" value={tenantBsaleConfig?.source === "tenant" ? "Tenant" : tenantBsaleConfig?.source === "governed" ? "Torre de Control" : tenantBsaleConfig?.source === "environment" ? "Fallback env" : "Sin credenciales"} />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginBottom:12}}>
                <KV label="Office id" value={tenantBsaleConfig?.officeId || "—"} />
                <KV label="Document type id" value={tenantBsaleConfig?.documentTypeId || "—"} />
                <KV label="Price list id" value={tenantBsaleConfig?.priceListId || "—"} />
                <KV label="Token provisionado" value={tenantBsaleConfig?.token ? "Sí" : "No"} />
              </div>
              <div style={{border:"1px solid var(--bdr2)",borderRadius:12,padding:"12px 14px",background:"var(--sur)",marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:"var(--wh)",marginBottom:4}}>Foundation remota</div>
                <div style={{fontSize:11,color:"var(--gr2)",marginBottom:10}}>Estado que hoy reconoce Supabase para este motor tributario.</div>
                {remoteBsaleSnapshot
                  ? <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10}}>
                      <KV label="Provisionamiento remoto" value={remoteBsaleSnapshot.governanceMode === "production" ? "Producción" : remoteBsaleSnapshot.governanceMode === "sandbox" ? "Sandbox" : "Desactivado"} />
                      <KV label="Estado remoto" value={remoteBsaleSnapshot.status || "draft"} />
                      <KV label="Office id remoto" value={remoteBsaleSnapshot.officeId || "—"} />
                      <KV label="Document type remoto" value={remoteBsaleSnapshot.documentTypeId || "—"} />
                      <KV label="Price list remota" value={remoteBsaleSnapshot.priceListId || "—"} />
                      <KV label="Token remoto provisionado" value={remoteBsaleSnapshot.tokenConfigured ? "Sí" : "No"} />
                    </div>
                  : <div style={{fontSize:11,color:"var(--gr2)"}}>Foundation todavía no expone detalle remoto del motor tributario para este tenant o el snapshot aún no fue sincronizado.</div>}
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                <Badge label={bsaleGovernanceMode === "disabled" ? "No provisionada" : "Provisionada"} color={bsaleGovernanceMode === "disabled" ? "gray" : "green"} sm />
                <Badge label={tenantCanEditBsaleConfig ? "Edición local habilitada" : "Solo lectura en tenant"} color={tenantCanEditBsaleConfig ? "cyan" : "purple"} sm />
              </div>
              <div style={{fontSize:11,color:"var(--gr2)"}}>Este tenant puede operar documentos electrónicos solo si la integración fue provisionada desde Torre de Control. Aquí mostramos estado operativo y credenciales visibles, pero la activación comercial y el entorno se gobiernan arriba para no mezclar operación con gobierno SaaS.</div>
            </Card>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card title="Roles custom remotos" sub={`${(platformSnapshot?.customRoles||[]).length} registrados`}>
                <div style={{display:"grid",gap:8}}>
                  {(platformSnapshot?.customRoles||[]).map(role => <div key={role.key} style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                      <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{role.label}</div>
                      <Badge label={role.badge || "gray"} color={role.badge || "gray"} sm/>
                    </div>
                    <div style={{fontSize:11,color:"var(--gr2)",marginTop:6}}>{(role.permissions||[]).join(", ") || "Sin permisos"}</div>
                  </div>)}
                  {!(platformSnapshot?.customRoles||[]).length&&<div style={{fontSize:11,color:"var(--gr2)"}}>Sin roles custom remotos.</div>}
                </div>
              </Card>
              <Card title="Usuarios shadow remotos" sub={`${(platformSnapshot?.userShadows||[]).length} sincronizados`}>
                <div style={{display:"grid",gap:8}}>
                  {(platformSnapshot?.userShadows||[]).map(userShadow => <div key={userShadow.id} style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{userShadow.name}</div>
                        <div style={{fontSize:11,color:"var(--gr2)"}}>{userShadow.email}</div>
                      </div>
                      <Badge label={userShadow.active ? "Activo" : "Inactivo"} color={userShadow.active ? "green" : "red"} sm/>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      <Badge label={getRoleConfig(userShadow.role, empresa).label} color={getRoleConfig(userShadow.role, empresa).badge} sm/>
                      {userShadow.isCrew&&<Badge label={userShadow.crewRole || "Crew"} color="cyan" sm/>}
                    </div>
                  </div>)}
                  {!(platformSnapshot?.userShadows||[]).length&&<div style={{fontSize:11,color:"var(--gr2)"}}>Sin usuarios shadow remotos.</div>}
                </div>
              </Card>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <Card title="Identity candidates" sub={`${(platformSnapshot?.identityCandidates||[]).length} preparados para futura identidad`}>
                <div style={{display:"grid",gap:8}}>
                  {(platformSnapshot?.identityCandidates||[]).map(candidate => <div key={candidate.id} style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{candidate.name}</div>
                        <div style={{fontSize:11,color:"var(--gr2)"}}>{candidate.email}</div>
                      </div>
                      <Badge label={candidate.status || "pending"} color={candidate.status === "ready" ? "green" : "yellow"} sm/>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      <Badge label={getRoleConfig(candidate.role, empresa).label} color={getRoleConfig(candidate.role, empresa).badge} sm/>
                      {candidate.isCrew&&<Badge label={candidate.crewRole || "Crew"} color="cyan" sm/>}
                    </div>
                  </div>)}
                  {!(platformSnapshot?.identityCandidates||[]).length&&<div style={{fontSize:11,color:"var(--gr2)"}}>Sin identity candidates remotos.</div>}
                </div>
              </Card>
              <Card title="Ruta de promoción" sub="Ruta remota para la futura promoción a profiles / tenant_users">
                <div style={{display:"grid",gap:8}}>
                  {(platformSnapshot?.promotionPlans||[]).map(plan => <div key={plan.id} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${plan.status==="ready"?"rgba(0,224,138,.35)":"var(--bdr2)"}`,background:plan.status==="ready"?"rgba(0,224,138,.08)":"var(--sur)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{plan.name}</div>
                        <div style={{fontSize:11,color:"var(--gr2)"}}>{plan.email || "Sin email definido"}</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                        <Badge label={plan.status === "ready" ? "Listo" : "Incompleto"} color={plan.status === "ready" ? "green" : "yellow"} sm/>
                        <Badge label={`Score ${plan.readinessScore ?? 0}/4`} color={(plan.readinessScore ?? 0) >= 4 ? "green" : "gray"} sm/>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                      <Badge label={getRoleConfig(plan.role, empresa).label} color={getRoleConfig(plan.role, empresa).badge} sm/>
                      {(plan.missingRequirements || []).length ? (plan.missingRequirements || []).map(req => <Badge key={req} label={String(req).replaceAll("_"," ")} color="red" sm/>) : <Badge label="Sin bloqueos" color="green" sm/>}
                    </div>
                  </div>)}
                  {!(platformSnapshot?.promotionPlans||[]).length&&<div style={{fontSize:11,color:"var(--gr2)"}}>Aún no generas una ruta remota. Úsala para validar readiness antes de tocar auth real.</div>}
                </div>
              </Card>
            </div>
            <Card title="Membership blueprints" sub="Capa transicional antes de crear profiles / tenant_users reales">
              <div style={{display:"grid",gap:8}}>
                {(platformSnapshot?.membershipBlueprints||[]).map(blueprint => <div key={blueprint.id} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${blueprint.status==="prepared"?"rgba(0,224,138,.35)":"var(--bdr2)"}`,background:blueprint.status==="prepared"?"rgba(0,224,138,.08)":"var(--sur)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{blueprint.name}</div>
                      <div style={{fontSize:11,color:"var(--gr2)"}}>{blueprint.email || "Sin email definido"}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      <Badge label={blueprint.status === "prepared" ? "Preparado" : "Bloqueado"} color={blueprint.status === "prepared" ? "green" : "yellow"} sm/>
                      <Badge label={blueprint.sourcePlanStatus || "incomplete"} color={blueprint.sourcePlanStatus === "ready" ? "green" : "gray"} sm/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                    <Badge label={getRoleConfig(blueprint.role, empresa).label} color={getRoleConfig(blueprint.role, empresa).badge} sm/>
                    {((blueprint.metadata?.missingRequirements) || []).length ? (blueprint.metadata?.missingRequirements || []).map(req => <Badge key={req} label={String(req).replaceAll("_"," ")} color="red" sm/>) : <Badge label="Listo para membresía" color="green" sm/>}
                  </div>
                </div>)}
                {!(platformSnapshot?.membershipBlueprints||[]).length&&<div style={{fontSize:11,color:"var(--gr2)"}}>Aún no hay blueprints. Prepara esta capa antes de abrir `profiles / tenant_users` reales.</div>}
              </div>
            </Card>
            <Card title="Membership transition queue" sub="Cola previa a crear profiles y memberships reales">
              <div style={{display:"grid",gap:8}}>
                {(platformSnapshot?.membershipTransitionQueue||[]).map(item => <div key={item.id} style={{padding:"10px 12px",borderRadius:12,border:`1px solid ${item.status==="pending_profile"?"rgba(0,224,138,.35)":"var(--bdr2)"}`,background:item.status==="pending_profile"?"rgba(0,224,138,.08)":"var(--sur)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center"}}>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{item.name}</div>
                      <div style={{fontSize:11,color:"var(--gr2)"}}>{item.email || "Sin email definido"}</div>
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
                      <Badge label={item.status === "pending_profile" ? "Listo para profile" : "Bloqueado"} color={item.status === "pending_profile" ? "green" : "yellow"} sm/>
                      <Badge label={item.sourceBlueprintStatus || "blocked"} color={item.sourceBlueprintStatus === "prepared" ? "green" : "gray"} sm/>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
                    <Badge label={getRoleConfig(item.role, empresa).label} color={getRoleConfig(item.role, empresa).badge} sm/>
                    <Badge label={item.metadata?.nextStep || "resolve_blockers"} color={item.status === "pending_profile" ? "cyan" : "red"} sm/>
                  </div>
                </div>)}
                {!(platformSnapshot?.membershipTransitionQueue||[]).length&&<div style={{fontSize:11,color:"var(--gr2)"}}>Aún no hay cola de transición. Este será el paso inmediato antes de crear `profiles / tenant_users`.</div>}
              </div>
            </Card>
            <Card title="Últimos audit logs" sub="Trazabilidad server-side de foundation">
              <div style={{display:"grid",gap:8}}>
                {(platformSnapshot?.auditLogs||[]).map(log => <div key={log.id} style={{padding:"10px 12px",borderRadius:12,border:"1px solid var(--bdr2)",background:"var(--sur)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,alignItems:"center",marginBottom:4}}>
                    <div style={{fontSize:12,fontWeight:700,color:"var(--wh)"}}>{log.action}</div>
                    <div style={{fontSize:10,color:"var(--gr2)"}}>{log.createdAt ? new Date(log.createdAt).toLocaleString("es-CL") : "—"}</div>
                  </div>
                  <div style={{fontSize:11,color:"var(--gr2)"}}>{log.entityType} · {log.entityId || "sin id"}</div>
                </div>)}
                {!(platformSnapshot?.auditLogs||[]).length&&<div style={{fontSize:11,color:"var(--gr2)"}}>Sin audit logs remotos aún.</div>}
              </div>
            </Card>
          </div>
        : <Card title="Foundation remota"><div style={{fontSize:12,color:"var(--gr2)"}}>No pudimos cargar el estado remoto de Supabase para este tenant.</div></Card>}
  </div>;
}

export function DangerZonePanel({ releaseMode = false, onPurge }) {
  return <div>
    <div style={{fontSize:12,color:"var(--gr2)",marginBottom:14}}>Acciones sobre la base de datos de esta empresa.</div>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      {!releaseMode ? <GBtn onClick={onPurge}>🔄 Restaurar / limpiar datos</GBtn> : <div style={{fontSize:12,color:"var(--gr2)"}}>La limpieza masiva queda bloqueada en release mode.</div>}
    </div>
  </div>;
}
