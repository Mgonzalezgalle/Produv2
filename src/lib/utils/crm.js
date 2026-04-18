const uid = () => "_" + Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().split("T")[0];

export const CRM_STATUS_OPTIONS = ["Activa", "En seguimiento", "Ganada", "Perdida", "Pausada"];

export const CRM_STAGE_SEED = [
  { id: "crm-st-1", name: "Por contactar", order: 1, convertToClient: false, closedWon: false, closedLost: false },
  { id: "crm-st-2", name: "Contactado", order: 2, convertToClient: false, closedWon: false, closedLost: false },
  { id: "crm-st-3", name: "Reunión agendada", order: 3, convertToClient: false, closedWon: false, closedLost: false },
  { id: "crm-st-4", name: "Propuesta enviada", order: 4, convertToClient: false, closedWon: false, closedLost: false },
  { id: "crm-st-5", name: "Negociación", order: 5, convertToClient: false, closedWon: false, closedLost: false },
  { id: "crm-st-6", name: "Ganado", order: 6, convertToClient: true, closedWon: true, closedLost: false },
  { id: "crm-st-7", name: "Perdido", order: 7, convertToClient: false, closedWon: false, closedLost: true },
];

export function normalizeCrmStages(stages = []) {
  const source = Array.isArray(stages) ? stages : [];
  const arr = (source.length ? source : [])
    .map((stage, idx) => ({
      id: stage.id || uid(),
      empId: stage.empId || "",
      name: stage.name || `Etapa ${idx + 1}`,
      order: Number(stage.order || idx + 1),
      convertToClient: !!stage.convertToClient,
      closedWon: !!stage.closedWon || String(stage.name || "").toLowerCase() === "ganado",
      closedLost: !!stage.closedLost || String(stage.name || "").toLowerCase() === "perdido",
    }))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
  return arr;
}

export function recoverPreferredCrmStages(stages = [], empId = "") {
  const list = Array.isArray(stages) ? [...stages] : [];
  if (!list.length) return list;
  const normalizedNames = list.map(stage => String(stage?.name || "").trim().toLowerCase());
  const hasPorContactar = normalizedNames.includes("por contactar");
  const leadIndex = normalizedNames.findIndex(name => name === "lead nuevo");
  if (leadIndex >= 0) {
    const next = list
      .map((stage, idx) => idx === leadIndex ? { ...stage, empId: empId || stage.empId || "", name: "Por contactar" } : stage)
      .filter((stage, idx, arr) => {
        const name = String(stage?.name || "").trim().toLowerCase();
        return name !== "lead nuevo" && arr.findIndex(item => String(item?.name || "").trim().toLowerCase() === name) === idx;
      });
    return next.map((stage, idx) => ({ ...stage, order: idx + 1 }));
  }
  if (hasPorContactar) {
    return list.map((stage, idx) => ({ ...stage, empId: empId || stage.empId || "", order: stage.order ?? idx + 1 }));
  }
  const recovered = {
    id: uid(),
    empId: empId || list[0]?.empId || "",
    name: "Por contactar",
    order: 1,
    convertToClient: false,
    closedWon: false,
    closedLost: false,
  };
  return [recovered, ...list].map((stage, idx) => ({ ...stage, order: idx + 1 }));
}

export function crmDefaultStageId(stages = []) {
  return normalizeCrmStages(stages)[0]?.id || CRM_STAGE_SEED[0].id;
}

function resolveCrmStageReference(item = {}, stages = []) {
  const normalizedStages = normalizeCrmStages(stages);
  const rawReference = [
    item.stageId,
    item.etapaId,
    item.stage,
    item.etapa,
    item.stageName,
    item.etapaNombre,
  ].find(Boolean);
  const ref = String(rawReference || "").trim();
  if (!ref) return normalizedStages[0] || CRM_STAGE_SEED[0];
  const byId = normalizedStages.find(stage => stage.id === ref);
  if (byId) return byId;
  const byName = normalizedStages.find(stage => String(stage.name || "").trim().toLowerCase() === ref.toLowerCase());
  return byName || normalizedStages[0] || CRM_STAGE_SEED[0];
}

function normalizeCrmBusinessType(value = "") {
  const safe = String(value || "").trim().toLowerCase();
  if (["auspiciador", "sponsor", "sponsorship"].includes(safe)) return "auspiciador";
  return "cliente";
}

function normalizeCrmStatus(value = "", stage = CRM_STAGE_SEED[0]) {
  const safe = String(value || "").trim().toLowerCase();
  if (["ganada", "ganado", "won", "cerrada ganada"].includes(safe)) return "Ganada";
  if (["perdida", "perdido", "lost", "cerrada perdida"].includes(safe)) return "Perdida";
  if (["en seguimiento", "seguimiento", "follow_up"].includes(safe)) return "En seguimiento";
  if (["pausada", "pausado", "hold"].includes(safe)) return "Pausada";
  if (safe) return CRM_STATUS_OPTIONS.find(option => option.toLowerCase() === safe) || String(value).trim();
  return stage.closedWon ? "Ganada" : stage.closedLost ? "Perdida" : "Activa";
}

export function crmStageMeta(stageId, stages = []) {
  return normalizeCrmStages(stages).find(stage => stage.id === stageId) || normalizeCrmStages(stages)[0] || CRM_STAGE_SEED[0];
}

