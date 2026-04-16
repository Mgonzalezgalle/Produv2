import React, { useEffect, useState } from "react";
import { DEFAULT_LISTAS } from "../../lib/utils/helpers";
import { FG, FI, FSl, FTA, MFoot, Modal, MultiSelect, R2, R3, XBtn } from "../../lib/ui/components";

export function MCli({ open, data, listas, onClose, onSave, uid }) {
  const [f, setF] = useState({});
  const missingBsaleFields = [
    !String(f.nom || "").trim() ? "Razón social / nombre" : null,
    !String(f.rut || "").trim() ? "RUT" : null,
    !String(f.dir || "").trim() ? "Dirección" : null,
    !String(f.ciudad || "").trim() ? "Ciudad" : null,
    !String(f.comuna || "").trim() ? "Comuna / municipio" : null,
  ].filter(Boolean);
  const bsaleReady = missingBsaleFields.length === 0;
  useEffect(() => {
    setF(data?.id ? { ...data } : { nom: "", rut: "", ind: "", dir: "", ciudad: "", comuna: "", giro: "", not: "", contactos: [], creditLimit: "" });
  }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const addContact = () => setF(p => ({ ...p, contactos: [...(p.contactos || []), { id: uid(), nom: "", car: "", ema: "", tel: "", not: "" }] }));
  const updContact = (i, k, v) => setF(p => ({ ...p, contactos: (p.contactos || []).map((c, j) => j === i ? { ...c, [k]: v } : c) }));
  const delContact = i => setF(p => ({ ...p, contactos: (p.contactos || []).filter((_, j) => j !== i) }));
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Cliente" : "Nuevo Cliente"} sub="Empresa o persona" wide>
    <div style={{ marginBottom: 16, padding: "12px 14px", borderRadius: 10, border: `1px solid ${bsaleReady ? "#b9f2d0" : "#ffe2a8"}`, background: bsaleReady ? "#effcf4" : "#fff8e8" }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: bsaleReady ? "#0f8a4b" : "#b7791f", marginBottom: 6 }}>
        {bsaleReady ? "Ficha lista para Bsale" : "Faltan datos para facturación electrónica"}
      </div>
      <div style={{ fontSize: 11, color: "var(--gr2)", lineHeight: 1.45 }}>
        {bsaleReady
          ? "Este cliente ya tiene los campos mínimos para emitir documentos en Bsale."
          : `Completa: ${missingBsaleFields.join(", ")}.`}
      </div>
    </div>
    <R2><FG label="Nombre / Razón Social *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Empresa ABC S.A."/></FG><FG label="RUT"><FI value={f.rut || ""} onChange={e => u("rut", e.target.value)} placeholder="76.543.210-0"/></FG></R2>
    <R2><FG label="Industria"><FSl value={f.ind || ""} onChange={e => u("ind", e.target.value)}><option value="">Seleccionar...</option>{(listas?.industriasCli || DEFAULT_LISTAS.industriasCli).map(o => <option key={o}>{o}</option>)}</FSl></FG><FG label="Giro"><FI value={f.giro || ""} onChange={e => u("giro", e.target.value)} placeholder="Servicios audiovisuales"/></FG></R2>
    <R2><FG label="Dirección"><FI value={f.dir || ""} onChange={e => u("dir", e.target.value)} placeholder="Av. Providencia 123"/></FG><FG label="Ciudad"><FI value={f.ciudad || ""} onChange={e => u("ciudad", e.target.value)} placeholder="Santiago"/></FG></R2>
    <R2><FG label="Comuna / Municipio"><FI value={f.comuna || ""} onChange={e => u("comuna", e.target.value)} placeholder="Providencia"/></FG><FG label="Límite de crédito"><FI type="number" min="0" value={f.creditLimit ?? ""} onChange={e => u("creditLimit", e.target.value)} placeholder="0"/></FG></R2>
    <FG label="Notas"><FTA value={f.not || ""} onChange={e => u("not", e.target.value)} placeholder="Observaciones generales..."/></FG>
    <hr style={{ border: "none", borderTop: "1px solid var(--bdr)", margin: "16px 0" }} />
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <div style={{ fontFamily: "var(--fh)", fontSize: 13, fontWeight: 700 }}>Contactos</div>
      <button onClick={addContact} style={{ padding: "5px 11px", borderRadius: 6, border: "1px solid var(--bdr2)", background: "transparent", color: "var(--gr3)", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+ Agregar Contacto</button>
    </div>
    {(f.contactos || []).map((c, i) => <div key={c.id} style={{ background: "var(--sur)", border: "1px solid var(--bdr2)", borderRadius: 8, padding: 12, marginBottom: 10, position: "relative" }}>
      <div style={{ position: "absolute", top: 8, right: 8 }}><XBtn onClick={() => delContact(i)} /></div>
      <R2><FG label="Nombre"><FI value={c.nom || ""} onChange={e => updContact(i, "nom", e.target.value)} placeholder="Juan Pérez"/></FG><FG label="Cargo"><FI value={c.car || ""} onChange={e => updContact(i, "car", e.target.value)} placeholder="Gerente Marketing"/></FG></R2>
      <R2><FG label="Email"><FI type="email" value={c.ema || ""} onChange={e => updContact(i, "ema", e.target.value)} placeholder="juan@empresa.cl"/></FG><FG label="Teléfono"><FI value={c.tel || ""} onChange={e => updContact(i, "tel", e.target.value)} placeholder="+56 9 1234 5678"/></FG></R2>
      <FG label="Observaciones"><FI value={c.not || ""} onChange={e => updContact(i, "not", e.target.value)} placeholder="Notas sobre este contacto..."/></FG>
    </div>)}
    {!(f.contactos || []).length && <div style={{ textAlign: "center", padding: "14px", color: "var(--gr2)", fontSize: 12, border: "1px dashed var(--bdr2)", borderRadius: 8, marginBottom: 14 }}>Sin contactos. Haz clic en "+ Agregar Contacto"</div>}
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave({ ...f, creditLimit: Number(f.creditLimit || 0) }); }} />
  </Modal>;
}

