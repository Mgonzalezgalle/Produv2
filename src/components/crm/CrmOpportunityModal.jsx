import React, { useEffect, useState } from "react";
import { FG, FI, FSl, MFoot, Modal, R2, R3 } from "../../lib/ui/components";
import { CRM_STATUS_OPTIONS, crmDefaultStageId, crmNormalizeOpportunity, crmStageMeta, normalizeCrmStages } from "../../lib/utils/crm";

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

  return <Modal open={open} onClose={onClose} title={data?.id ? "Editar oportunidad" : "Nueva oportunidad"} sub="Lead u oportunidad comercial" wide>
    <R2>
      <FG label="Nombre *"><FI value={form.nombre || ""} onChange={e => update("nombre", e.target.value)} placeholder="Nombre de la oportunidad" /></FG>
      <FG label="Empresa o marca *"><FI value={form.empresaMarca || ""} onChange={e => update("empresaMarca", e.target.value)} placeholder="Empresa o marca" /></FG>
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
    <MFoot onClose={onClose} onSave={() => { if (!form.nombre?.trim() || !form.empresaMarca?.trim()) return; onSave(crmNormalizeOpportunity(form, stageList)); }} />
  </Modal>;
}
