import { useCallback, useEffect, useMemo, useState } from "react";

export function useLabSelfServeAccess() {
  const [solOpen, setSolOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("selfserve") === "1";
  });
  const [solF, setSolF] = useState({});
  const [solSent, setSolSent] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (solOpen) url.searchParams.set("selfserve", "1");
    else url.searchParams.delete("selfserve");
    window.history.replaceState({}, "", url.toString());
  }, [solOpen]);

  const reset = useCallback(() => {
    setSolOpen(false);
    setSolF({});
    setSolSent(false);
  }, []);

  const open = useCallback(() => {
    setSolF({});
    setSolSent(false);
    setSolOpen(false);
    setTimeout(() => {
      setSolOpen(true);
    }, 0);
  }, []);

  const close = reset;

  return useMemo(() => ({
    solOpen,
    setSolOpen,
    solF,
    setSolF,
    solSent,
    setSolSent,
    open,
    close,
    reset,
  }), [solOpen, solF, solSent, open, close, reset]);
}
