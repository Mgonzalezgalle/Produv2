import { useCallback } from "react";

export function useLabBalance(movimientos, empId) {
  return useCallback(id => {
    const mv = (movimientos || []).filter(m => m.eid === id && m.empId === empId);
    const i = mv.filter(m => m.tipo === "ingreso").reduce((s, m) => s + Number(m.mon), 0);
    const g = mv.filter(m => m.tipo === "gasto").reduce((s, m) => s + Number(m.mon), 0);
    return { i, g, b: i - g };
  }, [movimientos, empId]);
}
