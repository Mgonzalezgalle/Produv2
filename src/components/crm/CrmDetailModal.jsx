import React from "react";
import { Badge, Btn, Card, Empty, FG, FI, FSl, FTA, KV, Modal, Sep, Stat } from "../../lib/ui/components";
import { ContactBtns } from "../shared/ContactButtons";
import { normalizeCommentAttachments } from "../../lib/utils/helpers";

function crmActivityMeta(type = "") {
  const safe = String(type || "").trim().toLowerCase();
  if (safe === "email") return { label: "Correo", accent: "#4f7cff", eyebrow: "Mensaje" };
  if (safe === "meeting") return { label: "Reunión", accent: "#a78bfa", eyebrow: "Interacción" };
  if (safe === "call") return { label: "Llamada", accent: "#00e08a", eyebrow: "Interacción" };
  if (safe === "note") return { label: "Comentario", accent: "#94a3b8", eyebrow: "Registro" };
  return { label: type || "Actividad", accent: "#94a3b8", eyebrow: "Registro" };
}

function crmActivityHeadline(activity = {}) {
  if (activity?.type === "email") return activity?.subject || "Correo sin asunto";
  return activity?.text?.split("\n")[0]?.trim() || "Actividad sin detalle";
}

function crmActivitySecondary(activity = {}) {
  if (activity?.type === "email") {
    const recipient = String(activity?.to || "").trim();
    return recipient ? `Para ${recipient}` : "Sin destinatario visible";
  }
  return activity?.byName ? `Registrado por ${activity.byName}` : "Registro interno";
}