export function crmNormalizeOpportunity(item = {}, stages = []) {
  const stage = resolveCrmStageReference(item, stages);
  const status = normalizeCrmStatus(item.status || item.estado || item.est || "", stage);
  return {
    id: item.id || uid(),
    empId: item.empId || "",
    createdAt: item.createdAt || item.cr || today(),
    nombre: item.nombre || item.nom || "",
    empresaMarca: item.empresaMarca || item.empresa || item.marca || "",
    contacto: item.contacto || item.con || "",
    email: item.email || item.ema || "",
    telefono: item.telefono || item.tel || "",
    tipo_negocio: normalizeCrmBusinessType(item.tipo_negocio || item.tipoNegocio || item.tipo || ""),
    stageId: stage.id,
    status,
    monto_estimado: Number(item.monto_estimado ?? item.monto ?? 0),
    fecha_cierre_estimada: item.fecha_cierre_estimada || item.fechaCierreEstimada || "",
    notas: item.notas || item.notes || "",
    responsable: item.responsable || item.responsableId || "",
    nextAction: item.nextAction || item.proximaAccion || "",
    nextActionDate: item.nextActionDate || item.proximaAccionFecha || "",
    linkedClientId: item.linkedClientId || "",
    linkedSponsorId: item.linkedSponsorId || "",
    convertedAt: item.convertedAt || "",
    convertedBy: item.convertedBy || "",
    source: item.source || "manual",
  };
}

export function crmNormalizeActivities(items = []) {
  return (Array.isArray(items) ? items : []).map(item => ({
    id: item.id || uid(),
    empId: item.empId || "",
    opportunityId: item.opportunityId || item.oppId || "",
    type: item.type || "note",
    text: item.text || "",
    createdAt: item.createdAt || item.fecha || today(),
    byName: item.byName || item.autor || "",
    subject: item.subject || "",
    to: item.to || "",
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    delivery: item.delivery || null,
  }));
}

export function crmActivityEntry(opportunityId, text, type, user, empId, extra = {}) {
  return {
    id: uid(),
    empId,
    opportunityId,
    text,
    type,
    createdAt: today(),
    byName: user?.name || "Sistema",
    subject: extra.subject || "",
    to: extra.to || "",
    attachments: Array.isArray(extra.attachments) ? extra.attachments : [],
    delivery: extra.delivery || null,
  };
}

export function crmEntityLabel(opp) {
  return opp?.tipo_negocio === "auspiciador" ? "Auspiciador" : "Cliente";
}

export function crmCanPassToClient(opp, stages = []) {
  const stage = crmStageMeta(opp?.stageId, stages);
  return !!opp && !opp.linkedClientId && !opp.linkedSponsorId && (stage.convertToClient || stage.closedWon || opp.status === "Ganada");
}

export function crmFindClientDuplicate(clientes = [], opp = {}) {
  const targetName = String(opp.empresaMarca || opp.nombre || "").trim().toLowerCase();
  const targetEmail = String(opp.email || "").trim().toLowerCase();
  return (clientes || []).find(cliente => {
    const sameName = String(cliente.nom || "").trim().toLowerCase() === targetName;
    const sameEmail = targetEmail && (cliente.contactos || []).some(contacto => String(contacto.ema || "").trim().toLowerCase() === targetEmail);
    return sameName || sameEmail;
  }) || null;
}

export function crmFindSponsorDuplicate(auspiciadores = [], opp = {}) {
  const targetName = String(opp.empresaMarca || opp.nombre || "").trim().toLowerCase();
  const targetEmail = String(opp.email || "").trim().toLowerCase();
  return (auspiciadores || []).find(auspiciador => {
    const sameName = String(auspiciador.nom || "").trim().toLowerCase() === targetName;
    const sameEmail = targetEmail && String(auspiciador.ema || "").trim().toLowerCase() === targetEmail;
    return sameName || sameEmail;
  }) || null;
}

export function crmOpportunityCsvRows(items = [], stages = [], users = []) {
  return items.map(opp => {
    const stage = crmStageMeta(opp.stageId, stages);
    const owner = (users || []).find(user => user.id === opp.responsable);
    return {
      Nombre: opp.nombre || "",
      "Empresa o marca": opp.empresaMarca || "",
      Contacto: opp.contacto || "",
      Email: opp.email || "",
      Telefono: opp.telefono || "",
      "Tipo negocio": crmEntityLabel(opp),
      Etapa: stage.name || "",
      Estado: opp.status || "",
      "Monto estimado": Number(opp.monto_estimado || 0),
      "Fecha cierre estimada": opp.fecha_cierre_estimada || "",
      Responsable: owner?.name || "—",
      "Proxima accion": opp.nextAction || "",
    };
  });
}

export function exportCrmCsv(items = [], stages = [], users = []) {
  const rows = crmOpportunityCsvRows(items, stages, users);
  if (!rows.length) {
    alert("No hay oportunidades para exportar.");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join("\t"),
    ...rows.map(row => headers.map(header => String(row[header] ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")),
  ];
  const content = `\uFEFF${lines.join("\n")}`;
  const blob = new Blob([content], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `crm_oportunidades_${today()}.xls`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(anchor.href), 1200);
}
