import { Btn, Card, Empty, FG, FI, FSl, FilterSel, GBtn } from "../../lib/ui/components";

export function ComunicacionesAdminPanel({
  empresas,
  commEmpId,
  setCommEmpId,
  selectedCommEmp,
  bannerForm,
  setBannerForm,
  onSave,
  SYSTEM_MESSAGE_PRESETS,
  applySystemPreset,
  wrapSystemSelection,
  insertSystemBlock,
  sysMsgBodyRef,
  FTA,
  sysMsg,
  setSysMsg,
  RichTextBlock,
  publishSystemMessage,
  removeSystemMessage,
  fmtD,
  XBtn,
  saveBanner,
}) {
  const TextArea = FTA;
  const RemoveButton = XBtn;

  return <div>
    <div style={{ fontSize: 12, color: "var(--gr3)", marginBottom: 14 }}>Mensajes visibles para todos los usuarios del tenant y banner global de avisos importantes.</div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
      <FilterSel value={commEmpId} onChange={v => {
        setCommEmpId(v);
        const emp = (empresas || []).find(e => e.id === v) || (empresas || [])[0] || null;
        setBannerForm(emp?.systemBanner || { active: false, tone: "info", text: "" });
      }} options={(empresas || []).map(e => ({ value: e.id, label: e.nombre }))} placeholder="Selecciona una empresa" />
    </div>
    {selectedCommEmp ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 16 }}>
      <Card title="Mensajes del sistema" sub={selectedCommEmp.nombre}>
        <FG label="Título"><FI value={sysMsg.title || ""} onChange={e => setSysMsg(p => ({ ...p, title: e.target.value }))} placeholder="Mantenimiento programado" /></FG>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>Mensajes preset</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {SYSTEM_MESSAGE_PRESETS.map(preset => <button key={preset.id} onClick={() => applySystemPreset(preset)} style={{ padding: "8px 10px", borderRadius: 999, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              {preset.label}
            </button>)}
          </div>
        </div>
        <FG label="Mensaje">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            <button onClick={() => wrapSystemSelection("**", "**")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>B</button>
            <button onClick={() => wrapSystemSelection("*", "*")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--wh)", fontSize: 11, fontStyle: "italic", cursor: "pointer" }}>I</button>
            <button onClick={() => insertSystemBlock("- ")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Lista</button>
            <button onClick={() => insertSystemBlock("**Título breve**")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Título</button>
            <button onClick={() => wrapSystemSelection("[", "](https://)")} style={{ padding: "7px 10px", borderRadius: 10, border: "1px solid var(--bdr2)", background: "var(--sur)", color: "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Link</button>
          </div>
          <TextArea ref={sysMsgBodyRef} value={sysMsg.body || ""} onChange={e => setSysMsg(p => ({ ...p, body: e.target.value }))} placeholder="Este es un mensaje visible para todos los usuarios de la empresa. Usa **negrita**, *cursiva* o [texto](https://enlace.com)." />
        </FG>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--bdr2)", background: "var(--sur)", marginBottom: 14 }}>
          <div style={{ fontSize: 10, color: "var(--gr2)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>Vista previa</div>
          <RichTextBlock text={sysMsg.body || "Aquí verás cómo se mostrará el mensaje."} style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.55 }} color="var(--gr3)" />
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Btn onClick={publishSystemMessage}>Enviar mensaje</Btn>
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {(selectedCommEmp.systemMessages || []).map(msg => <div key={msg.id} style={{ padding: 12, background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>{msg.title}</div>
                <RichTextBlock text={msg.body || ""} style={{ fontSize: 11, color: "var(--gr3)", marginTop: 4, lineHeight: 1.55 }} color="var(--gr3)" />
                <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 6 }}>{msg.createdAt ? fmtD(msg.createdAt) : "—"}</div>
              </div>
              <RemoveButton onClick={() => removeSystemMessage(msg.id)} />
            </div>
          </div>)}
          {!(selectedCommEmp.systemMessages || []).length && <Empty text="Sin mensajes del sistema" />}
        </div>
      </Card>
      <Card title="Banner global" sub="Visible en el portal del tenant">
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--gr3)", marginBottom: 14 }}>
          <input type="checkbox" checked={!!bannerForm.active} onChange={e => setBannerForm(p => ({ ...p, active: e.target.checked }))} />
          Banner activo
        </label>
        <FG label="Tono">
          <FSl value={bannerForm.tone || "info"} onChange={e => setBannerForm(p => ({ ...p, tone: e.target.value }))}>
            <option value="info">Info</option>
            <option value="warn">Advertencia</option>
            <option value="critical">Crítico</option>
          </FSl>
        </FG>
        <FG label="Texto del banner"><TextArea value={bannerForm.text || ""} onChange={e => setBannerForm(p => ({ ...p, text: e.target.value }))} placeholder="Información importante para todos los usuarios de esta empresa." /></FG>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <Btn onClick={saveBanner}>Guardar banner</Btn>
          <GBtn onClick={() => {
            setBannerForm({ active: false, tone: "info", text: "" });
            const next = (empresas || []).map(e => e.id === selectedCommEmp.id ? { ...e, systemBanner: { active: false, tone: "info", text: "" } } : e);
            onSave("empresas", next);
          }}>Desactivar</GBtn>
        </div>
        <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--bdr2)", background: bannerForm.tone === "critical" ? "#ff556615" : bannerForm.tone === "warn" ? "#ffcc4415" : "var(--cg)", color: bannerForm.tone === "critical" ? "#ff5566" : bannerForm.tone === "warn" ? "#ffcc44" : "var(--cy)", fontSize: 12, fontWeight: 700 }}>
          {bannerForm.text || "Vista previa del banner"}
        </div>
      </Card>
    </div> : <Empty text="Selecciona una empresa para comunicarte con ese tenant" />}
  </div>;
}