export function MPro({ open, data, clientes, listas, onClose, onSave }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? { ...data } : { nom: "", cliId: data?.cliId || "", tip: "Podcast", est: "Pre-Producción", ini: "", fin: "", des: "", crewIds: [], comentarios: [] }); }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Proyecto" : "Nuevo Proyecto"} sub="Proyecto audiovisual">
    <FG label="Nombre *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Nombre del proyecto"/></FG>
    <R2><FG label="Cliente"><FSl value={f.cliId || ""} onChange={e => u("cliId", e.target.value)}><option value="">— Sin cliente —</option>{(clientes || []).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG><FG label="Tipo"><FSl value={f.tip || ""} onChange={e => u("tip", e.target.value)}>{(listas?.tiposPro || DEFAULT_LISTAS.tiposPro).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Estado"><FSl value={f.est || ""} onChange={e => u("est", e.target.value)}>{(listas?.estadosPro || DEFAULT_LISTAS.estadosPro).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Fecha Inicio"><FI type="date" value={f.ini || ""} onChange={e => u("ini", e.target.value)} /></FG><FG label="Fecha Entrega"><FI type="date" value={f.fin || ""} onChange={e => u("fin", e.target.value)} /></FG></R2>
    <FG label="Descripción"><FTA value={f.des || ""} onChange={e => u("des", e.target.value)} placeholder="Descripción del proyecto..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave(f); }} />
  </Modal>;
}

export function MPg({ open, data, clientes, listas, onClose, onSave }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? { ...data } : { nom: "", tip: "Producción", can: "", est: "Activo", totalEp: "", fre: "Semanal", temporada: "", conductor: "", prodEjec: "", des: "", cliId: "", crewIds: [], comentarios: [] }); }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Producción" : "Nueva Producción"} sub="TV, Podcast, Web Series…" wide>
    <R2><FG label="Nombre *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Nombre de la producción"/></FG><FG label="Tipo"><FSl value={f.tip || ""} onChange={e => u("tip", e.target.value)}>{(listas?.tiposPg || DEFAULT_LISTAS.tiposPg).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Canal / Plataforma"><FI value={f.can || ""} onChange={e => u("can", e.target.value)} placeholder="Canal 13, Spotify..."/></FG><FG label="Estado"><FSl value={f.est || ""} onChange={e => u("est", e.target.value)}>{(listas?.estadosPg || DEFAULT_LISTAS.estadosPg).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <R3><FG label="Total Episodios"><FI type="number" value={f.totalEp || ""} onChange={e => u("totalEp", Number(e.target.value))} placeholder="24"/></FG><FG label="Frecuencia"><FSl value={f.fre || ""} onChange={e => u("fre", e.target.value)}>{(listas?.freqsPg || DEFAULT_LISTAS.freqsPg).map(o => <option key={o}>{o}</option>)}</FSl></FG><FG label="Temporada"><FI value={f.temporada || ""} onChange={e => u("temporada", e.target.value)} placeholder="T1 2025"/></FG></R3>
    <R2><FG label="Conductor / Host"><FI value={f.conductor || ""} onChange={e => u("conductor", e.target.value)} placeholder="Nombre del conductor"/></FG><FG label="Productor Ejecutivo"><FI value={f.prodEjec || ""} onChange={e => u("prodEjec", e.target.value)} placeholder="Nombre del productor"/></FG></R2>
    <FG label="Cliente asociado (opcional)"><FSl value={f.cliId || ""} onChange={e => u("cliId", e.target.value)}><option value="">— Sin cliente —</option>{(clientes || []).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG>
    <FG label="Descripción"><FTA value={f.des || ""} onChange={e => u("des", e.target.value)} placeholder="De qué trata el programa..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave(f); }} />
  </Modal>;
}

export function MCampanaContenido({ open, data, clientes, listas, onClose, onSave, normalizeSocialCampaign, meses, today }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? normalizeSocialCampaign(data) : { nom: "", cliId: "", plataforma: "Instagram", mes: meses[new Date().getMonth()], ano: new Date().getFullYear(), est: "Planificada", ini: today(), fin: "", des: "", crewIds: [], comentarios: [], plannedPieces: 1, piezas: [] }); }, [data, open, normalizeSocialCampaign, meses, today]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Campaña" : "Nueva Campaña"} sub="Contenidos para redes sociales" wide>
    <R2><FG label="Nombre *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Nombre de la campaña"/></FG><FG label="Cliente"><FSl value={f.cliId || ""} onChange={e => u("cliId", e.target.value)}><option value="">— Sin cliente —</option>{(clientes || []).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</FSl></FG></R2>
    <R3><FG label="Plataforma principal"><FSl value={f.plataforma || "Instagram"} onChange={e => u("plataforma", e.target.value)}>{(listas?.plataformasContenido || DEFAULT_LISTAS.plataformasContenido).map(o => <option key={o}>{o}</option>)}</FSl></FG><FG label="Estado"><FSl value={f.est || "Planificada"} onChange={e => u("est", e.target.value)}>{(listas?.estadosCamp || DEFAULT_LISTAS.estadosCamp).map(o => <option key={o}>{o}</option>)}</FSl></FG><FG label="Piezas mensuales"><FSl value={String(f.plannedPieces ?? 1)} onChange={e => u("plannedPieces", Number(e.target.value))}>{Array.from({ length: 200 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}</FSl></FG></R3>
    <R2><FG label="Mes"><FSl value={f.mes || meses[new Date().getMonth()]} onChange={e => u("mes", e.target.value)}>{meses.map(o => <option key={o}>{o}</option>)}</FSl></FG><FG label="Año"><FI type="number" value={f.ano || new Date().getFullYear()} onChange={e => u("ano", Number(e.target.value))} min="2024"/></FG></R2>
    <R2><FG label="Fecha Inicio"><FI type="date" value={f.ini || ""} onChange={e => u("ini", e.target.value)} /></FG><FG label="Fecha Cierre"><FI type="date" value={f.fin || ""} onChange={e => u("fin", e.target.value)} /></FG></R2>
    <FG label="Descripción"><FTA value={f.des || ""} onChange={e => u("des", e.target.value)} placeholder="Objetivo, tono, entregables, alcance mensual..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave(normalizeSocialCampaign(f)); }} />
  </Modal>;
}

export function MPiezaContenido({ open, data, listas, crewOptions, onClose, onSave, normalizeSocialPiece, uid, today }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? normalizeSocialPiece(data) : normalizeSocialPiece({ id: uid(), nom: "", formato: "Reel", plataforma: data?.plataforma || "Instagram", est: "Planificado", ini: data?.ini || today(), fin: "", des: "", link: "", comentarios: [] }, data || {})); }, [data, open, normalizeSocialPiece, today, uid]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Pieza" : "Nueva Pieza"} sub="Pieza dentro de una campaña" wide>
    <R2><FG label="Nombre *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Nombre de la pieza"/></FG><FG label="Estado"><FSl value={f.est || "Planificado"} onChange={e => u("est", e.target.value)}>{(listas?.estadosPieza || DEFAULT_LISTAS.estadosPieza).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <R3><FG label="Formato"><FSl value={f.formato || "Reel"} onChange={e => u("formato", e.target.value)}>{(listas?.formatosPieza || DEFAULT_LISTAS.formatosPieza).map(o => <option key={o}>{o}</option>)}</FSl></FG><FG label="Plataforma"><FSl value={f.plataforma || "Instagram"} onChange={e => u("plataforma", e.target.value)}>{(listas?.plataformasContenido || DEFAULT_LISTAS.plataformasContenido).map(o => <option key={o}>{o}</option>)}</FSl></FG><FG label="Responsable"><FSl value={f.responsableId || ""} onChange={e => u("responsableId", e.target.value)}><option value="">— Sin responsable —</option>{(crewOptions || []).map(member => <option key={member.id} value={member.id}>{member.nom} · {member.rol || "Crew"}</option>)}</FSl></FG></R3>
    <R3><FG label="Fecha Inicio"><FI type="date" value={f.ini || ""} onChange={e => u("ini", e.target.value)} /></FG><FG label="Fecha Entrega"><FI type="date" value={f.fin || ""} onChange={e => u("fin", e.target.value)} /></FG><FG label="Fecha de Publicación"><FI type="date" value={f.publishDate || ""} onChange={e => u("publishDate", e.target.value)} /></FG></R3>
    <R2><FG label="Estado de aprobación"><FSl value={f.approval || "Pendiente"} onChange={e => u("approval", e.target.value)}><option>Pendiente</option><option>En revisión</option><option>Aprobada</option><option>Observada</option></FSl></FG><FG label="Fecha de publicación real"><FI type="date" value={f.publishedAt || ""} onChange={e => u("publishedAt", e.target.value)} /></FG></R2>
    <R2><FG label="Enlace de trabajo"><FI value={f.link || ""} onChange={e => u("link", e.target.value)} placeholder="https://drive.google.com/..."/></FG><FG label="Versión final / Link final"><FI value={f.finalLink || ""} onChange={e => u("finalLink", e.target.value)} placeholder="https://instagram.com/... o drive final"/></FG></R2>
    <FG label="Brief de la pieza"><FTA value={f.brief || ""} onChange={e => u("brief", e.target.value)} placeholder="Qué se necesita, foco, tono, referencias y criterios del cliente."/></FG>
    <R2><FG label="Objetivo de la pieza"><FI value={f.objetivo || ""} onChange={e => u("objetivo", e.target.value)} placeholder="Awareness, conversión, engagement..."/></FG><FG label="CTA"><FI value={f.cta || ""} onChange={e => u("cta", e.target.value)} placeholder="Desliza, compra, comenta, guarda..."/></FG></R2>
    <FG label="Copy principal"><FTA value={f.copy || ""} onChange={e => u("copy", e.target.value)} placeholder="Texto o bajada principal que acompañará la publicación."/></FG>
    <FG label="Hashtags"><FI value={f.hashtags || ""} onChange={e => u("hashtags", e.target.value)} placeholder="#marca #campaña #contenido"/></FG>
    <FG label="Descripción / Brief"><FTA value={f.des || ""} onChange={e => u("des", e.target.value)} placeholder="Concepto creativo, referencias, notas y criterios editoriales..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave(f); }} />
  </Modal>;
}

export function MEp({ open, data, programas, listas, onClose, onSave }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? { ...data } : { pgId: data?.pgId || "", num: data?.num || 1, titulo: "", estado: "Planificado", fechaGrab: "", fechaEmision: "", invitado: "", descripcion: "", locacion: "", duracion: "", notas: "", crewIds: [], comentarios: [] }); }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Episodio" : "Nuevo Episodio"} sub="Planificación de episodio" wide>
    <R3><FG label="Producción"><FSl value={f.pgId || ""} onChange={e => u("pgId", e.target.value)}><option value="">Seleccionar...</option>{(programas || []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG><FG label="Número *"><FI type="number" value={f.num || ""} onChange={e => u("num", Number(e.target.value))} min="1" placeholder="1"/></FG><FG label="Estado"><FSl value={f.estado || ""} onChange={e => u("estado", e.target.value)}>{(listas?.estadosEp || DEFAULT_LISTAS.estadosEp).map(o => <option key={o}>{o}</option>)}</FSl></FG></R3>
    <FG label="Título del Episodio *"><FI value={f.titulo || ""} onChange={e => u("titulo", e.target.value)} placeholder="Título descriptivo del episodio"/></FG>
    <R2><FG label="Invitado / Tema"><FI value={f.invitado || ""} onChange={e => u("invitado", e.target.value)} placeholder="Nombre o tema principal"/></FG><FG label="Locación"><FI value={f.locacion || ""} onChange={e => u("locacion", e.target.value)} placeholder="Estudio A, Exteriores..."/></FG></R2>
    <R3><FG label="Fecha Grabación"><FI type="date" value={f.fechaGrab || ""} onChange={e => u("fechaGrab", e.target.value)} /></FG><FG label="Fecha Emisión"><FI type="date" value={f.fechaEmision || ""} onChange={e => u("fechaEmision", e.target.value)} /></FG><FG label="Duración (min)"><FI type="number" value={f.duracion || ""} onChange={e => u("duracion", e.target.value)} placeholder="45"/></FG></R3>
    <FG label="Descripción / Sinopsis"><FTA value={f.descripcion || ""} onChange={e => u("descripcion", e.target.value)} placeholder="Descripción del contenido..."/></FG>
    <FG label="Notas de Producción"><FTA value={f.notas || ""} onChange={e => u("notas", e.target.value)} placeholder="Notas internas, pendientes..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.titulo?.trim()) return; onSave(f); }} />
  </Modal>;
}

export function MAus({ open, data, programas, listas, onClose, onSave }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? { ...data } : { nom: "", tip: "Auspiciador Principal", con: "", ema: "", tel: "", pids: data?.pids || [], mon: "", vig: "", est: "Activo", frecPago: "Mensual", not: "" }); }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Auspiciador" : "Nuevo Auspiciador"} sub="Marca o colaborador">
    <R2><FG label="Nombre *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Banco Estado"/></FG><FG label="Tipo"><FSl value={f.tip || ""} onChange={e => u("tip", e.target.value)}>{(listas?.tiposAus || DEFAULT_LISTAS.tiposAus).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <R2><FG label="Contacto"><FI value={f.con || ""} onChange={e => u("con", e.target.value)} placeholder="María González"/></FG><FG label="Email"><FI value={f.ema || ""} onChange={e => u("ema", e.target.value)} placeholder="mg@empresa.cl"/></FG></R2>
    <R2><FG label="Monto (CLP)"><FI type="number" value={f.mon || ""} onChange={e => u("mon", e.target.value)} placeholder="0"/></FG><FG label="Frecuencia de Pago"><FSl value={f.frecPago || "Mensual"} onChange={e => u("frecPago", e.target.value)}>{(listas?.frecPagoAus || DEFAULT_LISTAS.frecPagoAus).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <FG label="Producciones Asociadas"><MultiSelect options={(programas || []).map(p => ({ value: p.id, label: p.nom }))} value={f.pids || []} onChange={v => u("pids", v)} placeholder="Seleccionar producciones..."/></FG>
    <R2><FG label="Vigencia"><FI type="date" value={f.vig || ""} onChange={e => u("vig", e.target.value)} /></FG><FG label="Estado"><FSl value={f.est || ""} onChange={e => u("est", e.target.value)}>{(listas?.estadosAus || DEFAULT_LISTAS.estadosAus).map(o => <option key={o}>{o}</option>)}</FSl></FG></R2>
    <FG label="Notas"><FTA value={f.not || ""} onChange={e => u("not", e.target.value)} placeholder="Menciones, logo en créditos..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave(f); }} />
  </Modal>;
}

export function MCrew({ open, data, listas, onClose, onSave }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? { ...data } : { nom: "", rol: "", area: "Producción", tipo: "externo", tel: "", ema: "", dis: "", tarifa: "", not: "", active: true }); }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const AREAS = listas?.areasCrew || DEFAULT_LISTAS.areasCrew;
  const ROLES_C = listas?.rolesCrew || DEFAULT_LISTAS.rolesCrew;
  const managedByUser = f.managedByUser === true;
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Miembro" : "Agregar al Equipo"} sub="Crew de producción">
    <FG label="Tipo de Crew"><FSl value={f.tipo || "externo"} disabled><option value="externo">Externo — tarifa aplica a producciones</option><option value="interno">Interno — derivado de usuarios</option></FSl></FG>
    {managedByUser && <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: -6, marginBottom: 12 }}>Este miembro viene desde `Usuarios`. Aquí puedes complementar datos operativos como área, teléfono, disponibilidad y notas.</div>}
    <R2><FG label="Nombre completo *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Juan Pérez" disabled={managedByUser}/></FG><FG label="Rol / Cargo">{managedByUser ? <FI value={f.rol || ""} disabled placeholder="Cargo sincronizado desde usuario"/> : <FSl value={f.rol || ""} onChange={e => u("rol", e.target.value)}><option value="">Seleccionar...</option>{ROLES_C.map(r => <option key={r}>{r}</option>)}</FSl>}</FG></R2>
    <R2><FG label="Área"><FSl value={f.area || ""} onChange={e => u("area", e.target.value)}>{AREAS.map(a => <option key={a}>{a}</option>)}</FSl></FG><FG label="Disponibilidad"><FI value={f.dis || ""} onChange={e => u("dis", e.target.value)} placeholder="Lun-Vie, Fines de semana..."/></FG></R2>
    <R2><FG label="Teléfono"><FI value={f.tel || ""} onChange={e => u("tel", e.target.value)} placeholder="+56 9 1234 5678"/></FG><FG label="Email"><FI type="email" value={f.ema || ""} onChange={e => u("ema", e.target.value)} placeholder="juan@email.cl" disabled={managedByUser}/></FG></R2>
    <R2><FG label="Tarifa"><FI value={f.tarifa || ""} onChange={e => u("tarifa", e.target.value)} placeholder="$150.000/día" disabled={managedByUser}/></FG><FG label="Estado"><FSl value={f.active !== false ? "true" : "false"} onChange={e => u("active", e.target.value === "true")} disabled={managedByUser}><option value="true">Activo</option><option value="false">Inactivo</option></FSl></FG></R2>
    <FG label="Notas"><FTA value={f.not || ""} onChange={e => u("not", e.target.value)} placeholder="Especialidades, observaciones..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave(f); }} />
  </Modal>;
}

