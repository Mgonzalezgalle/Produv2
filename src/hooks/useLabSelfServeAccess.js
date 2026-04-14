import { useCallback, useMemo, useState } from "react";

export function useLabSelfServeAccess() {
  const [solOpen, setSolOpen] = useState(false);
  const [solF, setSolF] = useState({});
  const [solSent, setSolSent] = useState(false);

  const reset = useCallback(() => {
    setSolOpen(false);
    setSolF({});
    setSolSent(false);
  }, []);

  const open = useCallback(() => {
    setSolOpen(true);
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
