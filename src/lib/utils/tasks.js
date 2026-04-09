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

export const assignedNameList = (item, crew = [], user = null) => {
  const crewMap = Object.fromEntries((crew || []).filter(c => c && c.id).map(c => [c.id, c]));
  return getAssignedIds(item).map(id => {
    if (crewMap[id]?.nom) return crewMap[id].nom;
    if (user?.id === id) return user?.name || "Usuario";
    return "";
  }).filter(Boolean);
};
