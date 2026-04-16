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
  const recurrenciaTipoRaw = String(task?.recurrenciaTipo || "").trim().toLowerCase();
  const recurrenciaPreset = ["diaria", "semanal", "mensual", "trimestral", "personalizada"].includes(recurrenciaTipoRaw)
    ? recurrenciaTipoRaw
    : "";
  const fallbackUnidad = recurrenciaPreset === "diaria"
    ? "dia"
    : recurrenciaPreset === "semanal"
      ? "semana"
      : recurrenciaPreset === "mensual" || recurrenciaPreset === "trimestral"
        ? "mes"
        : "";
  const fallbackIntervalo = recurrenciaPreset === "trimestral" ? 3 : recurrenciaPreset ? 1 : 0;
  const recurrenciaUnidad = String(task?.recurrenciaUnidad || fallbackUnidad).trim().toLowerCase();
  const recurrenciaIntervalo = Math.max(1, Number(task?.recurrenciaIntervalo || fallbackIntervalo || 0));
  const recurrenciaActiva = Boolean(recurrenciaPreset && recurrenciaUnidad && recurrenciaIntervalo > 0);
  return {
    ...task,
    recurrenciaTipo: recurrenciaActiva ? recurrenciaPreset : "",
    recurrenciaActiva,
    recurrenciaUnidad: recurrenciaActiva ? recurrenciaUnidad : "",
    recurrenciaIntervalo: recurrenciaActiva ? recurrenciaIntervalo : 0,
    recurrenciaSerieId: recurrenciaActiva ? String(task?.recurrenciaSerieId || "").trim() : "",
    recurrenciaBaseFecha: recurrenciaActiva ? String(task?.recurrenciaBaseFecha || task?.fechaLimite || "").trim() : "",
    recurrenciaOrden: Number.isFinite(Number(task?.recurrenciaOrden)) ? Number(task.recurrenciaOrden) : 0,
  };
};

const formatDateKey = (date = null) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  return formatDateKey(base);
};

export const addDaysToDateKey = (dateKey = "", days = 0) => {
  if (!dateKey) return "";
  const base = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "";
  base.setDate(base.getDate() + Number(days || 0));
  return formatDateKey(base);
};

export const addRecurrenceToDateKey = (dateKey = "", unidad = "", intervalo = 1) => {
  const safeInterval = Math.max(1, Number(intervalo || 1));
  if (unidad === "dia") return addDaysToDateKey(dateKey, safeInterval);
  if (unidad === "semana") return addDaysToDateKey(dateKey, safeInterval * 7);
  if (unidad === "mes") return addMonthsToDateKey(dateKey, safeInterval);
  return "";
};

export const taskRecurrenceLabel = task => {
  const tipo = String(task?.recurrenciaTipo || "").trim().toLowerCase();
  const intervalo = Math.max(1, Number(task?.recurrenciaIntervalo || 1));
  if (tipo === "diaria") return "Recurrente diaria";
  if (tipo === "semanal") return "Recurrente semanal";
  if (tipo === "mensual") return "Recurrente mensual";
  if (tipo === "trimestral") return "Recurrente trimestral";
  if (tipo === "personalizada") {
    const unidad = String(task?.recurrenciaUnidad || "").trim().toLowerCase();
    const unidadLabel = unidad === "dia" ? "día" : unidad === "semana" ? "semana" : unidad === "mes" ? "mes" : "periodo";
    return `Cada ${intervalo} ${unidadLabel}${intervalo === 1 ? "" : "s"}`;
  }
  return "";
};

export const assignedNameList = (item, crew = [], user = null) => {
  const crewMap = Object.fromEntries((crew || []).filter(c => c && c.id).map(c => [c.id, c]));
  return getAssignedIds(item).map(id => {
    if (crewMap[id]?.nom) return crewMap[id].nom;
    if (user?.id === id) return user?.name || "Usuario";
    return "";
  }).filter(Boolean);
};
