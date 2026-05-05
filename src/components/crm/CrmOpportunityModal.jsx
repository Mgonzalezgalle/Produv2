import React, { useEffect, useState } from "react";
import { FG, FI, FSl, MFoot, Modal, R2, R3 } from "../../lib/ui/components";
import { CRM_STATUS_OPTIONS, crmDefaultStageId, crmNormalizeOpportunity, crmStageMeta, normalizeCrmStages } from "../../lib/utils/crm";

const FIELD_ERROR_STYLE = {
  borderColor: "color-mix(in srgb, var(--red) 72%, var(--bdr2) 28%)",
  boxShadow: "0 0 0 1px color-mix(in srgb, var(--red) 20%, transparent 80%)",
};

export function CrmOpportunityModal({ open, data, crmStages, users, onClose, onSave }) {
  const [form, setForm] = useState({});
  const stageList = normalizeCrmStages(crmStages);

  useEffect(() => {
    if (!open) return;
    const empty = {
      nombre: "",
      empresaMarca: "",
      contacto: "",
      email: "",
      telefono: "",
      tipo_negocio: "cliente",
      stageId: crmDefaultStageId(stageList),
      status: "Activa",
      monto_estimado: "",
      fecha_cierre_estimada: "",
      responsable: "",
      nextAction: "",
      nextActionDate: "",
    };
    setForm(data?.id ? crmNormalizeOpportunity(data, stageList) : empty);
  }, [open, data?.id, crmStages]);

  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const onStageChange = value => {
    const stage = crmStageMeta(value, stageList);
    setForm(prev => ({
      ...prev,
      stageId: value,
      status: stage.closedWon ? "Ganada" : stage.closedLost ? "Perdida" : (prev.status === "Ganada" || prev.status === "Perdida" ? "Activa" : prev.status || "Activa"),
    }));
  };
  const validationIssue = !form.nombre?.trim()
    ? {
      key: "nombre",
      title: "No has completado el nombre de la oportunidad.",
      detail: "Escribe un nombre claro para identificar esta oportunidad comercial.",
      inline: "Falta completar el nombre de la oportunidad.",
    }
    : !form.empresaMarca?.trim()
      ? {
        key: "empresaMarca",
        title: "Todavía falta la empresa o marca asociada.",
        detail: "Indica la empresa o marca para poder guardar esta oportunidad.",
        inline: "Falta completar la empresa o marca.",
      }
      : null;
  const canSubmit = !validationIssue;

  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar oportunidad" : "Nueva oportunidad"} sub="Lead u oportunidad comercial" wide>
    <R2>
      <FG label="Nombre *">
        <FI value={form.nombre || ""} onChange={e => update("nombre", e.target.value)} placeholder="Nombre de la oportunidad" style={validationIssue?.key === "nombre" ? FIELD_ERROR_STYLE : undefined} />
        {validationIssue?.key === "nombre" && <div style={{ marginTop: 6, fontSize: 11, color: "var(--red)", fontWeight: 600 }}>{validationIssue.inline}</div>}
      </FG>
      <FG label="Empresa o marca *">
        <FI value={form.empresaMarca || ""} onChange={e => update("empresaMarca", e.target.value)} placeholder="Empresa o marca" style={validationIssue?.key === "empresaMarca" ? FIELD_ERROR_STYLE : undefined} />
        {validationIssue?.key === "empresaMarca" && <div style={{ marginTop: 6, fontSize: 11, color: "var(--red)", fontWeight: 600 }}>{validationIssue.inline}</div>}
      </FG>
    </R2>
    <R3>
      <FG label="Contacto"><FI value={form.contacto || ""} onChange={e => update("contacto", e.target.value)} placeholder="Nombre del contacto" /></FG>
      <FG label="Email"><FI type="email" value={form.email || ""} onChange={e => update("email", e.target.value)} placeholder="contacto@empresa.cl" /></FG>
      <FG label="Teléfono"><FI value={form.telefono || ""} onChange={e => update("telefono", e.target.value)} placeholder="+56 9 1234 5678" /></FG>
    </R3>
    <R3>
      <FG label="Tipo de negocio"><FSl value={form.tipo_negocio || "cliente"} onChange={e => update("tipo_negocio", e.target.value)}><option value="cliente">Cliente</option><option value="auspiciador">Auspiciador</option></FSl></FG>
      <FG label="Etapa"><FSl value={form.stageId || crmDefaultStageId(stageList)} onChange={e => onStageChange(e.target.value)}>{stageList.map(stage => <option key={stage.id} value={stage.id}>{stage.name}</option>)}</FSl></FG>
      <FG label="Estado"><FSl value={form.status || "Activa"} onChange={e => update("status", e.target.value)}>{CRM_STATUS_OPTIONS.map(opt => <option key={opt}>{opt}</option>)}</FSl></FG>
    </R3>
    <R3>
      <FG label="Monto estimado"><FI type="number" min="0" value={form.monto_estimado || ""} onChange={e => update("monto_estimado", e.target.value)} placeholder="0" /></FG>
      <FG label="Fecha cierre estimada"><FI type="date" value={form.fecha_cierre_estimada || ""} onChange={e => update("fecha_cierre_estimada", e.target.value)} /></FG>
      <FG label="Responsable"><FSl value={form.responsable || ""} onChange={e => update("responsable", e.target.value)}><option value="">— Sin responsable —</option>{(users || []).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</FSl></FG>
    </R3>
    <R2>
      <FG label="Próxima acción"><FI value={form.nextAction || ""} onChange={e => update("nextAction", e.target.value)} placeholder="Llamar, enviar propuesta, reagendar reunión..." /></FG>
      <FG label="Fecha próxima acción"><FI type="date" value={form.nextActionDate || ""} onChange={e => update("nextActionDate", e.target.value)} /></FG>
    </R2>
    {validationIssue && (
      <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb, var(--red) 24%, var(--bdr2) 76%)", background: "color-mix(in srgb, var(--red) 10%, var(--card) 90%)" }}>
        <div style={{ fontSize: 12, color: "var(--red)", fontWeight: 700, marginBottom: 4 }}>{validationIssue.title}</div>
        <div style={{ fontSize: 12, color: "var(--gr3)", lineHeight: 1.5 }}>{validationIssue.detail}</div>
      </div>
    )}
    <MFoot onClose={onClose} disabled={!canSubmit} onSave={() => { if (!canSubmit) return; onSave(crmNormalizeOpportunity(form, stageList)); }} />
  </Modal>;
}
