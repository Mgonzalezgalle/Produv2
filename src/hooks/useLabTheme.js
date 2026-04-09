import { useCallback, useEffect, useState } from "react";

export function useLabTheme({
  THEME_PRESETS,
  curEmp,
  empresas,
  setEmpresasRaw,
  setThemeDB,
  dbSet,
}) {
  const DEFAULT_T = { ...THEME_PRESETS.clasico.dark, preset: "clasico" };
  const [theme, setThemeState] = useState(DEFAULT_T);

  const resolveTheme = useCallback((rawTheme) => {
    const presetKey = rawTheme?.preset || "clasico";
    const mode = rawTheme?.mode || "dark";
    const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.clasico;
    const base = preset[mode] || preset.dark;
    return { ...base, ...rawTheme, preset: presetKey, mode };
  }, [THEME_PRESETS]);

  const applyTheme = useCallback((nextTheme) => {
    const merged = resolveTheme(nextTheme, curEmp);
    setThemeState(prev => JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged);
    const root = document.documentElement;
    const map = {
      "--bg": merged.bg,
      "--sur": merged.surface,
      "--card": merged.card,
      "--card2": merged.card,
      "--bdr": merged.border,
      "--bdr2": merged.border,
      "--cy": merged.accent,
      "--cy2": merged.accent2 || merged.accent,
      "--cg": `${merged.accent}20`,
      "--cm": `${merged.accent}40`,
      "--wh": merged.white,
      "--gr": merged.gray,
      "--gr2": merged.gray,
      "--gr3": `${merged.white}cc`,
      "--sidebar-bg": merged.sidebarBg || "#0f172a",
      "--sidebar-panel": merged.sidebarPanel || "#132033",
      "--sidebar-text": merged.sidebarText || "#e5f5ff",
      "--sidebar-muted": merged.sidebarMuted || "#9fb3c8",
    };
    Object.entries(map).forEach(([key, value]) => root.style.setProperty(key, value));
    document.body.className = merged.mode === "light" ? "light" : "dark";
    return merged;
  }, [resolveTheme, curEmp]);

  const saveTheme = useCallback((nextTheme) => {
    const resolved = resolveTheme(nextTheme, curEmp);
    applyTheme(resolved);
    if (curEmp?.id) {
      const updated = (empresas || []).map(item => item.id === curEmp.id ? { ...item, theme: resolved, color: resolved.accent || item.color } : item);
      setEmpresasRaw(updated);
      dbSet("produ:empresas", updated);
    } else {
      setThemeDB(resolved);
      dbSet("produ:theme", resolved);
    }
  }, [resolveTheme, applyTheme, curEmp, empresas, setEmpresasRaw, setThemeDB, dbSet]);

  useEffect(() => {
    if (curEmp?.id) {
      const freshEmp = (empresas || []).find(item => item.id === curEmp.id) || curEmp;
      applyTheme(freshEmp?.theme || DEFAULT_T);
      return;
    }
    applyTheme(DEFAULT_T);
  }, [curEmp?.id, empresas, applyTheme]);

  return {
    DEFAULT_T,
    theme,
    applyTheme,
    saveTheme,
  };
}
