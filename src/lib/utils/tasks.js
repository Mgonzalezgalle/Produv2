export const COLS_TAREAS = ["Pendiente", "En Progreso", "En Revisión", "Completada"];
export const PRIO_COLORS = { Alta: "#ff5566", Media: "#fbbf24", Baja: "#60a5fa" };
export const PRIO_BG = { Alta: "#ff556618", Media: "#fbbf2418", Baja: "#60a5fa18" };

export const getAssignedIds = item => {
  const ids = Array.isArray(item?.assignedIds)
    ? item.assignedIds.filter(Boolean)
    : item?.asignadoA
      ? [item.asignadoA]
      : [];
  return [...new Set(ids)];
};

export const normalizeTaskAssignees = task => {
  const assignedIds = getAssignedIds(task);
  return { ...task, assignedIds, asignadoA: task?.asignadoA || assignedIds[0] || "" };
};

export const normalizeTaskRecurrence = task => {
  const recurrenciaTipo = String(task?.recurrenciaTipo || "").trim().toLowerCase();
  const recurrenciaActiva = recurrenciaTipo === "mensual";
  return {
    ...task,
    recurrenciaTipo: recurrenciaActiva ? "mensual" : "",
    recurrenciaActiva,
    recurrenciaSerieId: recurrenciaActiva ? String(task?.recurrenciaSerieId || "").trim() : "",
    recurrenciaBaseFecha: recurrenciaActiva ? String(task?.recurrenciaBaseFecha || task?.fechaLimite || "").trim() : "",
    recurrenciaOrden: Number.isFinite(Number(task?.recurrenciaOrden)) ? Number(task.recurrenciaOrden) : 0,
  };
};

export const addMonthsToDateKey = (dateKey = "", months = 0) => {
  if (!dateKey) return "";
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const safeYear = Number(year || 0);
  const safeMonth = Number(month || 1);
  const safeDay = Number(day || 1);
  if (!safeYear || !safeMonth || !safeDay) return "";
  const base = new Date(safeYear, safeMonth - 1, safeDay);
  if (Number.isNaN(base.getTime())) return "";
  const anchorMonth = base.getMonth();
  base.setMonth(anchorMonth + Number(months || 0));
  if (base.getMonth() !== ((anchorMonth + Number(months || 0)) % 12 + 12) % 12) {
    base.setDate(0);
  }
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, "0");
  const d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const assignedNameList = (item, crew = [], user = null) => {
  const crewMap = Object.fromEntries((crew || []).filter(c => c && c.id).map(c => [c.id, c]));
  return getAssignedIds(item).map(id => {
    if (crewMap[id]?.nom) return crewMap[id].nom;
    if (user?.id === id) return user?.name || "Usuario";
    return "";
  }).filter(Boolean);
};