export function CrmDetailModal({
  detail,
  setDetailId,
  setActivityForm,
  crmEntityLabel,
  stagesById,
  fmtM,
  fmtD,
  tenantUsers,
  empresa,
  crmCanPassToClient,
  scopedStages,
  passToEntity,
  saveOpp,
  detailActivities,
  activityForm,
  addActivity,
  ntf,
  tasksEnabled,
  canManageCrm,
  canManageTasks,
  openM,
  detailTasks,
  TareaCard,
  scopedOpps,
  getRoleConfig,
  onComposeEmail,
}) {
  return (
    <Modal open={!!detail} onClose={() => { setDetailId(""); setActivityForm({ type: "note", text: "" }); }} title={detail?.nombre || "Detalle CRM"} sub={detail ? `${detail.empresaMarca} · ${crmEntityLabel(detail)}` : ""} extraWide>
      {detail && <>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 12, marginBottom: 16 }}>
          <Stat label="Etapa" value={stagesById[detail.stageId]?.name || "—"} accent="var(--cy)" vc="var(--cy)" />
          <Stat label="Estado" value={detail.status || "—"} accent={detail.status === "Ganada" ? "#00e08a" : detail.status === "Perdida" ? "#ff5566" : "#fbbf24"} vc={detail.status === "Ganada" ? "#00e08a" : detail.status === "Perdida" ? "#ff5566" : "#fbbf24"} />
          <Stat label="Monto estimado" value={fmtM(detail.monto_estimado || 0)} accent="#a855f7" vc="#a855f7" />
          <Stat label="Próxima acción" value={detail.nextActionDate ? fmtD(detail.nextActionDate) : "Sin fecha"} sub={detail.nextAction || "Sin definir"} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 16, marginBottom: 16 }}>
          <Card title="Datos generales">
            <KV label="Empresa o marca" value={detail.empresaMarca || "—"} />
            <KV label="Contacto" value={detail.contacto || "—"} />
            <KV label="Email" value={detail.email || "—"} />
            <KV label="Teléfono" value={detail.telefono || "—"} />
            <KV label="Responsable" value={(tenantUsers.find(item => item.id === detail.responsable)?.name) || "—"} />
            <KV label="Fecha cierre estimada" value={detail.fecha_cierre_estimada ? fmtD(detail.fecha_cierre_estimada) : "—"} />
            {(detail.telefono || detail.email) && <>
              <Sep />
              <div style={{ fontSize: 11, color: "var(--gr2)", marginBottom: 8 }}>Contacto rápido</div>
              <ContactBtns
                tel={detail.telefono}
                ema={detail.email}
                nombre={detail.contacto || detail.empresaMarca || detail.nombre}
                origen={empresa?.nombre || "tu empresa"}
                mensaje={`Hola ${detail.contacto || detail.empresaMarca || ""}, te contactamos desde ${empresa?.nombre || "tu empresa"}.`}
                onEmail={detail?.email ? () => onComposeEmail?.(detail, activityForm?.type === "email" ? activityForm : { type: "email", text: "" }) : null}
                emailLabel="Correo"
              />
            </>}
            {canManageCrm && crmCanPassToClient(detail, scopedStages) && <div style={{ marginTop: 14 }}><Btn onClick={() => passToEntity(detail)}>{detail.tipo_negocio === "auspiciador" ? "Pasar a Auspiciadores" : "Pasar a Clientes"}</Btn></div>}
            {!!detail.linkedClientId && <div style={{ marginTop: 12, fontSize: 12, color: "#00e08a" }}>✓ Vinculada al cliente existente/creado en Clientes</div>}
            {!!detail.linkedSponsorId && <div style={{ marginTop: 12, fontSize: 12, color: "#00e08a" }}>✓ Vinculada al auspiciador existente/creado en Auspiciadores</div>}
          </Card>
          <Card title="Próxima acción">
            <FG label="Qué sigue"><FI value={detail.nextAction || ""} onChange={e => canManageCrm && (setDetailId(detail.id) || saveOpp({ ...detail, nextAction: e.target.value }))} placeholder="Define el siguiente movimiento comercial" disabled={!canManageCrm} /></FG>
            <FG label="Fecha"><FI type="date" value={detail.nextActionDate || ""} onChange={e => canManageCrm && saveOpp({ ...detail, nextActionDate: e.target.value })} disabled={!canManageCrm} /></FG>
            <div style={{ fontSize: 11, color: "var(--gr2)" }}>Este bloque te ayuda a mantener foco comercial sin abrir otra herramienta.</div>
          </Card>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
          <Card title="Historial de actividades" sub={`${detailActivities.length} registro${detailActivities.length === 1 ? "" : "s"}`}>
            <div style={{ display: "grid", gridTemplateColumns: "180px 1fr auto", gap: 8, marginBottom: 12, alignItems: "start" }}>
              <FSl value={activityForm.type} onChange={e => setActivityForm(prev => ({ ...prev, type: e.target.value }))}>
                <option value="note">Nota</option>
                <option value="call">Llamada</option>
                <option value="meeting">Reunión</option>
                <option value="email">Email</option>
              </FSl>
              <FTA value={activityForm.text} onChange={e => setActivityForm(prev => ({ ...prev, text: e.target.value }))} placeholder="Registrar actividad comercial con más contexto, acuerdos, objeciones o próximos pasos..." style={{ minHeight: 88 }} />
              {canManageCrm && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
                  <Btn onClick={async () => { if (!activityForm.text.trim()) return; await addActivity(detail.id, activityForm.text, activityForm.type); setActivityForm({ type: "note", text: "" }); ntf?.("Actividad registrada ✓"); }} sm>+ Registrar</Btn>
                  <Btn
                    onClick={() => onComposeEmail?.(detail, activityForm?.type === "email" ? activityForm : { type: "email", text: activityForm?.text || "" })}
                    sm
                    disabled={!detail?.email}
                  >
                    ✉ Crear correo
                  </Btn>
                </div>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 420, overflowY: "auto" }}>
              {detailActivities.map(act => {
                const meta = crmActivityMeta(act.type);
                const attachments = normalizeCommentAttachments(act);
                return <div key={act.id} style={{ padding: 14, border: "1px solid var(--bdr2)", borderRadius: 14, background: "var(--sur)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto", gap: 12, alignItems: "start" }}>
                    <div style={{ width: 24, height: 24, borderRadius: 999, border: `1px solid ${meta.accent}`, color: meta.accent, display: "grid", placeItems: "center", fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                      ›
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: meta.accent }}>{meta.eyebrow}</span>
                        <Badge label={meta.label} color="gray" sm />
                        {!!attachments.length && <Badge label={`${attachments.length} adjunto${attachments.length === 1 ? "" : "s"}`} color="cyan" sm />}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "var(--wh)", lineHeight: 1.4, marginBottom: 4 }}>
                        {crmActivityHeadline(act)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--cy)", lineHeight: 1.45, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {crmActivitySecondary(act)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.6, whiteSpace: "pre-wrap", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {act.text || "Sin contenido"}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--gr2)", whiteSpace: "nowrap", textAlign: "right" }}>
                      <div>{act.createdAt ? fmtD(act.createdAt) : "—"}</div>
                      <div style={{ marginTop: 4 }}>{act.byName || "Sistema"}</div>
                    </div>
                  </div>
                  {!!attachments.length && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(120px,1fr))", gap: 8, marginTop: 12, paddingLeft: 36 }}>
                      {attachments.map(att => <a key={att.id || att.src} href={att.src} target="_blank" rel="noreferrer" download={att.name || true} style={{ display: "block", borderRadius: 12, overflow: "hidden", border: "1px solid var(--bdr)", textDecoration: "none", background: "var(--bg2)" }}>
                      {att.type === "pdf"
                        ? <div style={{ display: "grid", placeItems: "center", height: 96, padding: 10, textAlign: "center" }}>
                            <div style={{ fontSize: 24, marginBottom: 6 }}>📄</div>
                            <div style={{ fontSize: 10, color: "var(--gr3)", lineHeight: 1.35, wordBreak: "break-word" }}>{att.name || "Documento PDF"}</div>
                          </div>
                        : <img src={att.src} alt={att.name || "Adjunto email"} style={{ display: "block", width: "100%", height: 96, objectFit: "cover" }} />}
                      </a>)}
                    </div>
                  )}
                </div>;
              })}
              {!detailActivities.length && <Empty text="Sin actividades" sub="Registra llamadas, reuniones, emails o notas rápidas." />}
            </div>
          </Card>
        </div>
        <div style={{ marginTop: 16 }}>
          <Card title="Tareas" sub={tasksEnabled ? "Seguimiento operativo vinculado a esta oportunidad." : "El addon de Tareas está desactivado."} action={tasksEnabled && canManageTasks ? { label: "+ Tarea", fn: () => openM("tarea", { estado: "Pendiente", refTipo: "crm", refId: detail.id, titulo: `Seguimiento ${detail.nombre}` }) } : null}>
            {tasksEnabled ? (detailTasks.length ? detailTasks.map(task => <TareaCard key={task.id} tarea={task} producciones={[]} programas={[]} piezas={[]} oportunidades={scopedOpps} crew={tenantUsers.map(u => ({ id: u.id, nom: u.name, rol: getRoleConfig(u.role, empresa).label }))} onEdit={item => openM("tarea", item)} onDelete={() => {}} onChangeEstado={() => {}} canEdit={false} />) : <Empty text="Sin tareas vinculadas" sub="Crea una tarea para convertir este lead en siguiente acción real." />) : null}
          </Card>
        </div>
      </>}
    </Modal>
  );
}
