import { useCallback, useEffect, useMemo } from "react";

export function useLabTheme({
  THEME_PRESETS,
  curEmp,
  storedSession,
  globalInitReady = false,
  empresas,
  setEmpresasRaw,
  setThemeDB,
  dbSet,
}) {
  const DEFAULT_T = useMemo(() => ({
    ...THEME_PRESETS.clasico.dark,
    preset: "clasico",
    mode: "dark",
  }), [THEME_PRESETS]);

  const resolveTheme = useCallback((rawTheme) => {
    const presetKey = rawTheme?.preset || "clasico";
    const mode = rawTheme?.mode || "dark";
    const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.clasico;
    const base = preset[mode] || preset.dark;
    return { ...base, ...rawTheme, preset: presetKey, mode };
  }, [THEME_PRESETS]);

  const commitThemeToDom = useCallback((merged) => {
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
  }, []);

  const theme = useMemo(() => {
    if (curEmp?.id) {
      const freshEmp = (empresas || []).find(item => item.id === curEmp.id) || curEmp;
      return resolveTheme(freshEmp?.theme || DEFAULT_T);
    }

    if (storedSession?.empId) {
      const sessionEmp = (empresas || []).find(item => item.id === storedSession.empId);
      if (sessionEmp) return resolveTheme(sessionEmp?.theme || DEFAULT_T);
    }

    if (!globalInitReady && storedSession?.userId) return null;
    return resolveTheme(DEFAULT_T);
  }, [curEmp, empresas, storedSession, globalInitReady, resolveTheme, DEFAULT_T]);

  const applyTheme = useCallback((nextTheme) => {
    const merged = resolveTheme(nextTheme);
    return commitThemeToDom(merged);
  }, [resolveTheme, commitThemeToDom]);

  const saveTheme = useCallback((nextTheme) => {
    const resolved = resolveTheme(nextTheme);
    commitThemeToDom(resolved);
    if (curEmp?.id) {
      const updated = (empresas || []).map(item => item.id === curEmp.id ? { ...item, theme: resolved, color: resolved.accent || item.color } : item);
      setEmpresasRaw(updated);
      dbSet("produ:empresas", updated);
    } else {
      setThemeDB(resolved);
      dbSet("produ:theme", resolved);
    }
  }, [resolveTheme, commitThemeToDom, curEmp, empresas, setEmpresasRaw, setThemeDB, dbSet]);

  useEffect(() => {
    if (!theme) return;
    commitThemeToDom(theme);
  }, [theme, commitThemeToDom]);

  return {
    DEFAULT_T,
    theme,
    applyTheme,
    saveTheme,
  };
}
