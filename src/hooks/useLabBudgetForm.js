import { useEffect, useMemo, useState } from "react";
import { contractsForReference } from "../lib/utils/helpers";

function budgetDraftKey(empresaId = "", userId = "") {
  return `produ:budgetDraft:${empresaId || "global"}:${userId || "anon"}`;
}

function loadBudgetDraft(empresaId = "", userId = "") {
  try {
    const raw = localStorage.getItem(budgetDraftKey(empresaId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBudgetDraft(empresaId = "", userId = "", draft = null) {
  try {
    if (!draft) {
      localStorage.removeItem(budgetDraftKey(empresaId, userId));
      return;
    }
    localStorage.setItem(budgetDraftKey(empresaId, userId), JSON.stringify(draft));
  } catch {}
}

export function useLabBudgetForm({
  open,
  data,
  empresa,
  currentUser,
  piezas,
  contratos,
  uid,
  today,
  hasAddon,
}) {
  const pieceLine = () => ({ id: uid(), desc: "Piezas mensuales", qty: 1, precio: 0, und: "pieza", recurrence: "monthly" });
  const empty = {
    titulo: "",
    cliId: "",
    tipo: "produccion",
    refId: "",
    estado: "Pendiente",
    validez: "30",
    moneda: "CLP",
    iva: true,
    metodoPago: "",
    fechaPago: "",
    notasPago: "",
    obs: "",
    items: [],
    contratoId: "",
    autoFactura: false,
    modoDetalle: "items",
    detallePiezas: "Piezas mensuales",
    pieceLines: [pieceLine()],
    recurring: false,
    recMonths: "6",
    recStart: today(),
  };

  const [f, setF] = useState({});
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKeyArgs = [empresa?.id || "", currentUser?.id || ""];

  useEffect(() => {
    if (!open) return;
    if (data?.id) {
      setDraftRestored(false);
      setF({
        ...data,
        items: (data.items || []).map((it) => ({ ...it, recurrence: it.recurrence || "once" })),
        pieceLines: (data.pieceLines || data.items || [])
          .filter((it) => it && it.und === "pieza")
          .map((it) => ({
            id: it.id || uid(),
            desc: it.desc || "Piezas mensuales",
            qty: Number(it.qty || 1),
            precio: Number(it.precio || 0),
            und: "pieza",
            recurrence: it.recurrence || "monthly",
          })) || [pieceLine()],
      });
      return;
    }
    const draft = loadBudgetDraft(...draftKeyArgs);
    if (draft) {
      setDraftRestored(true);
      setF({
        ...empty,
        ...draft,
        items: (draft.items || []).map((it) => ({ ...it, recurrence: it.recurrence || "once" })),
        pieceLines: (draft.pieceLines || draft.items || [])
          .filter((it) => it && it.und === "pieza")
          .map((it) => ({
            id: it.id || uid(),
            desc: it.desc || "Piezas mensuales",
            qty: Number(it.qty || 1),
            precio: Number(it.precio || 0),
            und: "pieza",
            recurrence: it.recurrence || "monthly",
          })) || [pieceLine()],
      });
      return;
    }
    setDraftRestored(false);
    setF({ ...empty });
  }, [data, open, empresa?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open || data?.id || !Object.keys(f || {}).length) return;
    saveBudgetDraft(...draftKeyArgs, f);
  }, [f, open, data?.id, empresa?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const u = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const canPrograms = hasAddon(empresa, "television");
  const canSocial = hasAddon(empresa, "social");
  const canContracts = hasAddon(empresa, "contratos");
  const canInvoices = hasAddon(empresa, "facturacion");

  const addItem = () => setF((p) => ({ ...p, items: [...(p.items || []), { id: uid(), desc: "", qty: 1, precio: 0, und: "Unidad", recurrence: "once" }] }));
  const updItem = (i, k, v) => setF((p) => ({ ...p, items: (p.items || []).map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const delItem = (i) => setF((p) => ({ ...p, items: (p.items || []).filter((_, j) => j !== i) }));
  const addPieceLine = () => setF((p) => ({ ...p, pieceLines: [...(p.pieceLines || []), pieceLine()] }));
  const updPieceLine = (i, k, v) => setF((p) => ({ ...p, pieceLines: (p.pieceLines || []).map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const delPieceLine = (i) => setF((p) => ({ ...p, pieceLines: (p.pieceLines || []).filter((_, j) => j !== i) }));

  const socialCampaign = useMemo(() => (piezas || []).find((x) => x.id === f.refId), [f.refId, piezas]);
  const pieceItems = useMemo(() => (
    f.modoDetalle === "piezas"
      ? ((f.pieceLines || []).length ? (f.pieceLines || []) : [pieceLine()]).map((it, i) => ({
          ...it,
          id: it.id || uid(),
          desc: it.desc || `Piezas ${i + 1}`,
          qty: Number(it.qty || 0),
          precio: Number(it.precio || 0),
          und: "pieza",
          recurrence: it.recurrence || "monthly",
        }))
      : (f.items || [])
  ), [f.items, f.modoDetalle, f.pieceLines]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = pieceItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.precio || 0), 0);
  const ivaVal = f.iva ? Math.round(subtotal * 0.19) : f.honorarios ? Math.round(subtotal * 0.1525) : 0;
  const total = subtotal + ivaVal;
  const recurringMonths = Math.max(1, Number(f.recMonths || 1));
  const projectedTotal = f.recurring ? total * recurringMonths : total;
  const contratosCli = contractsForReference(contratos || [], f.cliId, f.tipo, f.refId);

  const discardDraft = () => {
    saveBudgetDraft(...draftKeyArgs, null);
    setDraftRestored(false);
    setF({ ...empty });
  };

  const applyReference = (value) => {
    if (f.tipo === "contenido") {
      const campaign = (piezas || []).find((x) => x.id === value);
      setF((prev) => ({
        ...prev,
        refId: value,
        cliId: prev.cliId || campaign?.cliId || "",
        pieceLines: prev.modoDetalle === "piezas" && !(prev.pieceLines || []).length
          ? [{ id: uid(), desc: `Piezas ${campaign?.mes || "mensuales"}`, qty: Number(campaign?.plannedPieces || 1), precio: 0, und: "pieza" }]
          : prev.pieceLines,
      }));
      return;
    }
    u("refId", value);
  };

  const buildPayload = () => {
    const normalizedItems = canSocial && f.tipo === "contenido" && f.modoDetalle === "piezas"
      ? pieceItems
      : (f.items || []);
    saveBudgetDraft(...draftKeyArgs, null);
    return {
      ...f,
      items: normalizedItems,
      pieceLines: canSocial && f.tipo === "contenido" && f.modoDetalle === "piezas" ? pieceItems : (f.pieceLines || []),
      subtotal,
      ivaVal,
      total,
      projectedTotal,
    };
  };

  return {
    f,
    setF,
    u,
    canPrograms,
    canSocial,
    canContracts,
    canInvoices,
    addItem,
    updItem,
    delItem,
    addPieceLine,
    updPieceLine,
    delPieceLine,
    socialCampaign,
    pieceItems,
    subtotal,
    ivaVal,
    total,
    recurringMonths,
    projectedTotal,
    contratosCli,
    draftRestored,
    discardDraft,
    applyReference,
    buildPayload,
  };
}