export function MEvento({ open, data, producciones, programas, piezas, onClose, onSave }) {
  const [f, setF] = useState({});
  const [inviteesInput, setInviteesInput] = useState("");
  useEffect(() => {
    const next = data?.id
      ? { ...data, invitados: Array.isArray(data?.invitados) ? data.invitados : [], addMeet: data?.addMeet === true }
      : { titulo: "", tipo: "grabacion", fecha: data?.fecha || "", hora: data?.hora || "", desc: "", ref: data?.ref || "", refTipo: data?.refTipo || "", invitados: [], addMeet: false };
    setF(next);
    setInviteesInput(Array.isArray(next.invitados) ? next.invitados.join(", ") : "");
  }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const normalizeInvitees = value => String(value || "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  const TIPOS = [{ v: "grabacion", l: "🎬 Grabación" }, { v: "emision", l: "📡 Emisión" }, { v: "reunion", l: "💬 Reunión" }, { v: "entrega", l: "✓ Entrega" }, { v: "estreno", l: "🌟 Estreno" }, { v: "otro", l: "📌 Otro" }];
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Evento" : "Nuevo Evento de Calendario"} sub="Fecha de grabación, emisión, reunión u otro">
    <FG label="Título del evento *"><FI value={f.titulo || ""} onChange={e => u("titulo", e.target.value)} placeholder="Grabación Episodio 5, Reunión..."/></FG>
    <R2><FG label="Tipo"><FSl value={f.tipo || "grabacion"} onChange={e => u("tipo", e.target.value)}>{TIPOS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</FSl></FG>
    <FG label="Vinculado a"><FSl value={f.ref || ""} onChange={e => { const opt = [...(producciones || []).map(p => ({ v: p.id, t: "produccion" })), ...(programas || []).map(p => ({ v: p.id, t: "programa" })), ...(piezas || []).map(p => ({ v: p.id, t: "contenido" }))].find(o => o.v === e.target.value); u("ref", e.target.value); u("refTipo", opt?.t || ""); }}>
      <option value="">Sin vinculación</option>
      <optgroup label="Proyectos">{(producciones || []).map(p => <option key={p.id} value={p.id}>📽 {p.nom}</option>)}</optgroup>
      <optgroup label="Producciones">{(programas || []).map(p => <option key={p.id} value={p.id}>📺 {p.nom}</option>)}</optgroup>
      <optgroup label="Campañas">{(piezas || []).map(p => <option key={p.id} value={p.id}>📱 {p.nom}</option>)}</optgroup>
    </FSl></FG></R2>
    <R2><FG label="Fecha *"><FI type="date" value={f.fecha || ""} onChange={e => u("fecha", e.target.value)} /></FG><FG label="Hora"><FI type="time" value={f.hora || ""} onChange={e => u("hora", e.target.value)} /></FG></R2>
    <FG label="Google Meet">
      <FSl value={f.addMeet === true ? "si" : "no"} onChange={e => u("addMeet", e.target.value === "si")}>
        <option value="no">No</option>
        <option value="si">Sí</option>
      </FSl>
    </FG>
    <FG label="Invitados">
      <FTA
        value={inviteesInput}
        onChange={e => setInviteesInput(String(e.target.value || ""))}
        placeholder="correo1@empresa.cl, correo2@empresa.cl"
      />
      <div style={{ fontSize: 11, color: "var(--gr2)", marginTop: 6 }}>
        Se enviarán como invitados en Google Calendar cuando el usuario esté conectado.
      </div>
    </FG>
    <FG label="Descripción / Notas"><FTA value={f.desc || ""} onChange={e => u("desc", e.target.value)} placeholder="Detalles, ubicación, participantes..."/></FG>
    <MFoot onClose={onClose} onSave={() => {
      if (!f.titulo?.trim() || !f.fecha) return;
      onSave({ ...f, invitados: normalizeInvitees(inviteesInput) });
    }} />
  </Modal>;
}

export function MActivo({ open, data, producciones, listas, onClose, onSave }) {
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? { ...data } : { nom: "", categoria: "", marca: "", modelo: "", serial: "", valorCompra: "", fechaCompra: "", estado: "Disponible", asignadoA: "", obs: "" }); }, [data, open]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const CATS = listas?.catActivos || DEFAULT_LISTAS.catActivos;
  const ESTADOS = listas?.estadosActivos || DEFAULT_LISTAS.estadosActivos;
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Activo" : "Nuevo Activo"} sub="Equipamiento o bien de la productora">
    <R2><FG label="Nombre *"><FI value={f.nom || ""} onChange={e => u("nom", e.target.value)} placeholder="Canon EOS R5"/></FG><FG label="Categoría"><FSl value={f.categoria || ""} onChange={e => u("categoria", e.target.value)}><option value="">Seleccionar...</option>{CATS.map(c => <option key={c}>{c}</option>)}</FSl></FG></R2>
    <R3><FG label="Marca"><FI value={f.marca || ""} onChange={e => u("marca", e.target.value)} placeholder="Canon, Sony..."/></FG><FG label="Modelo"><FI value={f.modelo || ""} onChange={e => u("modelo", e.target.value)} placeholder="EOS R5"/></FG><FG label="N° Serie"><FI value={f.serial || ""} onChange={e => u("serial", e.target.value)} placeholder="SN-00001"/></FG></R3>
    <R3><FG label="Valor Compra"><FI type="number" value={f.valorCompra || ""} onChange={e => u("valorCompra", e.target.value)} placeholder="0"/></FG><FG label="Fecha Compra"><FI type="date" value={f.fechaCompra || ""} onChange={e => u("fechaCompra", e.target.value)} /></FG><FG label="Estado"><FSl value={f.estado || "Disponible"} onChange={e => u("estado", e.target.value)}>{ESTADOS.map(s => <option key={s}>{s}</option>)}</FSl></FG></R3>
    <FG label="Asignado a Proyecto"><FSl value={f.asignadoA || ""} onChange={e => u("asignadoA", e.target.value)}><option value="">— Sin asignar —</option>{(producciones || []).map(p => <option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG>
    <FG label="Observaciones"><FTA value={f.obs || ""} onChange={e => u("obs", e.target.value)} placeholder="Condición, accesorios incluidos..."/></FG>
    <MFoot onClose={onClose} onSave={() => { if (!f.nom?.trim()) return; onSave(f); }} />
  </Modal>;
}

export function MTarea({ open, data, producciones, programas, piezas, oportunidades, crew, listas, onClose, onSave, normalizeTaskAssignees, getAssignedIds }) {
  const empty = { titulo:"", desc:"", estado:"Pendiente", prioridad:"Media", fechaLimite:"", refTipo:"", refId:"", asignadoA:"", assignedIds:[], recurrenciaTipo:"" };
  const [f, setF] = useState({});
  useEffect(() => { setF(data?.id ? normalizeTaskAssignees({ ...data }) : { ...empty }); }, [data, open, normalizeTaskAssignees]);
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const toggleAssigned = id => setF(prev => {
    const current = getAssignedIds(prev);
    const nextIds = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    return { ...prev, assignedIds: nextIds, asignadoA: nextIds[0] || "" };
  });
  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar Tarea" : "Nueva Tarea"}>
    <FG label="Título *"><FI value={f.titulo || ""} onChange={e => u("titulo", e.target.value)} placeholder="Descripción breve de la tarea"/></FG>
    <FG label="Descripción"><FTA value={f.desc || ""} onChange={e => u("desc", e.target.value)} placeholder="Detalle opcional..."/></FG>
    <R2>
      <FG label="Prioridad"><FSl value={f.prioridad || "Media"} onChange={e => u("prioridad", e.target.value)}>{(listas?.prioridadesTarea || DEFAULT_LISTAS.prioridadesTarea).map(o => <option key={o}>{o}</option>)}</FSl></FG>
      <FG label="Estado"><FSl value={f.estado || "Pendiente"} onChange={e => u("estado", e.target.value)}>{(listas?.estadosTarea || DEFAULT_LISTAS.estadosTarea).map(c => <option key={c}>{c}</option>)}</FSl></FG>
    </R2>
    <R2>
      <FG label="Fecha límite"><FI type="date" value={f.fechaLimite || ""} onChange={e => u("fechaLimite", e.target.value)} /></FG>
      <FG label="Responsable principal"><FSl value={f.asignadoA || ""} onChange={e => { const value = e.target.value; const rest = getAssignedIds(f).filter(id => id !== value); u("asignadoA", value); u("assignedIds", value ? [value, ...rest] : rest); }}>
        <option value="">— Sin asignar —</option>
        {(crew || []).map(c => <option key={c.id} value={c.id}>{c.nom} · {c.rol || "Crew"}</option>)}
      </FSl></FG>
    </R2>
    <FG label="Recurrencia">
      <FSl value={f.recurrenciaTipo || ""} onChange={e => u("recurrenciaTipo", e.target.value)}>
        <option value="">Sin recurrencia</option>
        <option value="mensual">Mensual</option>
      </FSl>
      <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 6 }}>
        {f.recurrenciaTipo === "mensual"
          ? "Al guardar, Produ generará la serie mensual usando la fecha límite como base."
          : "Usa esto para tareas que deban repetirse cada mes."}
      </div>
    </FG>
    {!!crew?.length && <FG label="Asignar a más usuarios">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(crew || []).map(member => {
          const active = getAssignedIds(f).includes(member.id);
          return <button key={member.id} type="button" onClick={() => toggleAssigned(member.id)} style={{ padding: "8px 10px", borderRadius: 999, border: `1px solid ${active ? "var(--cy)" : "var(--bdr)"}`, background: active ? "color-mix(in srgb, var(--cy) 14%, transparent)" : "var(--sur)", color: active ? "var(--cy)" : "var(--gr3)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            {active ? "✓ " : ""}{member.nom}
          </button>;
        })}
      </div>
      <div style={{ fontSize: 10, color: "var(--gr2)", marginTop: 6 }}>Puedes asignar la tarea a varios usuarios. El responsable principal será el primero de la lista.</div>
    </FG>}
    <R2>
      <FG label="Asociar a"><FSl value={f.refTipo || ""} onChange={e => { u("refTipo", e.target.value); u("refId", ""); }}>
        <option value="">— Sin asociar —</option>
        <option value="pro">Proyecto</option>
        <option value="pg">Producción</option>
        <option value="pz">Campaña de Contenidos</option>
        <option value="crm">Oportunidad CRM</option>
        <option value="crew">Crew</option>
      </FSl></FG>
      {f.refTipo==="pro"&&<FG label="Proyecto"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}><option value="">— Seleccionar —</option>{(producciones||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG>}
      {f.refTipo==="pg"&&<FG label="Producción"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}><option value="">— Seleccionar —</option>{(programas||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG>}
      {f.refTipo==="pz"&&<FG label="Campaña"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}><option value="">— Seleccionar —</option>{(piezas||[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}</FSl></FG>}
      {f.refTipo==="crm"&&<FG label="Oportunidad"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}><option value="">— Seleccionar —</option>{(oportunidades||[]).map(o=><option key={o.id} value={o.id}>{o.nombre} · {o.empresaMarca}</option>)}</FSl></FG>}
      {f.refTipo==="crew"&&<FG label="Miembro Crew"><FSl value={f.refId||""} onChange={e=>u("refId",e.target.value)}><option value="">— Seleccionar —</option>{(crew||[]).map(c=><option key={c.id} value={c.id}>{c.nom} · {c.rol||"Crew"}</option>)}</FSl></FG>}
    </R2>
    <MFoot onClose={onClose} onSave={() => { if (!f.titulo) return; if (f.recurrenciaTipo === "mensual" && !f.fechaLimite) return; onSave(normalizeTaskAssignees(f)); }} />
  </Modal>;
}
